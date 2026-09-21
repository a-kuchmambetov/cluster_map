 wo# Manual deployment steps

Complete these steps in order. The repository implements CI, publishing, digest promotion, Coolify deployment polling and public health checks. Infrastructure setup and the one-off migration are manual. No cloud resources have been provisioned by this change.

## 1. Protect the repository before enabling releases

1. Merge these files into the default `main` branch. `workflow_run` requires the workflow on the default branch, and deployment deliberately checks out trusted `main` automation.
2. Protect `main` and `dev-cicd-deployment`: require pull-request review and the CI `checks` job; restrict direct pushes. Review workflow changes carefully.
3. Create GitHub Environments named **staging** and **production**. Require reviewers on **both**, disable self-review, and restrict deployment branches to `main`. The Deploy workflow runs from `main`, even when staging images were published from `dev-cicd-deployment`.
4. The staging approval is also the migration gate. **Never approve Deploy before the exact candidate image migration succeeds.** Production additionally requires a successful staging Deploy for the same Publish run, and images published from `main`.
5. PR checks run on GitHub-hosted runners with a disposable PostgreSQL 17 service. They receive no deployment credentials. Do not enable `pull_request_target` or route PRs to the release runner.

## 2. Provision the build runner

1. Create a dedicated Linux amd64 VM separate from Coolify and its private database network.
2. Install Docker Engine, Buildx, Git, and the GitHub runner dependencies.
3. In repository Settings → Actions → Runners → New self-hosted runner, follow the generated commands. Add label `cluster-map-build` and register using `--ephemeral`.
4. Arrange replacement VMs after jobs complete; the three-image matrix requires three jobs, so one one-shot runner alone cannot complete a release.
5. Permit outbound GitHub, GHCR, npm, container registries, and Infisical CLI package repository traffic. Do not give the runner runtime or database credentials.
6. Allow GitHub Actions to publish packages using the repository `GITHUB_TOKEN`. All images target `linux/amd64`.

## 3. Configure Infisical

1. Create project `cluster-map` with `dev`, `staging`, and `prod` environments and `/api`, `/database`, `/build` folders.
2. In each deployed environment's `/api`, set:

   ```dotenv
   NODE_ENV=production
   API_PORT=5000
   WEB_ORIGIN=https://your-frontend.example
   BETTER_AUTH_URL=https://your-frontend.example
   BETTER_AUTH_SECRET=<unique random value of at least 32 characters>
   PG_HOST=<private database hostname>
   PG_PORT=5432
   PG_USER=<application user>
   PG_PASSWORD=<application password>
   PG_DB=<database name>
   ```

   Use the browser-facing origin without a trailing slash. Better Auth uses its default `/api/auth` base path; the public origin above is sufficient. Web proxies `/api` to the private API, so an independent public API domain is unnecessary.

3. In `/database`, set the five `PG_*` values for a migration user with schema creation/alteration privileges. Ensure new tables remain accessible to the application user using PostgreSQL ownership/default grants. Never use a production database for CI or demo seeding.
4. Create separate Universal Auth machine identities for staging API, production API, staging migrator, and production migrator. Grant each access only to its own environment and folder.
5. No build secrets are needed today; CI does not contact Infisical. If private build dependencies are introduced later, create a restricted GitHub OIDC identity for `/build`, bind its exact repository/branch or environment subject, and use BuildKit secret mounts. Do not pass credentials through Docker build arguments.

## 4. Provision PostgreSQL and Coolify

1. Create Coolify project `cluster-map`, staging and production environments, and separate PostgreSQL 17 databases. Use persistent volumes, strong unique passwords and private ports only.
2. Configure scheduled external/S3 backups and restore one into a disposable database before production.
3. Create three **Docker Image** applications per environment, using these image names:
   - `ghcr.io/a-kuchmambetov/cluster-map-api` (port 5000)
   - `ghcr.io/a-kuchmambetov/cluster-map-web` (port 80)
   - `ghcr.io/a-kuchmambetov/cluster-map-docs` (port 80)
4. Use the same private destination network for Web, API and PostgreSQL within each environment. Give API a stable, verified network hostname/alias, e.g. `cluster-map-api-staging`. Do not share staging and production database access.
5. Configure Web runtime variable `API_UPSTREAM=cluster-map-api-staging:5000` (use your actual alias). It is required; there is no implicit `api` fallback. Only expose Web through Coolify's trusted HTTPS proxy, which must overwrite `X-Forwarded-Proto`.
6. Configure API runtime-only variables `INFISICAL_PROJECT_ID`, `INFISICAL_ENV` (`staging` or `prod`), `INFISICAL_CLIENT_ID`, and sensitive `INFISICAL_CLIENT_SECRET`. Optionally set `INFISICAL_DOMAIN` for EU/self-hosted Infisical. Do not duplicate API secrets here.
7. Configure Web/Docs public domains and DNS with HTTPS. Docs canonical URL is currently `https://docs.map-hive.pp.ua` with `/` base path, shared across promoted images; change the Docusaurus configuration before publishing if a different canonical domain is needed.
8. Disable automatic Git deployments. Enable rolling updates and configure API health check `/api/health/ready`, port 5000, with at least 40 seconds startup grace; Web/Docs use `/`, port 80. Check that a failed startup leaves the old healthy instance serving.
9. Make GHCR packages public after the first publication, or configure a dedicated `read:packages` registry credential in the Docker context Coolify actually uses. Never use the release runner's publishing token.
10. In each GitHub Environment add secrets `COOLIFY_URL` (HTTPS origin), `COOLIFY_TOKEN`, `COOLIFY_API_UUID`, `COOLIFY_WEB_UUID`, `COOLIFY_DOCS_UUID`. The token needs application read/update and deployment trigger/status permissions.
11. Add Environment variables `API_URL`, `WEB_URL`, `DOCS_URL`: public HTTPS origins without paths. With same-origin routing, `API_URL` equals `WEB_URL`.
12. Make Coolify's authenticated API reachable from the GitHub-hosted Deploy job through your approved ingress. If your API is private, replace only Deploy's runner with a dedicated trusted deployment runner that can reach it; do not use the build runner.

## 5. Publish, migrate, and approve staging

1. Push a reviewed change to `dev-cicd-deployment` or `main`. Publish runs its own complete CI checks before the trusted runner builds all three images. No build optimization is applied yet.
2. In the successful **Publish** run, download `image-api`, `image-web`, and `image-docs`. Each JSON records commit SHA, image name and digest. Keep the Publish run ID.
3. The automatic **Deploy** run waits for staging environment approval. Download `image-api` before approving it.
4. Review pending SQL migrations for compatibility with the currently running application. Back up the database before risky schema changes. Use expand-and-contract releases for incompatible changes.
5. On the deployment host, check out the reviewed release's scripts. Export these values in a secure shell (read secrets interactively; do not paste them into shell history):

   ```sh
   export API_IMAGE='ghcr.io/a-kuchmambetov/cluster-map-api@sha256:<digest from api.json>'
   export DEPLOY_NETWORK='<private Coolify destination network>'
   export INFISICAL_PROJECT_ID='<project ID>'
   export INFISICAL_ENV=staging
   export INFISICAL_CLIENT_ID='<staging migrator client ID>'
   read -r -s -p 'Migration client secret: ' INFISICAL_CLIENT_SECRET; echo
   export INFISICAL_CLIENT_SECRET
   # If required: export INFISICAL_DOMAIN=https://eu.infisical.com
   sh scripts/deploy/migrate.sh
   unset INFISICAL_CLIENT_SECRET
   ```

6. Require exit status 0. Retain migration evidence with the release; if it fails, leave Deploy unapproved and investigate. The script runs the exact API image once on the private network with `/database` credentials. API replicas never migrate on startup.
7. Approve staging Deploy. It validates the publication, updates all image references by digest, deploys API first, polls Coolify's deployment and health status, then deploys Web and Docs and checks public HTTPS responses.
8. A successful run uploads `deployment-staging-<publish-run-id>` containing `healthy.json`, previous image configuration and the candidate image digests. Archive healthy release records outside Actions before their 90-day expiry.
9. In staging, register a test user, approve it using an approved admin, log in through Web, and inspect Secure cookies. Verify cluster/occupancy reads, SSE events and reconnection after a redeploy, and database persistence. These authenticated and persistence checks remain manual; automated checks cover schema/auth configuration readiness and public availability.
10. Verify actual running container image digests on the Coolify server using `docker inspect` and `docker image inspect`. The workflow checks configured image and Coolify health, but cannot independently inspect the remote Docker daemon.

## 6. Promote production

1. Use a successful **main** Publish run that has already passed staging Deploy and the manual acceptance checks.
2. Actions → Deploy → Run workflow (branch `main`), choose `production`, enter that exact Publish run ID. It downloads the original artifacts without rebuilding.
3. Run step 5's migration with the same API digest and **production** network and migrator identity; set `INFISICAL_ENV=prod`.
4. Approve the production Environment only after migration succeeds and compatibility is reviewed. The workflow rejects feature-branch publications and candidates without successful staging deployment evidence.
5. Verify HTTPS, authentication, core reads and monitoring after completion. Archive the healthy digest record.

## 7. Rollback and operations

1. On failed deployment, inspect its logs and status; cancel any still-running deployment in Coolify before changing references. The workflow does not automatically roll back partially deployed applications or database changes.
2. Retrieve the last known healthy `healthy.json` from your release archive. `previous.json` captures pre-release configuration for diagnosis; it is not proof that those images were healthy.
3. Confirm the current database schema remains compatible with the old application. For destructive migrations, follow the tested restore/recovery procedure instead of assuming an image rollback is sufficient.
4. In each affected Coolify application, set the saved image name and saved `docker_registry_image_tag`. Coolify represents digest tags as `sha256-<64 hex characters>` (hyphen, not colon). Redeploy API first; wait for readiness, then Web and Docs. Repeat smoke and authentication checks.
5. Rotate application secrets in Infisical, restart/redeploy API, and verify health, sessions and SSE. Startup injection does not refresh an already-running process. Rotate bootstrap Universal Auth secrets in Coolify separately.
6. Monitor failed deployments, restarts, database readiness, authentication errors, SSE disconnects, Infisical outages and backup failures. Test restoring backups and rollback regularly. Keep the old healthy API running if Infisical cannot start its replacement.
7. Regularly review pinned GitHub Action commits and base image updates; Infisical CLI is pinned to the tested package version `0.43.133`. Image digests preserve release artifacts, but a future rebuild may include newer base images.

References: [Infisical runtime installation and authentication](https://infisical.com/docs/cli/usage), [Coolify deployment API](https://coolify.io/docs/api/endpoints/deployments/deploy-by-tag-or-uuid), [Coolify digest handling implementation](https://github.com/coollabsio/coolify/blob/v4.x/app/Jobs/ApplicationDeploymentJob.php), [GitHub self-hosted runners](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners).
