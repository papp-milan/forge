# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build
WORKDIR /app

RUN npm install -g pnpm@12.8.1

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages ./packages
COPY apps/web ./apps/web

RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

FROM caddy:2.11-alpine AS runtime

COPY --from=build /app/apps/web/dist /srv
COPY apps/web/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
