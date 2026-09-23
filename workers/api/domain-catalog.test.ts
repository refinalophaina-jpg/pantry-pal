import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { handleCatalog } from './domain-catalog';

let mf: Miniflare;
let env: Env;
async function get(path: string) {
  const response = await handleCatalog(new Request(`https://test.local${path}`), env);
  if (!response) throw new Error(`Unhandled ${path}`);
  return { status: response.status, body: await response.json() as Record<string, any> };
}

beforeAll(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-09-21', d1Databases: ['DB'] }));
  env = await mf.getBindings<Env>();
  for (const file of ['migrations/auth/0001_better_auth.sql', 'migrations/d1/0001_domain.sql', 'migrations/d1/0002_reference_seed.sql', 'migrations/d1/0003_catalog_jobs.sql', 'migrations/d1/0004_catalog_lease_token.sql', 'migrations/d1/0007_recipe_sources.sql', 'migrations/d1/0009_technique_guides.sql', 'migrations/d1/0010_catalog_job_error.sql']) {
    await env.DB.exec(readFileSync(file, 'utf8').replace(/^--.*$/gm, '').replace(/\n/g, ' '));
  }
  await env.DB.prepare("INSERT INTO recipe_catalog(id,slug,name,cuisine,minutes,ingredients,tags,image_url,source,source_id) VALUES('mealdb-1','mealdb-1','Pho','Vietnamese',90,?,?,'https://www.themealdb.com/images/media/meals/1.jpg','themealdb','1')")
    .bind(JSON.stringify([{ name: 'Beef bones', quantity: 1, unit: 'kg' }, { name: 'Rice noodles', quantity: 400, unit: 'g' }]), JSON.stringify(['Soup'])).run();
});
afterAll(async () => { await mf?.dispose(); });

describe('recipe catalog index', () => {
  it('lists every recipe once with slim fields and ingredient names only', async () => {
    const { status, body } = await get('/api/catalog/recipes/index');
    expect(status).toBe(200);
    expect(body.count).toBe(7);
    const pho = body.data.find((row: { slug: string }) => row.slug === 'mealdb-1');
    expect(pho).toEqual({ slug: 'mealdb-1', name: 'Pho', cuisine: 'Vietnamese', minutes: 90, difficulty: 'medium', servings: 2, imageUrl: 'https://www.themealdb.com/images/media/meals/1.jpg', source: 'themealdb', tags: ['Soup'], ingredients: ['Beef bones', 'Rice noodles'] });
    expect(Object.keys(body.data[0])).not.toContain('steps');
    expect(body.data.map((row: { name: string }) => row.name.toLowerCase())).toEqual([...body.data].map((row: { name: string }) => row.name.toLowerCase()).sort());
  });
  it('loads a full recipe by slug and validates the slug', async () => {
    const { body } = await get('/api/catalog/recipes?slug=mealdb-1');
    expect(body.data).toMatchObject({ slug: 'mealdb-1', name: 'Pho', ingredients: [{ name: 'Beef bones', quantity: 1, unit: 'kg' }, { name: 'Rice noodles', quantity: 400, unit: 'g' }] });
    expect((await get('/api/catalog/recipes?slug=missing')).body.data).toBeNull();
    await expect(get('/api/catalog/recipes?slug=bad%20slug')).rejects.toMatchObject({ status: 400 });
  });
  it('rewrites every technique guide in place with sourced steps and keeps search working', async () => {
    const { body } = await get('/api/catalog/techniques?limit=100');
    expect(body.data).toHaveLength(15);
    for (const guide of body.data) {
      expect(guide.body.split('\n').filter((line: string) => /^\d+\. /.test(line)).length).toBeGreaterThanOrEqual(3);
      expect(guide.body.split('\n').at(-1)).toMatch(/^Sources: /);
    }
    const searing = body.data.find((guide: { slug: string }) => guide.slug === 'searing');
    expect(searing.body).toContain('https://www.fsis.usda.gov/');
    expect(searing.body).toContain('74°C / 165°F');
    expect((await get('/api/catalog/techniques?q=brown')).body.data.map((guide: { slug: string }) => guide.slug)).toContain('searing');
  });
  it('registers the mirror job without touching the existing one', async () => {
    const jobs = (await env.DB.prepare('SELECT name FROM catalog_jobs ORDER BY name').all<{ name: string }>()).results.map(row => row.name);
    expect(jobs).toEqual(['openfoodfacts', 'themealdb']);
  });
  it('reports scheduled job status without exposing the lease token', async () => {
    await env.DB.prepare("UPDATE catalog_jobs SET last_status='partial',last_started_at='2026-09-23T03:17:00.000Z',last_finished_at='2026-09-23T03:17:09.000Z',requested=760,updated=760,missing=1,lease_until=0,lease_token='secret-token',last_error='Error: mealdb_fetch_failed:503' WHERE name='themealdb'").run();
    await env.DB.prepare("UPDATE catalog_jobs SET last_status='running',lease_until=? WHERE name='openfoodfacts'").bind(Math.floor(Date.now() / 1000) + 600).run();
    const { status, body } = await get('/api/catalog/jobs');
    expect(status).toBe(200);
    expect(body.data).toEqual([
      { name: 'openfoodfacts', status: 'running', startedAt: null, finishedAt: null, requested: 0, updated: 0, missing: 0, leased: true, error: null },
      { name: 'themealdb', status: 'partial', startedAt: '2026-09-23T03:17:00.000Z', finishedAt: '2026-09-23T03:17:09.000Z', requested: 760, updated: 760, missing: 1, leased: false, error: 'Error: mealdb_fetch_failed:503' },
    ]);
    expect(JSON.stringify(body)).not.toContain('secret-token');
    await env.DB.prepare("UPDATE catalog_jobs SET last_status=NULL,lease_until=0,lease_token=NULL,requested=0,updated=0,missing=0,last_started_at=NULL,last_finished_at=NULL,last_error=NULL").run();
  });
});
