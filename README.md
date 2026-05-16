# MindLattice

MindLattice, Chinese working name "心格", is a desktop-first LLM-dependent self-help execution support tool for adults with ADHD traits who need help turning messy working memory into visible, startable action.

The project is currently documentation-first. It does not yet include generated Tauri, React, Rust, or SQLite scaffolding.

## Product Boundary

MindLattice is not medical software. It MUST NOT claim to diagnose ADHD, treat ADHD, replace clinicians, recommend medication, interpret symptom scales, provide clinical advice, or reduce ADHD symptoms.

The product supports practical execution outcomes:

- Find one small action to start.
- Identify the current blocker.
- Try one low-risk support template, environmental adjustment, routine anchor, or attention guard.
- Return to context after pausing or being interrupted.
- Record whether a support helped without streak pressure, shame, or symptom scoring.

## MVP Loop

The MVP proves one conversational execution loop with local SQLite as the source of truth:

1. The user describes a messy task, blocker, or state in natural language.
2. The conversational execution agent observes the current map, selected context, prior preview, confirmed memory, and available support templates.
3. The agent proposes an execution scaffold: star-map nodes and edges, blockers, resources, supports, next actions, and a start plan.
4. The star-map canvas shows the scaffold as an editable preview, not persisted truth.
5. The user revises the preview in natural language until it fits.
6. The user explicitly accepts the preview before graph changes, support records, preferences, or check-ins are stored.
7. The accepted map reduces to one next action with a low-stimulus Start Mode.
8. The agent helps record a calm follow-up and any support experiment result.

## First Release Boundaries

Included:

- Tauri 2 desktop shell with React/Vite UI.
- Conversational execution agent as the primary interaction model.
- React Flow star-map canvas.
- Low-stimulus one-thing start mode.
- Rust shared core for domain rules and safety boundaries.
- SQLite as the local source of truth.
- Local support templates, strategy cards, and strategy experiment records.
- Required LLM provider setup through a pluggable cloud model adapter.
- Core-governed tool loop, structured agent skills, versioned prompts, and confirmed memory.
- Manual Obsidian-compatible Markdown import and export.

Excluded:

- Account system, built-in sync, mobile UI, and multi-user collaboration.
- Obsidian plugin runtime or realtime Vault synchronization.
- Clinical, diagnostic, medication, symptom scoring, or clinician-reporting workflows.
- Claims that the app prevents, mitigates, treats, or reduces ADHD symptoms.

## Architecture Summary

MindLattice keeps product rules out of the interface:

- `apps/desktop`: Tauri desktop app and React UI.
- `crates/agent`: conversational agent loop, tool routing, structured skills, preview state, prompt orchestration, and confirmed memory policy.
- `crates/core`: domain model, graph rules, support templates, strategy experiments, start plans, proposal validation, and safety boundaries.
- `crates/storage`: SQLite migrations and repositories.
- `crates/ai`: provider trait, request/response DTOs, and cloud adapter.
- `crates/vault`: manual Markdown import and export.

The desktop UI MUST call typed Tauri commands for mutations. It MUST NOT directly read or write SQLite or own core task rules.

## Documentation

- [Documentation Index](docs/README.md)
- [Product Requirements](docs/product.md)
- [Architecture](docs/architecture.md)
- [Development Plan](docs/development-plan.md)
- [Documentation Standards](docs/documentation-standards.md)

## Repository Status

This repository is intentionally small while the product shape is being validated. Implementation SHOULD begin from the documented architecture instead of inheriting premature scaffold structure.
