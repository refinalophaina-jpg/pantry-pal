import { text, number, nullable, oneOf, unit, bool, date, url, id, stringArray, ingredients, type Validator, type SqlValue } from './domain-validation';
export interface Collection {
  table: string; fields: Record<string, Validator>; defaults: Record<string, SqlValue>;
  required: string[]; order: string; readOnly?: boolean;
}
const quantity = number(0.000001,1e6);
export const collections: Record<string, Collection> = {
  pantry: { table:'pantry_items', fields:{name:text(),category:text(100),quantity:number(),unit,zone:oneOf(['pantry','fridge','freezer']),expires_on:nullable(date),notes:nullable(text(4000,true))}, defaults:{category:'Other',quantity:1,unit:'pcs',zone:'pantry'}, required:['name'], order:'expires_on IS NULL, expires_on, id' },
  shopping: { table:'shopping_items', fields:{name:text(),category:text(100),quantity,unit,done:bool,from_recipe:nullable(text()),deal_price:nullable(number()),deal_store:nullable(text())}, defaults:{category:'Other',quantity:1,unit:'pcs',done:0},required:['name'],order:'created_at, id' },
  'meal-plan': { table:'meal_plan', fields:{date,meal:oneOf(['breakfast','lunch','dinner','snack']),recipe_id:text(200),recipe_name:nullable(text())}, defaults:{},required:['date','meal','recipe_id'],order:'date, meal, id' },
  usage: { table:'usage_events', fields:{},defaults:{},required:[],order:'at DESC, id',readOnly:true },
  'saved-recipes': { table:'saved_recipes',fields:{name:text(),description:nullable(text(12000,true)),cuisine:nullable(text(100)),minutes:nullable(number(0,10080,true)),difficulty:nullable(oneOf(['easy','medium','hard'])),servings:nullable(number(1,1000,true)),equipment:stringArray(),ingredients,steps:stringArray(100,8000),tags:stringArray(),external_id:nullable(text(200)),image_url:nullable(url),area:nullable(text()),source:nullable(text(2048)),video:nullable(url),calories:nullable(number()),protein_g:nullable(number()),carbs_g:nullable(number()),fat_g:nullable(number())},defaults:{equipment:'[]',ingredients:'[]',steps:'[]',tags:'[]'},required:['name'],order:'created_at DESC, id' },
  stores: {table:'stores',fields:{name:text(),zip:nullable(text(32))},defaults:{},required:['name'],order:'name, id'},
  'item-locations': {table:'item_locations',fields:{store_id:id,item_name:text(),aisle:nullable(text(120,true)),section:nullable(text(120,true)),price:nullable(number())},defaults:{},required:['store_id','item_name'],order:'item_name, id'},
};
