# Nexus Routes And Workflows

## Public routes

- `/` = landing page for OWA
- `/about` = public explanation page
- `/docs` = public charter destination page and source-material explainer
- `/login` = redirect to `/nexus/identity/sign-in`
- `/signup` = redirect to `/nexus/identity/create`

## Nexus routes

- `/nexus` redirects to `/nexus/dashboard`
- `/nexus/dashboard` = packet-backed dashboard
- `/nexus/discussions` = packet-backed discussion shell with `Feed`, `Thread`, and `Post`
- `/nexus/votes` = read-only vote floor
- `/nexus/library` = scoped packet browse surface
- `/nexus/trust` = scoped trust posture and relationship surface
- `/nexus/roles` = scope-centric role review surface
- `/nexus/account` = hidden wrapper-level custody route
- `/nexus/identity/*` = sign-in, create, claim, restore, and security ceremonies
- `/nexus/locality/create` = guided locality directory and creation flow

## Core workflows

### Nexus entry

1. User enters `/nexus`.
2. The route redirects to `/nexus/dashboard`.
3. The shell loads in `Global Guest` state.
4. The initial mounted baseline is `Global + You`.

### Scope selection

1. User opens the scope menu or followed scopes.
2. The shell updates the active scope lens.
3. Dashboard, discussions, votes, roles, trust, and Library re-project against that scope.

### Discussion posting

1. The route loads packet-backed discussion state.
2. The actor is a real `Element(kind: "person")`, including temporary guests.
3. The browser prepares a canonical mutation through the shared fortress corridor.
4. The active web identity shell signs the prepared packets locally.
5. Finalize re-verifies digest, signature, proof level, authority, and policy before persistence.

### Trust and role review

1. `Trust` loads scope-local trust posture and relationship state.
2. `Roles` loads exact-scope role claims, claimants, and support or dispute evidence.
3. Protected guest actions open the shared auth-gate flow instead of trying raw writes.

### Packet inspection

1. User opens Packet Explorer from the shell, Library, or link traversal.
2. Explorer loads packet summary, raw data, adapted data, read model, lineage, grouped links, and runtime action visibility.
3. Explorer stays read-only and uses session-backed tab state.
4. Library packet highlighting now clears itself when the highlighted packet is no longer represented by an Explorer packet tab.

## Shell behavior

The Nexus shell currently provides:

- a dedicated Nexus layout separate from the public shell
- a two-column left-side navigation model on desktop
- a mobile overlay tray that opens the real menu rails immediately, uses `Open menu` as the visible trigger label, shrinks with rail collapse, and closes when both rails are minimized
- a desktop Packet Explorer drawer that keeps its width session-persistent and uses a dedicated drag-resize seam
- a session-scoped early-access welcome gate that blocks shell interaction until dismissed
- function-first versus scope-first as a shell preference
- `You` as a first-class personal scope lens
- independent rail collapse state
- a profile-area route into account and identity custody surfaces
