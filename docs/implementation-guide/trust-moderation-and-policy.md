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

- `Claim` is still its own packet family
- `Attestation` is still its own packet family
- current discussion voting uses packet-signal attestations rather than a separate reaction family

### Direction

- keep the current `Claim` split in code for now
- record a live design question about whether the long-term model should converge toward a broader attestation umbrella with subtypes such as:
  - `reaction`
  - `voucher`
  - `objection`
  - `claim`
- keep the semantics distinction clear even if the long-term storage model converges

### Unresolved

- whether reactions deserve their own base family or should remain an attestation-like subtype
- whether `vouch` and `flag` should become explicit attestation subtypes
- whether claims should ever collapse into a generalized attestation family

This is an active modeling question, not a current implementation decision.
