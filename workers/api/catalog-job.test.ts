import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { refreshCatalog } from './catalog-job';

let mf: Miniflare;
let env: Env;
const fetchMock = vi.fn<typeof fetch>();
const stale = '2020-01-01T00:00:00.000Z';
const code = (index: number) => String(index).padStart(13, '0');
const product = (barcode: string, name = 'Updated food') => ({ code: barcode, product_name: name, nutriments: { 'energy-kcal_100g': 123.5 } });

async function addFoods(count: number) {
  await env.DB.batch(Array.from({ length: count }, (_, index) => env.DB.prepare("INSERT INTO foods(id,barcode,name,calories,updated_at) VALUES(?,?,?,880,?)").bind(crypto.randomUUID(), code(index), 'Old food', stale)));
}
const job = () => env.DB.prepare("SELECT * FROM catalog_jobs WHERE name='openfoodfacts'").first<Record<string, unknown>>();
const foods = () => env.DB.prepare('SELECT barcode,name,calories,updated_at FROM foods ORDER BY barcode').all<{ barcode: string; name: string; calories: number | null; updated_at: string }>();
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}

beforeAll(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-09-21', d1Databases: ['DB'] }));
  env = await mf.getBindings<Env>();
  for (const file of ['migrations/auth/0001_better_auth.sql', 'migrations/d1/0001_domain.sql', 'migrations/d1/0003_catalog_jobs.sql', 'migrations/d1/0004_catalog_lease_token.sql', 'migrations/d1/0010_catalog_job_error.sql']) {
    await env.DB.exec(readFileSync(file, 'utf8').replace(/^--.*$/gm, '').replace(/\n/g, ' '));
  }
});
afterAll(async () => { await mf?.dispose(); });
beforeEach(async () => {
  await env.DB.exec("DELETE FROM foods; UPDATE catalog_jobs SET lease_until=0,lease_token=NULL,last_status=NULL,last_started_at=NULL,last_finished_at=NULL,requested=0,updated=0,missing=0,last_error=NULL;");
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('catalog cron with a real D1 binding', () => {
  it('processes at most 100 stale OFF rows and rotates remaining eligible rows', async () => {
    await addFoods(105);
    await env.DB.prepare("INSERT INTO foods(id,barcode,name,updated_at) VALUES('fresh',?,'Fresh',?)").bind(code(200), new Date().toISOString()).run();
    await env.DB.prepare("INSERT INTO foods(id,barcode,name,source,updated_at) VALUES('curated',?,'Curated','curated',?)").bind(code(201), stale).run();
    fetchMock.mockImplementation(async input => {
      const url = new URL(String(input));
      expect(url.origin).toBe('https://world.openfoodfacts.org');
      expect(url.searchParams.get('page_size')).toBe('100');
      const requested = url.searchParams.get('code')!.split(',');
      expect(requested).toHaveLength(100);
      return Response.json({ products: requested.map(barcode => product(barcode)) });
    });
    await refreshCatalog(env);
    expect(fetchMock).toHaveBeenCalledOnce();
    const state = (await foods()).results;
    expect(state.filter(row => row.name === 'Updated food')).toHaveLength(100);
    expect(state.filter(row => row.name === 'Old food')).toHaveLength(5);
    expect(state.find(row => row.barcode === code(200))!.name).toBe('Fresh');
    expect(state.find(row => row.barcode === code(201))!.name).toBe('Curated');
    expect(await job()).toMatchObject({ requested: 100, updated: 100, missing: 0, last_status: 'ok', lease_until: 0, lease_token: null });
    fetchMock.mockImplementation(async input => {
      const requested = new URL(String(input)).searchParams.get('code')!.split(',');
      expect(requested).toHaveLength(5);
      return Response.json({ products: requested.map(barcode => product(barcode)) });
    });
    await refreshCatalog(env);
    expect(await job()).toMatchObject({ requested: 5, updated: 5, missing: 0 });
  });

  it('records partial results honestly, ignores duplicates/foreign or malformed products, and retries omissions', async () => {
    await addFoods(2);
    fetchMock.mockResolvedValueOnce(Response.json({ products: [product(code(0)), product(code(0), 'Duplicate'), product(code(300)), null, { code: code(1), product_name: {} }] }));
    await refreshCatalog(env);
    expect(await job()).toMatchObject({ requested: 2, updated: 1, missing: 1, last_status: 'partial' });
    const state = (await foods()).results;
    expect(state[0].name).toBe('Updated food');
    expect(state[1]).toMatchObject({ name: 'Old food', calories: 880, updated_at: stale });
    fetchMock.mockResolvedValueOnce(Response.json({ products: [product(code(1), 'Recovered')] }));
    await refreshCatalog(env);
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('code')).toBe(code(1));
    expect(await job()).toMatchObject({ requested: 1, updated: 1, missing: 0, last_status: 'ok' });
  });

  it('keeps failed-fetch rows untouched and eligible, resets counters, and releases its lease', async () => {
    await addFoods(2);
    await env.DB.exec("UPDATE catalog_jobs SET missing=99,updated=99;");
    fetchMock.mockResolvedValueOnce(new Response('upstream unavailable', { status: 503 }));
    await expect(refreshCatalog(env)).rejects.toThrow('Catalog refresh failed');
    expect((await foods()).results.every(row => row.updated_at === stale && row.calories === 880)).toBe(true);
    expect(await job()).toMatchObject({ requested: 2, updated: 0, missing: 2, last_status: 'failed', lease_until: 0, lease_token: null, last_error: 'Error: catalog_fetch_failed:503' });
    fetchMock.mockResolvedValueOnce(Response.json({ products: [product(code(0)), product(code(1))] }));
    await refreshCatalog(env);
    expect(await job()).toMatchObject({ requested: 2, updated: 2, last_status: 'ok' });
  });

  it('skips an active lease and recovers an expired lease', async () => {
    await addFoods(1);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("UPDATE catalog_jobs SET lease_until=?,lease_token='existing'").bind(now + 600).run();
    await refreshCatalog(env);
    expect(fetchMock).not.toHaveBeenCalled();
    await env.DB.prepare('UPDATE catalog_jobs SET lease_until=?').bind(now - 1).run();
    fetchMock.mockResolvedValueOnce(Response.json({ products: [product(code(0))] }));
    await refreshCatalog(env);
    expect(await job()).toMatchObject({ last_status: 'ok', lease_until: 0, lease_token: null });
  });

  it('fences a delayed invocation from writing rows or releasing a replacement lease', async () => {
    await addFoods(1);
    const oldResponse = deferred<Response>();
    const newResponse = deferred<Response>();
    const oldStarted = deferred<void>();
    const newStarted = deferred<void>();
    fetchMock.mockImplementationOnce(() => { oldStarted.resolve(); return oldResponse.promise; });
    fetchMock.mockImplementationOnce(() => { newStarted.resolve(); return newResponse.promise; });
    const oldRun = refreshCatalog(env);
    await oldStarted.promise;
    await env.DB.prepare('UPDATE catalog_jobs SET lease_until=?').bind(Math.floor(Date.now() / 1000) - 1).run();
    const newRun = refreshCatalog(env);
    await newStarted.promise;
    const replacement = await job();
    oldResponse.resolve(Response.json({ products: [product(code(0), 'Stale completion')] }));
    await expect(oldRun).rejects.toThrow('superseded');
    expect(await job()).toEqual(replacement);
    expect((await foods()).results[0].name).toBe('Old food');
    newResponse.resolve(Response.json({ products: [product(code(0), 'New completion')] }));
    await newRun;
    expect((await foods()).results[0].name).toBe('New completion');
    expect(await job()).toMatchObject({ last_status: 'ok', updated: 1, lease_token: null });
    expect((await env.DB.prepare('SELECT * FROM mutation_assertions').all()).results).toHaveLength(0);
  });

  it('rolls back every product when a SQL write fails mid-batch', async () => {
    await addFoods(2);
    await env.DB.exec(`CREATE TRIGGER catalog_test_failure BEFORE UPDATE ON foods WHEN NEW.barcode='${code(1)}' BEGIN SELECT RAISE(ABORT,'test failure'); END;`);
    try {
      fetchMock.mockResolvedValueOnce(Response.json({ products: [product(code(0)), product(code(1))] }));
      await expect(refreshCatalog(env)).rejects.toThrow('Catalog refresh failed');
      expect((await foods()).results.every(row => row.name === 'Old food' && row.updated_at === stale)).toBe(true);
      expect(await job()).toMatchObject({ last_status: 'failed', updated: 0, missing: 2 });
      expect((await env.DB.prepare('SELECT * FROM mutation_assertions').all()).results).toHaveLength(0);
    } finally { await env.DB.exec('DROP TRIGGER catalog_test_failure;'); }
  });

  it('handles empty English names and preserves unknown nutrition as null', async () => {
    await addFoods(1);
    fetchMock.mockResolvedValueOnce(Response.json({ products: [{ code: code(0), product_name_en: '', product_name: 'Localized food', brands: 'Brand A, Brand B', categories: 'Foods, Legumes', nutriments: { proteins_100g: 0, fat_100g: false, carbs_100g: '  ' } }] }));
    await refreshCatalog(env);
    const row = await env.DB.prepare('SELECT * FROM foods').first();
    expect(row).toMatchObject({ name: 'Localized food', brand: 'Brand A', category: 'Legumes', calories: null, protein_g: 0, fat_g: null, carbs_g: null, serving_size: null });
  });

  it('does not call upstream when no stale catalog rows are eligible', async () => {
    await refreshCatalog(env);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await job()).toMatchObject({ last_status: 'ok', requested: 0, updated: 0, missing: 0, lease_token: null });
  });
});
