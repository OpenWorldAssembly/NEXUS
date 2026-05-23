# Nexus Packet Taxonomy v0.2 (Working Notes)

Status: Working ontology draft  
Layer: Core Nexus  
Purpose: Establish a concise, durable semantic foundation for packet types/types before broader schema expansion.

---

# Core Design Principles

## Packets Are Durable Semantic Types

A packet type should exist only when the object:

- needs portable identity
- may be signed or attested
- may be revised
- may be imported/exported
- may participate in graph relationships
- may require compatibility adaptation
- may need trust, provenance, or policy handling

UI controls, helper objects, temporary projections, and surface-specific workflows should not become packet types unless they need durable portable semantics.

---

## Semantic Separation

### Claims

Claims are unresolved processes requiring attention and eventual resolution.

Examples:

- moderation flags
- payment requests
- payment disputes
- IRL disputes
- fraud reports
- identity challenges
- reimbursement requests
- safety concerns

Claims have lifecycle state:

- opened
- acknowledged
- under review
- resolved
- rejected
- withdrawn
- escalated
- expired

Claims are resolved through reports and governed by policy.

---

### Attestations

Attestations are statements, signals, verifications, or endorsements.

They do not inherently create governance outcomes or relationships.

Important distinction:

There are separate signal lanes for:

1. Visibility / attention / usefulness
2. Agreement / approval / stance

This allows content to receive high visibility while still carrying disagreement, concern, or negative context.

Examples:

- attention_signal
- agreement/disagreement
- approval/disapproval
- verification
- endorsement
- evidence reference
- completion confirmation
- witness statement

Votes are currently treated as formalized attestation forms.
Voting rules belong to proposals/policies, not individual vote objects.

---

### Reports

Reports record observations, outcomes, resolutions, audits, or operational history.

Examples:

- mission report
- after-action report
- resolution
- outcome
- tally
- audit
- incident report
- receipt
- observation
- status update

Claims are often closed by reports.
Proposals may finalize into outcome reports.

---

### Policies

Policies define rules, constraints, eligibility, visibility, dependency, inheritance, moderation, and governance behavior.

Dependencies are currently treated as policy subtypes rather than a separate packet type.

---

# Current Working Packet Types

## element

Identity and scope anchors.

Potential subtypes:

- person
- locality
- assembly
- organization
- node
- service
- group

## relationship

Durable graph edges between elements or packets.

Potential subtypes:

- follow
- associate
- subscribe
- reside
- member
- role
- parent_child
- equivalent_to
- delegates_to

## attestation

Statements, signals, approvals, verifications, and evidence support.

Potential subtypes:

- attention_signal
- stance_signal
- verification
- endorsement
- evidence
- witness
- completion

## claim

Open issues, disputes, requests, or flags requiring resolution.

Potential subtypes:

- moderation
- payment_request
- payment_dispute
- identity_challenge
- fraud_report
- safety_flag
- reimbursement_request

## policy

Rules and governance constraints.

Potential subtypes:

- quorum
- eligibility
- moderation
- visibility
- dependency
- inheritance
- privacy
- participation
- standing

## preference

Personal or element-owned behavior/display preferences.

Current active subtype:

- element, currently used for actor-owned scope-display preferences such as visible main scopes and parent-chain display toggles

## config

Node/runtime/local operational configuration.

Potential subtypes:

- node
- runtime
- projection
- sync
- storage
- accepted_definition_sources
- accepted_action_registries

## definition

Packet definition and schema ecosystem.

Potential subtypes:

- packet_manifest
- packet_schema
- packet_template
- packet_action_registry
- packet_builder_descriptor
- packet_projection_descriptor
- packet_dependency_manifest
- packet_validation_descriptor

## compatibility

Compatibility adapters and migration semantics.

Potential subtypes:

- packet_adapter
- schema_adapter
- protocol_adapter
- loss_profile
- adapter_chain
- migration_note

## bundle

Portable inventory/manifests for packet collections.

Potential subtypes:

- export
- sync
- archive
- release
- sealed
- evidence_pack
- definition_pack

## discussion

Conversation and deliberation structures.

Potential subtypes:

- thread
- post
- reply
- annotation
- summary
- moderator_note

## proposal

Requests for adoption, change, execution, or governance decisions.

Potential subtypes:

- signal
- policy_change
- charter_change
- action_request
- relationship_request
- definition_adoption
- moderation_action

## action

Operational coordination and execution structures.

Potential subtypes:

- initiative
- program
- campaign
- project
- mission
- task
- event

## report

Operational history, observations, outcomes, and resolution records.

Potential subtypes:

- mission_report
- after_action
- resolution
- outcome
- tally
- audit
- incident
- observation
- receipt
- status_update

## module

Reusable operational kits and capability packages.

Potential subtypes:

- workflow
- checklist
- sop
- training
- template_pack
- rolepath
- communications_protocol

## resource

References to external or embedded material.

Potential subtypes:

- document
- media
- attachment
- dataset
- url
- blob_ref
- evidence_ref

## location

Spatial/geographic reference data.

Potential subtypes:

- point
- boundary
- route
- venue
- address_alias
- geo_ref
- coverage_area
