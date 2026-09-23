# Deployment plan: GitHub Actions + Infisical + GHCR + Coolify

> Historical design proposal. The implemented branch pipelines and current setup
> are documented in [manual.md](manual.md): `staging` → staging and `main` →
> production, both built on GitHub-hosted runners. Earlier self-hosted runner
> and cross-environment digest promotion proposals below are superseded.

Target repository: [cluster_map / dev-cicd-deployment](https://github.com/a-kuchmambetov/cluster_map/tree/dev-cicd-deployment) 

The deployment should separate CI, image distribution, deployment orchestration, and secret management.

GitHub Actions · Self-hosted runner

Tests → Retrieve build-time configuration → Build Docker images → Push to GHCR

GitHub Container Registry

Store immutable, commit-specific application images

Coolify

Pull approved images → Configure runtime secrets → Deploy → Check health

Applications + PostgreSQL

Infisical manages application secrets independently of the Docker images.

The main architectural decision is to keep production credentials out of Docker builds. GitHub Actions needs access only to secrets genuinely required during CI or image compilation. Coolify should receive runtime credentials separately.

For your monorepo, the deployment will cover three applications: `apps/api`, `apps/web`, and `apps/docs`. Each should have its own Docker image and Coolify application, while PostgreSQL remains a persistent service independent of application releases.

## 1. Resolve the deployment blockers in the repository

The current branch contains most of the application code needed for deployment, but several parts must be corrected before connecting CI/CD.

The existing deployment documentation also describes a previous Docker Compose structure. The actual branch contains separate application Dockerfiles and a database-only root Compose file. Use the checked-in code as the source of truth, not the outdated deployment instructions.

P0

Fix the frontend-to-API proxy

`apps/web/nginx.web.conf` forwards `/api/` to `http://api:5000`.

This relies on Docker DNS resolving the hostname `api`. Three independently deployed Coolify applications are not guaranteed to share that hostname or Docker network.

Configure an explicit internal API hostname and attach Web and API to a shared, restricted network. Alternatively, use a dedicated public API hostname and route frontend requests through it.

P0

Correct the Infisical startup implementation

`apps/api/docker-entrypoint.sh` already attempts Universal Auth and `infisical run`, but the API Dockerfile does not install the Infisical CLI or execute this script.

The script also hardcodes `staging` and uses an executable path inconsistent with its current Dockerfile working directory.

Replace this incomplete integration with one deliberately selected runtime-secret delivery mechanism.

P0

Make database migrations a separate release operation

The project has a Drizzle migration command, but the API container starts immediately without applying migrations.

Create a one-off migration step that completes successfully before the new API version is deployed. Do not run migrations independently in every API replica.

P0

Correct the authentication URL configuration

Set `BETTER_AUTH_URL` to the actual public API URL, including the `/api/auth` base path if required by the Better Auth configuration. Set `WEB_ORIGIN` to the exact browser-facing frontend origin.

In your reverse-proxy topology, these must reflect public HTTPS URLs rather than internal container hostnames.

P1

Separate CI, staging, and production databases

The API integration suite includes an optional PostgreSQL-backed authentication test. Run this against an isolated, disposable CI database.

Never point CI tests or demo seeding at production PostgreSQL.

These changes are prerequisites for a reliable image-based deployment. The existing API, Web and Docs Dockerfiles can be adapted rather than rewritten entirely.

## 2. Set up the self-hosted GitHub Actions runner

Your repository is currently public. This has an important security implication: a persistent self-hosted runner that builds pull-request code can be compromised by untrusted contributors.

GitHub specifically warns against running untrusted public-repository code on persistent self-hosted runners.

![](https://www.google.com/s2/favicons?domain=https://docs.github.com&sz=32)

GitHub Docs

+1

For this project, use the following separation.

CI runner

Run pull-request checks on GitHub-hosted runners, or disposable, isolated self-hosted runners without production credentials.

Release runner

Use a dedicated self-hosted runner for building and publishing images from trusted, protected branches. Prefer an ephemeral VM that is destroyed after each job.

Coolify server

Run the application containers and persistent database separately from the release runner.

### Runner setup

1. Provision a Linux VM dedicated to the release runner. Do not install the runner directly on the production application server.

2. Install Docker Engine, Docker Buildx, Git and the dependencies required by the GitHub Actions runner.

3. Open the repository's Settings → Actions → Runners → New self-hosted runner. Follow GitHub's generated installation instructions.

4. Give the runner a dedicated label such as `cluster-map-build`.

5. Configure ephemeral execution and clean up the VM after each job. If starting with a persistent runner for staging, treat it as temporary infrastructure with no access to production credentials.

6. Allow outbound connectivity to GitHub, GHCR and Infisical. Allow access to Coolify's authenticated API only from the trusted deployment environment.

7. Protect production deployments with GitHub Environments and required approvals. Use separate staging and production configuration.

GitHub documents both [runner registration](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners)  and [ephemeral runner configuration](https://docs.github.com/en/actions/reference/runners/self-hosted-runners) .

![](https://www.google.com/s2/favicons?domain=https://docs.github.com&sz=32)

GitHub Docs

+1

## 3. Configure Infisical

Create an Infisical project named `cluster-map` with separate `dev`, `staging`, and `prod` environments.

Within each environment, organize secrets by consumer:

cluster-map

Environment: staging / prod

`/api` — API runtime configuration

`/database` — database provisioning and migration credentials

`/build` — build-time configuration, only when necessary

For the current codebase, the API's `/api` folder should contain:

dotenv

```
NODE_ENV=production
API_PORT=5000
WEB_ORIGIN=https://map-hive.pp.ua
BETTER_AUTH_URL=https://map-hive.pp.ua
BETTER_AUTH_SECRET=<random-secret-at-least-32-characters>
PG_HOST=<private-postgres-hostname>
PG_PORT=5432
PG_USER=<application-db-user>
PG_PASSWORD=<application-db-password>
PG_DB=<application-db-name>
```

The domain shown here is an example based on your repository's documented domain. Set the values to the actual public frontend URL and private database connection details.

Keep staging credentials independent from production credentials. In particular, never share the same Better Auth secret, database credentials or database instance between those environments.

### Create three machine identities

GitHub Actions

`cluster-map-ci`

Authentication: GitHub OIDC.

Grant read access only to the environment and build-time secret paths that CI needs. Do not give this identity general access to production API or database credentials.

Coolify runtime

`cluster-map-api-staging` / `cluster-map-api-prod`

Authentication: Universal Auth.

Grant each identity read access to its own environment's `/api` secrets.

Database migration

`cluster-map-migrator-staging` / `cluster-map-migrator-prod`

Grant read access to the credentials required to run migrations for the corresponding environment. Keep migration database permissions separate from application permissions when feasible.

Infisical supports OIDC for machine identities and allows you to restrict identity authentication using token subjects, audiences and claims.

![](https://www.google.com/s2/favicons?domain=https://infisical.com&sz=32)

Infisical

+1

For the CI identity, bind the expected GitHub repository and trusted deployment branch or environment. Do not use an unrestricted repository wildcard.

For example, a branch-specific GitHub OIDC subject is:

```
repo:a-kuchmambetov/cluster_map:ref:refs/heads/main
```

When the workflow uses a GitHub Environment, its default OIDC subject has a different environment-based format. Configure Infisical's subject and claim restrictions accordingly.

Why OIDC for CI? GitHub can issue short-lived identity tokens that Infisical exchanges for access tokens. This avoids maintaining a permanent Infisical client secret on the runner.

For the Coolify application, Universal Auth is appropriate because its container does not automatically receive GitHub's workflow identity. Only its Infisical Client ID and Client Secret need to be configured in Coolify. Infisical can exchange those credentials for a short-lived access token.

![](https://www.google.com/s2/favicons?domain=https://www.youtube.com&sz=32)

youtube.com

+1

## 4. Prepare the application images

### API: retrieve secrets at container startup

Use the Infisical CLI to start the API process.

This follows Infisical's documented Docker integration: install its CLI in the runtime image, authenticate the container, retrieve the relevant secrets, and inject them into the application process.

![](https://www.google.com/s2/favicons?domain=https://coolify.io&sz=32)

Coolify Docs

+1

Adapt `apps/api/Dockerfile` to:

1. Preserve the existing multi-stage build.

2. Install a compatible Infisical CLI version in the final runtime stage, using its official installation instructions.

3. Copy `apps/api/docker-entrypoint.sh` into the runtime image.

4. Give the script executable permissions and execute it as the container entrypoint.

5. Preserve the non-root runtime user and existing application dependencies.

6. Configure the correct working directory and API port.

7. Verify that the final image can authenticate and launch successfully without any credentials embedded in its layers.

Replace the existing entrypoint with the following startup logic:

Bash

```
#!/bin/sh
set -eu

cd /app/apps/api

export INFISICAL_TOKEN="$(
  infisical login \
    --method=universal-auth \
    --client-id="$INFISICAL_CLIENT_ID" \
    --client-secret="$INFISICAL_CLIENT_SECRET" \
    --silent \
    --plain
)"

exec infisical run \
  --projectId="$INFISICAL_PROJECT_ID" \
  --env="$INFISICAL_ENV" \
  --path=/api \
  -- node dist/index.js
```

`INFISICAL_ENV` must come from Coolify rather than being hardcoded to `staging`.

The Infisical CLI supports Universal Auth, environment selection, project IDs and secret paths.

![](https://www.google.com/s2/favicons?domain=https://coolify.io&sz=32)

Coolify Docs

+1

This implementation retrieves secrets during container startup. It does not continuously refresh the environment of an already-running Node.js process.

When rotating runtime secrets, restart or redeploy the application and verify the new container's health. Avoid enabling automatic restart-on-secret-change without testing how authentication sessions and active SSE connections behave.

Important: If Infisical is unavailable and the container has no cached credentials, the new API container cannot start. Keep the existing healthy container running during a failed rollout, and monitor Infisical availability independently.

### Web: keep the image environment-independent

For the current React/Vite application, keep:

dotenv

```
VITE_API_URL=
```

The frontend then uses same-origin `/api` requests.

This means that a single compiled frontend image can be deployed to staging and production without rebuilding it for different public API URLs, provided both environments use the same routing structure.

Modify `apps/web/nginx.web.conf` to resolve an explicitly configured internal API hostname rather than assuming that `api` exists on the Docker network. Configure the required environment-aware upstream at container startup, or generate the Nginx configuration from a template.

Also configure the `/api/` proxy for long-lived SSE responses: disable response buffering for streaming routes and set suitable read timeouts. Verify authentication cookies and forwarded HTTPS headers through the complete reverse-proxy path.

### Docs: use a separate image

Keep the existing Docusaurus → Nginx multi-stage Dockerfile.

The documentation application does not currently require runtime access to Infisical. Its build should fail if Docusaurus detects broken links.

If staging and production require different Docusaurus URLs or base paths, explicitly account for those build-time differences. Otherwise, publish and reuse the same documentation image.

## 5. Configure GHCR

Create three container-image repositories under your GitHub account:

API

ghcr.io/a-kuchmambetov/cluster-map-api

Frontend

ghcr.io/a-kuchmambetov/cluster-map-web

Documentation

ghcr.io/a-kuchmambetov/cluster-map-docs

These are proposed image names; the actual packages will be created when CI successfully pushes them.

### Authentication

GitHub Actions should use its built-in `GITHUB_TOKEN` with the `packages: write` permission when publishing images associated with this repository. A personal access token is unnecessary for this step.

![](https://www.google.com/s2/favicons?domain=https://docs.github.com&sz=32)

GitHub Docs

+1

For Coolify, choose one of two registry access models:

- Public images: allow unauthenticated pulls. Suitable when the images contain only distributable application code and no confidential assets.

- Private images: configure a dedicated registry-read credential on the deployment server, using the minimum required `read:packages` permission. Do not reuse CI's publishing credential.

For private images, verify that the actual Docker execution context used by Coolify can authenticate to GHCR.

![](https://www.google.com/s2/favicons?domain=https://docs.github.com&sz=32)

GitHub Docs

+1

### Image tagging

Use commit-specific tags rather than deploying `latest`.

```
ghcr.io/a-kuchmambetov/cluster-map-api:sha-<commit-sha>
ghcr.io/a-kuchmambetov/cluster-map-web:sha-<commit-sha>
ghcr.io/a-kuchmambetov/cluster-map-docs:sha-<commit-sha>
```

For stronger release immutability, record each pushed image's SHA-256 digest and promote that exact digest to production.

One tested build should be promoted through staging and production instead of rebuilding a different artifact for each environment.

Coolify supports deploying existing images by version tag or immutable digest.

![](https://www.google.com/s2/favicons?domain=https://coolify.io&sz=32)

Coolify Docs

+1

## 6. Set up Coolify

Create a Coolify project named `cluster-map` with separate staging and production environments.

For each environment, create these resources:

|
Resource

|

Coolify type

|

Internal port

|
| --- | --- | --- |
|

PostgreSQL

|

Standalone database

|

5432

|
|

API

|

Docker Image application

|

5000

|
|

Web

|

Docker Image application

|

80

|
|

Docs

|

Docker Image application

|

80

|

Coolify's Docker Image deployment type pulls an existing image without rebuilding source code. This matches your preferred GitHub Actions → GHCR → Coolify architecture.

![](https://www.google.com/s2/favicons?domain=https://coolify.io&sz=32)

Coolify Docs

+1

### Step 6.1 — Deploy PostgreSQL

Create a standalone PostgreSQL 17 database in Coolify.

Configure persistent storage, a non-default database password and an internal connection address. Do not publish PostgreSQL's port to the internet.

Store application database credentials in Infisical. Keep the credentials necessary to initialize PostgreSQL itself in Coolify or another protected provisioning mechanism.

Configure scheduled backups to external storage and test restoring one into an isolated database. Coolify supports scheduled PostgreSQL backups and S3-compatible backup destinations.

![](https://www.google.com/s2/favicons?domain=https://docs.github.com&sz=32)

GitHub Docs

+1

### Step 6.2 — Configure networking

Place API, Web and PostgreSQL on a Docker network where they can resolve their intended internal hostnames.

Coolify's standalone applications normally use their selected destination network. Compose applications instead receive resource-specific networks unless configured otherwise.

![](https://www.google.com/s2/favicons?domain=https://coolify.io&sz=32)

Coolify Docs

+1

For the initial deployment, place these resources on the same server and selected Coolify destination.

Verify that:

- Web can resolve and connect to API on port 5000.

- API can connect to PostgreSQL on port 5432.

- PostgreSQL is not publicly exposed.

- Both Web and API can access their required services without using public IP addresses for internal traffic.

Use a verified Docker network alias or container hostname for the Nginx upstream. Do not assume Coolify will automatically give the API the hostname `api`.

### Step 6.3 — Configure the API application

In Coolify, select New Resource → Docker Image.

Set the image name to:

```
ghcr.io/a-kuchmambetov/cluster-map-api
```

Select a published staging image tag.

Set Ports Exposes to `5000`.

In Configuration → Environment Variables, configure the following bootstrap variables:

dotenv

```
INFISICAL_PROJECT_ID=<project-id>
INFISICAL_ENV=staging
INFISICAL_CLIENT_ID=<staging-client-id>
INFISICAL_CLIENT_SECRET=<staging-client-secret>
```

Mark the client secret as sensitive and configure the credentials as runtime-only variables.

The API container uses these credentials to retrieve its actual application secrets from Infisical.

Do not duplicate `BETTER_AUTH_SECRET`, `PG_PASSWORD` and other API runtime secrets in Coolify when the container already retrieves them from Infisical.

This keeps Coolify responsible for container configuration and Infisical responsible for application secrets.

### Step 6.4 — Configure Web and Docs

Create separate Docker Image applications using their corresponding GHCR images.

Configure the Web application with the public frontend domain and internal port 80. Configure Docs with its own documentation domain and internal port 80.

For example:

```
Web:  https://map-hive.pp.ua
Docs: https://docs.map-hive.pp.ua
```

Configure HTTPS through Coolify's proxy and your DNS provider.

Keep Coolify's automatic Git deployment disabled for these image-based applications. GitHub Actions should be the only process initiating application releases.

### Step 6.5 — Configure health checks

For the API, use the existing:

```
GET http://localhost:5000/api/health
```

The endpoint checks database connectivity and returns HTTP 503 when the database is unreachable.

For Web and Docs, use HTTP checks against their local Nginx listeners on port 80.

Ensure that the final application images contain `curl` or `wget` when using Coolify's HTTP health checks.

![](https://www.google.com/s2/favicons?domain=https://coolify.io&sz=32)

Coolify Docs

+1

Also introduce an application-level readiness check that validates authentication configuration and required database schema readiness. The existing database health endpoint does not establish that those dependencies are fully operational.

Enable rolling updates for eligible Docker Image applications and test the complete replacement sequence, including SSE reconnection and active authentication sessions.

## 7. Implement the GitHub Actions pipeline

Use three workflows rather than putting everything into one unrestricted deployment workflow.

01 · ci.yml

Validate changes

Trigger: pull requests to protected branches.

Runner: GitHub-hosted or disposable self-hosted runner.

No production secrets, registry publishing permission or Coolify deployment permission.

02 · publish.yml

Build and publish

Trigger: push to an approved release branch, after required checks pass.

Runner: trusted self-hosted build runner.

Publish all required Docker images with immutable commit-specific tags.

03 · deploy.yml

Release an existing image

Trigger: successful publication for staging; manual approval or an explicit promotion event for production.

Update Coolify image references, apply migrations where required, deploy and verify.

### Step 7.1 — CI workflow

Run the following commands from the monorepo root:

Bash

```
pnpm install --frozen-lockfile

pnpm fmt:check
pnpm lint
pnpm typecheck

pnpm --filter @repo/api... build

pnpm --filter @repo/api test
pnpm --filter @repo/api test:integration
pnpm --filter @repo/web test

pnpm build
pnpm build:docs
```

Use Node.js 24 and pnpm 11.5.2, matching the Dockerfiles and the repository package-manager configuration.

Your API integration suite has an optional PostgreSQL-backed authentication test.

Create a disposable PostgreSQL service container for this test, apply Drizzle migrations, and run the integration suite with:

Bash

```
AUTH_DB_TEST=1 \
  pnpm --filter @repo/api test:integration
```

The database must be unique to the CI job. Configure its test credentials locally in the workflow or obtain isolated CI credentials from Infisical when external test infrastructure is required.

Do not run `pnpm db:seed` in production or as a substitute for proper integration-test fixtures.

### Step 7.2 — Retrieve build-time secrets where necessary

For the current application, I would not make Infisical a mandatory dependency of every Docker build.

Your Web application can use same-origin API requests, Docs is a static site, and the API's database and authentication credentials are runtime configuration.

None of those production secrets needs to be embedded in the current application images.

Infisical becomes useful during CI when the build genuinely needs a private dependency credential, a signing key or another protected build-time value.

For such jobs, use the official Infisical Secrets Action with GitHub OIDC:

YAML

```
permissions:
  contents: read
  id-token: write

steps:
  - uses: actions/checkout@v4

  - name: Retrieve build-time secrets
    uses: Infisical/secrets-action@v1
    with:
      method: oidc
      identity-id: ${{ vars.INFISICAL_CI_IDENTITY_ID }}
      project-slug: ${{ vars.INFISICAL_PROJECT_SLUG }}
      env-slug: staging
      secret-path: /build
```

The official action supports OIDC authentication and scoping retrieval by project, environment and secret path.

![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)

GitHub

+1

Pin third-party Actions to reviewed immutable commit SHAs in the final workflows.

If a Docker build requires credentials, pass them through BuildKit secret mounts rather than ordinary `ARG` or `ENV` instructions. Never copy an exported Infisical `.env` file into the Docker image.

### Step 7.3 — Build and push images

Use Docker Buildx and the existing application Dockerfiles.

The equivalent commands are:

Bash

```
docker buildx build \
  -f apps/api/Dockerfile \
  -t ghcr.io/a-kuchmambetov/cluster-map-api:sha-$GITHUB_SHA \
  --push .

docker buildx build \
  -f apps/web/Dockerfile \
  -t ghcr.io/a-kuchmambetov/cluster-map-web:sha-$GITHUB_SHA \
  --push .

docker buildx build \
  -f apps/docs/Dockerfile \
  -t ghcr.io/a-kuchmambetov/cluster-map-docs:sha-$GITHUB_SHA \
  --push .
```

In the actual workflow, prefer `docker/build-push-action` with Buildx caching and GHCR authentication through `docker/login-action`.

Ensure all images target the architecture of your Coolify deployment server, initially `linux/amd64` if that matches your infrastructure.

After publishing, record the exact image references and digests as release metadata. Do not promote an image unless the registry push succeeds.

### Step 7.4 — Introduce monorepo build optimization

Initially, build and publish all three images together to establish a reproducible release.

Once the pipeline works reliably, add change detection for:

- `apps/api` and its shared-package dependencies.

- `apps/web` and its shared-package dependencies.

- `apps/docs` and documentation configuration.

- Root lockfiles, base Docker configuration and shared build tooling.

Changes to shared packages should trigger every application that depends on them.

Avoid using a simple directory filter that misses changes in `packages/db`, `packages/types`, or the root `pnpm-lock.yaml`.

## 8. Automate deployment through Coolify's API

This is the integration point that makes the pipeline reliable.

A deployment webhook alone is insufficient when an application has an immutable image reference: it starts deployment of the image already configured in Coolify.

For every release, update the target image tag first, then trigger deployment.

Coolify documents both application updates and deployments through its API.

![](https://www.google.com/s2/favicons?domain=https://coolify.io&sz=32)

Coolify Docs

+1

### Step 8.1 — Create the deployment credentials

In Coolify, enable API access and create a token with the permissions necessary to update the application and initiate deployment.

Configure GitHub Environment secrets:

```
COOLIFY_URL
COOLIFY_TOKEN
COOLIFY_API_UUID
COOLIFY_WEB_UUID
COOLIFY_DOCS_UUID
```

Use separate credentials and application UUIDs for staging and production.

Allow deployment only from trusted workflows. Protect the production GitHub Environment with approval requirements.

### Step 8.2 — Update the application image

After a successful registry push, update Coolify's configured tag for the API application.

Example:

Bash

```
curl --fail-with-body \
  -X PATCH \
  "$COOLIFY_URL/api/v1/applications/$COOLIFY_API_UUID" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"docker_registry_image_tag\":\"sha-$GITHUB_SHA\"}"
```

Repeat this for Web and Docs, or update their image references only when they are included in the release.

For a digest-based release, use Coolify's documented image-digest configuration instead of a mutable tag.

### Step 8.3 — Trigger deployment

After the image reference is updated, trigger the application deployment:

Bash

```
curl --fail-with-body \
  -X POST \
  "$COOLIFY_URL/api/v1/deploy?uuid=$COOLIFY_API_UUID" \
  -H "Authorization: Bearer $COOLIFY_TOKEN"
```

The deployment endpoint returns deployment identifiers. Track those identifiers until Coolify reports a terminal state. A successful API request means the deployment was accepted, not necessarily that the application became healthy.

![](https://www.google.com/s2/favicons?domain=https://coolify.io&sz=32)

Coolify Docs

+1

After the API is healthy, deploy Web and Docs where necessary.

Use a workflow-level concurrency group for each target environment so two releases cannot update the same Coolify application simultaneously.

## 9. Add a controlled database migration stage

Database migrations require their own release procedure.

Do not put `pnpm db:migrate` in the API's normal startup command. During rolling deployments, multiple API instances could otherwise attempt migration independently.

### Migration workflow

1. Publish the candidate API image

The migration must correspond to the exact application version being released.

2. Check migration compatibility

Confirm that the existing application can continue operating against the schema changes.

3. Run a one-off migration container

Use the published API image, private database network and environment-specific migration credentials.

4. Validate migration completion

Do not deploy the new API until the migration operation exits successfully.

5. Deploy the new application version

Verify health, authentication, cluster reads and streaming behavior.

Keep the migration job separate from the public application and from the normal CI test database.

For the first implementation, explicitly execute the migration as a controlled one-off task on the deployment infrastructure, then automate it once the execution mechanism and failure handling are verified.

The API image currently includes the database package and migration files, but verify that the migration CLI and its complete dependencies are available in the final runtime image.

For schema changes that are not backward-compatible, use an expand-and-contract migration process. Add compatible schema changes first, deploy application changes, and remove obsolete structures in a later release.

An image rollback cannot reverse an incompatible or destructive database migration.

## 10. Implement release verification and rollback

A reliable pipeline should distinguish image publication, deployment completion and actual application readiness.

### Post-deployment verification

After each staging deployment, run smoke tests covering the following:

Deployment acceptance checklist

0/7

API health endpoint returns HTTP 200.

Web and Docs are accessible over HTTPS.

User registration, login and authentication cookies work through the public proxy.

An approved user can retrieve clusters and occupancy.

The SSE connection receives events and reconnects successfully.

The running application uses the intended release image.

PostgreSQL data persists across application redeployments.

For production, run a smaller set of non-destructive smoke tests automatically after deployment, especially the health endpoint, frontend availability and core API functionality.

### Rollback procedure

Store the last known healthy image digest for each application.

If a deployment fails, restore Coolify's previous image reference and redeploy it. Do not rely on `latest` or another mutable tag to identify the previous version.

Keep database schema compatibility in mind. If a migration is destructive, application rollback alone may not recover the system.

Set up monitoring for failed deployments, repeated API restarts, database availability, authentication failures, and SSE connection errors.

## 11. Recommended implementation order

Implement the deployment in the following sequence rather than introducing every component simultaneously.

## Implementation checklist

11 stages

Track implementation progress

0 / 11

1. Repository

Fix the Docker entrypoint, Nginx proxy, runtime environment configuration and health checks.

2. Runner

Provision and secure the self-hosted build runner.

3. Infisical

Create environments, secrets and restricted machine identities.

4. Registry

Configure GHCR publishing and Coolify image-pull authentication.

5. Database

Provision staging PostgreSQL, persistent storage and backups.

6. Coolify

Create staging Docker Image applications and configure networking.

7. CI

Implement tests, linting, type checks and the disposable PostgreSQL integration test.

8. Image publishing

Build and publish commit-tagged API, Web and Docs images.

9. Staging deployment

Implement the image-reference update, deployment trigger and health verification.

10. Production

Add approval gates, one-off migrations, image promotion and rollback.

11. Operations

Document credential rotation, backups, recovery and release procedures.

For your current `dev-cicd-deployment` branch, the initial milestone should be a complete staging deployment. Do not connect feature-branch pushes directly to production. Once staging is verified, merge the pipeline changes into the protected release branch and configure production promotion separately.

## Documentation

The plan uses the current documentation for the relevant integration points.

![](https://www.google.com/s2/favicons?domain=https://coolify.io&sz=32)

Coolify

Deploy existing Docker images 

GitHub Actions integration 

Update an application through the API 

Trigger application deployments 

![](https://www.google.com/s2/favicons?domain=https://infisical.com&sz=32)

Infisical

Docker runtime secret injection 

OIDC machine authentication 

Universal Auth 

Official GitHub Secrets Action 

![](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)

GitHub

GitHub Actions security and runner hardening 

GitHub Container Registry 

Final architecture: GitHub Actions owns testing and immutable image creation. GHCR stores release artifacts. Coolify owns deployment, networking, health checks and container lifecycle. Infisical owns application secrets, which the API retrieves at startup. Database migrations and production promotion are explicit release operations rather than side effects of application startup.
