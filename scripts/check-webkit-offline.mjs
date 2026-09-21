#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { webkit } from '@playwright/test';

// No application API, database, account, cookie fixture, or external URL is used.
// A separate ephemeral server/browser context is created for each comparison.
const exportRoot = fileURLToPath(new URL('../out/', import.meta.url)).replace(/\/$/, '');
const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain',
};

async function startServer() {
  const server = createServer(async (request, response) => {
    // Disable the HTTP cache so a server-outage pass requires the Cache API.
    response.setHeader('Cache-Control', 'no-store');
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname.startsWith('/api/') || pathname.split('/').some(part => part.startsWith('.'))) {
        response.writeHead(404); response.end(); return;
      }
      const local = pathname === '/offline/' || pathname === '/offline'
        ? '/offline.html' : pathname.endsWith('/') ? `${pathname}index.html` : pathname;
      const file = resolve(exportRoot, `.${local}`);
      if (!file.startsWith(exportRoot + sep) || !mime[extname(file)]) {
        response.writeHead(404); response.end(); return;
      }
      const body = await readFile(file);
      response.setHeader('Content-Type', mime[extname(file)]);
      if (local === '/sw.js') response.setHeader('Service-Worker-Allowed', '/');
      response.writeHead(200); response.end(body);
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  let stopped = false;
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    async stop() {
      if (stopped) return;
      stopped = true;
      const closed = new Promise((accept, reject) => server.close(error => error ? reject(error) : accept()));
      server.closeAllConnections();
      await closed;
    },
  };
}

async function waitForCache(page) {
  // Do not pass an async predicate to waitForFunction: a truthy Promise is not
  // evidence that the precache response is ready. Await each evaluation here.
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const ready = await page.evaluate(async () => {
      if (!navigator.serviceWorker.controller) return false;
      return Boolean(await caches.match(new URL('/offline-shopping/', location.href).href));
    });
    if (ready) return;
    await delay(100);
  }
  throw new Error('WebKit did not finish caching the offline-shopping shell within 20 seconds.');
}

const builtWorker = await readFile(resolve(exportRoot, 'sw.js'), 'utf8');
assert(!builtWorker.includes('__BUILD_VERSION__'), 'Run npm run build before the offline check.');
const browser = await webkit.launch();
try {
  for (const mode of ['server-stopped', 'emulated']) {
    const fixture = await startServer();
    let context;
    try {
      context = await browser.newContext({ serviceWorkers: 'allow' });
      const page = await context.newPage();
      const url = `${fixture.origin}/offline-shopping/`;
      await page.goto(url);
      await waitForCache(page);
      await page.evaluate(() => { window.__pantryOnlineProbe = true; });
      if (mode === 'server-stopped') await fixture.stop();
      else await context.setOffline(true);

      let failure = null;
      let response;
      try { response = await page.goto(url, { timeout: 15_000 }); }
      catch (error) { failure = error.message.split('\n')[0]; }
      const heading = await page.locator('h1').textContent().catch(() => null);
      const freshDocument = !failure && await page.evaluate(() => window.__pantryOnlineProbe === undefined);
      const fromServiceWorker = response?.fromServiceWorker() ?? false;
      const result = { browser: browser.version(), mode, cached: true, loaded: !failure, freshDocument, fromServiceWorker, heading, failure };
      console.log(JSON.stringify(result));
      if (mode === 'server-stopped') {
        assert.equal(failure, null, 'Navigation must succeed after the HTTP server is stopped.');
        assert.equal(freshDocument, true, 'The result must be a new offline document, not the old visible page.');
        assert.equal(fromServiceWorker, true, 'The offline navigation must be served by the service worker.');
        assert.equal(heading, 'Saved shopping list');
      }
      // Emulated-offline failure is diagnostic only. WebKit's network emulation
      // can abort navigation before the service worker returns its cached page.
    } finally {
      try { await context?.close(); }
      finally { await fixture.stop(); }
    }
  }
} finally { await browser.close(); }
