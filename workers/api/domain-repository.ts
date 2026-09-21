import { ApiError, type Row, type SqlValue, decode } from './domain-validation';
export interface Actor { id: string; email?: string }
export const memberSql = 'EXISTS (SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?)';
export async function requireMember(env: Env, householdId: string, userId: string) {
  const row = await env.DB.prepare('SELECT role FROM household_members WHERE household_id=? AND user_id=?').bind(householdId,userId).first<{role:string}>();
  if (!row) throw new ApiError(403,'household_forbidden','You do not have access to this household.');
  return row;
}
export async function listHouseholds(env: Env, userId: string) {
  const result = await env.DB.prepare('SELECT h.id,h.name,m.role FROM households h JOIN household_members m ON m.household_id=h.id WHERE m.user_id=? ORDER BY m.joined_at,h.id').bind(userId).all<{id:string;name:string;role:string}>();
  return result.results;
}
export function assertion(env: Env, assertionId: string, condition: string, values: SqlValue[]) {
  return env.DB.prepare(`INSERT INTO mutation_assertions(id,ok) VALUES (?, CASE WHEN ${condition} THEN 1 ELSE 0 END)`).bind(assertionId,...values);
}
export function clearAssertion(env: Env, assertionId: string) {
  return env.DB.prepare('DELETE FROM mutation_assertions WHERE id=?').bind(assertionId);
}
export function insertStatement(env: Env, table: string, fields: Record<string, SqlValue>, userId: string, householdId: string, newId = crypto.randomUUID()) {
  const keys = Object.keys(fields);
  // table and keys exclusively originate in the closed collection schema/validated fields.
  return env.DB.prepare(`INSERT INTO ${table} (id,household_id,created_by,${keys.join(',')}) SELECT ?,?,?,${keys.map(()=>'?').join(',')} WHERE ${memberSql} RETURNING *`).bind(newId,householdId,userId,...Object.values(fields),householdId,userId);
}
export async function snapshot(env: Env, householdId: string, userId: string) {
  const tables = ['pantry_items','shopping_items','meal_plan','usage_events','saved_recipes'] as const;
  const result = await env.DB.batch<Row>([
    env.DB.prepare(`SELECT h.sequence, (SELECT value FROM app_metadata WHERE key='sync_epoch') AS epoch FROM households h WHERE h.id=? AND ${memberSql}`).bind(householdId,householdId,userId),
    ...tables.map(table => env.DB.prepare(`SELECT * FROM ${table} WHERE household_id=? AND ${memberSql} ORDER BY ${table === 'usage_events' ? 'at DESC' : 'id'} LIMIT ${table === 'usage_events' ? '200' : '2001'}`).bind(householdId,householdId,userId)),
  ]);
  const meta=result[0].results[0];
  if (!meta) throw new ApiError(403,'household_forbidden','You do not have access to this household.');
  const output: Row = {sequence:meta.sequence,epoch:meta.epoch};
  tables.forEach((table,index)=>{
    const rows=result[index+1].results;
    if(rows.length>2000) throw new ApiError(413,'snapshot_too_large','This household needs a paginated data export.');
    output[table]=rows.map(decode);
  });
  return output;
}
