import { getSession, handleAuth } from './auth';
import { handleData } from './data';
import { handleProviders } from './providers';
import { refreshCatalog } from './catalog-job';
import { refreshMealDb } from './mealdb-job';
import { ApiError, failure, json } from './domain-validation';

/** Enforce actual streamed size; Content-Length alone can be omitted or forged. */
async function boundedRequest(request: Request, maxBytes: number) {
  if (!request.body) return request;
  if (Number(request.headers.get('content-length')) > maxBytes) throw new ApiError(413, 'body_too_large', 'Request is too large.');
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { await reader.cancel(); throw new ApiError(413, 'body_too_large', 'Request is too large.'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return new Request(request, { body: bytes });
}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  if (url.pathname === '/api/health' && request.method === 'GET') {
    await env.DB.prepare('SELECT 1 FROM app_metadata LIMIT 1').first();
    return json({ status: 'ok', platform: 'cloudflare' });
  }
  if (url.origin !== new URL(env.BETTER_AUTH_URL).origin) throw new ApiError(403, 'invalid_origin', 'Use the configured Pantry Pal address.');
  if (!['GET', 'HEAD'].includes(request.method) && request.headers.get('Origin') !== url.origin) {
    throw new ApiError(403, 'invalid_origin', 'This request must come from Pantry Pal.');
  }
  if (url.pathname.startsWith('/api/auth/')) {
    return handleAuth(await boundedRequest(request, 16_384), env, ctx);
  }
  const session = await getSession(request, env);
  if (!session?.user || (!session.user.emailVerified && !("isAnonymous" in session.user && session.user.isAnonymous === true))) {
    throw new ApiError(401, 'unauthorized', 'Sign in or continue as a guest.');
  }
  const bare = url.pathname.replace(/\/$/, '');
  request = await boundedRequest(request, bare === '/api/pantry/recognize' ? 8_500_000 : /^\/api\/households\/[^/]+\/images$/.test(bare) ? 1_400_000 : 131_072);
  const provider = await handleProviders(request, env, session.user);
  if (provider) return provider;
  return await handleData(request, env, session.user) ?? failure(new ApiError(404, 'not_found', 'This API route does not exist.'));
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    let response: Response;
    try { response = await route(request, env, ctx); }
    catch (error) {
      if (error instanceof ApiError) response = failure(error);
      else {
        // Never log request bodies, cookies, auth links, images or provider errors.
        const path = new URL(request.url).pathname;
        const route = path.startsWith('/api/auth/') ? 'auth' : path.startsWith('/api/') ? 'api' : 'assets';
        console.error(JSON.stringify({ event: 'request_failed', route }));
        response = failure(new ApiError(500, 'service_error', 'The service could not complete this request. Please retry.'));
      }
    }
    const result = new Response(response.body, response);
    result.headers.set('X-Content-Type-Options', 'nosniff');
    result.headers.set('X-Frame-Options', 'DENY');
    const path = new URL(request.url).pathname;
    result.headers.set('Referrer-Policy', path.startsWith('/api/auth/') || /^\/sign-in\/?$/.test(path) ? 'no-referrer' : 'strict-origin-when-cross-origin');
    if (path.startsWith('/api/') && !/^\/api\/households\/[^/]+\/images\/[^/]+$/.test(path)) result.headers.set('Cache-Control', 'no-store');
    return result;
  },
  async scheduled(_controller, env, ctx) {
    // Each job owns its own lease and failure logging; one failing must not skip the other.
    ctx.waitUntil((async () => {
      await refreshCatalog(env).catch(() => {});
      await refreshMealDb(env).catch(() => {});
    })());
  },
} satisfies ExportedHandler<Env>;
