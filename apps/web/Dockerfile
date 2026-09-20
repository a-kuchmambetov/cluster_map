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
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @repo/web build

FROM nginx:stable-alpine AS runtime
COPY apps/web/nginx.web.conf /etc/nginx/conf.d/default.conf
COPY --from=base /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
