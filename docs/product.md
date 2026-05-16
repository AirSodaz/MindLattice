# MindLattice Product Design

## Vision

MindLattice helps adults with ADHD traits externalize working memory, lower task-start resistance, and turn unclear responsibilities into visible, startable next actions.

Many productivity tools assume the user can already hold the whole task in mind, choose priorities, and translate intention into action. MindLattice assumes the opposite: the system should help carry context, expose hidden blockers, make ambiguity visible, and reduce the first step until it is small enough to start.

## Audience

Primary users:

- Adults who experience task paralysis, overwhelm, context loss, or difficulty starting multi-step work.
- Users who like local knowledge tools such as Obsidian but need stronger task decomposition and execution support.
- Users who want their data to remain local by default.

Non-goals:

- Diagnosis or treatment of ADHD.
- Clinical tracking for therapists.
- A full replacement for calendars, project management suites, or note-taking systems in the first version.

## Core Product Loop

The MVP should be built around one loop:

1. **Capture**: The user enters a messy task in a low-friction input.
2. **Externalize**: The task becomes a central node in a star-map canvas.
3. **Decompose**: The user or AI adds surrounding nodes such as subtasks, blockers, resources, notes, and possible next actions.
4. **Confirm**: AI proposals remain suggestions until the user accepts them.
5. **Start**: The app narrows the map to a single next action with a simple launch affordance.
6. **Return**: The user can come back later and recover context from the visible map.

## Star-Map Canvas

The first UI model is a star map:

- One focus node sits in the center.
- Related nodes orbit around it.
- Edges explain relationships instead of just drawing decoration.
- Visual density should stay controlled so the canvas helps memory rather than becoming another source of noise.

Node kinds:

- `task`: a meaningful unit of work.
- `subtask`: a smaller part of a task.
- `blocker`: a reason the task feels hard or cannot move.
- `note`: context the user wants to keep nearby.
- `resource`: a file, link, reference, or material needed for the task.
- `next_action`: a concrete action small enough to start.

Edge kinds:

- `breaks_down_to`: parent work decomposes into smaller work.
- `blocked_by`: a task is blocked by something.
- `supports`: a note or resource supports a task.
- `leads_to`: one action naturally leads to another.
- `related`: a loose association.

## Low-Friction Start Mode

The "start" experience should reduce the map to one action:

- Show only the selected next action, its parent task, and at most three supporting context items.
- Prefer 5-minute or small-step language.
- Avoid motivational guilt, streak pressure, and noisy dashboards.
- Let the user return to the full map at any time.

## AI Role

AI is an assistant, not the source of truth.

First-version AI behavior:

- Takes a messy task, optional notes, and current map context.
- Proposes nodes and edges.
- Labels blockers and possible next actions.
- Returns structured data.
- Does not write directly to storage.
- Does not produce medical advice.

The user must explicitly accept a proposal before it becomes part of the graph.

## Obsidian Compatibility

The first version supports manual Obsidian Vault import and export.

Import should read Markdown files, frontmatter when available, headings, body text, and wiki links such as `[[Example Note]]`.

Export should write human-readable Markdown files with frontmatter that preserves MindLattice IDs, node kinds, status, energy, friction, estimates, and relationship hints.

The first version should not implement realtime bidirectional sync with an Obsidian Vault. SQLite remains the authoritative store.

## Safety and Tone

MindLattice should use calm, practical product language. It can say:

- "Break this down."
- "Find a smaller next action."
- "What is blocking this?"
- "Start with five minutes."
- "Keep this context nearby."

It should not say:

- "Treat ADHD."
- "Diagnose your symptoms."
- "Clinical recommendation."
- "Therapy plan."
- "Guaranteed focus."

## MVP Acceptance Criteria

- A user can create a focus task from a quick input.
- The focus task appears as a central node on a star-map canvas.
- The user can add, edit, move, and connect surrounding nodes.
- The user can mark a next action and enter start mode.
- The app persists the graph locally in SQLite.
- AI decomposition is available only when configured and remains confirm-before-write.
- Manual Markdown import/export works without making Obsidian a runtime dependency.
