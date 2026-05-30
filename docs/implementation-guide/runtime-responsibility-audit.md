# Runtime Responsibility Audit

## Executive summary

This audit maps the current runtime toward its ideal ownership model. The trusted coordinator layer now has most of the right front doors, and Dispatch is the route-facing entrypoint for enrolled writes, but the API-facing runtime still contains product-specific service islands, legacy signed-corridor code, hardcoded packet type/subtype branches, and read-model logic that should gradually move behind Definition, Projection, Regulation, Planning, Certification, Archive, Verification, Compatibility, Exchange, and Dispatch seams.

Current scan baseline:

- `runtime/*`: 359 TypeScript files
- `runtime/nexus/server/*`: 138 TypeScript files
- `runtime/trusted_coordinators/*`: 165 TypeScript files
- Current trusted-coordinator audit notes report 10 direct storage-touch files, 3 direct signature-verification files, 1 API packet-parse crossing, and 24 legacy-fortress naming hits across 19 server/runtime files
- `npm run audit:direct-storage-touches` currently classifies 157 storage touches: 97 allowed reads, 44 allowed infrastructure touches, 16 migration-target touches that still need coordinator ownership, and 0 unclassified touches
- legacy `fortress` naming now appears mostly in static audit/readiness ledgers and transitional runtime descriptors; the old route executor files have been removed and should not be restored

The near-term goal is not to hide every product concept from runtime. Runtime may understand generic packet anatomy, refs, schema posture, signatures, storage, projections, and operation results. The goal is to stop encoding product behavior as scattered runtime branches when the rule can be described by packet definitions, projection descriptors, coordinator capabilities, or OWA adapter/profile modules.

## Guardrail housekeeping baseline

The trusted coordinator audit is now responsible for both scaffold shape and migration visibility. It checks for unmanifested `trusted_*_coordinator` folders, required package test scripts, manifest/barrel/method/result-kind drift, and registered trusted issue codes. Runtime crossing findings are reported as non-failing notes so migrations remain visible without blocking unrelated work.

The audit recursively scans implementation files under `runtime/nexus/server/*` and `src/app/api/nexus/*`, not only top-level compatibility bridge files. Current note categories are direct storage touches, direct signature verification, direct packet interpretation, direct bundle import/export, packet parsing inside API routes, and legacy fortress corridor references. These notes are migration targets, not scaffold failures. The audit now also fails if removed legacy executor files such as `mutation-service.ts`, `signed-packet-finalizer.ts`, or the old fortress prepare/finalize handlers reappear.

Direct storage touches now have a separate classification guard in `runtime/nexus/server/readiness/direct-storage-touch-audit.ts` and a package script, `npm run audit:direct-storage-touches`. This audit scans runtime, storage, trusted coordinator, and Nexus API roots; it fails only on unclassified storage writes. Reads, Archive/storage internals, bootstrap/identity/verification infrastructure, and derived-state cache writes are classified separately from product-service packet writes that still need trusted coordinator migration. The final pre-reseed readiness report imports this audit so any newly unclassified storage mutation blocks the reseed handoff.

Trusted coordinator tests now have a package entrypoint: `npm run test:trusted-coordinators`. The combined guard command is `npm run check:trusted-coordinators`, which runs the scaffold/crossing audit before the coordinator test suite.

The empty `trusted_write_coordinator` remnant was removed. There is intentionally no Write Coordinator; write lifecycle orchestration belongs to Dispatch. Exchange documentation was also corrected to reflect its current import commit orchestration role while preserving Archive as the storage owner.

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
| remaining `mutation-*` / `packet-runtime-*` ledgers | Static mutation intent descriptors, ticket compatibility helpers, handoff/readiness ledgers | `compatibility_bridge`, `test_or_audit`, `legacy_signed_corridor` | Keep only what describes transitional state; route executor files are removed | Medium |
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
| mutation prepare/finalize orchestration | `trusted_dispatch_coordinator/*` plus thin mutation API routes | Dispatch plus Regulation/Planning/Certification/Verification/Archive handoffs | `relation.follow.add`, `relation.association.add`, and `reaction.vote.set` complete the Dispatch-owned route chain; other intents remain capability gaps, not fallback paths | High |
| proof/ticket storage | `mutation-ticket-service.ts`, `mutation-ticket-store.ts` | Certification owns signature handoff; Verification owns signed packet validation; Archive owns storage | keep ticket helpers only as transitional compatibility until Certification ticket durability fully replaces them | Medium |
| intent schema and enrollment | `prepare-mutation-intent-schema.ts`, `mutation-intent-registry.ts`, `packet-client-intent-enrollment.ts` | Dispatch intake plus Definition-driven client/action metadata | Dispatch/Definition with API schema bridge | Medium |
| domain-specific finalize handlers | removed legacy `fortress-handler-domain-*` executor files | Planning/Building/Inspection/Archive or OWA adapter when product-specific | migrate remaining product intents directly into coordinator chains or adapter bridges, not old handler maps | High |
| genericization/handoff audits | `fortress-handler-genericization-audit.ts`, `packet-runtime-fortress-handoff.ts`, workflow alignment audits | readiness/test audit | `readiness/*` after terminology cleanup | Low |
| Preference write workflow | `element-preference-packets.ts`, preference runtime connector files | Definition/Planning/Archive plus compatibility cache adapter | migrate claimed Preference.element writes through the trusted chain and retire compatibility cache writes when safe | Medium |

## Packet-type-specific service inventory

These areas are not wrong for the current prototype, but they are the main distance from the ideal Definition-driven runtime.

| Process | Current behavior | Ideal form | Migration risk |
| --- | --- | --- | --- |
| Discussion projections | hardcoded forum/topic/post/message/root/reply interpretation | Definition and Projection descriptors produce message/thread/read models; OWA adapter preserves route payloads | High |
| Reaction/vote projections | hardcoded target, actor, vote, association, and support summaries | Projection/action descriptors produce target reaction panes and available actions | High |
| Locality graph planning | OWA locality hierarchy, descriptor, parent, and graph rules in service code | OWA adapter plus Definition/Planning dependency descriptors for reusable graph build rules | High |
| Scope graph | canonical relations plus legacy claim/home compatibility and OWA policy anchors | Projection graph base plus OWA scope profile adapter and explicit compatibility bridge | High |
| Identity search and auth packet reads | Element.person checks and actor packet assumptions | identity custody stays runtime-owned; display/search projections move toward Projection descriptors | Medium |
| Packet Explorer data panels | generic inspector and search card rows now use Projection/Archive seams; Export/Import retain service-specific logic | continue migrating remaining Explorer helper paths behind coordinator seams when response parity is straightforward | Medium |
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
| Packet Explorer data | Projection/Archive/Compatibility bridge | continue moving Export/Import edge cases behind coordinator seams after the generic inspector and search-card projection migrations |
| legacy mutation corridor remnants | Dispatch-owned coordinator chain | keep deleted executor guardrails in audit; classify remaining ticket/handoff ledgers before removal |
| verification service | Verification wrapper plus report Certification/Archive handoff | keep assessment wrapper, isolate report-writing surface |

## Running cleanup tab

Use this as the short check-off ledger so the same issues do not have to be rediscovered by later audits.

| Item | Status | Notes |
| --- | --- | --- |
| Trusted coordinator scaffold/test scripts | Done | `audit:trusted-coordinators`, `test:trusted-coordinators`, and `check:trusted-coordinators` are package-level entrypoints. |
| Empty Write Coordinator remnant | Done | Removed; writes remain Dispatch-owned. |
| Exchange commit accepted-entry narrowing | Done | Commit bundles are narrowed to accepted plan entries and compare Archive import receipts against the Exchange plan. |
| Dispatch finalize raw signed-material handoff | Done | Finalize routes no longer parse signed packets before Dispatch; Verification receives raw signed packet material. |
| Certification/Verification/Archive key continuity | Done | Certification records certified packet revision keys; Dispatch compares Certification against Verification and Archive; Archive blocks mismatched extracted envelopes. |
| Mutation intent label authority | Done | Dispatch derives finalized kind from the certified plan and rejects mismatched caller labels. |
| Resolution foldering | Open | Still the expected legacy-flat warning in the trusted coordinator scaffold audit. |
| Direct storage/signature/interpreter runtime crossings | Open | Packet Explorer generic inspector no longer uses the legacy packet interpreter. Direct storage touches are now explicitly classified; remaining coordinator-migration targets are discussion writes, reaction writes, Preference.element helper writes, and Packet Explorer import preferred-head repair. |
| Packet Explorer generic projection adoption | Done | The generic inspector payload now gets revision state, edges, raw/adapted reads, and read-model projection through Trusted Archive/Projection while preserving API response shape. |
| Packet Explorer search card projection | Done | Search ranking/grouping remains service-owned, but selected search rows now pass through Trusted Projection card-list output before mapping back to the existing response shape. |
| Generic query card projection | Partial | Dashboard, votes, and library packet-card lists now pass already-selected cards through Trusted Projection; discussion/reaction/scope/locality read models remain adapter migration lanes. |
| Projection adoption | Open | Packet Explorer Export/Import edges, deeper `nexus-query-data`, discussion/reaction/scope read models remain the biggest migration lane. |
| Legacy mutation service registry dependency | Done | `NexusMutationService` is no longer constructed or exposed by the live Nexus packet service registry. |
| Reaction finalize derived-state bridge | Done | `reaction.vote.set` derived-state response decoration moved out of Trusted Dispatch and into the reaction runtime adapter used by the finalize route. |
| Legacy fortress executor removal | Done | Removed the old `NexusMutationService`, signed-packet finalizer, fortress prepare/finalize handlers, fortress handler domain maps, manifest fortress bridges, and preference fortress workflow. Remaining fortress references are static handoff/genericization/readiness ledgers or transitional descriptor language. |
| OWA adapter/profile split | Open | Discussion, reaction, locality, and scope still mix generic runtime with OWA product behavior. |

## Recommended migration order

1. Keep route-facing write lifecycle under Dispatch. Removed legacy executor files must stay deleted; remaining fortress-named ledgers should be renamed or retired only after their descriptor value is replaced.
2. Move read-model work toward Projection Coordinator where payload parity is straightforward: Packet Explorer's generic inspector and search-card paths have started this migration, and generic dashboard/votes/library cards are partially projected; continue with deeper route query data, then discussion/reaction/scope read models.
3. Move the direct storage migration-target bucket behind Archive, Exchange, Verification, Projection, and Compatibility. The classification guard is in place; next cleanup should reduce the `needs_trusted_coordinator` bucket rather than rediscovering it.
4. Extend the proven Dispatch write pipeline beyond the first migrated intents: full packet envelope materialization, Certification signed-bundle checks, Verification handoff, Archive storage, and result projection for each live intent. Reaction vote writes now use the chain, with derived summary/index refresh isolated in the finalize route's reaction adapter until Projection owns the read model.
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
