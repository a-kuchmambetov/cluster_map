/* eslint-disable no-await-in-loop -- Seed inserts follow foreign-key dependencies in a predictable order. */
import dotenv from "dotenv";
import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seeding is disabled in production.");
  }

  const { db, user, userHiveInfo, cluster, row, position } =
    await import("@repo/db");
  try {
    const { listClusterConfigs } =
      await import("../features/clusters/clusters.service.js");
    const configs = listClusterConfigs();
    // Use the same IDs and coordinates as the public map API.
    const isOccupied = (clusterNumber: number, placeIndex: number) =>
      clusterNumber === 3 || (clusterNumber === 1 && placeIndex % 3 === 0);
    const memberCount = configs.reduce(
      (total, config) =>
        total +
        config.rows.reduce(
          (count, currentRow) =>
            count +
            currentRow.cells
              .filter((cell) => cell.kind === "place")
              .filter((_, index) => isOccupied(config.number, index)).length,
          0,
        ),
      0,
    );
    const members: string[] = [];
    const accounts = [
      { login: "demo-admin", role: "admin" as const, approved: true },
      ...Array.from({ length: Math.max(9, memberCount) }, (_, i) => ({
        login: `demo-member-${i + 1}`,
        role: "user" as const,
        approved: true,
      })),
      { login: "demo-pending", role: "user" as const, approved: false },
    ];

    for (const demo of accounts) {
      const email = `${demo.login}@example.test`;
      const [existing] = await db
        .select()
        .from(user)
        .where(eq(user.email, email));
      let id = existing?.id;
      if (!id) {
        // Privileges are assigned only to accounts created by this run.
        id = randomUUID();
        await db.insert(user).values({
          id,
          name: demo.login,
          email,
          emailVerified: false,
          role: demo.approved ? demo.role : "user",
          approved: demo.approved,
          approvalToken: demo.approved ? null : randomBytes(32).toString("hex"),
        });
      }
      await db
        .insert(userHiveInfo)
        .values({
          id,
          login: demo.login,
          cohort: "Demo cohort",
        })
        .onConflictDoNothing({ target: userHiveInfo.id });
      if (demo.login.startsWith("demo-member-")) members.push(id);
    }

    await db.transaction(async (tx) => {
      let memberIndex = 0;
      for (const config of configs) {
        const name = config.id;
        await tx
          .insert(cluster)
          .values({ name })
          .onConflictDoNothing({ target: cluster.name });
        const [parent] = await tx
          .select()
          .from(cluster)
          .where(eq(cluster.name, name));
        for (const { number } of config.rows) {
          await tx
            .insert(row)
            .values({ clusterId: parent.id, number })
            .onConflictDoNothing({ target: [row.clusterId, row.number] });
        }
        const rows = await tx
          .select()
          .from(row)
          .where(eq(row.clusterId, parent.id));
        for (const configuredRow of config.rows) {
          const currentRow = rows.find(
            (r) => r.number === configuredRow.number,
          )!;
          const places = configuredRow.cells.filter(
            (cell) => cell.kind === "place",
          );
          for (const [index, place] of places.entries()) {
            const seatNumber = place.number;
            const occupied = isOccupied(config.number, index);
            await tx
              .insert(position)
              .values({
                rowId: currentRow.id,
                seatNumber,
                occupied,
                holderId: occupied ? members[memberIndex++] : null,
                takenAt: occupied ? new Date("2026-01-15T09:00:00Z") : null,
              })
              .onConflictDoNothing({
                target: [position.rowId, position.seatNumber],
              });
          }
        }
      }
    });
    console.log(
      `Demo seed complete: ${configs.length} configured clusters; c1 mixed, c2 empty, c3 full; existing records preserved.`,
    );
    console.log(
      "Demo accounts have no password and cannot sign in; they only supply map data.",
    );
    console.log(
      `Admin: demo-admin@example.test; members: demo-member-1@example.test through demo-member-${Math.max(9, memberCount)}@example.test`,
    );
    console.log(
      "Pending: demo-pending@example.test (awaiting approval; approve it in /admin/users).",
    );
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
