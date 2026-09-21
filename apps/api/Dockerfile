FROM node:24-alpine AS base
WORKDIR /app
RUN npm install -g pnpm@11.5.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/docs/package.json apps/docs/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/errors/package.json packages/errors/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validators/package.json packages/validators/package.json

FROM base AS builder
RUN pnpm --filter @repo/api... install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @repo/api... build

FROM base AS runtime
ENV NODE_ENV=production
ARG INFISICAL_CLI_VERSION=0.43.133
RUN apk add --no-cache bash curl && \
    curl -fsSL https://artifacts-cli.infisical.com/setup.apk.sh -o /tmp/infisical-setup.sh && \
    sh /tmp/infisical-setup.sh && apk add --no-cache "infisical=${INFISICAL_CLI_VERSION}" && \
    rm /tmp/infisical-setup.sh
COPY --chmod=755 apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN pnpm --filter @repo/api... install --prod --frozen-lockfile
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/errors/dist ./packages/errors/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/validators/dist ./packages/validators/dist
COPY packages/db/src ./packages/db/src
COPY packages/db/migrations ./packages/db/migrations
COPY packages/db/drizzle.config.ts ./packages/db/drizzle.config.ts
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# The cluster service reads this path relative to the API working directory.
COPY apps/api/src/config/clusters.json ./apps/api/src/config/clusters.json
WORKDIR /app/apps/api
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD curl -fsS http://localhost:5000/api/health/ready || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
