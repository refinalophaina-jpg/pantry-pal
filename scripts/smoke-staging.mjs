/** Disposable integration fixtures in STAGING only; never touches production. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hashPassword } from 'better-auth/crypto';
import { parseTargetArgs, sqlValue, withD1 } from './d1-tools.mjs';
const { target } = parseTargetArgs(['--env', 'staging', '--remote']);
const origin = 'https://pantry-pal-staging.refinalophaina.workers.dev';
const users = [crypto.randomUUID(), crypto.randomUUID()];
const households = [];
const password = `Staging-check-${crypto.randomUUID()}`;
const digest = await hashPassword(password);
const now = new Date().toISOString();
const cookies = [];
let assertions = 0;
let lastStep = 'fixture creation';
let cleanupComplete = false;
// Compare only booleans in assertion diagnostics; never print actual payloads.
const check = (actual, expected, label) => { assert.equal(Object.is(actual, expected), true, label); assertions++; };
async function api(path, body, userIndex = 0, expected = 200, extraHeaders = {}, capture = () => {}) {
  lastStep = `${body === undefined ? 'GET' : 'POST'} ${path}`;
  const response = await fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookies[userIndex] ? { Cookie: cookies[userIndex] } : {}), ...extraHeaders },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    redirect: 'manual', signal: AbortSignal.timeout(60_000),
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error('Staging response was not JSON.'); }
  // Capture created fixture IDs before a status/header assertion can fail.
  capture(data);
  check(response.status, expected, `${path} status`);
  check(response.headers.get('cache-control'), 'no-store', `${path} private cache policy`);
  return { response, data };
}
await withD1(target, async db => {
  try {
    await db.execute(users.map(uid => `INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES(${sqlValue(uid)},'Staging migration test',${sqlValue(`${uid}@example.invalid`)},1,${sqlValue(now)},${sqlValue(now)});\nINSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(${sqlValue(crypto.randomUUID())},${sqlValue(uid)},'credential',${sqlValue(uid)},${sqlValue(digest)},${sqlValue(now)},${sqlValue(now)});`).join('\n'));
    await api('/api/health');
    await api('/api/households', undefined, 0, 401);
    for (const [index, uid] of users.entries()) {
      const { response } = await api('/api/auth/sign-in/email', { email: `${uid}@example.invalid`, password }, index);
      const setCookies = response.headers.getSetCookie();
      check(setCookies.some(value => value.includes('HttpOnly') && value.includes('Secure')), true, 'secure session cookie');
      cookies[index] = setCookies.map(value => value.split(';')[0]).join('; ');
      const { data } = await api('/api/households', { name: 'Disposable staging household' }, index, 201);
      households.push(data.data.id);
    }
    const base = `/api/households/${households[0]}`;
    await api(base + '/snapshot', undefined, 1, 403);
    await api(base + '/pantry', { name: 'Wrong origin' }, 0, 403, { Origin: 'https://example.invalid' });
    const pantry = (await api(base + '/pantry', { name: 'Test tomatoes', quantity: 2.5, unit: 'kg', zone: 'pantry' }, 0, 201)).data.data;
    const operation = { type: 'consume', itemId: pantry.id, quantity: 0.5, reason: 'used', operationId: crypto.randomUUID() };
    await api(base + '/operations', operation);
    await api(base + '/operations', operation);
    let snapshot = (await api(base + '/snapshot')).data;
    check(snapshot.pantry_items[0].quantity, 2, 'consume retry does not duplicate');
    check(snapshot.usage_events.length, 1, 'usage recorded once');
    const shopping = (await api(base + '/shopping', { name: 'Test rice', quantity: 1.25, unit: 'kg' }, 0, 201)).data.data;
    await api(base + '/operations', { type: 'move-shopping', itemId: shopping.id, zone: 'pantry', operationId: crypto.randomUUID() });
    snapshot = (await api(base + '/snapshot')).data;
    check(snapshot.shopping_items.length, 0, 'shopping removed atomically');
    check(snapshot.pantry_items.some(item => item.name === 'Test rice' && item.quantity === 1.25), true, 'shopping added to pantry');
    const catalog = (await api('/api/catalog/ingredients?q=rice')).data.data;
    check(catalog.length > 0, true, 'catalog seeded and searchable');
    const invite = (await api(base + '/invites', {}, 0, 201)).data.code;
    await api('/api/invites/redeem', { code: invite }, 1);
    await api(base + '/snapshot', undefined, 1);
    if (process.env.SMOKE_AI === '1') {
      const plan = (await api('/api/meal-plan/generate', { householdId: households[0], dates: [now.slice(0, 10)], meals: ['dinner'], preferences: 'Quick and simple', candidates: [{ id: 'test-tomato-rice', name: 'Tomato rice', cuisine: 'International', minutes: 20 }] })).data;
      check(plan.entries.length, 1, 'live AI meal plan');
      const imageBase64 = (await readFile('public/icons/icon-192.png')).toString('base64');
      const recognition = (await api('/api/pantry/recognize', { householdId: households[0], imageBase64, mediaType: 'image/png' })).data;
      check(Array.isArray(recognition.items), true, 'live image recognition schema');
    }
    const guest = await api('/api/auth/sign-in/anonymous', {}, 2, 200, {}, data => {
      const uid = data?.user?.id;
      if (data?.user?.isAnonymous === true && typeof uid === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(uid)) users.push(uid);
    });
    check(Object.hasOwn(guest.data, 'token'), false, 'guest tokens stay HttpOnly');
    check(users.includes(guest.data.user?.id), true, 'guest fixture ID captured');
    cookies[2] = guest.response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const guestHousehold = (await api('/api/households', { name: 'Disposable guest recovery check' }, 2, 201)).data.data.id;
    households.push(guestHousehold);
    const recovery = (await api('/api/auth/guest/recovery-code', {}, 2)).data.recoveryCode;
    const recovered = await api('/api/auth/guest/recover', { code: recovery }, 3);
    cookies[3] = recovered.response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    await api(`/api/households/${guestHousehold}/snapshot`, undefined, 3);
    await api(`/api/households/${guestHousehold}/snapshot`, undefined, 2, 401);
    await api('/api/auth/guest/recover', { code: recovery }, 4, 401);
    check(recovered.data.recoveryCode !== recovery, true, 'guest recovery rotates its code');
    await api('/api/auth/sign-out', {}, 0);
    await api(base + '/snapshot', undefined, 0, 401);
    console.log(`Staging smoke passed: ${assertions} checks (sessions, isolation, origin checks, atomic retries, catalog, invites, revocation, guest recovery).`);
  } finally {
    // A create can commit even if its response is lost or a header assertion
    // fails. Scope cleanup to fixture owners, not only IDs returned to this run.
    await db.execute(`DELETE FROM households WHERE created_by IN (${users.map(sqlValue).join(',')});\n${users.map(uid => `DELETE FROM "user" WHERE id=${sqlValue(uid)};`).join('\n')}`);
    cleanupComplete = true;
    console.log('Removed only the disposable staging test fixtures.');
  }
}).catch(() => {
  // Wrangler errors may contain SQL; auth responses may contain recovery codes.
  // Keep both out of logs, including uncaught-error stacks.
  console.error(`Staging smoke failed during ${lastStep}. Disposable fixture cleanup ${cleanupComplete ? 'completed' : 'may be incomplete'}. Error payloads omitted.`);
  process.exitCode = 1;
});
