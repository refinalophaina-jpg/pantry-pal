import { assertion, clearAssertion } from './domain-repository';

function label(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

/** One bounded, idempotent batch per hourly tick. Failed rows remain eligible. */
export async function refreshCatalog(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const token = crypto.randomUUID();
  const lease = await env.DB.prepare("UPDATE catalog_jobs SET lease_until=?,lease_token=?,last_started_at=?,last_status='running',requested=0,updated=0,missing=0 WHERE name='openfoodfacts' AND lease_until<=? RETURNING name")
    .bind(now + 600, token, new Date().toISOString(), now).first();
  if (!lease) return;
  let requested = 0;
  try {
    const rows = await env.DB.prepare("SELECT barcode FROM foods WHERE source='openfoodfacts' AND barcode IS NOT NULL AND updated_at < strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days') ORDER BY updated_at,barcode LIMIT 100").all<{ barcode: string }>();
    requested = rows.results.length;
    const barcodes = new Set(rows.results.map(row => row.barcode));
    if ([...barcodes].some(code => !/^\d{4,32}$/.test(code))) throw new Error('catalog_barcode_invalid');
    const updates: D1PreparedStatement[] = [];
    if (requested) {
      const url = new URL('https://world.openfoodfacts.org/api/v2/search');
      url.searchParams.set('code', [...barcodes].join(','));
      url.searchParams.set('page_size', '100');
      url.searchParams.set('fields', 'code,product_name,product_name_en,brands,categories,serving_size,nutriments');
      const response = await fetch(url, { headers: { 'User-Agent': 'PantryPal/1.0 (https://pantry.ainadara.com)', Accept: 'application/json' }, signal: AbortSignal.timeout(25_000), redirect: 'error' });
      if (!response.ok) throw new Error('catalog_fetch_failed');
      const data = await response.json() as { products?: unknown[] } | null;
      if (!Array.isArray(data?.products) || data.products.length > 100) throw new Error('catalog_response_invalid');
      const seen = new Set<string>();
      for (const value of data.products) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
        const product = value as Record<string, unknown>;
        const code = String(product.code ?? '');
        const name = label(product.product_name_en, 250) ?? label(product.product_name, 250);
        if (!barcodes.has(code) || seen.has(code) || !name) continue;
        seen.add(code);
        const nutrients = product.nutriments && typeof product.nutriments === 'object' && !Array.isArray(product.nutriments) ? product.nutriments as Record<string, unknown> : {};
        const numeric = (key: string) => {
          const raw = nutrients[key];
          const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
          return Number.isFinite(value) && value >= 0 ? value : null;
        };
        const brand = label(product.brands, 2000)?.split(',')[0]?.trim().slice(0, 250) || null;
        const category = label(product.categories, 2000)?.split(',').at(-1)?.trim().slice(0, 500) || 'Other';
        updates.push(env.DB.prepare("UPDATE foods SET name=?,brand=?,category=?,serving_size=?,calories=?,protein_g=?,carbs_g=?,fat_g=?,fiber_g=?,updated_at=? WHERE barcode=? AND source='openfoodfacts'").bind(name, brand, category, label(product.serving_size, 100), numeric('energy-kcal_100g'), numeric('proteins_100g'), numeric('carbohydrates_100g'), numeric('fat_100g'), numeric('fiber_100g'), new Date().toISOString(), code));
      }
    }
    const updated = updates.length;
    const missing = requested - updated;
    const guardId = `catalog-${token}`;
    // All updates and job counters roll back if ownership changed while fetching.
    await env.DB.batch([
      assertion(env, guardId, "EXISTS(SELECT 1 FROM catalog_jobs WHERE name='openfoodfacts' AND lease_token=? AND lease_until>?)", [token, Math.floor(Date.now() / 1000)]),
      ...updates,
      env.DB.prepare("UPDATE catalog_jobs SET lease_until=0,lease_token=NULL,last_finished_at=?,last_status=?,requested=?,updated=?,missing=? WHERE name='openfoodfacts' AND lease_token=?").bind(new Date().toISOString(), missing ? 'partial' : 'ok', requested, updated, missing, token),
      clearAssertion(env, guardId),
    ]);
    console.log(JSON.stringify({ event: 'catalog_refresh', status: missing ? 'partial' : 'ok', requested, updated, missing }));
  } catch {
    const result = await env.DB.prepare("UPDATE catalog_jobs SET lease_until=0,lease_token=NULL,last_finished_at=?,last_status='failed',requested=?,updated=0,missing=? WHERE name='openfoodfacts' AND lease_token=?").bind(new Date().toISOString(), requested, requested, token).run();
    const status = result.meta.changes ? 'failed' : 'superseded';
    console.error(JSON.stringify({ event: 'catalog_refresh', status, requested }));
    throw new Error(`Catalog refresh ${status}; rows remain eligible for the next tick.`);
  }
}
