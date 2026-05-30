import { getSupabase } from "./supabase";

/**
 * Household-owned stores and their item layouts (aisle/shelf/price). This is
 * data the household records themselves — no scraped retailer data — so the
 * shopping list can be ordered by aisle for whichever store you're at.
 */

export interface Store {
  id: string;
  name: string;
  zip: string | null;
}

export interface ItemLocation {
  id: string;
  store_id: string;
  item_name: string;
  aisle: string | null;
  section: string | null;
  price: number | null;
}

export async function listStores(householdId: string): Promise<Store[]> {
  const { data, error } = await getSupabase()
    .from("stores")
    .select("id,name,zip")
    .eq("household_id", householdId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Store[];
}

export async function addStore(
  householdId: string,
  userId: string,
  name: string,
  zip?: string,
): Promise<Store> {
  const { data, error } = await getSupabase()
    .from("stores")
    .insert({ household_id: householdId, name, zip: zip ?? null, created_by: userId })
    .select("id,name,zip")
    .single();
  if (error || !data) throw error ?? new Error("Couldn't add the store.");
  return data as Store;
}

export async function removeStore(id: string): Promise<void> {
  const { error } = await getSupabase().from("stores").delete().eq("id", id);
  if (error) throw error;
}

export async function listItemLocations(
  householdId: string,
  storeId: string,
): Promise<ItemLocation[]> {
  const { data, error } = await getSupabase()
    .from("item_locations")
    .select("id,store_id,item_name,aisle,section,price")
    .eq("household_id", householdId)
    .eq("store_id", storeId);
  if (error) throw error;
  return (data ?? []) as ItemLocation[];
}

export async function upsertItemLocation(p: {
  householdId: string;
  userId: string;
  storeId: string;
  itemName: string;
  aisle?: string | null;
  section?: string | null;
  price?: number | null;
}): Promise<ItemLocation> {
  const { data, error } = await getSupabase()
    .from("item_locations")
    .upsert(
      {
        household_id: p.householdId,
        store_id: p.storeId,
        item_name: p.itemName,
        aisle: p.aisle ?? null,
        section: p.section ?? null,
        price: p.price ?? null,
        updated_by: p.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store_id,item_name" },
    )
    .select("id,store_id,item_name,aisle,section,price")
    .single();
  if (error || !data) throw error ?? new Error("Couldn't save the location.");
  return data as ItemLocation;
}

// Common stores the household can one-tap add.
export const SUGGESTED_STORES = [
  "Walmart",
  "H-E-B",
  "Whole Foods",
  "Central Market",
];

/** Find a store near a zip on Google Maps (no API key). */
export function storeFinderUrl(name: string, zip: string): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(
    `${name} grocery near ${zip}`,
  )}`;
}
