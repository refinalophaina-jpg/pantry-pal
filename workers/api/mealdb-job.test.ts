import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { refreshMealDb } from './mealdb-job';

let mf: Miniflare;
let env: Env;
const fetchMock = vi.fn<typeof fetch>();
const meal = (idMeal: string, strMeal: string, area = 'Vietnamese') => ({
  idMeal, strMeal, strDrinkAlternate: null, strCategory: 'Beef', strArea: area, strTags: 'Soup,Comfort', strYoutube: null, strSource: 'https://example.test/pho',
  strMealThumb: `https://www.themealdb.com/images/media/meals/${idMeal}.jpg`,
  strInstructions: 'Char the onion and ginger.\r\nSimmer the bones for four hours.\r\nAssemble the bowls.',
  strIngredient1: 'Beef bones', strMeasure1: '1 kg', strIngredient2: 'Rice noodles', strMeasure2: '400 g', strIngredient3: '', strMeasure3: '',
});
const job = () => env.DB.prepare("SELECT * FROM catalog_jobs WHERE name='themealdb'").first<Record<string, unknown>>();
const rows = () => env.DB.prepare('SELECT slug,name,cuisine,source,source_id,image_url,ingredients,steps,tags FROM recipe_catalog ORDER BY slug').all<Record<string, string>>();
function letterOf(input: RequestInfo | URL) { return new URL(String(input)).searchParams.get('f')!; }

beforeAll(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-09-21', d1Databases: ['DB'] }));
  env = await mf.getBindings<Env>();
  for (const file of ['migrations/auth/0001_better_auth.sql', 'migrations/d1/0001_domain.sql', 'migrations/d1/0003_catalog_jobs.sql', 'migrations/d1/0004_catalog_lease_token.sql', 'migrations/d1/0007_recipe_sources.sql']) {
    await env.DB.exec(readFileSync(file, 'utf8').replace(/^--.*$/gm, '').replace(/\n/g, ' '));
  }
});
afterAll(async () => { await mf?.dispose(); });
beforeEach(async () => {
  await env.DB.exec("DELETE FROM recipe_catalog; UPDATE catalog_jobs SET lease_until=0,lease_token=NULL,last_status=NULL,last_started_at=NULL,last_finished_at=NULL,requested=0,updated=0,missing=0 WHERE name='themealdb';");
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('TheMealDB weekly mirror with a real D1 binding', () => {
  it('fetches every letter once, upserts mapped recipes, and records an ok run', async () => {
    fetchMock.mockImplementation(async input => {
      const url = new URL(String(input));
      expect(url.origin).toBe('https://www.themealdb.com');
      const letter = letterOf(input);
      if (letter === 'p') return Response.json({ meals: [meal('52997', 'Pho'), meal('52997', 'Pho duplicate')] });
      if (letter === 'b') return Response.json({ meals: [meal('53000', 'Bun cha', 'Vietnamese'), { ...meal('53001', 'Broken'), strIngredient1: '', strIngredient2: '' }] });
      return Response.json({ meals: null });
    });
    await refreshMealDb(env);
    expect(fetchMock).toHaveBeenCalledTimes(26);
    expect(new Set(fetchMock.mock.calls.map(([input]) => letterOf(input))).size).toBe(26);
    const state = (await rows()).results;
    expect(state.map(row => row.slug)).toEqual(['mealdb-52997', 'mealdb-53000']);
    const pho = state[0];
    expect(pho).toMatchObject({ name: 'Pho', cuisine: 'Vietnamese', source: 'themealdb', source_id: '52997', image_url: 'https://www.themealdb.com/images/media/meals/52997.jpg' });
    expect(JSON.parse(pho.ingredients)).toEqual([{ name: 'Beef bones', quantity: 1, unit: 'kg' }, { name: 'Rice noodles', quantity: 400, unit: 'g' }]);
    expect(JSON.parse(pho.steps)).toHaveLength(3);
    expect(JSON.parse(pho.tags)).toEqual(['Soup', 'Comfort']);
    expect(await job()).toMatchObject({ last_status: 'ok', requested: 4, updated: 2, missing: 0, lease_until: 0, lease_token: null });
    // Searchable through the catalog FTS triggers like curated rows.
    expect(await env.DB.prepare("SELECT count(*) AS n FROM recipe_catalog_fts WHERE recipe_catalog_fts MATCH 'pho'").first<number>('n')).toBe(1);
  });

  it('is a no-op within a week of a successful run and retries after a partial run', async () => {
    fetchMock.mockImplementation(async input => Response.json({ meals: letterOf(input) === 'a' ? [meal('1', 'Adobo', 'Filipino')] : null }));
    await refreshMealDb(env);
    expect(fetchMock).toHaveBeenCalledTimes(26);
    await refreshMealDb(env);
    expect(fetchMock).toHaveBeenCalledTimes(26);
    await env.DB.exec("UPDATE catalog_jobs SET last_status='partial' WHERE name='themealdb'");
    await refreshMealDb(env);
    expect(fetchMock).toHaveBeenCalledTimes(52);
    await env.DB.prepare("UPDATE catalog_jobs SET last_status='ok',last_finished_at=? WHERE name='themealdb'").bind('2020-01-01T00:00:00.000Z').run();
    await refreshMealDb(env);
    expect(fetchMock).toHaveBeenCalledTimes(78);
  });

  it('keeps the letters that loaded, counts failed letters, and updates existing rows in place', async () => {
    await env.DB.prepare("INSERT INTO recipe_catalog(id,slug,name,source,source_id) VALUES('mealdb-1','mealdb-1','Old name','themealdb','1')").run();
    fetchMock.mockImplementation(async input => {
      const letter = letterOf(input);
      if (letter === 'x') return new Response('upstream unavailable', { status: 503 });
      if (letter === 'y') throw new Error('network');
      return Response.json({ meals: letter === 'a' ? [meal('1', 'Adobo', 'Filipino')] : null });
    });
    await refreshMealDb(env);
    const state = (await rows()).results;
    expect(state).toHaveLength(1);
    expect(state[0]).toMatchObject({ slug: 'mealdb-1', name: 'Adobo', cuisine: 'Filipino' });
    expect(await env.DB.prepare('SELECT count(*) AS n FROM recipe_catalog').first<number>('n')).toBe(1);
    expect(await job()).toMatchObject({ last_status: 'partial', requested: 1, updated: 1, missing: 2, lease_token: null });
  });

  it('rejects malformed responses, records a failed run, and releases the lease', async () => {
    fetchMock.mockImplementation(async () => Response.json({ meals: 'not a list' }));
    await expect(refreshMealDb(env)).rejects.toThrow('failed');
    expect(await job()).toMatchObject({ last_status: 'failed', lease_until: 0, lease_token: null });
    expect(await env.DB.prepare('SELECT count(*) AS n FROM recipe_catalog').first<number>('n')).toBe(0);
  });

  it('skips while another invocation holds the lease and leaves the openfoodfacts job alone', async () => {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("UPDATE catalog_jobs SET lease_until=?,lease_token='existing' WHERE name='themealdb'").bind(now + 600).run();
    await refreshMealDb(env);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await env.DB.prepare("SELECT lease_token FROM catalog_jobs WHERE name='openfoodfacts'").first<string | null>('lease_token')).toBeNull();
  });
});
