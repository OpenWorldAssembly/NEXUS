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
- `Location` is now part of locality creation through provisional `region` packets, but provider-backed normalization, richer payload conventions, and external refs remain later work
- locality creation now has a real non-mutating review seam, but the home-branch inclusion checklist shown during review is still preview-only and does not yet alter stored `home_locality` relation semantics
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
- any architecture or theory in the implementation guide that is not already represented in executable code
