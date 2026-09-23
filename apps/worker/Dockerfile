FROM node:24-alpine AS base

WORKDIR /app

RUN npm install -g pnpm@11.5.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json

FROM base AS builder

RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY apps/worker/src ./apps/worker/src
COPY apps/worker/tsconfig.json ./apps/worker/tsconfig.json
COPY packages/db/src ./packages/db/src
COPY packages/db/tsconfig.json ./packages/db/tsconfig.json

RUN pnpm --filter @repo/worker... build

FROM base AS production-dependencies

RUN pnpm install --prod --frozen-lockfile

FROM node:24-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app/apps/worker

COPY --from=production-dependencies /app/node_modules /app/node_modules
COPY --from=production-dependencies /app/apps/worker/node_modules ./node_modules
COPY --from=production-dependencies /app/packages/db/node_modules /app/packages/db/node_modules
COPY apps/worker/package.json ./package.json
COPY packages/db/package.json /app/packages/db/package.json
COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/packages/db/dist /app/packages/db/dist
COPY packages/db/migrations /app/packages/db/migrations

USER node

CMD ["node", "dist/index.js"]
