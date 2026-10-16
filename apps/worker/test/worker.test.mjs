import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { spawnSync } from "node:child_process";

mock.module("dotenv", { defaultExport: { config() {} } });

const originalEnv = { ...process.env };

test("blank optional admin email allows migrations without admin promotion", async () => {
  try {
    process.env.ADMIN_EMAIL = "";
    const { env } = await import("../dist/env.js?blank");
    assert.equal(env.ADMIN_EMAIL, undefined);
    process.env.ADMIN_EMAIL = "not-an-email";
    await assert.rejects(import("../dist/env.js?invalid"), /ADMIN_EMAIL/);
  } finally {
    process.env = { ...originalEnv };
  }
});

test("email normalization and promotion outcomes", async () => {
  try {
    process.env.ADMIN_EMAIL = "Admin@Example.com";
    const { env } = await import("../dist/env.js");
    assert.equal(env.ADMIN_EMAIL, "admin@example.com");
    let existing = { id: "existing-id", role: "admin", approved: true };
    const updates = [];
    const selection = {
      from() {
        return this;
      },
      where(condition) {
        assert.equal(condition, "admin@example.com");
        return this;
      },
      async limit() {
        return existing ? [existing] : [];
      },
    };
    const update = {
      set(values) {
        this.values = values;
        return this;
      },
      where(condition) {
        updates.push({ values: this.values, condition });
        return this;
      },
    };
    mock.module("@repo/db", {
      namedExports: {
        db: { select: () => selection, update: () => update },
        eq: (_column, value) => value,
        user: { id: "id", email: "email" },
      },
    });
    const { promoteAdminIfRequested } = await import("../dist/admin.js");
    await promoteAdminIfRequested();
    assert.equal(updates.length, 0);
    existing = { id: "existing-id", role: "user", approved: false };
    await promoteAdminIfRequested();
    assert.deepEqual(updates, [
      {
        values: { role: "admin", approved: true, approvalToken: null },
        condition: "existing-id",
      },
    ]);
    existing = undefined;
    await promoteAdminIfRequested();
    assert.equal(updates.length, 1);
  } finally {
    process.env = { ...originalEnv };
  }
});

test("stalled probes are destroyed and stalled shutdown exits with failure", () => {
  const index = new URL("../dist/index.js", import.meta.url).href;
  const env = new URL("../dist/env.js", import.meta.url).href;
  const admin = new URL("../dist/admin.js", import.meta.url).href;
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--input-type=module",
      "-e",
      `
    import { mock } from 'node:test';
    const schedule = globalThis.setTimeout;
    globalThis.setTimeout = (fn, ms, ...args) => schedule(fn, 1, ...args);
    mock.module('dotenv', { defaultExport: { config() {} } });
    mock.module(${JSON.stringify(env)}, { namedExports: { env: {} } });
    mock.module(${JSON.stringify(admin)}, { namedExports: { promoteAdminIfRequested() {} } });
    mock.module('@repo/db', { namedExports: {
      migrate() { throw new Error('Unexpected migration'); },
      db: { $client: {
        options: {},
        async connect() { return {
          query() { return new Promise(() => {}); },
          release(destroy) { if (destroy) console.log('probe destroyed'); },
        }; },
        end() { return new Promise(() => {}); },
      } },
    } });
    await import(${JSON.stringify(index)});
  `,
    ],
    { cwd: new URL("..", import.meta.url), encoding: "utf8", timeout: 10000 },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.equal((result.stdout.match(/probe destroyed/g) ?? []).length, 30);
  assert.match(result.stderr, /Database did not become reachable/);
  assert.match(result.stderr, /Database shutdown timed out/);
});
