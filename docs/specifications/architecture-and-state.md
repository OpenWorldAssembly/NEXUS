# Architecture And State

## Active source split

- `core/*` holds portable packet logic, schemas, builders, interpreters, contracts, and pure projections
- `runtime/*` holds storage adapters, runtime services, query services, auth/trust/discussion orchestration, and API-facing glue
- `app/*` holds application-layer components, hooks, constants, public content, and shared shell state
- `src/app/*` holds the Expo Router route shell and API entrypoints

## Current runtime and state patterns

- public pages are still mostly stateless
- Nexus state is shared through local React context providers
- shell and route projections load from packet-backed API routes
- the runtime store is SQLite-backed
- packet parsing runs through family compatibility and adaptation instead of route-local patches
- Packet Explorer session state is shell-level rather than route-level page state

## Packet and compatibility foundations in active use

Current packet behavior in code includes:

- `PacketEnvelope = { header, body }`
- stable `packet_id`
- immutable `revision_id`
- multi-parent `parent_revision_refs`
- family `schema_version`
- family `revision_mode`
- raw stored packets preserved as historical fact
- adapted runtime packets used as the normal read shape
- target-version-aware compatibility reads for supported families

Forward ontology currently active in code includes:

- `Cause`, `Action`, `Relation`, and `Location` as first-class packet families
- `Element.subtype` as the forward classifier, with `kind` preserved as compatibility metadata
- widened `Claim` packets for packet-targeted assertion content plus optional `relation_assertion`
- widened `Attestation` packets with canonical `type/subtype` semantics and legacy `attestation_kind` compatibility
- `Policy.relation_requirements` as the packet-backed seam for relation support rules

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
