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

1. User opens the grouped scope sidebar.
2. The shell updates the active scope lens.
3. Dashboard, discussions, votes, roles, trust, and Library re-project against that scope.

### Dashboard review

1. Dashboard loads packet-backed metrics, queue items, and preview packet lists for the active scope.
2. Clicking a packet row opens its preferred surface or falls back to Explorer when no route surface is appropriate.
3. Packet action menus can focus a packet inside the local preview section or open it in Explorer.
4. Validation actions can run local packet verification, return a compact result modal, and then deep-link into Explorer verification when needed.
5. Focus remains a surface-local interaction rather than a separate route or shell-wide mode.

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

### Locality search and creation

1. User opens `/nexus/locality/create`.
2. The route searches the existing locality directory first and still allows selecting an existing locality immediately.
3. If search does not find the intended place, `create_candidate` can seed the builder directly, including from the top search input when Enter is pressed.
4. The user confirms a broad-to-narrow path and runs `Review path`, which now previews the canonical planner without writing packets.
5. Review shows which levels would reuse existing localities, which levels would create new locality packets, and any duplicate warnings that still need a decision.
6. Duplicate warnings can now route back into the builder through `Use existing`, `Edit name`, or forward into an explicit `Create anyway` path.
7. If `Use as home locality` is on, selecting an existing locality or creating a new one both apply the canonical `home_locality.relation.set` path after the locality choice is finalized.
8. The review-only home-branch checklist can be adjusted visually in this pass, but it does not yet change stored home-locality packet semantics.

### Packet inspection

1. User opens Packet Explorer from the shell, Library, or link traversal.
2. Explorer loads packet summary, raw data, adapted data, read model, lineage, verification, grouped links, and runtime action visibility.
3. Explorer stays read-only for packet mutation, but its Home workspace now includes live Search, Import, and Export workbenches.
4. Search and export lookup rows now surface cached verification state when local or imported reports exist.
5. Explorer verification shows local summary state, imported or external report history, explicit current-versus-stale revision anchoring for the latest local report, and the layered breakdown that keeps structural validity, cryptographic validity, provenance, and local trust separate.
6. Library packet highlighting now clears itself when the highlighted packet is no longer represented by an Explorer packet tab.

### Packet import and validation

1. User opens Packet Explorer Home and selects `Import`.
2. The import workspace accepts pasted JSON or a browser `.json` file.
3. `Analyze` can run in one of three modes: `Validate first`, `Validate after`, or `Don't validate`.
4. `Validate first` runs structural checks plus packet verification before commit, and blocks commit on invalid signatures or canonicalization mismatches.
5. `Validate after` commits structurally safe packets first, then writes verification reports and local cache state immediately afterward.
6. `Don't validate` keeps the import structural-only, but still records a local import report for the artifact/session.
7. The Import workspace keeps recent `import_report` history visible so the operator can reopen a report or jump into one affected packet without rerunning the whole import flow.
8. That Import History surface currently represents the latest local report per imported artifact identity, not a complete append-only import event ledger.

### Packet validation

1. A packet action menu can expose `Validate`, `Revalidate`, or `View verification` depending on current local and imported evidence.
2. Validation runs through a runtime verification service rather than the fortress mutation corridor.
3. The local runtime signs `verification_report` and `import_report` packets with its own validator identity and also updates a local fast-read verification index.
4. Imported external verification reports are readable in Explorer, but local trusted status still comes only from the local node's own validation reports in this phase.
5. The Explorer `Verification` rail now exposes a direct `Verify` / `Reverify` control that refreshes the current packet payload after a local validation pass.
6. If a later preferred revision replaces the revision a local report targeted, that older report remains visible as history but is surfaced as stale rather than current verification state.

## Shell behavior

The Nexus shell currently provides:

- a dedicated Nexus layout separate from the public shell
- a two-column left-side navigation model on desktop
- a mobile overlay tray that opens the real menu rails immediately, uses `Open menu` as the visible trigger label, shrinks with rail collapse, and closes when both rails are minimized
- a desktop Packet Explorer drawer that keeps its width session-persistent and uses a dedicated drag-resize seam
- a session-scoped early-access welcome gate that blocks shell interaction until dismissed
- function-first versus scope-first as a shell preference
- `You` as a first-class personal scope lens
- grouped Home, Associated, Followed, and Discoverable scope sections with compact row-level overflow menus
- independent rail collapse state
- a profile-area route into account and identity custody surfaces
