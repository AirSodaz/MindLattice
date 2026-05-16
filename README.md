# MindLattice

MindLattice, Chinese working name "心格", is a desktop-first productivity tool for adults with ADHD traits who need help turning messy working memory into visible, startable action.

The product is inspired by Obsidian's local-first knowledge workspace, but the first version is not an Obsidian plugin. It focuses on task dimensionality reduction, visual externalization, and lowering task-start friction through a star-map task canvas.

## Product Positioning

MindLattice is a self-help productivity tool. It is not medical software and must not claim to diagnose ADHD, treat ADHD, replace clinicians, or provide clinical advice. Product language should stay practical: externalize, organize, reduce friction, choose a next action, and start gently.

## MVP

The first version should prove one loop:

1. Capture a messy task or responsibility quickly.
2. Place it as the focus node in a star-map canvas.
3. Expand it into visible surrounding nodes: subtasks, blockers, resources, notes, and next actions.
4. Ask AI for a decomposition proposal when configured.
5. Let the user review and accept suggestions before anything is stored.
6. Reduce the map to one small next action with a low-friction start mode.

## First-Version Boundaries

Included:

- Desktop app first.
- Tauri 2 shell with React/Vite UI.
- React Flow based star-map task canvas.
- Rust shared core for domain logic.
- SQLite as the source of truth.
- AI-assisted task decomposition through a pluggable cloud model adapter.
- Manual Obsidian Vault import and export.
- Local-first operation for all non-AI features.

Excluded from the first version:

- Account system.
- Built-in cloud sync.
- Mobile UI.
- Multi-user collaboration.
- Obsidian plugin runtime.
- Realtime Markdown/Vault synchronization.
- Clinical or diagnostic workflows.

## Architecture

MindLattice should keep the product brain separate from the interface:

- `apps/desktop`: Tauri desktop app and React UI.
- `crates/core`: pure Rust domain logic, data types, graph operations, proposal validation, and next-action rules.
- `crates/storage`: SQLite migrations and repositories.
- `crates/ai`: LLM provider trait, request/response DTOs, and cloud model adapter.
- `crates/vault`: manual Markdown/Obsidian import and export.

The desktop UI should call typed Tauri commands. It should not directly read or write SQLite and should not own core task rules.

## Documentation

- [Product Design](docs/product.md)
- [Architecture](docs/architecture.md)
- [Development Plan](docs/development-plan.md)

## Repository Status

This repository currently contains planning documentation only. It intentionally does not include generated Tauri, React, or Rust scaffolding yet, so the implementation can start from the documented architecture instead of inheriting premature structure.
