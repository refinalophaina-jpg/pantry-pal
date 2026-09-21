import type { StorageZone } from './types';
/** Shopping guidance, not a shelf-life or food-safety guarantee. Opened packages follow their label. */
export function foodStorage(name: string): { category: string; zone: StorageZone } {
  const n = name.toLowerCase();
  if (/\bfrozen\b/.test(n)) return { category: 'Freezer · keep a buffer', zone: 'freezer' };
  if (/\b(dry|dried|canned|oil|sauce|vinegar|cumin|turmeric|spice|almond|almonds|oats|flour|sugar|salt)\b/.test(n)) return { category: 'Cupboard · check stock', zone: 'pantry' };
  if (/\b(tofu|spinach|cabbage|carrot|broccoli|tomato|tomatoes|pepper|peppers|basil|herb|herbs|milk|yogurt|egg|eggs|chicken|beef|fish|salmon|cooked|spring onion)\b/.test(n)) return { category: 'Fresh · this prep', zone: 'fridge' };
  return { category: 'Other · check storage', zone: 'pantry' };
}
