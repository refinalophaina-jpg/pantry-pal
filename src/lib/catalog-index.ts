import { apiRequest } from "./api-client";
import { catalogRecipeFromRow } from "./food-db";
import type { Recipe } from "./types";

/**
 * The shared recipe catalog (curated dishes, the TheMealDB mirror and cached
 * Spoonacular results) as one slim list the browser can search, filter and
 * match against the pantry instantly. Full recipes load by slug on open.
 * Public reference data only; never household records.
 */
export interface CatalogEntry {
  slug: string;
  name: string;
  cuisine: string;
  minutes: number;
  difficulty: Recipe["difficulty"];
  servings: number;
  imageUrl?: string;
  source: string;
  tags: string[];
  ingredients: string[];
}

const STORAGE_KEY = "pantry-pal-recipe-index-v1";
const TTL_MS = 60 * 60 * 1000;
let memory: { at: number; entries: CatalogEntry[] } | null = null;
let inFlight: Promise<CatalogEntry[]> | null = null;

export const catalogEntryId = (entry: Pick<CatalogEntry, "slug">) => `cat-${entry.slug}`;

function entryFromRow(row: Record<string, unknown>): CatalogEntry {
  return {
    slug: String(row.slug),
    name: String(row.name),
    cuisine: String(row.cuisine ?? "International"),
    minutes: Number(row.minutes ?? 30),
    difficulty: (row.difficulty as Recipe["difficulty"]) ?? "medium",
    servings: Number(row.servings ?? 2),
    imageUrl: row.imageUrl ? String(row.imageUrl) : undefined,
    source: String(row.source ?? "curated"),
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    ingredients: Array.isArray(row.ingredients) ? row.ingredients.map(String) : [],
  };
}

function readStorage(): { at: number; entries: CatalogEntry[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; entries?: unknown };
    if (typeof parsed.at !== "number" || !Array.isArray(parsed.entries)) return null;
    return { at: parsed.at, entries: parsed.entries.map(item => entryFromRow(item as Record<string, unknown>)) };
  } catch { return null; }
}

function writeStorage(value: { at: number; entries: CatalogEntry[] }) {
  try {
    const raw = JSON.stringify(value);
    if (raw.length < 4_000_000) localStorage.setItem(STORAGE_KEY, raw);
  } catch { /* Private browsing or a full quota: the in-memory copy still serves this visit. */ }
}

/** Whatever is already on this device, even when stale, so pages render before the refresh lands. */
export function readCachedIndex(): CatalogEntry[] | null {
  if (memory) return memory.entries;
  const stored = typeof localStorage === "undefined" ? null : readStorage();
  if (stored) memory = stored;
  return stored?.entries ?? null;
}

export function clearRecipeIndexCache() {
  memory = null;
  inFlight = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export async function loadRecipeIndex(options: { force?: boolean } = {}): Promise<CatalogEntry[]> {
  const cached = readCachedIndex();
  if (!options.force && cached && memory && Date.now() - memory.at < TTL_MS) return cached;
  if (inFlight) return inFlight;
  inFlight = apiRequest<{ data: Record<string, unknown>[] }>("/api/catalog/recipes/index", { timeoutMs: 30_000 })
    .then(({ data }) => {
      if (!Array.isArray(data)) throw new Error("Invalid recipe index.");
      const value = { at: Date.now(), entries: data.map(entryFromRow) };
      memory = value;
      writeStorage(value);
      return value.entries;
    })
    .finally(() => { inFlight = null; });
  return inFlight;
}

export async function fetchCatalogRecipe(slug: string): Promise<Recipe | null> {
  const { data } = await apiRequest<{ data: Record<string, unknown> | null }>(`/api/catalog/recipes?${new URLSearchParams({ slug })}`);
  return data ? catalogRecipeFromRow(data) : null;
}
