/**
 * File: trusted-write-migration-audit.ts
 * Description: Runtime migration ledger from live mutation intents to trusted write workflow coverage.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import type { MutationActionId } from '@core/auth/write-policy';
import type { PacketOperationKind } from '@core/packets/packet-operation-ontology';
import type { MutationIntentDescriptor } from '@runtime/nexus/server/mutation-intent-registry';
import { listMutationIntentDescriptors } from '@runtime/nexus/server/mutation-intent-registry';

export type TrustedWriteMigrationStatus =
  | 'generic_ready'
  | 'planner_extraction_needed'
  | 'workflow_specific'
  | 'legacy_bridge';

export type TrustedWriteOperationMappingStatus =
  | 'definition_operation_ready'
  | 'composite_workflow_adapter'
  | 'runtime_specific_workflow'
  | 'pending_mapping';

export type TrustedWriteMigrationEntry = {
  mutation_intent: MutationIntent['kind'];
  canonical_intent?: MutationIntent['kind'];
  domain: MutationIntentDescriptor['domain'];
  migration_status: TrustedWriteMigrationStatus;
  operation_mapping_status: TrustedWriteOperationMappingStatus;
  operation_kinds: PacketOperationKind[];
  policy_action_ids: MutationActionId[];
  notes: string;
  next_step: string;
};

const MIGRATION_ENTRIES_BY_INTENT: Partial<
  Record<MutationIntent['kind'], Omit<TrustedWriteMigrationEntry, 'mutation_intent' | 'domain'>>
> = {
  'relation.association.add': {
    migration_status: 'generic_ready',
    operation_mapping_status: 'definition_operation_ready',
    operation_kinds: ['relation.set'],
    policy_action_ids: ['relation.association.add'],
    notes:
      'Association writes are enrolled through the trusted generic Relation workflow and scoped relation planner.',
    next_step:
      'Keep relation workflow parity green while policy/dependency semantics are hardened for reseed.',
  },
  'relation.association.clear': {
    migration_status: 'generic_ready',
    operation_mapping_status: 'definition_operation_ready',
    operation_kinds: ['relation.clear'],
    policy_action_ids: ['relation.association.clear'],
    notes:
      'Association clears are enrolled through the trusted generic Relation workflow and scoped relation planner.',
    next_step:
      'Keep relation workflow parity green while policy/dependency semantics are hardened for reseed.',
  },
  'relation.residence.add': {
    migration_status: 'generic_ready',
    operation_mapping_status: 'definition_operation_ready',
    operation_kinds: ['relation.set'],
    policy_action_ids: ['relation.residence.add', 'relation.residence.clear'],
    notes:
      'Residence writes are enrolled through the trusted generic Relation workflow and home locality relation planner.',
    next_step:
      'Keep relation workflow parity green while policy/dependency semantics are hardened for reseed.',
  },
  'relation.follow.add': {
    migration_status: 'generic_ready',
    operation_mapping_status: 'definition_operation_ready',
    operation_kinds: ['relation.set'],
    policy_action_ids: ['relation.follow.add'],
    notes:
      'Follow writes are enrolled through the trusted generic Relation workflow.',
    next_step:
      'Keep relation workflow parity green while policy/dependency semantics are hardened for reseed.',
  },
  'relation.follow.clear': {
    migration_status: 'generic_ready',
    operation_mapping_status: 'definition_operation_ready',
    operation_kinds: ['relation.clear'],
    policy_action_ids: ['relation.follow.clear'],
    notes:
      'Follow clears are enrolled through the trusted generic Relation workflow.',
    next_step:
      'Keep relation workflow parity green while policy/dependency semantics are hardened for reseed.',
  },
  'relation.participation.add': {
    migration_status: 'generic_ready',
    operation_mapping_status: 'definition_operation_ready',
    operation_kinds: ['relation.set'],
    policy_action_ids: ['relation.participation.add'],
    notes:
      'Role participation writes are enrolled through the trusted generic Relation workflow.',
    next_step:
      'Keep relation workflow parity green while replacing stale role-specific adapter routes with canonical Dispatch ingress.',
  },
  'relation.participation.clear': {
    migration_status: 'generic_ready',
    operation_mapping_status: 'definition_operation_ready',
    operation_kinds: ['relation.clear'],
    policy_action_ids: ['relation.participation.clear'],
    notes:
      'Role participation clears are enrolled through the trusted generic Relation workflow.',
    next_step:
      'Keep relation workflow parity green while replacing stale role-specific adapter routes with canonical Dispatch ingress.',
  },
  'reaction.vote.set': {
    migration_status: 'generic_ready',
    operation_mapping_status: 'definition_operation_ready',
    operation_kinds: ['reaction.set', 'reaction.clear'],
    policy_action_ids: ['reaction.vote.set', 'reaction.vote.clear'],
    notes:
      'Packet vote reactions are enrolled through the trusted generic Reaction workflow.',
    next_step:
      'Keep reaction workflow parity green while reaction service storage touches are classified for Archive migration.',
  },
  'discussion.reply.create': {
    migration_status: 'planner_extraction_needed',
    operation_mapping_status: 'composite_workflow_adapter',
    operation_kinds: ['single_packet.create'],
    policy_action_ids: ['discussion.reply.create'],
    notes:
      'Reply creation has a definition workflow and a trusted composite workflow adapter; remaining work is adapter decomposition around discussion service behavior.',
    next_step:
      'Move discussion-specific runtime lookups behind reusable planner/resolver seams when discussion workflows are decomposed.',
  },
  'locality.path.create': {
    migration_status: 'workflow_specific',
    operation_mapping_status: 'composite_workflow_adapter',
    operation_kinds: ['workflow.compose', 'single_packet.create', 'relation.set', 'projection.refresh'],
    policy_action_ids: ['locality.element.create', 'relation.residence.add'],
    notes:
      'Locality path creation remains a composed runtime workflow with directory projection side effects.',
    next_step:
      'Keep the composite adapter as the current authority until locality workflow decomposition is explicit.',
  },
  'locality.graph.apply': {
    migration_status: 'workflow_specific',
    operation_mapping_status: 'composite_workflow_adapter',
    operation_kinds: [
      'workflow.compose',
      'single_packet.create',
      'relation.set',
      'relation.clear',
      'projection.refresh',
    ],
    policy_action_ids: [
      'locality.element.create',
      'relation.residence.add',
      'relation.residence.clear',
      'relation.association.add',
      'relation.association.clear',
      'relation.follow.add',
      'relation.follow.clear',
    ],
    notes:
      'Locality graph application remains a composed runtime workflow with multi-scope relation planning.',
    next_step:
      'Keep the composite adapter as the current authority until locality workflow decomposition is explicit.',
  },
  'discussion.thread_post.create': {
    migration_status: 'workflow_specific',
    operation_mapping_status: 'composite_workflow_adapter',
    operation_kinds: ['workflow.compose', 'single_packet.create'],
    policy_action_ids: ['discussion.post.create'],
    notes:
      'Thread post creation remains a composed discussion workflow rather than a single generic operation.',
    next_step:
      'Extract reusable discussion creation planners after packet definition work stabilizes.',
  },
  'discussion.surfaces.ensure': {
    migration_status: 'workflow_specific',
    operation_mapping_status: 'composite_workflow_adapter',
    operation_kinds: ['workflow.compose', 'single_packet.create'],
    policy_action_ids: ['discussion.surfaces.ensure'],
    notes:
      'Default discussion surface creation remains a composed ensure workflow.',
    next_step:
      'Extract default-surface planning behind reusable Definition-owned defaults after reseed.',
  },
  'assembly.element.create': {
    migration_status: 'workflow_specific',
    operation_mapping_status: 'composite_workflow_adapter',
    operation_kinds: ['workflow.compose', 'single_packet.create', 'relation.set', 'projection.refresh'],
    policy_action_ids: ['assembly.element.create', 'relation.follow.add'],
    notes:
      'Assembly element creation remains an entity-creation workflow with follow-up packets and projections.',
    next_step:
      'Keep the composite adapter as current authority while element creation policy semantics are hardened.',
  },
  'reaction.attestation.set': {
    migration_status: 'workflow_specific',
    operation_mapping_status: 'composite_workflow_adapter',
    operation_kinds: ['reaction.set', 'reaction.clear'],
    policy_action_ids: ['reaction.attestation.set', 'reaction.attestation.clear'],
    notes:
      'Role attestation is composite-enrolled because its route/product behavior still carries participation-specific response metadata.',
    next_step:
      'Decide whether attestation can promote to the generic Reaction workflow after stale role routes are removed.',
  },
  'actor.write_policy.update': {
    migration_status: 'workflow_specific',
    operation_mapping_status: 'composite_workflow_adapter',
    operation_kinds: ['workflow.compose', 'single_packet.create', 'single_packet.revise'],
    policy_action_ids: ['actor.write_policy.update'],
    notes:
      'Actor write-policy updates remain policy-specific self-updating workflows with dedicated authority checks.',
    next_step:
      'Keep policy/dependency semantic authority audits green through reseed design.',
  },
  'preference.element.set': {
    migration_status: 'generic_ready',
    operation_mapping_status: 'definition_operation_ready',
    operation_kinds: ['single_packet.revise', 'projection.refresh'],
    policy_action_ids: ['preference.element.write'],
    notes:
      'Element preferences now use a definition-backed generic revision seam with projection metadata for scope display and shell chrome.',
    next_step:
      'Retire the compatibility cache write after the packet projection path fully replaces the legacy scope-display table.',
  },
};

export function listTrustedWriteMigrationEntries(): TrustedWriteMigrationEntry[] {
  return listMutationIntentDescriptors().map((descriptor) => {
    const entry = MIGRATION_ENTRIES_BY_INTENT[descriptor.kind];

    if (!entry) {
      return {
        mutation_intent: descriptor.kind,
        domain: descriptor.domain,
        migration_status: 'planner_extraction_needed',
        operation_mapping_status: 'pending_mapping',
        operation_kinds: [],
        policy_action_ids: [],
        notes: 'Mutation intent is registered but not yet mapped in the trusted write migration ledger.',
        next_step:
          'Classify this mutation intent before reseed readiness can be considered closed.',
      };
    }

    return {
      mutation_intent: descriptor.kind,
      domain: descriptor.domain,
      ...entry,
    };
  });
}
