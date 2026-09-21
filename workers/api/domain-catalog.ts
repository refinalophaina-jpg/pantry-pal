import { ApiError, decode, id, invalid, json, text, type Row } from './domain-validation';
function limitFor(url: URL) {
  const raw=url.searchParams.get('limit');
  if (raw === null) return 20;
  const n=Number(raw); if (!Number.isInteger(n)||n<1||n>100) invalid('limit');
  return n;
}
function like(value: string) { return value.replace(/[\\%_]/g,'\\$&'); }
function fts(value: string) {
  return value.normalize('NFKC').match(/[\p{L}\p{N}]+/gu)?.slice(0,12).map(word=>`"${word}"*`).join(' AND ') ?? '';
}
export async function handleCatalog(request: Request, env: Env): Promise<Response|null> {
  const url=new URL(request.url);
  if (url.pathname !== '/api/nutrition' && !url.pathname.startsWith('/api/catalog/')) return null;
  if (request.method !== 'GET') throw new ApiError(405,'method_not_allowed','Only catalog reads are supported.');
  if (url.pathname === '/api/nutrition') {
    const name=text(250)(url.searchParams.get('name'),'name') as string;
    const row=await env.DB.prepare('SELECT * FROM nutrition_cache WHERE key=?').bind(name.trim().toLowerCase()).first<Row>();
    return json({data:row});
  }
  const collection=url.pathname.split('/')[3];
  if (!['ingredients','foods','recipes','techniques'].includes(collection)) return null;
  const table=collection === 'recipes' ? 'recipe_catalog' : collection;
  const nameColumn=collection === 'techniques' ? 'title' : 'name';
  const rowId=url.searchParams.get('id');
  if(rowId) { id(rowId,'id'); const row=await env.DB.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(rowId).first<Row>(); return json({data:row ? decode(row) : null}); }
  if (collection==='foods' && url.searchParams.has('barcode')) {
    const barcode=url.searchParams.get('barcode')!;
    if(!/^\d{4,32}$/.test(barcode)) invalid('barcode');
    const row=await env.DB.prepare('SELECT * FROM foods WHERE barcode=?').bind(barcode).first<Row>();
    return json({data:row ? decode(row) : null});
  }
  if(collection==='ingredients' && url.searchParams.has('name')) {
    const name=text(250)(url.searchParams.get('name'),'name') as string;
    const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
    const row=await env.DB.prepare('SELECT * FROM ingredients WHERE name=? COLLATE NOCASE OR slug=? ORDER BY CASE WHEN name=? COLLATE NOCASE THEN 0 ELSE 1 END LIMIT 1').bind(name,slug,name).first<Row>();
    return json({data:row ? decode(row) : null});
  }
  const q=text(250,true)(url.searchParams.get('q')??'','q') as string;
  const category=url.searchParams.get('category');
  const clauses:string[]=[]; const args:(string|number)[]=[];
  if(category) {text(100)(category,'category');clauses.push('category=?');args.push(category);}
  if(q) {
    const match=fts(q);
    const parts=[`${nameColumn} LIKE ? ESCAPE '\\'`]; args.push(`%${like(q)}%`);
    if(collection==='ingredients') {parts.push("EXISTS(SELECT 1 FROM json_each(aliases) WHERE value LIKE ? ESCAPE '\\')");args.push(`%${like(q)}%`);}
    if(match) {parts.push(`rowid IN(SELECT rowid FROM ${table}_fts WHERE ${table}_fts MATCH ?)`);args.push(match);}
    clauses.push(`(${parts.join(' OR ')})`);
  }
  const where=clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result=await env.DB.prepare(`SELECT * FROM ${table} ${where} ORDER BY CASE WHEN ${nameColumn} LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END, ${nameColumn} COLLATE NOCASE,id LIMIT ?`).bind(...args,`${like(q)}%`,limitFor(url)).all<Row>();
  return json({data:result.results.map(decode)});
}
