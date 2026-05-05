# Product Surface

## Scope today

The product currently has two visible layers:

- a public OWA website shell for orientation and placeholder public pages
- a dedicated Nexus shell under `/nexus/*` for the first guest-facing OWA Nexus slice

Implemented surface today includes:

- public `Home`, `About`, and `Docs` pages inside the public shell
- Nexus identity routes for sign-in, create, claim, restore, and security
- a locality creation route for canonical geographic assembly creation
- Nexus routes for `Dashboard`, `Discussions`, `Votes`, `Roles`, `Trust`, and `Library`
- a shell-level Packet Explorer overlay
- a hidden wrapper-level `/nexus/account` custody route reached from the profile area

Not implemented today:

- remote multi-node sync beyond the local SQLite packet store
- real-time chat
- protected or private spaces
- trust-weighted ranking, moderation enforcement, delegation, or proposal execution
- dedicated routed packet detail pages outside Packet Explorer

## Current surface roles

### Library

Library is the scoped browse surface.

- it is packet-backed
- it defaults to a local-only view keyed to the active authority scope
- `Open packet` launches Packet Explorer without navigating away from Library
- packet actions on Library cards remain intentionally narrow

### Packet Explorer

Packet Explorer is the inspect-and-traverse surface.

- it opens as a shell-level overlay
- it is still read-only for packet mutation, but its Home workspace now includes a live export workbench
- it is separate from Library
- it supports session-persistent tabs with an auto-created Home tab
- its Home workspace now splits into `Search` and `Export` sub-tabs
- `Search` currently preserves the existing placeholder lookup workspace for later phases
- `Export` now supports raw preferred-revision packet export, bounded bundle export, and full local-store bundle export
- it now uses shared packet display-title normalization instead of exposing raw encoded packet ids as loaded titles where a human title can be derived
- it supports `View as` inspection lenses for `Summary`, `Raw`, `Adapted`, and `Read Model`
- it exposes `Data`, `Lineage`, `Links`, and `Actions` inspector rails
- its main content region now reads as one primary scroll surface inside the drawer instead of trapping long packet reads inside tiny inner scroll panes
- its packet-shell and inspector-control header bands can now collapse locally to reclaim vertical space without leaving helper rows behind, and collapsed bands are restored from the top command row
- it groups `Incoming` and `Outgoing` links by related packet
- it surfaces read-only `NexusActionState` and `NexusActionIntentDescriptor` data where available

Visible but disabled Explorer affordances are still placeholders:

- `Follow`
- `Fork`
- `Adapt`
- `Diff`

These disabled Explorer controls now use compact inline status markers that open a shared explainer card instead of failing silently.

### Discussions

Discussions are the most mature interactive Nexus surface today.

- discussion feed, thread, and post workspaces are packet-backed
- reply, vote, expand, and create actions are now runtime-projected instead of being only page-local heuristics
- interactive writes use the shared fortress prepare/sign/finalize corridor
- compatibility still keeps legacy discussion family shapes readable while canonical discussion packets drive current writes

### Votes

Votes are currently read-only.

- the route is packet-backed
- guests can inspect governance visibility cues and proposal or vote cards
- voting, objection, delegation, and execution workflows are not yet live
- visible disabled actions now use the same shared feature-status explainer pattern rather than acting like dead buttons

## Current caveats

The following behaviors are not active product truth yet:

- initiative filtering in feeds, Library, or Explorer
- official versus unofficial packet visibility modes
- automoderation or visibility projection beyond current placeholders and packet-backed evidence reads
- policy-driven governance execution
