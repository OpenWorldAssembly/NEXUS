# Initiatives, Locality, And Subscriptions

## Initiative direction

Initiatives should be treated as generic Nexus policy and template lineages rather than OWA-specific hardcoding.

Working direction:

- OWA is one initiative inside Nexus
- assemblies can follow recognized OWA dependencies and templates while remaining valid Nexus objects if they fork
- official versus unofficial initiative lineage should be inspectable, not mystical

## Initiative backlog

- initiative versions and subscription or update behavior
- current official versus older official version support
- official versus unofficial visibility modes
- feed, search, Library, and Explorer filtering by initiative and version
- actor-level or client-level preferences for what initiative visibility modes to show

## Locality and scope backlog

- continue refining the `Global + You` baseline
- keep `home_locality` distinct from `assembly_association`
- keep canonical packet-native home locality relation writes and explicit compatibility projections as the base for later shell UI graph work
- improve canonical locality directory behavior and creation quality
- preserve the distinction between mounted scopes, followed scopes, and merely known scopes
- follow the current scope-graph consumer pass with a dedicated shell UI pass and then a dedicated location-creation pass rather than collapsing all three into one change set
- defer shared assembly custody or keyset work until after semantic foundations are clearer
