# Known Gaps And Provisional Notes

## Current known gaps

- identity/auth and discussions remain the two strongest end-to-end verticals
- votes, trust, roles, and Library are packet-backed, but are still comparatively provisional
- dashboard is live and packet-backed, but deeper verification, trust, and governance meaning on its preview surfaces remains provisional
- role creation and editing remain deferred
- broader moderation, trust weighting, and governance execution remain deferred

## Location and relationship caveats

- `home_locality` is now the packet-backed source of mounted geographic ancestry, with canonical writes producing both a relation and supporting claim
- `identity.location_disclosure` remains optional profile metadata rather than mounted-scope truth
- `assembly_association` remains distinct from `home_locality`
- followed scopes are now packet-native on the write path, but legacy shell-preference follows remain readable through an explicit compatibility bridge during transition
- `Location` is now part of locality creation through provisional `region` packets, and those packets now carry descriptor metadata in `spatial_payload.scope_descriptor`, but provider-backed normalization, richer external refs, and broader equivalence handling remain later work
- legacy `nation | region | city | district` locality levels remain current compatibility buckets rather than the full future locality model
- locality ancestry is now planned from ordered broad-to-narrow path entries, and sparse paths are valid current behavior; absolute depth is still projection-only and is not stored on packets
- locality creation now has a real non-mutating review seam, but the home-branch inclusion checklist shown during review is still preview-only and does not yet alter stored `home_locality` relation semantics
- locality confirm now applies home, association, follow, and `main` visibility choices through one composite runtime write seam; claimed `main` scope-display state now persists through `Preference.element` packets while guest/session behavior remains compatibility state
- associated and followed parent-context display now persists through the same claimed-actor `Preference.element` bridge, with guest compatibility fallback still session/cookie-based
- same-name locality matches in other parent branches no longer need to suppress the create-path handoff, but orphan existing-scope remounting is still intentionally unresolved rather than silently repaired in this phase
- generic abstract assembly creation and richer locality governance are still later work

## Explorer caveats

- Packet Explorer is read-only for packet mutation
- Packet Explorer Search, Import, and Export are live
- Packet Explorer verification is now live for local validation, imported report reading, and truthful layered status display
- Packet Explorer verification is now revision-aware and stale-aware for the currently preferred revision, but richer revalidation workflows remain deferred
- Packet Explorer Import now keeps recent import-report history visible inside the Import workspace, but that history currently reflects the latest local report per imported artifact identity rather than a full event-by-event ledger; richer filtering, artifact lineage browsing, and bundle-native history are still later work
- fork or adapt execution, diff, and compare are not live yet
- validation now distinguishes `validate first`, `validate after`, and `don't validate`, but local trust still remains node-local rather than peer-weighted
- packet verification reports and import reports now exist, but richer provenance surfacing, peer-trust weighting, and broader report semantics remain next seams
- a dedicated validation workflow screen is intentionally deferred
- official versus unofficial initiative filtering is not active product behavior
- initiative-version subscription behavior is not active product behavior
- the generic scope graph is now decoupled from OWA-specific initiative-anchor policy lookup, but broader initiative and locality projection cleanup is still incomplete

## Moderation and governance caveats

- moderation workflows are not yet implemented as live user-facing policy systems
- current disabled controls should be read as placeholders, not as hidden active features
- the first high-friction Nexus surfaces now attach compact inline explainers to disabled or partial controls so users can see whether a seam is `coming soon`, `read-only`, or `partial`
- proposals, votes, and decisions are present in packets and read surfaces, but governance is not yet a fully interactive trusted workflow

## Provisional guidance

The following areas should still be treated as provisional:

- the shell-level early-access gate is now an honest entry warning, but it is not yet a tutorial, release-note system, or scope-aware onboarding flow
- the new feature-status registry and popover system currently covers Explorer, Votes, and Library first; broader surface rollout is still pending
- deeper trust weighting and moderation consequences
- vote execution, delegation, and propagation semantics
- long-term initiative filtering and visibility modes
- packet actions that currently appear as disabled placeholders
- hardening the remaining Preference runtime connector corridor before applying the same procedure to other packet families
- any architecture or theory in the implementation guide that is not already represented in executable code
