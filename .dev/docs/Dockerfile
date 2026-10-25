# Local development image for the Docusaurus docs site.
# Requires BuildKit (default for `docker compose` v2) for RUN cache mounts.
FROM node:24-alpine

# Keep the npm download cache out of the image.
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@11.5.2

WORKDIR /app

# Pre-create the workspace directory owned by the non-root runtime user so that
# install runs as `node` (Docusaurus writes .docusaurus and node_modules/.cache
# at runtime) and no recursive chown layer is needed.
RUN mkdir -p apps/docs && chown -R node:node /app
USER node

# Docs has no workspace dependencies; only its own manifest is needed.
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/docs/package.json apps/docs/package.json

# The pnpm store lives in a BuildKit cache mount: it is reused across builds and
# images but is not shipped in the image; packages are copied into node_modules.
RUN --mount=type=cache,id=cluster-map-pnpm-store,target=/home/node/.cache/pnpm-store,uid=1000,gid=1000 \
    pnpm install --frozen-lockfile \
      --store-dir /home/node/.cache/pnpm-store \
      --package-import-method copy \
      --filter @repo/docs...

# Docs sources (docs, src, static and config files are also bind-mounted by
# compose for live reload).
COPY --chown=node:node apps/docs ./apps/docs

ENV NODE_ENV=development
WORKDIR /app/apps/docs

EXPOSE 3000

CMD ["pnpm", "start", "--host", "0.0.0.0", "--port", "3000"]
