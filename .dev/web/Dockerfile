# Local development image for the Vite web app.
# Requires BuildKit (default for `docker compose` v2) for RUN cache mounts.
FROM node:24-alpine

# Keep the npm download cache out of the image.
RUN --mount=type=cache,target=/root/.npm \
    npm install -g pnpm@11.5.2

WORKDIR /app

# Pre-create workspace directories owned by the non-root runtime user so that
# install and build steps run as `node` (Vite writes node_modules/.vite at
# runtime) and no recursive chown layer is needed.
RUN mkdir -p apps/web packages/types && chown -R node:node /app
USER node

# Manifests only for the projects this image runs.
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/web/package.json apps/web/package.json
COPY --chown=node:node packages/types/package.json packages/types/package.json

# The pnpm store lives in a BuildKit cache mount: it is reused across builds and
# images but is not shipped in the image; packages are copied into node_modules.
RUN --mount=type=cache,id=cluster-map-pnpm-store,target=/home/node/.cache/pnpm-store,uid=1000,gid=1000 \
    pnpm install --frozen-lockfile \
      --store-dir /home/node/.cache/pnpm-store \
      --package-import-method copy \
      --filter @repo/web...

# Build the shared types package before copying app sources so app edits do
# not rebuild it.
COPY --chown=node:node tsconfig.base.json ./
COPY --chown=node:node packages/types ./packages/types
RUN pnpm --filter @repo/types build

# App sources (src, public, index.html and vite.config.ts are also
# bind-mounted by compose for HMR).
COPY --chown=node:node apps/web ./apps/web

ENV NODE_ENV=development
WORKDIR /app/apps/web

EXPOSE 5173

CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
