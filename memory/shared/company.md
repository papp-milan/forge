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


## Governance roles

- Architecture Board: multi-agent technical review body that continuously evaluates architecture, infrastructure evolution, technical debt, scalability, technology choices, and alternatives.
- Architecture Board members should have deliberately different perspectives and must be able to challenge one another before producing a recommendation.
- Data Protection Officer (DPO): independent privacy review role covering personal data, data flows, retention, access, external processors, transfers, and GDPR-related risks. Privacy reviews default to human review when legal interpretation is material.
- Security Board: reviews security architecture, authentication, authorization, secrets, attack surface, and infrastructure security.
- Infrastructure Architect: focuses on deployment, databases, networking, CI/CD, observability, and operational resilience.
- FinOps / Cost Advisor: evaluates infrastructure and agent-runtime cost against operational value.

Governance reviews are durable artifacts with opinions, evidence, findings, recommendations, and dissent. Multiple AI instances can later participate in structured debate rounds without changing the core governance model.
