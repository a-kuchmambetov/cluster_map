import { randomUUID } from "node:crypto";
import { db, eq, user, userHiveInfo } from "@repo/db";
import { generateName } from "./names.js";

const LOGIN_PREFIX = "sim-member-";
const EMAIL_DOMAIN = "example.test";

function formatLogin(index: number): string {
  return `${LOGIN_PREFIX}${String(index).padStart(3, "0")}`;
}

export async function ensureSimulatorIdentities(
  targetCount: number,
): Promise<string[]> {
  const allSimulatorRows = await db
    .select({ id: user.id, email: user.email, login: userHiveInfo.login })
    .from(user)
    .innerJoin(userHiveInfo, eq(user.id, userHiveInfo.id));

  const simulatorEmailPattern = new RegExp(
    `^${LOGIN_PREFIX}\\d{3}@${EMAIL_DOMAIN}$`,
  );
  const existing = allSimulatorRows
    .filter(
      (row) =>
        simulatorEmailPattern.test(row.email) &&
        row.login.startsWith(LOGIN_PREFIX),
    )
    .toSorted((a, b) => a.login.localeCompare(b.login));

  const ids = existing.slice(0, targetCount).map((row) => row.id);
  const needed = Math.max(0, targetCount - ids.length);
  let index = existing.length;
  let created = 0;

  /* eslint-disable no-await-in-loop -- Identity creation is intentionally sequential:
     each iteration needs the next unused index and must react to unique conflicts. */
  while (created < needed) {
    index += 1;
    const login = formatLogin(index);
    const email = `${login}@${EMAIL_DOMAIN}`;

    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    const [existingHive] = await db
      .select({ id: userHiveInfo.id })
      .from(userHiveInfo)
      .where(eq(userHiveInfo.login, login))
      .limit(1);

    if (existingUser || existingHive) {
      continue;
    }

    const id = randomUUID();
    const name = generateName();

    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id,
        name,
        email,
        emailVerified: false,
        role: "user",
        approved: true,
      });
      await tx.insert(userHiveInfo).values({
        id,
        login,
        cohort: "Simulator cohort",
      });
    });

    ids.push(id);
    created += 1;
  }
  /* eslint-enable no-await-in-loop */

  return ids;
}
