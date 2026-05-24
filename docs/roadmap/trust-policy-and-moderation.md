# Trust, Policy, And Moderation

## Trust and policy

Trust remains a major product-defining system.

Current direction:

- trust should stay inspectable and threshold-based
- roles should remain layered on scoped claims plus support or dispute evidence
- policies should define defaults where possible instead of hardcoding OWA behavior as universal law

## Moderation and automoderation backlog

- generic automoderation support with element-defined policy baselines
- actor-level moderation preference controls
- explainable visibility projection rather than opaque hidden filtering
- soft visibility controls first, with harder runtime enforcement only where clearly needed

## Packet-model questions to keep visible

- whether reactions should remain lightweight reaction-like signals or become a distinct type
- whether `vouch` and `flag` should become explicit reaction subtypes
- whether `Claim` and `Reaction` should stay split forever or eventually converge
- how recursive reaction graphs should be summarized safely in UI

These are active modeling questions, not current implementation commitments.
