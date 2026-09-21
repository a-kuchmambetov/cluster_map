import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function validatePublication(run, repository, environment) {
  const branch = { staging: "staging", production: "main" }[environment];
  if (!branch) throw new Error("Invalid deployment environment");
  if (
    run.path !== ".github/workflows/publish.yml" ||
    run.event !== "push" ||
    run.status !== "completed" ||
    run.conclusion !== "success" ||
    run.head_repository?.full_name !== repository ||
    run.head_branch !== branch ||
    !/^[a-f0-9]{40}$/.test(run.head_sha)
  ) {
    throw new Error(
      `Only successful trusted ${branch} Publish runs may deploy to ${environment}`,
    );
  }
  return run.head_sha;
}

async function main() {
  const {
    GH_TOKEN,
    GITHUB_REPOSITORY,
    PUBLISH_RUN_ID,
    TARGET_ENV,
    GITHUB_ENV,
  } = process.env;
  if (!/^\d+$/.test(PUBLISH_RUN_ID))
    throw new Error("Invalid publication run ID");
  async function get(path) {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPOSITORY}/${path}`,
      {
        headers: {
          Authorization: `Bearer ${GH_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    return response.json();
  }
  const run = await get(`actions/runs/${PUBLISH_RUN_ID}`);
  const sha = validatePublication(run, GITHUB_REPOSITORY, TARGET_ENV);
  appendFileSync(GITHUB_ENV, `RELEASE_SHA=${sha}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
