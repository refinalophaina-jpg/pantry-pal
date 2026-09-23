import { memberSql } from './domain-repository';
import { ApiError, invalid, json, object, oneOf, only, text, type Row } from './domain-validation';

/**
 * Private recipe photos stored as bounded D1 blobs. The browser downsizes
 * uploads before sending; generated illustrations arrive from Workers AI.
 * Reads and writes both require current household membership.
 */
export const IMAGE_MAX_BYTES = 900_000;
export const IMAGE_CAP_PER_HOUSEHOLD = 150;
export const imageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** True when the first bytes match the declared image container. */
export function magicMatches(head: string, mediaType: string) {
  if (mediaType === 'image/jpeg') return head.startsWith('\xff\xd8\xff');
  if (mediaType === 'image/png') return head.startsWith('\x89PNG\r\n\x1a\n');
  if (mediaType === 'image/webp') return head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP';
  return false;
}

export function sniffMediaType(head: string): string | null {
  return imageTypes.find(type => magicMatches(head, type)) ?? null;
}

/** Validate base64 and container signature, then decode into bytes. */
export function decodeImage(imageBase64: unknown, mediaType: unknown): { bytes: Uint8Array; mediaType: string } {
  const type = oneOf(imageTypes)(mediaType, 'mediaType') as string;
  const encoded = text(1_300_000)(imageBase64, 'imageBase64') as string;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) invalid('imageBase64');
  if (!magicMatches(atob(encoded.slice(0, 32)), type)) invalid('image type');
  const binary = atob(encoded);
  if (binary.length > IMAGE_MAX_BYTES) throw new ApiError(413, 'image_too_large', 'Choose an image under 900 KB.');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return { bytes, mediaType: type };
}

export async function storeImage(env: Env, householdId: string, userId: string, bytes: Uint8Array, mediaType: string, purpose: 'upload' | 'generated') {
  const imageId = crypto.randomUUID();
  const row = await env.DB.prepare(`INSERT INTO household_images(id,household_id,created_by,media_type,purpose,size,bytes) SELECT ?,?,?,?,?,?,? WHERE ${memberSql} AND (SELECT count(*) FROM household_images WHERE household_id=?)<? RETURNING id`)
    .bind(imageId, householdId, userId, mediaType, purpose, bytes.byteLength, bytes.buffer, householdId, userId, householdId, IMAGE_CAP_PER_HOUSEHOLD).first<{ id: string }>();
  if (!row) {
    const count = await env.DB.prepare(`SELECT count(*) AS n FROM household_images WHERE household_id=? AND ${memberSql}`).bind(householdId, householdId, userId).first<number>('n');
    if (count !== null && count >= IMAGE_CAP_PER_HOUSEHOLD) throw new ApiError(409, 'image_limit', `This household has reached ${IMAGE_CAP_PER_HOUSEHOLD} photos. Delete some to add more.`);
    throw new ApiError(403, 'household_forbidden', 'You do not have access to this household.');
  }
  return { id: row.id, url: `/api/households/${householdId}/images/${row.id}` };
}

export async function handleImages(request: Request, env: Env, userId: string, householdId: string, imageId: string | undefined): Promise<Response> {
  if (request.method === 'POST' && !imageId) {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new ApiError(415, 'content_type', 'Send JSON with Content-Type: application/json.');
    // The entrypoint has already bounded this body; readBody's limit is for ordinary rows.
    let body: Row;
    try { body = object(await request.json()); } catch { return invalid('JSON'); }
    only(body, ['imageBase64', 'mediaType']);
    const { bytes, mediaType } = decodeImage(body.imageBase64, body.mediaType);
    return json({ data: await storeImage(env, householdId, userId, bytes, mediaType, 'upload') }, 201);
  }
  if (!imageId) throw new ApiError(405, 'method_not_allowed', 'Upload with POST or fetch one image by ID.');
  if (request.method === 'GET' || request.method === 'HEAD') {
    const row = await env.DB.prepare(`SELECT media_type,bytes FROM household_images WHERE id=? AND household_id=? AND ${memberSql}`).bind(imageId, householdId, householdId, userId).first<{ media_type: string; bytes: ArrayBuffer }>();
    if (!row) throw new ApiError(404, 'not_found', 'Image was not found.');
    const bytes = row.bytes instanceof ArrayBuffer ? row.bytes : new Uint8Array(row.bytes as ArrayLike<number>).buffer;
    return new Response(request.method === 'HEAD' ? null : bytes, { headers: {
      'Content-Type': row.media_type, 'Content-Length': String(bytes.byteLength), 'Content-Disposition': 'inline',
      // Immutable per ID; private because access depends on the session.
      'Cache-Control': 'private, max-age=31536000, immutable', 'Content-Security-Policy': "default-src 'none'; sandbox",
    } });
  }
  if (request.method === 'DELETE') {
    const row = await env.DB.prepare(`DELETE FROM household_images WHERE id=? AND household_id=? AND ${memberSql} RETURNING id`).bind(imageId, householdId, householdId, userId).first();
    if (!row) throw new ApiError(404, 'not_found', 'Image was not found.');
    return json({ ok: true });
  }
  throw new ApiError(405, 'method_not_allowed', 'Unsupported method.');
}
