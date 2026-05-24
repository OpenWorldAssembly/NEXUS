# Initiatives, Locality, And Subscriptions

## Initiative direction

Initiatives should be treated as generic Nexus policy and template lineages rather than OWA-specific hardcoding.

Working direction:

- OWA is one initiative inside Nexus
- assemblies can subscribe to recognized OWA policies, dependencies, templates, and packet sets while remaining valid Nexus objects if they fork
- official versus unofficial initiative lineage should be inspectable, not mystical

## Initiative backlog

- initiative versions and subscription or update behavior, using `Relation(subtype: subscription)` as the canonical adoption/sync edge
- current official versus older official version support
- subscription alignment projection that compares inherited policy/dependency requirements against deselected or locally overridden refs
- official versus unofficial visibility modes
- feed, search, Library, and Explorer filtering by initiative and version
- actor-level or client-level preferences for what initiative visibility modes to show

## Locality and scope backlog

- continue refining the `Global + You` baseline
- keep `residence` distinct from `association`
- keep canonical packet-native home locality relation writes and explicit compatibility projections as the base for later shell UI graph work
- keep packet-native follow and association relations as the base for the later shell graph UI pass
- treat the current ancestry and provisional `Location(region)` writer path as the new locality substrate rather than as pending exploratory work
- locality UX pass 1 is now the active baseline: guided search, search-to-create handoff, non-mutating review, actionable duplicate warnings, explicit home-locality toggle, and a preview-only home-branch checklist are all live
- locality foundations phase 2A is now the active next layer underneath that UI: descriptor-first locality rows, Unicode-safe normalization, sparse ordered ancestry, and descriptor storage in linked `Location.spatial_payload`
- the current runtime catch-up layer now sits between locality foundations and the later schema chapter: composite locality graph apply, centralized home or association or follow relation reads, temporary claimed-actor `main` visibility preferences, and server-projected shell sections are now the active bridge
- locality foundations phase 2B should then make home-tree inclusion and projection fields authoritative without redesigning the shell
- after that, continue locality standardization through provider-neutral candidate mapping, aliases, external refs, duplicate or equivalence handling, and broader non-US administrative structures
- preserve the distinction between mounted scopes, followed scopes, and merely known scopes
- follow the current runtime/projection catch-up pass with the schema chapter that packetizes preferences and broader relation semantics, then continue with the dedicated locality-standardization and provider pass rather than collapsing all three into one change set
- defer shared assembly custody or keyset work until after semantic foundations are clearer
- keep first-class `Bundle` packet work explicitly after the current verification and locality-UX chapters rather than letting runtime transport bundles quietly harden into a forever format
