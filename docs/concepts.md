# OWA And Nexus Concepts

This file is a shared reference for recurring project terms. It should stay small, stable, and descriptive rather than becoming a fourth canon source.

## Element

The universal identity anchor for people, assemblies, organizations, services, initiatives, and other actor-like entities.

## Scope

The context or lens around an element. `You` is the personal scope lens for the current actor.

## Assembly

A civic or geographic element whose semantics are governed by policy rather than by being a separate storage primitive.

## Initiative

A policy and template lineage. OWA is intended to be modeled as an initiative inside Nexus rather than as a hardcoded platform exception.

## Claim

A process packet for contest, challenge, correction, annotation, or role workflows. Relations such as `association` and `home_locality` are now written directly as Relation packets; Claims can target them later when scrutiny is needed.

Status: current code truth.

## Attestation

The current packet type for support, dispute, and other evidence-oriented signals.

Status: current code truth.

## Reaction

A lighter-weight sentiment or signal concept that remains a live modeling question. It is not yet a distinct canonical type in the current docs or code.

Status: open modeling question.

## Policy

A packet type used for configuration, thresholds, legitimacy references, and later execution rules.

## Decision

A governance artifact type. In current theory, decisions begin as legitimacy records and may later become effect-bearing through explicit policy.

Status: canon-candidate direction.

## Follow

A lightweight read or visibility relation. It helps an actor find updates without adopting policies or joining an action.

## Subscribe

A sync and adoption relation. `Relation(subtype: subscribes_to)` may target an initiative, action, policy, module, template, or packet set. It replaces a separate `adopts_policy` relation: adopting a policy is modeled as subscribing to that Policy packet. Subscription options can inherit default policies and dependencies, or exclude them and surface partial alignment.

## Association

A direct Relation between a subject and another packet, such as an element, initiative, action, or assembly. It records contextual standing without implying participation, residence, subscription, or a global permission rank.

## Official / Unofficial

Terms for initiative lineage and conformance visibility. They are not yet active product behavior in feeds, Library, or Explorer.

## Packet Explorer

A shell-level read-only inspection and traversal workspace, separate from Library.
