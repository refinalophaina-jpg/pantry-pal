export type StorageZone = "pantry" | "fridge" | "freezer";

export type UnitType =
  | "pcs"
  | "g"
  | "kg"
  | "ml"
  | "l"
  | "tbsp"
  | "tsp"
  | "cup";

export interface PantryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: UnitType;
  zone: StorageZone;
  expiresOn?: string;
  addedOn: string;
  notes?: string;
}

export interface UsageEvent {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: UnitType;
  reason: "used" | "wasted";
  at: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  cuisine: string;
  minutes: number;
  difficulty: "easy" | "medium" | "hard";
  servings: number;
  equipment: string[];
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: UnitType;
    optional?: boolean;
  }>;
  steps: string[];
  tags: string[];
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: UnitType;
  category: string;
  done: boolean;
  fromRecipe?: string;
  dealPrice?: number;
  dealStore?: string;
}

export interface MealPlanEntry {
  id: string;
  date: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
  recipeId: string;
}

export interface StoreDeal {
  id: string;
  store: string;
  item: string;
  price: number;
  unit: string;
  validUntil: string;
}

export interface Equipment {
  id: string;
  name: string;
}
