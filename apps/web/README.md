# Forge HQ

React dashboard for the Forge AI software-company control plane.

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4 and Lucide.

The interface is the CEO-facing HQ for approvals, workforce state, development work and audit activity.

## Development

From the repository root:

```bash
pnpm install
pnpm --filter web dev
```

Vite proxies `/api` requests to the NestJS API during development.

## Validation

```bash
pnpm --filter web lint
pnpm --filter web build
```
