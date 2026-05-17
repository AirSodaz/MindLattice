# Agent-First Turn-Led Workbench Design

| Field | Value |
| --- | --- |
| Status | Draft |
| Owner | Product and engineering |
| Last updated | 2026-05-17 |
| Scope | Product experience and implementation design for the refined MVP workbench |

## Purpose

MindLattice is an agent-first execution workbench for turning messy working memory into one visible, startable direction. The first-release experience MUST be organized around the current agent turn, not around a dashboard of features, a generic chat thread, or a full-time graph editor.

This document deepens the MVP design before implementation refactoring. It is the source document for later updates to `docs/product.md`, `docs/ui-style.md`, `docs/development-plan.md`, and `docs/smoke-test-checklist.md`.

## Product Thesis

The product promise is:

> Tell the agent what feels messy. MindLattice makes the current task visible, proposes the next useful structure, and saves only what the user confirms.

MindLattice is not a task manager with AI, a graph editor with chat, or a note app with decomposition helpers. It is a local-first agent workbench where conversation drives execution scaffolding and the map preserves visible working memory.

The first release should prove that a user can:

1. Configure an LLM provider clearly enough to unlock the agent.
2. Describe a messy task in natural language.
3. Review a short agent response and a focused preview.
4. Revise the preview fluidly without losing context.
5. Explicitly accept durable writes.
6. Reduce the accepted structure to a next action or Start Mode.
7. Leave a return cue, check-in, or preference memory only when it helps the execution loop.

## Design Principles

### Agent First

The agent is the primary interaction model. The user should not need to know command names, internal skills, storage concepts, node schemas, or prompt mechanics.

The UI may expose buttons, drawers, and editing controls, but those controls are secondary to the agent-led execution loop. They exist to review, correct, configure, or inspect what the agent is doing.

### Turn Led

The current agent turn is the organizing unit of the interface. Every visible surface should answer one of these questions:

- What did the user just ask?
- What is the agent doing now?
- What is the agent proposing?
- What will be saved if the user accepts?
- What can the user do next?

Surfaces that do not answer one of those questions should be hidden, collapsed, or moved into a task panel.

### Stable Two-Pane Workbench

The default workbench uses two stable panes:

- Left: agent panel, including readiness state, message thread, turn status, and composer.
- Right: turn context pane, which changes according to the current turn.

The layout MUST NOT become a permanent three-column workbench. Preview review, settings, memory, support templates, Vault import/export, and advanced graph editing should not all compete for the first viewport.

### Progressive Disclosure

The first viewport should not explain the whole product. It should show the next useful action.

Default visible surfaces:

- Agent readiness or current conversation.
- Current task or current turn focus.
- Active preview, next action, setup state, or Start card.
- Minimal confirmation controls when there is something to persist.

Secondary surfaces:

- Advanced graph editing.
- Support-template browsing.
- Saved memory management.
- Vault import/export.
- Diagnostic details.
- Long explanations and documentation-style help.

### LLM Setup Is First Class

MindLattice depends on a configured LLM provider for the primary agent workflow. The UI MUST be honest about this dependency.

When the provider is not configured:

- The agent panel is present but not operational.
- The composer is disabled.
- The agent panel shows a setup-required state.
- The primary action is `Configure LLM`.
- Activating `Configure LLM` opens the provider setup surface in the right turn context pane.
- The app MUST NOT imply that a local fallback agent can perform the main execution-scaffolding workflow.

### Less Text, Stronger Focus

The current UI and docs tend to preserve too much explanatory text. The refined workbench should treat text as part of interaction design.

Rules:

- Primary surfaces should use short labels, direct verbs, and one-line state explanations.
- Long rationale belongs in expandable details, help, docs, or diagnostic surfaces.
- Empty states should ask for the next user input, not describe the whole product.
- Preview summaries should say what changes, not how the system works internally.
- Safety and provider errors should be concise, calm, and actionable.

### Confirm Before Write Without Friction Theater

Confirm-before-write remains a core safety and trust rule. It should apply to durable changes, not every temporary draft movement.

Must require explicit acceptance:

- Creating, editing, or deleting graph nodes and edges from an agent preview.
- Saving preference memory.
- Saving check-ins.
- Saving strategy experiments.
- Adopting support templates from an agent proposal.
- Importing Vault content into the workspace.

May update temporary state without durable acceptance:

- Revising the current preview.
- Asking for a smaller next action inside the active preview.
- Changing draft wording before persistence.
- Showing or hiding support suggestions.
- Adjusting an unsaved Start plan draft.

The user should feel that the agent can work fluidly on a draft, while durable writes remain inspectable and user-controlled.

## Core Experience States

### 1. Provider Setup Required

Trigger:

- No saved LLM settings.
- Saved settings are invalid.
- Provider test has failed and the user has not corrected it.

Left agent panel:

- Shows setup-required copy.
- Disables the composer.
- Provides `Configure LLM`.
- May show one sentence explaining that the execution agent requires configured provider access.

Right turn context pane:

- Shows `ProviderSetupPanel` after the user clicks `Configure LLM`.
- Displays fields for `base_url`, `api_key`, `model`, and `timeout`.
- Provides `Test connection` and `Save`.
- Shows pending, success, failure, and timeout states.
- Keeps technical detail collapsed by default.

Exit condition:

- Provider settings test and save successfully.
- Agent panel moves to the agent-ready empty state.

### 2. Agent-Ready Empty Workspace

Trigger:

- Provider is configured.
- Workspace is empty or no current turn is active.

Left agent panel:

- Shows a short welcome line.
- Composer is focused or easy to reach.
- Prompt asks for a messy task, blocker, or responsibility.

Right turn context pane:

- Shows a minimal empty context surface.
- May show one quiet example of useful input.
- Does not show a full feature tour.

Exit condition:

- User submits a natural-language message.

### 3. Active Agent Turn

Trigger:

- User submits a message.
- User asks to revise an active preview.
- User asks for a smaller action, support suggestion, check-in, or Start plan.

Left agent panel:

- Shows latest user message.
- Shows short agent response.
- Shows turn status such as drafting, validating, blocked, timed out, or ready to review.
- Provides stop, retry, and composer behavior appropriate to the state.

Right turn context pane:

- Shows the most relevant surface for this turn:
  - Preview graph for decomposition.
  - Next-action card for narrowing.
  - Start card for starting.
  - Memory proposal card for preference memory.
  - Check-in or strategy-experiment proposal when following up.
  - Safety redirect when ordinary task advice is blocked.

The pane should not show unrelated drawers at the same time.

### 4. Preview Review

Trigger:

- The agent has proposed durable changes.

Left agent panel:

- Shows the concise explanation of the proposal.
- Keeps the composer available for revision.
- Indicates that nothing is saved yet.

Right turn context pane:

- Shows `PreviewReviewPanel`.
- Displays proposed graph changes, memory, check-ins, strategy experiments, support adoption, or Vault import summary.
- Uses preview styling that does not rely on color alone.
- Provides stable `Accept`, `Revise`, and `Reject` controls.
- Describes concrete write effects in short language.

Exit conditions:

- Accept persists validated changes and transitions to the relevant next state.
- Revise updates the current preview without persisting.
- Reject closes the preview and leaves persisted data unchanged.

### 5. Start and Follow-Up

Trigger:

- The user has an accepted next action.
- The user asks the agent to help start.

Left agent panel:

- Remains available unless a dedicated focus mode is active.
- Lets the user ask for a smaller action or record what happened.

Right turn context pane:

- Shows the selected next action, minimum-done definition, current blocker, one support or adjustment, and return cue.
- Shows calm start controls.
- Avoids scores, streaks, urgency badges, or guilt language.

Follow-up can propose check-ins, strategy experiments, or preference memory, but persistence still requires explicit acceptance.

### 6. Advanced Map Editing

Trigger:

- User opens advanced editing intentionally.
- User accepts a preview and wants to refine map structure manually.

Right turn context pane:

- Shows full graph editing, inspector, node and edge creation, and manual layout controls.
- Keeps the agent panel visible for natural-language revision or explanation.

Advanced editing is not the first-run path. It is a power surface for correction, spatial organization, and user-controlled cleanup.

## Information Architecture

### Primary Workbench

```text
WorkbenchShell
  AgentPanel
    SetupRequiredState
    MessageThread
    TurnStatus
    Composer
  TurnContextPane
    ProviderSetupPanel
    EmptyContextPanel
    PreviewReviewPanel
    TurnCanvasPanel
    StartPanel
    SafetyRedirectPanel
    AdvancedMapPanel
    TaskPanelHost
```

The shell owns layout, theme, keyboard shortcuts, and responsive behavior. It does not own agent logic, graph rules, provider transport, or persistence.

### Turn Context Pane Selection

The right pane should use deterministic selection:

1. If provider setup is required and setup is requested, show provider setup.
2. If a safety redirect is active, show the redirect surface.
3. If there is an active durable preview, show preview review.
4. If the current turn is about starting, show Start panel.
5. If the current turn has graph context, show turn canvas.
6. If the user requested advanced editing, show advanced map panel.
7. Otherwise show the empty context panel.

This prevents low-frequency tools from appearing as peer navigation during ordinary execution.

### Task Panels

Task panels are secondary, on-demand surfaces. They can open inside the right pane or as a contained overlay, but only one task panel should be active at a time.

Task panels include:

- Support templates.
- Preference memory management.
- Vault import/export.
- Settings beyond provider setup.
- Diagnostics.

Task panels MUST preserve the left agent panel so the user can return to conversation.

## LLM Provider Setup Design

Provider setup is part of the product, not a hidden settings chore.

Required fields:

- Provider preset.
- API mode.
- Base URL.
- API key.
- Model.
- Timeout seconds.

Required actions:

- Test connection.
- Save.
- Cancel or return to workbench.

Required states:

- Not configured.
- Editing.
- Testing.
- Test succeeded.
- Test failed.
- Save failed.
- Configured.

Rules:

- Provider presets MUST include OpenAI, Anthropic Claude, Google Gemini, Ollama / Local OpenAI Compatible, and Custom.
- Manual Base URL configuration MUST require one API mode: OpenAI Chat Completions compatible, OpenAI Responses API compatible, Claude Messages API compatible, or Google Gemini API compatible.
- Presets MUST NOT fill API keys.
- Base URL guidance MUST state that the value should stop at the API version level, not the full endpoint path.
- Do not unlock the agent composer until settings are saved and marked configured.
- Do not persist settings from a test connection.
- Do not clear entered values after a failed test.
- Keep error copy short.
- Put raw provider detail behind an expandable technical detail.
- Do not mention local fallback agent behavior.
- Make the non-medical boundary visible but brief.

## Preview and Persistence Model

Agent previews are draft objects. Accepted previews become durable records.

Preview categories:

- Graph preview: nodes and edges.
- Start-plan preview.
- Support adoption preview.
- Check-in preview.
- Strategy-experiment preview.
- Preference-memory preview.
- Vault import preview.

Preview lifecycle:

```text
none -> drafting -> validated -> awaiting_user -> accepted
                                      |
                                      -> revised -> validated
                                      |
                                      -> rejected
                                      |
                                      -> blocked
```

The UI should avoid exposing this lifecycle as raw state names. It should translate them into short user-facing states such as drafting, ready to review, blocked, saved, or discarded.

Persistence rules:

- The agent may create and revise previews.
- The agent may not directly persist durable writes.
- The UI may optimistically update temporary preview visuals.
- The backend remains responsible for validation before accept.
- The accept command persists exactly the reviewed preview or returns a conflict/error.

## Copy and Text Density Rules

### Agent Panel

Use:

- "Configure LLM to use the execution agent."
- "Tell me what feels messy right now."
- "I drafted a structure. Nothing is saved yet."
- "This will save 3 nodes and 2 links."
- "I could not complete that turn. Check the provider settings."

Avoid:

- Long feature tours.
- Clinical framing.
- Hidden tool narration.
- Motivational praise.
- Explaining every internal object on first view.

### Preview Review

Preview copy should answer:

- What will be created, changed, or saved?
- What can the user revise?
- What happens if they reject it?

It should not answer:

- Which internal skill ran.
- Which prompt layer generated the response.
- Why every field exists.

### Settings

Provider settings copy should be plain and operational:

- What field is needed.
- Whether the test worked.
- What the user can try next.

Long API compatibility guidance belongs in help or docs, not the default panel.

## Implementation Design

### Frontend Component Boundaries

`WorkbenchShell`

- Owns layout, theme, responsive breakpoints, and global keyboard shortcuts.
- Loads initial workbench state.
- Holds high-level state references or coordinates a future store.
- Delegates panels to focused components.

`AgentPanel`

- Renders setup-required state, message thread, turn status, composer, stop/retry controls.
- Receives provider readiness and turn state.
- Emits user messages and setup button events.
- Does not render right-pane settings or graph editing internals.

`TurnContextPane`

- Chooses the active right-pane surface.
- Receives current provider state, active preview, selected node, turn intent, and requested task panel.
- Does not perform persistence directly.

`ProviderSetupPanel`

- Owns form draft state for LLM settings.
- Calls provider test and save actions through the command client.
- Reports configured state back to the workbench.

`PreviewReviewPanel`

- Renders all preview categories through shared review structure.
- Owns accept, revise, and reject affordances.
- Shows short write summaries.

`TurnCanvasPanel`

- Renders the focused star-map or preview graph for the current turn.
- Distinguishes preview and persisted content.
- Avoids exposing full inspector controls unless advanced editing is active.

`StartPanel`

- Renders one next action and nearby context.
- Starts and closes attention sessions.
- Collects calm follow-up input.

`AdvancedMapPanel`

- Owns full graph editing, inspector, manual node creation, edge editing, and layout persistence.
- Is intentionally secondary.

`WorkbenchTaskPanels`

- Hosts support templates, memory management, Vault import/export, settings, and diagnostics.
- Enforces one active task panel at a time.

### State Model

The frontend should model these high-level state groups:

- `providerReadiness`: not configured, editing, testing, configured, failed.
- `turnState`: idle, submitting, drafting, validating, awaiting review, blocked, failed.
- `activePreview`: null or typed preview model.
- `rightPaneMode`: setup, empty, preview, canvas, start, safety, advanced map, task panel.
- `taskPanel`: support, memory, vault, settings, diagnostics, or null.
- `selectedGraphContext`: selected node, selected edge, or current preview focus.

The state model should make it difficult for provider setup, preview review, advanced editing, and unrelated task panels to appear as simultaneous first-class surfaces.

### Command Boundary

The existing typed command boundary remains the right direction. The refined UI should continue to use commands for mutations and provider settings.

Relevant commands:

- `settings_update_llm`
- Future or existing provider test command if available.
- `agent_turn_submit`
- `agent_preview_get`
- `agent_preview_accept`
- `agent_preview_reject`
- `agent_memory_list`
- `agent_memory_update`
- `agent_memory_delete`
- `map_get`
- `node_create`
- `node_update`
- `node_move`
- `edge_create`
- `edge_delete`
- `start_plan_get`
- `attention_session_start`
- `attention_session_close`
- `check_in_create`
- `vault_import`
- `vault_export`

If provider testing does not currently have a command, implementation should add one rather than overloading save. The UI needs a test-before-unlock path with clear states.

### Migration From Current UI

The current `apps/desktop/src/app/App.tsx` centralizes too many workflow surfaces. The refactor should be staged:

1. Extract pure presentational components without changing behavior.
2. Introduce `rightPaneMode` and make only one right-pane surface active.
3. Replace always-available agent composer behavior with provider-readiness gating.
4. Move LLM configuration into `ProviderSetupPanel`.
5. Move preview review into `PreviewReviewPanel`.
6. Move full node and edge editing into `AdvancedMapPanel`.
7. Reduce first-viewport copy after behavior is stable.
8. Update smoke tests to assert the refined state transitions.

## Error Handling

Provider errors:

- Show short copy in the provider setup panel.
- Keep typed detail available for troubleshooting.
- Do not unlock the agent.

Agent turn errors:

- Show a short failed-turn message in the agent panel.
- Keep the composer available for retry when provider state is still configured.
- Route provider-specific failures to setup when needed.

Preview conflicts:

- Do not accept stale writes.
- Show what changed and offer to regenerate or discard the preview.

Safety blocks:

- Do not show ordinary productivity advice.
- Use concise redirect copy.
- Do not persist safety-blocked proposals.

Import/export errors:

- Keep them in the Vault task panel.
- Do not interrupt the main agent flow unless the current turn is import-related.

## Testing and Acceptance

### Product Acceptance

- With no LLM provider configured, the agent composer is disabled.
- The setup-required state includes a clear `Configure LLM` action.
- `Configure LLM` opens provider setup in the right pane.
- Provider test and save success unlocks the agent-ready empty state.
- Provider test failure keeps the user in setup with short error copy.
- A natural-language task creates an active agent turn.
- The right pane shows only the relevant turn context.
- Preview revision updates the active draft without durable persistence.
- Accepting a preview persists the reviewed changes.
- Rejecting a preview leaves persisted graph data unchanged.
- Advanced graph editing is available but not the first-run default.
- Support, memory, Vault, and diagnostics open as secondary task panels.
- First viewport copy remains short and action-oriented.

### Automated Checks

Frontend tests should cover:

- Provider-readiness gating.
- Right-pane mode selection.
- Agent setup button behavior.
- Preview accept/revise/reject controls.
- Advanced map mode entry and exit.
- Text-density regressions for primary empty/setup states.

Rust and command tests should cover:

- Provider settings validation.
- Provider test command behavior when implemented.
- Preview acceptance validation.
- Conflict and safety-block paths.
- Confirm-before-write for memory, check-ins, experiments, and Vault import.

Smoke tests should cover:

- First load with missing provider.
- Configure, test, and save LLM settings.
- Agent-ready empty state after configuration.
- Submit a messy task.
- Review, revise, accept, and reject previews.
- Enter Start panel from an accepted next action.
- Open advanced map editing deliberately.
- Open and close secondary task panels without losing the agent panel.

## Documentation Follow-Up

After this design is accepted:

- Update `docs/product.md` so the MVP loop is turn-led and avoids feature-pile framing.
- Update `docs/ui-style.md` so `Quiet Workshop` describes stable two-pane, right-pane mode selection, setup gating, and text-density rules.
- Update `docs/development-plan.md` so Phase 4 and Phase 7 include the refactor and provider setup completeness.
- Update `docs/smoke-test-checklist.md` with missing-provider and provider-setup paths.
- Update `README.md` only if the public product summary needs to reflect the refined workbench.

## Non-Goals

This design does not add:

- Local fallback agent behavior.
- Account system or sync.
- Mobile UI.
- Full Obsidian runtime integration.
- Clinical workflows.
- Productivity scoring, streaks, or gamification.
- A three-column default dashboard.

## Initial Implementation Decisions

- Provider connection testing should be a dedicated command rather than an overload of `settings_update_llm`.
- `rightPaneMode` should start in focused React state or the existing workbench controller layer before introducing a broader store.
- Before the first successful provider setup, support, memory, and Vault surfaces should remain out of the primary flow unless they are reachable through a secondary non-agent settings or data-review entry.
- Graph previews and provider setup need dedicated renderers first. Memory, check-in, strategy-experiment, support-adoption, and Vault previews may share a generic review card until their interaction needs diverge.
