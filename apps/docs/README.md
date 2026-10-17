# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator. It contains the Cluster Map project documentation; content lives in `docs/`, and pages under `docs/archive/` are historical agreements rather than the current contract.

From the repository root, `pnpm start:docs` and `pnpm build:docs` run the commands below. The root `pnpm build` and `pnpm dev` exclude the docs site.

## Installation

```bash
pnpm install
```

## Local Development

```bash
pnpm start
```

This command starts a local development server at http://localhost:3000 without opening a browser (`--no-open`). Most changes are reflected live without having to restart the server.

## Build

```bash
pnpm build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.
