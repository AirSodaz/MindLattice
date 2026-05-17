# MindLattice Product Requirements

| Field | Value |
| --- | --- |
| Status | Draft |
| Owner | Product and engineering |
| Last updated | 2026-05-16 |
| Scope | MVP and first release product requirements |

## Purpose

MindLattice helps adults with ADHD traits externalize working memory, lower task-start resistance, and turn unclear responsibilities into visible, startable next actions through a conversational LLM execution agent.

The product goal is daily execution support, not symptom improvement. MindLattice MUST help users start, return after interruption, understand blockers, try practical supports, and record follow-up without shame. The first release assumes an LLM provider is configured for the primary agent experience; local SQLite remains the source of truth for accepted data.

## Audience

Primary users:

- Adults who experience task paralysis, overwhelm, context loss, or difficulty starting multi-step work.
- Users who like local knowledge tools such as Obsidian but need stronger task decomposition and execution support.
- Users who want their data to remain local by default.
- Users who are comfortable configuring an LLM provider for agent-assisted execution scaffolding.

Non-goals:

- Diagnosis, treatment, or prevention of ADHD.
- Clinical tracking for therapists or clinicians.
- Medication management, symptom scale interpretation, or treatment planning.
- Legal advice or formal workplace accommodation request generation.
- Full replacement for calendars, project management suites, or note-taking systems in the MVP.

## Evidence Boundary

MindLattice MAY use clinical, public health, workplace, and general-wellness guidance to shape product safety and execution-support design. The product MUST NOT present this material as individualized medical advice.

Design implications:

- External memory, written structure, reminders, environmental modification, short work periods, and return cues are first-class product concepts.
- Support strategies are optional experiments the user can keep, revise, pause, or remove.
- Medical sources are provenance for general design constraints only. The product MUST NOT say a strategy is clinically indicated for a specific user.
- Product claims MUST stay in the low-risk wellness lane: support attention routines and task execution, never diagnose, treat, prevent, mitigate, measure, or claim to reduce ADHD.

## Product Requirements

### Core Loop

The MVP MUST support this loop:

1. Capture a messy task or responsibility.
2. Let the user continue in natural language instead of choosing feature commands.
3. Have the conversational execution agent externalize the task as a central node in a star-map canvas.
4. Have the agent propose subtasks, blockers, resources, notes, supports, and possible next actions as an editable preview.
5. Let the user revise the preview in natural language.
6. Require explicit user acceptance before graph changes, support records, preference memory, or check-ins are persisted.
7. Generate a start plan for one selected next action.
8. Run a start check for materials, current distraction, five-minute fit, and return cue.
9. Record a follow-up and any support experiment result.
10. Let the user return to context through the map, agent thread, or low-stimulus one-thing view.

### Conversational Execution Agent

The primary interaction model MUST be natural-language conversation with a single visible execution agent. The UI MAY provide buttons and shortcuts, but these controls MUST remain secondary to the conversational loop.

The agent MUST support user messages such as:

- "I have too much to do and do not know where to start."
- "Make this smaller."
- "This blocker is wrong; it is really a missing file."
- "Only keep three steps."
- "Give me a five-minute start plan."
- "Record that the timer helped but the checklist was too much."

The agent MUST automatically classify the user's intent and decide whether to propose a task capture, map decomposition, blocker revision, support suggestion, start plan, check-in, strategy experiment, or preference update.

The agent MUST return:

- A short, low-stimulus natural-language response.
- A structured preview when it proposes map, start-plan, support, check-in, strategy-experiment, or memory changes.
- A clear confirmation path before any durable write.

The agent MUST NOT require the user to know command names such as `decompose_preview`, `start_plan_get`, or `support_adopt`.

### Agent Loop

Each agent turn MUST follow a bounded loop:

1. `Observe`: read the latest user message, selected map context, current preview, confirmed memory, support templates, and safety state.
2. `Classify`: identify whether the user is capturing, decomposing, revising, starting, checking in, managing memory, importing, exporting, or asking a general question.
3. `Plan`: choose the smallest set of tools or skills needed for the turn.
4. `Act`: call core-governed tools or LLM tasks to produce structured draft output.
5. `Review`: run proposal validation, safety checks, write-boundary checks, and scope limits.
6. `Respond`: show concise natural language plus preview, revision, or confirmation affordances.
7. `Remember`: persist only accepted graph changes, check-ins, strategy experiments, or user-visible preference updates.

Each turn MUST have a tool-call budget, timeout budget, and stop condition. The agent MUST stop or narrow scope when the user says "stop", "do not change this", "just answer", or an equivalent instruction.

### Preview and Natural-Language Revision

Execution scaffolding MUST be represented as a first-class preview before persistence.

A preview MAY contain:

- Proposed graph nodes and edges.
- Proposed edits to existing nodes or edges.
- Proposed support-template adoption.
- Proposed start plan.
- Proposed check-in or strategy experiment.
- Proposed preference-memory update.

The user MUST be able to revise the active preview in natural language. Revision MUST update the same preview when possible instead of discarding the user's context and starting over.

Preview acceptance MUST be explicit. Preview rejection MUST leave persisted graph data unchanged.

### Star-Map Canvas

The star-map canvas MUST make working memory visible without becoming a noisy dashboard.

Node kinds:

- `task`: meaningful unit of work.
- `subtask`: smaller part of a task.
- `blocker`: reason the task feels hard or cannot move.
- `note`: nearby context.
- `resource`: file, link, reference, or material needed for the task.
- `next_action`: concrete action small enough to start.
- `support`: reusable execution support adopted from a template or created by the user.
- `environment_adjustment`: low-risk change to surroundings or tools.
- `routine_anchor`: user-defined cue, routine, or time/context anchor.
- `attention_guard`: boundary that protects focus.
- `check_in`: lightweight follow-up note.

Edge kinds:

- `breaks_down_to`: parent work decomposes into smaller work.
- `blocked_by`: task is blocked by something.
- `supports`: note, resource, or support helps a task.
- `leads_to`: one action naturally leads to another.
- `anchors`: routine anchor cues a task or next action.
- `protects`: attention guard protects a task or start session.
- `related`: loose association.

The implementation MAY store support-related concepts as one `support` node with `support_kind` metadata. The UI MUST still expose the user-facing concepts clearly.

### Support Templates and Strategy Experiments

MindLattice MUST provide support templates and strategy cards as local content that the agent can search, quote briefly, and adapt into user-reviewed previews. The primary support-selection flow is agent-assisted and requires configured LLM access.

Support template categories:

- Sensory environment: quieter workspace, headphones, white noise, visual clutter reduction, lighting adjustment.
- Task structure: visible checklist, minimum-done definition, one-task workspace, priority confirmation.
- Reminders and external memory: timer, calendar reminder, pinned note, return cue, materials checklist.
- Communication and written instructions: request written steps, clarify deadline, capture decision notes, define done criteria.
- Rest and task switching: short break, transition note, resume point, planned restart time.
- Work or study adjustment templates: do-not-disturb windows, divided assignments, written expectations, flexible focus blocks, meeting notes.

Each strategy card MUST include when to use it, short steps, a source note, and a safety note that it is self-help execution support, not treatment advice.

A `StrategyExperiment` MUST record:

- Support template or custom support used.
- Context where it was tried.
- Whether it helped the user start, continue, return after interruption, or clarify the next action.
- What got in the way.
- Next decision: `keep`, `revise`, `pause`, or `remove`.

The product MUST summarize experiments as personal execution preferences, not symptom trends or treatment outcomes.

### Agent Skills

MindLattice MUST define product-level agent skills as structured specifications, not informal prompt fragments.

Each skill MUST define:

- Trigger conditions.
- Required context.
- Allowed tools.
- Output schema.
- Safety restrictions.
- Example inputs and outputs.
- Test cases or golden scenarios.

First-release skills MUST include:

- `capture_messy_task`
- `decompose_to_star_map`
- `identify_blockers`
- `find_smaller_next_action`
- `match_support_template`
- `draft_start_plan`
- `revise_graph_preview`
- `summarize_check_in`
- `extract_preference_from_experiment`
- `safe_redirect_for_crisis_or_medical_content`

Skills MAY share one LLM provider and one visible agent persona. The user MUST NOT need to choose among internal skills.

### Start Mode

Start Mode MUST reduce the map to one startable action.

It MUST show:

- Selected next action.
- Parent task.
- Up to three supporting context items.
- Minimum-done definition.
- Estimate when available.
- Current blocker when available.
- One optional support or environmental adjustment.
- Return cue.
- Start check for materials, current distraction, five-minute fit, and reopen target.

Start Mode MUST avoid streak pressure, productivity scores, motivational guilt, and noisy dashboards. It MUST allow return to the full map at any time.

### Follow-Up and Return

MindLattice MUST offer a calm check-in after starting. Useful prompts include:

- "Did you start?"
- "Where did it get stuck?"
- "Did this support help?"
- "Should the next action be smaller?"
- "What needs to be visible next time?"

Missed check-ins MUST NOT be framed as failure.

### LLM Agent and Confirm-Before-Write

The LLM execution agent is the primary assistant, not the source of truth.

The agent MAY:

- Propose nodes and edges from a messy task and optional context.
- Label blockers and possible next actions.
- Suggest support templates, reminders, and return cues.
- Draft Start Mode plans.
- Revise an active preview based on natural-language feedback.
- Summarize check-ins and strategy experiments.
- Propose visible preference-memory updates.
- Return structured data for user review.

The agent MUST NOT:

- Write directly to storage.
- Silently save preference memory.
- Produce medical advice.
- Diagnose, recommend medication, recommend stopping medication, interpret symptoms, or create treatment plans.
- Evaluate whether the user has ADHD or label symptom severity.
- Say a strategy is "for your ADHD" or will improve ADHD.
- Treat crisis content as ordinary productivity input.

Agent proposal validation MUST reject:

- More than 7 proposed nodes.
- More than 10 proposed edges.
- More than 3 next actions.
- Medical, diagnostic, medication, treatment, symptom interpretation, or severity language.
- Claims that a support will improve ADHD.
- Self-harm, severe crisis, substance-use risk, mania, psychosis, or other crisis-risk language in ordinary task advice.

### Memory

MindLattice MUST use confirmed, inspectable memory rather than hidden long-term chat memory.

Memory layers:

- Session memory: current conversation, selected context, active preview, and recent revision requests.
- Workspace memory: persisted graph nodes, edges, check-ins, attention sessions, support adoptions, and strategy experiments.
- Preference memory: user-visible execution preferences inferred from accepted actions or explicitly confirmed by the user.

Preference memory MUST be viewable, editable, and deletable. The agent MAY propose preference updates, but it MUST NOT silently persist them.

Examples of acceptable preference memory:

- "Prefer no more than three next actions in a first draft."
- "Five-minute start plans are more usable than longer plans."
- "Checklists help only when they are short."

Examples of prohibited memory:

- Hidden summaries of private chat unrelated to execution support.
- Clinical labels, symptom scores, or inferred diagnoses.
- Medication, treatment, or clinician-facing conclusions.

### Prompt Governance

Prompts MUST be versioned implementation artifacts.

Prompt layers MUST include:

- System policy prompt for non-medical boundaries, crisis handling, and confirm-before-write.
- Agent role prompt for daily execution support.
- Workflow prompt for observe, classify, plan, act, review, respond, and remember.
- Tool contract prompt for allowed tool use and structured outputs.
- Output style prompt for concise, low-stimulus language.
- Skill prompts for product-level agent skills.

Prompt changes SHOULD include golden-case review for task capture, preview revision, Start Mode drafting, support matching, medical boundary rejection, and crisis redirection.

### Onboarding

Onboarding MUST ask only enough to make the default workspace useful.

Adult context choices:

- Work.
- Study.
- Home responsibilities.
- Personal projects.

Execution difficulty choices:

- Starting.
- Switching tasks.
- Remembering context.
- Choosing priority.
- Estimating time.
- Avoiding delay.
- Returning after interruption.

The default setup MUST configure the LLM provider path clearly enough for the conversational execution agent to be usable. Onboarding MUST enable quick capture, star-map canvas, Start Mode, and support templates, but it MUST NOT hide that the primary agent experience depends on configured LLM access.

### Obsidian Compatibility

The first release MUST support manual Obsidian-compatible Markdown import and export.

Import MUST read Markdown files with LF or CRLF line endings, frontmatter when available, headings, body text, wiki links such as `[[Example Note]]`, and exported relationship summaries. Duplicate imported titles or generated IDs MUST be resolved deterministically instead of silently overwriting nodes.

Export MUST write readable Markdown files with frontmatter that preserves MindLattice IDs, node kinds, status, energy, friction, estimates, and relationship hints.

SQLite MUST remain authoritative after import or export. The first release MUST NOT implement realtime bidirectional Vault synchronization.

## Acceptance Criteria

- A user can create a focus task from quick capture.
- The focus task appears as a central node on the star-map canvas.
- The user can add, edit, move, and connect surrounding nodes.
- The user can describe a messy task in natural language and receive an editable map preview.
- The user can revise the active preview in natural language before accepting it.
- The user can mark a next action and enter Start Mode.
- Start Mode shows one action, minimum done, estimate, current blocker, support, start check, and return cue.
- The user can adopt, edit, or discard support templates across all required categories.
- The user can record a strategy experiment and choose keep, revise, pause, or remove.
- The user can complete a check-in without streaks, shame language, symptom scoring, or productivity scoring.
- The graph persists locally in SQLite.
- The conversational execution agent is available after LLM provider setup and remains confirm-before-write.
- Agent proposal validation blocks medical, diagnostic, medication, symptom, treatment, and crisis content from ordinary task suggestions.
- Preference memory is visible, editable, deletable, and never silently saved from raw chat.
- Manual Markdown import/export works without making Obsidian a runtime dependency.

## Safety and Tone

Approved language:

- "Break this down."
- "Find a smaller next action."
- "What is blocking this?"
- "Start with five minutes."
- "Keep this context nearby."
- "Try this support and keep it only if it helps."
- "Leave a return cue for later."

Prohibited language:

- "Treat ADHD."
- "Diagnose your symptoms."
- "Clinical recommendation."
- "Therapy plan."
- "Guaranteed focus."
- "Medication recommendation."
- "Symptom score."
- "Clinical follow-up."
- "This strategy is right for your ADHD."
- "This will reduce ADHD symptoms."

## References

- [NICE NG87: ADHD diagnosis and management](https://www.nice.org.uk/guidance/ng87/chapter/recommendations)
- [CDC: ADHD in Adults](https://www.cdc.gov/adhd/articles/adhd-across-the-lifetime.html)
- [NIMH: ADHD in Adults](https://www.nimh.nih.gov/health/publications/adhd-what-you-need-to-know)
- [AADPA Australian Evidence-Based Clinical Practice Guideline for ADHD](https://adhdguideline.aadpa.com.au/wp-content/uploads/2024/02/ADHD-Clinical-Practice-Guideline-updated.pdf)
- [Job Accommodation Network: ADHD accommodations](https://askjan.org/disabilities/Attention-Deficit-Hyperactivity-Disorder-AD-HD.cfm)
- [FDA General Wellness: Policy for Low Risk Devices](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices)
