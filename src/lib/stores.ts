import { apiRequest, householdPath } from "./api-client";

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
  return (await apiRequest<{ data: Store[] }>(householdPath(householdId, "stores"))).data;
}

export async function addStore(householdId: string, _userId: string, name: string, zip?: string): Promise<Store> {
  return (await apiRequest<{ data: Store }>(householdPath(householdId, "stores"), { method: "POST", body: { name, zip: zip ?? null } })).data;
}

export async function removeStore(id: string, householdId: string): Promise<void> {
  await apiRequest(householdPath(householdId, "stores", id), { method: "DELETE" });
}

export async function listItemLocations(householdId: string, storeId: string): Promise<ItemLocation[]> {
  return (await apiRequest<{ data: ItemLocation[] }>(`${householdPath(householdId, "item-locations")}?${new URLSearchParams({ store_id: storeId })}`)).data;
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
  return (await apiRequest<{ data: ItemLocation }>(householdPath(p.householdId, "item-locations"), {
    method: "POST",
    body: { store_id: p.storeId, item_name: p.itemName, aisle: p.aisle ?? null, section: p.section ?? null, price: p.price ?? null },
  })).data;
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
