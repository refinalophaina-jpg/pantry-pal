export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}
export type SqlValue = string | number | null;
export type Row = Record<string, unknown>;
export type Validator = (value: unknown, key: string) => SqlValue;
export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export const failure = (error: ApiError) => json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }, error.status);
export const invalid = (key: string): never => { throw new ApiError(400, 'invalid_input', `Invalid ${key}.`); };
export function object(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid('request body');
  return value as Row;
}
export function only(body: Row, allowed: readonly string[]) {
  for (const key of Object.keys(body)) if (!allowed.includes(key)) invalid(key);
}
export async function readBody(request: Request): Promise<Row> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'content_type', 'Send JSON with Content-Type: application/json.');
  }
  if (!request.body) return invalid('request body');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 131072) { await reader.cancel(); throw new ApiError(413, 'body_too_large', 'Request is too large.'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength; }
  try { return object(JSON.parse(new TextDecoder().decode(bytes))); }
  catch (error) { if (error instanceof ApiError) throw error; return invalid('JSON'); }
}
export function text(max = 250, allowEmpty = false): Validator {
  return (v, k) => typeof v === 'string' && v.length <= max && (allowEmpty || v.trim().length > 0) ? v.trim() : invalid(k);
}
export const id: Validator = (v,k) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(v) ? v : invalid(k);
export function number(min = 0, max = 1e6, integer = false): Validator {
  return (v,k) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isInteger(v)) ? v : invalid(k);
}
export const bool: Validator = (v,k) => typeof v === 'boolean' ? Number(v) : invalid(k);
export const nullable = (fn: Validator): Validator => (v,k) => v === null ? null : fn(v,k);
export function oneOf(values: readonly string[]): Validator { return (v,k) => typeof v === 'string' && values.includes(v) ? v : invalid(k); }
export const units = ['pcs','g','kg','ml','l','tbsp','tsp','cup'] as const;
export const unit = oneOf(units);
export const date: Validator = (v,k) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0,10) === v ? v : invalid(k);
export const url: Validator = (v,k) => {
  const s = text(2048)(v,k) as string;
  try { const parsed = new URL(s); if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return s; } catch { /* invalid */ }
  return invalid(k);
};
export function stringArray(maxItems = 100, maxLength = 200): Validator {
  return (v,k) => {
    if (!Array.isArray(v) || v.length > maxItems) return invalid(k);
    return JSON.stringify(v.map(x => text(maxLength)(x,k)));
  };
}
export interface Ingredient { name: string; quantity: number; unit: string; optional?: boolean }
export function parseIngredients(v: unknown, k = 'ingredients'): Ingredient[] {
  if (!Array.isArray(v) || v.length > 50) return invalid(k);
  return v.map(raw => {
    const item = object(raw); only(item,['name','quantity','unit','optional']);
    const result: Ingredient = { name: text(250)(item.name,k) as string, quantity: number(0,1e6)(item.quantity,k) as number, unit: unit(item.unit,k) as string };
    if (item.optional !== undefined) { bool(item.optional,k); result.optional = item.optional as boolean; }
    return result;
  });
}
export const ingredients: Validator = (v,k) => JSON.stringify(parseIngredients(v,k));
export function parseFields(body: Row, fields: Record<string, Validator>, defaults: Record<string, SqlValue>, required: readonly string[], patch = false): Record<string, SqlValue> {
  only(body, Object.keys(fields));
  const output: Record<string, SqlValue> = patch ? {} : { ...defaults };
  for (const [key, value] of Object.entries(body)) output[key] = fields[key](value,key);
  if (!patch) for (const key of required) if (!(key in output)) invalid(key);
  if (patch && Object.keys(output).length === 0) invalid('empty update');
  return output;
}
export function decode(row: Row): Row {
  const result = { ...row };
  for (const key of ['aliases','equipment','ingredients','steps','tags']) {
    if (typeof result[key] === 'string') result[key] = JSON.parse(result[key] as string);
  }
  if ('done' in result) result.done = Boolean(result.done);
  return result;
}
