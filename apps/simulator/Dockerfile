FROM node:24-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@11.5.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/simulator/package.json apps/simulator/package.json
COPY packages/db/package.json packages/db/package.json

FROM base AS builder
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY apps/simulator/src ./apps/simulator/src
COPY apps/simulator/tsconfig.json ./apps/simulator/tsconfig.json
COPY packages/db/src ./packages/db/src
COPY packages/db/tsconfig.json ./packages/db/tsconfig.json
RUN pnpm --filter @repo/simulator... build

FROM base AS production-dependencies
RUN pnpm install --prod --frozen-lockfile

FROM node:24-alpine AS runner
# Demo/staging deployments must explicitly override this runtime guard.
ENV NODE_ENV=production
ARG INFISICAL_CLI_VERSION=0.43.133
RUN apk add --no-cache bash curl && \
    curl -fsSL https://artifacts-cli.infisical.com/setup.apk.sh -o /tmp/infisical-setup.sh && \
    sh /tmp/infisical-setup.sh && apk add --no-cache "infisical=${INFISICAL_CLI_VERSION}" && \
    rm /tmp/infisical-setup.sh
COPY --chmod=755 apps/simulator/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
WORKDIR /app/apps/simulator
COPY --from=production-dependencies /app/node_modules /app/node_modules
COPY --from=production-dependencies /app/apps/simulator/node_modules ./node_modules
COPY --from=production-dependencies /app/packages/db/node_modules /app/packages/db/node_modules
COPY apps/simulator/package.json ./package.json
COPY packages/db/package.json /app/packages/db/package.json
COPY --from=builder /app/apps/simulator/dist ./dist
COPY --from=builder /app/packages/db/dist /app/packages/db/dist
USER node
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
