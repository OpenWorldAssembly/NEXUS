# Architecture And State

## Active source split

- `core/*` holds portable packet logic, schemas, builders, interpreters, contracts, and pure projections
- `runtime/*` holds trusted runtime coordination, storage adapters, runtime services, query services, auth/trust/discussion orchestration, and API-facing glue
- `app/*` holds application-layer components, hooks, constants, public content, and shared shell state
- `src/app/*` holds the Expo Router route shell and API entrypoints

## Current runtime and state patterns

- public pages are still mostly stateless
- Nexus state is shared through local React context providers
- shell and route projections load from packet-backed API routes
- the runtime store is SQLite-backed
- packet parsing runs through type compatibility and adaptation instead of route-local patches
- Packet Explorer session state is shell-level rather than route-level page state

## Packet and compatibility foundations in active use

Current packet behavior in code includes:

- `PacketEnvelope = { header, body }`
- stable `packet_id`
- immutable `revision_id`
- multi-parent `parent_revision_refs`
- type `schema_version`
- type `revision_mode`
- raw stored packets preserved as historical fact
- adapted runtime packets used as the normal read shape
- target-version-aware compatibility reads for supported types

Forward ontology currently active in code includes:

- `Action`, `Relation`, and `Location` as first-class packet types, with `Action(subtype: initiative)` carrying the forward initiative/default anchor
- `Report` as a first-class packet type for verification and import reporting
- `Element.subtype` as the forward classifier, with `kind` preserved as compatibility metadata
- widened `Claim` packets for packet-targeted assertion content plus optional `relation_assertion`
- widened `Reaction` packets with canonical `subtype` semantics
- `Policy.relation_requirements` as the packet-backed seam for relation support rules

Current scope consumer direction in code includes:

- shell scope projection now prefers packet-native `Relation(subtype: default_ancestry_parent)` for ancestry
- home locality now resolves through relation-first projection with explicit compatibility fallback instead of claim-first shell logic
- follow now resolves packet-natively from `Relation(subtype: follow)` first, with legacy shell preference state reduced to an explicit compatibility bridge
- association now resolves packet-natively from `Relation(subtype: association)` first, with legacy claim-only reads reduced to explicit compatibility projection and associated scopes treated as mounted related scopes
- followed, associated, known, discoverable, and home-ancestor semantics are now carried as additive packet-backed scope-summary metadata
- locality creation now emits provisional `Location(subtype: region)` packets plus `Relation(subtype: defined_by_location)` so linked location packets are part of the live writer path as well as the read seam
- the active shell sidebar now consumes server-projected graph sections rather than reconstructing section truth from thin scope-id arrays
- scope projection now returns `home`, `associated`, `followed`, `main`, and `discoverable` sections, with descriptor-aware grouping and optional lightweight parent-context chains for associated and followed scopes
- locality confirmation now uses one composite runtime apply seam above `locality.path.create` so structural locality writes, scope relations, and packet-backed claimed display preferences are coordinated together
- `main` is a display preference, not a relation; claimed actors now persist it through `Preference.element` packets with the legacy runtime table kept as a compatibility cache
- claimed shell preference reads are session-bound before projecting private `Preference.element` state
- guest scope-display preference behavior remains an explicit compatibility/session bridge
- `Preference.element.value.interface.shell_chrome` now carries live navigation mode, theme mode, and UI density reads/writes through the signed mutation corridor for claimed actors, with the shell preferences API reserved for guest compatibility state
- the current home trunk renders broadest-to-smallest, while associated scopes remain mounted related scopes outside the geographic ancestry chain
- shell UI actions for follow and association now route through the canonical mutation corridor and refresh scope projection after success instead of relying on local-only toggles
- dashboard payloads are now scope-backed runtime projections rather than static shell filler
- shared packet-card projection and action-menu behavior now spans dashboard previews and related Nexus surfaces
- focused packet state is currently a surface-local UI layer over packet-backed preview lists rather than a separate routed or core packet concept
- the first verification chapter now treats report packets as the signed source of truth for local packet verification and import reporting, with a runtime-owned verification cache layered on top for fast UI reads
- the local runtime now owns a normal signed validator identity and uses it to sign `verification_report` and `import_report` packets without routing those writes through user-authored mutation tickets
- OWA-specific initiative-anchor relation-policy lookup now lives in a narrower adapter layer instead of being embedded directly inside the generic scope-graph projection core

## Public docs build system

- `docs/public/public-docs.manifest.json` is the source list for generated public docs
- `scripts/validate-public-docs.mjs` validates manifest and source-of-truth rules before generation
- `scripts/build-public-docs.mjs` compiles readable docs data into `app/public/generated/public-docs.generated.ts`
- the same build emits Markdown and PDF downloads under `public/downloads/` and version records under `docs/public/version-records/`
- the chaptered internal docs use chapter files as canonical source material; the top-level shell docs are not part of the public compiled document content

Current runtime contracts worth keeping visible here:

- `NexusActionState`
- `NexusActionIntentDescriptor`
- `NexusPacketExplorerPayload`

## Query and surface boundaries

- packet storage, compatibility, import/export, and merge remain below the route layer
- route components consume query payloads rather than storage classes directly
- runtime projects discussion and Explorer action visibility rather than leaving those rules entirely in page code

## Current naming and structure notes

- route file names are lowercase and match path segments directly
- React components use PascalCase
- route screens continue to end with `Page`
- shared Nexus components live under `app/components/nexus`

The current repo is no longer using the older `domain` or `storage` root names. The active architecture is the `core / runtime / app / src/app` split described above.

## Trusted coordinator structure

Trusted runtime coordinator code now lives under `runtime/trusted_coordinators/*`. The folder contains shared coordinator result helpers, lightweight process-chain diagnostics, the trusted issue taxonomy, the scaffold manifest, the Trusted Dispatch Coordinator front desk, the compatibility Trusted Request Coordinator implementation, the portable-resolution coordinator, the Trusted Projection Coordinator, the Trusted Definition Coordinator, the Trusted Regulation Coordinator, the Trusted Planning Coordinator, the Trusted Building Coordinator, the Trusted Inspection Coordinator, the Trusted Certification Coordinator, the Trusted Archive Coordinator, the Trusted Verification Coordinator, the Trusted Compatibility Coordinator, the Trusted Exchange Coordinator, direct packet workflow promotion, composite workflow promotion, and composite workflow adapter descriptors. Nexus server routes and mutation services may call these coordinators, but executable trusted behavior remains runtime-owned rather than imported from packet definitions. Foldered trusted coordinators are gated: external callers use public coordinator surfaces while internal function modules and registries stay private. The scaffold audit records which coordinators are fully foldered, validates public surfaces, canonical result kinds, registered issue codes, and process-chain envelope support, and keeps Resolution as the only accepted legacy-flat warning. Building is now foldered/gated and consumes trusted operation plans to emit candidate packet graphs; it does not own definition lookup, policy resolution, default resolution, dependency resolution, certification, or archival. Inspection is now foldered/gated and validates build results against frozen operation plan snapshots. Certification is now foldered/gated and owns the ticket/signature/hash handoff after Inspection. Archive is now foldered/gated and owns packet-store writes, archived reads, revision resolution, edge queries, archive search rows, and low-level bundle import/export primitives. Verification is now foldered/gated and owns packet, batch, bundle, archive-set, lineage, reference-closure, and certification-handoff checks while relying on Archive for stored packet material. Compatibility is now foldered/gated and owns runtime schema-version posture, read adaptation, write preparation, adapter-path metadata, registry/Definition profile checks, and coverage/readiness audits while leaving executable adapter logic in core schema compatibility. Exchange is now foldered/gated and owns packet-movement previews, import commits, export wrappers, shallow merge plans, and rebundle flows while composing Archive, Verification, and Compatibility. Projection is now foldered/gated and owns archive-backed UI read models for packets, lists, and graph neighborhoods while relying on Definition for projection descriptors.

Process chains are runtime diagnostic objects rather than persisted packet records. They preserve stage order, child coordinator results, canonical issue codes, summarized artifacts, and completed/failed/blocked/skipped work. Report packets remain the durable signed reporting surface, but process chains can only be converted into report drafts until a later pass decides when diagnostics should be signed and archived.

The core packet-definition surface now includes richer projection descriptors: field bindings, layout/component keys, preferred surfaces, action registry keys, dependency IDs, policy action IDs, and resolver preset IDs. Generic packet definitions currently provide summary-card and detail-panel projection descriptors for active packet types. The packet action service uses preferred projection surfaces for focus/open routing. Full UI layout generation from projection descriptors is not yet complete.
