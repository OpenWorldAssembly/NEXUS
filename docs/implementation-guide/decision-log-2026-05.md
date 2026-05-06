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
