#!/usr/bin/env node
/** Explicit live UI check; disposable guest fixtures only, with no recordings. */
import assert from 'node:assert/strict';
import { experimental_readRawConfig } from 'wrangler';
import { isMain, parseTargetArgs, sqlValue, withD1 } from './d1-tools.mjs';

const origins = {
  staging: 'https://pantry-pal-staging.refinalophaina.workers.dev',
  production: 'https://pantry.ainadara.com',
};
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
const validRecovery = value => typeof value === 'string' && /^PPG-(?:[0-9a-f]{8}-){7}[0-9a-f]{8}$/i.test(value);

export function liveTarget(argv) {
  if (argv.length !== 2 || argv[0] !== '--env' || !Object.hasOwn(origins, argv[1])) throw new Error('Use --env staging or --env production explicitly.');
  return { ...parseTargetArgs(['--env', argv[1], '--remote']), origin: origins[argv[1]] };
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.length === 1 && argv[0] === '--help') {
    console.log('Run a disposable live guest UI/recovery check: node scripts/smoke-live-guest.mjs --env staging|production');
    return;
  }
  const { target, origin } = liveTarget(argv);
  const { rawConfig } = experimental_readRawConfig({ config: target.config });
  if (rawConfig.env?.[target.environment]?.vars?.BETTER_AUTH_URL !== origin) throw new Error('Configured auth origin does not match the selected canonical live origin.');
  // Disable Playwright debug streams before importing it: fill() arguments can
  // contain a recovery credential. No test runner, screenshots, traces, video,
  // persistent profile, or storage-state export is used by this script.
  delete process.env.DEBUG;
  delete process.env.PWDEBUG;
  process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
  const { chromium } = await import('@playwright/test');
  const userIds = new Set();
  const suffix = crypto.randomUUID();
  const householdName = `Live guest smoke ${suffix}`;
  const itemName = `Live smoke oats ${suffix}`;
  let browser;
  let step = 'browser launch';
  let checks = 0;
  let guestCreationAttempted = false;
  let cleanupComplete = false;
  const check = (condition, label) => { assert.equal(Boolean(condition), true, label); checks++; };
  const newContext = () => browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, serviceWorkers: 'allow', acceptDownloads: false });
  const mobileNav = page => page.getByRole('navigation', { name: 'Primary mobile navigation' });
  const itemCheckbox = page => page.getByRole('checkbox', { name: `Mark ${itemName} as purchased`, exact: true });
  async function readJson(response) {
    try { return await response.json(); } catch { throw new Error('Expected JSON response.'); }
  }
  async function session(context) {
    const response = await context.request.get('/api/auth/get-session');
    check(response.status() === 200, 'session endpoint responds');
    return readJson(response);
  }
  async function openShopping(page) {
    await mobileNav(page).getByRole('link', { name: 'Shopping', exact: true }).click();
    await page.getByRole('heading', { name: 'Shopping list', exact: true }).waitFor({ state: 'visible' });
  }
  const matchesResponse = (response, path) => new URL(response.url()).origin === origin && new URL(response.url()).pathname === path && response.request().method() === 'POST';
  async function clickForJson(page, path, button, capture = () => {}) {
    const responseTask = page.waitForResponse(response => matchesResponse(response, path)).then(async response => {
      const payload = await readJson(response);
      capture(payload);
      return { response, payload };
    });
    // Settle both promises before fixture cleanup. A click can time out after
    // its request commits, so still capture the created identity in that case.
    const [received, clicked] = await Promise.allSettled([responseTask, button.click()]);
    if (received.status !== 'fulfilled' || clicked.status !== 'fulfilled') throw new Error('UI action or response failed.');
    return received.value;
  }

  try {
    await withD1(target, async db => {
      try {
        browser = await chromium.launch({ headless: true });
        const context = await newContext();
        context.setDefaultTimeout(20_000);
        const page = await context.newPage();
        step = 'guest creation';
        await page.goto('/sign-in/');
        check(!(await context.cookies()).some(cookie => cookie.name.includes('session_token')), 'new browser begins without an account');
        guestCreationAttempted = true;
        // Capture identity before assertions, so a later UI/header failure still
        // permits cleanup of this newly created guest. No existing login is used.
        const { response: created, payload } = await clickForJson(page, '/api/auth/sign-in/anonymous', page.getByRole('button', { name: 'Continue as guest', exact: true }), data => {
          if (data?.user?.isAnonymous === true && validId(data.user.id)) userIds.add(data.user.id);
        });
        check(created.status() === 200 && userIds.size === 1, 'guest account created');
        check(!Object.hasOwn(payload, 'token'), 'guest credential stays in HttpOnly cookie');
        const userId = [...userIds][0];
        const rows = await db.query(`SELECT id FROM "user" WHERE id=${sqlValue(userId)} AND "isAnonymous"=1;`);
        check(rows.flatMap(result => result.results ?? []).length === 1, 'canonical site uses selected D1 database');
        const sessionCookies = (await context.cookies()).filter(cookie => cookie.name.includes('session_token'));
        check(sessionCookies.length === 1 && sessionCookies.every(cookie => cookie.httpOnly && cookie.secure && cookie.expires > Date.now() / 1000), 'guest session is secure and persistent');

        step = 'household creation';
        await page.getByRole('heading', { name: 'Set up your household', exact: true }).waitFor({ state: 'visible' });
        await page.getByRole('textbox', { name: 'Household name', exact: true }).fill(householdName);
        const { response: householdResult, payload: householdPayload } = await clickForJson(page, '/api/households', page.getByRole('button', { name: 'Create household', exact: true }));
        check(householdResult.status() === 201 && validId(householdPayload?.data?.id), 'household created');
        const householdId = householdPayload.data.id;
        step = 'shopping write and reload';
        await openShopping(page);
        await page.getByRole('textbox', { name: 'Shopping item name', exact: true }).fill(itemName);
        await page.getByRole('button', { name: 'Add shopping item', exact: true }).click();
        await itemCheckbox(page).waitFor({ state: 'visible' });
        await page.reload();
        await itemCheckbox(page).waitFor({ state: 'visible' });
        check((await session(context))?.user?.id === userId, 'reload remembers the same guest');

        step = 'three-day prep and food references';
        await page.goto('/prep/');
        await page.getByLabel('First day of this batch').fill('2030-01-07');
        await page.getByLabel('People per meal').selectOption('2');
        await page.getByRole('button', { name: 'Plan three days', exact: true }).first().click();
        await page.getByText('6 meals added. Open Meal Plan to review, then shop these dates.', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Shop selected three days', exact: true }).click();
        await page.getByText(/missing ingredients added for the selected three days/).waitFor();
        const prepSnapshot = await readJson(await context.request.get(`/api/households/${householdId}/snapshot`));
        check(prepSnapshot.meal_plan.length === 6, 'three-day prep creates six meal entries');
        check(prepSnapshot.shopping_items.find(item => item.name === 'Firm tofu')?.quantity === 1200, 'household batch shopping scales to six portions');
        check(prepSnapshot.shopping_items.find(item => item.name === 'Raw garlic')?.quantity === 48, 'shared ingredients aggregate across recipes');
        check(prepSnapshot.shopping_items.find(item => item.name === 'Dry lentils')?.category === 'Cupboard · check stock', 'shopping distinguishes cupboard staples');
        await page.getByRole('button', { name: 'Plan three days', exact: true }).first().click();
        await page.getByText(/These lunch and dinner slots already have meals/).waitFor();
        check((await readJson(await context.request.get(`/api/households/${householdId}/snapshot`))).meal_plan.length === 6, 'repeat planning preserves existing meals');
        await page.goto('/food-guide/');
        await page.getByLabel('Search food references').fill('lentils');
        check(await page.getByRole('heading', { name: 'Dry lentils', exact: true }).isVisible(), 'dry food reference is available');
        check(await page.getByRole('heading', { name: 'Cooked lentils', exact: true }).isVisible(), 'cooked food has its own reference');
        const refs = await readJson(await context.request.get('/api/catalog/ingredients?name=Dry%20lentils'));
        check(refs.data?.source_id === '172420', 'live D1 contains verified USDA record');
        await openShopping(page);

        step = 'recovery code creation';
        await mobileNav(page).getByRole('button', { name: 'More', exact: true }).click();
        await page.getByRole('dialog', { name: 'More and account', exact: true }).getByRole('button', { name: 'Guest recovery code', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Guest recovery code', exact: true });
        await dialog.getByRole('button', { name: 'Create or replace recovery code', exact: true }).click();
        const codeElement = dialog.getByLabel('Recovery code', { exact: true });
        await codeElement.waitFor({ state: 'visible' });
        const code = (await codeElement.textContent())?.trim();
        check(validRecovery(code), 'recovery code has expected format');
        await dialog.getByRole('button', { name: 'I saved my code', exact: true }).click();

        step = 'fresh browser recovery';
        const recoveredContext = await newContext();
        recoveredContext.setDefaultTimeout(20_000);
        const recovered = await recoveredContext.newPage();
        await recovered.goto('/sign-in/');
        check(!(await recoveredContext.cookies()).some(cookie => cookie.name.includes('session_token')), 'recovery browser begins without an account');
        await recovered.getByRole('button', { name: 'Recover a guest account', exact: true }).click();
        await recovered.getByLabel('Guest recovery code', { exact: true }).fill(code);
        await recovered.getByRole('button', { name: 'Recover guest account', exact: true }).click();
        const replacementField = recovered.getByLabel('New guest recovery code', { exact: true });
        await replacementField.waitFor({ state: 'visible' });
        const replacement = await replacementField.inputValue();
        check(validRecovery(replacement) && replacement !== code, 'recovery rotates its credential');
        check(new URL(recovered.url()).pathname === '/sign-in/', 'replacement remains visible until acknowledged');
        await recovered.getByRole('button', { name: "I've saved my recovery code", exact: true }).click();
        await openShopping(recovered);
        await itemCheckbox(recovered).waitFor({ state: 'visible' });
        check((await session(recoveredContext))?.user?.id === userId, 'recovered browser accesses the same account');
        const snapshotResponse = await recoveredContext.request.get(`/api/households/${householdId}/snapshot`);
        check(snapshotResponse.status() === 200, 'recovered account accesses its household');
        const snapshot = await readJson(snapshotResponse);
        check(snapshot.shopping_items?.some(item => item.name === itemName) === true, 'shopping item survived guest recovery');

        step = 'old credential revocation';
        check(await session(context) === null, 'original session is revoked');
        const revoked = await context.request.get(`/api/households/${householdId}/snapshot`);
        check(revoked.status() === 401, 'revoked browser cannot access household data');
        const replayContext = await newContext();
        const replay = await replayContext.request.post('/api/auth/guest/recover', { headers: { Origin: origin }, data: { code } });
        check(replay.status() === 401, 'old recovery code is rejected');
        check(await recovered.evaluate(([oldCode, newCode]) => {
          const stored = JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]);
          return !stored.includes(oldCode) && !stored.includes(newCode);
        }, [code, replacement]), 'recovery credentials are absent from browser web storage');
        console.log(`Live guest UI smoke passed: ${checks} checks on ${target.environment} (guest, prep quantities, food references, shopping, recovery, revocation).`);
      } finally {
        await browser?.close().catch(() => {});
        if (userIds.size) {
          const ids = [...userIds].map(sqlValue).join(',');
          await db.execute(`DELETE FROM households WHERE created_by IN (${ids});\nDELETE FROM "user" WHERE id IN (${ids}) AND "isAnonymous"=1;`);
          const remaining = await db.query(`SELECT id FROM "user" WHERE id IN (${ids});`);
          cleanupComplete = remaining.every(result => !result.results?.length);
          check(cleanupComplete, 'created guest fixtures removed');
          console.log('Removed only the guest account and households created by this smoke check.');
        } else cleanupComplete = !guestCreationAttempted;
      }
    });
  } catch {
    // Browser errors can include fill arguments or DOM. SQL errors can include
    // statements. Never print errors/stacks, credential values, or screenshots.
    console.error(`Live guest smoke failed during ${step}. Fixture cleanup ${cleanupComplete ? 'completed' : 'may be incomplete'}. Error payloads omitted.`);
    process.exitCode = 1;
  }
}

if (isMain(import.meta.url)) main().catch(() => {
  console.error('Live guest smoke could not start. Use --env staging or --env production and verify local browser/configuration prerequisites. Error payloads omitted.');
  process.exitCode = 1;
});
