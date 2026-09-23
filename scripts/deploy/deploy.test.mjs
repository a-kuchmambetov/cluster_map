import { test } from "node:test";
import assert from "node:assert/strict";
import { imageConfig, deploy } from "./deploy.mjs";
const sha = "a".repeat(40);
const release = {
  sha,
  image: "ghcr.io/a-kuchmambetov/cluster-map-api",
  digest: `sha256:${"b".repeat(64)}`,
};
test("uses Coolify digest syntax", () => {
  assert.equal(
    imageConfig(release, "api", sha).docker_registry_image_tag,
    `sha256-${"b".repeat(64)}`,
  );
});
test("rejects unrelated, mutable, or mismatched artifacts", () => {
  for (const change of [
    { sha: "c".repeat(40) },
    { image: "ghcr.io/other/api" },
    { digest: "latest" },
  ]) {
    assert.throws(() => imageConfig({ ...release, ...change }, "api", sha));
  }
});

// Exercise failure ordering without contacting a deployment service.
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("failed API deployment prevents Web/Docs updates and preserves rollback fields only", async () => {
  const original = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), "cluster-map-deploy-"));
  const calls = [];
  try {
    process.chdir(dir);
    mkdirSync("release");
    for (const app of ["api", "web", "docs"])
      writeFileSync(
        `release/${app}.json`,
        JSON.stringify({
          ...release,
          image: `ghcr.io/a-kuchmambetov/cluster-map-${app}`,
        }),
      );
    const env = {
      COOLIFY_URL: "https://coolify.example",
      COOLIFY_TOKEN: "test",
      RELEASE_SHA: sha,
    };
    for (const app of ["API", "WEB", "DOCS"]) {
      env[`COOLIFY_${app}_UUID`] = app.toLowerCase();
      env[`${app}_URL`] = `https://${app.toLowerCase()}.example`;
    }
    const request = async (url, options) => {
      calls.push([url, options.method]);
      const data = url.includes("/deploy?")
        ? { deployments: [{ deployment_uuid: "job" }] }
        : url.includes("/deployments/")
          ? { status: "failed" }
          : {
              docker_registry_image_name: "previous",
              docker_registry_image_tag: "sha256-old",
              secret: "must-not-be-saved",
            };
      return { ok: true, json: async () => data };
    };
    await assert.rejects(
      deploy({ env, request, sleep: async () => {} }),
      /api deployment failed/,
    );
    assert.equal(calls.filter(([, method]) => method === "PATCH").length, 1);
    assert.ok(
      !readFileSync("release/previous.json", "utf8").includes(
        "must-not-be-saved",
      ),
    );
  } finally {
    process.chdir(original);
    rmSync(dir, { recursive: true });
  }
});

test("first release deploys Web before public API smoke checks", async () => {
  const original = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), "cluster-map-first-release-"));
  const updated = [];
  const configs = {};
  try {
    process.chdir(dir);
    mkdirSync("release");
    const env = {
      COOLIFY_URL: "https://coolify.example",
      COOLIFY_TOKEN: "test",
      RELEASE_SHA: sha,
    };
    for (const app of ["api", "web", "docs"]) {
      writeFileSync(
        `release/${app}.json`,
        JSON.stringify({
          ...release,
          image: `ghcr.io/a-kuchmambetov/cluster-map-${app}`,
        }),
      );
      env[`COOLIFY_${app.toUpperCase()}_UUID`] = app;
      env[`${app.toUpperCase()}_URL`] = "https://map.example";
    }
    const request = async (url, options) => {
      let data = {};
      if (url.startsWith("https://map.example")) {
        assert.deepEqual(updated, ["api", "web", "docs"]);
        data = { status: url.endsWith("ready") ? "ready" : "ok" };
      } else if (url.includes("/applications/")) {
        const app = url.split("/").at(-1);
        if (options.method === "PATCH") {
          configs[app] = JSON.parse(options.body);
          updated.push(app);
        }
        data = { ...configs[app], status: "running:healthy" };
      } else if (url.includes("/deploy?"))
        data = { deployments: [{ deployment_uuid: "job" }] };
      else data = { status: "finished" };
      return { ok: true, status: 200, json: async () => data };
    };
    await deploy({ env, request, sleep: async () => {} });
    assert.equal(
      JSON.parse(readFileSync("release/healthy.json", "utf8")).sha,
      sha,
    );
  } finally {
    process.chdir(original);
    rmSync(dir, { recursive: true });
  }
});
