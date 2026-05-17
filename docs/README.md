# MindLattice Documentation Index

| Field | Value |
| --- | --- |
| Status | Draft |
| Owner | Product and engineering |
| Last updated | 2026-05-17 |
| Scope | Documentation map and maintenance guide |

## Purpose

This directory contains the source of truth for MindLattice product, architecture, and sequencing decisions. Product, architecture, and development documents MUST remain aligned before implementation changes product behavior or technical boundaries.

## Document Map

| Document | Purpose | Primary readers | Update when |
| --- | --- | --- | --- |
| [Product Requirements](product.md) | Defines product boundary, MVP behavior, safety tone, and acceptance criteria. | Product, design, engineering | Product behavior, safety boundary, or MVP scope changes. |
| [UI Style](ui-style.md) | Defines cross-platform visual style, theme behavior, and design token rules. | Product, design, engineering | Visual style, themes, component styling, or platform UI rules change. |
| [Market Research](market-research.zh-CN.md) | Summarizes market landscape, competitive positioning, development direction, feature design, and interaction design. | Product, design, engineering | Product positioning, competitive assumptions, or market strategy changes. |
| [Architecture](architecture.md) | Defines technical boundaries, planned repo structure, DTOs, storage, commands, and safety architecture. | Engineering | Core interfaces, storage model, command surface, or platform assumptions change. |
| [Development Plan](development-plan.md) | Defines implementation phases, dependencies, deliverables, and validation. | Engineering, QA | Phase order, test strategy, or release readiness changes. |
| [Smoke Test Checklist](smoke-test-checklist.md) | Lists manual MVP checks for fresh install, agent flow, Start Mode, Vault, safety, and packaging. | Engineering, QA | Release validation scope or packaging gates change. |
| [Documentation Standards](documentation-standards.md) | Defines writing rules for Markdown, terminology, evidence use, and safety language. | Anyone editing docs | Documentation style or governance rules change. |

## Maintenance Rules

- README files are navigation surfaces. They SHOULD summarize and link; they SHOULD NOT duplicate detailed requirements.
- Product changes MUST update [Product Requirements](product.md) first.
- Visual style, theme, or component styling changes MUST update [UI Style](ui-style.md).
- Technical interface changes MUST update [Architecture](architecture.md) before implementation.
- Phase or validation changes MUST update [Development Plan](development-plan.md).
- All user-facing medical or ADHD-related language MUST follow [Documentation Standards](documentation-standards.md).
- New documents SHOULD include the metadata table used in this directory.

## Current Repository State

The repository now includes the first Rust workspace scaffold under `crates/core`, `crates/storage`, `crates/ai`, `crates/agent`, `crates/vault`, and `apps/desktop/src-tauri`, plus a React/Vite desktop UI scaffold under `apps/desktop/src`. `crates/ai` includes API-mode-specific LLM transports for OpenAI Chat Completions compatible, OpenAI Responses compatible, Claude Messages compatible, and Google Gemini native `generateContent` providers. The desktop UI includes provider presets, explicit API-mode selection, and `i18next`/`react-i18next` localization for English and Simplified Chinese interface text.
