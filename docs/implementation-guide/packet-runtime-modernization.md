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
