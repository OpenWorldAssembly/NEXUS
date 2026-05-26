# OWA And Nexus Concepts

This file is a shared reference for recurring project terms. It should stay small, stable, and descriptive rather than becoming a fourth canon source.

## Packet

A canonical, signed, verifiable record. Packets are stored in the packet archive, linked through refs and edges, and projected into UI surfaces. The interface renders packet graph state; it is not the source of packet truth.

## Packet Definition

A packet-backed declaration of packet semantics. Definitions describe packet shape, builders, defaults, dependencies, policy requirements, actions, and eventual projection hints. Imported definitions describe behavior but do not execute local runtime code.

## Core Contracts Vault

The portable Nexus layer that owns packet law and machinery: schemas, builders, definitions, defaults, dependencies, validation, graph logic, compatibility, canonicalization, and verification rules. It does not own the database, private keys, routes, or UI state.

## Trusted Runtime Coordinator

An enrolled runtime workflow owner for secure operations such as dispatch, validation, regulation, planning, building, inspection, testing, certification, archival, verification, import, export, and projection. Coordinators feed live context through core contracts and execute trusted local code.

## Packet Archive

The runtime-managed packet store. It preserves signed packet history, revisions, imported bundles, verification reports, and runtime indexes. SQLite is the current storage adapter.

## Signal Cockpit

The interface layer. It emits user intents, shows process state, handles confirmations and signing prompts, and renders projections through reusable surfaces and components.

## Element

The universal identity anchor for people, assemblies, organizations, services, initiatives, and other actor-like entities.

## Scope

The context or lens around an element. `You` is the personal scope lens for the current actor.

## Assembly

A civic or geographic element whose semantics are governed by policy rather than by being a separate storage primitive.

## Initiative

A policy and template lineage. OWA is intended to be modeled as an initiative inside Nexus rather than as a hardcoded platform exception.

## Defaults Definition

A definition part that describes normal starting values or default generated packet plans. Defaults create a healthy starting shape, such as an element normally receiving a discussion space or a forum normally receiving a welcome topic.

## Dependencies Definition

A definition part that describes required structural refs or requirements. Dependencies prevent orphan packets, such as a forum without a discussion space or a vote without a target.

## Policy

A packet type used for configuration, thresholds, legitimacy references, and process rules. Policies regulate what may happen in a scope, who may do it, and which defaults or workflows are enabled.

## Projection

A runtime read model generated from packets and packet definitions. Projections shape graph state into UI-ready surfaces, available actions, badges, and display fields without letting the UI become packet authority.

## Claim

A process packet for contest, challenge, correction, annotation, or role workflows. Relations such as `association` and `residence` are now written directly as Relation packets; Claims can target them later when scrutiny is needed.

Status: current code truth.

## Reaction

The current packet type for target-agnostic responses. It can carry `vote_value`, `attestation_value`, `emoji_keys`, and optional note text. Support and dispute are attestation values, not separate Claim subtypes.

Status: current code truth.

## Decision

A governance artifact type. In current theory, decisions begin as legitimacy records and may later become effect-bearing through explicit policy.

Status: canon-candidate direction.

## Follow

A lightweight read or update relation. It helps an actor find updates without adopting policies or joining an action.

## Subscribe

A sync and adoption relation. `Relation(subtype: subscription)` may target an initiative, action, policy, module, template, or packet set. It replaces a separate `adopts_policy` relation: adopting a policy is modeled as subscribing to that Policy packet. Subscription options can inherit default policies and dependencies, or exclude them and surface partial alignment.

## Association

A direct Relation between a subject and another packet, such as an element, initiative, action, or assembly. It records contextual standing without implying participation, residence, subscription, or a global permission rank.

## Official / Unofficial

Terms for initiative lineage and conformance visibility. They are not yet active product behavior in feeds, Library, or Explorer.

## Packet Explorer

A shell-level read-only inspection and traversal workspace, separate from Library.
