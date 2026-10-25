# Local development image shared by the api, worker and simulator services.
# Requires BuildKit (default for `docker compose` v2) for RUN cache mounts.
FROM node:24-alpine

# Keep the npm download cache out of the image.
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@11.5.2

WORKDIR /app

# Pre-create workspace directories owned by the non-root runtime user so that
# install and build steps run as `node` and no recursive chown layer is needed.
RUN mkdir -p apps/api apps/worker apps/simulator \
      packages/db packages/errors packages/types packages/validators && \
    chown -R node:node /app
USER node

# Manifests only for the projects this image runs, so unrelated manifest
# changes (web, docs) do not invalidate the dependency layer.
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/api/package.json apps/api/package.json
COPY --chown=node:node apps/worker/package.json apps/worker/package.json
COPY --chown=node:node apps/simulator/package.json apps/simulator/package.json
COPY --chown=node:node packages/db/package.json packages/db/package.json
COPY --chown=node:node packages/errors/package.json packages/errors/package.json
COPY --chown=node:node packages/types/package.json packages/types/package.json
COPY --chown=node:node packages/validators/package.json packages/validators/package.json

# The pnpm store lives in a BuildKit cache mount: it is reused across builds and
# images but is not shipped in the image; packages are copied into node_modules.
RUN --mount=type=cache,id=cluster-map-pnpm-store,target=/home/node/.cache/pnpm-store,uid=1000,gid=1000 \
    pnpm install --frozen-lockfile \
      --store-dir /home/node/.cache/pnpm-store \
      --package-import-method copy \
      --filter @repo/api... \
      --filter @repo/worker... \
      --filter @repo/simulator...

# Build shared workspace packages before copying app sources so app edits do
# not rebuild them.
COPY --chown=node:node tsconfig.base.json ./
COPY --chown=node:node packages ./packages
RUN pnpm --filter './packages/**' build

# App sources (src is also bind-mounted by compose for hot reload).
COPY --chown=node:node apps/api ./apps/api
COPY --chown=node:node apps/worker ./apps/worker
COPY --chown=node:node apps/simulator ./apps/simulator

ENV NODE_ENV=development
WORKDIR /app/apps/api

EXPOSE 5001

CMD ["./node_modules/.bin/tsx", "watch", "--include", "./src", "./src/index.ts"]
