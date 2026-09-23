# Cluster Map

## Description

Project aims to create a web application that provides real-time information about free/taken places for each cluster. It shows places and people with meaningful color indications in a clear, intuitive way.

Feature list:

- Cluster map with free/taken places
- Hover over place to see more details about peer (Name, time, etc)

## Team

Full-Stack Architect/ Team Lead - Artem Kuchmambetov

Front-end - Maxim Kleverov

Back-end - Vitalii Lundaev

Back-end / Database - Valentine Moroka

DevSecOps - Ping Yu

## Tech Stack

Front-end:

- React & Vite
- Tailwind
- Untitled UI (modified to fit HIVE Brand) based on React Aria
- Vitest / Playwright / MSW (tests)

Back-end:

- TS & Node.js & Express (Restful Api)
- PostgreSQL
- Drizzle ORM
- Zod Validation
- Vitest / Supertest

Tools:

- Trello (task management system)
- GitHub / GitHub CI/CD (self-hosted runner)
- Docker Compose
- Docusaurus (Static site generator for project documentation)
- Hetzner dedicated / VPS
- Cloudflare (temporary domain/dns for map-hive.pp.ua)

## Demo database

Configure the root `.env` with local `PG_*` connection settings, a
`BETTER_AUTH_SECRET` of at least 32 characters, and `BETTER_AUTH_URL`
(for example, `http://localhost:5000`). Then run:

```bash
pnpm db:up
pnpm db:migrate
pnpm db:seed
```

The seed uses the cluster IDs, rows, and seats from `apps/api/src/config/clusters.json`
so the demo occupancy appears in `apps/web`: cluster 1 is mixed, cluster 2 is empty,
and cluster 3 is full. It creates enough demo members for the occupied seats
and these accounts through Better Auth:

| Email                               | State                            |
| ----------------------------------- | -------------------------------- |
| `demo-admin@example.test`           | Approved administrator           |
| `demo-member-<number>@example.test` | Approved members                 |
| `demo-pending@example.test`         | Pending approval; cannot sign in |

New accounts share the development password `Demo-password-123!`.
Run this only against a development database; `NODE_ENV=production` is rejected.
The script uses the same `PG_*` settings as the application.

## Database worker

`apps/worker` is a one-shot startup job that:

1. Waits for PostgreSQL to become reachable.
2. Applies Drizzle migrations from `packages/db/migrations`.
3. Optionally creates an approved administrator when `ADMIN_EMAIL` and
   `ADMIN_PASSWORD` are provided (requires `BETTER_AUTH_SECRET` and
   `BETTER_AUTH_URL`). Reruns are safe: an existing admin is left unchanged,
   and a conflicting non-admin email causes the worker to fail instead of
   promoting the account.

Run it manually with:

```bash
pnpm db:up
pnpm --filter @repo/worker... build
pnpm worker:start
```

Build and run the one-shot worker container from the repository root:

```bash
docker build -f apps/worker/Dockerfile -t cluster-map-worker .
docker run --rm --network host --env-file .env cluster-map-worker
```

The run command uses host networking on Linux to reach the PostgreSQL port
published by `pnpm db:up`. Set `PG_HOST` and `PG_PORT` in `.env` to the reachable
database address. For a container network, replace `--network host` with that
network and pass `-e PG_HOST=db -e PG_PORT=5432` when using the Compose database.
The container exits after completing the job, with a nonzero status on failure.
Environment values are supplied at runtime and are not baked into the image.

Reruns insert missing records and preserve existing passwords, approval states,
roles, and seat occupancy. The `demo-*` logins/emails are reserved for this dataset.
If you ran the older seed with `Demo: *` clusters, rerun `pnpm db:seed` to add
occupancy for the configured map clusters; the old demo clusters are preserved. Map inserts run in a transaction; authentication
accounts are created separately through Better Auth. No existing data is deleted.

Automated integration tests should use their own migrated, disposable database
and create scenario-specific fixtures rather than depending on this demo seed.

- Pnpm (mono-repo)

## Docker and deployment

Application Dockerfiles live in `apps/api`, `apps/web`, and `apps/docs`; build
with the repository root as context. Root Compose runs the local database only.

```bash
docker compose up -d db
pnpm db:migrate
```

Releases use GitHub Actions → GHCR → Coolify, with API secrets loaded from
Infisical at startup. Pushes to `staging` deploy to staging; pushes to `main` deploy
to production. Both build API, Web and Docs on GitHub-hosted runners and deploy
the published GHCR digests after the environment approval gate. Start with [manual.md](manual.md) for infrastructure setup,
required environment variables, one-off migrations, staging approval, production
branch releases, and rollback. Do not run demo seeding against production.
