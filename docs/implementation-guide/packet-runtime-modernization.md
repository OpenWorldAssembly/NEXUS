# Packet Runtime Modernization

## Status

Pre-reseed modernization chapter status. The early sections preserve the chapter history; the current state has seeded Definition/Bundle packet material, closed in-scope runtime genericization, packet-based policy/dependency semantics, retired legacy bridge write intents, and trusted signed `Preference.element` writes.

## Summary

This chapter brings the packet system, trusted runtime coordination, runtime connectors, and mutation orchestration up to the Preference-as-template direction. `Definition`, `Bundle`, and `Preference` are now canonical packet types; Preference remains the working runtime example with a signed trusted write path and runtime connector coverage for comparison. The broader goal is to keep every live packet type visible through the same coverage map while moving mutations into standardized Trusted Runtime Coordinator paths.

The work should preserve current behavior while replacing hidden assumptions with typed registries, explicit missing coverage items, and tests that fail when the modernization map drifts.

## Modernization Targets

- packet types should have body schemas, compatibility entries, builder support, manifest definitions, definition parts, and runtime connector status recorded in one audit surface
- runtime mutations should map to coordinator responsibilities, prepare/finalize behavior, policy action IDs, signed corridor use, and interface event enrollment status
- Definition, Bundle, and Preference are canonical packet types with body schemas, compatibility entries, builder support, definition parts, and seed/profile coverage
- imported Definition and Bundle packets describe semantics but never introduce executable server behavior
- Trusted Runtime Coordinators and the Interface Event Coordinator should become the standard orchestration path after coverage is complete

## Phase Plan

1. Save the broad plan and add coverage audits.
2. Use the audit output to prioritize packet-type definition work.
3. Expand manifest definitions and definition parts type by type, preserving existing schemas and compatibility behavior unless a type-specific schema evolution is explicitly approved.
4. Adapt runtime mutation paths into Trusted Runtime Coordinator seams behind the Interface Event Coordinator, keeping signed corridor behavior intact until each mutation has a tested replacement boundary.
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
- the initial audit baseline kept `Preference.element` out of signed mutation enrollment; the current corridor now enrolls `preference.element.set` through prepare/finalize
- do not rebuild generated public docs artifacts as part of this first pass

## Test Plan

- run packet modernization coverage tests
- run runtime mutation modernization coverage tests
- keep packet-definition manifest and audit tests green
- keep signed route and service-writer audit tests green
- validate docs with `npm run docs:validate`

## Decision Notes

The audit modules are the working checklist for the next implementation passes. Broken current invariants should fail tests. Expected gaps should remain visible as planned modernization work until they are closed by a later pass.


## Trusted Runtime Coordinator Architecture

Current modernization direction is to organize secure runtime work around enrolled Trusted Runtime Coordinators rather than route-local write code.

Target coordinator families:

- Interface Event Coordinator for client-side UI event shaping before requests leave the interface
- Trusted Dispatch Coordinator for user/API intent routing, request normalization, and fail-closed preflight
- Trusted Definition Coordinator for active definition context, node definition preferences, definition part selection, compatibility-only definitions, and reseed readiness views
- Trusted Regulation Coordinator for policy and governance resolution
- Trusted Planning Coordinator for defaults, dependency, and bundle-plan resolution
- Trusted Building Coordinator for producing packet candidates through the generic builder pipeline
- Trusted Inspection Coordinator for structural refs, dependency satisfaction, and bundle coherence
- Trusted Testing Coordinator for schema, compatibility, and policy assertions
- Trusted Certification Coordinator for signatures, tickets, digests, and final integrity
- Trusted Archive Coordinator for packet-store writes, archive reads, refs, edges, and query indexes
- Trusted Verification Coordinator for local packet verification and verification reports
- Trusted Compatibility Coordinator for runtime schema-version posture, adapter-path metadata, and compatibility coverage audits
- Trusted Exchange Coordinator for bundle ingress/egress, import previews, export wrappers, shallow merge plans, and rebundle previews
- Trusted Projection Coordinator for UI-ready graph projections and available actions

These coordinators are runtime concerns. They execute trusted local code and feed live context through the Core Contracts Vault. Packet definitions may describe allowed operations, defaults, dependencies, policy requirements, actions, and projection hints, but imported packet definitions must never execute local runtime behavior. The Interface Event Coordinator is the client-side event former; it has no trusted authority. The Trusted Dispatch Coordinator is the runtime front desk: it normalizes requests, preflights registered client/API intents, and hands accepted runtime requests to downstream coordinators. The older Interface Signal Conductor and Trusted Request Coordinator names remain compatibility bridges only. The Trusted Definition Coordinator is the gate for definition lookup: internal candidate listing, ranking, conflict audit, compatibility selection, and runtime-view compilation functions are routed through its public coordinator surface instead of being imported as loose helper functions. The Trusted Regulation Coordinator follows the same gated coordinator pattern for policy contexts, write-policy gates, requirement listing, and readiness audits. The Trusted Planning Coordinator owns packet operation plans, builder selection, defaults, dependencies, child-plan seams, body-input plans, and planning readiness so default/dependency work does not masquerade as policy enforcement. The Trusted Building Coordinator is now the gated candidate materialization seam: it consumes trusted operation plans, builds packet candidate graphs, preserves Definition-part body candidate construction, and does not re-resolve policy/default/dependency DSL. The Trusted Inspection Coordinator is now the quality gate after Building: it inspects build results against frozen operation plan snapshots, validates candidate bodies against packet body schemas, checks plan/candidate graph alignment, and does not re-plan, sign, certify, or archive in normal mode. The Trusted Certification Coordinator now opens the post-inspection handoff: it hashes the plan, build result, inspection report, and candidate graph, creates a short-lived certification ticket, prepares dispatchable signature requests, verifies signed returns, and emits an archive-ready certified packet set without writing to storage. The Trusted Archive Coordinator is now the storage seam: it owns packet-store writes, archived packet reads, revision resolution, edge queries, archive search rows, and low-level bundle export primitives so Exchange, Projection, Verification, and Compatibility work can ask Archive instead of reaching into SQLite directly. The Trusted Verification Coordinator is now the verification seam: it owns packet, batch, bundle, archive-set, lineage, ref-closure, and certification-handoff verification while reading stored packet material through Archive instead of SQLite. The Trusted Compatibility Coordinator is now the schema-version posture seam: it calls core compatibility helpers for read adaptation, write preparation, adapter-path metadata, and registry summaries, then cross-checks Definition packet_compatibility descriptors without executing imported adapter code. The Trusted Exchange Coordinator is now the packet-movement seam: it normalizes incoming bundle shapes, asks Compatibility whether packet material is readable, asks Verification for packet/bundle posture, asks Archive for local revision comparison and low-level export, and returns non-mutating import/export/merge/rebundle plans. Pass A intentionally does not commit imported bundles or own storage writes. The Trusted Projection Coordinator is now the read-model seam: it asks Archive for packet material and edges, asks Definition for projection descriptors, and returns UI-safe packet, list, and graph view models without owning storage or hardcoding future surface layouts.

## Interface Event Coordinator and Dispatch Intake

The first interface-to-runtime orchestration pass adds a Nexus app-layer `InterfaceEventCoordinatorProvider` and `useInterfaceEventCoordinator()` hook. UI handlers can now describe an event source, client intent, optional mutation intent, visual loading scope, local validation, dispatch callback, and refresh callback as one lifecycle. The coordinator creates an `interface.event` envelope, runs caller-owned validation, activates scoped loading, dispatches the work, normalizes success/failure results, and records recent event state for debugging.

Client validation is intentionally advisory. The Interface Event Coordinator supports required values, length checks, regex checks, and caller predicates, but runtime policy, proof, tickets, signing, persistence, and mutation effects remain authoritative downstream.

Runtime intake now exposes `trustedDispatchCoordinator` as the canonical front desk. It currently delegates to the existing foldered Trusted Request Coordinator implementation, preserving request compatibility while establishing dispatch naming. Mutation prepare/finalize routes normalize dispatch context through this coordinator; prepare also runs registered client-intent preflight before the existing fortress mutation service path continues. Optional interface event metadata travels in headers so signed mutation payload schemas stay unchanged.

## Definition-Driven Build And Projection Direction

The same declaration language should guide both packet creation and packet projection.

Creation uses definitions, builders, defaults definitions, dependencies definitions, policy requirements, and runtime variables to produce trusted operation plans before packet candidates are built. Projection should eventually use definitions, projection hints, component keys, action keys, display fields, and graph relationships to produce safe UI-ready view models.

Resolver ownership is split by domain:

- definition resolves active definition context, definition parts, node runtime preferences, compatibility-only definitions, and runtime definition views
- planning resolves operation plans, builder selection, default packet cascades, dependency satisfaction, workflow dry-runs, and child packet/component seams
- regulation resolves policy requirements, write-policy gates, governance rules, trust gates, moderation rules, voting eligibility, and other policy checks that may be needed inside or outside packet creation
- building creates packet candidates through the generic builder pipeline
- inspection validates candidate graphs and body candidates against the frozen operation plan snapshot
- projection resolves surfaces, display models, archive-backed packet lists, graph read models, badges, and available actions

Builders remain packet anatomy. Defaults describe normal starting shape. Dependencies describe required structural refs. Planning assembles those pieces into a concrete operation plan and asks Regulation for the active policy envelope when policy meaning matters. Regulation does not build packets or apply defaults; it classifies policy requirements and write gates for creation, projection, import/export review, moderation, runtime reads, and governance checks. Projection definitions describe safe display and interaction hints. The current Projection Coordinator keeps layouts intentionally basic, but its API is now shaped for definition-driven card fields, detail sections, edge groups, preferred surfaces, action slots, and later component/container descriptors.



## Trusted Coordinator Scaffold Standard

Trusted coordinators now share a scaffold contract: public coordinator object, stable coordinator id, typed result envelope, issues, trace entries, optional request/operation ids, optional process-chain diagnostics, and a manifest entry describing expected methods. Foldered trusted coordinators expose only their public coordinator and public types from `index.ts`; internal function modules and registries stay private behind the coordinator surface.

`npm run audit:trusted-coordinators` checks the scaffold manifest. The audit currently treats Dispatch, Request, Definition, Regulation, Planning, Building, Inspection, Certification, Archive, Verification, Compatibility, Exchange, and Projection as foldered gated coordinators. Resolution remains legacy-flat with a warning until it is promoted.

## Trusted Process Chains and Issue Taxonomy

Trusted runtime process chains are lightweight runtime diagnostic objects, not automatic packet writes. A chain records the stage-by-stage path through a coordinator operation: coordinator id/kind, operation name, status, timestamps, summary artifacts, completed/failed/blocked/skipped work, child chain ids, and normalized issue codes. Stage snapshots are summary-only by default and must not carry raw packet bodies, signed request payloads, private material, or raw bundle contents.

Issue codes now have a canonical dotted taxonomy such as `archive.packet_not_found`, `exchange.import_commit_blocked`, `verification.packet_structural_invalid`, and `certification.ticket_invalid`. Existing underscore-style codes remain registered as legacy aliases so older coordinator code can migrate incrementally while reports and future interface handling see stable canonical codes.

Process chains preserve partial-work posture without imposing one rollback law on every operation. Each chain records a completion policy such as `preserve_partial`, `atomic_required`, `dry_run_only`, or `coordinator_defined`. Archive write flows now record successful writes, failed writes, skipped candidates, and whether partial work was preserved; Exchange import commit chains preview/plan work, blocked downstream Archive work, and Archive import child results.

Report packets remain optional. The runtime can create a compact trusted process report draft from a chain, but v1 does not write or sign those report packets automatically. Future server-wide and Interface Event Coordinator adoption should consume the same chain and taxonomy helpers rather than inventing surface-specific error handling.

## Trusted Planning Coordinator Pass

The Trusted Planning Coordinator is now the runtime middleman for operation planning. It exposes gated methods for resolving operation plans, default plans, dependency plans, builder descriptor selection, child packet plan seams, and planning readiness audits. Defaults and dependencies moved out of the Trusted Regulation Coordinator because they are construction-planning inputs, not policy enforcement by themselves.

## Trusted Building Coordinator Pass

The Trusted Building Coordinator is now foldered and gated. Its public surface builds from trusted operation plans, materializes generic packet body candidate nodes, builds candidate graphs from plan trees, preserves typed Definition-part body candidate construction for reseed readiness, and audits whether planned operations can produce packet candidates. Building consumes the body-input plan prepared by Planning and does not parse policy/default/dependency DSL directly. Signing, inspection, certification, and archive writes remain outside Building.

## Trusted Archive Coordinator Pass

The Trusted Archive Coordinator is now foldered and gated as the runtime storage seam. Its public surface can store certified packet sets, read archived packets in adapted/raw modes, query archived packet cards from search rows, resolve preferred or requested revisions, query packet edges, export low-level bundle payloads, and audit packet-store access.

Archive does not certify, inspect, build, plan, or project packets. It expects Certification to hand it an archive-ready certified packet set and expects later Import, Export, Projection, and Verification coordinators to use Archive for packet-store access instead of calling SQLite directly. In the current pre-reseed state, archive writes intentionally block when a certified candidate graph only contains body candidates and no full packet envelopes. That gives us the right seam now without pretending the full reseed packet-envelope materialization step exists yet.

## Trusted Verification Coordinator Pass

The Trusted Verification Coordinator is now foldered and gated as the runtime verification seam. Its public surface verifies one packet, packet batches, transport bundles, archive-backed packet sets, parent revision lineage, packet ref closure, and Certification handoff packages. It preserves the existing raw-envelope verification law by checking structure and compatibility before signature assessment while passing the original raw packet material into the cryptographic verifier.

Verification does not store reports, write summaries, import bundles, export bundles, project UI models, or reach directly into SQLite. Stored packet verification flows must ask Archive for raw/adapted packet material, then run verification from that returned material. Local report writing and cached verification summaries remain service-layer responsibilities until report generation itself becomes a dedicated trusted coordinator seam.

## Trusted Compatibility Coordinator Pass

The Trusted Compatibility Coordinator is now foldered and gated as the runtime schema-version posture seam. Its public surface can resolve one packet's compatibility posture, adapt packet material for trusted reads, prepare versioned writes, resolve non-executable adapter-path metadata, compile registry/Definition compatibility profiles, audit packet-type coverage, and audit coordinator readiness.

Compatibility does not own adapter implementations, mutate packet material in storage, sign packets, verify cryptographic identity, import/export bundles, or promote imported Definition code into executable runtime behavior. Core schema compatibility remains the source of adapter logic. Definition packet_compatibility parts remain descriptive runtime metadata. This coordinator ties those two truths together so later Exchange, Projection, and reseed flows can ask one seam whether a packet can be interpreted, prepared, migrated, or blocked.

## Trusted Exchange Coordinator Pass A

The Trusted Exchange Coordinator is now foldered and gated as the packet movement seam. Its public surface can preview imports, plan import commits, export packet sets through Archive, plan shallow merges, preview normalized rebundles, and audit Exchange readiness. It composes Archive, Verification, and Compatibility instead of reaching directly into SQLite, parsing schemas locally in routes, or letting import/export behavior drift into UI code.

Pass A originally stayed non-mutating for ingress. The caller migration pass added the minimum commit seam needed by Packet Explorer: Exchange now plans the import commit and delegates low-level bundle storage to Archive, while the Explorer service preserves import reports, preferred-head repair, validation modes, and response payload shape. Export delegates the low-level bundle bytes to Archive and wraps them in an Exchange manifest. Rebundle preview still normalizes packet material into a transport-shaped object and manifest without persisting anything.

## Trusted Runtime Coordinator Audit And Caller Migration Pass

The trusted coordinator scaffold audit now checks foldered public surfaces, top-level barrel exports, expected manifest methods, and canonical result kinds. Resolution remains the only accepted legacy-flat warning. The audit also prints non-failing migration notes for runtime server callers that still use sensitive legacy seams, so caller cleanup can continue without confusing known transition points with scaffold failures.

Foldered Definition, Regulation, and Planning functions now report their manifest coordinator kinds instead of older transitional aliases such as `workflow`, `policy`, `defaults`, `dependency`, or `builder`. Those aliases remain in the shared kind union only for older legacy-flat workflow paths until a later compatibility cleanup.

Packet Explorer bundle export now routes through Trusted Exchange, which delegates bundle bytes to Trusted Archive. Packet Explorer import commit now routes through Trusted Exchange, which delegates low-level bundle import to Trusted Archive while the existing Explorer service preserves import reports, validation modes, preferred-head repair, and response payload shape. The legacy verification service now acts as a compatibility wrapper over Trusted Verification for packet assessment while it continues to own local validator identity and report-writing until those report flows move behind Certification and Archive.

Explorer's raw/adapted packet read path now uses Trusted Archive. The legacy packet interpreter remains in place for the current Explorer read-model panel because replacing that payload with Projection output would change the existing response contract; Projection migration for that panel is an explicit later cleanup.


The current implementation is intentionally pre-reseed practical:

- default plans wrap definition defaults, policy-selected default refs, and local overrides without building packet bodies directly
- dependency plans gather Definition dependency parts, workflow dependency IDs, semantic descriptors, runtime capability refs, and optional workflow dry-run findings
- builder selection picks the best runtime-ready builder descriptor for the packet type, subtype, and action IDs
- child packet plans are a typed seam, currently empty until defaults, bundles, and projection/component layout semantics are declared enough to recurse safely
- operation plans call Regulation for policy contexts and optional write-policy gates, rather than duplicating policy logic

Regulation is now policy-only. It still works outside packet creation, including projection, import/export review, moderation, runtime reads, and governance checks. Planning may call Regulation during packet creation, but Regulation does not own defaults, dependencies, or builder selection.


## Trusted Inspection Coordinator Pass

The Trusted Inspection Coordinator is now foldered and gated. Its public surface inspects build results, candidate graphs, individual packet body candidates, and plan alignment. Normal inspection receives the original Trusted Operation Plan snapshot plus the Trusted Build Result and asks whether Building faithfully materialized that plan. It validates candidate packet types, subtypes, builder IDs, planned body input values, body `subtype`, child candidate alignment, and packet body schemas. It does not resolve definitions, policies, defaults, dependencies, or operation plans again during normal inspection.

Inspection readiness intentionally runs the full Planning -> Building -> Inspection chain as an audit flow. That is different from judging an already-built candidate against a moving live context. Certification now owns the ticket/signature/hash handoff after Inspection; archival remains the later coordinator seam responsible for packet-store writes and indexes.

## Trusted Certification Coordinator Pass

The Trusted Certification Coordinator is now foldered and gated. Its public surface prepares certification tickets, prepares signature requests, verifies signed ticket returns, certifies signed tickets into archive-ready candidate-set artifacts, and audits Planning -> Building -> Inspection -> Certification readiness. Certification receives the final build result and inspection report. It does not re-plan, rebuild, or re-inspect. Instead, it freezes the accepted artifacts into stable hashes so the interface can request a signature over the exact payload.

Certification owns the ticket/signature handshake, not storage. A successful signed return produces a certified packet set with the original candidate graph and hashes intact. Archive remains the later coordinator responsible for final packet-store writes and indexes.

## Manifest Core Pass

The first chunky implementation pass expanded the packet manifest from the Preference template to the active packet types with generic builder-pipeline support: Element, Location, Role, Claim, Relation, Report, Proposal, Reaction, Decision, Action, Discussion, and Policy.

This pass remains runtime-ready. The new definitions describe existing body schemas, compatibility registry posture, generic builder support, action descriptors, planner descriptors, projection/index descriptors, and Definition parts. They do not change route payloads, packet schemas, runtime mutation behavior, or interface event connector enrollment.

Builder-missing types remain explicit missing coverage items in the modernization audit. Preference later received canonical builder support and signed-corridor write enrollment.

## Packet-Type Authority Pass

The next implementation pass shifted the forward-looking checklist from legacy type enrollment toward manifest `packet_type` authority. The later promotion pass enrolled `Definition` and `Bundle` as canonical packet types while preserving packet_type language as the forward-facing semantic layer.

The pass added body builders for Definition, Bundle, and Preference. Those builders now feed canonical seed-profile helpers that create real Definition packet envelopes and a Bundle packet inventory for reseed material.

Packet-type modernization coverage is now the forward-looking audit surface for manifest definitions. The legacy type coverage remains as a migration bridge for live packet types and should keep missing coverage items visible until those types are converted into packet-type definitions and runtime connectors.

## Compatibility Definition Standard Pass

The compatibility standardization pass makes compatibility a required, auditable definition contract. Every manifest packet type now needs a required `packet_compatibility` Definition part and a current-version identity adapter descriptor.

Generic type definitions derive definition compatibility descriptors from the canonical compatibility registry. Current-only types expose identity compatibility, while legacy-aware types expose adjacent upcast/downcast ladder edges where the registry has adapter functions. Multi-step ladders use the `full_chain_bundle` strategy so future bundles can carry discoverable adapter metadata without pretending every adapter must touch the current schema directly.

The manifest audit now fails when compatibility posture and descriptors disagree, when downcast edges lack loss awareness, when duplicate adapter edges exist, or when a claimed full-chain graph is disconnected from the current version. This keeps reseed and import/export planning honest before runtime handler extraction or Trusted Runtime Coordinator pipeline promotion begins.

## Mutation Handler Extraction Pass

The signed mutation corridor remains the live authority for prepare, proof, finalize, and persistence decisions. The Interface Event Coordinator remains the client/API-to-runtime event bridge; it does not own signed mutation internals yet.

The extraction pass introduces domain-composed mutation handler maps for locality, discussion, reaction, assembly, relation, role, and actor policy. `MutationPrepareHandlers` and `MutationFinalizeHandlers` remain compatibility facades for the current implementation, while the composed maps give the runtime a clearer stepping-stone toward generic packet planners.

Each live mutation intent now has a genericization classification:

- `generic_ready` means the intent is close to manifest/action/planner routing once its local read dependencies are isolated.
- `planner_extraction_needed` means reusable packet planning must be extracted before generic routing.
- `workflow_specific` means runtime orchestration still coordinates multiple packet operations or projections.
- `legacy_bridge` means the intent is a compatibility alias that should collapse into a canonical intent.

This pass intentionally preserves behavior. It records which mutation-service code should be retired, which should become reusable planners, and which orchestration remains runtime-owned before any live Trusted Runtime Coordinator pipeline promotion.

## Packet Operation Ontology Pass

The operation ontology pass adds the missing contract between packet definitions and trusted runtime execution. Packet definitions may now describe allowed mutation semantics by mapping their manifest mutation descriptors to known operation kinds such as `single_packet.create`, `single_packet.revise`, `relation.set`, `claim.assert`, `reaction.set`, `bundle.import`, `projection.refresh`, `compatibility.adapt`, and `workflow.compose`.

This ontology is an allowlist, not executable packet-defined code. Each operation records its expected planner kind, builder kind, result type, trusted local runtime engine, generic capability posture, and safety notes. Packet definitions can request known operation semantics, but only local trusted engines may execute builders, planners, adapters, workflows, or persistence.

The manifest audit now fails closed when a mutation descriptor cannot map to a known operation kind. The forward-looking packet operation modernization coverage lists every manifest mutation, the operation kinds it resolves to, the trusted local engine requested, and whether the gap is already mapped or still planned.

The signed mutation genericization audit also records operation mappings for every live mutation intent:

- `generic_ready` intents map directly to concrete operation kinds, but still wait for the later live promotion pass.
- `planner_extraction_needed` intents map to their target operation kind and keep an explicit planner extraction gap.
- `workflow_specific` intents map to `workflow.compose` or a composed operation set and remain runtime-owned until their component operations can be split safely.
- `legacy_bridge` intents point at the canonical operation direction they should collapse into.

This keeps ingress normalization separate from mutation authority. The Interface Event Coordinator can normalize client/API ingress requests and eventually choose operation descriptors, while the trusted mutation pipeline still owns prepare/finalize/proof/persistence until a later pass promotes selected operation kinds through the generic path.

## Generic Workflow Planner Contract Pass

The workflow planner contract pass adds the declarative layer above individual operation kinds. Packet definitions may now describe definition workflow plans as ordered steps over known generic operations, trusted resolver IDs, value bindings, simple conditions, policy action IDs, and runtime dependency IDs.

Workflow plans are data, not code. Definitions can say "resolve actor and target, then run `relation.set`" or "if the input value is present run `reaction.set`, otherwise run `reaction.clear`." They cannot introduce arbitrary functions, dynamic imports, persistence behavior, route payloads, or proof rules. The runtime interpreter validates every operation, resolver, dependency, condition operator, policy action, and step reference against local allowlists before producing a dry-run plan.

The first definition workflow plans cover the generic-ready mutation candidates:

- `relation.follow.add`
- `relation.follow.clear`
- `role_association.claim.set`
- `reaction.vote.set`

These plans do not enroll live execution. They prove the manifest can describe packet-specific variables and ordered generic work while preserving the signed mutation corridor as the only live prepare/finalize/proof/persistence authority.

Policy and dependency descriptors now matter as referenced workflow metadata, but their full semantics remain a dedicated pre-reseed pass. Unused legacy packet types remain explicit missing coverage items and do not block the generic workflow contract or switch-over planning.

## Workflow Alignment Pass

The workflow alignment pass connects the manifest workflow contract to the extracted mutation planner map. It adds a runtime-side audit that lists every live mutation intent, its genericization status, operation mapping, workflow-plan coverage, policy action IDs, trusted resolver/capability IDs, and remaining packet-specific assumptions.

The alignment map is the working checklist for retiring packet-specific mutation-service code. Generic-ready intents must have clean workflow dry-runs and trusted local capability coverage. Planner-extraction intents may either have a definition workflow plan or an explicit missing coverage item. Workflow-specific intents remain runtime-owned orchestration until their component operations can be split safely. Legacy bridge intents point at canonical workflow directions rather than receiving independent workflows.

This pass expands definition workflow coverage for knowable planner-extraction candidates:

- `relation.association.add`
- `relation.association.clear`
- `relation.residence.add`
- `discussion.reply.create`

The alignment remains runtime-ready. Existing runtime planner modules are registered as trusted local capabilities by descriptor, but their implementation is not moved, rewritten, or invoked through generic execution yet. Unused removed packet types remain visible missing coverage items and do not block switch-over planning.

## Runtime Ingress And Mutation Handoff Pass

Ingress preflight and mutation authority remain separate layers. Ingress preflight owns client/API normalization, manifest/workflow lookup, connector selection, definition handoff metadata, and response/refresh hints. The signed mutation corridor owns policy/proof authority, prepare/finalize lifecycle, mutation tickets, signed packet validation, persistence, and canonical mutation effects.

The handoff pass adds a definition `PacketRuntimeMutationHandoff` contract. A handoff records the normalized mutation direction, workflow alignment status, operation kinds, workflow plan IDs, trusted capability IDs, policy action IDs, dependency IDs, resolver IDs, prepare/finalize coordinator names, and return refresh hints. It carries `external_definition_execution_enabled: false` to record that imported definitions describe behavior while trusted local runtime code executes it.

Generic-ready and workflow-aligned planner-extraction intents can now produce `definition_ready` handoffs. Runtime-owned workflow intents produce explicit non-ready handoffs with orchestration reason codes. Legacy bridge intents point at canonical handoff directions. Unknown mutation intents fail closed before any mutation handoff.

At the time of this pass, this did not change the live mutation routes. The current state is stricter: `NexusMutationService` remains the live signed mutation authority, and authenticated `Preference.element` writes now enter that trusted mutation service path rather than the old direct packet-runtime connector.

## Packet-Based Policy, Dependency, and Client Ingress Enrollment Pass

Policy and dependency requirements are now audited as packet-backed semantics rather than a second runtime-only dependency system. Workflow plans can reference policy action IDs and dependency IDs, but those references must resolve to packet policy semantics, packet Definition dependency parts, operation ontology entries, trusted workflow resolvers, or trusted local capability metadata. Runtime descriptors may index and validate those references, but they do not define packet meaning.

`Policy` packets remain the semantic authority for live write-lock policy. `MutationPolicyGate` remains the live resolver for scope policy refs, actor security mode, proof level, and accepted proof methods. Definition workflow policy descriptors record how policy action IDs map back to that packet-based enforcement model, while manifest-only actions remain definition metadata until a later live write-policy enrollment pass.

Runtime ingress now has a client/API enrollment registry. The registry is an internal allowlist of adapter-originated transport routes and portable client intent IDs:

- `/api/nexus/mutations/prepare` enrolls the current signed mutation intents.
- `/api/nexus/mutations/prepare` enrolls the `Preference.element` client intent; authenticated shell preference writes now use the same prepare/finalize corridor as other claimed mutations, while `/api/nexus/shell-preferences` remains guest compatibility state only.
- each enrollment records route or transport source, client intent ID, mutation intent, operation kinds, workflow plans, policy actions, dependency refs, and current live mode.

Unknown or custom route/intent pairings fail ingress preflight. The preflight may resolve handoff metadata and packet-backed policy/dependency descriptors, but it does not authorize, ticket, sign, persist, finalize, or bypass the signed mutation corridor. This keeps the future generic corridor aligned with enrolled client/API ingress from web, device, automation, or other adapters instead of accepting arbitrary injected operation requests.

## Interface-Neutral API Ingress Pass

The enrollment layer is interface-neutral. Web shell, Raspberry Pi controls, local automation, and future adapters should all map their local events into the same portable client intent IDs, such as `scope.follow.set`, `scope.association.clear`, `discussion.reply.create`, and `preference.interface.set`. Runtime registries should not encode web UI concepts as packet meaning.

The live API routes now consult ingress preflight before delegating to the live corridor:

- prepare parses the request intent, validates client/API ingress enrollment, then delegates to `NexusMutationService`;
- finalize reads the stored ticket, validates the ticket's original mutation intent against enrolled prepare ingress, then delegates to `NexusMutationService`;
- authenticated shell preferences use the standard prepare/finalize mutation routes with `preference.element.set`;
- `/api/nexus/shell-preferences` remains a guest compatibility route and is outside packet-runtime connector enrollment.

This pass is still not generic execution. Preflight validates allowlist and metadata alignment only; mutation policy/proof/ticketing/persistence remains authoritative.

## No-Deferral Pre-Reseed Closure Program

Reseed design is now gated on full closure of in-scope live runtime modernization work. The chapter can still be split across multiple implementation passes, but the remaining live runtime work is no longer tracked as open-ended missing coverage items. The pre-reseed closure ledger classifies every live mutation intent, runtime connector path, workflow plan, policy/dependency requirement, client/API ingress enrollment, mutation handoff, and active packet type as `closed`, `closing_now`, `queued_pre_reseed`, or `blocked`.

The first proving promotion is follow relation set/clear:

- `relation.follow.add`
- `relation.follow.clear`

These intents now prepare through trusted generic workflow planning while `NexusMutationService` remains the signed mutation authority. API routes, route payloads, response shapes, policy action IDs, packet schemas, proof behavior, tickets, signatures, persistence, and projections remain unchanged. The promoted path uses manifest workflow metadata and trusted local relation planning to produce the same packet candidates and policy metadata as the previous mutation-service-specific follow planner path.

The remaining pre-reseed queue is explicit:

- relation, claim, and reaction generic enrollment for association, home locality, role claim, packet signal, and role reaction paths
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

This pass remains runtime-ready. Live API routes, payloads, mutation ticketing, signing, persistence, projections, and response shapes remain unchanged. Complex workflows stay queued for live promotion until adapter parity tests prove prepare/finalize behavior against the current mutation oracle.

## Remaining Runtime Genericization Closure Pass

The second live generic promotion expands the trusted workflow seam beyond follow relations. The direct operation paths now enrolled behind `NexusMutationService` are:

- `relation.follow.add`
- `relation.follow.clear`
- `relation.association.add`
- `relation.association.clear`
- `relation.residence.add`
- `role_association.claim.set`
- `reaction.vote.set`

The live behavior contract is unchanged: API payloads, policy action IDs, ticketing, signatures, packet schemas, persistence, projections, and finalize handlers remain the current mutation authority. The prepare side now resolves these direct operations through trusted local generic planners for scoped Relation, role Claim, and packet-signal Reaction writes, using the current mutation planners/builders as the behavior oracle.

The remaining composed workflows now have named adapter shapes instead of open-ended gaps:

- `composite.locality_path.create.v0` for reusable entity/path creation and directory projection refresh.
- `composite.discussion_thread_post.create.v0` and `composite.discussion_reply.create.v0` for canonical `Discussion(subtype: post/message)` writes.
- `composite.role_reaction.set.v0` for mutual-exclusion support/dispute/clear reaction composition.
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
- `composite.role_reaction.set.v0`
- `composite.actor_write_policy.update.v0`

These resolvers execute trusted local runtime code only. Adapter descriptors describe the reusable workflow shape and audit metadata; packet definitions still cannot inject executable behavior. `MutationPrepareHandlers` remains the compatibility facade, `NexusMutationService` remains the signed mutation authority, and finalize handlers remain unchanged.

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

The pre-reseed reset prunes inactive and legacy packet types from active canon. Fresh canon now includes only Definition, Bundle, Element, Location, Role, Claim, Relation, Report, Proposal, Reaction, Decision, Action, Discussion, Policy, and Preference.

Every active packet body uses top-level `body.subtype` as its packet classifier. Fresh writes reject old top-level classifier names such as `kind`, `policy_kind`, `role_kind`, `proposal_kind`, `claim_kind`, and `reaction_value`. Nested rule mechanics can still use precise names such as quorum or threshold kind when they are not packet classifiers.

`Cause`, `Signal`, separate initiative/work types, separate discussion thread/post/reply/forum/space types, `Minutes`, `Artifact`, and other pruned types are not valid fresh packet types. The alpha database is expected to be archived and wiped rather than adapted into fresh canon.

## Final Pre-Reseed Wrap-Up

The final wrap-up retires the remaining live legacy bridge mutation intents from fresh writes:

- `association.claim.set`
- `residence.claim.set`

Canonical writes now enter through `relation.association.add`, `relation.association.clear`, and `relation.residence.add`. Historical legacy claim material remains readable/importable/projectable through compatibility surfaces, but the signed mutation prepare corridor, client ingress registry, handoff coverage, and live write-policy action list no longer enroll the legacy bridge intents.

The final readiness handoff lives in runtime audit code as `createFinalPreReseedReadinessReport()`. It records canonical write intents, compatibility-only legacy surfaces, OWA seed/default anchors, required default policies, discussion default packets, canonical definition packet types, and out-of-scope never-live packet types. Reseed design should start from that report rather than rediscovering chapter state from scattered modernization audits.

## Definition Packetization and Preference Fortress Promotion

Active manifest definitions now have canonical packet material. `buildDefinitionPacketSeedEnvelopes()` emits schema-validated `Definition` packet envelopes for every active manifest definition part, and `buildDefinitionBundleSeedEnvelope()` groups those envelopes into one `Bundle.packet_set` definition profile inventory. `auditSeededPacketDefinitionProfile()` compares that packet material back to the core manifest and fails on missing parts, duplicate or stale bundle refs, digest drift, or manifest/profile mismatch.

`Definition`, `Bundle`, and `Preference` are now first-class canonical packet types. The active definition profile is seeded as real packet material, but execution remains trusted-local: imported Definition or Bundle packets can describe schemas, operations, policies, dependencies, planners, and builders, but cannot introduce executable server behavior.

This is packetized seed truth, not imported-code execution. Stored Definition and Bundle packets may describe schemas, operations, policies, dependencies, planners, and builders; trusted local runtime registries remain the only executable authority.

Claimed `Preference.element` writes now use the signed mutation prepare/finalize path as `preference.element.set`. The client prepares through `/api/nexus/mutations/prepare`, signs the prepared Preference packet candidate, finalizes through `/api/nexus/mutations/finalize`, and then receives the same projected Preference result shape from the mutation result. `/api/nexus/shell-preferences` is now guest compatibility state only. The old direct `preference.element.interface.set` connector is retained as a definition/internal comparison bridge rather than the live claimed-write path.

## Reaction packet convergence pass

Current pre-reseed canon collapses lightweight votes, packet signals, support/dispute posture, and emoji-style emotional responses into `Reaction` as the single packet type for target-agnostic responses.

`Reaction` packets are replaceable per actor/target/context. A revision can carry any combination of:

- `vote_value`: `'up'`, `'down'`, or `null`
- `attestation_value`: `support`, `dispute`, or `null`
- `emoji_keys`: a bounded list of basic emoji keys

`Reaction` does not encode target packet type or target-specific purpose. Proposal voting, discussion up/down signaling, role support/dispute posture, and later emoji/reaction UI should all route through the same packet type and projection layer. The old standalone `Vote` and `Attestation` packet types are removed from fresh canon for the clean pre-reseed path.

## Trusted Resolution Coordinator and Projection Definition Pass

The trusted runtime coordinator family now has a shared home under `runtime/trusted_coordinators/*`. Direct generic workflow promotion, composite workflow promotion, composite adapters, resolution, and projection share this layer instead of living as one-off files under the Nexus server adapter folder.

A portable resolution DSL now lives in core as declaration language, not executable behavior. It defines shared binding shapes, resolution steps, and preset descriptors such as primitive bindings, packet refs, policy gates, dependency gates, relation lookup, discussion thread context, role scope context, compatibility projection, and UI card projection. Packet definitions and workflow descriptors may point at preset IDs, while trusted runtime coordinators decide how those presets are actually resolved locally.

Packet projection descriptors are now richer definition data. They can declare field bindings, layout/component keys, preferred surfaces, action registry keys, dependency IDs, policy action IDs, and resolver preset IDs. The generic packet definitions now seed default summary-card and detail-panel projections for each active packet type, giving the UI a definition-driven shape without embedding UI-specific packet law into core logic.

Definition part body building now carries descriptor payloads for action registries, builders, planners, workflow plans, projections, compatibility adapters, and dependency descriptors. This makes Definition packets more useful for reseed instead of merely listing IDs.

This pass is still conservative at the product edge. The shared packet action service now asks projection definitions for the preferred packet surface, but route-level UI layouts are not yet fully generated from projection descriptors. The next useful pass is to wire projection view models into universal packet card/detail components and reseed Definition packets with these richer descriptor bodies.
