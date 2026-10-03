---
id: company-core
type: fact
confidence: high
source: system
created: 2026-10-03
updated: 2026-10-03
---

# Forge

Forge is an autonomous AI software company controlled through a CEO-facing HQ.

## Core architecture

- Forge is the control plane and workflow orchestrator.
- PostgreSQL stores operational state.
- GitHub is the source of truth for code and delivery.
- Obsidian-style Markdown memory stores long-term shared and employee knowledge.
- Hermes is intended to become the agent runtime.
- Claude Code is intended to power software-engineering work.

## Human gate

The CEO approves consequential product decisions and releases. Agents may analyze, propose, implement, test, and prepare releases autonomously, but product decisions remain human-gated.

## Delivery lifecycle

Project → Team Lead decision → approval → feature → tasks → implementation → QA → ready for review → CEO release → deployment.

## Agent roles

- Athena: Team Lead / product planning
- Hephaistos: Software Engineering
- Artemis: QA
- Apollo: UI/UX
- Nike: Release
- Atlas: DevOps / infrastructure
- Hermes: orchestration / agent runtime
