# MindLattice Development Plan

| Field | Value |
| --- | --- |
| Status | Draft |
| Owner | Engineering |
| Last updated | 2026-05-17 |
| Scope | MVP implementation sequencing and validation |

## Goal

Build a desktop-first LLM-dependent local app that helps adults with ADHD traits use a conversational execution agent to externalize task context, decompose work visually, try low-risk execution supports, and start from one small next action.

## Phase Overview

| Phase | Name | Depends on | Primary outcome |
| --- | --- | --- | --- |
| 0 | Repository and planning | None | Docs-first baseline exists. |
| 1 | Rust core, storage, and support content | Phase 0 | UI-independent domain, persistence, and safety rules work. |
| 2 | Agent orchestrator, skills, prompts, and LLM adapter | Phase 1 | Conversational execution agent can produce validated previews. |
| 3 | Tauri command boundary | Phase 2 | Desktop shell can call typed core and agent operations. |
| 4 | Conversational star-map canvas MVP | Phase 3 | User can talk to the agent, revise previews, and persist accepted maps. |
| 5 | Low-friction Start Mode and follow-up | Phase 4 | User can reduce a map to one action, start, and check in through the agent. |
| 6 | Obsidian import/export | Phase 4 | Manual Markdown interoperability works. |
| 7 | Polish, packaging, and validation | Phases 1-6 | Windows local MVP is ready for testing. |

## Phase 0: Repository and Planning

Deliverables:

- Git repository at `C:\Users\asoda\projects\MindLattice`.
- `README.md`, `docs/product.md`, `docs/architecture.md`, and `docs/development-plan.md`.
- Documentation governance files.
- No generated application scaffold.

Acceptance criteria:

- Repository is initialized.
- Required planning docs exist.
- Documentation states product boundary, architecture boundary, and MVP sequencing.

## Phase 1: Rust Core, Storage, and Support Content

Status:

- Started. The repository contains a Cargo workspace with `crates/core` and `crates/storage`.
- Implemented so far: domain DTOs, typed node and edge validation, proposal limit and safety validation, static support templates, support-template adoption into support nodes, local strategy cards, strategy experiment validation, default context profiles, context profile validation, start-plan generation, attention-session creation, visible preference-memory proposal validation, versioned Phase 1 SQLite migration, schema migration version tracking, repository persistence for workspaces, nodes, edges, node notes, node execution metadata, map snapshots, strategy experiments, context profiles, attention sessions, AI proposal records, check-ins, accepted preference memory, agent skill runs, persisted agent thread, turn, preview-thread, and prompt-version state, and proposal lifecycle status tracking for active, accepted, and rejected previews.
- Not yet implemented: no remaining Phase 1 MVP implementation gap is currently listed.

Purpose:

Create the UI-independent domain, persistence, and safety foundation before building the agent and UI.

Deliverables:

- Rust workspace with `crates/core` and `crates/storage`.
- Domain types for workspaces, nodes, edges, maps, next actions, support templates, strategy experiments, execution metadata, context profiles, start plans, attention sessions, agent previews, memory proposals, and safety reviews.
- SQLite schema, migrations, and repositories.
- Graph validation and typed node/edge enforcement.
- Static support template and strategy-card registries.
- Strategy experiment recording.
- Context profile defaults.
- Start-plan data model and core validation rules.
- Attention session data model.
- Proposal size, medical, symptom, medication, and crisis safety validation.

Acceptance criteria:

- Rust tests pass for domain validation and storage.
- UI-independent code can create a workspace, focus task, connected map, and persisted map snapshot.
- UI-independent code can list support templates, adopt one, and record a keep/revise/pause/remove strategy experiment.
- UI-independent code can generate a start plan with one action, blocker, support, start check, and return cue.
- UI-independent code can validate agent previews without writing them.
- Proposal validation rejects diagnosis, treatment, medication, symptom interpretation, crisis, and limit-violating content.

## Phase 2: Agent Orchestrator, Skills, Prompts, and LLM Adapter

Status:

- Started. The repository contains `crates/ai` and `crates/agent`.
- Implemented so far: `LlmProvider` trait, structured LLM request/response DTOs, provider configuration validation, explicit `provider_id` and `api_mode` settings, API-mode-specific transports for OpenAI Chat Completions compatible, OpenAI Responses compatible, Claude Messages compatible, and Google Gemini native `generateContent`, live command-runtime provider wiring from saved LLM settings, legacy OpenAI-compatible LLM settings migration, first-release agent skill specs, documented first-release typed tool registry with skill-tool validation, typed tool router scaffold for map summary, map preview proposal, map preview revision, accepted-preview write planning for graph node and edge previews, accepted-preview write planning for preference-memory, check-in, and strategy-experiment payloads, preference-memory retrieval, preference-memory proposal, proposal validation, support-template search, start-plan generation, check-in proposal, strategy-experiment proposal, Vault import preview, and safety review, deterministic preference-memory retrieval scaffold with prompt-context integration, versioned prompt asset files for policy, role, workflow, tools, and output style, prompt golden fixtures for capture, preview revision, Start Mode drafting, support matching, medical-boundary rejection, and crisis redirection, intent classification, ordered prompt-layer assembly with version trace, bounded agent-turn runner, persisted active-preview state across file-backed runtime reopen, validated preview output, structured provider-preview JSON parsing for graph and non-graph preview payloads, confirm-before-write response copy, missing-provider failure, tool-budget failure, timeout-budget failure, malformed-provider-output recovery, and safety-block failure.
- Not yet implemented: no remaining Phase 2 MVP implementation gap is currently listed.

Purpose:

Build the controlled conversational execution agent before exposing it to the desktop UI.

Deliverables:

- `crates/agent` with bounded turn loop: observe, classify, plan, act, review, respond, and remember.
- `crates/ai` with `LlmProvider` and structured request/response DTOs.
- Configurable provider adapters using `provider_id`, `api_mode`, `base_url`, `api_key`, `model`, and timeout.
- Agent tool contracts for map summary, preview creation and revision, proposal validation, support search, start-plan generation, check-in proposal, strategy-experiment proposal, memory retrieval, memory proposal, safety review, and Vault import preview.
- Structured skill specs for capture, star-map decomposition, blocker identification, next-action narrowing, support matching, start-plan drafting, preview revision, check-in summarization, preference extraction, and safety redirection.
- Versioned prompt layers for policy, role, workflow, tool contracts, output style, and skills.
- Agent preview state model and confirmed memory policy.
- Tool-call budget, timeout budget, stop condition, malformed-output handling, and safety-block recovery.
- Golden tests for prompt and skill behavior.

Acceptance criteria:

- An agent turn can take a messy natural-language task and return a validated map preview.
- An agent turn can revise an active preview from natural-language feedback.
- An agent turn can draft a start plan preview from an accepted or proposed next action.
- The agent can propose, but not silently save, preference memory.
- Tool-call budget, timeout, malformed output, and safety-block paths return structured errors or short recovery messages.
- Prompt versions are recorded with skill runs or agent turns.

## Phase 3: Tauri Command Boundary

Status:

- Started. The repository contains a testable command-boundary crate at `apps/desktop/src-tauri`.
- Implemented so far: Tauri 2 app shell, file-backed app-data database path, `#[tauri::command]` bridge registration for the documented command names, default workspace open, map read, node create/update/move, edge create/delete, support-template listing, support adoption with persisted template-source note, adopted-support discard, strategy-card listing, strategy-experiment creation, attention-session start/close, context profile get/update, agent-turn submit with structured preview, preview get/reject, graph preview accept through the backend accepted-preview write plan, non-graph preview accept for preference-memory, check-in, and strategy-experiment payloads, mirrored AI proposal lifecycle status for active/accepted/rejected previews, preference-memory list/update/delete, check-in creation/listing with safety validation, LLM settings update with provider-config validation, LLM provider test command, explicit provider ID and API mode persistence, Vault import/export command coverage, native Vault folder-picker integration, generated TypeScript DTO artifact consumed by the frontend command client, missing-provider command error, DTO-level tests showing commands return typed core values rather than raw database rows, and structured command-error presentation in the React UI.
- Not yet implemented: no remaining Phase 3 MVP implementation gap is currently listed.

Purpose:

Expose core and agent behavior to the desktop app through stable typed commands.

Deliverables:

- Tauri 2 app shell under `apps/desktop`.
- Commands for workspace open, map read, node mutation, edge mutation, start plan, attention session, check-in, strategy cards, support templates, strategy experiments, context profile, agent turns, previews, memory management, import/export, and settings.
- Rust-to-TypeScript DTO mapping.
- Structured error model.

Acceptance criteria:

- A command probe can create a default workspace and read a map.
- A command probe can submit an agent turn and receive natural language plus a structured preview.
- A command probe can accept or reject a preview.
- A command probe can list, update, and delete preference memory.
- Support adoption, strategy experiment creation, and attention session start/close work through typed commands.
- Commands never expose raw database rows.
- Failed validation returns actionable structured errors.

## Phase 4: Conversational Star-Map Canvas MVP

Status:

- Started. The repository contains a React/Vite UI scaffold under `apps/desktop/src`.
- Implemented so far: `Quiet Workshop` semantic theme tokens for light and dark themes, an agent-first two-pane workbench layout, provider-gated agent thread with disabled composer before LLM setup, provider preset and API-mode controls, `i18next` and `react-i18next` localization for English and Simplified Chinese interface text, focused right turn context pane selection for provider setup, preview review, canvas, Start, advanced map editing, and one secondary task panel, React Flow star-map canvas rendering for persisted and preview nodes/edges, command-backed surrounding-node creation with inferred typed edges, active preview review controls, natural-language active-preview revision through the backend command client, advanced map surface with command-backed selected-node title/body editing, persisted node dragging from React Flow back into command-owned percentage positions, simple freeform edge editing between existing nodes, Start Mode surface, keyboard shortcuts for capture, selected-node save, and Start focus, support-template loading/adoption from the command client, adopted-support edit/discard from the UI and command boundary, custom user support node creation, reusable custom support-template library in the frontend workbench, direct strategy-experiment recording, visible saved check-in history, basic visible preference-memory management, theme preference resolution, language preference resolution, dependency-light workbench model/controller tests, component-level server-render smoke coverage for the Settings surface, dependency-light MVP business smoke coverage for setup, capture, preview acceptance, map editing, support adoption, Start Mode, check-in, memory review, and Vault import, Browser smoke coverage for first app load with provider setup gating and clean console output, and `corepack pnpm smoke:e2e` browser-driven automated smoke coverage against a running Vite app for first-load, provider test/save, agent preview/revision/acceptance, manual node and edge editing, support adoption, strategy experiment review, check-in and memory review, Vault import, Start Mode entry/return, and browser console warning/error checks.
- Not yet implemented: no remaining Phase 4 MVP implementation gap is currently listed.

Purpose:

Build the central conversation-first externalized-working-memory experience.

Deliverables:

- React/Vite UI under `apps/desktop/src`.
- Feature folders for `agent`, `capture`, `map`, `start-mode`, `strategies`, `check-ins`, and `settings`.
- Conversational execution agent thread as the primary input surface.
- React Flow canvas with task, subtask, blocker, note, resource, next action, support, check-in, and typed edge rendering.
- Quick capture through natural-language agent input.
- Preview rendering for proposed nodes, edges, support adoption, and memory updates.
- Natural-language preview revision flow.
- Explicit accept and reject controls for previews.
- Node creation, selection, editing, dragging, and connection.
- Inspector fields for title, body, status, energy, friction, estimate, minimum done, context tags, and support kind.
- Environmental adjustment panel, support-template browser, and local strategy-card browser.
- Keyboard shortcuts for capture, save, and Start Mode.

Acceptance criteria:

- User can create a focus task and see it centered.
- User can describe a messy task in natural language and see a validated star-map preview.
- User can revise the active preview in natural language.
- User can accept the preview and persist the proposed map changes.
- User can add and connect surrounding nodes manually when needed.
- User can choose, adopt, edit, or create one support template, environmental adjustment, or attention guard.
- Moving nodes persists after reload.

## Phase 5: Low-Friction Start Mode and Follow-Up

Status:

- Started. The React workbench initializes Start Mode from the command-backed `start_plan_get` DTO when a next action exists.
- Implemented so far: low-stimulus Start Mode panel rendering for one next action, parent task, minimum done, estimate, current blocker, one support or adjustment, start checks, return cue, dedicated Start Mode entry/exit view that hides map complexity, simple active-session timer state, natural-language follow-up prompt chips for check-ins, attention-session start/close controls from the command boundary, direct check-in persistence/listing from the command boundary with visible saved history and without scoring language, direct preference-memory proposal review with explicit accept/reject controls, strategy-experiment proposal review with explicit accept/reject controls, and LLM-drafted preference-memory and strategy-experiment preview payloads routed from agent follow-up turns into explicit frontend review queues before persistence.
- Not yet implemented: no remaining Phase 5 MVP implementation gap is currently listed.

Purpose:

Turn the visual map into one startable action and a calm return path through the agent.

Deliverables:

- Next-action status handling.
- Agent-assisted next-action narrowing.
- Low-stimulus one-thing view.
- Start check UI for materials, current distraction, five-minute fit, and reopen target.
- Agent-drafted start plan previews.
- Attention session start/close behavior.
- Agent-assisted follow-up prompts, check-in previews, and check-in persistence.
- Strategy experiment previews from follow-up conversation.
- Preference-memory proposals from accepted check-ins or experiments.
- Five-minute timer or simple launch state.

Acceptance criteria:

- A task with next actions can enter Start Mode.
- Start Mode hides distracting map complexity.
- User can ask the agent to make the next action smaller.
- User can define minimum done and record whether they started or got stuck through natural language or direct controls.
- User can record whether a support helped and choose keep, revise, pause, or remove.
- User can review and accept or reject preference-memory proposals.
- Check-ins never create streak pressure, shame language, symptom scoring, or productivity scoring.
- User can return to the full map without losing context.

## Phase 6: Obsidian Import and Export

Status:

- Started. The repository contains `crates/vault` with manual Markdown import/export helpers and command-boundary wiring for `vault_import` and `vault_export`.
- Implemented so far: readable one-file-per-node export with MindLattice frontmatter, metadata fields, relationship summaries, Markdown import from frontmatter/headings/filenames, CRLF and LF frontmatter/section parsing, deterministic suffix handling for duplicate imported titles and IDs, quoted scalar frontmatter values with common double-quoted escape sequences, literal and folded YAML block scalar values including `|-`, `|+`, `>-`, and `>+` chomping indicators, block-scalar blank-line and indent-indicator handling, block-scalar headers with inline comments, inline-comment stripping outside quoted YAML values, inline, multiline-flow, and block-list `context_tags` including quoted commas, Obsidian-style `tags` import as `context_tags`, wiki-link extraction, resolvable wiki links as `related` edges, typed edge import from exported relationship summaries, golden-style round-trip tests, native folder picker import/export through the Tauri dialog and filesystem plugins, and a manual React import-preview surface with explicit accept/reject before `vault_import`.
- Not yet implemented: no remaining Phase 6 MVP implementation gap is currently listed.

Purpose:

Provide manual Markdown interoperability without making Obsidian the source of truth.

Deliverables:

- `crates/vault` for Markdown import/export.
- YAML frontmatter parser and writer.
- Wiki-link extraction.
- Export command and folder picker.
- Import command and preview summary.
- Golden tests for Markdown round trips.

Acceptance criteria:

- Exported files can be opened as readable Markdown.
- Import can create nodes from Markdown files.
- Wiki links become `related` edges when resolvable.
- SQLite remains authoritative after import or export.

## Phase 7: Polish, Packaging, and Validation

Status:

- Started. Implemented so far: first-run local workspace creation through `workspace_open_default`, compact LLM provider setup in the right turn context pane, provider presets for OpenAI, Anthropic Claude, Google Gemini, Ollama/local OpenAI-compatible, and Custom, explicit manual API-mode selection, dedicated `settings_test_llm` connection testing before save/unlock, settings readiness groups for required LLM provider setup, local profile, safety boundary, and interface preferences, language preference controls for `system`, `en`, and `zh-CN`, `settings_update_llm` persistence, context-profile setup-state transition to `configured`, adult-context onboarding controls for local support matching, disabled agent composer before provider setup with no local fallback agent behavior, Windows Tauri bundle configuration with the packaged app icon enabled, manual MVP smoke-test checklist under `docs/smoke-test-checklist.md`, and Windows packaged build validation producing release executable, MSI, and NSIS installer artifacts.
- Not yet implemented: no remaining Phase 7 MVP implementation gap is currently listed.

Purpose:

Make the MVP usable enough for real local testing.

Deliverables:

- Empty states and first-run local workspace creation.
- Settings page for LLM provider configuration.
- Settings language preference for `system`, `en`, and `zh-CN`.
- First-run onboarding for adult contexts and common execution difficulties.
- Low-risk wellness boundary copy in onboarding and LLM setup.
- Agent setup path for required LLM provider configuration.
- Visual polish for the canvas and inspector.
- Error states for storage, LLM provider, agent tools, safety blocks, memory conflicts, and import/export failures.
- Safety copy review.
- Windows packaging configuration.
- Smoke test checklist.

Acceptance criteria:

- Fresh install can create a workspace and first task.
- Fresh install guides the user through required LLM provider setup before promising the agent workflow.
- After provider setup, fresh install enables natural-language capture, star map, Start Mode, strategy cards, support templates, and confirmed memory.
- Build and tests pass.
- Windows packaged app opens and preserves local data.

## Testing Strategy

Rust:

- Unit tests for graph validation and proposal validation.
- Unit tests for node and edge kinds.
- Unit tests for support-template category coverage and source/safety notes.
- Unit tests for strategy experiment keep/revise/pause/remove decisions.
- Unit tests for start-plan generation from next actions, blockers, support items, and environmental adjustments.
- Unit tests for start checks and attention session state changes.
- Unit tests for agent intent classification, tool budgets, preview revision, preview acceptance, memory proposal, and stop conditions.
- Golden tests for each agent skill.
- Golden tests for prompt behavior across capture, decomposition, revision, Start Mode drafting, check-in summarization, preference proposal, medical rejection, and crisis redirection.
- Unit tests for medical, medication, diagnosis, symptom-score, crisis, and proposal-limit safety validation.
- Unit tests for LLM API-mode URL composition, headers, payload shape, response parsing, and legacy settings migration.
- Integration tests for SQLite migrations and repository behavior.
- Golden tests for Vault import/export.

Frontend:

- Component tests for agent thread, provider setup, Settings language controls, preview review, inspector, environmental adjustment panel, support-template browser, strategy-card list, start-plan rendering, follow-up prompts, memory management, and proposal review.
- End-to-end smoke tests for natural-language capture, preview revision, preview acceptance, map editing, support adoption, reload persistence, Start Mode, one-thing view, strategy experiment recording, memory review, and check-in creation.
- Browser-driven automated smoke tests for first app load, Settings setup, agent preview/revision/acceptance, manual node and edge editing, support adoption, strategy experiment review, check-in and memory review, Vault import, Start Mode entry/return, and browser console warning/error checks through `corepack pnpm smoke:e2e`.

Manual validation:

- Configure an LLM provider.
- Switch provider presets and confirm Base URL, API mode, and model placeholders update without filling an API key.
- Switch language preference and confirm Settings, provider setup, agent, preview review, and Start Mode labels update.
- Describe a messy task in natural language.
- Let the agent propose subtasks and blockers.
- Revise the preview in natural language.
- Accept the preview.
- Add one support template, environmental adjustment, or attention guard.
- Create at least one next action.
- Enter and leave Start Mode.
- Ask the agent to make the action smaller.
- Complete the start check.
- Record whether the support helped and choose keep, revise, pause, or remove.
- Review any proposed preference memory.
- Record a check-in and confirm it does not create streak or shame copy.
- Verify that "am I ADHD", medication questions, and self-harm language do not enter ordinary agent task advice.
- Export to Markdown and inspect the files.

Documentation validation:

- Scan public copy for diagnosis, treatment, medication recommendation, symptom scoring, guaranteed focus, and clinical follow-up language.
- Scan public copy for claims that the app prevents, mitigates, or reduces ADHD symptoms.
- Confirm external references shape safety and support design only.

## Implementation Discipline

- Current Rust verification command: `cargo test --workspace`.
- Keep core logic out of React components.
- Keep agent orchestration out of React components.
- Keep Tauri command handlers thin.
- Add tests around every storage migration and domain rule.
- Keep strategy cards local and low-risk until there is a content governance process.
- Keep safety validation in Rust core so agent and UI paths share one boundary.
- Keep prompt and skill versions traceable.
- Prefer small commits per phase.
- Do not introduce sync, accounts, or clinical positioning in the MVP.
