# Packet Definition Manifest

## Status

Active design with canonical Definition/Bundle packet material and fortress-enrolled Preference writes. `Definition`, `Bundle`, and `Preference` are now first-class `PacketEnvelope` types. Active definition parts produce valid `Definition` packet envelopes, those envelopes are grouped into a seeded `Bundle.packet_set` profile, and `Preference.element` writes for claimed actors enter the signed prepare/finalize corridor while the legacy runtime table remains a compatibility cache.

Stored Definition and Bundle packets are portable semantic material, not executable plugins. The bootstrap kernel validates Definition/Bundle envelopes, verifies the active definition profile, and keeps executable builders, planners, resolvers, signing, policy checks, and persistence owned by trusted local runtime code.

## Intent

Nexus needs a single exported packet-definition surface so future packet schema changes do not require edits across builders, policy gates, mutation dispatch, projection code, and UI assumptions.

The forward-facing language is **packet type** and **packet subtype**. The live envelope uses `header.type`, and packet bodies use `body.subtype` for packet specialization.

## Manifest shape

The manifest is now modeled around a native bootstrap `Definition` packet type. The TypeScript manifest is the trusted local genesis profile, and its sections line up with Definition parts instead of treating Bundle as the semantic home for packet definitions.

Bundle remains a carrier/inventory packet. It may transport Definition parts, Preference packets, resources, and adapter metadata, but those items keep their own packet semantics.

Definition, Bundle, and Preference now have runtime-ready body builders. These builders parse `Definition`, `Bundle.packet_set`, and `Preference.element` bodies for canonical seed/profile verification. The definition seed helpers use those builders to produce full packet envelopes and a local definition bundle inventory, but imported or stored definitions still cannot introduce executable server behavior.

The current canonical surface lives at:

- `core/packets/packet-definition-manifest.ts`
- `core/packets/packet-definition-template.ts`
- `core/packets/packet-definition-helpers.ts`
- `core/packets/definitions/*`

## Packet manifest template

The definition manifest now has a shared definition template. The template is a contract for packet type definitions, not a live packet type and not a server plugin system.

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

Each packet definition can mark sections as supported, unsupported, or custom. Helpers read those sections generically so runtime and core code can ask the manifest for packet meaning without hardcoding every packet type.

## Actions and derived affordances

Actions are now the source of packet capabilities. The manifest no longer stores a separate `affordances` list because that would create a second truth surface.

If a packet definition declares a `create` action, then create is an affordance. If it declares a `bundle` action, then bundling is an affordance. Helpers may derive affordances from action kinds for UI/docs, but action descriptors are canonical.

## Descriptor registries

Each packet type definition may declare:

- actions: named create/revise/withdraw/adapt/bundle/project/index/import/export/verify actions, with optional policy action IDs
- builders: body or envelope builder descriptors, identified by schema keys rather than wired runtime functions
- planners: planner descriptors that select local supported planner engines rather than shipping executable packet code
- mutations: mutation intent descriptors that can be mapped to trusted local runtime engines
- workflow plans: optional ordered plans that compose known operation kinds, trusted resolvers, value bindings, simple conditions, policy action IDs, and dependency IDs
- compatibility adapters: current identity descriptors plus adjacent schema-version adapter edges for the packet type itself

Active Definition, Bundle, and Preference descriptors are canonical or runtime-ready. Generic type descriptors are part of the canonical definition profile; executable behavior remains mapped to trusted local runtime capabilities.

## Canonical packet types

### Definition

`Definition` is the bootstrap packet type for packet definitions. Version 0 is core-native so nodes can cold-start without fetching a definition packet before they know how to read definitions.

Current Definition subtypes are intentionally limited to packet-definition work we are actively using:

- `packet_definition`
- `packet_schema`
- `packet_action_registry`
- `packet_builder_descriptor`
- `packet_planner_descriptor`
- `packet_projection_descriptor`
- `packet_compatibility`
- `dependencies_definition`

The long-term model is graph-discoverable definition parts resolved into a pinned local definition profile. The current implementation builds a local seeded definition profile: every active manifest definition part is represented as a valid `Definition` packet envelope and grouped into one `Bundle.packet_set` inventory for reseed readiness. Runtime execution still resolves trusted local code rather than executing behavior supplied by those packets.

### Preference

`Preference.element` models the runtime shell preferences that currently control or are prepared to control:

- visible main scope packet IDs
- associated parent-chain display
- followed parent-chain display
- `interface.shell_chrome` defaults for navigation mode, theme mode, and UI density

Preference is now a canonical packet type and a signed-corridor exemplar. Claimed actor scope-display and shell-chrome preferences write `Preference.element` packets through `preference.element.set` and keep the legacy runtime preference table as a compatibility cache. Guest preferences remain cookie/session compatibility state. Claimed shell preference reads are bound to the authenticated session actor before private `Preference.element` state is projected; mismatched actor query params fall back to guest preference projection.

Preference packets are actor-owned configuration. They do not create relationships and should not make scopes eligible for the main graph. They only configure display of scopes already eligible through home, association, follow, or relation types.

### Bundle

Bundle packets are generic carrier inventories for packet sets, exports, sync payloads, and archives. Bundle is not the semantic home for packet definitions or compatibility.

Definition parts such as `definition.packet_compatibility` and `definition.dependencies_definition` may travel inside a Bundle inventory while retaining their own packet meaning.

## Helper model

Helpers are intentionally boring. They retrieve and validate descriptor sections. They do not execute arbitrary planner code and they do not let packet manifests smuggle server behavior into a node.

The current helper surface can derive identity, schema, storage, revision, actions, builders, planners, policy action IDs, projections, indexes, compatibility descriptors, bundle action IDs, and template compliance.

Runtime should pair these descriptors with a local allowlist of supported builder, planner, adapter, and projection engines.

Workflow-plan helpers follow the same rule. They can audit and dry-run descriptor shape, but runtime owns resolver execution, condition interpretation, operation planning, policy verification, proof handling, and persistence. Unknown workflow operation kinds, resolvers, dependencies, policy actions, condition operators, or step references fail closed.

Workflow alignment now records which external definition execution intents can be described through these workflow plans and which remain missing coverage items. Relation, Claim, Reaction, and Discussion have the first definition workflow descriptors tied to trusted local planner capabilities; the descriptors are narrower runtime recipes layered on top of the broader generic packet write descriptors.

Policy and dependency descriptors stay packet-native. A workflow dependency must be explainable through `Policy` packet semantics, a Definition `dependencies_definition` part, a manifest operation, a workflow resolver, or trusted local runtime code that points back to packet-defined meaning. Runtime registries validate and index these references; they are not a separate dependency ontology.

Free-floating dependency strings should fail audit unless they are explicitly recorded as runtime metadata backed by a trusted local capability. This preserves the long-term portability model: packets define meaning and requirements, while local runtimes decide whether they have trusted engines capable of interpreting and executing those requirements.

The current semantic authority helpers expose this contract directly: `listPacketPolicySemanticDescriptors`, `resolvePolicyPacketSemantics`, `auditPacketPolicySemanticAuthority`, `listPacketDependencySemanticDescriptors`, `resolvePacketDependencySemanticDescriptor`, and `auditPacketDependencySemanticAuthority`. These helpers are audit and interpretation surfaces only; they do not authorize, ticket, sign, persist, or execute packet-defined code.

Client ingress metadata must stay interface-neutral for the same reason. A web shell, Raspberry Pi panel, automation script, or future adapter should map into portable client intent IDs rather than embedding frontend-specific concepts into packet definitions or runtime planners.

## Portability model

The long-term portability model is:

- packet definitions describe current builders, planners, actions, and compatibility posture
- Definition packets describe schemas, defaults, actions, builders, planners, projections, compatibility, and dependencies
- `definition.packet_compatibility` parts describe safe upcast/downcast steps as adjacent version-ladder edges, including current identity, default-fill, conversion, and loss posture notes
- Bundle packets carry Definition parts and related packet inventories across nodes
- nodes can eventually update their local systems by importing Bundle inventories that include definition parts, adapter metadata, fixtures, and safety/loss notes

The manifest may eventually be carried inside a Bundle inventory, but the manifest itself is a Definition graph/profile concept, not a Bundle subtype.

## Next use

The current safe runtime step is to keep `Preference.element` as the first full template example. Claimed scope-display and shell-chrome writes enter the signed prepare/finalize corridor as `preference.element.set`, while the old direct `preference.element.interface.set` connector is retained only as a definition/internal comparison bridge. Partial `Preference.element.value.interface` patches keep the same projection shape. Empty interface patches are rejected before prepare so the corridor cannot create default preference packets from requests that carry no actual preference change.

## Preference.element canonical prototype

The first completed packet-type example is `Preference.element`. It now has helpers for:

- building a normalized Preference body from element inputs
- deriving a deterministic owner/subtype/context packet ID
- projecting the latest active preference for an owner and context
- converting between runtime shell preferences and Preference packet bodies
- upcasting the old one-toggle shape into current associated/followed parent-chain toggles
- downcasting with loss notes when current state cannot fit the older shape exactly

This is now live for claimed actor interface preferences through the fortress-enrolled preference workflow. Runtime reads prefer the latest active `Preference.element` packet and fall back to the legacy table when no packet exists. The table remains a compatibility cache for scope-display state so the alpha demo keeps its current behavior while the packet path proves itself.


## Definition action bridge

The manifest has an action bridge that resolves a packet definition plus a mutation intent into a runtime-readable action plan.

The bridge does not execute packet code from manifests. It only checks descriptors against locally supported generic capabilities:

- action kinds
- builder kinds
- planner kinds

For `Preference.element`, the bridge can resolve `preference.element.set` into:

- the declared mutation descriptor
- the latest-active revision planner descriptor
- the element body builder descriptor
- the `preference.element.write` policy action ID
- a readiness flag for descriptor/runtime planning

This is the first seam between the packet definition manifest and the fortress corridor. `Preference` is now inside the canonical packet ontology and claimed interface writes enter a fortress-enrolled mutation path, but the route still executes trusted local workflow code. Manifest descriptors describe the operation; imported definition packets do not execute server behavior.

The runtime comparison planner can build a manifest-backed `Preference.element` plan from the existing runtime preference payload. The plan includes the deterministic packet ID, normalized body, projected runtime preference shape, resolved action plan, storage class, revision behavior, and an explicit non-executable comparison marker.

That marker is intentional. It distinguishes descriptor/audit planning from the external definition execution-enrolled preference workflow and keeps imported definition behavior non-executable.

## Audit and seed readiness

The manifest layer includes an audit harness for canonical and staged packet definitions:

- packet definitions are checked for template-section compliance;
- descriptor IDs are checked for duplicates;
- builders, planners, mutations, and actions are checked for broken references;
- compatibility adapters and `definition.packet_compatibility` parts are checked against the current compatibility standard;
- every manifest definition must expose a current identity adapter and a required packet compatibility part;
- legacy-aware definitions may expose full adjacent adapter ladders instead of only nearest-current edges;
- workflow plans are checked against the operation ontology, trusted resolver/capability allowlists, declared policy action IDs, dependency IDs, and valid step references;
- mutation plans are checked against local supported generic builder/planner/action capabilities.

`Preference.element` also has a seed candidate helper. The seed helper converts current runtime element preferences into the canonical Preference body, projects that body back into the current runtime preference shape, and marks the candidate safe only when the projection is equivalent and the packet definition audit has no errors.

Active packet definitions now have the same packetization treatment at profile scale. `buildDefinitionPacketSeedEnvelopes()` emits valid `Definition` packet envelopes for every active manifest definition part, `buildDefinitionBundleSeedEnvelope()` groups those refs into one `Bundle.packet_set` inventory, and `auditSeededPacketDefinitionProfile()` fails closed on missing parts, unexpected parts, duplicate bundle refs, digest drift, or stale profile metadata.

The definition comparison helpers still exist for audit and descriptor comparison, but the claimed-actor interface preference path now persists a live `Preference.element` packet through the signed corridor in parallel with the runtime compatibility cache.

## Descriptor Fortress Bridge

The manifest work still has a runtime descriptor bridge at `runtime/nexus/server/manifest-fortress-bridge.ts`.

The bridge translates packet-definition descriptors into fortress-shaped prepare metadata without entering the trusted mutation corridor. It resolves:

- packet type and subtype support;
- mutation descriptor support;
- local planner and builder capability support;
- manifest-derived action IDs;
- manifest-derived policy action IDs;
- deterministic packet candidate identity and digest metadata for `Preference.element`.

This bridge returns `external_definition_execution_enabled: false` because imported manifest descriptors describe semantics but do not execute server behavior. `Preference`, `Definition`, and `Bundle` are now enrolled in the `PacketEnvelope` ontology, but the bridge remains a controlled runtime helper rather than arbitrary packet-defined server behavior.

For `Preference.element`, the bridge can produce a prepare-shaped candidate from current runtime element preferences, project that candidate back into runtime preference shape, and report which generic builder/planner/policy descriptors are used by the trusted local preference workflow.

The live route and writer audits remain the boundary: manifest-defined actions should enter the live mutation intent registry only when the generic policy and planner seams are intentionally promoted. `Preference.element.set` is now promoted through the fortress service path. It resolves manifest descriptors but still executes trusted runtime code rather than imported definition behavior.
