import { ApiError, id, invalid, number, object, only, oneOf, parseFields, parseIngredients, text, type Row, type SqlValue } from './domain-validation';
import { collections } from './domain-collections';
import { assertion, clearAssertion, insertStatement, memberSql, requireMember } from './domain-repository';
interface PantryRecord { id:string; name:string; quantity:number; unit:string; revision:number }
const conversion:Record<string,[string,number]>={pcs:['count',1],g:['mass',1],kg:['mass',1000],ml:['volume',1],l:['volume',1000],tsp:['volume',4.92892159375],tbsp:['volume',14.78676478125],cup:['volume',236.5882365]};
function canonical(value:unknown):string {
  if(Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if(value && typeof value==='object') return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
async function digest(value:unknown) {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function sqlConflict(error:unknown) {
  return error instanceof Error && /mutation_assertions|operation_receipts|CHECK constraint failed|UNIQUE constraint failed/.test(`${error.message} ${error.cause instanceof Error ? error.cause.message : ''}`);
}
export async function performOperation(env:Env, hid:string, uid:string, body:Row):Promise<Row> {
  try { return await applyOperation(env,hid,uid,body); }
  catch(error) {
    // Another identical request can commit after our first receipt check but
    // before inventory planning finishes (including deleting the consumed row).
    // Return its authorized receipt instead of a misleading missing-item error.
    if(error instanceof ApiError && [404,409].includes(error.status) && error.code!=='epoch_changed' && typeof body.operationId==='string') {
      const saved=await receipt(env,hid,uid,body.operationId);
      if(saved) return replay(saved,await digest(body));
    }
    throw error;
  }
}
async function applyOperation(env:Env, hid:string, uid:string, body:Row):Promise<Row> {
  await requireMember(env,hid,uid);
  const operationId=id(body.operationId,'operationId') as string;
  const type=oneOf(['consume','cook','move-shopping','set-checked','clear-completed','add-shopping-batch','add-meal-plan-batch'])(body.type,'type') as string;
  const fields:Record<string,string[]>={consume:['itemId','quantity','reason'],cook:['ingredients','recipeId'],'move-shopping':['itemId','zone'],'set-checked':['itemId','done','expectedRevision'],'clear-completed':[],'add-shopping-batch':['items'],'add-meal-plan-batch':['entries']};
  only(body,['operationId','type','epoch',...fields[type]]);
  const payloadHash=await digest(body);
  const guardId=crypto.randomUUID();
  const epoch=await env.DB.prepare("SELECT value FROM app_metadata WHERE key='sync_epoch'").first<string>('value');
  if(body.epoch !== undefined && body.epoch !== epoch) throw new ApiError(409,'epoch_changed','The database changed. Refresh before retrying.');
  const existing=await receipt(env,hid,uid,operationId);
  if(existing) return replay(existing,payloadHash);
  const statements=[assertion(env,guardId,`${memberSql} AND (SELECT value FROM app_metadata WHERE key='sync_epoch')=?`,[hid,uid,epoch])];
  const extraGuards:string[]=[];
  const guard=(condition:string,values:SqlValue[])=>{const key=crypto.randomUUID();extraGuards.push(key);statements.push(assertion(env,key,condition,values));};
  const result:Row={ok:true,operationId};
  // The unique receipt insertion serializes retries in the same D1 transaction.
  statements.push(env.DB.prepare('INSERT INTO operation_receipts(household_id,user_id,operation_id,payload_hash,response) VALUES(?,?,?,?,?)').bind(hid,uid,operationId,payloadHash,JSON.stringify(result)));

  if(type==='consume' || type==='cook') {
    const rows=await env.DB.prepare(`SELECT id,name,quantity,unit,revision FROM pantry_items WHERE household_id=? AND ${memberSql} ORDER BY expires_on IS NULL,expires_on,added_on,id LIMIT 2001`).bind(hid,hid,uid).all<PantryRecord>();
    if(rows.results.length>2000) throw new ApiError(413,'pantry_too_large','Use a smaller inventory before this operation.');
    const allocations=new Map<string,{item:PantryRecord;quantity:number}>();
    let reason='used';
    if(type==='consume') {
      const itemId=id(body.itemId,'itemId') as string;
      const qty=number(0.000001,1e6)(body.quantity,'quantity') as number;
      reason=oneOf(['used','wasted'])(body.reason,'reason') as string;
      const item=rows.results.find(p=>p.id===itemId);
      if(!item) throw new ApiError(404,'item_not_found','Pantry item was not found.');
      if(qty>item.quantity+1e-9) throw new ApiError(409,'quantity_conflict','There is not enough of this item. Refresh and try again.');
      allocations.set(item.id,{item,quantity:Math.min(qty,item.quantity)});
    } else {
      if(body.recipeId !== undefined) text(200)(body.recipeId,'recipeId');
      const needed=parseIngredients(body.ingredients).filter(i=>!i.optional && i.quantity>0);
      if(!needed.length) invalid('ingredients');
      const missing:string[]=[];
      for(const ingredient of needed) {
        const [family,factor]=conversion[ingredient.unit];
        let remaining=ingredient.quantity*factor;
        for(const item of rows.results) {
          if(item.name.trim().toLocaleLowerCase()!==ingredient.name.trim().toLocaleLowerCase()) continue;
          const target=conversion[item.unit];
          if(!target || target[0]!==family) continue;
          const prior=allocations.get(item.id)?.quantity??0;
          const available=Math.max(0,item.quantity-prior)*target[1];
          const take=Math.min(remaining,available);
          if(take>1e-9) allocations.set(item.id,{item,quantity:prior+take/target[1]});
          remaining-=take;
          if(remaining<=1e-8) break;
        }
        if(remaining>1e-8) missing.push(ingredient.name);
      }
      if(missing.length) throw new ApiError(409,'missing_ingredients','Some ingredients are missing or use incompatible units.',{missing:[...new Set(missing)]});
    }
    if(allocations.size>40) throw new ApiError(400,'too_many_items','This cooking operation uses too many inventory rows.');
    for(const {item,quantity} of allocations.values()) {
      guard('EXISTS(SELECT 1 FROM pantry_items WHERE id=? AND household_id=? AND revision=? AND quantity>=?)',[item.id,hid,item.revision,quantity-1e-9]);
      const newQuantity=Math.max(0,item.quantity-quantity);
      if(newQuantity<1e-9) statements.push(env.DB.prepare('DELETE FROM pantry_items WHERE id=? AND household_id=?').bind(item.id,hid));
      else statements.push(env.DB.prepare("UPDATE pantry_items SET quantity=?,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND household_id=?").bind(newQuantity,item.id,hid));
      statements.push(insertStatement(env,'usage_events',{item_id:item.id,item_name:item.name,quantity,unit:item.unit,reason},uid,hid));
    }
  } else if(type==='move-shopping') {
    const itemId=id(body.itemId,'itemId') as string;
    const zone=oneOf(['pantry','fridge','freezer'])(body.zone??'pantry','zone') as string;
    const item=await env.DB.prepare(`SELECT * FROM shopping_items WHERE id=? AND household_id=? AND ${memberSql}`).bind(itemId,hid,hid,uid).first<Row>();
    if(!item) throw new ApiError(404,'item_not_found','Shopping item was not found.');
    guard('EXISTS(SELECT 1 FROM shopping_items WHERE id=? AND household_id=? AND revision=?)',[itemId,hid,Number(item.revision)]);
    statements.push(insertStatement(env,'pantry_items',{name:String(item.name),category:item.category==='This week'?'Other':String(item.category),quantity:Number(item.quantity),unit:String(item.unit),zone},uid,hid));
    statements.push(env.DB.prepare('DELETE FROM shopping_items WHERE id=? AND household_id=?').bind(itemId,hid));
  } else if(type==='set-checked') {
    const itemId=id(body.itemId,'itemId') as string;
    if(typeof body.done!=='boolean') invalid('done');
    const expected=body.expectedRevision===undefined ? undefined : number(1,Number.MAX_SAFE_INTEGER,true)(body.expectedRevision,'expectedRevision');
    guard(`EXISTS(SELECT 1 FROM shopping_items WHERE id=? AND household_id=?${expected===undefined?'':' AND revision=?'})`,[itemId,hid,...(expected===undefined?[]:[expected])]);
    statements.push(env.DB.prepare("UPDATE shopping_items SET done=?,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND household_id=?").bind(Number(body.done),itemId,hid));
  } else if(type==='clear-completed') {
    statements.push(env.DB.prepare('DELETE FROM shopping_items WHERE household_id=? AND done=1').bind(hid));
  } else {
    const raw=type==='add-shopping-batch'?body.items:body.entries;
    if(!Array.isArray(raw)||raw.length<1||raw.length>50) return invalid(type==='add-shopping-batch'?'items':'entries');
    const collection=collections[type==='add-shopping-batch'?'shopping':'meal-plan'];
    for(const item of raw) {
      const data=parseFields(object(item),collection.fields,collection.defaults,collection.required);
      statements.push(insertStatement(env,collection.table,data,uid,hid));
    }
    result.count=raw.length;
    statements.push(env.DB.prepare('UPDATE operation_receipts SET response=? WHERE household_id=? AND user_id=? AND operation_id=?').bind(JSON.stringify(result),hid,uid,operationId));
  }
  statements.push(clearAssertion(env,guardId),...extraGuards.map(key=>clearAssertion(env,key)));
  try {await env.DB.batch(statements);return result;}
  catch(error) {
    if(!sqlConflict(error)) throw error;
    await requireMember(env,hid,uid);
    const saved=await receipt(env,hid,uid,operationId);
    if(saved) return replay(saved,payloadHash);
    throw new ApiError(409,'conflict','The household data changed. Refresh and try again.');
  }
}
async function receipt(env:Env,hid:string,uid:string,operationId:string) {
  return env.DB.prepare(`SELECT payload_hash,response FROM operation_receipts WHERE household_id=? AND user_id=? AND operation_id=? AND ${memberSql}`).bind(hid,uid,operationId,hid,uid).first<{payload_hash:string;response:string}>();
}
function replay(row:{payload_hash:string;response:string},hash:string):Row {
  if(row.payload_hash!==hash) throw new ApiError(409,'operation_reused','This operation ID was already used with a different request.');
  return JSON.parse(row.response) as Row;
}
