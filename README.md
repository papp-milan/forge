# Forge

Forge is an autonomous AI software company and engineering control plane.

## Vision

Forge lets a human Product Owner steer product direction through explicit approvals while specialized AI agents handle planning, implementation, QA, and eventually release/deployment.

~~~text
CEO / Product Owner
        |
        v
   Forge Control Plane
        |
   +----+----------------+
   |                     |
PostgreSQL             GitHub
   |                     |
   +----------+----------+
              |
        Hermes Runtime
              |
   +----------+----------+
   |          |          |
 Athena     Apollo   Hephaistos
Team Lead    UI/UX   Engineering
                         |
                      Artemis
                         QA
                         |
                    Nike / Atlas
                   Release / DevOps
~~~

## Current stack

- **Web:** React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Base UI, Lucide, Inter
- **Visual direction:** high-contrast Forge/Olympus command center inspired by comic/manga interfaces, Persona-like graphic energy and Hermes-style agent tooling; bright agent colors, hard shadows, grain/noise, glow and directional motion
- **API:** NestJS 12, TypeScript, ESM, PostgreSQL, Prisma 7
- **Automation:** GitHub App, GitHub webhooks, GitHub Issues/branches/PRs
- **Employees:** Athena, Apollo, Hephaistos, Artemis, Nike, Atlas — each with a stable role color
- **Agents:** Athena, Apollo, Hephaistos, Artemis (with Nike/Atlas as DEVOPS workforce roles)
- **Runtime:** Hermes Agent via structured `stream-json` execution
- **Memory:** versionable files under `memory/`
- **Audit:** daily JSONL audit log under `memory/audit/`

## Repository layout

~~~text
forge/
├── apps/
│   ├── web/                 # Forge HQ dashboard
│   └── api/                 # NestJS control plane
├── packages/
│   └── shared/
├── memory/                  # Persistent memory and audit data
├── docker-compose.yml       # Local PostgreSQL
├── package.json
└── pnpm-workspace.yaml
~~~

## AI organization

| Agent | Role | Current responsibility |
|---|---|---|
| **Athena** | Team Lead | Project analysis, opportunities, structured proposals and decisions |
| **Apollo** | UI/UX | UI/UX implementation tasks |
| **Hephaistos** | Engineering | Software implementation tasks |
| **Artemis** | QA | Review and quality checks |
| **Hermes** | Runtime | Executes AI workers and tools |
| **Nike** | Release | Planned release agent |
| **Atlas** | DevOps | Planned infrastructure/deployment agent |

The GitHub App is named **Forge of Hephaistos**.

## Autonomous workflow

1. Athena analyzes a project.
2. Athena creates a persisted `AgentDecision`.
3. The CEO approves, rejects, or otherwise resolves the decision when approval is required.
4. Approved proposals can create Features and Tasks.
5. Forge prepares GitHub Issues and task branches.
6. Apollo and Hephaistos execute assigned work through Hermes.
7. Completed work is submitted as a pull request.
8. Artemis reviews tasks in `IN_REVIEW`.
9. Passing tasks become `DONE`.
10. When all feature tasks are complete, the Feature becomes `READY_FOR_REVIEW`.
11. The CEO can release the feature.
12. Nike/Atlas and deployment automation will take over more release responsibility as those components are implemented.

### Human approval boundary

Athena currently supports these decision types:

- `NO_ACTION`
- `CREATE_PITCH`
- `INVESTIGATE`
- `UPDATE_MEMORY`
- `ESCALATE`

Decisions have priorities from `LOW` to `CRITICAL` and can require explicit CEO approval. Important product decisions are therefore persisted and auditable rather than being hidden inside an agent session.

## Task and feature lifecycle

Tasks:

~~~text
TODO -> IN_PROGRESS -> IN_REVIEW -> DONE
                       |
                       +-> BLOCKED
~~~

Features:

~~~text
PROPOSED -> PLANNED -> IN_PROGRESS -> QA -> READY_FOR_REVIEW -> RELEASED
~~~

## GitHub integration

Forge's GitHub App currently supports:

- repository access
- GitHub Issues
- branch creation
- pull request creation
- pull request inspection and merging
- webhook handling
- workflow-run event handling
- task-to-Issue/branch/PR tracking

Webhook deliveries are persisted and deduplicated so GitHub events can be audited safely.

## Hermes runtime

Hermes Agent is integrated as the worker/runtime layer, not as the Forge orchestrator. Forge owns workflow state, approvals, memory, GitHub state, and agent decisions; Hermes executes AI workers inside prepared workspaces.

The API invokes Hermes with structured `stream-json` output and extracts session ID, text, exit code, and token usage when available.

The runtime expects a local `hermes` executable. Autonomous AI execution therefore requires Hermes to be installed and configured on the machine running the API.

## Autonomous loops

When `FORGE_AUTONOMOUS=true`, Forge runs two periodic loops:

### Team Lead loop

`OrchestratorLoopService` runs Athena against all projects.

### Worker loop

`AgentWorkerLoopService` prepares tasks, creates missing GitHub Issues and branches, dispatches Apollo/Hephaistos, runs Artemis QA, and advances feature state.

Both loops are disabled by default. The interval defaults to five minutes and is clamped to a minimum of 30 seconds.

~~~env
FORGE_AUTONOMOUS="false"
FORGE_AUTONOMOUS_INTERVAL_MS="300000"
FORGE_WORKSPACE_ROOT="/tmp/forge-workspaces"
~~~

## Local development

Requirements:

- Node.js 24+
- pnpm 12+
- Docker
- GitHub App credentials for GitHub automation
- Hermes Agent for autonomous worker execution

Install dependencies and start PostgreSQL:

~~~bash
pnpm install
docker compose up -d
~~~

Run the API:

~~~bash
pnpm dev:api
~~~

The API development lifecycle automatically runs `prisma generate` and `prisma migrate deploy` before Nest starts, keeping the generated Prisma client and committed migrations aligned during local development.

Run the web app:

~~~bash
pnpm --filter web dev
~~~

Build validation:

~~~bash
pnpm build:api
pnpm --filter web build
~~~

## Database

PostgreSQL is provided through Docker. The compose setup maps container port `5432` to host port `5433` so it can coexist with a PostgreSQL instance already using the default host port.

~~~env
DATABASE_URL="postgresql://forge:forge_dev_password@localhost:5433/forge?schema=public"
~~~

Prisma uses the checked-in `prisma.config.ts` and Prisma 7.

## Environment

Important API configuration includes:

~~~env
DATABASE_URL="postgresql://forge:forge_dev_password@localhost:5433/forge?schema=public"
GITHUB_APP_ID="..."
GITHUB_INSTALLATION_ID="..."
GITHUB_PRIVATE_KEY_PATH="secrets/github-app.pem"
GITHUB_WEBHOOK_SECRET="..."
FORGE_AUTONOMOUS="false"
FORGE_AUTONOMOUS_INTERVAL_MS="300000"
FORGE_WORKSPACE_ROOT="/tmp/forge-workspaces"
HERMES_COMMAND="hermes"
HERMES_WORKDIR=""
HERMES_TIMEOUT_MS="300000"
~~~

Secrets must never be committed.

## Memory and audit

The `memory/` directory is intended for persistent organizational knowledge, including shared/team memory, agent-specific memory, project knowledge, decisions, learnings, and audit history.

Audit events are stored as:

~~~text
memory/audit/YYYY-MM-DD.jsonl
~~~

Audit events cover decisions, worker activity, QA, releases, memory changes, and orchestrator errors.

## API areas

The API currently contains modules for projects, employees, features, pitches, tasks, GitHub, webhooks, orchestration, agent decisions, autonomous workers, Hermes runtime, audit logging, and memory.

API routes use the `/api` prefix.

## Roadmap

### Implemented

- Forge HQ dashboard foundation
- project/employee/feature/task management
- structured Team Lead proposals
- persisted Agent Decisions and CEO approval/rejection
- GitHub App integration
- GitHub Issues, branches, pull requests and webhooks
- audit logging
- autonomous Team Lead loop
- autonomous worker loop
- idempotent system employee initialization
- Apollo UI/UX worker
- Hephaistos engineering worker
- Artemis QA worker
- Hermes runtime integration
- feature QA/review/release state flow

### Planned

- Hermes installation/configuration on the Forge host
- richer agent context and persistent individual memory
- autonomous memory maintenance
- dedicated Nike release agent
- dedicated Atlas DevOps agent
- GitHub Actions deployment orchestration
- richer agent health, bottleneck and manpower views
- email/SMS notifications
- stronger worker retries and execution idempotency
- production observability
- production deployment of Forge itself

## Design principles

### Human decides, agents execute

Product direction remains human-gated. Agents can investigate, propose, implement, test, and report, while consequential product decisions are represented explicitly.

### GitHub is the source of truth for code

Code, branches, pull requests, issues, and CI/CD remain in GitHub. Forge orchestrates the work around them.

### Memory is persistent

Important organizational knowledge should survive individual agent sessions and remain versionable.

### Agents are specialized

Each agent should have a clear responsibility rather than one general-purpose agent doing everything.

### Important work is auditable

Decisions, worker execution, QA, releases, and failures should leave an inspectable history.

## Project status

Forge is in active foundational development. The control plane, GitHub integration, agent decision flow, autonomous loops, specialized workers, audit system, and Hermes runtime integration are now in place and being extended toward a continuously operating AI software company.

## Current runtime and autonomy additions

Forge can now run without Hermes installed locally. Set `AGENT_RUNTIME="deterministic"` for a safe simulation runtime; set `AGENT_RUNTIME="hermes"` once Hermes is available. The deterministic runtime is intentionally side-effect-light: worker tasks can progress through the engineering/QA state machine without creating real pull requests.

Additional control-plane capabilities now include:

- **Workforce intelligence:** `GET /api/workforce` reports active work, blocked work, utilization and bottlenecks per employee.
- **GitHub synchronization:** `POST /api/github/sync/projects/:projectId` reconciles open issues, pull requests, branches and recent commits with Forge task state.
- **Agent runtime abstraction:** workers use a runtime interface rather than depending directly on Hermes.
- **Memory lifecycle:** agents/system code can record facts, decisions and learnings into the Markdown/Obsidian-compatible memory tree.
- **Worker simulation:** `POST /api/agents/worker/run-once` executes one worker cycle using the configured runtime.
- **Memory location:** `FORGE_MEMORY_ROOT` can point Forge at an Obsidian vault or another persistent Markdown root.

The dashboard design direction is now a high-contrast Forge/Olympus command center influenced by comic/manga graphics, Persona-like visual energy and Hermes/Nous-style agent tooling. The UI uses bright agent colors, hard offset shadows, grain/noise, glow and directional motion rather than generic glassmorphism. UI concept sketches live in `/sketches`.

### Current delivery safeguards

The worker loop respects the feature lifecycle gates:

`PLANNED → IN_PROGRESS → QA → READY_FOR_REVIEW → RELEASED`

When all implementation tasks are complete, the worker moves an `IN_PROGRESS` feature to `QA`; it does not skip the QA gate and jump directly to CEO release review. The CEO-facing `Approve QA` action remains the transition into `READY_FOR_REVIEW`.

GitHub synchronization also avoids resurrecting completed tasks: discovering a pull request only moves `TODO` or `IN_PROGRESS` tasks into `IN_REVIEW`.

In `AGENT_RUNTIME=deterministic`, worker execution and feature release are explicitly simulated. Deterministic release does not require a real pull request merge; Hermes/real runtime keeps the GitHub merge gate.

The dashboard also treats agents as visible characters rather than static rows:

- **Animated tab transitions:** switching HQ tabs slides/skews the incoming view according to navigation direction.
- **Agent theatre:** each employee has animated ASCII art with role-specific silhouettes.
- **Live agent states:** agents sleep when they have no open work, animate as working when tasks are queued, and switch to a blocked state when assigned work is blocked.
- **Reduced-motion support:** CSS animations are disabled when the user requests reduced motion.
