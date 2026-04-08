# AGENTS.md

## Core rules

- When writing or editing code, follow `/docs/style-standard.md`.
- Do not modify canon documents without explicit user permission.
- After any change that affects behavior, structure, naming, or workflow, update:
  - `/docs/implementation-guide.md`
  - `/docs/specifications.md`
- If a change may affect docs but the impact is unclear, flag it explicitly.
- No silent decisions. Record meaningful implementation decisions in the implementation guide.

## Documentation roles

- `style-standard.md` defines naming, commenting, and code style.
- `implementation-guide.md` tracks decisions, tradeoffs, and evolving implementation notes.
- `specifications.md` defines the current intended behavior and structure of the system.
- Canon documents are protected and must not be edited unless explicitly requested.

## Definition of done

A task is not complete until:
- code changes are made
- relevant checks are run
- applicable docs are updated