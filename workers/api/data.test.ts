import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { handleData } from './data';
let mf:Miniflare;
let env:Env;
let hid:string;
const actors={alice:{id:'test-alice'},bob:{id:'test-bob'},eve:{id:'test-eve'}};
async function call(path:string,method='GET',body?:unknown,actor=actors.alice) {
  const request=new Request(`https://test.local${path}`,{method,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const response=await handleData(request,env,actor);
  if(!response) throw new Error(`Unhandled route ${path}`);
  return {status:response.status,body:await response.json() as Record<string, any>};
}
const root=()=>`/api/households/${hid}`;
async function pantry(name='Rice',quantity=2,unit='kg') {return (await call(`${root()}/pantry`,'POST',{name,quantity,unit})).body.data;}
async function shopping(name='Milk') {return (await call(`${root()}/shopping`,'POST',{name,quantity:1,unit:'l'})).body.data;}
async function snap() {return (await call(`${root()}/snapshot`)).body;}
const op=(body:Record<string,unknown>)=>call(`${root()}/operations`,'POST',{operationId:crypto.randomUUID(),...body});
beforeAll(async()=>{
  mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-09-21',d1Databases:['DB']}));
  env=await mf.getBindings<Env>();
  for(const file of ['migrations/auth/0001_better_auth.sql','migrations/d1/0001_domain.sql','migrations/d1/0002_reference_seed.sql']) {
    await env.DB.exec(readFileSync(file,'utf8').replace(/^--.*$/gm,'').replace(/\n/g,' '));
  }
  for(const actor of Object.values(actors)) await env.DB.prepare('INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES(?,?,?,1,?,?)').bind(actor.id,actor.id,`${actor.id}@example.test`,Date.now(),Date.now()).run();
});
afterAll(async()=>{await mf?.dispose()});
beforeEach(async()=>{hid=(await call('/api/households','POST',{name:`Kitchen ${crypto.randomUUID()}`})).body.data.id});

describe('D1 household API (real local workerd binding)',()=>{
  it('loads repeatable public seeds with preserved arrays, guide newlines and nutrition',async()=>{
    const seed=readFileSync('migrations/d1/0002_reference_seed.sql','utf8').replace(/^--.*$/gm,'').replace(/\n/g,' ');
    await env.DB.exec(seed);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM ingredients').first<number>('n')).toBe(74);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM techniques').first<number>('n')).toBe(15);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM recipe_catalog').first<number>('n')).toBe(6);
    const rice=(await call('/api/catalog/ingredients?name=Rice')).body.data;
    expect(rice.calories).toBe(130);expect(rice.aliases).toEqual(['white rice']);
    const guides=(await call('/api/catalog/techniques?limit=100')).body.data;
    expect(guides.find((x:{slug:string})=>x.slug==='blanching').body.split('\n')).toHaveLength(4);
    const recipes=(await call('/api/catalog/recipes?q=garlic%20butter')).body.data;
    expect(recipes[0].steps).toHaveLength(4);expect(recipes[0].ingredients[0].quantity).toBe(1.5);
    expect((await env.DB.prepare('PRAGMA foreign_key_check').all()).results).toHaveLength(0);
  });
  it('creates owner membership atomically and protects every household collection',async()=>{
    const households=await call('/api/households');
    expect(households.body.data.find((h:{id:string})=>h.id===hid).role).toBe('owner');
    for(const resource of ['snapshot','pantry','shopping','meal-plan','usage','saved-recipes','stores','item-locations']) {
      expect((await call(`${root()}/${resource}`,'GET',undefined,actors.bob)).status).toBe(403);
    }
    expect((await call(`${root()}/pantry`,'POST',{name:'Stolen'},actors.bob)).status).toBe(403);
    expect((await call(`${root()}/operations`,'POST',{operationId:crypto.randomUUID(),type:'clear-completed'},actors.bob)).status).toBe(403);
  });
  it('rejects forged fields, invalid dates/quantities and cross-household object mutations',async()=>{
    expect((await call(`${root()}/pantry`,'POST',{name:'Rice',created_by:actors.bob.id})).status).toBe(400);
    expect((await call(`${root()}/pantry`,'POST',{name:'Rice',quantity:-1})).status).toBe(400);
    expect((await call(`${root()}/pantry`,'POST',{name:'Rice',expires_on:'2026-02-31'})).status).toBe(400);
    const item=await pantry();
    const other=(await call('/api/households','POST',{name:'Second'})).body.data.id;
    expect((await call(`/api/households/${other}/pantry/${item.id}`,'PATCH',{quantity:1})).status).toBe(404);
    expect((await call(`/api/households/${other}/pantry/${item.id}`,'DELETE')).status).toBe(404);
    expect((await snap()).pantry_items[0].quantity).toBe(2);
    expect(await handleData(new Request(`https://test.local${root()}/constructor`),env,actors.alice)).toBeNull();
    expect(await handleData(new Request(`https://test.local${root()}/__proto__`),env,actors.alice)).toBeNull();
  });
  it('redeems an invite once across concurrent users and safely repeats the winner',async()=>{
    const invite=await call(`${root()}/invites`,'POST',{});
    expect(invite.body.code).toMatch(/^[A-F0-9]{16}$/);
    const results=await Promise.all([call('/api/invites/redeem','POST',{code:invite.body.code},actors.bob),call('/api/invites/redeem','POST',{code:invite.body.code},actors.eve)]);
    expect(results.map(x=>x.status).sort()).toEqual([200,409]);
    const winner=results[0].status===200?actors.bob:actors.eve;
    expect((await call('/api/invites/redeem','POST',{code:invite.body.code},winner)).status).toBe(200);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM household_members WHERE household_id=?').bind(hid).first<number>('n')).toBe(2);
    await env.DB.prepare('DELETE FROM household_members WHERE household_id=? AND user_id=?').bind(hid,winner.id).run();
    expect((await call('/api/invites/redeem','POST',{code:invite.body.code},winner)).status).toBe(409);
    expect((await call(`${root()}/snapshot`,'GET',undefined,winner)).status).toBe(403);
  });
  it('consumes once after duplicate/lost-response retries and rejects changed payloads',async()=>{
    const item=await pantry();const operationId=crypto.randomUUID();
    const body={operationId,type:'consume',itemId:item.id,quantity:1,reason:'used'};
    const results=await Promise.all([call(`${root()}/operations`,'POST',body),call(`${root()}/operations`,'POST',body)]);
    expect(results.map(r=>r.status)).toEqual([200,200]);
    const state=await snap();expect(state.pantry_items[0].quantity).toBe(1);expect(state.usage_events).toHaveLength(1);
    expect((await call(`${root()}/operations`,'POST',{...body,quantity:0.5})).status).toBe(409);
    await env.DB.prepare('DELETE FROM household_members WHERE household_id=? AND user_id=?').bind(hid,actors.alice.id).run();
    expect((await call(`${root()}/operations`,'POST',body)).status).toBe(403);
  });
  it('rolls back inventory, usage, receipt and household sequence on a mid-batch SQL failure',async()=>{
    const item=await pantry();const before=await snap();
    await env.DB.exec("CREATE TRIGGER test_usage_failure BEFORE INSERT ON usage_events BEGIN SELECT RAISE(ABORT,'injected failure'); END;");
    try {await expect(op({type:'consume',itemId:item.id,quantity:1,reason:'used'})).rejects.toThrow('injected failure');}
    finally{await env.DB.exec('DROP TRIGGER test_usage_failure;')}
    const after=await snap();expect(after.pantry_items).toEqual(before.pantry_items);expect(after.sequence).toBe(before.sequence);expect(after.usage_events).toHaveLength(0);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM operation_receipts WHERE household_id=?').bind(hid).first<number>('n')).toBe(0);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM mutation_assertions').first<number>('n')).toBe(0);
  });
  it('moves purchases atomically and duplicate retries do not insert extra pantry stock',async()=>{
    const item=await shopping();const body={operationId:crypto.randomUUID(),type:'move-shopping',itemId:item.id,zone:'fridge'};
    expect((await call(`${root()}/operations`,'POST',body)).status).toBe(200);
    expect((await call(`${root()}/operations`,'POST',body)).status).toBe(200);
    const state=await snap();expect(state.shopping_items).toHaveLength(0);expect(state.pantry_items).toHaveLength(1);expect(state.pantry_items[0].zone).toBe('fridge');
  });
  it('cooks compatible units and aggregates repeated ingredient requirements without partial deduction',async()=>{
    await pantry('Rice',1,'kg');
    const failed=await op({type:'cook',ingredients:[{name:'rice',quantity:700,unit:'g'},{name:'Rice',quantity:400,unit:'g'}]});
    expect(failed.status).toBe(409);expect(failed.body.error.details.missing).toEqual(['Rice']);
    expect((await snap()).pantry_items[0].quantity).toBe(1);
    expect((await op({type:'cook',ingredients:[{name:'Rice',quantity:200,unit:'g'},{name:'Rice',quantity:0.3,unit:'kg'}]})).status).toBe(200);
    expect((await snap()).pantry_items[0].quantity).toBeCloseTo(0.5);
    expect((await op({type:'cook',ingredients:[{name:'Rice',quantity:1,unit:'cup'}]})).status).toBe(409);
  });
  it('handles stale checkmark revisions without a success receipt or sequence advance',async()=>{
    const item=await shopping();const seq=(await snap()).sequence;
    const results=await Promise.all([op({type:'set-checked',itemId:item.id,done:true,expectedRevision:1}),op({type:'set-checked',itemId:item.id,done:false,expectedRevision:1})]);
    expect(results.map(r=>r.status).sort()).toEqual([200,409]);
    expect((await snap()).sequence).toBe(seq+1);
    expect(await env.DB.prepare('SELECT count(*) AS n FROM operation_receipts WHERE household_id=?').bind(hid).first<number>('n')).toBe(1);
  });
  it('validates all batch rows before adding anything and clears completed in one operation',async()=>{
    expect((await op({type:'add-shopping-batch',items:[{name:'Milk'},{name:'Bad',quantity:-3}]})).status).toBe(400);
    expect((await snap()).shopping_items).toHaveLength(0);
    expect((await op({type:'add-shopping-batch',items:[{name:'Milk',done:true},{name:'Bread'}]})).status).toBe(200);
    expect((await op({type:'clear-completed'})).status).toBe(200);
    const state=await snap();expect(state.shopping_items).toHaveLength(1);expect(state.shopping_items[0].done).toBe(false);
    expect((await op({type:'add-meal-plan-batch',entries:[{date:'2026-09-21',meal:'dinner',recipe_id:'builtin-recipe'}]})).status).toBe(200);
  });
  it('enforces item-location/store household consistency and upserts layout records',async()=>{
    const store=(await call(`${root()}/stores`,'POST',{name:'Market'})).body.data;
    const other=(await call('/api/households','POST',{name:'Other'})).body.data.id;
    expect((await call(`/api/households/${other}/item-locations`,'POST',{store_id:store.id,item_name:'Milk'})).status).toBe(404);
    expect((await call(`${root()}/item-locations`,'POST',{store_id:store.id,item_name:'Milk',aisle:'2'})).status).toBe(201);
    const upsert=await call(`${root()}/item-locations`,'POST',{store_id:store.id,item_name:'milk',aisle:'4'});
    expect(upsert.body.data.aisle).toBe('4');expect(upsert.body.data.revision).toBe(2);
    expect((await call(`${root()}/item-locations?store_id=${store.id}`)).body.data).toHaveLength(1);
  });
  it('returns typed JSON recipe arrays and preserves saved recipe metadata',async()=>{
    const recipe={name:'Saved curry',equipment:['pot'],ingredients:[{name:'Rice',quantity:2,unit:'cup'}],steps:['Cook'],tags:['dinner'],servings:2,source:'https://example.test/recipe'};
    const saved=await call(`${root()}/saved-recipes`,'POST',recipe);expect(saved.status).toBe(201);
    expect((await snap()).saved_recipes[0].ingredients).toEqual(recipe.ingredients);
    expect((await snap()).saved_recipes[0].equipment).toEqual(['pot']);
  });
  it('searches FTS/aliases safely and preserves textual barcode identity',async()=>{
    const unique=crypto.randomUUID();
    await env.DB.prepare("INSERT INTO ingredients(id,slug,name,aliases) VALUES(?,?,?,?)").bind(unique,unique,'Garbanzo beans','["chickpeas"]').run();
    expect((await call('/api/catalog/ingredients?q=chickpeas')).body.data.some((x:{id:string})=>x.id===unique)).toBe(true);
    expect((await call('/api/catalog/ingredients?q=%22%20OR%20*')).status).toBe(200);
    expect((await call('/api/catalog/ingredients?name=Garbanzo%20beans')).body.data.name).toBe('Garbanzo beans');
    await env.DB.prepare('INSERT INTO foods(id,barcode,name) VALUES(?,?,?)').bind(unique,'0012345678905','Beans').run();
    expect((await call('/api/catalog/foods?barcode=0012345678905')).body.data.barcode).toBe('0012345678905');
    expect((await call('/api/catalog/foods?barcode=0012345678905')).body.data.calories).toBeNull();
    expect((await call('/api/nutrition?name=unknown%20food')).body.data).toBeNull();
    expect((await call('/api/catalog/ingredients','POST',{name:'Unauthorized catalog write'})).status).toBe(405);
  });
});
