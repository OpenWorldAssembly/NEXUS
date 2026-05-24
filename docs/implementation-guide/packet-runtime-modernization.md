# Packet Runtime Modernization

## Status

Pre-reseed modernization chapter status. The early sections preserve the chapter history; the current state has seeded Definition/Bundle packet material, closed in-scope runtime genericization, packet-based policy/dependency semantics, retired legacy bridge write intents, and fortress-enrolled `Preference.element` writes.

## Summary

This chapter brings the packet system, generic fortress, runtime connectors, and mutation orchestration up to the Preference-as-template direction. `Definition`, `Bundle`, and `Preference` are now canonical packet types; Preference remains the working runtime example with a fortress-enrolled write path and runtime connector coverage for comparison. The broader goal is to keep every live packet type visible through the same coverage map while moving mutations into standardized trusted-local runtime paths.

The work should preserve current behavior while replacing hidden assumptions with typed registries, explicit missing coverage items, and tests that fail when the modernization map drifts.

## Modernization Targets

- packet types should have body schemas, compatibility entries, builder support, manifest definitions, definition parts, and runtime connector status recorded in one audit surface
- runtime mutations should map to prepare handlers, finalize handlers, policy action IDs, signed corridor use, and master-handler connector enrollment status
- Definition, Bundle, and Preference are canonical packet types with body schemas, compatibility entries, builder support, definition parts, and seed/profile coverage
- imported Definition and Bundle packets describe semantics but never introduce executable server behavior
- the generic fortress and master handler should become the standard runtime orchestration path after coverage is complete

## Phase Plan

1. Save the broad plan and add coverage audits.
2. Use the audit output to prioritize packet-type definition work.
3. Expand manifest definitions and definition parts type by type, preserving existing schemas and compatibility behavior unless a type-specific schema evolution is explicitly approved.
4. Adapt runtime mutation paths into runtime connectors behind the master handler, keeping signed corridor behavior intact until each mutation has a tested replacement boundary.
5. Enroll completed types and connectors only when their docs, tests, policies, and runtime behavior are all aligned.
6. Retire planned-gap records only when the implementation and tests prove the gap is actually closed.

## First Pass

The first pass is intentionally non-behavioral:

- add this chapter document
- link it from the implementation-guide index
- add packet type modernization coverage audits
- add runtime mutation modernization coverage audits
- add tests proving current types, mutation intents, Preference connector enrollment, and Definition/Bundle next-phase targets are all visible
- keep known modernization gaps green only through explicit planned-gap records

## Guardrails

- historical baseline: Definition and Bundle were initially kept out of `PACKET_TYPES`; the current promotion pass enrolls them as canonical packet types
- do not change `MutationIntent`, route payloads, packet schemas, or compatibility registry behavior during the audit pass
- do not migrate legacy scope-display caches until a dedicated compatibility pass
- the initial audit baseline kept `Preference.element` out of signed fortress enrollment; the current corridor now enrolls `preference.element.set` through prepare/finalize
- do not rebuild generated public docs artifacts as part of this first pass

## Test Plan

- run packet modernization coverage tests
- run runtime mutation modernization coverage tests
- keep packet-definition manifest and audit tests green
- keep fortress route and service-writer audit tests green
- validate docs with `npm run docs:validate`

## Decision Notes

The audit modules are the working checklist for the next implementation passes. Broken current invariants should fail tests. Expected gaps should remain visible as planned modernization work until they are closed by a later pass.

## Manifest Core Pass

The first chunky implementation pass expanded the packet manifest from the Preference template to the active packet types with generic builder-pipeline support: Element, Location, Role, Claim, Relation, Report, Proposal, Vote, Attestation, Decision, Action, Discussion, and Policy.

This pass remains runtime-ready. The new definitions describe existing body schemas, compatibility registry posture, generic builder support, action descriptors, planner descriptors, projection/index descriptors, and Definition parts. They do not change route payloads, packet schemas, runtime mutation behavior, or master-handler connector enrollment.

Builder-missing types remain explicit missing coverage items in the modernization audit. Preference later received canonical builder support and signed-corridor write enrollment.

## Packet-Type Authority Pass

The next implementation pass shifted the forward-looking checklist from legacy type enrollment toward manifest `packet_type` authority. The later promotion pass enrolled `Definition` and `Bundle` as canonical packet types while preserving packet_type language as the forward-facing semantic layer.

The pass added body builders for Definition, Bundle, and Preference. Those builders now feed canonical seed-profile helpers that create real Definition packet envelopes and a Bundle packet inventory for reseed material.

Packet-type modernization coverage is now the forward-looking audit surface for manifest definitions. The legacy type coverage remains as a migration bridge for live packet types and should keep missing coverage items visible until those types are converted into packet-type definitions and runtime connectors.

## Compatibility Definition Standard Pass

The compatibility standardization pass makes compatibility a required, auditable definition contract. Every manifest packet type now needs a required `packet_compatibility` Definition part and a current-version identity adapter descriptor.

Generic type definitions derive definition compatibility descriptors from the canonical compatibility registry. Current-only types expose identity compatibility, while legacy-aware types expose adjacent upcast/downcast ladder edges where the registry has adapter functions. Multi-step ladders use the `full_chain_bundle` strategy so future bundles can carry discoverable adapter metadata without pretending every adapter must touch the current schema directly.

The manifest audit now fails when compatibility posture and descriptors disagree, when downcast edges lack loss awareness, when duplicate adapter edges exist, or when a claimed full-chain graph is disconnected from the current version. This keeps reseed and import/export planning honest before runtime handler extraction or generic fortress promotion begins.

## Fortress Handler Extraction Pass

The signed fortress corridor remains the live authority for prepare, proof, finalize, and persistence decisions. The packet-runtime master handler remains the client/API-to-runtime connector bridge; it does not own signed fortress internals yet.

The extraction pass introduces domain-composed fortress handler maps for locality, discussion, attestation, assembly, relation, role, and actor policy. `MutationPrepareHandlers` and `MutationFinalizeHandlers` remain compatibility facades for the current implementation, while the composed maps give the runtime a clearer stepping-stone toward generic packet planners.

Each live mutation intent now has a genericization classification:

- `generic_ready` means the intent is close to manifest/action/planner routing once its local read dependencies are isolated.
- `planner_extraction_needed` means reusable packet planning must be extracted before generic routing.
- `workflow_specific` means runtime orchestration still coordinates multiple packet operations or projections.
- `legacy_bridge` means the intent is a compatibility alias that should collapse into a canonical intent.

This pass intentionally preserves behavior. It records which fortress code should be retired, which should become reusable planners, and which orchestration remains runtime-owned before any live generic fortress promotion.

## Packet Operation Ontology Pass

The operation ontology pass adds the missing contract between packet definitions and trusted runtime execution. Packet definitions may now describe allowed mutation semantics by mapping their manifest mutation descriptors to known operation kinds such as `single_packet.create`, `single_packet.revise`, `relation.set`, `claim.assert`, `attestation.set`, `bundle.import`, `projection.refresh`, `compatibility.adapt`, and `workflow.compose`.

This ontology is an allowlist, not executable packet-defined code. Each operation records its expected planner kind, builder kind, result type, trusted local runtime engine, generic capability posture, and safety notes. Packet definitions can request known operation semantics, but only local trusted engines may execute builders, planners, adapters, workflows, or persistence.

The manifest audit now fails closed when a mutation descriptor cannot map to a known operation kind. The forward-looking packet operation modernization coverage lists every manifest mutation, the operation kinds it resolves to, the trusted local engine requested, and whether the gap is already mapped or still planned.

The signed fortress genericization audit also records operation mappings for every live mutation intent:

- `generic_ready` intents map directly to concrete operation kinds, but still wait for the later live promotion pass.
- `planner_extraction_needed` intents map to their target operation kind and keep an explicit planner extraction gap.
- `workflow_specific` intents map to `workflow.compose` or a composed operation set and remain runtime-owned until their component operations can be split safely.
- `legacy_bridge` intents point at the canonical operation direction they should collapse into.

This keeps the moat/drawbridge boundary intact. The runtime master handler can normalize client/API ingress requests and eventually choose operation descriptors, while the fortress still owns trusted prepare/finalize/proof/persistence until a later pass promotes selected operation kinds through the generic path.

## Generic Workflow Planner Contract Pass

The workflow planner contract pass adds the declarative layer above individual operation kinds. Packet definitions may now describe definition workflow plans as ordered steps over known generic operations, trusted resolver IDs, value bindings, simple conditions, policy action IDs, and runtime dependency IDs.

Workflow plans are data, not code. Definitions can say "resolve actor and target, then run `relation.set`" or "if the input value is present run `attestation.set`, otherwise run `attestation.clear`." They cannot introduce arbitrary functions, dynamic imports, persistence behavior, route payloads, or proof rules. The runtime interpreter validates every operation, resolver, dependency, condition operator, policy action, and step reference against local allowlists before producing a dry-run plan.

The first definition workflow plans cover the generic-ready fortress candidates:

- `relation.follow.add`
- `relation.follow.clear`
- `role_association.claim.set`
- `attestation.packet_signal.set`

These plans do not enroll live execution. They prove the manifest can describe packet-specific variables and ordered generic work while preserving the signed fortress as the only live prepare/finalize/proof/persistence authority.

Policy and dependency descriptors now matter as referenced workflow metadata, but their full semantics remain a dedicated pre-reseed pass. Unused legacy packet types remain explicit missing coverage items and do not block the generic workflow contract or switch-over planning.

## Workflow Alignment Pass

The workflow alignment pass connects the manifest workflow contract to the extracted fortress planner map. It adds a runtime-side audit that lists every live mutation intent, its genericization status, operation mapping, workflow-plan coverage, policy action IDs, trusted resolver/capability IDs, and remaining packet-specific assumptions.

The alignment map is the working checklist for retiring packet-specific fortress code. Generic-ready intents must have clean workflow dry-runs and trusted local capability coverage. Planner-extraction intents may either have a definition workflow plan or an explicit missing coverage item. Workflow-specific intents remain runtime-owned orchestration until their component operations can be split safely. Legacy bridge intents point at canonical workflow directions rather than receiving independent workflows.

This pass expands definition workflow coverage for knowable planner-extraction candidates:

- `relation.association.add`
- `relation.association.clear`
- `relation.residence.add`
- `discussion.reply.create`

The alignment remains runtime-ready. Existing runtime planner modules are registered as trusted local capabilities by descriptor, but their implementation is not moved, rewritten, or invoked through generic execution yet. Unused removed packet types remain visible missing coverage items and do not block switch-over planning.

## Runtime Crossing Guard and Fortress Handoff Pass

The crossing guard and fortress corridor remain separate layers. The runtime crossing guard owns client/API ingress normalization, manifest/workflow lookup, connector selection, definition handoff metadata, and response/refresh hints. The fortress corridor owns policy/proof authority, prepare/finalize lifecycle, mutation tickets, signed packet validation, persistence, and canonical mutation effects.

The handoff pass adds a definition `PacketRuntimeFortressHandoff` contract. A handoff records the normalized mutation direction, workflow alignment status, operation kinds, workflow plan IDs, trusted capability IDs, policy action IDs, dependency IDs, resolver IDs, fortress prepare/finalize handler names, and return refresh hints. It carries `external_definition_execution_enabled: false` to record that imported definitions describe behavior while trusted local runtime code executes it.

Generic-ready and workflow-aligned planner-extraction intents can now produce `definition_ready` handoffs. Runtime-owned workflow intents produce explicit non-ready handoffs with orchestration reason codes. Legacy bridge intents point at canonical handoff directions. Unknown mutation intents fail closed before any fortress handoff.

At the time of this pass, this did not change the live mutation routes. The current state is stricter: `NexusMutationService` remains the live signed fortress authority, and authenticated `Preference.element` writes now enter that fortress service path rather than the old direct packet-runtime connector.

## Packet-Based Policy, Dependency, and Client Ingress Enrollment Pass

Policy and dependency requirements are now audited as packet-backed semantics rather than a second runtime-only dependency system. Workflow plans can reference policy action IDs and dependency IDs, but those references must resolve to packet policy semantics, packet Definition dependency parts, operation ontology entries, trusted workflow resolvers, or trusted local capability metadata. Runtime descriptors may index and validate those references, but they do not define packet meaning.

`Policy` packets remain the semantic authority for live write-lock policy. `MutationPolicyGate` remains the live resolver for scope policy refs, actor security mode, proof level, and accepted proof methods. Definition workflow policy descriptors record how policy action IDs map back to that packet-based enforcement model, while manifest-only actions remain definition metadata until a later live write-policy enrollment pass.

The runtime crossing guard now has a client/API ingress enrollment registry. The registry is an internal allowlist of adapter-originated transport routes and portable client intent IDs:

- `/api/nexus/mutations/prepare` enrolls the current signed fortress mutation intents.
- `/api/nexus/mutations/prepare` enrolls the `Preference.element` client intent; authenticated shell preference writes now use the same prepare/finalize corridor as other claimed mutations, while `/api/nexus/shell-preferences` remains guest compatibility state only.
- each enrollment records route or transport source, client intent ID, mutation intent, operation kinds, workflow plans, policy actions, dependency refs, and current live mode.

Unknown or custom route/intent pairings fail crossing-guard preflight. The preflight may resolve handoff metadata and packet-backed policy/dependency descriptors, but it does not authorize, ticket, sign, persist, finalize, or bypass the signed fortress. This keeps the future generic corridor aligned with enrolled client/API ingress from web, device, automation, or other adapters instead of accepting arbitrary injected operation requests.

## Interface-Neutral API Crossing Guard Pass

The enrollment layer is interface-neutral. Web shell, Raspberry Pi controls, local automation, and future adapters should all map their local events into the same portable client intent IDs, such as `scope.follow.set`, `scope.association.clear`, `discussion.reply.create`, and `preference.interface.set`. Runtime registries should not encode web UI concepts as packet meaning.

The live API routes now consult crossing-guard preflight before delegating to the live corridor:

- prepare parses the request intent, validates client/API ingress enrollment, then delegates to `NexusMutationService`;
- finalize reads the stored ticket, validates the ticket's original mutation intent against enrolled prepare ingress, then delegates to `NexusMutationService`;
- authenticated shell preferences use the standard prepare/finalize mutation routes with `preference.element.set`;
- `/api/nexus/shell-preferences` remains a guest compatibility route and is outside packet-runtime connector enrollment.

This pass is still not generic execution. Preflight validates allowlist and metadata alignment only; fortress policy/proof/ticketing/persistence remains authoritative.

## No-Deferral Pre-Reseed Closure Program

Reseed design is now gated on full closure of in-scope live runtime modernization work. The chapter can still be split across multiple implementation passes, but the remaining live runtime work is no longer tracked as open-ended missing coverage items. The pre-reseed closure ledger classifies every live mutation intent, runtime connector path, workflow plan, policy/dependency requirement, client/API ingress enrollment, fortress handoff, and active packet type as `closed`, `closing_now`, `queued_pre_reseed`, or `blocked`.

The first proving promotion is follow relation set/clear:

- `relation.follow.add`
- `relation.follow.clear`

These intents now prepare through trusted generic workflow planning while `NexusMutationService` remains the signed fortress authority. API routes, route payloads, response shapes, policy action IDs, packet schemas, proof behavior, tickets, signatures, persistence, and projections remain unchanged. The promoted path uses manifest workflow metadata and trusted local relation planning to produce the same packet candidates and policy metadata as the previous fortress-specific follow planner path.

The remaining pre-reseed queue is explicit:

- relation, claim, and attestation generic enrollment for association, home locality, role claim, packet signal, and role attestation paths
- discussion and locality workflow decomposition for reply/thread planners, default surfaces, locality path/graph planning, and assembly creation
- packet-based policy/dependency semantic authority so Policy packets and Definition dependency parts carry enough meaning for reseed
- legacy bridge retirement for compatibility aliases that should not survive into the fresh reseed world, now closed by removing legacy bridge intents from the live prepare corridor
- a final reseed readiness audit after all in-scope modernization closure items are closed

Unused never-live packet types were pruned from active canon. They can return only through the same definition, schema, builder, seed, and audit path as any other active type.

## Generic Composite Workflow Adapter Pass

Complex graph workflows now use named trusted composite adapter shapes in definition. These adapters are local runtime-owned orchestration patterns that compose known packet operations, policy actions, dependency refs, and result metadata. Packet definitions and workflow alignment may reference adapter IDs, but packet definitions still cannot provide executable code.

The first adapter shape is `composite.batch.packet_operations`, used by `locality.graph.apply`. It describes the reusable graph pattern: resolve inputs, plan structural packets, plan relation operation batches, resolve grouped policy, prepare unsigned digests, carry prepared-result metadata, and classify projection/refresh side effects as runtime return extensions.

Two additional graph-style shapes are recorded for reuse:

- `composite.default_packet_set.ensure` for idempotent default packet-set creation, first represented by `discussion.surfaces.ensure`.
- `composite.entity_create.with_followups` for a primary entity packet plus optional follow-up operations, first represented by `assembly.element.create`.

This pass remains runtime-ready. Live API routes, payloads, fortress ticketing, signing, persistence, projections, and response shapes remain unchanged. Complex workflows stay queued for live promotion until adapter parity tests prove prepare/finalize behavior against the current fortress oracle.

## Remaining Runtime Genericization Closure Pass

The second live generic promotion expands the trusted workflow seam beyond follow relations. The direct operation paths now enrolled behind `NexusMutationService` are:

- `relation.follow.add`
- `relation.follow.clear`
- `relation.association.add`
- `relation.association.clear`
- `relation.residence.add`
- `role_association.claim.set`
- `attestation.packet_signal.set`

The live behavior contract is unchanged: API payloads, policy action IDs, ticketing, signatures, packet schemas, persistence, projections, and finalize handlers remain the current fortress authority. The prepare side now resolves these direct operations through trusted local generic planners for scoped Relation, role Claim, and packet-signal Attestation writes, using the current fortress planners/builders as the behavior oracle.

The remaining composed workflows now have named adapter shapes instead of open-ended gaps:

- `composite.locality_path.create.v0` for reusable entity/path creation and directory projection refresh.
- `composite.discussion_thread_post.create.v0` and `composite.discussion_reply.create.v0` for canonical `Discussion(subtype: post/message)` writes.
- `composite.role_attestation.set.v0` for mutual-exclusion support/dispute/clear attestation composition.
- `composite.actor_write_policy.update.v0` for actor-owned Policy packet revision plus actor projection refresh.

Discussion follow-up is closed for the fresh canon: new top-level discussion writes use `Discussion(subtype: post)` semantics, while replies use `Discussion(subtype: message)`. `DiscussionThread`, `DiscussionPost`, and `DiscussionReply` are not active fresh packet types.

Initiative follow-up is also explicit: the fresh-reseed direction is `Action(subtype: initiative)` as the default OWA anchor for policy, template, branding, locality, voting, and governance defaults. `Cause` is not an active fresh packet type. This pass does not add an initiative selector or UI behavior.

## Live Composite Workflow Promotion Pass

The runtime genericization lane is now closed for in-scope live prepare handling. Direct packet operations continue through the trusted generic operation seam, and composed workflows now prepare through trusted generic-composite workflow resolvers:

- `composite.locality_path.create.v0`
- `composite.locality_graph.apply.v0`
- `composite.discussion_surfaces.ensure.v0`
- `composite.assembly_element.create.v0`
- `composite.discussion_thread_post.create.v0`
- `composite.discussion_reply.create.v0`
- `composite.role_attestation.set.v0`
- `composite.actor_write_policy.update.v0`

These resolvers execute trusted local runtime code only. Adapter descriptors describe the reusable workflow shape and audit metadata; packet definitions still cannot inject executable behavior. `MutationPrepareHandlers` remains the compatibility facade, `NexusMutationService` remains the signed fortress authority, and finalize handlers remain unchanged.

Actor write-policy update is mechanically promoted through the composite seam, and Policy packets plus Definition dependency parts are authoritative enough for the fresh genesis contract. Discussion canonicalization to top-level `Discussion(subtype: post)` plus reply `Discussion(subtype: message)` and OWA `Action(subtype: initiative)` are now part of the active reseed contract.

## Initiative Action Hierarchy and Discussion Schema Readiness

The pre-reseed packet model now treats `Action(subtype: initiative)` as the forward initiative/work hierarchy anchor. `Action` packets can carry hierarchy refs plus packet-backed policy, template, and default packet-set refs so OWA defaults can be overridden without adding OWA-specific fields to `Element` or hardcoding defaults in runtime.

Canonical discussion shape now reserves `Discussion(subtype: post)` for top-level multimedia forum artifacts that start a thread, while `Discussion(subtype: message)` remains the reply/comment shape. Legacy thread/post/reply packet types are pruned from fresh canon.

Governance hooks remain schema-ready rather than workflow-complete: quorum, minimum trust, voter eligibility, approval thresholds, and voting gates should be expressed through packet-backed Policy/default material linked from the applicable initiative Action, scope, proposal, or definition context. `Decision` is the formal outcome packet; `Report(subtype: decision_report)` is reserved for future tally/evidence/process closure material.

## Packet-Based Policy and Dependency Semantic Authority

Policy and dependency semantic authority is now closed for reseed readiness, while live governance execution remains later work. `Policy` current schema includes nullable `default_policy` and `governance_policy` sections. Older Policy revisions upcast those sections to explicit `null`; downcasts to older schema versions report loss when non-null default or governance material cannot be represented.

Policy packets are the semantic home for write locks, trust baselines, relation requirements, dependency and alignment rules, default inheritance, and governance hooks. The live write-lock path still runs through `MutationPolicyGate`; the new semantic helpers resolve and audit packet meaning without executing proposal/vote/decision behavior.

Definition `dependencies_definition` parts now carry meaningful dependency refs for packet operations, builder pipelines, action bridges, canonical packet-type builders, Preference projections, Bundle inventory building, and trusted compatibility/projection seams. Workflow and runtime dependency IDs must resolve through one of these anchors, Policy packet semantics, the operation ontology, a trusted workflow resolver, or an explicit trusted local engine contract.

The seeded OWA `Action(subtype: initiative)` now links to default-inheritance and governance-baseline policies. Forward default/policy resolution uses the Action initiative anchor.

## Canonical Subtype Reset

The pre-reseed reset prunes inactive and legacy packet types from active canon. Fresh canon now includes only Definition, Bundle, Element, Location, Role, Claim, Relation, Report, Proposal, Vote, Attestation, Decision, Action, Discussion, Policy, and Preference.

Every active packet body uses top-level `body.subtype` as its packet classifier. Fresh writes reject old top-level classifier names such as `kind`, `policy_kind`, `role_kind`, `proposal_kind`, `claim_kind`, and `attestation_kind`. Nested rule mechanics can still use precise names such as quorum or threshold kind when they are not packet classifiers.

`Cause`, `Signal`, separate initiative/work types, separate discussion thread/post/reply/forum/space types, `Minutes`, `Artifact`, and other pruned types are not valid fresh packet types. The alpha database is expected to be archived and wiped rather than adapted into fresh canon.

## Final Pre-Reseed Wrap-Up

The final wrap-up retires the remaining live legacy bridge mutation intents from fresh writes:

- `association.claim.set`
- `residence.claim.set`

Canonical writes now enter through `relation.association.add`, `relation.association.clear`, and `relation.residence.add`. Historical legacy claim material remains readable/importable/projectable through compatibility surfaces, but the signed fortress prepare corridor, client ingress registry, handoff coverage, and live write-policy action list no longer enroll the legacy bridge intents.

The final readiness handoff lives in runtime audit code as `createFinalPreReseedReadinessReport()`. It records canonical write intents, compatibility-only legacy surfaces, OWA seed/default anchors, required default policies, discussion default packets, canonical definition packet types, and out-of-scope never-live packet types. Reseed design should start from that report rather than rediscovering chapter state from scattered modernization audits.

## Definition Packetization and Preference Fortress Promotion

Active manifest definitions now have canonical packet material. `buildDefinitionPacketSeedEnvelopes()` emits schema-validated `Definition` packet envelopes for every active manifest definition part, and `buildDefinitionBundleSeedEnvelope()` groups those envelopes into one `Bundle.packet_set` definition profile inventory. `auditSeededPacketDefinitionProfile()` compares that packet material back to the core manifest and fails on missing parts, duplicate or stale bundle refs, digest drift, or manifest/profile mismatch.

`Definition`, `Bundle`, and `Preference` are now first-class canonical packet types. The active definition profile is seeded as real packet material, but execution remains trusted-local: imported Definition or Bundle packets can describe schemas, operations, policies, dependencies, planners, and builders, but cannot introduce executable server behavior.

This is packetized seed truth, not imported-code execution. Stored Definition and Bundle packets may describe schemas, operations, policies, dependencies, planners, and builders; trusted local runtime registries remain the only executable authority.

Claimed `Preference.element` writes now use the signed fortress prepare/finalize path as `preference.element.set`. The client prepares through `/api/nexus/mutations/prepare`, signs the prepared Preference packet candidate, finalizes through `/api/nexus/mutations/finalize`, and then receives the same projected Preference result shape from the mutation result. `/api/nexus/shell-preferences` is now guest compatibility state only. The old direct `preference.element.interface.set` connector is retained as a definition/internal comparison bridge rather than the live claimed-write path.
