# Packet Definition Manifest R&D

## Status

Experimental shadow-mode design. This does not replace live packet families, builders, runtime writes, or the alpha demo storage model yet.

## Intent

Nexus needs a single exported packet-definition surface so future packet schema changes do not require edits across builders, policy gates, mutation dispatch, projection code, and UI assumptions.

The forward-facing language is **packet type** and **packet subtype**. Current code still uses `family` in the live envelope for compatibility, but new manifest work should use packet type terminology so the eventual rename has a clear destination.

## Manifest shape

The manifest is bundle-shaped: it lists items, schema versions, dependencies, compatibility notes, action kinds, and definition status. It is not yet emitted as a live Bundle packet.

The current experimental surface lives at:

- `core/packets/packet-definition-manifest.ts`
- `core/packets/packet-definition-template.ts`
- `core/packets/packet-definition-helpers.ts`
- `core/packets/definitions/*`

## Packet manifest template

The shadow manifest now has a shared definition template. The template is a contract for packet type definitions, not a live packet type and not a server plugin system.

Template sections are:

- identity
- schema
- storage
- revision
- actions
- builders
- planners
- policy
- projection
- indexing
- compatibility
- bundling
- fixtures
- notes

Each packet definition can mark sections as supported, unsupported, deferred, or custom. Helpers read those sections generically so runtime and core code can ask the manifest for packet meaning without hardcoding every packet type.

## Actions and derived affordances

Actions are now the source of packet capabilities. The manifest no longer stores a separate `affordances` list because that would create a second truth surface.

If a packet definition declares a `create` action, then create is an affordance. If it declares a `bundle` action, then bundling is an affordance. Helpers may derive affordances from action kinds for UI/docs, but action descriptors are canonical.

## Descriptor registries

Each packet type definition may declare:

- actions: named create/revise/withdraw/adapt/bundle/project/index/import/export/verify actions, with optional policy action IDs
- builders: body or envelope builder descriptors, identified by schema keys rather than wired runtime functions
- planners: planner descriptors that select local supported planner engines rather than shipping executable packet code
- mutations: future mutation intent descriptors that can later be enrolled into the mutation intent registry
- compatibility adapters: nearest-current adapter descriptors for the packet type itself

The current descriptors are deliberately marked `shadow_only`. They document the target runtime shape without changing the alpha write path.

## Prototype packet types

### Preference

`Preference.scope_display` models the runtime shell preferences that currently control:

- visible main scope packet IDs
- associated parent-chain display
- followed parent-chain display

The runtime preference store remains canonical for the alpha. Preference packets are a shadow-mode schema target.

Preference packets are actor-owned configuration. They do not create relationships and should not make scopes eligible for the main graph. They only configure display of scopes already eligible through home, association, follow, or later relation types.

### Compatibility

Compatibility packets should carry nearest-current adapter information. The preferred model is not for every packet to carry a full historical chain. Instead:

- individual Compatibility packets describe adapter steps to and from current or adjacent supported versions
- Compatibility bundles carry full daisy chains when a node needs to update or force a packet into an earlier shape
- downcasts must remain loss-aware and may require acknowledgement when fields are omitted, coerced, or safely defaulted

### Bundle

Bundle packets are the intended transport vessel for packet sets, schema manifests, and compatibility chains.

The packet definition manifest is intentionally bundle-shaped so it can later become bundle-compatible without turning the current R&D file into a live packet write path.

## Helper model

Helpers are intentionally boring. They retrieve and validate descriptor sections. They do not execute arbitrary planner code and they do not let packet manifests smuggle server behavior into a node.

The current helper surface can derive identity, schema, storage, revision, actions, builders, planners, policy action IDs, projections, indexes, compatibility descriptors, bundle action IDs, and template compliance.

Runtime should eventually pair these descriptors with a local allowlist of supported builder, planner, adapter, and projection engines.

## Portability model

The long-term portability model is:

- packet definitions describe nearest-current builders, planners, actions, and adapter posture
- Compatibility packets describe safe upcast/downcast steps near the current schema version
- Bundle packets carry schema manifests and full compatibility-chain transport metadata across nodes
- nodes can update their local systems by importing Bundle packets that include schema definitions, compatibility packets, adapter-chain metadata, fixtures, and safety/loss notes

The manifest should eventually be exportable as a `Bundle.schema_manifest` packet, but the current file remains a shadow code manifest only.

## Next use

The next safe runtime step is to complete `Preference.scope_display` as the first full template example, then build shadow conversion helpers between current runtime preferences and Preference packet bodies before any live-canonical flip.

## Preference.scope_display shadow prototype

The first completed packet-type example is `Preference.scope_display`. It now has shadow helpers for:

- building a normalized Preference body from scope-display inputs
- deriving a deterministic owner/subtype/context packet ID
- projecting the latest active preference for an owner and context
- converting between runtime shell preferences and Preference packet bodies
- upcasting the old one-toggle shape into current associated/followed parent-chain toggles
- downcasting with loss notes when current state cannot fit the older shape exactly

This remains non-canonical for the alpha demo. The runtime scope-display preference store still owns live reads and writes; Preference packets are only a shadow target for proving the manifest, builder, projection, and compatibility design.


## Shadow action bridge

The manifest now has a shadow action bridge that resolves a packet definition plus a future mutation intent into a runtime-readable action plan.

The bridge does not execute packet code from manifests. It only checks descriptors against locally supported generic capabilities:

- action kinds
- builder kinds
- planner kinds

For `Preference.scope_display`, the shadow bridge can resolve `preference.scope_display.set` into:

- the declared mutation descriptor
- the latest-active revision planner descriptor
- the scope-display body builder descriptor
- the `preference.scope_display.write` policy action ID
- a readiness flag for shadow runtime planning

This is the first seam between the packet definition manifest and the fortress corridor. It is not wired into live prepare/finalize routes yet, and it does not create live `PacketEnvelope` records because `Preference` is still outside the canonical packet ontology.

The runtime shadow planner can now build a manifest-backed `Preference.scope_display` plan from the existing runtime preference payload. The plan includes the deterministic packet ID, normalized body, projected runtime preference shape, resolved action plan, storage class, revision behavior, and explicit `live_fortress_ready: false` marker.

That marker is intentional. It keeps the alpha demo safe while proving that manifest-defined actions, builders, planners, policy action IDs, and ID strategy can line up before the live fortress accepts the new packet type.

## Shadow audit and seed readiness

The manifest layer now includes a shadow audit harness before any live fortress integration:

- packet definitions are checked for template-section compliance;
- descriptor IDs are checked for duplicates;
- builders, planners, mutations, and actions are checked for broken references;
- compatibility adapters are checked against the nearest-current design posture;
- mutation plans are checked against local supported generic builder/planner/action capabilities.

`Preference.scope_display` also has a shadow seed candidate helper. The seed helper converts current runtime scope-display preferences into the experimental Preference body, projects that body back into the current runtime preference shape, and marks the candidate safe only when the projection is equivalent and the packet definition audit has no errors.

These helpers still do not persist packets or change the live runtime preference source of truth. They exist to let us run the bridge in parallel, compare behavior, and catch descriptor drift before enabling live writes.

## Shadow fortress bridge

The manifest work now has a runtime shadow bridge at `runtime/nexus/server/manifest-shadow-fortress-bridge.ts`.

The bridge translates packet-definition descriptors into fortress-shaped prepare metadata without entering the live mutation corridor. It resolves:

- packet type and subtype support;
- mutation descriptor support;
- local planner and builder capability support;
- manifest-derived action IDs;
- manifest-derived policy action IDs;
- deterministic shadow packet candidate identity and digest metadata for `Preference.scope_display`.

This bridge deliberately returns `live_fortress_ready: false`. `Preference` is not yet enrolled in the live `PacketEnvelope` ontology, the live mutation intent registry, or the write-policy action union. The bridge exists to prove that the manifest can feed the shape of fortress preparation while runtime preferences remain canonical.

For `Preference.scope_display`, the shadow bridge can produce a prepare-shaped candidate from current runtime scope-display preferences, project that candidate back into runtime preference shape, and report which generic builder/planner/policy descriptors would be used once live enrollment is safe.

The live route and writer audits remain the boundary: manifest shadow actions must not appear in the live mutation intent registry until the packet type is intentionally promoted from shadow R&D to runtime-ready behavior.
