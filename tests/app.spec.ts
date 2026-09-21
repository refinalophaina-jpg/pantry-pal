import { expect, test, type Page } from "@playwright/test";

type Fixture = { userId: string; email: string; householdId: string; password: string };
function fixture(index = 0): Fixture { return JSON.parse(process.env.PANTRY_E2E_FIXTURE!)[index]; }

test.afterEach(async ({ context }) => {
  await Promise.all(context.pages().map(page => page.goto("about:blank", { timeout: 3_000 }).catch(() => {})));
});

async function signIn(page: Page, index = 0) {
  const user = fixture(index);
  await page.goto("/sign-in/");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Primary mobile navigation" })).toBeVisible();
  await page.getByRole("navigation", { name: "Primary mobile navigation" }).getByRole("link", { name: "Shopping", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Shopping list", exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: `Mark ${index ? "Second" : "Primary"} test apples as purchased` })).toBeVisible();
}

async function readSaved(page: Page) {
  return page.evaluate(async () => {
    return new Promise<Record<string, unknown> | null>((resolve, reject) => {
      const request = indexedDB.open("pantry-shopping-offline", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("snapshots")) { db.close(); resolve(null); return; }
        const tx = db.transaction("snapshots");
        const get = tx.objectStore("snapshots").get("current");
        get.onsuccess = () => resolve(get.result ?? null);
        get.onerror = () => reject(get.error);
        tx.oncomplete = () => db.close();
      };
    });
  });
}

test("mobile navigation and native dialogs remain usable at narrow and tablet sizes", async ({ page }) => {
  await signIn(page);
  const nav = page.getByRole("navigation", { name: "Primary mobile navigation" });
  await expect(nav.getByRole("link")).toHaveCount(4);
  const more = nav.getByRole("button", { name: "More", exact: true });
  await more.click();
  const dialog = page.getByRole("dialog", { name: "More and account" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("navigation", { name: "More destinations" }).getByRole("link")).toHaveCount(5);
  await expect(dialog.getByRole("button", { name: "Invite partner" })).toBeVisible();
  const close = dialog.getByRole("button", { name: "Close More and account" });
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Sign out", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(more).toBeFocused();

  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 820, height: 1180 }]) {
    await page.setViewportSize(size);
    await more.click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `horizontal overflow at ${size.width}px`).toBe(false);
    await dialog.getByRole("button", { name: "Invite partner" }).click();
    const invite = page.getByRole("dialog", { name: "Invite to household" });
    await expect(invite).toBeVisible();
    await expect(invite.getByRole("button", { name: "Generate invite code" })).toBeInViewport();
    await invite.getByRole("button", { name: "Close Invite to household" }).click();
  }
  await page.setViewportSize({ width: 1180, height: 820 });
  await expect(nav).toBeHidden();
  await page.getByRole("button", { name: "Invite partner", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Invite to household" })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("shopping writes, checked state, and atomic move reach the Worker and persist", async ({ page }) => {
  await signIn(page);
  const itemName = `Browser test oats ${Date.now()}`;
  await page.getByRole("textbox", { name: "Shopping item name" }).fill(itemName);
  await page.getByRole("spinbutton", { name: "Shopping quantity" }).fill("500");
  await page.getByRole("combobox", { name: "Shopping unit" }).selectOption("g");
  await page.getByRole("spinbutton", { name: "Shopping quantity" }).blur();
  const created = page.waitForResponse(response => new URL(response.url()).pathname === `/api/households/${fixture().householdId}/shopping` && response.request().method() === "POST");
  await page.getByRole("button", { name: "Add shopping item" }).click();
  const createResponse = await created;
  const createResult = await createResponse.json();
  expect({ status: createResponse.status(), error: createResult.error?.code ?? null }).toEqual({ status: 201, error: null });
  expect(createResponse.headers()["cache-control"]).toContain("no-store");
  expect(createResult.data).toMatchObject({ name: itemName, quantity: 500, unit: "g" });
  const checkbox = page.getByRole("checkbox", { name: `Mark ${itemName} as purchased` });
  await expect(checkbox).toBeVisible();
  // Controlled state changes only after the authenticated API confirms the write.
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await page.reload();
  await expect(checkbox).toBeChecked();
  const row = page.getByRole("listitem").filter({ has: checkbox });
  await row.getByRole("button", { name: "Got it — move to pantry" }).click();
  await expect(checkbox).toHaveCount(0);
  const response = await page.request.get(`/api/households/${fixture().householdId}/snapshot`);
  expect(response.ok()).toBe(true);
  const snapshot = await response.json();
  expect(snapshot.pantry_items.filter((item: { name: string }) => item.name === itemName)).toMatchObject([{ quantity: 500, unit: "g" }]);
  expect(snapshot.shopping_items.some((item: { name: string }) => item.name === itemName)).toBe(false);
});

test("service worker serves a real persisted read-only shopping snapshot offline", async ({ page, context }) => {
  await signIn(page);
  await expect.poll(async () => (await readSaved(page))?.householdId).toBe(fixture().householdId);
  const saved = await readSaved(page);
  expect(Object.keys(saved ?? {}).sort()).toEqual(["fetchedAt", "householdId", "householdName", "items", "schemaVersion", "userId"]);
  const items = saved!.items as Record<string, unknown>[];
  expect(Object.keys(items[0]).sort()).toEqual(["category", "done", "id", "name", "quantity", "unit"]);
  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.active?.state ?? registration?.installing?.state ?? registration?.waiting?.state ?? "not registered";
  }), { message: "The production service worker must finish its asset installation", timeout: 20_000 }).toBe("activated");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const cached = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (key) => (await (await caches.open(key)).keys()).map(request => new URL(request.url).pathname)))).flat());
  expect(cached).toContain("/offline-shopping/");
  expect(cached.some(path => path.startsWith("/api/"))).toBe(false);

  await context.setOffline(true);
  await page.goto("/offline-shopping/");
  await expect(page.getByRole("heading", { name: "Saved shopping list" })).toBeVisible();
  await expect(page.getByText("Primary test apples", { exact: true })).toBeVisible();
  await expect(page.getByText(/Read-only list saved on this device/)).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Primary test apples", { exact: true })).toBeVisible();
  await page.goto("/pantry/");
  await expect(page.getByRole("heading", { name: "You’re offline" })).toBeVisible();
  await page.getByRole("link", { name: "Open saved shopping list" }).click();
  await expect(page.getByText("Primary test apples", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear saved list" }).click();
  await expect(page.getByText(/No recent list is saved/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/No recent list is saved/)).toBeVisible();
});

test("sign-out purges the saved list in another open tab and account changes isolate households", async ({ page, context }) => {
  await signIn(page);
  await expect.poll(async () => (await readSaved(page))?.userId).toBe(fixture().userId);
  const savedPage = await context.newPage();
  await savedPage.goto("/offline-shopping/");
  await expect(savedPage.getByText("Primary test apples", { exact: true })).toBeVisible();
  await page.getByRole("navigation", { name: "Primary mobile navigation" }).getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("dialog", { name: "More and account" }).getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(savedPage.getByText(/No recent list is saved/)).toBeVisible();
  expect(await readSaved(savedPage)).toBeNull();
  await signIn(page, 1);
  await expect(page.getByRole("checkbox", { name: "Mark Primary test apples as purchased" })).toHaveCount(0);
  await expect.poll(async () => (await readSaved(page))?.userId).toBe(fixture(1).userId);
  await savedPage.reload();
  await expect(savedPage.getByText("Second test apples", { exact: true })).toBeVisible();
  await expect(savedPage.getByText("Primary test apples", { exact: true })).toHaveCount(0);
});

test("a remembered guest pantry can be recovered in a fresh browser with a replacement code", async ({ page, browser }, testInfo) => {
  await page.goto("/sign-in/");
  await page.getByRole("button", { name: "Continue as guest", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Set up your household" })).toBeVisible();
  await page.getByRole("textbox", { name: "Household name" }).fill(process.env.PANTRY_E2E_GUEST_HOUSEHOLD!);
  await page.getByRole("button", { name: "Create household", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Primary mobile navigation" });
  await nav.getByRole("link", { name: "Shopping", exact: true }).click();
  await page.getByRole("textbox", { name: "Shopping item name" }).fill("Guest test rice");
  await page.getByRole("button", { name: "Add shopping item" }).click();
  await expect(page.getByRole("checkbox", { name: "Mark Guest test rice as purchased" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Mark Guest test rice as purchased" })).toBeVisible();
  const initial = await (await page.request.get("/api/auth/get-session")).json();
  expect(initial.user.isAnonymous).toBe(true);
  await nav.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Guest recovery code", exact: true }).click();
  await page.getByRole("button", { name: "Create or replace recovery code" }).click();
  const codeElement = page.getByLabel("Recovery code", { exact: true });
  await expect(codeElement).toBeVisible();
  const code = (await codeElement.textContent())!;
  expect(code.length).toBeGreaterThan(30);
  await page.getByRole("button", { name: "I saved my code" }).click();

  const recoveredContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: { width: 390, height: 844 } });
  try {
    const recovered = await recoveredContext.newPage();
    await recovered.goto("/sign-in/");
    await recovered.getByRole("button", { name: "Recover a guest account", exact: true }).click();
    await recovered.getByLabel("Guest recovery code", { exact: true }).fill(code);
    await recovered.getByRole("button", { name: "Recover guest account", exact: true }).click();
    const replacementField = recovered.getByLabel("New guest recovery code", { exact: true });
    await expect(replacementField).toBeVisible();
    const replacement = await replacementField.inputValue();
    expect(replacement !== code).toBe(true);
    expect(replacement.length).toBeGreaterThan(30);
    await expect(recovered).toHaveURL(/\/sign-in\//);
    await recovered.getByRole("button", { name: "I've saved my recovery code", exact: true }).click();
    await recovered.getByRole("navigation", { name: "Primary mobile navigation" }).getByRole("link", { name: "Shopping", exact: true }).click();
    await expect(recovered.getByRole("checkbox", { name: "Mark Guest test rice as purchased" })).toBeVisible();
    const current = await (await recovered.request.get("/api/auth/get-session")).json();
    expect(current.user.id).toBe(initial.user.id);
    expect(Boolean(await (await page.request.get("/api/auth/get-session")).json())).toBe(false);
    const browserStorage = await recovered.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]));
    expect(browserStorage.includes(code) || browserStorage.includes(replacement)).toBe(false);
    const replay = await recovered.request.post("/api/auth/guest/recover", { headers: { Origin: new URL(testInfo.project.use.baseURL!).origin }, data: { code } });
    expect(replay.ok()).toBe(false);
  } finally {
    await Promise.all(recoveredContext.pages().map(page => page.goto("about:blank", { timeout: 3_000 }).catch(() => {})));
    await recoveredContext.close();
  }
});

test('three-day prep scales shopping, preserves slots, and opens useful meal details', async ({ page }) => {
  await signIn(page);
  await page.goto('/prep/');
  await expect(page.getByRole('heading',{name:'Three-day prep',exact:true})).toBeVisible();
  if (process.env.PANTRY_CAPTURE_CONTENT === '1') {
    await page.screenshot({path:'/private/tmp/pantry-prep-mobile.png',fullPage:true,animations:'disabled',scale:'css'});
    await page.setViewportSize({width:1440,height:1000});
    await page.screenshot({path:'/private/tmp/pantry-prep-desktop.png',fullPage:true,animations:'disabled',scale:'css'});
    await page.setViewportSize({width:390,height:844});
  }
  await page.getByLabel('First day of this batch').fill('2027-03-15');
  await page.getByLabel('People per meal').selectOption('2');
  await page.getByRole('button').filter({hasText:'Indian-inspired lentil & spinach dal'}).click();
  const batchDetail=page.getByRole('dialog',{name:'Indian-inspired lentil & spinach dal',exact:true});
  await expect(batchDetail.getByRole('listitem').filter({hasText:'Dry lentils'}).getByText('480 g',{exact:true})).toBeVisible();
  await expect(batchDetail.getByText(/Full three-day batch: 6 portions for 2 people/)).toBeVisible();
  await batchDetail.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Plan three days',exact:true}).first().click();
  await expect(page.getByText('6 meals added. Open Meal Plan to review, then shop these dates.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Plan three days',exact:true}).first().click();
  await expect(page.getByText(/These lunch and dinner slots already have meals/)).toBeVisible();
  const snapshot = async () => (await (await page.request.get(`/api/households/${fixture().householdId}/snapshot`)).json());
  let data = await snapshot();
  expect(data.meal_plan.filter((e:{date:string})=>e.date.startsWith('2027-03-1'))).toHaveLength(6);
  await page.getByRole('button',{name:'Shop selected three days'}).click();
  await expect(page.getByText(/missing ingredients added for the selected three days/)).toBeVisible();
  data = await snapshot();
  // Original recipe: 600g tofu for three portions. Two people × three days = 1200g.
  expect(data.shopping_items.find((i:{name:string})=>i.name==='Firm tofu')).toMatchObject({quantity:1200,unit:'g',category:'Fresh · this prep'});
  expect(data.shopping_items.find((i:{name:string})=>i.name==='Dry lentils')).toMatchObject({quantity:480,unit:'g',category:'Cupboard · check stock'});
  // Both dishes use garlic. It must be aggregated before subtracting existing stock.
  expect(data.shopping_items.find((i:{name:string})=>i.name==='Raw garlic')).toMatchObject({quantity:48,unit:'g'});
  await page.getByRole('button',{name:'Shop selected three days'}).click();
  await expect(page.getByText(/No missing ingredients to add/)).toBeVisible();
  expect((await snapshot()).shopping_items.filter((i:{name:string})=>i.name==='Firm tofu')).toHaveLength(1);
  // Put one of these saved recipes in the current week to exercise calendar detail actions.
  const saved=data.saved_recipes.find((r:{external_id:string})=>r.external_id==='prep-thai-basil-tofu-2p');
  const today = new Date().toLocaleDateString('en-CA');
  const added=await page.request.post(`/api/households/${fixture().householdId}/meal-plan`,{headers:{Origin:new URL(page.url()).origin},data:{date:today,meal:'dinner',recipe_id:`saved-${saved.id}`,recipe_name:saved.name}});
  expect(added.ok()).toBe(true);
  await page.goto('/meal-plan/');
  await page.getByRole('button',{name:`Open recipe: ${saved.name}`,exact:true}).click();
  const detail=page.getByRole('dialog',{name:saved.name,exact:true});
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('button',{name:'Add missing to list'})).toBeVisible();
  await expect(detail.getByRole('button',{name:'Cook now'})).toBeVisible();
  await detail.getByRole('link',{name:'Open shopping list'}).click();
  await expect(page.getByRole('heading',{name:'Shopping list',exact:true})).toBeVisible();
  await page.goto('/food-guide/');
  await page.getByLabel('Search food references').fill('lentils');
  await expect(page.getByRole('heading',{name:'Dry lentils',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Cooked lentils',exact:true})).toBeVisible();
  for (const width of [320,390,820,1440]) { await page.setViewportSize({width,height:900}); expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false); }
});
