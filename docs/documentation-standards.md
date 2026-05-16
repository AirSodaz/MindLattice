# MindLattice Documentation Standards

| Field | Value |
| --- | --- |
| Status | Draft |
| Owner | Product and engineering |
| Last updated | 2026-05-16 |
| Scope | Markdown, terminology, evidence, and safety-language standards |

## Purpose

These standards keep MindLattice documentation useful as an engineering artifact. Docs MUST be specific enough to guide implementation and conservative enough to preserve the product's self-help, non-medical boundary.

## Document Structure

Each primary document under `docs/` SHOULD include a metadata table immediately after the H1:

| Field | Expected value |
| --- | --- |
| Status | `Draft`, `Accepted`, `Deprecated`, or `Superseded` |
| Owner | Responsible role or team |
| Last updated | ISO date, such as `2026-05-16` |
| Scope | One sentence describing what the document governs |

Each Markdown file MUST have exactly one H1. Heading levels MUST NOT skip levels.

## Requirement Language

Use RFC-style requirement words:

- `MUST`: required for the documented scope.
- `MUST NOT`: prohibited for the documented scope.
- `SHOULD`: expected default; exceptions require a reason.
- `MAY`: allowed but optional.

Avoid vague implementation language such as `TBD`, `TODO`, `when useful`, `where practical`, `as appropriate`, or `similar`. If the requirement is intentionally deferred, name the phase or document that owns it.

## Terminology

Preferred terms:

- `MVP`
- `First release`
- `Start Mode`
- `star-map canvas`
- `support template`
- `strategy experiment`
- `low-risk wellness`
- `confirm-before-write`
- `conversational execution agent`
- `agent preview`
- `agent skill`
- `confirmed memory`
- `LLM provider`

Avoid mixing these with near-synonyms such as `first version`, `launch mode`, or `productivity score` unless the text is explicitly rejecting that concept.

## Acceptance Criteria

Acceptance criteria MUST be observable. Prefer:

- "User can adopt a support template and record keep/revise/pause/remove."
- "Agent proposal validation rejects medication advice."

Avoid:

- "Works well."
- "Handles edge cases."
- "Provides appropriate feedback."

## Evidence and References

Evidence references MUST appear in a `References` or `Evidence Boundary` section. Product requirements MAY summarize implications, but they MUST NOT present medical guidance as individualized advice.

For ADHD-related language:

- Say: "execution support", "support attention routines", "try a low-risk support".
- Do not say: "treat ADHD", "reduce ADHD symptoms", "clinical recommendation", or "therapy plan".

## Safety Language

MindLattice is not medical software. Documentation and product copy MUST NOT claim that the app can:

- Diagnose ADHD.
- Treat, prevent, mitigate, or reduce ADHD symptoms.
- Replace clinicians.
- Recommend, stop, or change medication.
- Interpret symptom scales.
- Produce clinician-facing reports.

Crisis-related content MUST be routed away from ordinary productivity advice and toward concise professional or emergency support guidance.

## Markdown Style

- Use ATX headings with `#`.
- Use fenced code blocks with an info string when the language is known.
- Use inline code for identifiers, commands, file paths, DTO names, enum values, and table names.
- Keep README files concise and link to detailed docs.
- Prefer tables for metadata, phase matrices, and command surfaces.
- Prefer bullets for requirements and acceptance criteria.
- Keep links stable and descriptive.

## Tooling

The repository includes `.editorconfig` and `.markdownlint.json` as lightweight standards. They are configuration only until the project adds a package manager, script, or CI workflow.
