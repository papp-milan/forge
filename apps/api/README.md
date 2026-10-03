# Forge API

NestJS control plane for Forge.

## Responsibilities

The API owns projects, features, tasks, workforce, CEO approvals, lifecycle orchestration, governance, GitHub synchronization, agent runs/sessions, audit logging, memory and deterministic worker execution.

## Development

```bash
pnpm install
docker compose up -d
pnpm dev:api
```

Development startup generates Prisma and applies committed migrations.

## Checks

```bash
pnpm --filter api build
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:e2e
```

## Security

Configure `FORGE_API_KEY` and an explicit `FORGE_CORS_ORIGINS` allowlist for protected deployments. `FORGE_RATE_LIMIT_PER_MINUTE` controls the API rate limit.

## Runtime

The deterministic runtime is the current safe execution mode. External agent-runtime integration is intentionally deferred.
