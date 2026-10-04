# Production Hermes runtime

Forge production can run the real Hermes runtime inside the API container.

## Enable autonomous Hermes

Add these values to the server's `.env.production`:

```env
AGENT_RUNTIME=hermes
HERMES_TIMEOUT_MS=600000
```

Do not commit provider credentials.

## One-time Nous Portal authentication

The production compose persists Hermes state in the `forge-hermes` volume. Authenticate that volume once on the production host:

```bash
cd /opt/forge
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api hermes auth add nous
```

Complete the Nous Portal authentication flow. The credentials stay in the persistent Hermes volume and are not stored in Git.

Verify:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api hermes portal info
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm api hermes model
```

The seeded Forge config selects `stealth/space-bunny-alpha` through the `nous` provider. If you intentionally choose another model, update the persistent Hermes config on the server.

## Deployment

After the Forge release containing this runtime support is deployed:

1. Authenticate Hermes once as above.
2. Set `AGENT_RUNTIME=hermes` in `.env.production`.
3. Restart the production stack.
4. Refresh Forge and confirm the worker badge changes from `OFFLINE · DETERMINISTIC · AUTONOMOUS DISABLED` to the Hermes worker state.
5. Create a small test Idea and observe the Activity feed before approving any release gate.

The worker remains disabled in production unless `AGENT_RUNTIME=hermes` (or the explicit deterministic override) is set, so deploying the image alone does not silently start autonomous work.
