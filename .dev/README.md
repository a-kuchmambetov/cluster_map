# Local Development Environment (.dev)

This folder contains the Docker configuration and compose setup for local development.

## Structure

```
.dev/
├── api/
│   └── Dockerfile         # Express API dev image (port 5001)
├── db/
│   └── Dockerfile         # PostgreSQL 17 database dev image (port 5432)
├── docs/
│   └── Dockerfile         # Docusaurus dev image (port 3000)
├── web/
│   └── Dockerfile         # React / Vite dev image (port 5173)
├── docker-compose.yml     # Compose definition for local development
└── README.md
```

## Services

- **api** ([`api/Dockerfile`](file:///home/dev/Work/cluster_map/.dev/api/Dockerfile)): Express API server with live reload via `tsx watch` (port `5001`).
- **db** ([`db/Dockerfile`](file:///home/dev/Work/cluster_map/.dev/db/Dockerfile)): PostgreSQL 17 database service with health check (port `5432`).
- **web** ([`web/Dockerfile`](file:///home/dev/Work/cluster_map/.dev/web/Dockerfile)): React / Vite web application with HMR (port `5173`).
- **docs** ([`docs/Dockerfile`](file:///home/dev/Work/cluster_map/.dev/docs/Dockerfile)): Docusaurus documentation platform with live reload (port `3000`).
- **worker**: One-off service that executes database migrations and admin setup before the API accepts traffic.
- **simulator** (optional profile `simulator`): Background cluster activity simulator for development.

## Images

- `api`, `worker` and `simulator` share the `cluster-map-dev-api` image built from `api/Dockerfile`. It installs dependencies for `@repo/api`, `@repo/worker` and `@repo/simulator` (plus their workspace packages) and contains the source of all three apps.
- Each Node image copies only the workspace manifests it needs, installs with `--frozen-lockfile`, builds shared `packages/*` before copying app sources, and runs as the non-root `node` user.
- The pnpm store is kept in a BuildKit cache mount (`cluster-map-pnpm-store`) shared by all Node images. It speeds up rebuilds but is not shipped in the images. BuildKit is the default builder for `docker compose` v2. To drop the cache, run `docker builder prune`.
- Rebuild (`--build`) after changing `package.json`, `pnpm-lock.yaml` or anything under `packages/`. Day-to-day edits to bind-mounted app sources reload without a rebuild.

## Usage

### Start All Services

From the project root:

```bash
docker compose -f .dev/docker-compose.yml up --build
```

Or from inside the `.dev` folder:

```bash
cd .dev
docker compose up --build
```

### Stop All Services

```bash
docker compose -f .dev/docker-compose.yml --profile simulator down
```

### Seed Demo Data

After starting the stack and letting the worker finish migrations:

```bash
docker compose -f .dev/docker-compose.yml exec api pnpm db:seed
```

### Run Simulator (Optional)

```bash
docker compose -f .dev/docker-compose.yml --profile simulator up -d simulator
```
