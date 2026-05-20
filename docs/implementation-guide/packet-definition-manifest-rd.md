# Packet Definition Manifest R&D

## Status

Experimental design with seeded Definition/Bundle packet material and one fortress-enrolled Preference exemplar. Most manifest execution remains trusted-local rather than imported-definition-driven, but active definition parts now have auditable `Definition` packet candidates, a `Bundle.packet_set` inventory, and `Preference.element` is enrolled as a canonical packet family for claimed actor interface preference writes while the legacy runtime table remains a compatibility cache.

For this chapter, `Preference` is the only manifest-defined packet type enrolled in the live `PacketEnvelope` ontology. `Definition` and `Bundle` remain experimental manifest-native packet types: they define the portable definition and carrier shape without being added to legacy `PACKET_FAMILIES`.

## Intent

Nexus needs a single exported packet-definition surface so future packet schema changes do not require edits across builders, policy gates, mutation dispatch, projection code, and UI assumptions.

The forward-facing language is **packet type** and **packet subtype**. Current code still uses `family` in the live envelope for compatibility, but new manifest work should use packet type terminology so the eventual rename has a clear destination.

## Manifest shape

The manifest is now modeled around a native bootstrap `Definition` packet type. The TypeScript manifest remains shadow code, but its sections line up with Definition parts instead of treating Bundle as the semantic home for packet definitions.

Bundle remains a carrier/inventory packet. It may transport Definition parts, Preference packets, resources, and adapter metadata, but those items keep their own packet semantics.

Manifest-native packet types now have shadow body-candidate builders. These builders parse `Definition`, `Bundle.packet_set`, and `Preference.element` bodies for audit and future runtime planning. The definition seed helpers use those builders to produce packet-shaped seed candidates and a local definition bundle inventory, but imported or stored definitions still cannot introduce executable server behavior.

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
- workflow plans: optional ordered shadow plans that compose known operation kinds, trusted resolvers, value bindings, simple conditions, policy action IDs, and dependency IDs
- compatibility adapters: current identity descriptors plus adjacent schema-version adapter edges for the packet type itself

The current descriptors are deliberately marked `shadow_only`. They document the target runtime shape without changing the alpha write path.

## Prototype packet types

### Definition

`Definition` is the bootstrap packet type for packet definitions. Version 0 is core-native so nodes can cold-start without fetching a definition packet before they know how to read definitions.

Current experimental Definition subtypes are intentionally limited to packet-definition work we are actively using:

- `packet_definition`
- `packet_schema`
- `packet_action_registry`
- `packet_builder_descriptor`
- `packet_planner_descriptor`
- `packet_projection_descriptor`
- `packet_compatibility`
- `packet_dependency`

The long-term model is graph-discoverable definition parts resolved into a pinned local definition profile. The current implementation now also builds a local seeded definition profile: every active manifest definition part can be represented as a valid `Definition` packet candidate and grouped into one `Bundle.packet_set` inventory for reseed readiness. Runtime execution still resolves trusted local code rather than executing behavior supplied by those packets.

### Preference

`Preference.element` models the runtime shell preferences that currently control or are prepared to control:

- visible main scope packet IDs
- associated parent-chain display
- followed parent-chain display
- `interface.shell_chrome` defaults for navigation mode, theme mode, and UI density

Preference is now enrolled as a canonical packet family for the first live R&D bridge. Claimed actor scope-display preferences write `Preference.element` packets and keep the legacy runtime preference table as a compatibility cache. Guest preferences remain cookie/session compatibility state. Claimed shell preference reads are now bound to the authenticated session actor before private `Preference.element` state is projected; mismatched actor query params fall back to guest preference projection.

Preference packets are actor-owned configuration. They do not create relationships and should not make scopes eligible for the main graph. They only configure display of scopes already eligible through home, association, follow, or later relation types.

### Bundle

Bundle packets are generic carrier inventories for packet sets, exports, sync payloads, and archives. Bundle is not the semantic home for packet definitions or compatibility.

Definition parts such as `definition.packet_compatibility` and `definition.packet_dependency` may travel inside a Bundle inventory while retaining their own packet meaning.

## Helper model

Helpers are intentionally boring. They retrieve and validate descriptor sections. They do not execute arbitrary planner code and they do not let packet manifests smuggle server behavior into a node.

The current helper surface can derive identity, schema, storage, revision, actions, builders, planners, policy action IDs, projections, indexes, compatibility descriptors, bundle action IDs, and template compliance.

Runtime should eventually pair these descriptors with a local allowlist of supported builder, planner, adapter, and projection engines.

Workflow-plan helpers follow the same rule. They can audit and dry-run descriptor shape, but runtime owns resolver execution, condition interpretation, operation planning, policy verification, proof handling, and persistence. Unknown workflow operation kinds, resolvers, dependencies, policy actions, condition operators, or step references fail closed.

Workflow alignment now records which live fortress intents can be described through these workflow plans and which remain planned gaps. Relation, Claim, Attestation, and Discussion have the first shadow workflow descriptors tied to trusted local planner capabilities; the descriptors are narrower runtime recipes layered on top of the broader generic packet write descriptors.

Policy and dependency descriptors stay packet-native. A workflow dependency must be explainable through `Policy` packet semantics, a Definition `packet_dependency` part, a manifest operation, a workflow resolver, or trusted local runtime code that points back to packet-defined meaning. Runtime registries validate and index these references; they are not a separate dependency ontology.

Free-floating dependency strings should fail audit unless they are explicitly recorded as runtime metadata backed by a trusted local capability. This preserves the long-term portability model: packets define meaning and requirements, while local runtimes decide whether they have trusted engines capable of interpreting and executing those requirements.

The current semantic authority helpers expose this contract directly: `listPacketPolicySemanticDescriptors`, `resolvePolicyPacketSemantics`, `auditPacketPolicySemanticAuthority`, `listPacketDependencySemanticDescriptors`, `resolvePacketDependencySemanticDescriptor`, and `auditPacketDependencySemanticAuthority`. These helpers are audit and interpretation surfaces only; they do not authorize, ticket, sign, persist, or execute packet-defined code.

Client ingress metadata must stay interface-neutral for the same reason. A web shell, Raspberry Pi panel, automation script, or future adapter should map into portable client intent IDs rather than embedding frontend-specific concepts into packet definitions or runtime planners.

## Portability model

The long-term portability model is:

- packet definitions describe current builders, planners, actions, and compatibility posture
- Definition packets describe schemas, actions, builders, planners, projections, compatibility, and dependencies
- `definition.packet_compatibility` parts describe safe upcast/downcast steps as adjacent version-ladder edges, including current identity, default-fill, conversion, and loss posture notes
- Bundle packets carry Definition parts and related packet inventories across nodes
- nodes can eventually update their local systems by importing Bundle inventories that include definition parts, adapter metadata, fixtures, and safety/loss notes

The manifest may eventually be carried inside a Bundle inventory, but the manifest itself is a Definition graph/profile concept, not a Bundle subtype.

## Next use

The current safe runtime step is to use `Preference.element` as the first full template example. Claimed scope-display and shell-chrome writes now enter the signed prepare/finalize corridor as `preference.element.set`, while the old direct `preference.element.interface.set` connector is retained as a shadow/internal comparison bridge. Partial `Preference.element.value.interface` patches keep the same projection shape. Empty interface patches are rejected before prepare so the corridor cannot create default preference packets from requests that carry no actual preference change.

## Preference.element shadow prototype

The first completed packet-type example is `Preference.element`. It now has shadow helpers for:

- building a normalized Preference body from element inputs
- deriving a deterministic owner/subtype/context packet ID
- projecting the latest active preference for an owner and context
- converting between runtime shell preferences and Preference packet bodies
- upcasting the old one-toggle shape into current associated/followed parent-chain toggles
- downcasting with loss notes when current state cannot fit the older shape exactly

This is now live for claimed actor interface preferences through the fortress-enrolled preference workflow. Runtime reads prefer the latest active `Preference.element` packet and fall back to the legacy table when no packet exists. The table remains a compatibility cache for scope-display state so the alpha demo keeps its current behavior while the packet path proves itself.


## Shadow action bridge

The manifest now has a shadow action bridge that resolves a packet definition plus a future mutation intent into a runtime-readable action plan.

The bridge does not execute packet code from manifests. It only checks descriptors against locally supported generic capabilities:

- action kinds
- builder kinds
- planner kinds

For `Preference.element`, the shadow bridge can resolve `preference.element.set` into:

- the declared mutation descriptor
- the latest-active revision planner descriptor
- the element body builder descriptor
- the `preference.element.write` policy action ID
- a readiness flag for shadow runtime planning

This is the first seam between the packet definition manifest and the fortress corridor. `Preference` is now inside the canonical packet ontology and claimed interface writes enter a fortress-enrolled mutation path, but the route still executes trusted local workflow code. Manifest descriptors describe the operation; imported definition packets do not execute server behavior.

The runtime shadow planner can now build a manifest-backed `Preference.element` plan from the existing runtime preference payload. The plan includes the deterministic packet ID, normalized body, projected runtime preference shape, resolved action plan, storage class, revision behavior, and explicit shadow-only marker.

That marker is intentional. It distinguishes descriptor/audit planning from the live fortress-enrolled preference workflow and keeps imported definition behavior non-executable.

## Shadow audit and seed readiness

The manifest layer now includes a shadow audit harness before any live fortress integration:

- packet definitions are checked for template-section compliance;
- descriptor IDs are checked for duplicates;
- builders, planners, mutations, and actions are checked for broken references;
- compatibility adapters and `definition.packet_compatibility` parts are checked against the current compatibility standard;
- every manifest definition must expose a current identity adapter and a required packet compatibility part;
- legacy-aware definitions may expose full adjacent adapter ladders instead of only nearest-current edges;
- workflow plans are checked against the operation ontology, trusted resolver/capability allowlists, declared policy action IDs, dependency IDs, and valid step references;
- mutation plans are checked against local supported generic builder/planner/action capabilities.

`Preference.element` also has a shadow seed candidate helper. The seed helper converts current runtime element preferences into the experimental Preference body, projects that body back into the current runtime preference shape, and marks the candidate safe only when the projection is equivalent and the packet definition audit has no errors.

Active packet definitions now have the same packetization treatment at profile scale. `buildDefinitionPacketSeedCandidates()` emits one valid `Definition` packet candidate for every active manifest definition part, `buildDefinitionBundlePacketSetCandidate()` groups those refs into one `Bundle.packet_set` inventory, and `auditSeededPacketDefinitionProfile()` fails closed on missing parts, unexpected parts, duplicate bundle refs, digest drift, or stale profile metadata.

The shadow helpers still exist for audit and descriptor comparison, but the claimed-actor interface preference path now persists a live `Preference.element` packet in parallel with the runtime compatibility cache.

## Shadow fortress bridge

The manifest work now has a runtime shadow bridge at `runtime/nexus/server/manifest-shadow-fortress-bridge.ts`.

The bridge translates packet-definition descriptors into fortress-shaped prepare metadata without entering the live mutation corridor. It resolves:

- packet type and subtype support;
- mutation descriptor support;
- local planner and builder capability support;
- manifest-derived action IDs;
- manifest-derived policy action IDs;
- deterministic shadow packet candidate identity and digest metadata for `Preference.element`.

This bridge still returns `live_fortress_ready: false` because manifest descriptors do not yet execute the live mutation corridor. `Preference` is now enrolled in the `PacketEnvelope` ontology, but the bridge remains a controlled runtime helper rather than arbitrary packet-defined server behavior.

For `Preference.element`, the shadow bridge can produce a prepare-shaped candidate from current runtime element preferences, project that candidate back into runtime preference shape, and report which generic builder/planner/policy descriptors are used by the trusted local preference workflow.

The live route and writer audits remain the boundary: manifest-defined actions should enter the live mutation intent registry only when the generic policy and planner seams are intentionally promoted. `Preference.element.set` is now promoted through the fortress service path. It resolves manifest descriptors but still executes trusted runtime code rather than imported definition behavior.
