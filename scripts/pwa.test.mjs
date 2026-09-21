import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'public/sw.js'), 'utf8');
const run = promisify(execFile);
async function fixture(action) {
  const dir = await mkdtemp(path.join(tmpdir(), 'pantry-pwa-'));
  try {
    await mkdir(path.join(dir, 'out/icons'), { recursive: true });
    await mkdir(path.join(dir, 'out/_next/static'), { recursive: true });
    await mkdir(path.join(dir, 'out/offline-shopping'), { recursive: true });
    await mkdir(path.join(dir, 'public'));
    await writeFile(path.join(dir, 'public/sw.js'), source);
    await writeFile(path.join(dir, 'out/index.html'), '<html><script>self.fixture=true;</script></html>');
    await writeFile(path.join(dir, 'out/offline.html'), '<html>Offline</html>');
    await writeFile(path.join(dir, 'out/offline-shopping/index.html'), '<html>Saved shopping list</html>');
    await writeFile(path.join(dir, 'out/_next/static/test.js'), 'console.log("public chunk")');
    for (const size of [192, 512]) {
      const png = Buffer.alloc(24);
      Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
      png.writeUInt32BE(size, 16); png.writeUInt32BE(size, 20);
      await writeFile(path.join(dir, `out/icons/icon-${size}.png`), png);
    }
    const manifest = { name: 'Pantry Pal', id: '/', scope: '/', start_url: '/', display: 'standalone', icons: [192, 512].map(size => ({ src: `/icons/icon-${size}.png`, type: 'image/png', sizes: `${size}x${size}` })) };
    await writeFile(path.join(dir, 'out/manifest.webmanifest'), JSON.stringify(manifest));
    const build = () => run(process.execPath, [path.join(root, 'scripts/build-pwa.mjs')], { cwd: dir, timeout: 10_000 });
    await action({ dir, manifest, build });
  } finally { await rm(dir, { recursive: true, force: true }); }
}

function worker({ failInstall = false, networkFails = false } = {}) {
  const origin = 'https://pantry.test';
  const handlers = new Map();
  const entries = new Map([['/offline/', new Response('offline fallback')], ['/offline-shopping/', new Response('shopping shell')], ['/_next/static/test.js', new Response('static chunk')]]);
  const state = { installed: [], deleted: [], skipWaiting: 0, claim: 0, network: [] };
  const cache = { addAll: async requests => { state.installed = requests; if (failInstall) throw new Error('missing asset'); }, match: async url => entries.get(url) };
  class WorkerRequest extends Request { constructor(input, init) { super(typeof input === 'string' ? new URL(input, origin) : input, init); } }
  runInNewContext(source.replace('__BUILD_VERSION__', 'new').replace('/*__PRECACHE__*/ ["/offline/"]', JSON.stringify([...entries.keys()])), {
    self: { location: { origin }, addEventListener: (type, handler) => handlers.set(type, handler), clients: { claim: async () => state.claim++ }, skipWaiting: () => state.skipWaiting++ },
    caches: { open: async () => cache, keys: async () => ['pantry-pal-static-old', 'pantry-pal-static-new', 'another-app-cache'], delete: async name => { state.deleted.push(name); return true; } },
    Request: WorkerRequest, Response, URL,
    fetch: async request => { state.network.push(request); if (networkFails) throw new Error('offline'); return new Response('network'); },
  });
  return {
    state,
    event: async type => { let task; handlers.get(type)({ waitUntil: promise => { task = promise; } }); await task; },
    message: data => handlers.get('message')({ data }),
    fetch: async ({ pathname, origin: host = origin, method = 'GET', mode = 'cors' }) => {
      let response;
      handlers.get('fetch')({ request: { url: host + pathname, method, mode }, respondWith: value => { response = value; } });
      return response ? await response : undefined;
    },
  };
}

test('precache is built only from public files, with deterministic CSP and no build markers', async () => fixture(async ({ dir, build }) => {
  await build();
  const sw = await readFile(path.join(dir, 'out/sw.js'), 'utf8');
  assert.ok(!sw.includes('__BUILD_VERSION__') && !sw.includes('/*__PRECACHE__*/'));
  assert.ok(sw.includes('/_next/static/test.js'));
  assert.ok(sw.includes('/offline-shopping/'));
  const headers = await readFile(path.join(dir, 'out/_headers'), 'utf8');
  const digest = createHash('sha256').update('self.fixture=true;').digest('base64');
  assert.ok(headers.includes(`'sha256-${digest}'`));
  assert.ok(headers.includes('Referrer-Policy: no-referrer'));
  const globalRule = headers.split('\n\n').find(rule => rule.startsWith('/*\n'));
  assert.ok(!globalRule.includes('Cache-Control:'));
  assert.ok(headers.includes('/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable'));
  await build();
  assert.equal(await readFile(path.join(dir, 'out/sw.js'), 'utf8'), sw);
  await writeFile(path.join(dir, 'public/sw.js'), source + '\n// security policy revision\n');
  await build();
  assert.notEqual((await readFile(path.join(dir, 'out/sw.js'), 'utf8')).match(/const VERSION = "([^"]+)"/)[1], sw.match(/const VERSION = "([^"]+)"/)[1]);
}));

test('build rejects API exports, unknown file types, malformed manifests and missing icons', async () => {
  for (const kind of ['api', 'private-artifact', 'bad-json', 'external-icon', 'missing-icon']) await fixture(async ({ dir, manifest, build }) => {
    if (kind === 'api') { await mkdir(path.join(dir, 'out/api')); await writeFile(path.join(dir, 'out/api/session.json'), '{}'); }
    if (kind === 'private-artifact') await writeFile(path.join(dir, 'out/database.sqlite'), 'private');
    if (kind === 'bad-json') await writeFile(path.join(dir, 'out/manifest.webmanifest'), '{');
    if (kind === 'external-icon') { manifest.icons[0].src = 'https://third-party.test/icon.png'; await writeFile(path.join(dir, 'out/manifest.webmanifest'), JSON.stringify(manifest)); }
    if (kind === 'missing-icon') await rm(path.join(dir, 'out/icons/icon-192.png'));
    await assert.rejects(build);
  });
});

test('install omits cookies, refuses redirects and waits for explicit update approval', async () => {
  const app = worker();
  await app.event('install');
  assert.equal(app.state.skipWaiting, 0);
  assert.ok(app.state.installed.length > 0);
  for (const request of app.state.installed) { assert.equal(request.credentials, 'omit'); assert.equal(request.redirect, 'error'); }
  app.message({ type: 'unrelated' }); assert.equal(app.state.skipWaiting, 0);
  app.message({ type: 'APPLY_UPDATE' }); assert.equal(app.state.skipWaiting, 1);
});

test('failed installation leaves existing caches intact; activation removes only older own caches', async () => {
  const failed = worker({ failInstall: true });
  await assert.rejects(failed.event('install'));
  assert.deepEqual(failed.state.deleted, []);
  const app = worker();
  await app.event('activate');
  assert.deepEqual(app.state.deleted, ['pantry-pal-static-old']);
  assert.equal(app.state.claim, 1);
});

test('never intercepts API/auth, writes, third parties, or unknown dynamic assets', async () => {
  const app = worker();
  for (const request of [{ pathname: '/api/auth/get-session' }, { pathname: '/api/households/h/snapshot' }, { pathname: '/api/pantry/recognize', method: 'POST' }, { pathname: '/_next/static/test.js', method: 'POST' }, { pathname: '/_next/static/test.js', origin: 'https://third-party.test' }, { pathname: '/private-response.json' }]) assert.equal(await app.fetch(request), undefined);
  assert.deepEqual(app.state.network, []);
});

test('offline navigation shows a public fallback or saved-list shell, without caching responses', async () => {
  const app = worker({ networkFails: true });
  assert.equal(await (await app.fetch({ pathname: '/shopping/', mode: 'navigate' })).text(), 'offline fallback');
  assert.equal(await (await app.fetch({ pathname: '/offline-shopping/', mode: 'navigate' })).text(), 'shopping shell');
  assert.equal(await (await app.fetch({ pathname: '/_next/static/test.js' })).text(), 'static chunk');
  assert.deepEqual(app.state.installed, []);
});
