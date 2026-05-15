# Decision Log 2026-05

This monthly log condenses the May 2026 decisions that remain most important for current public-surface and documentation shape.

## 2026-05-01 public surface convergence

- Shared public actions and section shells now route through one surface contract.
- `PublicCardFrame` separates shared graphic treatment from page-owned content layout.
- Support and Docs now share the same public frame and panel system.
- Public card frames gained ambient generated backgrounds owned by the shared frame layer.
- About surfaces joined the shared public frame path without absorbing card-specific animation rules.
- Public sections now use the universal card animation path.
- Public theme cleanup centralized lingering route-local styling values into named public seams.

## 2026-05 chaptering follow-up

- Canon docs are being split into index files plus shallow chapter folders to reduce edit cost, preserve top-level link stability, and keep current truth, durable architecture, and roadmap work separated cleanly.

## 2026-05 docs workflow cleanup

- The multi-chapter internal docs now treat chapter files as the canonical content source, while the top-level files remain short local index shells only.
- Public docs generation for implementation guide, specifications, and roadmap now compiles from chapter files only instead of concatenating the top-level shell files into the public artifact.
- The docs build now validates chaptered manifest entries, missing or duplicate source files, generated-artifact misuse, and shell-file drift before producing readable or downloadable outputs.

## 2026-05 shell honesty foundation

- Nexus now uses a shell-level early-access gate as a session-scoped entry warning rather than leaving public-facing instability as unstated product lore.
- The gate is intentionally lightweight and UI-owned: it is not packet-backed, not actor-specific, and not yet a tutorial flow.
- The same shell seam should later be able to host onboarding, release notes, or other blocking notices without redesigning the overlay stack.

## 2026-05 feature-status explainers

- Disabled and partial Nexus controls now route through a centralized feature-status registry instead of scattering one-off placeholder copy through route files.
- The first-pass status taxonomy is intentionally small: `coming_soon`, `read_only`, `partial`, and `custom`, with registry-owned overrides when a control needs more specific wording.
- Nexus shell now hosts one explainer card overlay at a time so disabled controls can stay compact while still opening truthful contextual explanations above Explorer, Library, Votes, and future surfaces.
- The shared `NexusActionButton` seam remains semantically disabled for these controls, but can now open an explainer instead of acting like a dead button when a feature-status id is attached.

## 2026-05 Explorer and shell mobile cleanup

- `NexusInlineSelect` now renders its open menu on a true overlay layer instead of trusting local stacking order, so Explorer `View as` menus can sit above adjacent header controls.
- Packet Explorer tab decks now behave like normal wrapped rows until they exceed three rows, and only then become scrollable.
- Narrow-screen shell entry now prioritizes immediate access to the real menu rails by opening both rails when the tray is opened, instead of preserving collapsed desktop rail state inside the mobile tray.
- That same mobile tray now sizes itself to the currently visible rails and closes entirely when both rails are minimized.
- Library packet highlighting is now treated as Explorer-linked state rather than a permanently sticky URL-only cue, so stale selection clears when the corresponding Explorer packet tab disappears.
- Explorer resize now lives in a dedicated Explorer-specific desktop drag controller rather than the main overlay coordinator, and uses global window mouse tracking plus temporary drag capture instead of a moving `PanResponder` handle.
- Shared browser packet projections now route through the core packet-title projection path instead of falling back directly to raw packet ids, which keeps Explorer and other packet-inspection surfaces from flipping loaded titles into percent-encoded route strings.
- Explorer reading now uses one primary content scroll surface with local collapsible header bands, while `Close tabs` has moved out of the shell command row and into the packet-tab deck as a packet-management utility.
- Explorer collapse controls were then tightened so the bands do not reserve their own chevron rows: collapsed sections disappear fully, and their restore actions move into the top shell command row as `Packets` and `Views`.

## 2026-05 Packet Explorer export workbench

- Packet Explorer Home is now explicitly split into `Search` and `Export` sub-tabs so future Explorer capabilities can grow from one stable workspace without collapsing back into the main packet inspector.
- The first live portability seam is export only: `Search` stays present but non-live, while `Export` becomes the active raw-json workbench.
- Packet export defaults to `Raw packet`, which means the current preferred revision envelope only; bundle wrapping is an explicit opt-in instead of the default artifact shape.
- Bundle export remains additive and transport-oriented: the envelope now records export metadata such as mode, root refs, counts, title, and note without changing packet schemas or mutating the packet envelopes inside `packets`.
- Phase 1 bundle scopes stay concrete and bounded to current graph/scoping contracts: packet history, outgoing references, incoming referrers, scope-stack ancestry, their combined union, and full local-store export as a separate node-level snapshot tool.
- Preview and download now share one export builder seam with explicit size guardrails so Explorer can show inline JSON only for small payloads while still allowing larger `.json` bundle downloads without inventing a second export format.

## 2026-05 Packet Explorer import workbench

- Packet Explorer Home now expands to `Search`, `Import`, and `Export`, with Search-card import shortcuts routing into the new Import workspace rather than spawning separate packet-vs-bundle pages.
- Import is intentionally a two-step flow: `Analyze` first, then `Commit`, so pasted or uploaded JSON does not mutate the local store until the runtime preview says the payload is structurally safe.
- Phase 2 import stays generic and backward-tolerant by accepting raw packet envelopes, exported bundle envelopes with `packets`, legacy bundle envelopes with `revisions`, and raw arrays, all normalized onto the existing bundle-import substrate.
- Web import now includes a browser `.json` file picker, but paste remains the universal fallback so the workflow still works outside the browser without adding a cross-platform file abstraction in this pass.
- Import analysis is structural rather than trust-verifying: it reports invalid entries, duplicates, missing parent revisions, family conflicts, affected packets, and likely open targets, then blocks commit on unsafe inputs instead of offering partial-import toggles.
- Post-import repair now preserves local preferred-head intent when divergence appears: if a newly imported branch creates multiple heads and the old preferred head still exists, Explorer restores that preferred revision instead of silently replacing it with the last imported head.

## 2026-05 Packet Explorer live search and export lookup

- Packet Explorer `Search` is now a real manual discovery workspace instead of a placeholder card, and its state stays Home-owned so query text, grouped results, and the active category survive normal Explorer tab movement while the session stays open.
- Search intentionally stays preferred/current only in this pass: it reads from the shared packet search index rather than adding FTS, graph traversal search, or historical revision fanout into the main result set.
- Exact revision-id search is still supported through a separate revision resolver seam on the packet store, which lets Explorer map historical revision IDs back to the owning packet while keeping the displayed packet card anchored to the current preferred revision surface.
- Search results are grouped into `Direct`, `Name`, and `Text`, with deterministic ranking and lightweight `Open` / `Export` routing instead of turning the first live pass into a broader action hub.
- Export now includes a compact active lookup when no packet target is preloaded, but that lookup intentionally remains narrower than the full Search workspace so Explorer keeps one discovery-oriented search surface and one operational packet-picker.

## 2026-05 Packet Explorer workspace cleanup

- Home workspace navigation has now moved out of the Home body and into the shared inspector row, so `Search`, `Import`, and `Export` behave like first-class Explorer modes rather than nested content tabs.
- The packet primary rail and the Home workspace rail now share one compact attached-tab treatment, dropping the previous secondary tab copy so the inspector band can stay horizontally accessible without running off-screen.
- Home-only dead controls were removed instead of being left as placeholder chrome, and the Search workspace now keeps only its core manual finder actions rather than duplicating Import navigation through extra shortcut buttons.
- Packet export was re-centered around direct packet lookup when no target is preloaded, with the packet-picker promoted ahead of explanatory copy so the export workspace feels operational instead of instructional.
- Search now defensively tolerates a missing runtime revision resolver by falling back to the preferred/current packet index path instead of failing the whole search request.

## 2026-05 Packet Explorer final polish

- Link traversal in Explorer is now explicit instead of ambiguous: grouped links expose `Open in new tab`, `Open in current tab`, and `View in Library`, while current-tab retargeting preserves the existing inspector state and refreshes the active packet identity fields.
- Packet tab decks now present `Home` as the workspace tab label, use middle truncation for packet titles, and surface desktop hover metadata so long packet titles and revision context stay discoverable without widening the deck.
- Home Export now includes an explicit `Cancel` reset path for packet-scoped export so preloaded packet targets can be cleared without leaving the Export workspace or disturbing the separate full local store export surface.
- Search preview caps and category browsing are now separated: `All` remains an 8-result grouped preview surface, while focused `Direct`, `Name`, and `Text` views page through larger result sets with server-backed 25-item pages.

## 2026-05 Dynamic scope graph consumer pass 1

- Home locality is now relation-first in the mutation corridor: canonical writes use `home_locality.relation.set` and produce both `Relation(subtype: home_locality)` and a supporting `Claim(subtype: relation_assertion)`.
- Legacy `home_locality.claim.set`, legacy `Claim(home_locality)`, and legacy `parent_scope` ancestry remain readable only through named compatibility adapters and projections rather than through mixed main-path shell logic.
- Mounted scope projection now prefers packet-native structural relations such as `default_ancestry_parent` and `defined_by_location`, while also exposing richer packet-backed shell metadata for later UI graph and dashboard work.
- OWA home-locality legitimacy now evaluates through `Policy.relation_requirements` sourced from the forward `Cause(subtype: initiative)` anchor path instead of route-local hardcoding.

## 2026-05 Scope graph hardening and packet-native scope writers

- Scope ancestry resolution now explicitly surfaces structural graph state, including `compatibility_parent`, `conflicting_parents`, `cyclic_ancestry`, and `missing_parent`, instead of silently treating all non-canonical cases as equivalent.
- Follow is now canonical and actor-only: new writes use `follows.relation.set` / `follows.relation.clear`, while shell cookie follows remain a compatibility read bridge only.
- Assembly association is now relation-first in the mutation corridor: canonical writes use `assembly_association.relation.set` / `assembly_association.relation.clear`, keep the supporting self-claim layer, and mount associated scopes as related mounted scopes rather than leaving them as badge-only side state.
- The first packet-native shell UI pass keeps the current rail layout but now groups scope context into Home, Associated, Followed, and Discoverable sections, roots the home trunk at `You`, and routes follow/associate sidebar actions through the canonical mutation corridor with a refetched shell projection afterward.
- `locality.path.create` now emits locality `Element` packets, canonical `default_ancestry_parent` relations, provisional `Location(subtype: region)` packets, and `defined_by_location` relations in one signed packet batch, while `parent_scope` remains a named compatibility mirror only.

## 2026-05 shared packet-card actions and focus

- Dashboard preview lists and focused packet panels now share reusable packet action menus instead of route-local action clusters.
- Dashboard preview surfaces can focus one packet at a time locally, letting the focused presentation reuse the same packet action vocabulary without inventing a separate packet-detail route.
- Compact tooltip-capable icon badges are now part of the shared Nexus packet-card language instead of being dashboard-only decoration.

## 2026-05 sidebar follow-up polish

- The Home scope trunk now renders broadest-to-smallest, with `You` at the personal end rather than as the visual root.
- Sidebar rows no longer depend on inline badge clutter or left-side tree graphics for their primary meaning.
- Compact side overflow menus are now the active scope-row action pattern, with section placement carrying most of the relationship signal.

## 2026-05 Explorer truth clarification

- Packet Explorer Search, Import, and Export are live and should be treated as current product truth.
- Explorer remains read-only for packet mutation.
- Verification is now live for local packet validation, import reporting, and Explorer verification surfaces, while richer peer trust, provenance weighting, and broader report semantics remain later seams.

## 2026-05 verification chapter 1

- `Report` is now a real packet family in code, with `verification_report` and `import_report` as the first live subtypes.
- The local runtime now bootstraps a normal signed validator identity and uses it to sign packet verification and import reports instead of introducing a privileged core-signature bypass.
- Packet Explorer now has a dedicated `Verification` rail, while dashboard and shared packet action menus can `Validate`, `Revalidate`, and `View verification`.
- Import now supports `Validate first`, `Validate after`, and `Don't validate`, with validation reports and packet-level verification summaries recorded through runtime services and cached locally for truthful UI projection.

## 2026-05 verification hardening and bundle direction lock-in

- Packet-signature verification now accepts a narrow explicit set of identity-bearing signer packets, including `Element(kind: person)` and `Element(kind: service)`, so the local validator stays a real service identity instead of a fake person-only compatibility hack.
- Verification summaries are now revision-anchored: local cache rows record the exact target revision and digest they verified, and current verified state only applies while that preferred revision still matches.
- Unknown signer status is now intentionally truthful: a packet can remain signed while still being `unverifiable` on the local node when the signer packet is unavailable, instead of being mislabeled as cryptographically valid.
- Explorer Import now exposes recent `import_report` history and richer artifact metadata through the existing report packet family rather than introducing an interim import-history packet family.
- The future bundle direction is now locked in at the roadmap level: `Bundle` will become a first-class packet family later, rebundling will create a new bundle packet rather than revising someone else’s bundle, bundle history should behave as a lineage graph, and legacy bundle JSON remains a runtime transport artifact rather than a core packet-compatibility family.

## 2026-05 verification tidy polish

- Explorer verification now surfaces freshness explicitly: the current preferred revision, the revision targeted by the latest local report, and whether that report is current, stale, or absent.
- Import History now speaks honestly about its current model: it shows the latest local import report per artifact identity rather than pretending to be a full append-only event ledger.
- The next major implementation chapter remains locality UX and geo standardization; a dedicated validation workflow screen and first-class `Bundle` packets stay intentionally deferred for later work.

## 2026-05 locality UX pass 1

- `/nexus/locality/create` now has a true non-mutating `Review path` seam instead of pretending the write corridor itself is the review step.
- Top-level locality search now activates the existing `create_candidate` handoff so missing places can seed the broad-to-narrow builder directly, including from the Enter key path.
- Duplicate warnings in locality review are now actionable through `Use existing`, `Edit name`, and `Create anyway` rather than appearing only as passive blocker text.
- `Use as home locality` is now an explicit shared toggle for both selecting existing localities and creating new ones.
- The home-branch inclusion checklist is now visible during review as a UI-only preview affordance, while authoritative storage and projection of selected included scopes remains deferred to a later locality pass.

## 2026-05 locality foundations phase 2A

- Locality planner semantics are now ordered-path first: the runtime interprets locality preview and create input as a broad-to-narrow path, and sparse paths no longer need to fill every legacy ladder slot.
- The current locality type picker is now real runtime input instead of decoration: path rows can carry `LocalityScopeDescriptor` data, with safe fallback descriptors derived from current legacy buckets when callers omit them during rollout.
- New locality writes now persist descriptor metadata inside linked `Location.spatial_payload.scope_descriptor`, while legacy `nation | region | city | district` values remain compatibility buckets rather than the forward locality ontology.
- Locality search and duplicate projection now preserve Unicode scripts, normalize accents safely for matching, and keep useful legacy ASCII-style aliases where that compatibility bridge is feasible.
- Home-tree inclusion persistence and projection fields remain intentionally deferred to the next locality foundations pass rather than being bundled into descriptor and ancestry work.

## 2026-05 locality hardening pass 2A.5

- Locality preview and create now reject decreasing legacy compatibility bucket order such as `city -> nation`, while still treating ordered path ancestry rather than the ladder itself as the real graph truth.
- Descriptor reads now validate `hierarchy_system` against the allowed runtime enum so malformed imported `Location` metadata falls back safely instead of being trusted as-is.
- Top-level locality search can now still route into creation when same-name results exist in a different branch, preventing one existing `Ontario` from suppressing a new `Ontario` under another parent path.
- The create page now clears stale carried-over target rows more carefully when the target type changes across legacy buckets, and successful create/reuse completion resets the create builder before the success modal appears.
- Trust home-locality presentation has been tightened into a smaller onboarding-friendly card without changing the underlying home-locality actions or relation-first write path.

## 2026-05 locality runtime catch-up chapter

- Locality confirmation now routes through one composite `locality.graph.apply` mutation intent above `locality.path.create`, so structural locality writes, selected home-locality changes, scope associations, follows, and temporary scope-display preferences are coordinated together instead of being chained from the client.
- Partial success is now explicit at that runtime seam: structural locality planning and packet writes remain phase one, while relation and temporary preference writes report their own outcomes without pretending the whole flow is all-or-nothing.
- Actor-to-scope relationship reads are now centralized through one runtime controller that treats canonical `home_locality`, `assembly_association`, and `follows` relations as the main truth, while preserving guest and compatibility follow behavior as an explicit fallback bridge.
- `main` is now a runtime-owned temporary visible-scope preference for claimed actors rather than a relation, and associated/followed parent-context display toggles are now persisted alongside it until the upcoming schema chapter packetizes preferences properly.
- The generic scope-graph projection now returns server-projected `home`, `associated`, `followed`, `main`, and `discoverable` sections for the sidebar, and OWA-specific initiative-anchor relation-policy lookup has been moved out of the generic graph core into a narrower adapter layer.
