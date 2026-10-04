# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@12.8.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api build

FROM nousresearch/hermes-agent:v2026.9.24 AS hermes
FROM hermes AS runtime
WORKDIR /app
USER root
ENV NODE_ENV=production
ENV PORT=3000
ENV HERMES_HOME=/opt/data
ENV HERMES_WORKDIR=/workspace
ENV HERMES_TIMEOUT_MS=600000
ENV HERMES_WRITE_SAFE_ROOT=/workspace:/opt/data
ENV PATH="/opt/hermes/bin:/opt/hermes/.venv/bin:/opt/data/.local/bin:${PATH}"
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@12.8.1 \
    && mkdir -p /app /workspace /opt/data \
    && chmod 755 /app /workspace /opt/data
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api/hermes.config.yaml /app/hermes.config.yaml
ENTRYPOINT []
EXPOSE 3000
CMD ["sh", "-c", "if [ ! -f /opt/data/config.yaml ]; then cp /app/hermes.config.yaml /opt/data/config.yaml; fi; pnpm --filter api exec prisma migrate deploy && node apps/api/dist/main.js"]