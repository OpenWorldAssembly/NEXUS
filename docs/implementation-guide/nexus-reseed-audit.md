# Nexus Reseed Audit

## Status

Audit date: 2026-06-26.

Current result: pre-reseed readiness is green for reseed implementation. The live audit suite reports zero final blockers and zero cleanup candidates. The remaining warnings are transitional architecture notes, not stop-work defects.

Worktree baseline for this audit was clean (`git status --short` returned no tracked or untracked changes), so there were no existing local changes to preserve or classify in this run.

## Current Readiness

Required audit commands were run against the current repo state:

| Command | Result | Notes |
| --- | --- | --- |
| `npm run audit:trusted-coordinators` | pass | 0 errors, 0 warnings; reported non-blocking migration notes for direct storage, signature verification, and packet parsing. |
| `npm run audit:direct-storage-touches` | pass | 141 classified touches; 0 unclassified findings. |
| `npm run audit:nexus-write-routes` | pass | 0 errors across 36 write-method route files. |
| `npm run audit:packet-specific-runtime` | pass | 88 classified files, 1536 references, 0 errors, 0 warnings. |
| `npm run audit:packet-definition-readiness` | pass | 15 packet types, 69 subtype rows, 0 errors, 0 warnings, 20 info notes. |
| `npm run audit:definition-dsl-capability` | pass | 9 areas, 0 errors, 0 warnings, 3 info notes. |
| `npm run audit:definition-bootstrap-profile` | warn | Stored Definition profile path is aligned, but TypeScript definitions still act as the active runtime source. |
| `npm run audit:node-preference-protocol` | warn | Node preference protocol is aligned; local validator secret side-table storage remains transitional. |
| `npm run audit:final-pre-reseed-readiness` | pass | 0 blockers, 28 accepted transition notes, 0 cleanup candidates. |

The Node loader and SQLite experimental warnings printed by the audit commands are tooling/runtime warnings, not audit findings.

## Packet Defaults And Definition Coverage

All active packet types are seed-ready. `Definition` and `Bundle` intentionally keep minimal bootstrap/carrier projection metadata. Bundle transport labels `export`, `sync`, and `archive` are declared carrier labels, not separately seeded semantic Definition profiles.

| Packet type | Subtypes | Default coverage | Projection coverage | Status |
| --- | --- | --- | --- | --- |
| `Definition` | `packet_definition`, `packet_schema`, `packet_action_registry`, `packet_builder_descriptor`, `packet_planner_descriptor`, `packet_projection_descriptor`, `packet_compatibility`, `defaults_definition`, `dependencies_definition` | 1 default part each | 1 minimal projection part each | acceptable minimal |
| `Element` | `assembly`, `team`, `node`, `person`, `locality`, `organization`, `service`, `working_group`, `digital_space`, `building`, `container`, `operator` | 1 default part each | 1 projection part each | ready |
| `Location` | `point`, `address`, `boundary`, `region`, `route`, `service_area`, `provider_ref_bundle` | 1 default part each | 1 projection part each | ready |
| `Role` | `role` | 1 default part | 1 projection part | ready |
| `Claim` | `relation_assertion`, `analysis`, `objection`, `challenge`, `correction`, `annotation`, `duplicate_notice` | 1 default part each | 1 projection part each | ready |
| `Relation` | `follow`, `subscription`, `association`, `participation`, `residence`, `defined_by_location`, `contains`, `overlaps`, `equivalent_to`, `default_ancestry_parent` | 1 default part each | 1 projection part each | ready |
| `Report` | `verification_report`, `import_report`, `decision_report` | 1 default part each | 1 projection part each | ready |
| `Proposal` | `proposal` | 1 default part | 1 projection part | ready |
| `Reaction` | `reaction` | 1 default part | 1 projection part | ready |
| `Decision` | `decision` | 1 default part | 1 projection part | ready |
| `Action` | `initiative`, `campaign`, `program`, `mission`, `task` | 1 default part each | 1 projection part each | ready |
| `Discussion` | `space`, `forum`, `topic`, `post`, `message` | 1 default part each | 2 projection parts each | ready |
| `Policy` | `policy` | 1 default part | 1 projection part | ready |
| `Preference` | `element`, `node` | 1 default part each | 2 projection parts each | ready |
| `Bundle` | `packet_set` | 1 default part | 1 minimal projection part | acceptable minimal |
| `Bundle` | `export`, `sync`, `archive` | no semantic default part by design | 1 minimal projection part each | acceptable minimal carrier labels |

Definition readiness bucket counts:

- `runtime_ready`: 13
- `seed_ready`: 15
- `definition_partial`: 0
- `compatibility_missing`: 0
- `needs_decision`: 0
- `projection_incomplete`: 2 (`Definition`, `Bundle`)
- `write_incomplete`: 2 (`Definition`, `Bundle`)

The active type layers are 10 Nexus core packet types, 4 OWA domain packet types, and 1 carrier type.

## Seeder And Source Inventory

The current seed set is a coherent pre-reseed bridge with deterministic curated global geography v1 material:

| Seed set | Count | By type |
| --- | ---: | --- |
| Canonical seed packets | 421 | `Element`: 38, `Policy`: 5, `Action`: 1, `Relation`: 101, `Role`: 3, `Proposal`: 1, `Discussion`: 50, `Location`: 32, `Definition`: 189, `Bundle`: 1 |
| Personal seed packets | 71 | `Element`: 6, `Policy`: 5, `Action`: 1, `Relation`: 5, `Role`: 3, `Proposal`: 1, `Discussion`: 50 |
| Curated global geography seed packets | 160 | `Element`: 32, `Location`: 32, `Relation`: 96 |
| Definition profile seed packets | 190 | 189 `Definition` packets plus 1 `Bundle.packet_set` profile bundle |

Legacy seed source inventory passes:

- `fresh_canon`: 27 markers
- `compatibility_read_only`: 19 markers
- `stale_seed_candidate`: 0 markers
- blockers: none
- cleanup candidates: none

Fresh seed and composite creation no longer emit `parent_scope` header edges. New seed and locality-create material uses packet-native `Relation.default_ancestry_parent`, `Relation.contains`, and `Relation.defined_by_location` records. Legacy `parent_scope` remains compatibility-read-only for older archive records and route/query inputs that still need to interpret historical material.

## Runtime Readiness

Trusted coordinator architecture is ready enough for reseed planning:

- Dispatch, Definition, Regulation, Planning, Building, Inspection, Certification, Archive, Verification, Compatibility, Exchange, and Projection are scaffold-audited.
- Direct storage touches are classified as allowed reads or allowed infrastructure; there are no `needs_trusted_coordinator` findings.
- Write routes are classified, with mutation prepare/finalize going through the dispatch write corridor.
- Packet-specific runtime references are classified and do not currently require boundary review.

Transitional runtime notes to preserve:

- TypeScript `PacketTypeDefinition` payloads remain the active runtime definition source while stored Definition packets act as seed/profile material.
- Local validator identity still has side-table private JWK storage for local development; production should prefer environment/file-backed node signing secrets and later encrypted or secure runtime storage.
- Some server services still have allowed direct storage or signature/parse seams; these are migration notes, not blockers.

## Accepted Transition Notes

The final pre-reseed audit has zero blockers. Accepted transition notes fall into four groups:

- Debug candidate body validation notes for active packet types: `Action`, `Bundle`, `Claim`, `Decision`, `Definition`, `Discussion`, `Element`, `Location`, `Policy`, `Preference`, `Proposal`, `Reaction`, `Relation`, `Report`, and `Role`.
- Bootstrap/carrier metadata notes: `bundle.packet_set.body.v0` and `definition.part.body.v0` are canonical metadata but not runtime-ready.
- Definition source transition: TypeScript bootstrap definitions and generated Definition seed packets are both active pre-reseed sources; parity is enforced by the definition readiness audit.
- Workflow descriptor transition: `preference.node.set.workflow.v0` still references undeclared or unresolved `node.ref`, `preference.node.write`, `trusted.archive.discovery`, `trusted.definition.resolution`, and `trusted.verification.assessment` labels.

These notes should stay visible until the reseed implementation replaces them with tested runtime behavior or explicitly reclassifies them.

## Reseed Algorithm Direction

The reseed should be deterministic, packet-native, and broad enough to exercise the OWA product shape without pretending to be an exhaustive global gazetteer.

Packet set classes:

1. Definition profile
   - Seed 189 Definition part packets plus the active Bundle packet set.
   - Pin the active profile through `Preference.node` once node packet identities are final.

2. OWA default policies
   - Seed baseline residence, inheritance, governance, visitor lobby, and trust policies.
   - Express default inheritance through Policy refs and default packet set refs rather than route-local constants.
   - Current code can resolve Definition defaults plus Policy/local default overrides into a trusted default plan. New Element discussion-surface creation can also carry an optional `initiative_packet_id`, allowing OWA discussion defaults to override generic Nexus copy when the OWA Action initiative is selected.
   - Remaining work is expanding initiative/scope policy selection beyond discussion defaults so all reseed builders can feed resolved default values into concrete packet candidates.

3. OWA action hierarchy
   - Keep the OWA action anchor as the top-level initiative.
   - Add campaigns/programs/missions/tasks only when they demonstrate real workflow needs.

4. Node and identity bootstrap
   - Seed an environment-specific `Element.node`.
   - Seed a signed `Preference.node` for definition profile selection, trust graph defaults, import verification defaults, and cleanup posture.
   - Keep private signing keys out of packet bodies.

5. Curated global geography v1
- Use deterministic curated entries for nations, first-level regions, and major cities under the existing Global Commons root.
- Store each curated geography entry as an assembly Element plus a provisional `Location.region` descriptor.
- Use `Relation.default_ancestry_parent`, `Relation.contains`, and `Relation.defined_by_location` instead of `parent_scope`.
- Use stable packet IDs such as `nexus:element/locality/{slug}` and `nexus:location/region/locality-{slug}`.

6. Default discussion surfaces
   - Use the existing element discussion default recipe for locality assemblies.
   - Include visitor lobby, general, proposals, and reports forums for locality assemblies.
   - Keep generic Nexus locality visitor-lobby copy neutral. Apply OWA/community copy through the OWA initiative override helper so Elements created under the OWA initiative invite introductions, local context, invitations into Nexus, and visible coordination benefits without making that behavior universal.
   - Keep discussion aggregation adapter-owned while definition-backed projection descriptors remain the metadata source.

7. Coherent demo/world records
   - Seed roles for facilitator/coordinator/councilor-like behavior.
   - Seed relation records for ancestry, contains, participation, residence, follows, and subscriptions as needed.
   - Add claims, reactions, reports, proposals, and decisions sparingly so each exists to test a workflow, not to pad the graph.

Ordering:

1. Definition profile bundle.
2. Node Element and Preference.node bootstrap.
3. OWA policy defaults.
4. OWA action anchor and hierarchy.
5. Curated global geography Elements and Locations.
6. Geography relation graph.
7. Roles and participation/residence relations.
8. Default discussion surfaces.
9. Starter proposals, reports, decisions, claims, and reactions.
10. Final bundle/export material and verification reports.

## Implementation Backlog

Closed in this implementation pass:

1. Replaced fresh `parent_scope` seed/composite output with packet-native relation graph seeding.
2. Added deterministic curated global geography v1 seed material with 32 locality Elements, 32 Location descriptors, and 96 structural relations.
3. Added regression tests for unique seed IDs, relation-native ancestry, curated geography packet counts, locality path packet output, legacy inventory closure, and final readiness closure.
4. Classified `preference.node.set.workflow.v0` as closed descriptor-only pre-reseed coverage instead of a cleanup candidate.
5. Added a guarded local reseed maintenance route that dry-runs or commits `CANONICAL_SEED_PACKETS` into the active local packet store before Packet Explorer full-store export.
6. Added a guarded schema-preserving database wipe action for the same route so local or explicitly enabled maintenance runtimes can clear existing packet/auth/index/runtime rows before reseeding and exporting a clean packet-store artifact. Remote maintenance use, including Railway, also requires `NEXUS_RESEED_TOKEN` on the request.

Remaining ordered work before a full production reseed:

1. Finalize environment-specific node identity packet IDs and decide how local/dev/prod node identities are created during reset.
2. Seed or derive signed `Preference.node` material for local development and production identity posture, keeping private keys external to packet bodies.
3. Extend the OWA initiative/scope default selection pattern beyond discussion surfaces so Policy/default override resolution feeds all relevant reseed packet candidates rather than stopping at trusted planning metadata.
4. Build the production import/promotion path for a locally exported reseed bundle, then verify the imported packet set with Verification and Compatibility.
5. Decide whether curated geography v1 should also generate default discussion surfaces for every geography node or only for selected flagship assemblies.
6. Update this audit chapter and the packet runtime modernization chapter when implementation changes close remaining transition notes.

## Acceptance Criteria For Reseed Start

Reseed implementation can start when:

- `npm run audit:final-pre-reseed-readiness` remains pass with zero blockers.
- The `parent_scope` cleanup path remains closed and fresh seed Elements contain no `parent_scope` header edges.
- The curated global v1 geography list keeps deterministic ID rules and inclusion criteria.
- Node identity and `Preference.node` seeding rules are explicit about secret storage boundaries.
- The reseed builder plan names which packet classes are seed inputs, generated children, and verification outputs.
