import { ApiError, decode, failure, id, invalid, json, only, parseFields, readBody, text, type Row, type SqlValue } from './domain-validation';
import { collections, type Collection } from './domain-collections';
import { assertion, clearAssertion, insertStatement, listHouseholds, memberSql, requireMember, snapshot, type Actor } from './domain-repository';
import { handleCatalog } from './domain-catalog';
import { performOperation } from './domain-operations';
export { listHouseholds } from './domain-repository';

/** Authentication/CSRF checks run in the Worker entrypoint; no route bypasses household SQL scoping. */
export async function handleData(request: Request, env: Env, user: Actor): Promise<Response|null> {
  try { return await routeData(request,env,user); }
  catch(error) { if(error instanceof ApiError) return failure(error); throw error; }
}
async function routeData(request:Request, env:Env, user:Actor):Promise<Response|null> {
  const url=new URL(request.url);
  const path=url.pathname.replace(/\/$/,'');
  if(path.startsWith('/api/catalog/') || path==='/api/nutrition') return handleCatalog(request,env);
  if(path==='/api/households') {
    if(request.method==='GET') return json({data:await listHouseholds(env,user.id)});
    if(request.method!=='POST') throw new ApiError(405,'method_not_allowed','Unsupported method.');
    const body=await readBody(request);only(body,['name']);
    const name=text(120)(body.name,'name') as string;
    const newId=crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO households(id,name,created_by) VALUES(?,?,?)').bind(newId,name,user.id),
      env.DB.prepare("INSERT INTO household_members(household_id,user_id,role) VALUES(?,?,'owner')").bind(newId,user.id),
    ]);
    return json({data:{id:newId,name,role:'owner'}},201);
  }
  if(path==='/api/invites/redeem') return redeemInvite(request,env,user);
  const match=path.match(/^\/api\/households\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/);
  if(!match) return null;
  const [,hid,resource,rowId]=match;
  id(hid,'household');if(rowId)id(rowId,'id');
  await requireMember(env,hid,user.id);
  if(resource==='snapshot' && !rowId) {
    if(request.method!=='GET') throw new ApiError(405,'method_not_allowed','Unsupported method.');
    return json(await snapshot(env,hid,user.id));
  }
  if(resource==='invites' && !rowId) {
    if(request.method!=='POST') throw new ApiError(405,'method_not_allowed','Unsupported method.');
    const body=await readBody(request);only(body,[]);
    const code=[...crypto.getRandomValues(new Uint8Array(8))].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
    const expires=new Date(Date.now()+7*86400000).toISOString();
    const result=await env.DB.prepare(`INSERT INTO household_invites(code,household_id,created_by,expires_at) SELECT ?,?,?,? WHERE ${memberSql} RETURNING code`).bind(code,hid,user.id,expires,hid,user.id).first<Row>();
    if(!result) throw new ApiError(403,'household_forbidden','You do not have access to this household.');
    return json({code},201);
  }
  if(resource==='operations' && !rowId) {
    if(request.method!=='POST') throw new ApiError(405,'method_not_allowed','Unsupported method.');
    return json(await performOperation(env,hid,user.id,await readBody(request)));
  }
  if(!Object.hasOwn(collections,resource)) return null;
  const collection=collections[resource];
  return collectionRoute(request,env,user.id,hid,collection,rowId,url);
}
async function redeemInvite(request:Request,env:Env,user:Actor) {
  if(request.method!=='POST') throw new ApiError(405,'method_not_allowed','Unsupported method.');
  const body=await readBody(request);only(body,['code']);
  const code=(text(32)(body.code,'code') as string).toUpperCase();
  if(!/^[A-F0-9]{16}$/.test(code)) throw new ApiError(400,'invalid_invite','Invite code is invalid or expired.');
  const guardId=crypto.randomUUID();const now=new Date().toISOString();
  try {
    const result=await env.DB.batch<Row>([
      // A consumed invite may replay only while its recipient is still a member.
      // Otherwise an old invite would silently restore revoked membership.
      assertion(env,guardId,'EXISTS(SELECT 1 FROM household_invites i WHERE code=? AND expires_at>? AND (used_by IS NULL OR (used_by=? AND EXISTS(SELECT 1 FROM household_members m WHERE m.household_id=i.household_id AND m.user_id=?))))',[code,now,user.id,user.id]),
      env.DB.prepare('UPDATE household_invites SET used_by=?,used_at=COALESCE(used_at,?) WHERE code=? AND (used_by IS NULL OR used_by=?)').bind(user.id,now,code,user.id),
      env.DB.prepare("INSERT INTO household_members(household_id,user_id,role) SELECT household_id,?,'member' FROM household_invites WHERE code=? AND used_by=? ON CONFLICT(household_id,user_id) DO NOTHING").bind(user.id,code,user.id),
      env.DB.prepare('SELECT h.id,h.name,m.role FROM households h JOIN household_invites i ON i.household_id=h.id JOIN household_members m ON m.household_id=h.id WHERE i.code=? AND i.used_by=? AND m.user_id=?').bind(code,user.id,user.id),
      clearAssertion(env,guardId),
    ]);
    return json({data:result[3].results[0]});
  } catch(error) {
    if(error instanceof Error && /CHECK constraint failed|mutation_assertions/.test(`${error.message} ${error.cause instanceof Error ? error.cause.message : ''}`)) {
      throw new ApiError(409,'invalid_invite','Invite code is invalid, expired, or already used.');
    }
    throw error;
  }
}
async function collectionRoute(request:Request,env:Env,uid:string,hid:string,collection:Collection,rowId:string|undefined,url:URL) {
  const table=collection.table;
  if(request.method==='GET') {
    if(rowId) {
      const row=await env.DB.prepare(`SELECT * FROM ${table} WHERE id=? AND household_id=? AND ${memberSql}`).bind(rowId,hid,hid,uid).first<Row>();
      if(!row) throw new ApiError(404,'not_found','Item was not found.');
      return json({data:decode(row)});
    }
    const rawLimit=url.searchParams.get('limit');const limit=rawLimit===null?500:Number(rawLimit);
    const offset=Number(url.searchParams.get('offset')??0);
    if(!Number.isInteger(limit)||limit<1||limit>2000||!Number.isInteger(offset)||offset<0||offset>1e6) invalid('pagination');
    const storeId=url.searchParams.get('store_id');
    if(storeId) {if(table!=='item_locations') invalid('store_id');id(storeId,'store_id');}
    const result=await env.DB.prepare(`SELECT * FROM ${table} WHERE household_id=? AND ${memberSql}${storeId?' AND store_id=?':''} ORDER BY ${collection.order} LIMIT ? OFFSET ?`).bind(hid,hid,uid,...(storeId?[storeId]:[]),limit,offset).all<Row>();
    return json({data:result.results.map(decode)});
  }
  if(collection.readOnly) throw new ApiError(405,'method_not_allowed','Usage history is written through inventory operations.');
  if(request.method==='DELETE' && rowId) {
    const result=await env.DB.prepare(`DELETE FROM ${table} WHERE id=? AND household_id=? AND ${memberSql} RETURNING id`).bind(rowId,hid,hid,uid).first<Row>();
    if(!result) throw new ApiError(404,'not_found','Item was not found.');
    return json({ok:true});
  }
  if((request.method==='POST'&&!rowId)||(request.method==='PATCH'&&rowId)) {
    const patch=request.method==='PATCH';
    const data=parseFields(await readBody(request),collection.fields,collection.defaults,collection.required,patch);
    if(table==='item_locations' && data.store_id) {
      const store=await env.DB.prepare(`SELECT id FROM stores WHERE id=? AND household_id=? AND ${memberSql}`).bind(data.store_id,hid,hid,uid).first();
      if(!store) throw new ApiError(404,'store_not_found','Store was not found in this household.');
    }
    let result:Row|null;
    if(patch) {
      const assignments=Object.keys(data).map(key=>`${key}=?`).join(',');
      result=await env.DB.prepare(`UPDATE ${table} SET ${assignments},revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND household_id=? AND ${memberSql} RETURNING *`).bind(...Object.values(data),rowId!,hid,hid,uid).first<Row>();
    } else if(table==='item_locations') {
      const fields:Record<string,SqlValue>={...data,updated_by:uid};
      const keys=Object.keys(fields);const updateKeys=keys.filter(k=>k!=='store_id'&&k!=='item_name');
      result=await env.DB.prepare(`INSERT INTO item_locations(id,household_id,created_by,${keys.join(',')}) SELECT ?,?,?,${keys.map(()=>'?').join(',')} WHERE ${memberSql} ON CONFLICT(store_id,item_name) DO UPDATE SET ${updateKeys.map(k=>`${k}=excluded.${k}`).join(',')},revision=item_locations.revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE item_locations.household_id=? AND ${memberSql} RETURNING *`).bind(crypto.randomUUID(),hid,uid,...Object.values(fields),hid,uid,hid,hid,uid).first<Row>();
    } else result=await insertStatement(env,table,data,uid,hid).first<Row>();
    if(!result) throw new ApiError(404,'not_found','Item was not found or access changed.');
    return json({data:decode(result)},patch?200:201);
  }
  throw new ApiError(405,'method_not_allowed','Unsupported method.');
}
