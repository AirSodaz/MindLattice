# MindLattice UI Style

| Field | Value |
| --- | --- |
| Status | Draft |
| Owner | Product and design engineering |
| Last updated | 2026-05-18 |
| Scope | Cross-platform UI style, app shell behavior, theme behavior, and design token rules for the desktop UI |

## Purpose

MindLattice uses the `Quiet Workshop` style: a calm, restrained desktop workbench for a conversational execution agent, external memory, map editing, agent previews, and Start Mode. The current visual target is the Open Design `Green Paper` pass: paper-like panels, deep green or blue-green accents, amber draft accents, quiet editorial headings, and operational density.

The UI MUST feel local-first, practical, low-stimulus, and readable for long work sessions. It MUST NOT feel clinical, gamified, productivity-scored, meditation-like, or decorative for its own sake.

This document also acts as the cross-platform UI contract. Windows, macOS, and Linux builds MUST share the same visual language, information architecture, interaction states, safety copy, and agent preview behavior unless this document explicitly allows a platform difference.

## Style Principles

- Visual hierarchy MUST make the current task, selected node, and next action easy to find without turning the app into a dashboard.
- The conversational execution agent MUST be easy to reach without making the app feel like a generic chat product.
- Agent previews MUST be visibly different from persisted graph content without feeling alarming or unstable.
- Surfaces SHOULD use quiet contrast, clear borders, and restrained shadows instead of bright gradients, floating decoration, or heavy blur.
- Typography MUST be readable at desktop density. Large display type SHOULD be reserved for Start Mode and empty states, not ordinary panels.
- Interactive states MUST be visible in both light and dark themes: hover, active, selected, disabled, error, and keyboard focus.
- User-facing copy MUST stay practical and non-medical. It MAY talk about starting, blockers, supports, return cues, and context. It MUST NOT make clinical claims.
- LLM setup, provider errors, tool progress, and safety blocks MUST be clear without using panic, blame, or urgency styling.
- Open Design fidelity MUST preserve the product language rather than the prototype artifact structure. The desktop app remains a real workbench, not a marketing page, feature tour, or permanent dashboard.

## Theme Model

The desktop UI MUST support three theme preferences:

- `system`: follow the operating system theme.
- `light`: force the light theme.
- `dark`: force the dark theme.

The resolved runtime theme MUST be one of:

- `light`
- `dark`

The app SHOULD default to `system` on first launch. Users MUST be able to manually choose `light` or `dark` later. The dark theme MUST be the same `Quiet Workshop` system translated to dark surfaces; it MUST NOT become a separate neon, night-sky, or game-like brand direction.

## Color Tokens

UI code MUST use semantic design tokens instead of hard-coded component colors.

Required color tokens:

| Token | Purpose |
| --- | --- |
| `--color-bg` | App background and outer workspace. |
| `--color-surface` | Main panels, cards, dialogs, and inspectors. |
| `--color-surface-muted` | Sidebars, secondary panels, and quiet grouped areas. |
| `--color-text` | Primary text. |
| `--color-text-muted` | Secondary text, metadata, hints, and subdued labels. |
| `--color-border` | Dividers, panel boundaries, input borders, and node outlines. |
| `--color-accent` | Primary action, selected node, and active navigation state. |
| `--color-accent-muted` | Low-emphasis accent backgrounds and selected-row fills. |
| `--color-danger` | Destructive actions and validation errors. |
| `--color-success` | Completed checks and positive confirmation states. |
| `--color-focus-ring` | Keyboard focus outline. |

Agent and preview state tokens SHOULD be derived from the required tokens so platform builds stay visually aligned:

| Token | Purpose |
| --- | --- |
| `--color-preview` | Proposed graph and record changes before acceptance. |
| `--color-preview-muted` | Low-emphasis preview fills and inline draft backgrounds. |
| `--color-agent` | Agent thread accents and active agent focus. |
| `--color-agent-muted` | Agent message backgrounds and quiet tool-status fills. |
| `--color-warning` | Non-destructive caution states such as provider setup or preview conflicts. |

Suggested light theme palette:

| Token | Value | Use note |
| --- | --- | --- |
| `--color-bg` | `#f6f4ef` | Warm neutral background. |
| `--color-surface` | `#fbfaf6` | Primary panels and dialogs. |
| `--color-surface-muted` | `#efede6` | Sidebar and quiet grouped areas. |
| `--color-text` | `#232621` | Main copy. |
| `--color-text-muted` | `#686357` | Labels and secondary copy. |
| `--color-border` | `#dfdbd0` | Low-contrast structure. |
| `--color-accent` | `#2f5d62` | Primary action and selected node. |
| `--color-accent-muted` | `#d7e4dc` | Subtle selected backgrounds. |
| `--color-danger` | `#a34d3f` | Error and destructive states. |
| `--color-success` | `#4f7d62` | Completion and saved states. |
| `--color-focus-ring` | `#5c8f96` | Keyboard focus. |
| `--color-preview` | `#8a6f2a` | Preview outlines and pending graph changes. |
| `--color-preview-muted` | `#eee2bf` | Draft fills and preview panels. |
| `--color-agent` | `#5b6472` | Agent thread accent. |
| `--color-agent-muted` | `#e4e7e8` | Agent message and tool status fills. |
| `--color-warning` | `#9a6b2f` | Caution and setup-required states. |

Suggested dark theme palette:

| Token | Value | Use note |
| --- | --- | --- |
| `--color-bg` | `#151713` | App background. |
| `--color-surface` | `#1f211d` | Primary panels and dialogs. |
| `--color-surface-muted` | `#282a25` | Sidebar and quiet grouped areas. |
| `--color-text` | `#ece8dc` | Main copy. |
| `--color-text-muted` | `#b6b0a3` | Labels and secondary copy. |
| `--color-border` | `#3c3d36` | Low-contrast structure. |
| `--color-accent` | `#8db9b4` | Primary action and selected node. |
| `--color-accent-muted` | `#263b39` | Subtle selected backgrounds. |
| `--color-danger` | `#d18a78` | Error and destructive states. |
| `--color-success` | `#95b99b` | Completion and saved states. |
| `--color-focus-ring` | `#9ecdc7` | Keyboard focus. |
| `--color-preview` | `#d2b46f` | Preview outlines and pending graph changes. |
| `--color-preview-muted` | `#3d3420` | Draft fills and preview panels. |
| `--color-agent` | `#a8b1bf` | Agent thread accent. |
| `--color-agent-muted` | `#30363a` | Agent message and tool status fills. |
| `--color-warning` | `#d2a35e` | Caution and setup-required states. |

## Layout, Type, and Density

The desktop app SHOULD use a compact but breathable density. Frequent work surfaces SHOULD prioritize scan speed, stable layout, and visible controls over large hero-style composition.

Required spacing and shape tokens:

| Token | Purpose |
| --- | --- |
| `--space-*` | Shared spacing scale for layout, gap, padding, and inset values. |
| `--radius-control` | Buttons, inputs, chips, and small controls. |
| `--radius-panel` | Panels, inspectors, dialogs, and repeated list items. |
| `--shadow-panel` | Subtle elevation for dialogs and active overlays only. |

Default shape rules:

- Controls SHOULD use small radii and predictable rectangular hit areas.
- Panels SHOULD use restrained radii and borders. Cards MUST NOT be nested inside other cards.
- Decorative gradients, orbs, bokeh, and purely atmospheric backgrounds MUST NOT be used in the core desktop app.
- Letter spacing SHOULD remain `0` unless a specific component proves it needs otherwise.

Typography rules:

- Body text MUST prioritize readability over brand personality.
- Heading and brand display type SHOULD use a quiet editorial serif stack such as `Iowan Old Style`, `Charter`, or `Georgia`; body and controls SHOULD use a system sans stack.
- Panel headings SHOULD be short and quiet.
- Start Mode MAY use larger type to emphasize one action, but it MUST keep enough surrounding whitespace to avoid pressure.
- Interface copy MUST fit its container at supported desktop and compact widths.

## App Shell

The default workspace MUST be an agent-first desktop workbench, not a dashboard or marketing surface.

Primary regions:

- Agent thread: natural-language execution input, agent responses, tool status, and preview revision.
- Turn context pane: provider setup, focused canvas, preview review, Start, advanced map editing, and one secondary task panel.
- Star-map canvas: externalized task context, persisted nodes and edges, and proposed graph changes when the current turn calls for map context.
- Start Mode: one-action view used after the map has been reduced to a startable next action.
- Settings: LLM provider setup, theme, and local preferences as a secondary task panel.

The first viewport MUST make the agent state and the most relevant current-turn context available together. The default workbench SHOULD use a stable two-pane layout: agent thread on the left, turn context pane on the right. It MUST NOT mount preview, advanced map editing, support, memory, Vault, Start, and Settings surfaces as simultaneous persistent columns.

The primary desktop validation viewport is `1440x900`. The compact desktop validation viewport is `1200px` wide. At both sizes, the app MUST preserve the same two-pane mental model: left agent, right turn context, one main right-pane surface at a time. Compact desktop may tighten spacing and control labels, but it MUST NOT collapse into a mobile dashboard.

Low-frequency tools SHOULD open as secondary task panels inside the right turn context pane. The right pane MUST show only one primary surface at a time and SHOULD become a full-width panel on compact screens. Leaving a task panel MUST return to the current turn surface.

The agent composer is also the quick-capture entry after provider setup. When the LLM provider is not configured, the composer MUST be disabled and MUST NOT create a local fallback task. Provider setup SHOULD appear as a compact setup-required card that opens the provider setup surface in the right turn context pane.

The app shell MUST preserve information architecture across Windows, macOS, and Linux. Platform builds MAY adjust title-bar integration and shortcut labels, but they MUST NOT move core workflows to different navigation locations.

The app SHOULD avoid a generic chat-app layout where conversation fills the entire product and the map becomes an attachment. The agent thread and star-map canvas are peers: conversation drives intent, while the canvas preserves visible working memory.

## Components

Shared components MUST consume the same token set in both themes. Platform-specific branches MUST NOT change the main visual style.

Component requirements:

- Buttons MUST show clear default, hover, active, disabled, loading, and focus states.
- Inputs and text areas MUST show focus, validation, disabled, and read-only states.
- Sidebars MUST keep navigation calm and scannable, with the active item visible without high saturation.
- Inspectors MUST favor stable form layout, clear labels, and low-noise grouping.
- Checklists MUST use familiar checkbox or toggle controls rather than custom decorative marks.
- Dialogs MUST use `--color-surface`, `--color-border`, and `--shadow-panel`; they SHOULD avoid large illustrations.
- Icons SHOULD be simple, consistent, and supportive of scan speed. Text labels SHOULD remain available where icon meaning is not obvious.

Agent-specific component requirements:

- The agent input MUST support short and multi-line natural-language messages without resizing the surrounding layout unpredictably.
- Agent messages MUST use compact conversational blocks, not oversized chat bubbles.
- Tool-status rows MUST be visible but subdued. Examples include drafting, validating, blocked by safety review, provider timeout, and preview conflict.
- Confirmation controls MUST use stable placement and explicit labels for accept, reject, and revise.
- Loading states MUST communicate that the agent is working without animated spectacle.
- Safety-block states MUST use `--color-warning` or `--color-danger` according to severity, plus concise copy that routes away from ordinary task advice when needed.

## Conversational Agent Thread

The agent thread is the primary input surface for capture, decomposition, preview revision, Start Mode drafting, check-ins, and preference-memory proposals.

Agent thread requirements:

- The input composer MUST remain reachable from the main workbench unless the user is in full Start Mode.
- The latest user message, latest agent response, and active preview state MUST be visually connected.
- Agent responses SHOULD be short and action-oriented. Long reasoning, hidden prompt language, or clinical framing MUST NOT be displayed.
- Natural-language revision prompts SHOULD keep context visible, such as which preview or node will be revised.
- A stop or cancel control MUST be available while an agent turn is running.
- Provider setup, provider timeout, malformed output, and tool-budget failures MUST be represented as recoverable states, not terminal app failures.
- The thread MUST avoid anthropomorphic intimacy, therapy-session framing, streak praise, or motivational guilt.
- The thread MUST NOT present tool calls as raw logs during normal use. Diagnostic detail MAY be available in a separate developer or troubleshooting surface.

The agent thread MUST look and behave consistently across platforms. Native text selection, input method behavior, and scrollbars MAY differ, but message grouping, spacing, token usage, and preview affordances MUST remain aligned.

## Agent Preview

Agent previews are proposed changes that are not yet persisted. The UI MUST treat them as first-class, inspectable objects.

Preview requirements:

- Proposed nodes, edges, support adoptions, start plans, check-ins, strategy experiments, and preference-memory updates MUST be distinguishable from persisted content.
- Preview styling MUST use `--color-preview` and `--color-preview-muted` or derived tokens. It MUST NOT rely on color alone.
- Proposed graph nodes SHOULD use a draft badge, dashed outline, lighter fill, icon treatment, or label treatment.
- Proposed edges SHOULD be quieter than persisted edges but still traceable on hover, selection, and keyboard focus.
- Modified existing nodes MUST show what will change before acceptance.
- Preview detail panes MUST describe the concrete write that acceptance will perform.
- Accept, reject, and revise actions MUST be available from the preview surface.
- Rejecting a preview MUST leave persisted graph content visually unchanged.
- Accepting a preview SHOULD transition the affected objects from preview styling to persisted styling without implying celebration or score.
- Safety-blocked proposals MUST be visually distinct from normal preview proposals and MUST NOT be acceptable.
- Preference-memory previews MUST show the proposed memory text and, when available, the source event such as a check-in or strategy experiment.

Preview behavior MUST be cross-platform consistent. A proposed node, proposed edge, pending memory item, or safety-blocked proposal MUST be recognizable the same way on Windows, macOS, and Linux.

## Star-Map Canvas

The star-map canvas MAY have more spatial character than the surrounding interface, but it MUST still follow `Quiet Workshop`.

Canvas requirements:

- The canvas background SHOULD remain low-contrast in both themes.
- Node kinds MUST be distinguishable by a combination of label, shape, icon, border, or accent treatment. Color alone MUST NOT carry meaning.
- The selected node and current next action MUST be visually obvious.
- Proposed nodes, proposed edges, modified existing nodes, and safety-blocked proposals MUST have distinct visual states.
- Agent focus target SHOULD be visible when the agent is discussing or revising a specific node, edge, or region.
- Edges SHOULD be quiet by default and become clearer on hover, selection, or keyboard focus.
- The canvas MUST NOT use global neon styling, animated starfields, or decorative cosmic effects.
- The canvas SHOULD read as working memory: center task, subtasks, blockers, notes, resources, next actions, and supports. It MUST NOT use cosmic/starfield metaphors as the visual explanation of the map.

## LLM Setup and Provider States

MindLattice depends on a configured LLM provider for the primary agent workflow. The UI MUST make this dependency clear without turning setup into a sales or onboarding funnel.

Setup requirements:

- Missing provider configuration MUST route users to setup before promising agent-generated scaffolding.
- Provider preset, API mode, API key, Base URL, model, and timeout controls MUST use quiet form styling and clear validation states.
- Provider setup SHOULD be two-layered: a quick preset path for common providers and an advanced manual path for Base URL, API mode, and timeout.
- The default visible help MUST state that Base URL should stop at the API version level, not the full endpoint.
- Connection testing SHOULD show pending, success, failure, and timeout states.
- Testing MUST NOT save settings and MUST NOT unlock the agent; save remains a separate action after a successful matching test.
- Save MUST stay disabled until the current form exactly matches a successful test. Changing provider preset, API mode, Base URL, API key, model, or timeout MUST invalidate the visible test state.
- Provider setup copy MUST include: "Configure LLM to use the execution agent."
- Provider errors MUST be actionable and concise. They MUST NOT imply user failure.
- LLM setup copy MUST include the non-medical product boundary when relevant, but it MUST NOT bury the user in policy text.
- Provider setup screens MUST use the same theme tokens and component density as the rest of the app.

## Localization

MindLattice uses `i18next` and `react-i18next` for desktop interface localization.

Localization requirements:

- Settings MUST expose language preference as `system`, `en`, and `zh-CN`.
- Agent panel, Provider setup, Settings, Preview review, and Start Mode labels SHOULD use translation keys.
- User input, raw LLM output, logs, and raw provider technical errors MUST remain untranslated.
- Localized labels MUST preserve the stable two-pane agent plus turn-context information architecture.
- Translation changes MUST avoid changing the non-medical product boundary.

## Memory Management

Confirmed memory is a user-visible UI surface, not a hidden chat feature.

Memory UI requirements:

- Preference memory MUST be viewable, editable, disabled or enabled, and deletable.
- Memory management MUST list confirmed memory only by default.
- Memory proposals from the agent MUST use preview styling and require explicit acceptance before they appear as confirmed memory.
- Memory items SHOULD show their source, such as accepted check-in, strategy experiment, or explicit user confirmation.
- The UI MUST NOT use vague "I will remember this" copy unless the concrete memory item is visible.
- The UI MUST NOT imply that MindLattice remembers everything. Proposed memory must be visible, editable, and rejectable before persistence.
- Clinical labels, symptom scores, medication conclusions, or inferred diagnoses MUST NOT appear as memory items.

## Start Mode

Start Mode is the quietest product surface. It MUST reduce the map to one startable action and nearby context.

Start Mode requirements:

- The selected next action MUST be the strongest visual element.
- Supporting context MUST be limited and visually secondary.
- The start check MUST be calm, explicit, and easy to complete. The first-release check labels are `Materials`, `Current distraction`, `Five-minute fit`, and `Reopen target`.
- Agent assistance in Start Mode MUST stay secondary to the selected next action.
- If the user asks the agent to make the action smaller, the revised plan MUST appear as a preview before persistence.
- Missed or incomplete check-ins MUST NOT be framed as failure.
- The UI MUST NOT show streaks, productivity scores, urgency badges, or motivational guilt.

Start Mode copy MUST preserve these phrases where the matching controls appear:

- "Start with five minutes."
- "Leave a return cue for later."
- "Make this smaller."

## Mobile Adaptation

Mobile is a future adaptation, not the desktop MVP layout compressed into a phone dashboard.

Mobile rules:

- Mobile SHOULD become a one-surface flow: setup, agent, preview review, context map, Start Mode, memory, or settings.
- Mobile MUST NOT show the desktop two-pane layout squeezed side by side.
- Mobile previews MUST keep confirm-before-write controls visible and stable.
- Mobile memory management MUST still default to confirmed memory only.
- Mobile Start Mode MUST remain the quietest screen and avoid urgency, scores, streaks, or motivational copy.

## Cross-Platform Rules

MindLattice SHOULD achieve cross-platform consistency through shared React components, shared CSS tokens, and shared interaction rules.

Allowed platform differences:

- Native window controls and title-bar integration.
- Operating system font rendering differences.
- Native file dialogs, notifications, and permission surfaces.
- Shortcut labels such as `Ctrl` on Windows/Linux and `Command` on macOS.
- Scrollbar appearance when controlled by the operating system or WebView.
- Native text input, IME behavior, and secure password-field behavior.

Disallowed platform differences:

- Different color palettes for the same theme.
- Different component shapes or density for the same surface.
- Platform-specific information architecture.
- Platform-specific agent thread placement during core workflows.
- Platform-specific preview, confirmation, or memory-management behavior.
- Platform-specific Start Mode behavior.
- Platform-specific safety or non-medical copy.

## Acceptance Criteria

- UI implementation exposes `themePreference` as `system`, `light`, or `dark`.
- UI implementation exposes `resolvedTheme` as `light` or `dark`.
- UI implementation exposes language preference as `system`, `en`, or `zh-CN`.
- Light and dark themes define the required color tokens.
- Agent and preview state tokens are defined for light and dark themes.
- Shared components use semantic tokens instead of hard-coded visual constants.
- Key screens can be screenshot-tested on Windows, macOS, and Linux: agent thread, capture, star-map canvas, preview review, inspector, Start Mode, LLM setup, memory management, and settings.
- Proposed nodes, proposed edges, preview detail panes, accept/reject/revise controls, safety-block states, provider-error states, and preference-memory proposals render consistently across platforms.
- Provider setup disables Save until a successful matching test; testing itself does not save settings.
- Empty workspace copy includes "Tell me what feels messy right now." and avoids a feature tour.
- Preview review copy includes "I drafted a structure. Nothing is saved yet." and a concrete write summary such as "This will save 3 nodes and 2 links."
- Draft content is distinguished by badge, dashed outline, soft fill, or label treatment, not color alone.
- Start Mode renders one next action, parent task, minimum-done definition, blocker, support, return cue, and the four start-check rows.
- Memory management lists confirmed memory separately from agent-proposed memory review.
- Safety and product-boundary copy follows [Documentation Standards](documentation-standards.md).
