import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { spawnSync } from "node:child_process";

mock.module("dotenv", { defaultExport: { config() {} } });

const keys = [
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
];
const originalEnv = { ...process.env };

test("blank optional credentials allow migrations without admin provisioning", async () => {
  try {
    for (const key of keys) process.env[key] = "";
    const { env } = await import("../dist/env.js?blank");
    for (const key of keys) assert.equal(env[key], undefined);
    process.env.ADMIN_EMAIL = "admin@example.com";
    await assert.rejects(import("../dist/env.js?incomplete"), /ADMIN_PASSWORD/);
  } finally {
    process.env = { ...originalEnv };
  }
});

test("email normalization and provisioning outcomes", async () => {
  try {
    Object.assign(process.env, {
      ADMIN_EMAIL: "Admin@Example.com",
      ADMIN_PASSWORD: "test-password",
      BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters",
      BETTER_AUTH_URL: "http://localhost:5001",
    });
    const { env } = await import("../dist/env.js");
    assert.equal(env.ADMIN_EMAIL, "admin@example.com");
    let existing = { role: "admin", approved: true };
    let updated = [];
    let signups = 0;
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
      set() {
        return this;
      },
      where() {
        return this;
      },
      async returning() {
        return updated;
      },
    };
    mock.module("@repo/db", {
      namedExports: {
        db: { select: () => selection, update: () => update },
        eq: (_column, value) => value,
        user: { id: "id", email: "email" },
        session: {},
        account: {},
        verification: {},
      },
    });
    mock.module("@better-auth/drizzle-adapter", {
      namedExports: { drizzleAdapter: () => ({}) },
    });
    mock.module("better-auth", {
      namedExports: {
        betterAuth: () => ({
          api: {
            async signUpEmail() {
              signups++;
              return { user: { id: "created-id" } };
            },
          },
        }),
      },
    });
    const { createAdminIfRequested } = await import("../dist/admin.js");
    await createAdminIfRequested();
    assert.equal(signups, 0);
    existing = { role: "user", approved: false };
    await assert.rejects(createAdminIfRequested(), /not an approved admin/);
    assert.equal(signups, 0);
    existing = undefined;
    await assert.rejects(createAdminIfRequested(), /could not be provisioned/);
    updated = [{ id: "created-id" }];
    await createAdminIfRequested();
    assert.equal(signups, 2);
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
    mock.module(${JSON.stringify(admin)}, { namedExports: { createAdminIfRequested() {} } });
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
