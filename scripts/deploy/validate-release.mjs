/* eslint-disable no-await-in-loop -- Release ordering and bounded polling must be sequential. */
import { appendFileSync } from "node:fs";
const { GH_TOKEN, GITHUB_REPOSITORY, PUBLISH_RUN_ID, TARGET_ENV, GITHUB_ENV } =
  process.env;
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
if (
  run.path !== ".github/workflows/publish.yml" ||
  run.event !== "push" ||
  run.conclusion !== "success" ||
  run.head_repository.full_name !== GITHUB_REPOSITORY ||
  !["main", "dev-cicd-deployment"].includes(run.head_branch)
) {
  throw new Error("Only successful trusted Publish runs may be deployed");
}
if (TARGET_ENV === "production") {
  if (run.head_branch !== "main")
    throw new Error("Production requires a main publication");
  let verified = false;
  for (let page = 1; page <= 10 && !verified; page++) {
    const result = await get(
      `actions/artifacts?name=deployment-staging-${PUBLISH_RUN_ID}&per_page=100&page=${page}`,
    );
    for (const artifact of result.artifacts) {
      if (artifact.expired) continue;
      const deployment = await get(`actions/runs/${artifact.workflow_run.id}`);
      if (
        deployment.path === ".github/workflows/deploy.yml" &&
        deployment.conclusion === "success"
      )
        verified = true;
    }
    if (result.artifacts.length < 100) break;
  }
  if (!verified)
    throw new Error("This publication has no successful staging deployment");
}
appendFileSync(GITHUB_ENV, `RELEASE_SHA=${run.head_sha}\n`);
