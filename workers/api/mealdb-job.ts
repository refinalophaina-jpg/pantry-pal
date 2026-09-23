import { mealToRecipe, type MealDBFull } from '../../src/lib/mealdb-parse';
import { assertion, clearAssertion } from './domain-repository';

/**
 * Weekly mirror of TheMealDB into recipe_catalog so Explore browses instantly
 * from D1 with photos instead of calling the API per meal from the browser.
 * search.php?f=<letter> returns every meal for that letter with full details:
 * 26 requests cover the whole database. Runs under the catalog_jobs lease.
 */
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const WEEK_SECONDS = 7 * 86400;
const BATCH = 40;

function iso(seconds: number) { return new Date(seconds * 1000).toISOString(); }

async function fetchLetter(letter: string): Promise<MealDBFull[]> {
  const url = new URL('https://www.themealdb.com/api/json/v1/1/search.php');
  url.searchParams.set('f', letter);
  const response = await fetch(url, { headers: { 'User-Agent': 'PantryPal/1.0 (https://pantry.ainadara.com)', Accept: 'application/json' }, signal: AbortSignal.timeout(12_000), redirect: 'error' });
  if (!response.ok) throw new Error('mealdb_fetch_failed');
  const data = await response.json() as { meals?: unknown } | null;
  if (data?.meals === null || data?.meals === undefined) return [];
  if (!Array.isArray(data.meals) || data.meals.length > 400) throw new Error('mealdb_response_invalid');
  return data.meals.filter((meal): meal is MealDBFull => Boolean(meal) && typeof meal === 'object' && typeof (meal as MealDBFull).idMeal === 'string' && /^\d{1,12}$/.test((meal as MealDBFull).idMeal) && typeof (meal as MealDBFull).strMeal === 'string');
}

/** Bounded concurrency without extra dependencies. */
async function mapPool<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      try { results[index] = { status: 'fulfilled', value: await task(items[index]) }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  }));
  return results;
}

export function upsertRecipeStatement(env: Env, row: { slug: string; name: string; description: string; cuisine: string; minutes: number; difficulty: string; servings: number; equipment: string[]; ingredients: unknown[]; steps: string[]; tags: string[]; imageUrl?: string; area?: string; source: string; sourceId: string; sourceUrl?: string }) {
  return env.DB.prepare(`INSERT INTO recipe_catalog(id,slug,name,description,cuisine,minutes,difficulty,servings,equipment,ingredients,steps,tags,image_url,area,source,source_id)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(slug) DO UPDATE SET name=excluded.name,description=excluded.description,cuisine=excluded.cuisine,minutes=excluded.minutes,difficulty=excluded.difficulty,servings=excluded.servings,equipment=excluded.equipment,ingredients=excluded.ingredients,steps=excluded.steps,tags=excluded.tags,image_url=excluded.image_url,area=excluded.area,source=excluded.source,source_id=excluded.source_id,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`)
    .bind(row.slug, row.slug, row.name.slice(0, 200), row.description.slice(0, 2000), row.cuisine.slice(0, 100), Math.max(0, Math.min(1440, Math.round(row.minutes))), row.difficulty, Math.max(1, Math.min(100, Math.round(row.servings))), JSON.stringify(row.equipment.slice(0, 20)), JSON.stringify(row.ingredients.slice(0, 50)), JSON.stringify(row.steps.slice(0, 60).map(step => String(step).slice(0, 2000))), JSON.stringify(row.tags.slice(0, 12).map(tag => String(tag).slice(0, 40))), row.imageUrl?.slice(0, 2048) ?? null, row.area?.slice(0, 100) ?? null, row.source, row.sourceId);
}

export async function refreshMealDb(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const token = crypto.randomUUID();
  // Due weekly; a failed or partial run is retried on the next tick.
  const lease = await env.DB.prepare(`UPDATE catalog_jobs SET lease_until=?,lease_token=?,last_started_at=?,last_status='running',requested=0,updated=0,missing=0
    WHERE name='themealdb' AND lease_until<=? AND (last_finished_at IS NULL OR last_status<>'ok' OR last_finished_at<?) RETURNING name`)
    .bind(now + 600, token, iso(now), now, iso(now - WEEK_SECONDS)).first();
  if (!lease) return;
  let requested = 0;
  try {
    const results = await mapPool(LETTERS, 4, fetchLetter);
    const failedLetters = results.filter(result => result.status === 'rejected').length;
    // Nothing loaded means the source or the network is down, not a partial mirror.
    if (failedLetters === LETTERS.length) throw new Error('mealdb_unavailable');
    const statements: D1PreparedStatement[] = [];
    const seen = new Set<string>();
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const meal of result.value) {
        requested++;
        if (seen.has(meal.idMeal)) continue;
        const recipe = mealToRecipe(meal);
        if (!recipe.ingredients.length || !recipe.steps.length) continue;
        seen.add(meal.idMeal);
        statements.push(upsertRecipeStatement(env, {
          slug: `mealdb-${meal.idMeal}`, name: recipe.name, description: recipe.description, cuisine: recipe.cuisine, minutes: recipe.minutes,
          difficulty: recipe.difficulty, servings: recipe.servings, equipment: recipe.equipment, ingredients: recipe.ingredients, steps: recipe.steps,
          tags: recipe.tags, imageUrl: recipe.imageUrl, area: recipe.area, source: 'themealdb', sourceId: meal.idMeal, sourceUrl: recipe.source,
        }));
      }
    }
    const guardId = `mealdb-${token}`;
    // Every batch checks the lease still belongs to this run before writing.
    for (let start = 0; start < statements.length; start += BATCH) {
      await env.DB.batch([
        assertion(env, guardId, "EXISTS(SELECT 1 FROM catalog_jobs WHERE name='themealdb' AND lease_token=? AND lease_until>?)", [token, Math.floor(Date.now() / 1000)]),
        ...statements.slice(start, start + BATCH),
        clearAssertion(env, guardId),
      ]);
    }
    const status = failedLetters ? 'partial' : 'ok';
    await env.DB.prepare("UPDATE catalog_jobs SET lease_until=0,lease_token=NULL,last_finished_at=?,last_status=?,requested=?,updated=?,missing=? WHERE name='themealdb' AND lease_token=?")
      .bind(new Date().toISOString(), status, requested, statements.length, failedLetters, token).run();
    console.log(JSON.stringify({ event: 'mealdb_refresh', status, requested, updated: statements.length, missing: failedLetters }));
  } catch {
    const result = await env.DB.prepare("UPDATE catalog_jobs SET lease_until=0,lease_token=NULL,last_finished_at=?,last_status='failed',requested=?,updated=0,missing=0 WHERE name='themealdb' AND lease_token=?").bind(new Date().toISOString(), requested, token).run();
    const status = result.meta.changes ? 'failed' : 'superseded';
    console.error(JSON.stringify({ event: 'mealdb_refresh', status, requested }));
    throw new Error(`TheMealDB mirror ${status}; it retries on the next tick.`);
  }
}
