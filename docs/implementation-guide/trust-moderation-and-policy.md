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
- packet-native follow does not currently require a supporting claim in this phase
- packet-native assembly association does currently keep a supporting self-issued `Claim(subtype: relation_assertion)` alongside the structural relation

Current home-locality policy note:

- OWA-sensitive home-locality legitimacy now resolves from the forward `Cause(subtype: initiative)` anchor plus linked policy packets
- a canonical `Relation(subtype: home_locality)` can exist structurally without counting as the effective mounted home locality if its governing `Policy.relation_requirements` are unsatisfied
- the expected support model in this phase is a supporting `Claim(subtype: relation_assertion)`, not a required attestation
- legacy claim-only home-locality reads remain compatibility projections, not the forward legitimacy model

## Longer-term civic review framing

Direction:

- `Claim` should be understood as an unresolved assertion or request that invites evaluation, scrutiny, or action
- `Attestation` should be understood as a signed stance toward a target, such as support, dispute, certification, rejection, or abstention
- a `Vote` should remain a governed attestation inside a recognized process with eligibility and policy rules
- `Report` should be the long-term home for findings, outcomes, and context around a target
- a resolution or decision artifact should eventually read as a process-backed closure report rather than as unexplained authority

This framing is architectural direction, not a statement that all of those packet families or workflow surfaces already exist as live runtime behavior.

## Verification truthfulness direction

Future verification UI and policy language should distinguish at least:

- structurally valid
- cryptographically verified
- provenance known
- locally trusted
- substantively true

Current product language does not yet fully expose those distinctions. The next verification/reporting work should avoid collapsing them all into one vague `verified` concept.

Current verification chapter truth:

- the runtime now signs `verification_report` and `import_report` packets with a normal local validator identity
- those report packets are the signed record of what the node concluded
- a local runtime-owned verification index/cache exists so dashboard cards, Explorer search rows, export lookup rows, action menus, and Explorer verification views can project truthful current status quickly
- imported external verification reports are readable evidence, but local trusted status still comes only from the latest local validator report in this phase
