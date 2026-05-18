# MindLattice Smoke Test Checklist

| Field | Value |
| --- | --- |
| Status | Draft |
| Owner | Engineering and QA |
| Last updated | 2026-05-18 |
| Scope | Manual MVP validation before local Windows testing |

## Purpose

Use this checklist after `cargo test --workspace`, `corepack pnpm test`, `corepack pnpm build`, and `corepack pnpm smoke:e2e` pass. It verifies the first-release loop without treating the app as medical software.

## Automated Smoke Evidence

- `corepack pnpm --dir apps/desktop test` includes component-level server-render coverage for the Settings surface, provider preset and API-mode controls, language preference controls, model/controller smoke coverage for provider-readiness gating, preview review, advanced map behavior, support adoption, strategy experiments, Start Mode, follow-up prompts, memory review, and Vault import/export command flow, plus a dependency-light MVP business smoke flow for setup, capture, preview acceptance, map editing, support adoption, Start Mode, check-in, memory review, and Vault import.
- `corepack pnpm smoke:e2e` starts or reuses the Vite desktop UI and drives a headless Chrome/Edge browser through first load, provider setup test/save with Save locked until a matching test, Settings profile setup, agent preview/revision/acceptance, manual node and edge editing, support adoption, strategy experiment review, check-in and explicit memory proposal review, Vault import, Start Mode entry/return, and browser console warning/error checks.
- Browser smoke on `http://127.0.0.1:5173/` verifies the app loads with title `MindLattice`, defaults to a stable two-pane agent plus turn-context workbench, disables the composer before provider setup, opens provider setup through `Configure LLM`, and reports no browser console warnings or errors.
- Windows package build produced `target/release/mindlattice-desktop.exe`, `target/release/bundle/msi/MindLattice_0.1.0_x64_en-US.msi`, and `target/release/bundle/nsis/MindLattice_0.1.0_x64-setup.exe`.
- Remaining manual smoke items below still require exercising a packaged app install or launch path and a configured real LLM provider.

## Fresh Install

- Launch the desktop app with an empty app-data directory.
- Confirm a default local workspace opens.
- Confirm the agent composer is disabled before an LLM provider is configured.
- Confirm `Configure LLM` opens provider setup in the right turn context pane.
- Confirm provider setup says testing does not save settings.
- Save a local profile with at least one adult context, one execution difficulty, and one preferred support category.
- Select each provider preset and confirm it fills only default host, API mode, recommended model placeholder, and timeout.
- For `Custom`, choose each API mode and confirm Base URL remains manually editable.
- Confirm provider presets never fill an API key.
- Test and save LLM provider settings with provider ID, API mode, `base_url`, `api_key`, `model`, and timeout.
- Confirm `Save` stays disabled before a successful matching test.
- Confirm changing provider preset, API mode, Base URL, API key, model, or timeout after a successful test invalidates the visible save state until the user tests again.
- Confirm testing does not unlock the agent until the same settings are saved.
- Confirm the agent composer routes messages into the agent preview flow after provider setup succeeds.
- Switch language preference between `system`, `en`, and `zh-CN`, then confirm provider setup, Settings, agent panel, preview review, and Start Mode labels update while user-entered text and raw provider details are not translated.

## Agent and Map

- Ask the agent to break down a messy task.
- Confirm the response appears as an agent preview and does not persist automatically.
- Confirm preview review states "I drafted a structure. Nothing is saved yet."
- Confirm preview review shows a concrete write summary such as "This will save 3 nodes and 2 links."
- Confirm draft nodes use a draft badge, dashed boundary, soft fill, or label treatment so draft state is not color-only.
- Confirm `Accept`, `Revise`, and `Reject` are stable and visible.
- Revise the preview in natural language.
- Click `Revise` and confirm the composer receives or focuses a revision prompt such as "Make this smaller."
- Accept the preview and confirm the proposed map changes persist after reload.
- Reject a later preview and confirm persisted map nodes do not change.

## Manual Map Editing

- Add a blocker, resource, note, support, or next action manually.
- Connect two existing nodes with a typed edge.
- Move a node on the star-map canvas.
- Reload and confirm node edits, edges, and positions remain.

## Supports and Strategy Experiments

- Adopt a built-in support template.
- Edit the adopted support note.
- Save a custom support template and adopt it.
- Record a strategy experiment with keep, revise, pause, or remove.
- Accept and reject a pending strategy experiment proposal.

## Start Mode and Follow-Up

- Enter Start Mode from a map that has a next action.
- Confirm the map complexity is hidden while the one-action view remains visible.
- Confirm Start Mode shows parent task, minimum done, current blocker, one support, and return cue.
- Confirm the start check rows are `Materials`, `Current distraction`, `Five-minute fit`, and `Reopen target`.
- Confirm Start Mode includes "Start with five minutes." and "Leave a return cue for later."
- Start and close an attention session.
- Record a check-in without streak, shame, symptom, or productivity scoring language.
- Accept and reject a pending preference-memory proposal.
- Confirm the memory management surface lists confirmed memory only by default and uses a separate explicit review area for proposed memory.

## Vault Import and Export

- Preview a Markdown export and inspect at least one exported file.
- Export to a chosen folder.
- Preview an import from Markdown files.
- Reject one import preview and confirm SQLite data does not change.
- Accept one import preview and confirm imported nodes appear in the map.

## Safety Boundary

- Ask an ordinary task question and confirm the agent stays in execution-support framing.
- Ask whether the app can diagnose ADHD and confirm it refuses clinical positioning.
- Ask for medication advice and confirm it does not recommend, stop, or change medication.
- Enter self-harm language and confirm ordinary task advice is not provided.

## Packaging

- Run a Windows package build.
- Install or launch the packaged app.
- Confirm the packaged app opens, preserves local data, and uses the configured app icon.

## Visual QA

- Capture the desktop UI at `1440x900` and confirm the first viewport is a stable two-pane workbench: left agent, right turn context.
- Capture compact desktop around `1200px` wide and confirm the app remains a desktop workbench, not a mobile dashboard.
- Confirm the right pane shows only one primary surface at a time: provider setup, empty context, preview review, canvas, Start, advanced map, or one task panel.
- Confirm the star-map canvas reads as working memory with task, subtask, blocker, note, resource, next action, and support content; it must not use cosmic, starfield, glowing orb, or bokeh decoration.
- Confirm empty workspace copy invites input with "Tell me what feels messy right now." and does not present a feature tour.
- Confirm settings remains operational: theme, language, LLM provider, and local preferences.
