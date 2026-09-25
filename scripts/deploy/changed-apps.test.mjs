import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { detectChangedApps, selectApps } from "./changed-apps.mjs";

const all = ["api", "web", "docs", "worker", "simulator"];
const production = ["api", "web", "docs", "worker"];

test("selects individual apps and combines changes without duplicates", () => {
  for (const app of all) {
    assert.deepEqual(selectApps([`apps/${app}/Dockerfile`]), [app]);
  }
  assert.deepEqual(
    selectApps([
      "apps/worker/src/index.ts",
      "apps/api/src/index.ts",
      "apps/api/src/another.ts",
    ]),
    ["api", "worker"],
  );
  assert.deepEqual(selectApps(["README.md", "contracts/api.md"]), []);
  assert.deepEqual(selectApps([]), []);
});

test("shared dependencies and build configuration rebuild every app", () => {
  for (const path of [
    "packages/db/src/index.ts",
    "patches/dependency.patch",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
    ".dockerignore",
    ".npmrc",
    ".pnpmfile.cjs",
    ".github/workflows/staging.yml",
    ".github/workflows/main.yml",
    "scripts/deploy/changed-apps.mjs",
    ...all.map((app) => `apps/${app}/package.json`),
  ]) {
    assert.deepEqual(selectApps([path]), all, path);
  }
});

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "staging-changes-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  git("init", "--quiet");
  git("config", "user.name", "Workflow Test");
  git("config", "user.email", "workflow@example.test");
  const commit = (path, contents) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), contents);
    git("add", "--all");
    git("commit", "--quiet", "-m", "test change");
    return git("rev-parse", "HEAD");
  };
  const baseline = commit("apps/api/src/original.ts", "baseline");
  const outputs = {};
  const warnings = [];
  const requests = [];
  const runs = [
    {
      id: 1,
      head_sha: baseline,
      head_branch: "staging",
      conclusion: "success",
      event: "push",
      updated_at: "2026-09-23T10:00:00Z",
    },
  ];
  const params = {
    context: {
      repo: { owner: "example", repo: "cluster_map" },
      runId: 10,
      eventName: "push",
      sha: baseline,
    },
    core: {
      info() {},
      warning(message) {
        warnings.push(message);
      },
      setOutput(key, value) {
        outputs[key] = value;
      },
    },
    github: {
      rest: { actions: { listWorkflowRuns: "listWorkflowRuns" } },
      async paginate(_method, options) {
        requests.push(options);
        return runs;
      },
    },
  };
  return { cwd, git, commit, params, outputs, warnings, requests, runs };
}

test("includes changes from intervening failed runs and skips unrelated files", async (t) => {
  const f = fixture(t);
  f.commit("apps/worker/src/index.ts", "change from a failed run");
  f.commit("apps/web/src/index.ts", "new change");
  f.params.context.sha = f.commit("README.md", "documentation");
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), ["web", "worker"]);
  assert.equal(f.outputs.apps, '["web","worker"]');
  assert.equal(f.outputs.has_changes, "true");
  assert.equal(f.requests[0].status, "success");
  assert.equal(f.requests[0].branch, "staging");
  assert.equal(f.requests[0].workflow_id, "staging.yml");
});

test("unrelated changes produce an empty matrix and skip signal", async (t) => {
  const f = fixture(t);
  f.params.context.sha = f.commit("README.md", "documentation");
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), []);
  assert.equal(f.outputs.apps, "[]");
  assert.equal(f.outputs.has_changes, "false");
});

test("renames between apps rebuild both the source and destination", async (t) => {
  const f = fixture(t);
  mkdirSync(join(f.cwd, "apps/worker/src"), { recursive: true });
  f.git("mv", "apps/api/src/original.ts", "apps/worker/src/renamed.ts");
  f.params.context.sha = f.commit("README.md", "rename");
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), ["api", "worker"]);
});

test("manual runs build every app without looking up history", async (t) => {
  const f = fixture(t);
  f.params.context.eventName = "workflow_dispatch";
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), all);
  assert.equal(f.requests.length, 0);
});

test("first run, unavailable history, and API errors safely rebuild everything", async (t) => {
  const f = fixture(t);
  f.runs[0].head_sha = "0".repeat(40);
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), all);
  assert.equal(f.warnings.length, 1);
  f.runs.length = 0;
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), all);
  f.params.github.paginate = async () => {
    throw new Error("API unavailable");
  };
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), all);
  assert.equal(f.warnings.length, 2);
});

test("chooses the most recently completed success, including manual rebuilds", async (t) => {
  const f = fixture(t);
  const newer = f.commit("apps/worker/src/index.ts", "already published");
  f.runs.push({
    ...f.runs[0],
    id: 2,
    head_sha: newer,
    event: "workflow_dispatch",
    updated_at: "2026-09-23T11:00:00Z",
  });
  f.params.context.sha = f.commit("apps/docs/docs/guide.mdx", "new docs");
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), ["docs"]);
});

test("main compares against its own successful run, ignoring staging history", async (t) => {
  const f = fixture(t);
  f.params.branch = "main";
  f.params.workflow = "main.yml";
  f.runs[0].head_branch = "main";
  const stagingSha = f.commit("apps/api/src/original.ts", "new API");
  f.runs.push({
    ...f.runs[0],
    id: 2,
    head_branch: "staging",
    head_sha: stagingSha,
    updated_at: "2026-09-23T11:00:00Z",
  });
  f.params.context.sha = f.commit("apps/web/src/index.ts", "new web");
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), ["api", "web"]);
  assert.equal(f.requests[0].branch, "main");
  assert.equal(f.requests[0].workflow_id, "main.yml");
});

test("main builds production apps on its first run even when staging has succeeded", async (t) => {
  const f = fixture(t);
  f.params.branch = "main";
  f.params.workflow = "main.yml";
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), production);
  assert.equal(f.outputs.has_changes, "true");
});

test("manual main runs rebuild only production apps", async (t) => {
  const f = fixture(t);
  f.params.branch = "main";
  f.params.workflow = "main.yml";
  f.params.context.eventName = "workflow_dispatch";
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), production);
  assert.equal(f.requests.length, 0);
});

test("simulator-only changes deploy on staging and skip main", async (t) => {
  const f = fixture(t);
  f.params.context.sha = f.commit(
    "apps/simulator/src/index.ts",
    "simulator change",
  );
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), ["simulator"]);
  f.params.branch = "main";
  f.params.workflow = "main.yml";
  f.runs[0].head_branch = "main";
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), []);
  assert.equal(f.outputs.apps, "[]");
  assert.equal(f.outputs.has_changes, "false");
});

test("main excludes simulator from shared changes and detection fallbacks", async (t) => {
  const f = fixture(t);
  f.params.branch = "main";
  f.params.workflow = "main.yml";
  f.runs[0].head_branch = "main";
  f.params.context.sha = f.commit("packages/db/src/index.ts", "shared change");
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), production);
  assert.deepEqual(JSON.parse(f.outputs.apps), production);
  f.runs[0].head_sha = "0".repeat(40);
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), production);
  f.params.github.paginate = async () => {
    throw new Error("API unavailable");
  };
  assert.deepEqual(await detectChangedApps(f.params, f.cwd), production);
  assert.equal(f.warnings.length, 2);
});
