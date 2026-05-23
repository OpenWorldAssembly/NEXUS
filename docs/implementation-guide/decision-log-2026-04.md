# Decision Log 2026-04

This monthly log condenses the April 2026 decisions that remain most important for current implementation and future migration work.

## 2026-04-08 foundations

- Packet identity uses stable `packet_id` plus immutable `revision_id`.
- Revision history is a DAG with `parent_revision_refs`, not a single chain.
- Packet relationships normalize into one typed edge collection.
- `Element` remains the identity-root type for people, assemblies, organizations, and services.
- The dedicated Nexus shell lives under `/nexus/*`.
- Function-first and scope-first remain one system rather than two route trees.

## 2026-04-09 shell and discussion shape

- Shared browser and Nexus query services over the packet graph became the projection seam.
- Active shell and scope routes moved onto packet-backed payloads instead of mock arrays.
- Discussions became a connected forum shell with feed, thread, and post workspaces.
- Feed cards became the primary thread-launch surface.
- Cursor paging and reply-branch controls became first-class route behavior.

## 2026-04-10 identity and auth

- Every graph-writing actor became a cryptographic `Element(kind: "person")`, including guests.
- Claimed auth uses local keys plus server challenge sessions rather than server-owned identity truth.
- Claimed auth now supports passkeys, rotating sessions, and explicit write-approval modes.
- Identity ceremonies moved into the Nexus shell.
- `Attestation` replaced packet votes as the reusable trust edge.

## 2026-04-17 architecture and trust pivot

- The final source roots became `core`, `runtime`, and `app`, with `src/app` as the Expo Router shell.
- `Trust` replaced `Account` as the top-level function surface.
- `You` became a first-class personal scope lens.
- `Roles` became a dedicated scope workspace.
- `Role`, `Claim`, and packet compatibility infrastructure became first-class runtime concerns.

## 2026-04-18 to 2026-04-20 locality and identity hardening

- Legacy signed identities remained valid after the roles-and-claims refactor.
- Home locality became the mounted geographic truth, while follows became shell preferences.
- Locality search and locality creation hardened around canonical geographic assembly flows.
- Location disclosure remained separate from mounted home-locality truth.

## 2026-04-23 and 2026-04-24 compatibility and fortress corridor

- Schema compatibility moved into a real raw/adapted/read-for-write pipeline.
- Fortress pass 1 moved discussion write admission into core mutation law.
- Fortress pass 2 introduced the shared prepare/sign/finalize corridor and packet-backed write-lock policy updates.

## 2026-04-25 to 2026-04-29 packet floor and verification

- Packet compatibility coverage is now classified explicitly.
- Legacy write seams were sealed before discussion-type cleanup.
- Raw packet signatures verify before adaptation.
- Live and near-live packet types now share one generic builder floor.

## 2026-04-30 surface-level runtime contracts

- Discussion workspaces now project action affordances through the shared `NexusActionState` and `NexusActionIntentDescriptor` contract.
- Packet Explorer became a shell-level read-only inspection workspace.
