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

RUN pnpm --filter @repo/web install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/types ./packages/types
COPY apps/web ./apps/web
ARG VITE_API_URL=
RUN pnpm --filter @repo/web build

FROM owasp/modsecurity-crs:4.29.0-nginx-alpine-202609180209 AS runtime
# Removed NGINX_ENVSUBST_FILTER as CRS image needs more env var and this filter
# is no longer valid.
COPY apps/web/nginx.web.conf /etc/nginx/templates/conf.d/default.conf.template
COPY apps/web/waf-rules/ /opt/owasp-crs/rules/
COPY --chmod=755 apps/web/docker-entrypoint.d/19-validate-upstream.sh /docker-entrypoint.d/19-validate-upstream.sh
COPY --from=base /app/apps/web/dist /usr/share/nginx/html
# /healthz is served by the image's location_common.conf without reaching the
# API, so this reports on nginx itself rather than on the upstream.
HEALTHCHECK CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
