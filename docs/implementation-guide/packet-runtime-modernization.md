# Packet Runtime Modernization

## Status

Broad chapter plan. The first implementation pass saves this plan and adds executable coverage audits only; it does not migrate packet schemas, replace routes, or move existing fortress mutations into runtime connectors.

## Summary

This chapter brings the packet system, generic fortress, runtime connectors, and mutation orchestration up to the Preference-as-template direction. Preference remains the working example: it has a manifest definition, definition parts, a runtime connector, and master-handler enrollment. The broader goal is to make every live packet family visible through the same coverage map before expanding definitions and moving mutations into a standardized runtime path.

The work should preserve current behavior while replacing hidden assumptions with typed registries, explicit planned gaps, and tests that fail when the modernization map drifts.

## Modernization Targets

- packet families should have body schemas, compatibility entries, builder support, manifest definitions, definition parts, and runtime connector status recorded in one audit surface
- runtime mutations should map to prepare handlers, finalize handlers, policy action IDs, signed corridor use, and master-handler connector enrollment status
- Preference stays the only manifest-defined packet family currently enrolled in the canonical packet ontology for this chapter baseline
- Definition and Bundle stay experimental manifest packet types until a later live-enrollment pass
- the generic fortress and master handler should become the standard runtime orchestration path after coverage is complete

## Phase Plan

1. Save the broad plan and add coverage audits.
2. Use the audit output to prioritize packet-family definition work.
3. Expand manifest definitions and definition parts family by family, preserving existing schemas and compatibility behavior unless a family-specific schema evolution is explicitly approved.
4. Adapt runtime mutation paths into runtime connectors behind the master handler, keeping signed corridor behavior intact until each mutation has a tested replacement boundary.
5. Enroll completed families and connectors only when their docs, tests, policies, and runtime behavior are all aligned.
6. Retire planned-gap records only when the implementation and tests prove the gap is actually closed.

## First Pass

The first pass is intentionally non-behavioral:

- add this chapter document
- link it from the implementation-guide index
- add packet family modernization coverage audits
- add runtime mutation modernization coverage audits
- add tests proving current families, mutation intents, Preference connector enrollment, and Definition/Bundle next-phase targets are all visible
- keep known modernization gaps green only through explicit planned-gap records

## Guardrails

- do not add Definition or Bundle to `PACKET_FAMILIES` in this chapter baseline
- do not change `MutationIntent`, route payloads, packet schemas, or compatibility registry behavior during the audit pass
- do not migrate legacy scope-display caches until a dedicated compatibility pass
- do not introduce signed fortress enrollment for `Preference.element` until that work is scoped separately
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

The first chunky implementation pass expands the experimental manifest from the Preference template to the live packet families that already have generic builder-pipeline support: Element, Location, Role, Claim, Relation, Report, Proposal, Vote, Attestation, Decision, Cause, Action, Discussion, and Policy.

This pass remains shadow-only. The new definitions describe existing body schemas, compatibility registry posture, generic builder support, action descriptors, planner descriptors, projection/index descriptors, and Definition parts. They do not change route payloads, packet schemas, runtime mutation behavior, or master-handler connector enrollment.

Builder-missing families remain explicit planned gaps in the modernization audit, and Preference remains manifest-defined while keeping its expected generic build-pipeline gap until a dedicated Preference builder pass.

## Packet-Type Authority Pass

The next implementation pass shifts the forward-looking checklist from legacy `PACKET_FAMILIES` enrollment toward manifest `packet_type` authority. `Definition` and `Bundle` remain outside `PACKET_FAMILIES`; they are manifest-native packet types for this chapter rather than future legacy family-enrollment targets.

The pass adds shadow body-candidate builders for manifest-native packet types. `Definition` builds parsed Definition part bodies from local definition descriptors, `Bundle.packet_set` builds parsed bundle inventory bodies, and `Preference.element` uses the existing element preference body helper. These builders return body candidates and metadata only; they do not create signed/stored `PacketEnvelope` records.

Packet-type modernization coverage is now the forward-looking audit surface for manifest definitions. The legacy family coverage remains as a migration bridge for live packet families and should keep planned gaps visible until those families are converted into packet-type definitions and runtime connectors.

## Compatibility Definition Standard Pass

The compatibility standardization pass makes compatibility a required, auditable definition contract. Every manifest packet type now needs a required `packet_compatibility` Definition part and a current-version identity adapter descriptor.

Generic family definitions derive shadow compatibility descriptors from the canonical compatibility registry. Current-only families expose identity compatibility, while legacy-aware families expose adjacent upcast/downcast ladder edges where the registry has adapter functions. Multi-step ladders use the `full_chain_bundle` strategy so future bundles can carry discoverable adapter metadata without pretending every adapter must touch the current schema directly.

The manifest audit now fails when compatibility posture and descriptors disagree, when downcast edges lack loss awareness, when duplicate adapter edges exist, or when a claimed full-chain graph is disconnected from the current version. This keeps reseed and import/export planning honest before runtime handler extraction or generic fortress promotion begins.

## Fortress Handler Extraction Pass

The signed fortress corridor remains the live authority for prepare, proof, finalize, and persistence decisions. The packet-runtime master handler remains the GUI/API-to-runtime connector bridge; it does not own signed fortress internals yet.

The extraction pass introduces domain-composed fortress handler maps for locality, discussion, attestation, assembly, relation, role, and actor policy. `MutationPrepareHandlers` and `MutationFinalizeHandlers` remain compatibility facades for the current implementation, while the composed maps give the runtime a clearer stepping-stone toward generic packet planners.

Each live mutation intent now has a genericization classification:

- `generic_ready` means the intent is close to manifest/action/planner routing once its local read dependencies are isolated.
- `planner_extraction_needed` means reusable packet planning must be extracted before generic routing.
- `workflow_specific` means runtime orchestration still coordinates multiple packet operations or projections.
- `legacy_bridge` means the intent is a compatibility alias that should collapse into a canonical intent.

This pass intentionally preserves behavior. It records which fortress code should be retired, which should become reusable planners, and which orchestration remains runtime-owned before any live generic fortress promotion.

## Packet Operation Ontology Pass

The operation ontology pass adds the missing contract between packet definitions and trusted runtime execution. Packet definitions may now describe allowed mutation semantics by mapping their manifest mutation descriptors to known operation kinds such as `single_packet.create`, `single_packet.revise`, `relation.set`, `claim.assert`, `attestation.set`, `bundle.import`, `projection.refresh`, `compatibility.adapt`, and `workflow.compose`.

This ontology is an allowlist, not executable packet-defined code. Each operation records its expected planner kind, builder kind, result family, trusted local runtime engine, generic capability posture, and safety notes. Packet definitions can request known operation semantics, but only local trusted engines may execute builders, planners, adapters, workflows, or persistence.

The manifest audit now fails closed when a mutation descriptor cannot map to a known operation kind. The forward-looking packet operation modernization coverage lists every manifest mutation, the operation kinds it resolves to, the trusted local engine requested, and whether the gap is already mapped or still planned.

The signed fortress genericization audit also records operation mappings for every live mutation intent:

- `generic_ready` intents map directly to concrete operation kinds, but still wait for the later live promotion pass.
- `planner_extraction_needed` intents map to their target operation kind and keep an explicit planner extraction gap.
- `workflow_specific` intents map to `workflow.compose` or a composed operation set and remain runtime-owned until their component operations can be split safely.
- `legacy_bridge` intents point at the canonical operation direction they should collapse into.

This keeps the moat/drawbridge boundary intact. The runtime master handler can normalize GUI/API requests and eventually choose operation descriptors, while the fortress still owns trusted prepare/finalize/proof/persistence until a later pass promotes selected operation kinds through the generic path.

## Generic Workflow Planner Contract Pass

The workflow planner contract pass adds the declarative layer above individual operation kinds. Packet definitions may now describe shadow workflow plans as ordered steps over known generic operations, trusted resolver IDs, value bindings, simple conditions, policy action IDs, and runtime dependency IDs.

Workflow plans are data, not code. Definitions can say "resolve actor and target, then run `relation.set`" or "if the input value is present run `attestation.set`, otherwise run `attestation.clear`." They cannot introduce arbitrary functions, dynamic imports, persistence behavior, route payloads, or proof rules. The runtime interpreter validates every operation, resolver, dependency, condition operator, policy action, and step reference against local allowlists before producing a dry-run plan.

The first shadow workflow plans cover the generic-ready fortress candidates:

- `follows.relation.set`
- `follows.relation.clear`
- `role_association.claim.set`
- `attestation.packet_signal.set`

These plans do not enroll live execution. They prove the manifest can describe packet-specific variables and ordered generic work while preserving the signed fortress as the only live prepare/finalize/proof/persistence authority.

Policy and dependency descriptors now matter as referenced workflow metadata, but their full semantics remain a dedicated pre-reseed pass. Unused legacy packet families remain explicit planned gaps and do not block the generic workflow contract or switch-over planning.
