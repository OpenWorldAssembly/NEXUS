# Open Questions And Deferred Decisions

## Near-term open questions

- How should initiative conformance and version recognition be represented?
- Which visibility modes should arrive first for official, unofficial, current-version, and older-version packets?
- How should Packet Explorer expose `Fork`, `Adapt`, `Diff`, `Export`, and `Follow` first?
- Where should moderation preferences live: actor policy, client preference, or both?
- What exact local trust state should be attached to imported or re-verified packets?
- Which packet relationships should a future first-class `Bundle` packet record directly: carried packet refs, root refs, lineage refs, verification refs, or all of the above?
- Which remaining shell/interface preferences should join `main` visibility and section-display options under the new packet-backed `Preference.element` model?

## Deeper design questions

- Should reactions remain separate from higher-meaning vouch or objection signals?
- Which future relationship workflows should remain claim-mediated, and which should be written directly as plain relations?
- What exact authority model should govern multi-key assemblies and custody transition?
- What exact event turns a decision from a signal into an effect-bearing authority artifact?
- Which built-in action handlers, if any, should Nexus eventually support for automatic execution?
- How broad should the new `Report` family become beyond `verification_report` and `import_report`?
- How should recorded verification or import reports, local verification caches, and later live read-model verification results relate over time?
- Should future node-to-node trust let one node weigh validation reports signed by another node, and if so through what policy seam?
- When, if ever, should packet-based compatibility manifests complement the current code-based adapter registry?
- How much default flattening should future rebundling do when one bundle carries packets that already arrived through an older bundle lineage?

## Explicitly deferred

- another broad architecture rewrite
- Discord adapter revival
- mesh transport and federation work
- real-time chat
- advanced reputation math
- deep governance automation before the trust and policy seams are clearer
- a dedicated validation workflow screen before locality UX and geo standardization are settled
- packet-based compatibility manifests as active implementation rather than future design direction
- first-class `Bundle` implementation before locality UX and geo standardization are settled
- authoritative selective home-tree storage and projection semantics before the current locality descriptor, Unicode, and sparse-path foundations are settled
- provider-backed locality candidate ingestion, geometry, and external locality APIs before the current descriptor and Unicode foundation pass is absorbed
- expanding the legacy runtime preference cache for new behavior instead of extending the packet-backed `Preference.element` bridge

## Bundle direction now decided

- `Bundle` should become a first-class packet family later.
- Rebundling or forwarding another node’s bundle should create a new bundle packet rather than revising the older bundle packet.
- Bundle history should be modeled as a lineage graph, not one shared revision chain.
- Legacy bundle JSON artifacts should remain runtime import/export adapters until that packet family exists.
