# Runtime Responsibility Audit

## Executive summary

This audit maps the current runtime toward its ideal ownership model. The trusted coordinator layer now has most of the right front doors, and Dispatch is the route-facing entrypoint for enrolled writes, but the API-facing runtime still contains product-specific service islands, legacy signed-corridor code, hardcoded packet type/subtype branches, and read-model logic that should gradually move behind Definition, Projection, Regulation, Planning, Certification, Archive, Verification, Compatibility, Exchange, and Dispatch seams.

Current scan baseline:

- `runtime/*`: 382 TypeScript files
- `runtime/nexus/server/*`: 164 TypeScript files
- `runtime/trusted_coordinators/*`: 162 TypeScript files
- `runtime/nexus/server/*` still contains roughly 333 packet type/subtype references and 349 storage-touch references
- legacy `fortress` naming still appears broadly in server runtime files and should be treated as signed-corridor compatibility language, not the future architecture name

The near-term goal is not to hide every product concept from runtime. Runtime may understand generic packet anatomy, refs, schema posture, signatures, storage, projections, and operation results. The goal is to stop encoding product behavior as scattered runtime branches when the rule can be described by packet definitions, projection descriptors, coordinator capabilities, or OWA adapter/profile modules.

## Ownership categories

Use these categories when classifying runtime modules and future migrations.

| Category | Meaning | Ideal location |
| --- | --- | --- |
| `trusted_coordinator_front_door` | Public coordinator surface and manifest-visible method owner | `runtime/trusted_coordinators/<coordinator>/` |
| `trusted_coordinator_internal` | Private coordinator registry, function, type, and internal helper | `runtime/trusted_coordinators/<coordinator>/` |
| `definition_driven_candidate` | Hardcoded behavior that should become Definition, defaults, dependency, builder, action, or projection metadata | Usually Definition/Planning/Projection plus packet definitions |
| `projection_candidate` | Read-model logic that should move behind Trusted Projection while preserving API payloads | `runtime/trusted_coordinators/trusted_projection_coordinator/` or projection adapter |
| `storage_adapter` | Concrete persistence adapter, schema, bundle storage primitive, or query adapter | `runtime/storage/*` or Archive-facing storage adapter |
| `runtime_adapter` | API-facing glue that composes coordinators and storage without owning packet semantics | `runtime/nexus/server/*` bounded context |
| `owa_product_adapter` | OWA-specific profile behavior, civic defaults, locality conventions, or compatibility policy | future `runtime/nexus/server/adapters/owa/*` or clearly named product module |
| `compatibility_bridge` | Old import path, legacy read fallback, compatibility projection, or temporary wrapper | nearest bounded context with bridge docs |
| `legacy_signed_corridor` | Former fortress prepare/finalize/ticket/proof code that must be retired rather than wrapped | replacement through Dispatch, Certification, Verification, and Archive |
| `test_or_audit` | Tests, readiness ledgers, modernization reports, and static audits | near tested subsystem or `runtime/nexus/server/readiness/*` |

## Current runtime map

| Area | Current responsibility | Ideal classification | Ideal direction | Risk |
| --- | --- | --- | --- | --- |
| `runtime/trusted_coordinators/*` | Trusted orchestration surfaces and internal coordinator functions | `trusted_coordinator_front_door` / `trusted_coordinator_internal` | Continue tightening scaffold, process chains, issue taxonomy, and caller migration | Medium |
| `runtime/storage/*` | SQLite packet store, schemas, query services, low-level persistence | `storage_adapter` | Keep concrete storage here; require Archive for coordinator/server reads where practical | Low |
| `runtime/nexus/server/packet-explorer/*` | Explorer import/export/search/data payload services | `runtime_adapter`, `projection_candidate`, `compatibility_bridge` | Keep API payloads stable while moving read models to Projection and packet movement to Exchange/Archive | Medium |
| `runtime/nexus/server/discussion/*` | Discussion forums, posts, replies, and vote-adjacent projections | `owa_product_adapter`, `projection_candidate`, `definition_driven_candidate` | Treat as transitional; move generic message/thread projection into Projection definitions over time | High |
| `runtime/nexus/server/reaction/*` | Reaction/vote projection and reaction packet service logic | `owa_product_adapter`, `projection_candidate`, `definition_driven_candidate` | Move target/reaction summaries and action availability toward Projection/Definition descriptors | High |
| `runtime/nexus/server/locality/*` | Locality directory, graph planning, location search | `owa_product_adapter`, `definition_driven_candidate`, `runtime_adapter` | Keep OWA locality conventions explicit; move reusable graph/build/dependency rules to Planning/Definition where possible | High |
| `runtime/nexus/server/scope/*` | Scope graph, ancestry compatibility, parent resolution, display preferences | `owa_product_adapter`, `projection_candidate`, `compatibility_bridge` | Separate generic graph projection from OWA policy/profile adapters and legacy compatibility reads | High |
| `runtime/nexus/server/identity/*` | Sessions, passkeys, actor custody, auth storage, identity search | `runtime_adapter`, `storage_adapter`, `compatibility_bridge` | Identity custody remains runtime-owned; packet-specific read/display pieces can move toward Projection | Medium |
| `runtime/nexus/server/readiness/*` | Modernization and pre-reseed readiness reports | `test_or_audit` | Keep as audit/report layer; update as seams migrate | Low |
| top-level `fortress-*`, `mutation-*`, `signed-*`, `packet-runtime-*` | Signed mutation prepare/finalize, tickets, proof, handoff, genericization audits | `legacy_signed_corridor` | Remove from route-facing traffic; replace through Dispatch-owned coordinator chain | High |
| top-level `nexus-query-data.ts` | Broad Nexus read model aggregation | `projection_candidate`, `owa_product_adapter` | Decompose by projection responsibility; move generic packet/card/list/read models behind Projection | High |
| top-level `verification-service.ts` | Verification wrapper, validator identity, report writing | `compatibility_bridge`, `runtime_adapter` | Keep wrapper short; move report certification/storage decisions later through Certification/Archive | Medium |

## Coordinator readiness and gaps

The major trusted coordinator doors are present: Dispatch, Definition, Regulation, Planning, Building, Inspection, Certification, Archive, Compatibility, Verification, Exchange, and Projection. There is intentionally no separate Write Coordinator; write lifecycle orchestration belongs to Dispatch. The remaining work is caller migration and internal cleanup, not inventing another major coordinator.

Coordinator gaps to address:

| Gap | Current signal | Ideal result | Recommended pass |
| --- | --- | --- | --- |
| Resolution is legacy-flat | scaffold audit warning | folder only if it becomes a central authority seam | Coordinator loose ends |
| Packet workflow and composite workflow are transitional | large flat files with product-aware operation branches | either folder as transitional coordinators or retire into Planning/Building/Inspection flows | Coordinator loose ends |
| Projection is under-adopted | read models still live in server services | Projection owns generic packet/list/graph/read-model output with adapters preserving route payloads | Projection migration |
| Regulation remains light | policy/write-gate meaning still partly server-owned | Regulation owns reusable policy and write-gate resolution; OWA policies remain adapters/profile data | Regulation deepening |
| Exchange/Archive/Verification are partially adopted | Explorer paths improved, but server callers still have direct storage/signature/interpreter touches | callers ask Exchange, Archive, Verification, and Compatibility first | Crossing migration |

## Legacy signed corridor inventory

Dispatch is the route-facing write lifecycle owner for `/api/nexus/mutations/prepare` and `/api/nexus/mutations/finalize`. The old fortress model must not be wrapped as a new coordinator; it is a removal target. New architecture language should describe enrolled writes as a Dispatch-owned pipeline through Definition, Regulation, Planning, Building, Inspection, Certification, Verification, and Archive.

| Process | Current files | Ideal owner | Ideal location | Risk |
| --- | --- | --- | --- | --- |
| mutation prepare/finalize orchestration | `trusted_dispatch_coordinator/*`, `fortress-prepare-handler-implementation.ts`, `fortress-finalize-handler-implementation.ts`, `mutation-service.ts` | Dispatch plus Regulation/Planning/Certification/Verification/Archive handoffs | `relation.follow.add` completes the full Dispatch-owned route chain; other intents remain capability gaps, not fallback paths | High |
| proof/ticket storage | `mutation-ticket-service.ts`, `mutation-ticket-store.ts`, `signed-packet-finalizer.ts` | Certification owns signature handoff; Verification owns signed packet validation; Archive owns storage | replace legacy ticket/finalizer behavior with Certification/Verification/Archive | High |
| intent schema and enrollment | `prepare-mutation-intent-schema.ts`, `mutation-intent-registry.ts`, `packet-client-intent-enrollment.ts` | Dispatch intake plus Definition-driven client/action metadata | Dispatch/Definition with API schema bridge | Medium |
| domain-specific finalize handlers | `fortress-handler-domain-*` | Planning/Building/Inspection/Archive or OWA adapter when product-specific | coordinator-specific functions or OWA adapter | High |
| genericization/handoff audits | `fortress-handler-genericization-audit.ts`, `packet-runtime-fortress-handoff.ts`, workflow alignment audits | readiness/test audit | `readiness/*` after terminology cleanup | Low |
| Preference fortress workflow | `preference-fortress-workflow.ts`, preference runtime connector files | signed corridor compatibility example, then Definition/Planning/Archive | signed mutation corridor bridge and Definition-driven workflow | Medium |

## Packet-type-specific service inventory

These areas are not wrong for the current prototype, but they are the main distance from the ideal Definition-driven runtime.

| Process | Current behavior | Ideal form | Migration risk |
| --- | --- | --- | --- |
| Discussion projections | hardcoded forum/topic/post/message/root/reply interpretation | Definition and Projection descriptors produce message/thread/read models; OWA adapter preserves route payloads | High |
| Reaction/vote projections | hardcoded target, actor, vote, association, and support summaries | Projection/action descriptors produce target reaction panes and available actions | High |
| Locality graph planning | OWA locality hierarchy, descriptor, parent, and graph rules in service code | OWA adapter plus Definition/Planning dependency descriptors for reusable graph build rules | High |
| Scope graph | canonical relations plus legacy claim/home compatibility and OWA policy anchors | Projection graph base plus OWA scope profile adapter and explicit compatibility bridge | High |
| Identity search and auth packet reads | Element.person checks and actor packet assumptions | identity custody stays runtime-owned; display/search projections move toward Projection descriptors | Medium |
| Packet Explorer data panels | interpreter-backed packet view payloads | Projection-backed packet view models with compatibility adapter preserving existing Explorer payloads | Medium |
| Query data aggregation | one broad route-read model service mixes many packet semantics | split into projection-backed read models plus product-specific adapters | High |
| Verification reports | service writes Report packets directly after coordinator assessment | Certification/Archive/report handoff decides durable signed diagnostics | Medium |

## Packet-definition opportunities

Move repeated hardcoded behavior into packet definitions only when the definition describes capability or display metadata, not executable untrusted code.

Good candidates:

- projection field labels, badges, summary fields, card sections, and preferred surfaces
- action availability descriptors and action grouping hints
- packet subtype display rules and generic target/source ref labeling
- default/dependency/build descriptors that Planning can compile into operation plans
- policy requirement descriptors that Regulation can evaluate with trusted local code
- import/export/verification summary descriptors for display and review

Not candidates for imported executable definition logic:

- SQLite reads/writes
- private-key custody, proof checks, and session validation
- signature verification implementation
- policy enforcement execution
- adapter code for schema migration
- API route authorization

## Ideal destination map

| Current pressure area | Ideal destination | First migration step |
| --- | --- | --- |
| `nexus-query-data.ts` | Projection coordinator plus OWA read adapter | carve out one route payload behind Projection with exact response parity |
| discussion service | Projection definitions plus OWA discussion adapter | isolate projection-only helpers from mutation/session behavior |
| reaction service | Projection/action descriptors plus OWA reaction adapter | separate target reaction read model from write path |
| locality directory | OWA locality adapter plus Planning/Definition descriptors | identify generic graph/dependency planning pieces |
| scope graph | Projection graph base plus OWA scope adapter | split legacy compatibility reads from canonical graph assembly |
| Packet Explorer data | Projection/Archive/Compatibility bridge | replace interpreter-backed panel sections one payload at a time |
| fortress/mutation corridor | Dispatch-owned coordinator chain | remove legacy route authority; close Certification/Archive readiness gaps |
| verification service | Verification wrapper plus report Certification/Archive handoff | keep assessment wrapper, isolate report-writing surface |

## Recommended migration order

1. Keep route-facing write lifecycle under Dispatch and remove legacy fortress concepts instead of wrapping them.
2. Move read-model work toward Projection Coordinator where payload parity is straightforward: start with Packet Explorer panels, then route query data, then discussion/reaction/scope read models.
3. Move direct storage, import/export, verification, and compatibility bypasses behind Archive, Exchange, Verification, and Compatibility. Add audit warnings first, then fail newly cleaned seams.
4. Extend the proven Dispatch write pipeline beyond `relation.follow.add`: full packet envelope materialization, Certification signed-bundle checks, Verification handoff, Archive storage, and result projection for each live intent.
5. Separate OWA-specific adapters from generic runtime. Product profile behavior should be named, not hidden inside generic services.
6. Retire compatibility bridges only after import scans and route tests prove callers have migrated.

## Acceptance standard for future cleanup

A runtime process is in its ideal form when:

- API routes are thin callers
- storage access goes through storage adapters or Archive-facing seams
- packet compatibility questions go through Compatibility
- import/export/merge movement goes through Exchange
- verification and signature assessment go through Verification or Certification as appropriate
- read models go through Projection unless they are explicitly product adapter output
- write flows enter through Dispatch and then move through Definition, Regulation, Planning, Building, Inspection, Certification, Verification, and Archive
- OWA-specific behavior is isolated as an adapter/profile layer
- packet definitions describe capabilities and display/build/policy metadata without executing untrusted code
