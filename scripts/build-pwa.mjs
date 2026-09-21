import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : path.join(dir, entry.name)))).flat();
}
const all = (await files('out')).sort();
const staticFiles = all.filter(file => !file.endsWith('.map') && !file.endsWith('/sw.js') && !file.endsWith('/_headers'));
const allowedExtensions = new Set(['.html', '.txt', '.js', '.css', '.json', '.webmanifest', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.ico', '.woff', '.woff2', '.ttf']);
const exportedPaths = new Set(staticFiles.map(file => '/' + path.relative('out', file).split(path.sep).join('/')));
for (const url of exportedPaths) {
  if (url === '/api' || url.startsWith('/api/') || url.split('/').some(part => part.startsWith('.')) || /[?#\\\s]/.test(url) || !allowedExtensions.has(path.extname(url))) {
    throw new Error(`Unexpected export in public precache: ${url}`);
  }
}
function manifestPath(value, field) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[?#\\\s]/.test(value) || value.split('/').includes('..')) throw new Error(`Manifest ${field} must be a same-origin path.`);
  return value;
}
const appManifest = JSON.parse(await readFile('out/manifest.webmanifest', 'utf8'));
if (!appManifest || typeof appManifest.name !== 'string' || !appManifest.name.trim() || !['standalone', 'minimal-ui', 'fullscreen'].includes(appManifest.display)) throw new Error('Manifest needs a name and an installable display mode.');
for (const field of ['id', 'scope', 'start_url']) if (manifestPath(appManifest[field], field) !== '/') throw new Error(`Manifest ${field} must remain / for this application.`);
if (!Array.isArray(appManifest.icons)) throw new Error('Manifest icons are missing.');
for (const size of [192, 512]) {
  const icon = appManifest.icons.find(icon => icon?.sizes === `${size}x${size}` && icon.type === 'image/png');
  if (!icon) throw new Error(`Manifest needs a ${size}x${size} PNG icon.`);
  const iconPath = manifestPath(icon.src, 'icon src');
  if (!exportedPaths.has(iconPath)) throw new Error(`Manifest icon is missing from the export: ${iconPath}`);
  const png = await readFile(path.join('out', iconPath));
  if (png.length < 24 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size) throw new Error(`Manifest icon dimensions do not match: ${iconPath}`);
}
const manifest = [];
const hash = createHash('sha256');
const source = await readFile('public/sw.js', 'utf8');
if (!source.includes('__BUILD_VERSION__') || !source.includes('/*__PRECACHE__*/ ["/offline/"]')) throw new Error('Service worker build markers are missing.');
hash.update(source).update(await readFile(new URL(import.meta.url)));
const rules = [
  '/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n  Strict-Transport-Security: max-age=31536000\n  Permissions-Policy: camera=(self), microphone=(), geolocation=()',
  '/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable',
  '/manifest.webmanifest\n  Cache-Control: no-cache',
  '/*.txt\n  Cache-Control: no-cache',
  '/sw.js\n  Cache-Control: no-cache, no-store, must-revalidate\n  Service-Worker-Allowed: /',
];
for (const file of staticFiles) {
  const content = await readFile(file);
  hash.update(file).update(content);
  const url = '/' + path.relative('out', file).split(path.sep).join('/');
  const canonical = url === '/offline.html' ? '/offline/' : url.replace(/\/index\.html$/, '/');
  // These are public static shells, never authenticated API responses.
  manifest.push(canonical);
  if (file.endsWith('.html')) {
    const hashes = [...new Set([...content.toString().matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].filter(match => match[1]).map(match => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`))];
    const policy = `default-src 'self'; script-src 'self' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://www.themealdb.com https://img.spoonacular.com https://images.openfoodfacts.org; font-src 'self'; connect-src 'self' https://world.openfoodfacts.org https://www.themealdb.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; worker-src 'self' blob:; manifest-src 'self'`;
    if (policy.length > 1900) throw new Error(`CSP exceeds static host line budget for ${canonical}`);
    rules.push(`${canonical}\n  Cache-Control: no-cache\n  Content-Security-Policy: ${policy}`);
    if (canonical !== url) rules.push(`${url}\n  Cache-Control: no-cache\n  Content-Security-Policy: ${policy}`);
  }
}
const version = hash.digest('hex').slice(0, 16);
await writeFile('out/sw.js', source.replace('__BUILD_VERSION__', version).replace('/*__PRECACHE__*/ ["/offline/"]', JSON.stringify(manifest)));
await writeFile('out/_headers', rules.join('\n\n') + '\n');
console.log(`PWA ${version}: ${manifest.length} static assets, page-specific CSP hashes.`);
