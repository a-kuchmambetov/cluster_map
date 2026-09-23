import { execFileSync } from "node:child_process";

const apps = ["api", "web", "docs", "worker"];
const sharedFiles = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.base.json",
  ".dockerignore",
  ".npmrc",
  ".pnpmfile.cjs",
  ".github/workflows/staging.yml",
  ".github/workflows/main.yml",
]);

export function selectApps(paths) {
  if (
    paths.some(
      (path) =>
        sharedFiles.has(path) ||
        path.startsWith("packages/") ||
        path.startsWith("patches/") ||
        path.startsWith("scripts/deploy/") ||
        // Several Dockerfiles copy other apps' manifests during installation.
        /^apps\/[^/]+\/package\.json$/.test(path),
    )
  ) {
    return [...apps];
  }
  return apps.filter((app) =>
    paths.some((path) => path.startsWith(`apps/${app}/`)),
  );
}

export async function detectChangedApps(
  { github, context, core, branch = "staging", workflow = "staging.yml" },
  cwd = process.cwd(),
) {
  let selected = [...apps];
  if (context.eventName !== "workflow_dispatch") {
    try {
      const runs = await github.paginate(github.rest.actions.listWorkflowRuns, {
        ...context.repo,
        workflow_id: workflow,
        branch,
        status: "success",
        per_page: 100,
      });
      const baseline = runs
        .filter(
          (run) =>
            run.id !== context.runId &&
            run.head_branch === branch &&
            run.conclusion === "success" &&
            ["push", "workflow_dispatch"].includes(run.event),
        )
        .toSorted((a, b) => b.updated_at.localeCompare(a.updated_at))[0];

      if (baseline) {
        const git = (args) =>
          execFileSync("git", args, {
            cwd,
            encoding: "utf8",
            maxBuffer: 10 * 1024 * 1024,
            stdio: ["ignore", "pipe", "pipe"],
          });
        // Rewritten or missing history requires a full rebuild.
        git(["merge-base", "--is-ancestor", baseline.head_sha, context.sha]);
        const paths = git([
          "diff",
          "--name-only",
          "--no-renames",
          "-z",
          baseline.head_sha,
          context.sha,
          "--",
        ])
          .split("\0")
          .filter(Boolean);
        selected = selectApps(paths);
        core.info(`Comparing ${baseline.head_sha} to ${context.sha}`);
      } else {
        core.info(`No successful ${branch} run found; building all apps.`);
      }
    } catch (error) {
      core.warning(
        `Cannot determine changed apps; building all: ${error.message}`,
      );
    }
  }

  core.info(`Images to build: ${selected.join(", ") || "none"}`);
  core.setOutput("apps", JSON.stringify(selected));
  core.setOutput("has_changes", selected.length > 0 ? "true" : "false");
  return selected;
}
