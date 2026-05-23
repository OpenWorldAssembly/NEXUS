# AGENTS.md

## Purpose

Execute changes efficiently, conservatively, and in alignment with OWA architecture.

Default priorities:

1. Preserve working behavior
2. Minimize churn
3. Protect architecture
4. Conserve resources
5. Keep code clear and maintainable

---

# Core Rules

## Preserve Existing Design

Do not redesign or alter without explicit permission:

- UI layout
- spacing
- ratios
- typography
- animation
- colors
- copy
- interaction behavior

When refactoring, preserve live visuals and behavior exactly unless asked otherwise.

---

## Resource Discipline

- Prefer the smallest viable fix.
- Prefer surgical edits over rewrites.
- Avoid speculative refactors.
- Do not replace working code for style alone.
- Avoid unnecessary token/computation usage.
- Inspect before changing.

---

## Minimal Blast Radius

- Touch only files relevant to the task.
- Do not modify unrelated systems.
- Do not introduce broad changes to solve narrow problems.
- When possible, provide changed-files-only outputs.

---

## No Guessing

Before changing code:

- inspect current implementation
- verify file responsibilities
- verify prop names / interfaces
- identify likely root cause

Do not present a fix as certain unless the fault was traced.

---

# Architecture Rules

## Core vs Adapter Split

### Core Code (portable, long-term)

Keep platform-agnostic logic in core:

- packet schemas
- validation
- graph relationships
- governance logic
- trust systems
- identity systems
- merge/import/export
- deterministic business logic
- shared domain models

Core must not depend on:

- Discord
- React UI
- CSS/layout
- Expo/web assumptions
- platform-specific APIs

### Adapter / UI Code (replaceable surfaces)

Keep platform-specific logic in adapters/UI:

- website pages
- React components
- navigation
- styling
- Discord bot interactions
- embeds/buttons/modals
- transport glue
- page state

Adapters translate user actions to core operations.

---

## Separation Rule

Do not mix domain logic into presentation code.

Ask first:

1. Is this core?
2. Is this adapter/UI?
3. Is this shared utility?

Put code in the right layer.

## Current Split Contract

Use the final top-level folders:

- `core/*` = portable packet logic, schemas, builders, deterministic helpers, and pure projections
- `runtime/*` = persistence adapters, runtime services, service composition, and API-facing glue
- `app/*` = application-layer components, hooks, constants, public content, and shared UI/state
- `src/app/*` = Expo Router entry shell only; route files and API entrypoints should stay thin and call into `app/*`, `runtime/*`, and `core/*`

Do not introduce user-facing renames as part of this refactor unless explicitly requested.
Keep routes, payload shapes, and visible behavior stable while splitting responsibilities.

---

# File Structure Rules

- Prefer focused files over oversized monoliths.
- Extract growing files by responsibility:
  - UI
  - controller/state
  - domain logic
  - utility
- Do not over-fragment trivial code.
- Preserve discoverability.

---

# Embedded Style Standard

## Naming

- PascalCase -> components, types
- camelCase -> variables, functions
- kebab-case -> folders, routes
- UPPER_SNAKE_CASE -> constants

## Booleans

Use clear names:

- isOpen
- hasAccess
- canVote

## Handlers

- handleX = internal function
- onX = callback/prop

---

## Canonical Terms

Prefer existing terms.
Do not invent alternate terms unnecessarily.

---

## Components

- Keep components focused.
- Move logic out of UI when possible.
- Reuse existing patterns before inventing new ones.

---

## Functions

- Keep functions small.
- Use clear names.
- Prefer early returns over nesting.

---

## Types

- Avoid any.
- Use simple explicit types.

---

## Comments

Explain:

- what
- why
- constraints
- non-obvious behavior
- function inputs and outputs

Avoid obvious narration.

---

# Documentation Rules

Do not modify canon documents without explicit user permission.

After changes affecting behavior, structure, naming, workflow, or architecture, update the relevant chapter files under:

- `/docs/implementation-guide/*`
- `/docs/specifications/*`
- `/docs/roadmap/*`

Treat the top-level files:

- `/docs/implementation-guide.md`
- `/docs/specifications.md`
- `/docs/roadmap.md`

as short index/shell documents only. Update them only when their index-level content changes, such as chapter links, usage notes, or status framing.

Never hand-edit generated public docs artifacts:

- `/app/public/generated/public-docs.generated.ts`
- `/public/downloads/*`
- `/docs/public/version-records/*`

After changing canon doc sources, always validate the source documents:

- `npm run docs:validate`

Only rebuild generated public docs artifacts when needed:

- during site/export builds
- when intentionally refreshing committed generated outputs
- when verifying that generated public docs changed as expected

Use:

- `npm run docs:build`

If doc impact is uncertain, flag it explicitly.

No silent decisions.

Record meaningful implementation decisions in the implementation guide.

## Schema evolution guardrail

Before changing packet schemas, read:

- `/docs/implementation-guide/core-entities-and-packet-model.md`

Also read:

- `/docs/implementation-guide/trust-moderation-and-policy.md`

when changing `Claim`, `Attestation`, `Relation`, or `Policy` semantics.

For any packet type schema version change, you must:

- update the active schema/body shape
- update the type compatibility registry entry
- add or update upcast/downcast adapters where backward compatibility is intended
- update current schema version metadata
- update builders/type build definitions so new writes emit the canonical current shape
- update signature/write-preparation behavior if additive/defaulted fields affect compatibility or signing
- add or update tests for parse/read compatibility, adapted reads, write preparation, and any supported upcast/downcast path
- document the change in the relevant chapter and, when meaningful, the decision log

---

# Reporting Rules

After completing work, clearly state:

- what changed
- which files changed
- why
- checks run
- any uncertainty / follow-up risks

---

# Definition of Done

A task is complete only when:

- code changes are made
- relevant checks are run
- no unrelated regressions were introduced
- applicable docs are updated
- changes are clearly reported
