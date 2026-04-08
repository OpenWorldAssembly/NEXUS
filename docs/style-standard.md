# OWA Style Standard

## Purpose

Keep code consistent, readable, and aligned with OWA concepts.  
When in doubt: be clear, simple, and consistent.

---

## 1. File Header

Every important file should start with:

```ts
/**
 * File: filename.ts
 * Description: What this file does.
 */
```

Keep it short. Skip only for trivial index/re-export files.

---

## 2. Naming

- `PascalCase` → components, types
- `camelCase` → variables, functions
- `kebab-case` → folders, routes
- `UPPER_SNAKE_CASE` → constants

### Booleans
Use clear names:
- `isOpen`, `hasAccess`, `canVote`

### Handlers
- `handleX` → internal functions  
- `onX` → props/callbacks

---

## 3. Use Canonical Terms

Always prefer:

- assembly
- initiative
- proposal
- mission
- packet
- vote
- membership
- nexus

Do not invent new terms if one already exists.

---

## 4. Components & Logic

- Keep components small and focused  
- Move logic out of UI when possible  
- Avoid mixing data logic and UI  

---

## 5. Comments

Each function should have a basic description with inputs/outputs/etc.
Comment inline only when it adds value.


Good:
- explain *why*
- explain non-obvious behavior

Avoid:
- obvious comments
- long explanations

Bad:
```ts
// increment count
count++;
```

Good:
```ts
// optimistic update so UI responds before server sync
```

---

## 6. Functions

- Keep functions small
- Use clear names
- Prefer early returns over deep nesting
- Prefer additional dedicated files over extra-long files

---

## 7. Types

- Avoid `any`
- Use clear, simple types
- Keep shared types consistent

---

## 8. Docs Sync

If we change:
- behavior
- naming
- structure

→ update docs

No silent decisions.

---

## 9. Default Rule

If unsure:
- choose the clearer name
- choose the simpler approach
- follow existing patterns
