# Known Gaps And Provisional Notes

## Current known gaps

- identity/auth and discussions remain the two strongest end-to-end verticals
- dashboard, votes, trust, roles, and Library are packet-backed, but are still comparatively provisional
- role creation and editing remain deferred
- packet-native follows remain deferred
- broader moderation, trust weighting, and governance execution remain deferred

## Location and relationship caveats

- `home_locality` is now the packet-backed source of mounted geographic ancestry
- `identity.location_disclosure` remains optional profile metadata rather than mounted-scope truth
- `assembly_association` remains distinct from `home_locality`
- generic abstract assembly creation and richer locality governance are still later work

## Explorer caveats

- Packet Explorer is read-only
- follow semantics, fork or adapt execution, diff, and compare are not live yet
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
