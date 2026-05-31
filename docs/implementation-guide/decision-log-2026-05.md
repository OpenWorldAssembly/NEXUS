# Decision Log 2026-05

## 2026-05-19 initiative action and discussion schema readiness

- Pre-reseed initiative semantics now point to `Action(subtype: initiative)` as the forward top-level initiative/work hierarchy above campaign, program, mission, and provisional task semantics.
- `Action(subtype: initiative)` is the fresh-reseed initiative/default anchor; `Cause` is pruned from active canon.
- Canonical discussions now reserve `Discussion(subtype: post)` for top-level forum artifacts that start threads, while reply chains use `Discussion(subtype: message)`.
- Governance schema hooks remain policy-backed: quorum, minimum trust, voting gates, and decision-report closure semantics should be expressed through linked Policy/default material, `Decision`, and `Report(subtype: decision_report)`.

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

## 2026-05 scoped Nexus loading foundation

- Nexus loading now has a UI-owned provider, boundary, overlay, and hook for caller-selected visual scopes.
- The loading layer intentionally ignores packet type, action registry identity, mutation intent, and runtime operation categories; UI boundaries decide what visual area is busy.
- A scope becomes active immediately to block duplicate input, while the visual overlay is delayed and minimum-duration guarded to avoid spinner flicker.
- Shared buttons and action-menu items can now opt into scoped loading with caller-supplied scope strings, while packet action registries and runtime operations remain loading-agnostic.

## 2026-05 Nexus UI folder foundation

- Nexus UI consolidation began with safe shared-module moves only: loading moved under `ui/feedback/loading`, action cards under `ui/cards/action-card`, action lists under `ui/actions/action-list`, and shared tab primitives under `ui/tabs`.
- The move establishes the canonical `app/components/nexus/ui/*` home without splitting `nexus-ui.tsx`, changing visuals, or moving feature-specific Explorer, locality, discussion, dashboard, preview, or focus components.

## 2026-05 Nexus overlay consolidation start

- Nexus overlay consolidation began with reusable modal chrome under `app/components/nexus/ui/overlays/*`, including a modal shell plus outcome, confirmation, and popover primitives.
- Dashboard packet validation, packet Explorer import outcomes, and locality create/reuse/picker dialogs now share the same modal shell while preserving their existing visual classes, close behavior, and route-local content.
- Auth/session gates and feature-status overlays remain specialized for later migration so generic overlay UI does not absorb session or shell behavior.

## 2026-05 Nexus search UI consolidation start

- Nexus search presentation now has shared primitives under `app/components/nexus/ui/forms/search/*` for search fields, result lists, result rows, status text, empty/error states, and loading-aware result boundaries.
- The consolidation is UI-only: Packet Explorer, identity, and locality create keep their own debounce timing, API calls, ranking, filtering, selection, and create-candidate behavior.
- Search loading scopes attach to the visual result surface, such as a dropdown or dedicated results panel, instead of packet types, route names, or search engine semantics.

## 2026-05 Nexus forms and feedback alignment start

- Nexus forms now have shared field shell, text input, text area, and field action-row primitives under `app/components/nexus/ui/forms/*`.
- Nexus feedback now has shared inline loading plus empty, error, warning, status, and operation-card primitives under `app/components/nexus/ui/feedback/*`.
- Identity fields, Packet Explorer import/export fields, trust association notes, and roles support comments began migrating to those primitives while preserving existing route behavior and keeping scoped loading caller-owned.

## 2026-05 Nexus layout and panel foundation start

- Nexus layout now has shared page/scroll frames, panel/workbench wrappers, panel headers, section bands, toolbar rows, and metric grids under `app/components/nexus/ui/layout/*`.
- Identity page chrome, dashboard/trust/roles metric rows, and a Packet Explorer search workbench panel began adopting these wrappers while preserving current visuals.
- Panel loading remains caller-owned by visual scope; layout components only provide a clean boundary mount point.

## 2026-05 Nexus UI primitive split

- The broad `app/components/nexus/nexus-ui.tsx` primitive file is now a compatibility bridge over focused `app/components/nexus/ui/*` component-type modules.
- Cards, actions, badges, forms, layout/chrome helpers, and attached tab rails now have canonical family homes while preserving their existing classes and behavior.
- Nexus callers have moved to the canonical `@app/components/nexus/ui` import path; future work should not add new primitive imports from `nexus-ui.tsx`.

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
- Import analysis is structural rather than trust-verifying: it reports invalid entries, duplicates, missing parent revisions, type conflicts, affected packets, and likely open targets, then blocks commit on unsafe inputs instead of offering partial-import toggles.
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

- Home locality is now relation-first in the mutation corridor: canonical writes use `relation.residence.add` and produce `Relation(subtype: residence)` without automatically minting supporting claims.
- Legacy `residence.claim.set`, legacy `Claim(residence)`, and legacy `parent_scope` ancestry remain readable only through named compatibility adapters and projections rather than through mixed main-path shell logic.
- Mounted scope projection now prefers packet-native structural relations such as `default_ancestry_parent` and `defined_by_location`, while also exposing richer packet-backed shell metadata for later UI graph and dashboard work.
- OWA home-locality projection now resolves from packet-native relations sourced through the forward `Action(subtype: initiative)` anchor path; relation requirements remain available for stricter policies but are not the default fresh-write wrapper.

## 2026-05 Scope graph hardening and packet-native scope writers

- Scope ancestry resolution now explicitly surfaces structural graph state, including `compatibility_parent`, `conflicting_parents`, `cyclic_ancestry`, and `missing_parent`, instead of silently treating all non-canonical cases as equivalent.
- Follow is now canonical and actor-only: new writes use `relation.follow.add` / `relation.follow.clear`, while shell cookie follow remain a compatibility read bridge only.
- Association is now relation-first in the mutation corridor: canonical writes use `relation.association.add` / `relation.association.clear`, keep the supporting self-claim layer, and mount associated scopes as related mounted scopes rather than leaving them as badge-only side state.
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

- `Report` is now a real packet type in code, with `verification_report` and `import_report` as the first live subtypes.
- The local runtime now bootstraps a normal signed validator identity and uses it to sign packet verification and import reports instead of introducing a privileged core-signature bypass.
- Packet Explorer now has a dedicated `Verification` rail, while dashboard and shared packet action menus can `Validate`, `Revalidate`, and `View verification`.
- Import now supports `Validate first`, `Validate after`, and `Don't validate`, with validation reports and packet-level verification summaries recorded through runtime services and cached locally for truthful UI projection.

## 2026-05 verification hardening and bundle direction lock-in

- Packet-signature verification now accepts a narrow explicit set of identity-bearing signer packets, including `Element(kind: person)` and `Element(kind: service)`, so the local validator stays a real service identity instead of a fake person-only compatibility hack.
- Verification summaries are now revision-anchored: local cache rows record the exact target revision and digest they verified, and current verified state only applies while that preferred revision still matches.
- Unknown signer status is now intentionally truthful: a packet can remain signed while still being `unverifiable` on the local node when the signer packet is unavailable, instead of being mislabeled as cryptographically valid.
- Explorer Import now exposes recent `import_report` history and richer artifact metadata through the existing report packet type rather than introducing an interim import-history packet type.
- The future bundle direction is now locked in at the roadmap level: `Bundle` will become a first-class packet type later, rebundling will create a new bundle packet rather than revising someone else’s bundle, bundle history should behave as a lineage graph, and legacy bundle JSON remains a runtime transport artifact rather than a core packet-compatibility type.

## 2026-05 verification tidy polish

- Explorer verification now surfaces freshness explicitly: the current preferred revision, the revision targeted by the latest local report, and whether that report is current, stale, or absent.
- Import History now speaks honestly about its current model: it shows the latest local import report per artifact identity rather than pretending to be a full append-only event ledger.
- The next major implementation chapter remains locality UX and geo standardization; a dedicated validation workflow screen and first-class `Bundle` packets stay intentionally unsupported for later work.

## 2026-05 locality UX pass 1

- `/nexus/locality/create` now has a true non-mutating `Review path` seam instead of pretending the write corridor itself is the review step.
- Top-level locality search now activates the existing `create_candidate` handoff so missing places can seed the broad-to-narrow builder directly, including from the Enter key path.
- Duplicate warnings in locality review are now actionable through `Use existing`, `Edit name`, and `Create anyway` rather than appearing only as passive blocker text.
- `Use as home locality` is now an explicit shared toggle for both selecting existing localities and creating new ones.
- The home-branch inclusion checklist is now visible during review as a UI-only preview affordance, while authoritative storage and projection of selected included scopes remains unsupported to a later locality pass.

## 2026-05 locality foundations phase 2A

- Locality planner semantics are now ordered-path first: the runtime interprets locality preview and create input as a broad-to-narrow path, and sparse paths no longer need to fill every legacy ladder slot.
- The current locality type picker is now real runtime input instead of decoration: path rows can carry `LocalityScopeDescriptor` data, with safe fallback descriptors derived from current legacy buckets when callers omit them during rollout.
- New locality writes now persist descriptor metadata inside linked `Location.spatial_payload.scope_descriptor`, while legacy `nation | region | city | district` values remain compatibility buckets rather than the forward locality ontology.
- Locality search and duplicate projection now preserve Unicode scripts, normalize accents safely for matching, and keep useful legacy ASCII-style aliases where that compatibility bridge is feasible.
- Home-tree inclusion persistence and projection fields remain intentionally unsupported to the next locality foundations pass rather than being bundled into descriptor and ancestry work.

## 2026-05 locality hardening pass 2A.5

- Locality preview and create now reject decreasing legacy compatibility bucket order such as `city -> nation`, while still treating ordered path ancestry rather than the ladder itself as the real graph truth.
- Descriptor reads now validate `hierarchy_system` against the allowed runtime enum so malformed imported `Location` metadata falls back safely instead of being trusted as-is.
- Top-level locality search can now still route into creation when same-name results exist in a different branch, preventing one existing `Ontario` from suppressing a new `Ontario` under another parent path.
- The create page now clears stale carried-over target rows more carefully when the target type changes across legacy buckets, and successful create/reuse completion resets the create builder before the success modal appears.
- Trust home-locality presentation has been tightened into a smaller onboarding-friendly card without changing the underlying home-locality actions or relation-first write path.

## 2026-05 locality runtime catch-up chapter

- Locality confirmation now routes through one composite `locality.graph.apply` mutation intent above `locality.path.create`, so structural locality writes, selected home-locality changes, scope associations, follow, and display preferences are coordinated together instead of being chained from the client.
- Partial success is now explicit at that runtime seam: structural locality planning and packet writes remain phase one, while relation and display-preference writes report their own outcomes without pretending the whole flow is all-or-nothing.
- Actor-to-scope relationship reads are now centralized through one runtime controller that treats canonical `residence`, `association`, and `follow` relations as the main truth, while preserving guest and compatibility follow behavior as an explicit fallback bridge.
- `main` is a visible-scope preference rather than a relation, and associated/followed parent-context display toggles are persisted alongside it through the current claimed-actor preference bridge.
- The generic scope-graph projection now returns server-projected `home`, `associated`, `followed`, `main`, and `discoverable` sections for the sidebar, and OWA-specific initiative-anchor relation-policy lookup has been moved out of the generic graph core into a narrower adapter layer.


## 2026-05 Preference.element packet write corridor

- `Preference` is now enrolled in the canonical packet ontology as a replaceable packet type, with `Preference.element` carrying actor-owned scope-display preferences.
- Claimed actor scope-display writes now create live `Preference.element` packet revisions and also update the legacy runtime preference table as a compatibility cache.
- Scope-display reads prefer the latest active `Preference.element` packet and fall back to the legacy table when no packet exists; guest preferences remain cookie/session compatibility state.
- Claimed shell preference reads now resolve the actor from the authenticated session; actor query mismatches use guest projection instead of reading another actor's private preference packet.
- `Preference.element` now includes an `interface.shell_chrome` section for navigation mode, theme mode, and UI density so remaining shell-interface preferences can move into the same body without redefining the packet shape.
- `runtime/nexus/server/packet-runtime-master-handler.ts` is the first generic runtime connector corridor: routes can request a connector id, the handler resolves the packet definition and mutation action plan, then dispatches to local trusted connector code instead of hardcoding route-specific packet writes.
- `preference.element.interface.set` was initially enrolled in that master handler as a live bridge. It wrote `Preference.element.value.interface.scope_display`, could preserve or update `interface.shell_chrome`, and kept the legacy scope-display table as a compatibility cache. The later Dispatch promotion pass moves claimed writes to `preference.element.set` and keeps this connector runtime-ready.
- The manifest definition Dispatch metadata bridge remains non-executing and descriptor-only. The new runtime master handler still runs trusted local connector code; it does not execute arbitrary behavior from imported definitions.

## 2026-05 policy/dependency semantic authority

- `Policy` current schema now includes nullable `default_policy` and `governance_policy` sections so default inheritance and governance readiness are packet-backed before reseed design.
- Dependency refs in Definition parts and workflow plans now resolve through packet dependency semantics, Policy semantics, operation ontology entries, trusted workflow resolvers, or explicit local engine contracts instead of loose runtime-only strings.
- The seeded OWA `Action(subtype: initiative)` is now the policy/default anchor and links to default-inheritance and governance-baseline policies.

## 2026-05-20: Canonical subtype reset before reseed

- Active packet canon is pruned to Definition, Bundle, Element, Location, Role, Claim, Relation, Report, Proposal, Reaction, Decision, Action, Discussion, Policy, and Preference.
- `Cause`, split discussion types, split initiative/work types, `Signal`, `Minutes`, `Artifact`, and other unused alpha types are removed from fresh packet canon.
- Fresh active packet bodies use top-level `body.subtype` as the packet classifier. Old top-level classifier names are treated as alpha archive shapes, not fresh write compatibility obligations.
- Reseed continuity will preserve identity/key continuity by default; stale packet-id relations, home locality, follow, associations, main-tree scope IDs, and old discussion placement are not carried forward by default.

## 2026-05 final pre-reseed wrap-up

- Live fresh writes no longer accept `association.claim.set` or `residence.claim.set`; canonical association and home-locality writes now use relation-first mutation intents only.
- Legacy claim/home-locality material remains compatibility-readable and importable, but it is no longer a live mutation corridor entrypoint.
- A final pre-reseed readiness report now inventories canonical write intents, compatibility-only surfaces, OWA default anchors, required seed policies, discussion defaults, canonical definition packet types, and out-of-scope packet types for the separate reseed design pass.

## 2026-05 definition packetization and Preference Dispatch promotion

- Active manifest definition parts now produce schema-validated canonical `Definition` packet envelopes, and those envelopes are grouped into one canonical `Bundle.packet_set` definition profile inventory for reseed readiness.
- The seeded definition profile audit compares packet material back to the core manifest and fails closed on missing parts, unexpected parts, stale profile metadata, duplicate bundle refs, or digest drift.
- Stored Definition and Bundle packet material is now reseed truth material, but execution remains trusted-local; imported definition packets may describe schemas, operations, policies, dependencies, planners, and builders, but they cannot introduce server code.
- `Definition`, `Bundle`, and `Preference` are now canonical packet types with body schemas, compatibility entries, builder support, pipeline inventory coverage, and packet-store validation like other active packet types.
- Claimed shell preference writes now run through the standard signed mutation prepare/finalize corridor as `preference.element.set`, preserving projected responses, actor proof/session checks, same-value no-op behavior, and legacy cache sync. `/api/nexus/shell-preferences` remains guest compatibility state only.
- The direct `preference.element.interface.set` runtime connector is retained as a definition/internal comparison bridge rather than the live claimed-write corridor.


## 2026-05 definition kernel and stored profile decision

- Nexus will hardcode only the Definition packet kernel needed to cold-start, validate, and compose definition material. This kernel includes the Definition body schema, supported Definition part subtypes, and the bootstrap resolver for turning Definition parts into a local active definition view.
- Long-term packet type authority should live as stored `Definition` packets, not TypeScript-only descriptors. TypeScript packet definitions remain bootstrap/compiler seed material, local fallback material, and test fixtures until active Definition profiles can be resolved from packet storage.
- A packet type definition is a profile assembled from Definition part packets, not one monolithic object. Schema, actions, builders, planners, projections, compatibility, defaults, and dependencies may version or fork as separate Definition parts and travel together in a `Bundle.packet_set` profile inventory.
- Nodes/scopes will eventually select their active definition profile through packet-backed defaults, preferences, and policies. The current Trusted Definition Coordinator already models source kinds, trust tiers, pins/preferences, ranking, compatibility-only candidates, quarantine, and ignored candidates, but archive-backed profile loading remains a future migration seam.
- Imported Definition packets remain descriptive only. They can declare schemas, actions, builders, planners, projections, defaults, policies/dependencies, and compatibility metadata, but execution must stay inside trusted local runtime capabilities and allowlisted coordinators.

## 2026-05 Nexus discussions UI decomposition

- Nexus discussions began moving route-local UI into `app/components/nexus/features/discussions/*` while preserving `src/app/nexus/discussions.tsx` as the route/controller owner for query state, loading, mutations, auth gates, and reply branch state.
- Extracted discussion feature components now cover feed post cards, root post cards, vote/reply-count pills, recursive reply trees, and post/reply composers.
- Discussion loading adoption remains visual-scope owned: feed load-more, root replies, reply branches, vote pills, and composers can mount scoped loading boundaries without packet-action registry or runtime coupling.
- Candidate universal pieces such as composer shells, vote/reaction skeletons, and tree rails remain feature-local until another Nexus surface proves the same reusable shape.

## 2026-05 Nexus discussions workspace panel extraction

- Discussion feed, thread, and post workspace sections now have feature-local panels under `app/components/nexus/features/discussions/*`, including a thread toolbar, while the route keeps router, auth, loading, mutation, and reply-state ownership.
- The panel props are explicit callbacks and display state rather than runtime services or router hooks, keeping the feature components ready for later generic promotion if another surface needs the same workspace/feed/thread/composer skeletons.
- Scoped loading boundaries remain attached to visual regions such as feed, root replies, reply branches, votes, and composers; operation semantics still stay outside UI.

## 2026-05 Nexus sidebar feature extraction

- Nexus sidebar rail/menu UI began moving into `app/components/nexus/features/sidebar/*` while `nexus-sidebar.tsx` remains the shell controller for router, auth, preference persistence, rail animation, and scope mutation state.
- Extracted sidebar feature components now cover rail toggles, guest avatar, preference switches, current context card, function menu content, scope section headers, grouped scope rows, scope action menus, and scope menu content.
- Scope follow, association, and main-tree visibility actions now use caller-owned loading scopes such as `sidebar:scope-follow:<scopeId>` and block the affected scope row/menu region without coupling loading to packet/runtime semantics.
- Candidate universal pieces such as rail toggles, compact nav rows, preference switches, grouped sections, scope/action rows, and anchored compact menus remain feature-local until another Nexus surface proves the same reusable shape.

## 2026-05 Nexus locality create UI decomposition

- Nexus locality create UI began moving into `app/components/nexus/features/locality/*` while `src/app/nexus/locality/create.tsx` remains the controller for params, auth gates, draft persistence, graph/path state, API calls, mutation handlers, and modal state.
- Extracted locality feature components now cover the search panel, builder panel, parent/type/create-kind dialogs, selected-result and remove confirmation dialogs, outcome dialogs, graph rows, and preview panel.
- Locality loading remains visual-scope owned: search results, parent picker results, graph row results, preview, create-path, and set-home actions use caller-owned loading scopes without coupling UI to packet/runtime semantics.
- The obsolete level-row ladder builder path was removed after extraction; the active create flow is the graph-based builder, with route/controller ownership preserved.

## 2026-05 Nexus Explorer feature extraction

- Packet Explorer moved into `app/components/nexus/features/explorer/*`, including its shell overlay, document tabs, toolbar, search, import/export, data, links, resize, and inspection panels.
- Explorer import/export work now uses caller-owned visual loading scopes for packet export, store export, import analysis, import commit, and import history, while preserving existing disabled labels and panel behavior.
- Explorer document tabs remain feature-local and compose shared tab primitives only where they already did; generic document-tab promotion is deferred until a dedicated tab-extension pass.

## 2026-05 Nexus Explorer internal decomposition

- Explorer import cards, export preview/request helpers, packet inspection panels, and the validation dialog were split into focused feature-local files under `app/components/nexus/features/explorer/*`.
- Packet validation now has a caller-owned visual loading scope, `packet-explorer:validation:<packetId>`, mounted around the validation panel without coupling loading to packet/runtime semantics.
- The main Explorer shell still owns tabs, search state, packet loading, validation handlers, resize behavior, router calls, and session coordination; generic promotion remains deferred until repeated component types appear elsewhere.

## 2026-05 Nexus primitive adoption checkpoint

- Nexus entered a primitive-adoption checkpoint phase after the main `ui/*` foundations and feature extractions, classifying remaining raw React Native usage as official primitive internals, acceptable feature-local controls, route/controller usage to migrate, or behavior-sensitive deferred usage.
- The first low-risk cleanup converted only trivial outer route scroll shells in account, dashboard, discussions, roles, trust, and votes to `NexusScrollFrame`; scroll containers with refs, handlers, bounded modal regions, graph focus, Explorer resize/session behavior, or sidebar shell animation remain local.
- Stale `@app/components/nexus/nexus-ui` imports are treated as retired outside the compatibility bridge. Loading adoption remains visual-scope owned, with future route adoption limited to places where the async owner and blocked visual boundary are obvious.

## 2026-05 Nexus UI pre-audit wrap-up

- Identity route UI helpers moved into `app/components/nexus/features/identity/*`, completing the main feature-folder map alongside discussions, Explorer, locality, and sidebar.
- `app/components/nexus/nexus-identity-ui.tsx` remains a temporary bridge only; identity routes now import from the feature folder while keeping router, auth/session, passkey, storage, mutation, and error behavior route-owned.
- The wrap-up stayed organizational and audit-oriented: deeper trust/roles extraction, sidebar second split, dashboard/library/account/votes polish, and interface event coordination work remain post-audit follow-ups.

## 2026-05 Interface Event Coordinator and Trusted Dispatch foundation

- The client-side Interface Signal Conductor direction was renamed to Interface Event Coordinator, reflecting its role as the master interface event lifecycle controller rather than a trusted runtime actor.
- Trusted Dispatch Coordinator is now the canonical runtime front desk name for request normalization and client-intent preflight; the existing Trusted Request Coordinator remains as the compatibility implementation bridge.
- Mutation prepare now passes through dispatch normalization and fail-closed client-intent preflight before the existing Dispatch corridor continues. Mutation finalize records dispatch normalization while preserving ticket-based finalize preflight and signed payload schemas.

## 2026-05 Trusted runtime coordinator audit and caller migration

- The trusted coordinator scaffold audit now checks canonical result kinds, top-level barrel exports, and public method drift; Resolution remains the only accepted legacy-flat coordinator warning.
- Definition, Regulation, and Planning result envelopes now use their canonical coordinator kinds, with older aliases retained only for legacy workflow paths.
- Packet Explorer bundle export and import commit now route through Trusted Exchange and Trusted Archive while preserving existing Explorer payloads, import reports, validation modes, and preferred-head repair.
- The verification service is now a compatibility wrapper over Trusted Verification for packet assessment, while local validator identity and report-writing stay service-owned until a later Certification/Archive migration.

## 2026-05 Trusted process chains and issue taxonomy

- Trusted coordinator results now support optional lightweight process chains that record stage-by-stage runtime diagnostics without automatically creating report packets.
- The trusted issue taxonomy uses canonical dotted codes while mapping older underscore codes as aliases, giving reports and future interface handling stable error categories.
- Archive and Exchange are the first deeper adopters: Archive records partial write progress, failed/skipped work, and preserved partial results; Exchange chains preview/plan/commit/export stages and child Archive results.
- Report packet persistence is intentionally deferred. V1 only provides a process report draft helper so later Certification/Archive/report flows can choose when to sign and store diagnostics.

## 2026-05 Runtime cleanup bounded-context foundation

- Runtime cleanup began after the major trusted coordinator seams stabilized, with `runtime/nexus/server/*` moving toward bounded-context folders instead of one flat service directory.
- Identity, discussion, reaction, locality, scope, Packet Explorer, readiness, and shared helper modules now have canonical homes with top-level compatibility bridges preserved for existing callers.
- Dispatch mutation flow owns the reserved bounded-context home; signed corridor helpers should stay behavior-preserving and ticket/signing paths easy to verify.
- The rule for this chapter is move-first and split-later: large services keep behavior intact now, then decompose by responsibility inside their bounded-context folders in later passes.

## 2026-05 Runtime responsibility and ideal ownership audit

- Runtime cleanup shifted from folder organization to ideal ownership analysis, classifying runtime processes by whether they belong to Trusted Coordinators, packet-definition metadata, Projection, storage adapters, OWA adapters, compatibility bridges, or the legacy signed corridor.
- Discussion, reaction, locality, and scope runtime services are treated as transitional product/runtime adapters rather than final generic architecture.
- Signed-corridor naming is now explicitly legacy signed-corridor language; new work should use Dispatch, Regulation, Planning, Certification, Archive, and Interface Event Coordinator ownership terms where possible.
- The audit records packet-definition opportunities for projection fields, action availability, policy requirements, build/default/dependency assumptions, and import/export/verification summaries without allowing imported packet definitions to execute local runtime behavior.

## 2026-05 Dispatch-owned write pipeline correction

- The mistaken Trusted Write coordinator direction was rejected: write lifecycle orchestration belongs to Dispatch, not a new peer coordinator.
- `/api/nexus/mutations/prepare` and `/api/nexus/mutations/finalize` now call Dispatch-owned write lifecycle methods and do not call `NexusMutationService` as route-facing authority.
- `relation.follow.add` is the first live write to complete the corrected Dispatch-owned chain: Planning, Building, Inspection, Certification ticketing, signed-packet bundle certification, Verification, and Archive storage.
- `relation.association.add` now uses the same full Dispatch-owned chain, with generic scoped Relation materialization and finalize-time mutation-kind parity checks.
- Other mutation intents remain coordinator capability gaps until they receive equivalent packet-envelope materialization, Certification signed-bundle checks, Verification handoff, Archive storage, and result projection. They must not fall back to the legacy signed corridor.

## 2026-05 Trusted runtime audit guardrail housekeeping

- Added package-level trusted coordinator test scripts: `test:trusted-coordinators` for the runtime coordinator tests and `check:trusted-coordinators` for audit plus tests.
- Hardened the trusted coordinator audit to catch unmanifested `trusted_*_coordinator` folders, missing trusted test scripts, manifest/barrel/method/result-kind drift, and unregistered trusted issue codes.
- Runtime crossing notes now recursively scan real implementation folders under `runtime/nexus/server/*` and `src/app/api/nexus/*` instead of only top-level compatibility bridge files. Direct storage touches, signature verification, packet interpretation, bundle import/export, API packet parsing, and legacy Dispatch corridor references remain non-failing migration notes.
- Removed the empty `trusted_write_coordinator` remnant. Writes remain Dispatch-owned lifecycle orchestration, not a separate coordinator.
- Corrected the Exchange manifest note: Exchange can orchestrate accepted import commits through Archive, but Archive remains the storage owner and Exchange should not bypass Compatibility or Verification ownership.


## 2026-05 Trusted Exchange import commit hardening

- Exchange import preview now normalizes JSON string inputs and archive byte payloads into a consistent packet bundle before asking Verification and Compatibility for posture.
- Exchange import commit now narrows Archive writes to accepted plan entries only; skipped duplicates and blocked/manual entries are no longer passed through to Archive as part of the commit bundle.
- Verification and compatibility risk acknowledgements are explicit commit inputs. Packet Explorer currently treats an approved commit from its preview flow as acknowledgement so existing UI behavior is preserved.
- Exchange commit receipts now expose planned, archived, skipped, imported, missing, and unexpected revision-key counts/lists so Archive import results can be compared against the Exchange plan.
- The trusted issue taxonomy gained Exchange archive-import mismatch/failure aliases so coordinator audits fail if future code invents unregistered runtime issue codes.

## 2026-05 Dispatch finalize certification/verification hardening

- `/api/nexus/mutations/finalize` now passes submitted signed packet material through to Dispatch without route-level packet-envelope parsing, preserving the raw signed material for Trusted Verification.
- Certification accepts the signed bundle shape, parses internally for ticket/digest/type/signer matching, rejects duplicate packet revision keys, and records the exact certified packet revision keys on the certified packet set.
- Dispatch now verifies the raw signed packets through Trusted Verification, compares verified packet revision keys against Certification before Archive, derives the finalized mutation kind from the certified plan, and rejects mismatched caller-supplied intent labels.
- Archive now requires certified packet revision keys and checks that extracted archive-ready envelopes match those keys before any write, so Archive stores only the certified packet set.
- The trusted issue taxonomy gained canonical entries for certified-key and finalize mismatch blockers so audit remains fail-closed for invented issue codes.


## 2026-05 Dispatch reaction vote write migration

- `reaction.vote.set` now enters the Dispatch-owned write lifecycle with Reaction packet planning hints, body materialization metadata, generic Reaction packet envelope building, Inspection, Certification, Verification, and Archive storage.
- Dispatch derives `reaction.vote.set` from both workflow-backed and trusted operation plan IDs so finalize-time mutation-kind parity checks cover reaction writes like relation writes.
- Finalize response decoration refreshes the existing reaction derived index/summary after Archive for parity with the current discussion UI, but that bridge now lives in the reaction runtime adapter instead of Trusted Dispatch. This is still not the final Projection-owned read-model architecture.
- Inspection now ignores reserved `__trusted_*` materialization metadata keys when comparing planned body values to the candidate body, allowing Dispatch/Building to carry header materialization inputs without polluting packet bodies.
- The runtime cleanup tab now records reaction vote migration as completed for the legacy signed-corridor checklist while keeping remaining mutation intents open.

## 2026-05 Legacy mutation service containment and reaction finalize adapter

- `NexusMutationService` is no longer constructed by `createNexusPacketServiceRegistry` or exposed on `NexusPacketServices`; the remaining mutation/signed-corridor files are legacy corridor candidates rather than live service-graph dependencies.
- Trusted Dispatch now returns generic trusted finalize facts for `reaction.vote.set` instead of importing `SQLiteReactionService` or refreshing reaction-derived state directly.
- The finalize API route decorates completed `reaction.vote.set` responses through `reaction-finalize-response-adapter`, preserving the current target/value/summary response compatibility while keeping reaction runtime services outside the trusted coordinator.
- The trusted coordinator audit now fails if the live service registry reintroduces `NexusMutationService`, if prepare/finalize routes call legacy mutation service methods, or if Trusted Dispatch imports reaction runtime services.

## 2026-05 Packet Explorer projection migration pass

- Packet Explorer's generic inspector payload now uses Trusted Archive for preferred/head revision resolution and graph edge lookup instead of direct packet-store/query-service calls.
- The inspector read-model panel now uses Trusted Projection output as `read_model_view`, preserving the existing response field while removing the direct legacy packet-interpreter call from Packet Explorer data.
- Scope labels and related link labels in the inspector are resolved through archived packet projections. Search, Export, Import, discussion, reaction, scope, and locality read models remain separate migration lanes.

## 2026-05 Projection card-list bridge migration

- Trusted Projection now exposes `resolvePacketCardListProjection` for already-selected packet cards, keeping query selection, ranking, and scope filtering outside Projection while centralizing card/list presentation shaping.
- Packet Explorer Search preserves its direct/name/text grouping, scoring, pagination, and response fields, but selected result rows now pass through the Projection card-list seam before being mapped back to the existing payload shape.
- `nexus-query-data` now projects generic dashboard, votes, and library packet-card lists after `nexusQueryService` has already selected the cards. Discussion, reaction, scope, locality, and deeper product-specific route read models remain separate adapter cleanup lanes.


## 2026-05 Legacy mutation executor deletion

- Removed the old route executor stack: `NexusMutationService`, Dispatch prepare/finalize handlers, old handler domain maps, mutation prepare/finalize handler maps, signed-packet finalizer, preference Dispatch workflow, and manifest Dispatch metadata bridge files.
- Trusted Dispatch remains the route-facing prepare/finalize authority. Deleted executor files are now guarded by `audit:trusted-coordinators` so they fail if restored.
- Static genericization/handoff/readiness ledgers remain temporarily because they describe migration state and pre-reseed closure, but their text now points to Dispatch/trusted-chain authority rather than the old Dispatch corridor.
- Direct-write seam classification now treats discussion/reaction/preference helpers as transitional adapter/internal or compatibility-cache writes instead of Dispatch-internal helpers.


### 2026-05-30 - Packet-backed definition profile preference carrier bridge

- Trusted Definition remains the owner of active definition source selection. No new runtime service was added.
- `ResolveTrustedDefinitionContextInput` can now accept packet-backed definition profile preference carriers through `definition_profile_preference_packets`. The current bridge reads active `Bundle.packet_set` bodies whose `bundle_data.definition_profile_preferences` descriptors normalize into `TrustedDefinitionRuntimePreference` records before candidate ranking.
- Preference targeting now carries both `node_element_id` and `scope_packet_id`, so a carrier can select a profile for one node, one scope, or broad local runtime use without hardcoding packet-specific behavior in core.
- This is still a bridge, not the final archive search path: local archive / pinned bundle discovery should feed this same coordinator input after reseed material is stored. Imported definition material remains descriptive; trusted local coordinators still own execution.

### 2026-05-30 - Archive-backed definition profile preference discovery bridge

- Trusted Definition now has an archive-backed profile preference discovery path inside the existing coordinator surface: `resolveContextWithArchiveProfilePreferences` queries Bundle packets through Trusted Archive, reads candidate carriers through Trusted Archive, and then feeds the discovered carriers into the existing packet-backed preference normalizer.
- This keeps ownership clean: Archive owns packet-store reads, Definition owns source/profile selection, and the shared definition preference normalizer remains the single conversion seam into `TrustedDefinitionRuntimePreference` records.
- The normal synchronous Definition resolver remains intact for bootstrap, tests, and callers that already have carriers in hand. Archive-backed discovery is async because it crosses the Archive read boundary.
- This is still a narrow bridge for definition profile preference carriers. Full local-archive/pinned-bundle Definition candidate loading should reuse the same coordinator path later instead of adding new runtime services.

### 2026-05-30 - Node preference protocol carrier baseline

- Locked the carrier split for node bootstrap: node identities are `Element.node` packets, while node-owned configuration is represented as `Preference.node` packets. Node preferences are not a new runtime service.
- `Preference.node` now has canonical schema coverage for definition profile selection, trust-graph defaults and pointers, import verification defaults, and storage cleanup defaults. Trust scores remain graph-derived from attestations, verification reports, and coordinator policy rather than becoming private preference facts.
- The Preference definition manifest now declares `Preference.node` actions, builder/planner/projection descriptors, compatibility, defaults, dependencies, fixtures, and definition parts so the seeded definition profile can carry the subtype alongside `Preference.element`.
- Runtime local validator identity creation now emits an `Element.node` packet instead of a non-canonical `local_validator` element subtype. Existing private key storage remains transitional and local-runtime-only; private keys must not be stored in packet bodies.
- Added a node preference protocol inspection audit that fails on missing node schema/definition/helper seams and warns while local validator private JWK material remains in the runtime side table. Future node-to-node exchange should move signing secrets toward environment-backed or encrypted local secret storage under Verification/Archive/Exchange coordinator ownership.
