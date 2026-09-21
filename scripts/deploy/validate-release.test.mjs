import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePublication } from "./validate-release.mjs";

const repository = "a-kuchmambetov/cluster_map";
const run = {
  path: ".github/workflows/publish.yml",
  event: "push",
  status: "completed",
  conclusion: "success",
  head_repository: { full_name: repository },
  head_branch: "staging",
  head_sha: "a".repeat(40),
};

test("routes each release branch only to its own environment", () => {
  assert.equal(validatePublication(run, repository, "staging"), run.head_sha);
  const production = { ...run, head_branch: "main" };
  assert.equal(
    validatePublication(production, repository, "production"),
    run.head_sha,
  );
  assert.throws(() => validatePublication(run, repository, "production"));
  assert.throws(() => validatePublication(production, repository, "staging"));
  assert.throws(() => validatePublication(run, repository, "unknown"));
});

test("rejects failed, untrusted, incomplete, and malformed publications", () => {
  for (const change of [
    { path: ".github/workflows/ci.yml" },
    { event: "pull_request" },
    { status: "in_progress" },
    { conclusion: "failure" },
    { head_repository: { full_name: "other/repository" } },
    { head_repository: null },
    { head_branch: "dev-cicd-deployment" },
    { head_sha: "invalid\nINJECTED=value" },
  ]) {
    assert.throws(() =>
      validatePublication({ ...run, ...change }, repository, "staging"),
    );
  }
});
