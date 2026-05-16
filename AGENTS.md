# Repository Guidelines

## Project Structure & Module Organization

MindLattice is currently documentation-first. The root contains planning and governance files: `README.md`, `docs/`, `.editorconfig`, and `.markdownlint.json`. Product, architecture, and sequencing decisions live under `docs/`; update those documents before creating scaffolding that changes product behavior or technical boundaries.

The planned implementation layout is:

```text
apps/desktop/      Tauri 2 desktop shell, React/Vite UI, and src-tauri
crates/core/       Rust domain rules, graph logic, safety checks, start plans
crates/storage/    SQLite migrations and repositories
crates/ai/         Optional AI provider trait and adapters
crates/vault/      Manual Markdown import/export
docs/              Product, architecture, plan, and documentation standards
```

## Build, Test, and Development Commands

No package manager, Rust workspace, or CI scripts are present yet. Until implementation scaffolding exists, validate changes by reading the affected Markdown and checking repository status:

```powershell
git status --short
git diff -- docs README.md
```

When the planned stack is added, document the exact `cargo`, `pnpm`, Tauri, lint, and test commands here before relying on them in PRs.

## Coding Style & Naming Conventions

Use UTF-8, LF endings, final newlines, two-space indentation, and trimmed trailing whitespace as defined in `.editorconfig`. Markdown uses ATX headings, exactly one H1 per document, fenced code blocks with info strings when known, and inline code for paths, commands, DTOs, and identifiers.

Follow repository terminology consistently: `MVP`, `First release`, `Start Mode`, `star-map canvas`, `support template`, `strategy experiment`, `low-risk wellness`, and `confirm-before-write`.

## Testing Guidelines

There are no executable tests yet. For documentation changes, verify that headings do not skip levels, links are stable, and requirements use observable language. Future Rust code should include unit tests for domain rules, graph validation, storage migrations, proposal safety, and start-plan generation. Future UI code should include component tests plus smoke coverage for capture, map editing, support adoption, persistence, and Start Mode.

## Commit & Pull Request Guidelines

Recent commits use concise conventional prefixes, for example `docs:` and `chore:`. Keep that style: `docs: update architecture boundary`, `chore: initialize workspace`.

Pull requests should describe the changed scope, list updated docs or planned modules, call out safety/product-boundary effects, and include screenshots only when UI exists.

## Security & Configuration Tips

MindLattice is local-first. Do not commit API keys, local database files, generated exports with personal data, or AI provider secrets. Preserve the documented non-medical boundary: no diagnosis, treatment, medication advice, symptom scoring, or clinical claims.
