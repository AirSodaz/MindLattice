# Repository Guidelines

## Project Structure & Module Organization

MindLattice began documentation-first and now includes the Phase 1-7 MVP scaffold. The root contains planning and governance files, plus the Cargo workspace. Product, architecture, and sequencing decisions live under `docs/`; update those documents before changing product behavior or technical boundaries.

The planned implementation layout is:

```text
apps/desktop/      Tauri 2 desktop shell, React/Vite UI, and src-tauri
crates/core/       Rust domain rules, graph logic, safety checks, start plans
crates/storage/    SQLite migrations and repositories
crates/ai/         AI provider trait and OpenAI-compatible adapter
crates/vault/      Manual Markdown import/export
docs/              Product, architecture, plan, and documentation standards
```

## Build, Test, and Development Commands

The Rust workspace exists. Validate Rust changes with:

```powershell
cargo test --workspace
```

Validate the desktop UI scaffold with Corepack-pinned pnpm:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm test
corepack pnpm build
corepack pnpm smoke:e2e
```

Run the Tauri desktop shell locally with:

```powershell
corepack pnpm dev
```

For documentation-only changes, validate by reading the affected Markdown and checking repository status:

```powershell
git status --short
git diff -- docs README.md
```

Build the Windows Tauri package with:

```powershell
corepack pnpm tauri build
```

## Coding Style & Naming Conventions

Use UTF-8, LF endings, final newlines, two-space indentation, and trimmed trailing whitespace as defined in `.editorconfig`. Markdown uses ATX headings, exactly one H1 per document, fenced code blocks with info strings when known, and inline code for paths, commands, DTOs, and identifiers.

Follow repository terminology consistently: `MVP`, `First release`, `Start Mode`, `star-map canvas`, `support template`, `strategy experiment`, `low-risk wellness`, and `confirm-before-write`.

## Testing Guidelines

Rust code includes unit and integration tests for domain rules, graph validation, storage migrations, proposal safety, agent orchestration, command registration, Vault import/export, and start-plan generation. UI code includes Node test coverage for model/controller behavior, Settings rendering, command-client mapping, MVP business flow, and browser-driven smoke coverage for first load, Settings setup, quick capture, and Start Mode.

For documentation changes, verify that headings do not skip levels, links are stable, and requirements use observable language. Keep `docs/development-plan.md` and `docs/smoke-test-checklist.md` aligned whenever validation scope changes.

## Commit & Pull Request Guidelines

Recent commits use concise conventional prefixes, for example `docs:` and `chore:`. Keep that style: `docs: update architecture boundary`, `chore: initialize workspace`.

Pull requests should describe the changed scope, list updated docs or planned modules, call out safety/product-boundary effects, and include screenshots only when UI exists.

## Security & Configuration Tips

MindLattice is local-first. Do not commit API keys, local database files, generated exports with personal data, or AI provider secrets. Preserve the documented non-medical boundary: no diagnosis, treatment, medication advice, symptom scoring, or clinical claims.
