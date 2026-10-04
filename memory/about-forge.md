# Forge — About / Memory

## What Forge is

Forge is an AI software company and engineering control plane. A human Product Owner steers product direction through explicit approvals while specialized AI agents handle planning, implementation, QA, and release/deployment workflows.

## What Forge can do

- Persist projects, ideas, decisions, features and tasks.
- Let Athena analyze projects and create structured proposals.
- Route implementation work to specialized agents through Hermes.
- Create and track GitHub Issues, branches and pull requests.
- Run Artemis QA and retry failed engineering work.
- Persist worker activity, decisions, releases and other audit events.
- Maintain persistent Markdown-compatible organizational memory.
- Operate an autonomous Team Lead and worker loop when enabled.
- Keep consequential product decisions behind explicit human approval gates.

## Workforce

| Agent | Role | Responsibility |
|---|---|---|
| Athena | Team Lead | Planning, project analysis, opportunities and structured proposals |
| Apollo | UI/UX | Interface and frontend design/implementation |
| Hephaistos | Engineering | Software implementation and pull requests |
| Artemis | QA | Quality review, validation and retry feedback |
| Nike | Release | Release responsibilities |
| Atlas | DevOps | Infrastructure and deployment responsibilities |
| Hermes | Runtime | Executes AI workers and tools |

## Core workflow

Idea → Athena → Task → Apollo/Hephaistos → GitHub PR → Artemis QA → approval/retry → release → production.

## Technology

- React 19, TypeScript, Vite
- Tailwind CSS v4, shadcn/ui, Base UI, Lucide, Inter
- NestJS 12, PostgreSQL, Prisma 7
- Hermes Agent with structured stream-json execution
- GitHub App, GitHub Issues/branches/PRs/webhooks/Actions
- Docker Compose and Caddy
- Persistent Markdown memory and JSONL audit history

## Design principle

Human direction, specialized agent execution, explicit approval boundaries, GitHub as the code source of truth, persistent memory, and auditable autonomous work.
