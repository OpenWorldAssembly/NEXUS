# Open World Assembly Specifications

## Document status

This document describes the repo as it exists in code today.

It records the currently implemented product surface, route structure, layout behavior, and interaction boundaries. It does not treat canon text, long-range planning copy, or deferred nexus ideas as implemented behavior.

Sections marked **Provisional** reflect incomplete workflows or intentionally deferred systems.

Planning note:

- `docs/roadmap.md` captures planned future direction
- this document stays limited to implemented behavior and current code structure

## Current product surface

The app is an Expo Router application with two visible layers:

- a public OWA website shell for orientation and placeholder public pages
- a dedicated nexus shell under `/nexus/*` for the first guest-facing OWA nexus slice

Implemented scope today:

- a shared public shell with persistent `Header` and `Footer`
- redesigned public landing, about, and charter destination pages using NativeWind styling
- Nexus-shell cryptographic identity entry pages for sign-in, sign-up, guest claim, identity restore, and identity security
- a dedicated nexus layout for `/nexus/*`
- nexus routes for `Dashboard`, `Discussions`, `Votes`, `Roles`, `Trust`, and `Library`
- a hidden wrapper-level `/nexus/account` route for identity custody and local assembly continuity, reached from the profile area rather than the primary function navigation
- nexus shell state for scope selection, section selection, guest capabilities, and function-first vs scope-first mode
- packet-backed shell and scope query APIs feeding dashboard, discussions, votes, library, and trust surfaces
- NativeWind-based styling for the nexus layer

Current split rule in active implementation:

- `core/*` holds portable packet logic, schemas, builders, contracts, and pure projections
- `runtime/*` holds persistence, runtime services, and API glue
- `app/*` holds application-layer components, hooks, constants, public content, and shared UI/state
- `src/app/*` holds the Expo Router route shell and API entrypoints

This refactor pass preserves current auth payload shapes and current public route paths while making the current shell/function model explicit.

Current extracted split seams now in code:

- portable identity packet builders in `core/packets/identity.ts`
- portable discussion packet builders in `core/packets/discussion.ts`
- browser identity persistence helpers in `runtime/nexus/identity-storage.ts`
- split auth runtime helpers under `runtime/nexus/server/auth-service.*`
- split packet-service bootstrap/registry helpers under `runtime/nexus/server/nexus-packet-service-*`
- split discussion scope/pagination helpers under `runtime/nexus/server/discussion-service.*`
- surface-specific API type and query helper barrels under `runtime/nexus/nexus-api-types.*` and `runtime/nexus/nexus-query-api.*`

Not implemented today:

- persistent form submission or saved nexus actions
- remote multi-node sync beyond the local SQLite packet store
- real packet detail routes
- real-time chat
- protected/private spaces
- trust-weighted ranking, delegation, or moderation workflows
- packet explorer/detail routes

## Current routes and screens

The route tree is file-based and defined by `src/app`, while top-level `app/*` now holds the broader application-layer source files used by those routes.

### `/`

Screen component: `HomePage`

Role:

- public landing page for OWA
- introduces OWA as a democratic coordination layer for humanity
- presents three call-to-action links: `Learn More`, `Read the Charter`, and `Browse the Nexus`

Implemented content blocks:

- rotating hero slider with multiple public narratives, generated background artwork, slower eased horizontal carousel transitions, and a dedicated control row below a clipped slide viewport
- principle cards for decentralization, consent, and scale
- supporting cards focused on local legitimacy and action-oriented democratic coordination

### `/about`

Screen component: `AboutPage`

Role:

- public explanation page for the system model and civic framing

Status:

- contains multiple canon/workspace-derived public explanation sections
- includes a dedicated section navigator that centers the chosen chapter in view
- drives both the active chapter state and the section animations from one shared focus line at the vertical midpoint of the visible scroll viewport
- measures the actual scroll viewport inside the public shell so chapter focus is centered between the header and footer rather than against the full browser window
- collapses and expands each chapter card based on a widened midpoint-distance interpolation band with a short center hold
- gives each section its own parallax background artwork
- uses a restrained parallax background shift that stays in sync with the same longer chapter progress curve
- separates chapters with larger vertical spacing so the page reads as distinct sections rather than a continuous strip of imagery
- softens chapter edges with stronger blurred edge strips and shadows rather than a true masked fade effect
- presents each section as a large scroll chapter rather than a compact accordion card
- stays within the public site shell and does not enter the nexus layout

### `/docs`

Screen component: `DocsPage`

Role:

- public charter destination page

Status:

- still **Provisional** because the charter text itself is not written yet
- now frames `/docs` as the charter route and explains the role of canon, implementation guide, and workspace notes as current source material

### `/login`

Screen component: `LoginRedirectPage`

Role:

- compatibility redirect into the Nexus identity workspace

Status:

- redirects to `/nexus/identity/sign-in`

### `/signup`

Screen component: `SignupRedirectPage`

Role:

- compatibility redirect into the Nexus identity workspace

Status:

- redirects to `/nexus/identity/create`

## Nexus route tree

The nexus now has its own nested route layout under `src/app/nexus/_layout.tsx`.

### `/nexus`

Route file: `src/app/nexus/index.tsx`

Role:

- nexus route entry path
- immediately redirects to `/nexus/dashboard`

### `/nexus/dashboard`

Screen component: `NexusDashboardPage`

Role:

- guest dashboard and civic control panel
- shows current scope summary, aggregate queues, and recommended packet previews
- uses the shared nexus page shell with a compact header titled as `<scope> Dashboard`

Status:

- packet-backed
- metrics, queue cards, and recommended packets load from `/api/nexus/scopes/[scopeId]/dashboard`

### `/nexus/discussions`

Screen component: `NexusDiscussionsPage`

Role:

- Reddit-inspired discussion surface with horizontal forum tabs plus three internal discussion workspaces: `Feed`, `Thread`, and `Post`
- includes packet-backed forum feed state, thread detail state, inline targeted reply composition, nested replies, and universal packet vote controls for discussion posts
- renders the active forum as one connected shell: top-level discussion tabs attach to the active forum container, and inner workspace tabs attach to the active feed/thread/post pane rather than floating as separate cards
- uses local Expo Router API routes backed by the canonical SQLite packet store and derived discussion/vote indexes
- requires local web server output so those API routes can execute during development
- uses the same shared nexus page shell and compact scope-first header pattern as the other nexus routes
- route title casing now follows normal title case, for example `Global Commons Discussions`

Status:

- **Provisional**
- discussion forums and top-level feeds are loaded from `/api/nexus/scopes/[scopeId]/discussions` with optional `forum`, `sort`, `show_hidden`, and `viewer_actor_packet_id` query parameters
- discussion forums and top-level feeds now support cursor paging through optional `cursor` and `limit` query parameters
- discussion thread detail is loaded from `/api/nexus/scopes/[scopeId]/discussions/thread` with `post_packet_id` plus optional `reply_sort`, `show_hidden`, `viewer_actor_packet_id`, `cursor`, and `limit` query parameters
- direct child replies for any post are loaded from `/api/nexus/scopes/[scopeId]/discussions/replies` with `thread_post_packet_id`, `parent_post_packet_id`, and optional `reply_sort`, `show_hidden`, `viewer_actor_packet_id`, `cursor`, and `limit` query parameters
- local workspace state on `/nexus/discussions` is route-driven through `view` (`feed | thread | post`), `post`, `replyTo`, `sort`, `replySort`, and `showHidden` query parameters
- discussion tabs now project one `DiscussionForum` per forum kind and prefer authority forums from the active scope over inherited ancestor forums, which prevents duplicate visitor-lobby tabs
- read-only forum tab labels are scope-aware (for example `Sunnymead Ranch general`) even when the backing forum packet is inherited from an ancestor scope
- discussion writers now act through cryptographic person elements, including memory-only temporary guests, session-only temporary guests, saved guests, and claimed identities; top-level posting is no longer point-gated, visitor lobbies accept any signed actor, non-lobby forums require an active `Claim(kind: "assembly_association")`, and the same universal `Attestation(kind: "packet_signal")` model powers `+1/-1` controls on root posts and replies
- discussion writes and attestation writes now require a signed actor assertion plus the actor packet, and the active repo no longer uses the legacy visitor-lobby or anonymous-session discussion bridge
- discussion controls are not disabled purely because a claimed local bundle is locked; signing readiness is enforced by the deeper verified-write layer, while the route surfaces an unlock reminder banner
- feed sorting controls now live inside the `Feed` workspace, reply sorting controls live inside the `Thread` workspace, and `New post` actions are available from both the feed and thread workspaces
- feed and reply sort options now render as single segmented pills with the active sort highlighted; the visible options are currently `new`, `top`, `controversial`, and `old`, and both workspaces default to `new` sorting when no explicit query override is present
- feed cards themselves now act as the primary thread-open affordance, while the inline action row on feed cards is limited to vote, descendant-total reply count, and moderation state
- the `Thread` workspace auto-opens the current top feed item when no explicit thread is selected, and otherwise falls back to an empty-state guidance card when the active forum has no visible top-level posts
- top-level thread creation is written through `/api/nexus/scopes/[scopeId]/discussions/posts` using signed `thread_packet + post_packet`, reply creation is written through `/api/nexus/scopes/[scopeId]/discussions/replies` using `parent_post_packet_id + signed reply_packet`, and discussion reactions are written through `/api/nexus/packets/vote` using a signed attestation packet
- seeded visitor-lobby starter posts exist across the initial scope tree so signed guests can test full thread, reply, and vote behavior immediately
- the current discussions cleanup intentionally preserves the existing forum-shell layout and styling; this pass changes wiring, auth truthfulness, and copy rather than redesigning the page
- packet mechanics stay outside the screen layer: canonical writes, preferred-revision updates, vote tally refresh, reply-tree construction, and future bundle import/export or merge behavior remain on the packet-store plus server-service boundary, while the route screen consumes API projections
- the thread detail surface now visually distinguishes the root `Original post` from the reply tree so nested replies read as derivative discussion
- replies at depth `0-4` render expanded by default, while depth `5+` branches default to collapsed `Continue thread` affordances until the user expands them
- each reply card now exposes its collapse or expand control from a dedicated left-hand tree rail, collapsing a reply hides that reply card and its descendants together, and the rail shows a child-count bubble when that branch has replies
- each reply rail now uses one combined arrow-plus-count marker, and that count reflects the entire branch hidden by that control (`the reply itself + all descendants`) rather than only direct children
- collapsed replies keep a compact author/timestamp plus body-summary row visible beside the rail; action pills, full body, and child cards stay hidden until the branch is expanded again
- the feed and thread workspaces both use taller internal scroll surfaces on larger screens while falling back to normal page scrolling on smaller screens
- after a reply is submitted, the inline reply composer closes and the thread remains in view with the newly created reply visually highlighted
- reply composers now expose a `Cancel` action, and collapsing the targeted branch keeps the in-progress reply body as temporary front-end draft state instead of discarding it
- discussion action buttons now use the shared compact button footprint instead of stretching across the full content column
- the thread workspace uses `New reply` actions, at the top-right and bottom-left of the pane, to target the original post directly; nested replies still use `Reply here` on the relevant reply card
- vote pills now show selected `+1` or `-1` state by segment highlighting instead of appending `set` text, and reply-count pills match the same height rhythm as the vote control
- thread-side post cards no longer repeat inline reply-count pills; the root thread count is shown in the `REPLIES (n)` section heading instead
- reply cards render as meta-plus-body only, without a duplicated reply-title treatment, and reply composers identify their target as `Replying to OP` or `Replying to {author} - {timestamp}`
- discussion sort bars now stay on one line by default with adjacent action pills, while `Show moderated` is allowed to wrap only when the viewport becomes too narrow to keep the full control set visible
- the top-right route header shows the current actor label plus point balance and no longer repeats a redundant guest-status badge
- when a claimed session is active but the local signing bundle is still locked, the discussions route shows an informational unlock prompt, but write controls stay clickable and rely on the shared auth/signing layer to surface unlock or re-approval failures consistently

### `/nexus/votes`

Screen component: `NexusVotesPage`

Role:

- dedicated vote floor surface
- shows public pipeline stages, proposal previews, and governance visibility cues
- uses the shared nexus page shell with a compact header titled as `<scope> Votes`

Status:

- packet-backed
- stage cards and vote/proposal cards load from `/api/nexus/scopes/[scopeId]/votes`
- guests can inspect but cannot vote, object, or delegate

### `/nexus/library`

Screen component: `NexusLibraryPage`

Role:

- basic packet browser surface
- supports packet-type filtering and packet preview cards
- uses the shared nexus page shell with a compact header titled as `<scope> Library`

Status:

- packet-backed
- library cards load from `/api/nexus/scopes/[scopeId]/library` with optional family filtering
- the default Library view is now local-only and returns packets whose native authority scope matches the active scope
- packet actions are visible as placeholders and remain disabled

### `/nexus/trust`

Screen component: `NexusTrustPage`

Role:

- trust posture surface for the active scope
- shows scoped legitimacy stage, association evidence, role claims, role support/dispute evidence, and baseline trust gates
- uses the same shared nexus page shell and compact scope-first header pattern as the other nexus routes

Status:

- packet-backed
- trust data loads from `/api/nexus/scopes/[scopeId]/trust`
- works with normal assembly scopes and the special `you` personal scope lens
- shows threshold-based trust posture rather than a hidden numeric score
- keeps role information actor-centric and summary-oriented; role claim/unclaim and scoped role review now live on the dedicated `Roles` route

### `/nexus/roles`

Screen component: `NexusRolesPage`

Role:

- scope-centric roles review surface
- lets the current actor claim or unclaim existing roles from the active scope
- shows scope-relevant claimants for each role, their scoped role trust stage, and support/dispute evidence

Status:

- packet-backed
- roles data loads from `/api/nexus/scopes/[scopeId]/roles`
- role claim and unclaim write through `/api/nexus/scopes/[scopeId]/roles/claims`
- role support, dispute, and clear actions write through `/api/nexus/scopes/[scopeId]/roles/attestations` targeting the relevant claim packet
- guests can see protected role actions, but pressing them opens a local sign-in-required modal instead of attempting the write or surfacing raw backend identity errors
- dispute attestations require a comment; support comments remain optional
- exact-scope role claims are always returned as visible claimants for that scope, even when broader association posture is still weak
- claim, unclaim, support, dispute, and clear actions immediately re-fetch the roles payload so claimant rows, counts, and button state update without a manual page refresh
- the modal sign-in path preserves `return_to` and `return_scope_id` so successful auth returns to the same workspace and scope lens
- claimant cards currently expose both role-specific trust stage and broader scope trust or association posture
- evidence is currently inspected inline on the roles route rather than through a separate attestation browser

### `/nexus/account`

Screen component: `NexusAccountPage`

Role:

- hidden wrapper-level account overview and identity/security custody workspace
- shows current actor state and routes users into the dedicated Nexus identity ceremony screens

Status:

- packet-backed
- shows the current actor packet id, identity mode, storage/cookie state, signing-key lock state, current remembered-session/write-approval posture, and passkey count
- routes sign-in, create, claim, restore, and detailed security management to dedicated `/nexus/identity/*` screens
- provides direct links back into the `Trust` and `Roles` function surfaces without owning association or role workflows
- signing out from identity security immediately hands the shell back to a guest actor instead of leaving the signed-out claimed identity visually active in the profile card

### `/nexus/identity/sign-in`

Screen component: `NexusIdentitySignInPage`

Role:

- claimed-identity sign-in entry point inside the Nexus shell
- one primary graph-backed identity-discovery and bundle-unlock sign-in path plus secondary passkey and import actions

Status:

- packet-backed
- uses three internal sign-in modes: `LOCAL`, `PASSKEY`, and `IMPORT`
- those modes render as one connected top-tab rail rather than as disconnected pills inside the page body
- `LOCAL` is the default everyday sign-in path, searches the Nexus graph by display alias, packet id, and public-key-related matches, and still highlights identities already saved on this device
- saved-on-device identities and graph search results are deduped by actor packet id so the same claimed identity does not render twice in the visible picker
- graph-only identity matches remain discoverable but cannot be unlocked with only a passphrase unless the encrypted bundle is already on-device
- the current-actor summary emphasizes the active actor label rather than status pills, and the saved-local-identity picker collapses back to the selected identity once a local match is chosen without auto-jumping to the first new search result
- bundle sign-in copy and CTA labels now distinguish resuming or unlocking the current claimed identity from switching to a different identity
- when entered from a protected role action, sign-in preserves `return_to` and `return_scope_id`, exposes a clear back-out path, and returns to the originating Nexus workspace after successful auth
- saved claimed bundles stay discoverable here, but Nexus falls back to a guest actor unless a claimed session actually restores
- `PASSKEY` is a device/browser authenticator path and is described as Windows Hello / phone / security-key style presence proof rather than as pasted file input
- passkeys are optional extra protection for claimed identities, not a hard prerequisite for creation, claiming, normal sign-in, or security-preference changes
- when no passkeys are registered, passkey sign-in fails with a clear guidance error instead of implying it is the only valid auth path
- `IMPORT` restores an encrypted identity bundle onto this device and then signs it in
- continue-as-guest, claim-current-guest, and create-fresh paths remain visible as secondary actions beneath the sign-in modes
- uses the remembered-session preference from the Nexus shell rather than asking for cookie persistence inline on the form

### `/nexus/identity/create`

Screen component: `NexusIdentityCreatePage`

Role:

- claimed-identity creation ceremony inside the Nexus shell

Status:

- packet-backed
- creates a new claimed `Element(kind: "person")` with a client-generated `P-256` keypair
- validates a mutable display alias, bundle passphrase, and optional canonical location disclosure before creation
- separates passphrase copy from passkey copy
- includes starting claimed-session preferences for remembered sign-in and write approval, with the same options still editable later from the sidebar drawer and identity security route
- the claim/create location picker now reduces the selected disclosure to packet-safe `scope + value` before identity packets are written
- once a canonical place is selected in the create flow, the location result list collapses until the query changes again
- successful creation routes into identity security, where Nexus reminds the user to export the encrypted bundle and store it safely

### `/nexus/identity/claim`

Screen component: `NexusIdentityClaimPage`

Role:

- guest-to-claimed continuity ceremony inside the Nexus shell

Status:

- packet-backed
- preserves the current guest actor while revising it into a claimed identity
- claim writes send the current guest packet plus the claimed revision so the packet store preserves the revision chain instead of receiving an orphaned later revision
- treats alias as a mutable display alias rather than a permanent username
- includes starting claimed-session preferences for remembered sign-in and write approval, with the same options still editable later from the sidebar drawer and identity security route
- uses the same canonical location picker and packet-safe disclosure shaping as the create flow
- once a canonical place is selected in the claim flow, the location result list collapses until the query changes again
- successful claim routes into identity security, where Nexus reminds the user to export the encrypted bundle and store it safely

### `/nexus/identity/restore`

Screen component: `NexusIdentityRestorePage`

Role:

- encrypted bundle restore ceremony inside the Nexus shell

Status:

- packet-backed
- validates bundle JSON and bundle passphrase before restore
- restores a claimed identity onto the current device and then hands off to the security surface

### `/nexus/identity/security`

Screen component: `NexusIdentitySecurityPage`

Role:

- detailed session, passkey, remembered-session, write-approval, and export workspace for the active identity

Status:

- packet-backed
- manages remembered-session preference and `standard` / `guarded` / `every_write` write approval inside the Nexus shell, while presenting those controls as compact `TEMP/SAVE` and `OFF/MED/MAX` segmented pills
- the shared `TEMP/SAVE` control now applies to the current actor immediately: for guests it creates or clears browser persistence right away, and for claimed identities it remains the default for future claimed sign-ins
- when no claimed session is active, the route still stays accessible but the write-approval and passkey-management actions remain tied to a real claimed session rather than to a merely saved local bundle
- shows active device sessions, passkeys, and encrypted bundle export
- the default session list is active-only, sorts the current session first, and surfaces an explicit empty or error state instead of silently rendering blank session space
- shows an export reminder when entered directly from a successful create or claim ceremony

## Current navigation structure

Navigation is implemented with Expo Router using a top-level stack in `src/app/_layout.tsx` and a nested nexus stack in `src/app/nexus/_layout.tsx`.

### Public shell

Public routes render inside a persistent shell composed of:

- `Header`
- main stack content area
- `Footer`

Current public header links:

- `Home` -> `/`
- `About` -> `/about`
- `Charter` -> `/docs`
- `Nexus` -> `/nexus`

Current public behavior:

- the active public link is highlighted from the current pathname
- the `OWA` brand label links to `/`
- the public header no longer exposes auth routes
- the nexus is reachable from both the home-page CTA and the `Nexus` header link
- the public footer now uses a compact single-row layout with minimal brand copy, lightweight page links, and one `Nexus` action

### Nexus shell

Nexus routes do not render the public `Header` or `Footer`.

Nexus shell composition:

- two adjacent left-side navigation columns on desktop
- mobile top bar with a toggle that opens the same left-side navigation tray from the left edge
- main surface on the right for the active route
- all nexus routes now use one shared centered page frame with consistent width, compact headers, and scope-first route titles such as `Global Commons Library`

Left-side shell sections:

- compact identity strip showing the current actor label and mode
- auth actions now route into `/nexus/identity/*` instead of public-site auth pages
- anonymous guest avatar between the `OWA Nexus` label and guest display name
- centered brand label, auth actions, and preference rows inside the guest identity strip
- the profile strip now uses the real current actor label, and the current point balance is shown directly beneath it
- guest mode surfaces `Sign In` and `Claim`, while claimed mode surfaces `Security` and `Profile`
- public-site return link positioned beneath the auth actions inside the guest identity strip
- a small `Preferences` tab at the bottom of the guest identity strip that expands a drawer for navigation mode, shell theme, UI size controls, remembered-session preference, and write-approval quick controls
- the preferences tab is visually attached to the drawer as its footer row, uses a chevron icon instead of `open/hide` text, and animates open or closed
- compact one-line shell preference rows inside that drawer, with the setting label on the left, the switch centered, and the current mode label on the right
- primary navigation column that switches between the function menu or scope menu
- secondary navigation column that reveals the other menu immediately to the right
- open primary and secondary rails use the same width, and the Nexus UI-size preference also adjusts shared route-surface spacing, typography, badges, buttons, and form controls through the Nexus appearance layer
- the scope menu uses a full visible scope map with a fixed-width connector lane, so every scope stays visible without pushing lower labels to the right
- the scope list now renders `You` as a personal-scope child leaf under the actor's local assembly branch instead of prepending it above the assembly tree
- scope-map labels now call `You` a `Personal branch`, and the left connector lane uses semantic width cues so `Global -> ... -> You` reads from broadest to narrowest instead of widening and then shrinking again
- function-menu row titles stay clean (`Dashboard`, `Trust`, and so on), while personal-scope subtext now uses wording such as `Personal dashboard` and `Personal trust` instead of generic `... across You` phrasing
- the secondary rail now always pins a separate current-context snapshot card at its top, mirroring the guest profile card and exposing quick assembly stats such as activity level, member count, and trust score
- the scope snapshot card is now a smaller metrics-only lens with no descriptive body copy or badges, and its three stat tiles change with the active Nexus section while keeping the same compact card shape
- followed scopes stay with the scope menu column
- deferred surfaces stay with the functions menu column
- current-scope summary card is pinned to the top of the secondary rail regardless of whether the secondary rail is currently showing the scope menu or function menu, and it no longer shares a container with the scope map
- current-context badges stay inside the card and wrap within the available width when labels run long
- the shell theme preference affects the dedicated Nexus shell, the nested Nexus navigator background, and the current Nexus route surfaces without changing the public-site shell
- secondary rail can remain open even when the primary rail is collapsed
- each rail can be collapsed independently and remembers its own open or closed state
- left and right swipe gestures collapse or expand the rails from the outside in and inside out

Nexus route list:

- `/nexus/dashboard`
- `/nexus/discussions`
- `/nexus/votes`
- `/nexus/roles`
- `/nexus/library`
- `/nexus/trust`

Hidden wrapper/account route:

- `/nexus/account`

## Existing workflows

### Public orientation workflow

Implemented flow:

1. user lands on `/`
2. user reads public framing and summary cards
3. user navigates to `/about`, `/docs`, or `/nexus`

### Public site navigation workflow

Implemented flow:

1. user uses the persistent public header on any public route
2. user moves among the public pages
3. current page is indicated by active header-link styling

### Nexus entry workflow

Implemented flow:

1. user selects `Enter Nexus` from the landing page
2. router enters `/nexus`
3. `/nexus` redirects to `/nexus/dashboard`
4. nexus loads in `Global Guest` state with `Global Commons` as the initial scope lens

### Nexus scope workflow

Implemented flow:

1. guest opens the scope menu branch navigator or followed scope chips
2. guest chooses a scope
3. the active scope updates in shared nexus shell state
4. dashboard, discussion, vote, roles, trust, and library surfaces filter against that scope lens

Status:

- packet-backed
- scope summaries are now loaded from `/api/nexus/shell` and derived from `Element(kind: "assembly")` packets plus one actor-backed `you` scope lens rendered beneath the actor's local assembly branch
- shell scope ids are route-safe labels (for example `global-commons`) that map server-side to canonical packet refs

### Nexus mode workflow

Implemented flow:

1. guest toggles between `Function-first` and `Scope-first`
2. the primary left rail switches between the function menu and the scope menu
3. the secondary column immediately to the right switches to the complementary menu
4. route structure remains unchanged and the same surfaces remain reachable

Status:

- **Provisional**
- mode is a shell preference only; it does not change data shape or persistence

### Discussion posting workflow

Implemented flow:

1. guest opens `/nexus/discussions`
2. the app creates or restores a cryptographic person element for the current actor, defaulting to an ephemeral guest identity when no saved or claimed identity is active
3. guest loads a forum feed from `/api/nexus/scopes/[scopeId]/discussions`
4. guest can switch between `Feed`, `Thread`, and `Post` workspaces without leaving the route
5. guest can open a root post by pressing its feed card, the `Thread` workspace auto-opens the current top feed item when no explicit post is selected, and the guest can reply to any post in that tree through an inline composer attached to the selected reply target while voting `+1/-1` on visible discussion posts when the thread participation rules allow it
6. feed sorting happens inside the `Feed` workspace, reply sorting happens inside the `Thread` workspace, and the feed/thread workspaces both provide direct navigation into the `Post` workspace for new top-level posts
7. top-level posts are allowed whenever the active actor satisfies the forum participation rule: any signed actor in `visitor_lobby`, or an actor with an active `Claim(kind: "assembly_association")` in the other forums
8. top-level feeds and reply branches are loaded incrementally through cursor-based API pages rather than returning the entire forum or thread tree in one payload
9. discussion writes are sent to the local API routes, written into the local SQLite packet store as canonical `DiscussionThread + DiscussionPost`, `DiscussionReply`, or `Attestation` packets, and then re-projected back into the feed/detail UI
10. discussion writes derive actor ownership from the verified actor packet, store `provenance.created_by` as that person element, and do not depend on the removed anonymous-session visitor-lobby bridge

Status:

- **Provisional**
- discussion packets and attestations are persisted through the local SQLite packet store at `NEXUS_DATA_DIR/owa-packets.db`, defaulting to `data/nexus/owa-packets.db` when `NEXUS_DATA_DIR` is unset
- discussion point balances, top-level post costs, and point-earned reply loops are currently disabled
- discussion reactions still use raw `Attestation(kind: "packet_signal")` packets, but vote-derived deprioritization and auto-hide behavior are currently disabled
- discussion packets use a discussion-seed-version marker in the same runtime data directory, and destructive reseeds are now limited to local development or an explicit `NEXUS_ALLOW_DISCUSSION_RESET` override instead of running automatically in every hosted boot
- discussion packets do not stand alone: `DiscussionSpace` packets attach to scope `Element` packets, `DiscussionForum` packets attach to a discussion space, `DiscussionThread` packets attach to a forum, root `DiscussionPost` packets attach to their thread, and `DiscussionReply` packets attach to their thread, root post, and immediate parent reply-or-post
- raw trust visibility is now packet-first but still pre-weighting: `/api/nexus/attestations/target`, `/api/nexus/attestations/actor`, and `/api/nexus/assemblies/claims` expose inspectable attestation edges without any trust score math
- a person can now claim association with an assembly through `Claim(kind: "assembly_association")`, and the trust flow can create or withdraw that association while the assembly-creation API can still seed a lightweight local assembly packet plus starter discussion space/forums under the active scope

### Trust workflow

Implemented flow:

1. user opens `/nexus/trust`
2. the app resolves the active scope, including `you` when selected
3. the route loads scoped trust posture from `/api/nexus/scopes/[scopeId]/trust`
4. the payload projects association evidence, claimed roles, role summary state, and baseline participation gates
5. the route links outward to `Roles` for claim/unclaim and claimant-by-claimant role review

Status:

- **Provisional**
- trust stages are explicit and threshold-based: `self_claimed`, `emerging`, `recognized`, `role_eligible`
- trust is scope-local and policy-aware
- assembly association is now written from the `Trust` surface through `Claim(kind: "assembly_association")`
- role support/dispute currently uses claim-targeted `Attestation(kind: "claim_support" | "claim_dispute")`
- trust-weighted ranking and broader moderation effects remain deferred

### Roles workflow

Implemented flow:

1. user opens `/nexus/roles`
2. the app resolves the active scope, including `you` when selected
3. the route loads scope-relevant role cards and claimant lists from `/api/nexus/scopes/[scopeId]/roles`
4. the current actor can claim or unclaim a role from that surface
5. guests pressing protected role actions see a local sign-in-required modal with `Sign in` and `Go back` instead of attempting the write
6. the current actor can support, dispute, or clear a claimant's role standing, with disputes requiring a comment
7. successful role actions immediately re-fetch the scoped roles payload so the claimant list, counts, and claim/unclaim button state stay in sync
8. role evidence can be expanded inline to inspect who has supported or disputed a claimant in that scope

Status:

- **Provisional**
- role claims are represented as exact-scope `Claim(kind: "role_association")` packets
- claimant lists are scope-relevant rather than global
- one viewer cannot hold both active support and active dispute for the same claim in the same scope; writing one clears the opposite
- role creation and editing remain deferred

## Major entities and their roles

### Implemented application entities

#### Root layout

Defined by `src/app/_layout.tsx`.

Role:

- wraps the app in a theme provider
- conditionally applies the public shell only on non-nexus routes
- keeps the nexus route subtree available in the top-level stack

#### Nexus layout

Defined by `src/app/nexus/_layout.tsx`.

Role:

- provides the dedicated nexus shell
- mounts the nested nexus stack
- shares nexus shell state across all nexus screens

#### Nexus shell provider

Defined by `app/components/nexus/nexus-shell-context.tsx`.

Role:

- stores `navigationMode`
- stores `activeScopeId`
- stores `expandedScopeIds`
- derives `activeSection` from the current pathname
- prepends the actor-backed `you` personal scope
- exposes guest capabilities and scope data to nexus screens

#### Nexus sidebar and shell

Defined by `app/components/nexus/nexus-shell.tsx` and `app/components/nexus/nexus-sidebar.tsx`.

Role:

- render a compact profile header plus a two-stage left-side navigation system
- keep either functions or scopes primary based on shell preference
- render the complementary secondary menu in the adjacent column
- render the scope menu as a full visible scope map rather than an indented nested tree
- keep scope-only support content with the scope menu and function-only support content with the function menu
- support persisted rail collapse state and horizontal swipe collapse/expand behavior
- provide responsive collapse behavior while keeping the tray anchored to the left edge

#### Nexus query payloads

Defined by:

- `runtime/nexus/server/nexus-query-data.ts`
- `src/app/api/nexus/shell+api.ts`
- `src/app/api/nexus/scopes/[scopeId]/*+api.ts`

Role:

- project packet-store data into shell, dashboard, discussions, votes, and library payloads
- keep UI clients decoupled from storage classes through route-level contracts
- preserve the old visitor-lobby JSON bundle only as a legacy migration source during service bootstrap

### Domain-level entities

Status:

- packet-backed
- runtime packet-schema foundation under `core/*` is now wired into active nexus surfaces through server query routes
- there are now typed packet builders and an initial seed packet dataset under `core/packets/*`
- there are now Expo and Node SQLite-backed `PacketStore` implementations under `runtime/storage/*`, plus concrete browser/nexus query-service implementations that read from the same SQLite search index

Important note:

- nexus content is packet-themed and type-labeled
- packet, proposal, assembly, mission, role, and trust concepts now render from packet-backed API projections on the active nexus routes
- seed packet data is now loaded into the local SQLite store through the shared server bootstrap when no assembly packets exist yet
- query services remain the projection seam, while packet detail routes and deeper action workflows are still pending

## Current architecture patterns

### Routing pattern

- Expo Router file-based routing
- top-level stack in `src/app/_layout.tsx`
- nested nexus stack in `src/app/nexus/_layout.tsx`
- `/nexus` redirects to `/nexus/dashboard`

### Layout pattern

- public and nexus shells now have separate layout behavior
- public pages remain centered content pages with shared header/footer chrome
- nexus pages render inside a dedicated app-style shell with a persistent left rail on desktop and an overlay shell on smaller screens

### Component pattern

- function components throughout
- route screens use default exports
- nexus layout logic is split into reusable components under `app/components/nexus`

### Styling pattern

- public shell chrome and the landing/about/charter pages now use NativeWind `className` styling
- public pages use a dedicated public token set layered into `tailwind.config.js`
- the public landing page hero now includes a rotating slider with generated SVG background imagery
- the public about page uses large scroll-driven chapters with per-section parallax artwork and smooth scroll-based emphasis
- nexus screens and nexus shell use NativeWind `className` styling
- nexus theme tokens are defined in `tailwind.config.js`
- NativeWind is configured through `babel.config.js`, `metro.config.js`, `global.css`, and `nativewind-env.d.ts`

### State and data pattern

- public pages are still stateless
- nexus state is shared through a local React context provider
- shell scope data and active route cards now load from packet-backed API routes
- visitor-lobby read and write flows use the same local packet store as shell/query projections
- server bootstrap backfills missing personal-tree seed packets on startup so partially-seeded local DBs recover automatically
- Node SQLite writes use strict query-specific named-parameter bindings to avoid runtime binding errors during packet updates
- local web forum persistence depends on `expo.web.output = "server"` in `app.json`
- the repo now also includes a production-parity Node web server entry at `server.cjs`, which serves `dist/client`, forwards dynamic routes and `app/api/**` requests into the exported Expo server build in `dist/server`, and exposes `/health` for hosted healthchecks
- packet import/export bundles, revision publishing, and merge behavior remain defined by the `PacketStore` contract and storage/service layer rather than in route components
- claimed Nexus auth now uses encrypted local signing bundles with optional passkeys as extra protection
- claimed sessions now expose CSRF tokens, rotating refresh sessions, passkey-upgrade state, device/session listings, explicit cookie-backed remembered-login choice, and `standard` / `guarded` / `every_write` write-approval preferences
- packet parsing now runs through family compatibility checks, explicit upcasters, and family `revision_mode` metadata instead of treating `schema_version` as a dormant header field

## Current naming patterns

### Route file naming

- route filenames are lowercase
- nested routes match URL segments directly

Examples:

- `src/app/index.tsx`
- `src/app/nexus/dashboard.tsx`
- `src/app/nexus/discussions.tsx`
- `src/app/api/nexus/shell+api.ts`
- `src/app/api/nexus/scopes/[scopeId]/dashboard+api.ts`

### Component naming

- React component names use PascalCase
- route components continue to end with `Page`
- shared nexus building blocks use descriptive names such as `NexusShell`, `NexusSidebar`, and `NexusCard`

## Repo structure in current use

### Active implementation areas

- `app`
  - application-layer components, public content, hooks, constants, and shared UI/state
- `src/app`
  - public route files, root layout, nexus route files, and API entrypoints
- `data/nexus`
  - runtime packet database files plus legacy migration artifacts such as the old visitor-lobby bundle
- `core`
  - packet foundation split into schema, contracts, packets, and projections
- `runtime`
  - packet-store schema, SQLite row projections, query-service logic, auth/trust/discussion services, and API-facing helpers

### Present but not active in runtime behavior

- `core/schema`
  - defines the canonical `PacketEnvelope`, packet-family Zod schemas, packet refs, revision refs, multi-parent revision ancestry, and parser entrypoints
- `core/contracts.ts`
  - defines `PacketStore`, `BrowserQueryService`, and `NexusQueryService` interfaces, including preferred-revision and revision-head contracts
- `runtime/storage`
  - defines the concrete persistence layer and query adapters, including SQLite-oriented record projections, schema initialization, Expo/native packet-store logic, Node/server packet-store logic, and shared browser/nexus query-service implementations
- `core/projections`
  - derives display labels, titles, summaries, and statuses from canonical packet family plus subtype
- `runtime/nexus`
  - now actively holds the runtime API clients, trust/auth/discussion orchestration, and query payload contracts

## Implementation boundaries

What is implemented:

- public route structure
- public header/footer shell
- redesigned public splash, about, and charter destination pages
- dedicated nexus shell under `/nexus/*`
- first-slice nexus surfaces for dashboard, discussions, votes, library, and trust
- hidden wrapper-level account and identity/security flows separate from the primary function navigation
- cryptographic identity continuity across guest, saved-guest, and claimed nexus actors
- passkey-optional claimed-session authentication with passkey sign-in, passkey registration, short-lived single-use passkey re-auth tokens, rotating refresh cookies, and server-side device/session revocation
- packet-backed shell and scope query routes feeding active nexus surfaces, including the actor-backed `you` personal scope
- `You` now renders as a personal child leaf under the actor's local assembly branch instead of sitting above the scope tree
- canonical packet schema definitions with nested `header/body` envelopes
- stable `packet_id` plus immutable `revision_id` packet identity rules
- multi-parent revision ancestry for divergent branches and merge revisions
- schema compatibility upcasters and explicit family `revision_mode` metadata
- `Role` and `Claim` as packet families with claim-based role and assembly association state
- typed packet edges, scope refs, packet-store interfaces, a SQLite-backed packet-store implementation, and storage schema definitions
- shared browser and nexus query-service implementations over the packet search index
- a packet-backed discussion and attestation engine that stores canonical `DiscussionSpace`, `DiscussionForum`, `DiscussionThread`, `DiscussionPost`, `DiscussionReply`, and `Attestation` packets in the local SQLite packet store, projects derived reply/attestation/ledger indexes, and reseeds local dev discussion data deterministically by seed version
- a first trust/runtime slice that projects scope-local trust stages, policy gates, assembly association claims, role-claim summaries, and role evidence through `/api/nexus/scopes/[scopeId]/trust`
- a first roles/runtime slice that projects scope-relevant role claimants from scoped claim packets, scoped role trust posture, inline evidence lists, real self claim/unclaim writes, and real support/dispute writes through `/api/nexus/scopes/[scopeId]/roles`
- derived packet label helpers for future browser and nexus projections

What remains unimplemented but is still referenced by docs or shell affordances:

- persistent packets and packet detail pages
- map / nexus browser
- missions surface
- messages / live chat
- notifications
- protected assemblies and trust-gated spaces
- moderation workflows
- packet detail routes and cross-surface navigation from card projections into packet inspectors

## Known current issues and semantic gaps

These notes describe current known weaknesses or mismatches in the implemented repo. They are part of current truth, not future promises.

### Depth and maturity

- Identity/auth and discussions remain the two most coherent end-to-end verticals.
- Dashboard, votes, trust, roles, and library are implemented and packet-backed, but they are still comparatively provisional and in places behave more like projection shells than fully intentional workflow surfaces.

### Roles

- Role claims now live as scoped `Claim(kind: "role_association")` packets instead of on actor bodies.
- Roles and trust projections read those claim packets plus claim-targeted support/dispute attestations.
- Legacy `Element.claimed_role_refs` remains parseable only for compatibility and bootstrap migration.

### Location and assembly association

- Location selection currently behaves more like identity metadata and discovery input than like a full locality or home-scope system.
- Location does not yet fully drive dynamic scope mounting, assembly membership defaults, or a complete locality-claim workflow.
- Assembly creation and assembly-association flows exist, but they remain rough and lightly tested.

### Scope tree and account routing

- The shell still exposes the full seeded testing assembly tree more broadly than the intended long-term model.
- The intended distinction between automatic scopes, attached scopes, followed scopes, and discoverable scopes is not yet implemented as a first-class shell model.
- Scope-menu actions now navigate visibly back to `Trust` when the user changes scope from wrapper-level account or identity pages instead of only mutating background shell state.
- Wrapper-level account and identity routes now resolve as hidden custody surfaces rather than masquerading as one of the main function workspaces in the visible shell state.

### Session persistence

- Same-device remembered sign-in now reuses the existing persistent session by default instead of silently accumulating a new session record for that same actor and device label.
- Refresh-token rotation now updates the existing persistent session in place rather than creating a new device-session row during refresh.
- Identity security now defaults to showing active sessions only, with the current session sorted first and explicit empty or error states when session data is unavailable.
- Person-packet signature verification now remains compatible with older signed identity revisions that were stored before `claimed_role_refs` became a defaulted `Element` field, so claimed sign-in and signed claim mutations do not fail on older stored identities.

### Library semantics

- The library route now uses a strict local-only mode by default instead of the broader inherited scope lens.
- Broader inherited or all-visible library modes remain future work, but the default product behavior now matches “packets from this scope only.”

## Provisional notes

### Schema churn guardrail

- The compatibility layer is real, but it is still early-alpha infrastructure rather than a promise to preserve every transient test-era packet shape forever.
- When packet-shape churn starts creating more permanent compatibility burden than value, the project should consider a reset or reseed cutline instead of silently carrying every temporary schema version forward forever.

The following areas should still be treated as provisional:

- guest posting behavior beyond the current packet-backed discussion rules and temporary point grant
- location disclosure remaining optional, claim/create succeeding without a location, and canonical locality lookup issues such as missing `Sunnymead Ranch` results are intentionally deferred into the dedicated location pass rather than partially fixed in unrelated stabilization passes
- the exact final ontology for assemblies, scopes, overlays, and future claim kinds beyond `role_association` / `assembly_association`
- deeper trust weighting, moderation consequences, and non-default policy engines
- vote execution, delegation, and propagation semantics
- packet actions that currently appear as disabled placeholders
- any architecture in `docs/implementation-guide.md` beyond the new packet schema foundation that is not yet represented in executable code
