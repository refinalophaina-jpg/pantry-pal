import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { handleData } from './data';
import { IMAGE_CAP_PER_HOUSEHOLD } from './domain-images';

let mf: Miniflare;
let env: Env;
let hid: string;
const actors = { alice: { id: 'img-alice' }, bob: { id: 'img-bob' } };
const png = Buffer.from('\x89PNG\r\n\x1a\n' + 'x'.repeat(64), 'binary');
async function call(path: string, method = 'GET', body?: unknown, actor = actors.alice) {
  const request = new Request(`https://test.local${path}`, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const response = await handleData(request, env, actor);
  if (!response) throw new Error(`Unhandled route ${path}`);
  return response;
}
const jsonOf = async (response: Response) => response.json() as Promise<Record<string, any>>;
const root = () => `/api/households/${hid}`;

beforeAll(async () => {
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-09-21', d1Databases: ['DB'] }));
  env = await mf.getBindings<Env>();
  for (const file of ['migrations/auth/0001_better_auth.sql', 'migrations/d1/0001_domain.sql', 'migrations/d1/0008_household_images.sql']) {
    await env.DB.exec(readFileSync(file, 'utf8').replace(/^--.*$/gm, '').replace(/\n/g, ' '));
  }
  for (const actor of Object.values(actors)) await env.DB.prepare('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,?,?)').bind(actor.id, actor.id, `${actor.id}@example.test`, Date.now(), Date.now()).run();
});
afterAll(async () => { await mf?.dispose(); });
beforeEach(async () => { hid = (await jsonOf(await call('/api/households', 'POST', { name: 'Photo kitchen' }))).data.id; });

describe('household recipe photos', () => {
  it('stores a signed image, serves it privately to members only, and deletes it', async () => {
    const created = await call(`${root()}/images`, 'POST', { imageBase64: png.toString('base64'), mediaType: 'image/png' });
    expect(created.status).toBe(201);
    const { data } = await jsonOf(created);
    expect(data.url).toBe(`${root()}/images/${data.id}`);
    const fetched = await call(data.url);
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get('Content-Type')).toBe('image/png');
    expect(fetched.headers.get('Cache-Control')).toContain('private');
    expect(fetched.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(Buffer.from(await fetched.arrayBuffer()).equals(png)).toBe(true);
    expect((await call(data.url, 'GET', undefined, actors.bob)).status).toBe(403);
    expect((await call(data.url, 'DELETE', undefined, actors.bob)).status).toBe(403);
    expect((await call(data.url, 'DELETE')).status).toBe(200);
    expect((await call(data.url)).status).toBe(404);
  });

  it('accepts a saved recipe that points at a household photo and still rejects other relative paths', async () => {
    const { data } = await jsonOf(await call(`${root()}/images`, 'POST', { imageBase64: png.toString('base64'), mediaType: 'image/png' }));
    const saved = await call(`${root()}/saved-recipes`, 'POST', { name: 'Photo dish', image_url: data.url });
    expect(saved.status).toBe(201);
    expect((await jsonOf(saved)).data.image_url).toBe(data.url);
    expect((await call(`${root()}/saved-recipes`, 'POST', { name: 'Bad dish', image_url: '/sw.js' })).status).toBe(400);
    expect((await call(`${root()}/saved-recipes`, 'POST', { name: 'Bad dish', image_url: 'javascript:alert(1)' })).status).toBe(400);
  });

  it('rejects mismatched signatures, unknown fields and oversized uploads', async () => {
    expect((await call(`${root()}/images`, 'POST', { imageBase64: Buffer.from('<svg/>').toString('base64'), mediaType: 'image/png' })).status).toBe(400);
    expect((await call(`${root()}/images`, 'POST', { imageBase64: png.toString('base64'), mediaType: 'image/png', purpose: 'generated' })).status).toBe(400);
    const big = Buffer.concat([Buffer.from('\xff\xd8\xff', 'binary'), Buffer.alloc(900_001)]);
    expect((await call(`${root()}/images`, 'POST', { imageBase64: big.toString('base64'), mediaType: 'image/jpeg' })).status).toBe(413);
    expect((await call(`${root()}/images`, 'PATCH', { imageBase64: png.toString('base64'), mediaType: 'image/png' })).status).toBe(405);
  });

  it('caps the number of photos per household', async () => {
    await env.DB.batch(Array.from({ length: IMAGE_CAP_PER_HOUSEHOLD }, (_, index) => env.DB.prepare("INSERT INTO household_images(id,household_id,created_by,media_type,size,bytes) VALUES(?,?,?,'image/png',8,?)").bind(`filler-${hid}-${index}`, hid, actors.alice.id, png.buffer.slice(0, 8))));
    const response = await call(`${root()}/images`, 'POST', { imageBase64: png.toString('base64'), mediaType: 'image/png' });
    expect(response.status).toBe(409);
    expect((await jsonOf(response)).error.code).toBe('image_limit');
  });
});
