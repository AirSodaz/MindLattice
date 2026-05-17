# Agent-First Turn-Led Workbench Implementation Brief

> **For implementation workers:** Treat this as a product and engineering brief, not a line-by-line patch script. Keep each change small, test the behavior at the boundary where it is introduced, and let exact component props, helper names, and test fixtures emerge from the current code.

**Goal:** Refine the MindLattice desktop MVP into an agent-first, turn-led two-pane workbench where the agent is the primary surface, LLM setup is honest and blocking, and the right pane stays focused on the current turn.

**Architecture:** Preserve the current Rust core, storage, agent orchestration, and Tauri typed command boundary. Add the missing provider-test capability, then reshape the React workbench around explicit provider readiness, disabled pre-setup agent UI, and a focused right-pane selection model. Keep durable mutations owned by commands and protected by confirm-before-write.

**Tech Stack:** Rust workspace, Tauri 2 command layer, React/Vite desktop UI, TypeScript model/controller tests, existing browser smoke runner.

---

## Product Contract

The first screen should feel like an execution agent, not a settings dashboard, map editor, or feature tour. The left agent panel remains stable. The right pane changes according to the current turn.

When no LLM provider is configured:

- The agent composer is disabled.
- The agent area shows a setup-required state.
- The primary action is `Configure LLM`.
- Clicking it opens the LLM configuration surface in the right pane.
- No local fallback agent behavior should create tasks or imply agent work happened.

When an LLM provider is configured:

- The user can speak naturally to the agent.
- The agent can propose temporary previews.
- Temporary preview revision can be fluid.
- Durable graph, memory, check-in, strategy experiment, support, and Vault writes require explicit accept/save.

The right pane should show one primary surface at a time:

- Provider setup.
- Empty turn context.
- Preview review.
- Focused canvas.
- Start panel.
- Safety redirect.
- Advanced map editing.
- One secondary task panel.

Active previews take priority over secondary task panels. Advanced map editing remains available, but it should not be the first-run default.

---

## Non-Negotiable Boundaries

- Do not add a local fallback agent.
- Do not make SQLite writes from UI-only state.
- Do not bypass command-owned persistence and safety checks.
- Do not add clinical, diagnostic, symptom-scoring, treatment, medication, productivity-score, or streak language.
- Do not turn this into a three-column dashboard.
- Do not preserve long first-viewport explanatory copy just because it already exists.
- Do not refactor unrelated storage, schema, or prompt behavior unless tests show the current boundary cannot support the work.

---

## Implementation Phases

### Phase 1: Provider Test Command

Add a dedicated command for testing LLM provider settings without saving them.

Expected behavior:

- Valid settings make a short OpenAI-compatible structured completion request.
- Success returns a compact result for UI display.
- Invalid local settings fail before network.
- Provider/network failure is surfaced as a provider failure.
- Testing settings does not unlock the agent and does not persist provider settings.

Likely files:

- `apps/desktop/src-tauri/src/commands.rs`
- `apps/desktop/src-tauri/src/tauri_api.rs`
- `apps/desktop/src-tauri/src/tauri_commands.rs`
- `apps/desktop/src-tauri/src/main.rs`
- `apps/desktop/src-tauri/dto_schema.rs`
- `apps/desktop/src-tauri/tests/phase3_commands.rs`
- `apps/desktop/src-tauri/tests/phase3_tauri_registration.rs`
- `apps/desktop/src/shared/api/generated/commandDtos.ts`

Testing intent:

- Add focused Rust command tests for success, invalid config, and provider failure.
- Add registration coverage.
- Verify the command does not save settings by asserting an agent turn is still blocked before `settings_update_llm`.

### Phase 2: Frontend Command Client

Expose provider testing through the existing command-client abstraction.

Expected behavior:

- Tauri client invokes `settings_test_llm`.
- Mock client succeeds/fails deterministically.
- DTO typing stays generated/shared rather than duplicated in feature code.

Likely files:

- `apps/desktop/src/shared/api/commandClient.ts`
- `apps/desktop/src/shared/api/commandClient.test.ts`
- `apps/desktop/src/shared/api/generated/commandDtos.ts`

Testing intent:

- Assert command name and argument casing.
- Assert mock behavior for valid and invalid inputs.

### Phase 3: Workbench State and Controller Gating

Introduce explicit provider readiness and right-pane selection in the model/controller layer.

Expected behavior:

- Pre-setup agent submission is blocked without creating tasks.
- The blocked state uses short setup copy.
- Provider test result is carried in screen state.
- Saving provider settings updates the profile to configured.
- Right-pane selection prioritizes setup and active preview before secondary panels.

Likely files:

- `apps/desktop/src/features/workbench/workbenchModel.ts`
- `apps/desktop/src/features/workbench/workbenchModel.test.ts`
- `apps/desktop/src/features/workbench/workbenchController.ts`
- `apps/desktop/src/features/workbench/workbenchController.test.ts`
- `apps/desktop/src/features/workbench/workbenchSmoke.test.ts`

Testing intent:

- Replace the old pre-setup fallback test with a gating test.
- Add test-before-save workflow coverage.
- Add deterministic right-pane selection tests.

### Phase 4: Agent Panel and Provider Setup Surface

Extract the left agent panel and the right-side provider setup surface.

Expected behavior:

- The agent panel owns thread display, composer state, disabled setup state, and `Configure LLM`.
- Provider setup owns base URL, API key, model, timeout, test, save, and compact status/error display.
- `Configure LLM` opens provider setup in the right pane.
- The composer remains disabled until settings are saved.

Likely files:

- `apps/desktop/src/features/workbench/components/AgentPanel.tsx`
- `apps/desktop/src/features/workbench/components/ProviderSetupPanel.tsx`
- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/shared/styles/global.css`

Testing intent:

- Prefer controller/model tests for behavior.
- Use render tests only where the existing test harness already supports them cleanly.
- Keep exact prop shapes and handler names determined during extraction.

### Phase 5: Turn Context Pane

Add a focused right-pane composition component.

Expected behavior:

- A single right-pane component renders the selected mode.
- Preview review makes unsaved state visually obvious without relying on color alone.
- Focused canvas shows the map without advanced inspector/editor controls.
- Empty context uses short prompt copy.

Likely files:

- `apps/desktop/src/features/workbench/components/TurnContextPane.tsx`
- `apps/desktop/src/features/workbench/components/PreviewReviewPanel.tsx`
- `apps/desktop/src/features/workbench/components/TurnCanvasPanel.tsx`
- `apps/desktop/src/features/workbench/components/flowNode.tsx`
- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/shared/styles/global.css`

Testing intent:

- Cover right-pane mode selection in model tests.
- Build after extraction to catch prop and React Flow type drift.

### Phase 6: Split Secondary Panels Out of `App.tsx`

Move advanced map editing, Start Mode, support templates, memory review, Vault, and task-panel routing out of the main app shell.

Expected behavior:

- `App.tsx` becomes shell composition and high-level state wiring.
- Existing business behavior remains unchanged.
- Secondary surfaces render only when selected.
- Active preview can still interrupt secondary panel focus.

Likely files:

- `apps/desktop/src/features/workbench/components/StartPanel.tsx`
- `apps/desktop/src/features/workbench/components/AdvancedMapPanel.tsx`
- `apps/desktop/src/features/workbench/components/WorkbenchTaskPanels.tsx`
- `apps/desktop/src/features/workbench/components/SupportTemplatesPanel.tsx`
- `apps/desktop/src/features/workbench/components/MemoryReviewPanel.tsx`
- `apps/desktop/src/features/workbench/components/VaultPanel.tsx`
- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/shared/styles/global.css`

Implementation note:

Extract existing inline handlers into named callbacks only as needed to make components readable. Do not freeze exact callback names, prop bundles, or component boundaries in this brief; choose them while implementing against the live code.

Testing intent:

- Run focused workbench smoke/model tests after each extraction slice.
- Run the full frontend build once the panel split is complete.

### Phase 7: Copy, Visual States, and Docs

Reduce first-viewport copy and sync docs with the implemented behavior.

Expected behavior:

- Primary setup copy stays short.
- Empty state stays short.
- Technical explanation moves out of the first viewport or into collapsed details.
- Preview state is distinguishable by label/shape/border, not color alone.
- Product, UI, development, and smoke docs reflect the final implemented behavior.

Likely files:

- `apps/desktop/src/features/workbench/components/AgentPanel.tsx`
- `apps/desktop/src/features/workbench/components/ProviderSetupPanel.tsx`
- `apps/desktop/src/features/workbench/components/PreviewReviewPanel.tsx`
- `apps/desktop/src/shared/styles/global.css`
- `docs/product.md`
- `docs/ui-style.md`
- `docs/development-plan.md`
- `docs/smoke-test-checklist.md`

Testing intent:

- Add small regression tests for forbidden clinical/scoring copy where useful.
- Review docs for observable wording rather than implementation promises that are not shipped.

### Phase 8: Browser Smoke Coverage

Extend smoke coverage for the first-run LLM setup path.

Expected behavior:

- Fresh no-provider state shows disabled composer.
- `Configure LLM` opens provider setup.
- Invalid provider settings do not unlock the agent.
- Successful test plus save unlocks the agent-ready state.
- Active preview priority is observable.

Likely file:

- `apps/desktop/scripts/e2e-smoke.mjs`

Testing intent:

- Keep selectors aligned with accessible labels.
- Avoid brittle tests against exact layout internals.

---

## Deferred to Implementation

Decide these while writing code and tests, not in this brief:

- Exact component prop names.
- Whether a panel split should happen in one file or two smaller files.
- Exact local helper names.
- Exact test helper structure for provider mock servers.
- Exact CSS class names beyond the user-visible states.
- Whether a behavior is best covered by model, controller, render, or browser smoke tests.

---

## Verification Gate

Before considering the implementation done, run from `C:\Users\asoda\projects\MindLattice`:

```powershell
cargo test --workspace
corepack pnpm test
corepack pnpm build
corepack pnpm smoke:e2e
git status --short
```

For documentation-only follow-up edits, validate the affected Markdown and inspect the diff:

```powershell
git diff -- docs README.md
git status --short
```

---

## Suggested Commit Slices

- `feat: add llm provider test command`
- `feat: expose llm provider test in frontend client`
- `feat: gate agent until llm setup`
- `feat: add agent setup surfaces`
- `feat: add turn context pane`
- `refactor: split workbench panels`
- `style: reduce workbench primary copy`
- `docs: align workbench docs with turn-led design`
- `test: cover llm setup gating smoke flow`
