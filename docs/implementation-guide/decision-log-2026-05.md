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
- `preference.element.interface.set` was initially enrolled in that master handler as a live bridge. It wrote `Preference.element.value.interface.scope_display`, could preserve or update `interface.shell_chrome`, and kept the legacy scope-display table as a compatibility cache. The later fortress promotion pass moves claimed writes to `preference.element.set` and keeps this connector runtime-ready.
- The manifest definition fortress bridge remains non-executing and descriptor-only. The new runtime master handler still runs trusted local connector code; it does not execute arbitrary behavior from imported definitions.

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

## 2026-05 definition packetization and Preference fortress promotion

- Active manifest definition parts now produce schema-validated canonical `Definition` packet envelopes, and those envelopes are grouped into one canonical `Bundle.packet_set` definition profile inventory for reseed readiness.
- The seeded definition profile audit compares packet material back to the core manifest and fails closed on missing parts, unexpected parts, stale profile metadata, duplicate bundle refs, or digest drift.
- Stored Definition and Bundle packet material is now reseed truth material, but execution remains trusted-local; imported definition packets may describe schemas, operations, policies, dependencies, planners, and builders, but they cannot introduce server code.
- `Definition`, `Bundle`, and `Preference` are now canonical packet types with body schemas, compatibility entries, builder support, pipeline inventory coverage, and packet-store validation like other active packet types.
- Claimed shell preference writes now run through the standard signed mutation prepare/finalize corridor as `preference.element.set`, preserving projected responses, actor proof/session checks, same-value no-op behavior, and legacy cache sync. `/api/nexus/shell-preferences` remains guest compatibility state only.
- The direct `preference.element.interface.set` runtime connector is retained as a definition/internal comparison bridge rather than the live claimed-write corridor.

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
