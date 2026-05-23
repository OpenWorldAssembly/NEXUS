# Open World Assembly Roadmap

## Purpose

This index records planned direction, sequencing, backlog, and open questions.

Use the docs this way:

- `docs/specifications.md` = what exists in code today
- `docs/implementation-guide.md` = architecture, decisions, and canon-candidate direction
- `docs/roadmap.md` = planned work, sequencing, and open questions
- `docs/concepts.md` = shared term reference

This roadmap is intentionally forward-looking. It should not imply that planned naming, routes, moderation behavior, initiative filtering, or governance execution are already implemented.

## Current planning frame

The current stack is still:

- `FCF` = principles and coordination physics
- `Nexus` = portable substrate and packet engine
- `OWA` = geography-first civic implementation running on Nexus

The repo is past the "prove the concept exists" phase. The next priority remains semantic stabilization, not another broad structural refactor.

## Chapter workflow

For roadmap planning, the chapter files under `docs/roadmap/*` are the canonical content source.

- update the relevant chapter file first when roadmap content changes
- keep this top-level file as a short index and navigation shell
- do not hand-edit generated public docs artifacts under `app/public/generated/`, `public/downloads/`, or `docs/public/version-records/`

## Chapters

- [Stabilization And Surface Polish](roadmap/stabilization-and-surface-polish.md)
- [Initiatives, Locality, And Subscriptions](roadmap/initiatives-locality-and-subscriptions.md)
- [Trust, Policy, And Moderation](roadmap/trust-policy-and-moderation.md)
- [Governance And Execution](roadmap/governance-and-execution.md)
- [Open Questions And Deferred Decisions](roadmap/open-questions-and-unsupported-decisions.md)
