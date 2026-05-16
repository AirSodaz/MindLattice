# MindLattice Development Plan

## Goal

Build a desktop-first local app that helps adults with ADHD traits externalize task context, decompose work visually, and start from one small next action.

## Phase 0: Repository and Planning

Deliverables:

- Initialize `C:\Users\asoda\projects\MindLattice`.
- Add product, architecture, and development planning docs.
- Keep the repository documentation-only until implementation begins.
- Commit the initial planning baseline.

Acceptance criteria:

- The repository is a Git repository.
- `README.md`, `docs/product.md`, `docs/architecture.md`, and `docs/development-plan.md` exist.
- `git status` is clean after the initial commit.

## Phase 1: Rust Core and SQLite Storage

Purpose:

Create the product brain before building UI.

Deliverables:

- Rust workspace with `crates/core` and `crates/storage`.
- Domain types for workspaces, nodes, edges, maps, decomposition proposals, and next actions.
- SQLite schema and migrations.
- Repository layer for CRUD operations.
- Core graph validation.
- Unit and integration tests.

Key scenarios:

- Create a workspace.
- Create a focus task node.
- Add a subtask, blocker, note, resource, or next action.
- Connect nodes with typed edges.
- Move a node and persist its position.
- Soft-delete nodes and edges.

Acceptance criteria:

- Rust tests pass for domain validation and storage.
- UI-independent code can create and read a complete map snapshot.

## Phase 2: Tauri Command Boundary

Purpose:

Expose core behavior to the desktop app through stable typed commands.

Deliverables:

- Tauri 2 app shell under `apps/desktop`.
- Command handlers for workspace open, map read, node mutation, edge mutation, and settings.
- Shared DTO mapping between Rust and TypeScript.
- Structured error model.

Acceptance criteria:

- A command test or manual command probe can create a default workspace and read a map.
- Commands never expose raw database rows.
- Failed validation returns actionable errors.

## Phase 3: Star-Map Canvas MVP

Purpose:

Build the central experience of externalized working memory.

Deliverables:

- React/Vite UI under `apps/desktop/src`.
- React Flow canvas with node kinds and edge kinds.
- Quick capture input.
- Node creation, selection, editing, dragging, and connection.
- Right-side inspector for title, body, status, energy, friction, and estimate.
- Basic keyboard shortcuts for capture, save, and start mode.

Acceptance criteria:

- A user can create a focus task and see it centered.
- The user can add surrounding nodes and connect them.
- Moving nodes persists after reload.
- The UI remains usable without AI configuration.

## Phase 4: Low-Friction Start Mode

Purpose:

Turn the visual map into one startable action.

Deliverables:

- Next-action node type and status handling.
- Deterministic next-action suggestion rules.
- Start mode view showing one next action, parent task, and minimal context.
- Five-minute start timer or simple launch state.

Acceptance criteria:

- A task with next actions can enter start mode.
- Start mode hides distracting map complexity.
- The user can return to the full map without losing context.

## Phase 5: AI-Assisted Decomposition

Purpose:

Use AI as a controlled assistant for task decomposition.

Deliverables:

- `crates/ai` with `LlmProvider` trait.
- Configurable cloud adapter using `base_url`, `api_key`, and `model`.
- `decompose_preview` command.
- Proposal review UI.
- `decompose_accept` command that writes accepted proposals.
- Proposal validation and safety filters.

Acceptance criteria:

- Without AI settings, the manual app still works.
- With AI settings, the user can request a proposal.
- AI output does not write to storage until accepted.
- Invalid proposals are rejected with a clear error.

## Phase 6: Obsidian Vault Import and Export

Purpose:

Provide practical interoperability without making Obsidian the source of truth.

Deliverables:

- `crates/vault` for Markdown import/export.
- YAML frontmatter parser/writer.
- Wiki-link extraction.
- Export command and folder picker.
- Import command and preview summary.
- Golden tests for Markdown round trips.

Acceptance criteria:

- Exported files can be opened as readable Markdown.
- Import can create nodes from Markdown files.
- Wiki links become related edges when resolvable.
- SQLite remains authoritative after import/export.

## Phase 7: Polish, Packaging, and Validation

Purpose:

Make the MVP usable enough for real local testing.

Deliverables:

- Empty states and first-run local workspace creation.
- Settings page for AI provider configuration.
- Basic visual polish for the canvas and inspector.
- Error states for storage, AI, and import/export failures.
- Packaging configuration for Windows first.
- Smoke test checklist.

Acceptance criteria:

- Fresh install can create a workspace and first task.
- Local-only use path works with no API key.
- Build and tests pass.
- Windows packaged app opens and preserves local data.

## Testing Strategy

Rust:

- Unit tests for graph validation and proposal validation.
- Integration tests for SQLite migrations and repository behavior.
- Golden tests for Vault import/export.

Frontend:

- Component tests for inspector and proposal review where practical.
- End-to-end smoke tests for capture, map editing, reload persistence, and start mode.

Manual validation:

- Create a messy task.
- Break it into subtasks and blockers.
- Create at least one next action.
- Enter and leave start mode.
- Export to Markdown and inspect the files.

## Implementation Discipline

- Keep core logic out of React components.
- Keep Tauri command handlers thin.
- Add tests around every storage migration and domain rule.
- Prefer small commits per phase.
- Do not introduce sync, accounts, or clinical positioning in the MVP.
