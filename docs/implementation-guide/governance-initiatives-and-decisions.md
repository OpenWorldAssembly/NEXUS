# Governance, Initiatives, And Decisions

## Initiatives

Status: canon candidate

### Current code truth

- initiative-specific filtering, subscriptions, and version visibility are not yet active product behavior
- current code does not yet implement initiative-version subscriptions or official versus unofficial filtering

### Direction

- `Action(subtype: initiative)` is the forward top-level initiative packet for policy, template lineage, default packet sets, and later work hierarchy
- `OWA` should be modeled as an initiative Action inside Nexus, not as a hardcoded exception
- `Cause` is no longer an active fresh packet type
- lower work hierarchy levels should be represented through Action subtypes such as `campaign`, `program`, `mission`, and provisional `task`
- "official OWA" should mean conforming to recognized OWA dependencies, templates, and policies
- dependency requirements remain policy-layer semantics; `depends_on` is not a Relation subtype
- policy adoption is modeled by `Relation(subtype: subscribes_to)` targeting a Policy, not by a separate `adopts_policy` relation subtype
- assemblies remain valid Nexus objects even when they fork or diverge from canonical OWA lineage

### Unresolved

- the exact packet/API shape for initiative conformance and recognition beyond Action refs and policies
- how official, unofficial, derived, and forked initiative states should be encoded

## Initiative versioning and subscriptions

Status: canon candidate

### Direction

Initiative lineage should support version-aware adoption and viewing, including:

- current official version
- older official versions
- upgrade availability
- optional inclusion of unofficial forks

Subscriptions and default visibility should eventually support choices like:

- current official only
- all official versions
- official plus unofficial
- multiple initiatives together
- inherited default policies/dependencies with explicit deselection and visible partial-alignment states

### Unresolved

- the exact version packet or metadata shape
- whether subscriptions belong primarily to actor policy, shell preference, or both
- how version compatibility and upgrade prompts should surface in Explorer and feeds

## Assemblies, custody, and legitimacy

Status: canon candidate

### Direction

- assemblies are elements with policy-governed civic semantics, not owned subsidiaries
- custody, legitimacy, policy authority, and governance outcome should remain distinct concepts
- association should remain a simple claim first; typed categories are unsupported
- multi-key assembly authority, custody transition, and protected-state mutation should remain explicit later design work

### Unresolved

- the exact custody and multi-key packet model
- how authority grants or keyset policies should be represented
- how passed decisions eventually authorize protected state changes

## Proposals and decisions

Status: canon candidate

### Current code truth

- votes remain read-only
- proposals, votes, and decisions are not yet a fully interactive trusted workflow

### Direction

- decisions should begin as legitimacy records and civic signals
- policy may later allow some decisions to activate real effects
- proposals should declare their intended outcome as explicitly and programmatically as possible
- quorum, eligibility, minimum trust, approval thresholds, and voting gates should come from packet-backed Policy defaults attached through the applicable initiative Action, scope, or proposal context rather than from hardcoded Vote fields
- a `Decision` should remain the formal outcome artifact, while `Report(subtype: decision_report)` is reserved for evidence, tally, and process-context closure material

Proposal outcome categories should eventually include:

- policy adoption
- mission or coordination plan
- resolution
- signal or poll
- other explicit action packages

Automatic execution should only be described as future behavior for explicitly supported built-in action handlers or canonical approval artifacts.

### Unresolved

- which decision types can become effect-bearing first
- how multi-key assembly authority interacts with execution
- whether execution produces direct mutations, canonical approval packets, or both
