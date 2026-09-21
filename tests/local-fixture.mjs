import { hashPassword } from "better-auth/crypto";
import { parseTargetArgs, sqlValue, withD1 } from "../scripts/d1-tools.mjs";

/** Synthetic, verified accounts for local browser tests. Never accepts --remote. */
export default async function setup() {
  const flags = process.env.PANTRY_E2E_PERSIST_TO ? ["--persist-to", process.env.PANTRY_E2E_PERSIST_TO] : [];
  const { target } = parseTargetArgs(flags);
  const run = crypto.randomUUID();
  const password = `Local-fixture-${run}`;
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  const households = [];
  const users = [];
  const statements = [];
  for (const name of ["Primary", "Second"]) {
    const userId = crypto.randomUUID();
    const householdId = crypto.randomUUID();
    const email = `${name.toLowerCase()}-${run}@example.test`;
    users.push({ userId, email, householdId, password });
    households.push(householdId);
    statements.push(
      `INSERT INTO "user"(id,name,email,emailVerified,createdAt,updatedAt) VALUES(${sqlValue(userId)},${sqlValue(name)},${sqlValue(email)},1,${sqlValue(now)},${sqlValue(now)});`,
      `INSERT INTO account(id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES(${sqlValue(crypto.randomUUID())},${sqlValue(userId)},'credential',${sqlValue(userId)},${sqlValue(passwordHash)},${sqlValue(now)},${sqlValue(now)});`,
      `INSERT INTO households(id,name,created_by) VALUES(${sqlValue(householdId)},${sqlValue(`${name} Test Household`)},${sqlValue(userId)});`,
      `INSERT INTO household_members(household_id,user_id,role) VALUES(${sqlValue(householdId)},${sqlValue(userId)},'owner');`,
      `INSERT INTO shopping_items(id,household_id,name,quantity,unit,category,created_by) VALUES(${sqlValue(crypto.randomUUID())},${sqlValue(householdId)},${sqlValue(`${name} test apples`)},3,'pcs','Fruit',${sqlValue(userId)});`,
    );
  }
  await withD1(target, async (d1) => {
    await d1.migrate("auth");
    await d1.migrate("d1");
    await d1.execute(statements.join("\n"));
  });
  process.env.PANTRY_E2E_FIXTURE = JSON.stringify(users);
  process.env.PANTRY_E2E_GUEST_HOUSEHOLD = `Guest Browser Test ${run}`;
  return async () => {
    await withD1(target, async (d1) => {
      const guests = await d1.execute(`SELECT id,created_by FROM households WHERE name=${sqlValue(process.env.PANTRY_E2E_GUEST_HOUSEHOLD)};`);
      const guestHomes = guests.flatMap(result => result.results ?? []);
      await d1.execute([
        ...[...households, ...guestHomes.map(home => home.id)].map(id => `DELETE FROM households WHERE id=${sqlValue(id)};`),
        ...guestHomes.map(home => `DELETE FROM "user" WHERE id=${sqlValue(home.created_by)};`),
        ...users.map(({ userId }) => `DELETE FROM "user" WHERE id=${sqlValue(userId)};`),
      ].join("\n"));
    });
  };
}
