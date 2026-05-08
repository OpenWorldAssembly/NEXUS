# Trust, Moderation, And Policy

## Trust direction

Trust should remain layered, inspectable, and threshold-based rather than collapsing into a hidden score.

Current code truth:

- trust stages are currently explicit and threshold-based
- support and dispute evidence are packet-backed
- role posture is projected from scoped claims plus claim-targeted attestations

Direction:

- trust should stay scope-local
- trust should gate posting, voting, review, moderation, or role authority only through explicit policy and thresholds
- evidence and posture should remain inspectable even when defaults hide or deprioritize low-trust activity

## Moderation and automoderation

Status: canon candidate

### Current code truth

- moderation workflows are not yet fully implemented
- some read surfaces already expose packet-backed evidence and action visibility
- disabled placeholders are visible in several surfaces

### Direction

- automoderation should be a generic feature, not a route-local trick
- default moderation baselines should come from the relevant element's policy
- user-level moderation preferences should be available as adjustable policy or settings choices, similar in spirit to write protection preferences
- moderation should primarily act as visibility projection over packet and attestation graphs before it becomes hard rejection logic

### Unresolved

- which moderation controls belong in generic policy versus OWA default policy
- which interactions should remain soft projection versus hard runtime enforcement
- how much moderation preference state should be actor-level policy versus client-level shell preference

## Attestations, reactions, and claims

Status: canon candidate

### Current code truth

- `Relation` is the structural family for adopted graph facts
- `Claim` is its own live packet family for assertions, arguments, and disputable relation claims
- `Attestation` is its own live packet family for evidence, certification, support/dispute, and packet-signal responses
- current discussion voting uses packet-signal attestations rather than a separate reaction family
- current claim support and dispute still run through the attestation service and attestation indexes

### Direction

- keep `Claim` and `Attestation` distinct
- treat `Claim` as the forward layer for relation assertions and other packet-targeted arguments
- treat `Attestation` as the forward layer for supporting, disputing, certifying, or signaling around packets, including Claims and Relations
- do not require Claim wrappers for every Relation
- let policy require supporting Claims for legitimacy-sensitive Relations where needed

Current implementation note:

- the new `Policy.relation_requirements` seam exists so rules like OWA home-locality support can be expressed generically instead of being hardcoded as route-only logic
- this chapter should be read before changing `Claim`, `Attestation`, `Relation`, or `Policy` semantics because it owns the intended separation between assertion, evidence, graph structure, and policy requirements
