/**
 * File: packet-action-service.ts
 * Description: Projects generic, runtime-owned PacketActions for packet cards and Explorer payloads.
 */

import type {
  NexusActionMap,
  BrowserQueryService,
} from '@core/contracts';
import type { PacketFamily } from '@core/schema/packet-schema';
import { PACKET_ACTION_DESCRIPTORS } from '@runtime/nexus/packet-action-contract';
import type {
  NexusPacketActionProjection,
  NexusPacketActionSurface,
  NexusPacketActionTargetInput,
  NexusPacketActionsBatchPayload,
  NexusPacketActionsBatchRequest,
} from '@runtime/nexus/nexus-api-types';
import { NexusPacketVerificationService } from '@runtime/nexus/server/verification-service';

const PACKET_ACTION_SURFACES: NexusPacketActionSurface[] = [
  'dashboard',
  'discussions',
  'votes',
  'roles',
  'trust',
  'library',
  'explorer',
];

const DISCUSSION_FAMILIES = new Set<PacketFamily>([
  'Discussion',
  'DiscussionSpace',
  'DiscussionForum',
  'DiscussionThread',
  'DiscussionPost',
  'DiscussionReply',
]);
const VOTE_FAMILIES = new Set<PacketFamily>(['Proposal', 'Vote', 'Decision']);
const ROLE_FAMILIES = new Set<PacketFamily>(['Role']);
const TRUST_FAMILIES = new Set<PacketFamily>([
  'Claim',
  'Relation',
  'Attestation',
  'Policy',
]);

function normalizeSurface(
  surface: unknown,
  fallback: NexusPacketActionSurface
): NexusPacketActionSurface {
  return typeof surface === 'string' &&
    (PACKET_ACTION_SURFACES as string[]).includes(surface)
    ? (surface as NexusPacketActionSurface)
    : fallback;
}

function getBestSurfaceForFamily(
  family: PacketFamily | null
): NexusPacketActionSurface {
  if (!family) {
    return 'library';
  }

  if (DISCUSSION_FAMILIES.has(family)) {
    return 'discussions';
  }

  if (VOTE_FAMILIES.has(family)) {
    return 'votes';
  }

  if (ROLE_FAMILIES.has(family)) {
    return 'roles';
  }

  if (TRUST_FAMILIES.has(family)) {
    return 'trust';
  }

  return 'library';
}

function createBaseActionMap(input: {
  packetId: string;
  revisionId: string | null;
  family: PacketFamily | null;
  currentSurface: NexusPacketActionSurface;
  preferredSurface: NexusPacketActionSurface;
  verificationSummaryAvailable: boolean;
  hasLocalVerificationSummary: boolean;
}): NexusActionMap {
  const target = {
    target_packet_id: input.packetId,
    target_revision_id: input.revisionId,
    target_family: input.family,
  };

  return {
    'packet.focus': {
      id: 'packet.focus',
      visible: true,
      enabled: true,
      reason: null,
      ...target,
      target_surface: input.preferredSurface,
      target_intent: 'focus',
    },
    'packet.open_surface': {
      id: 'packet.open_surface',
      visible: false,
      enabled: true,
      reason: null,
      ...target,
      target_surface: input.preferredSurface,
      target_intent: 'open',
    },
    'packet.open_explorer': {
      id: 'packet.open_explorer',
      visible: input.currentSurface !== 'explorer',
      enabled: true,
      reason: null,
      ...target,
      target_surface: 'explorer',
      target_intent: 'open',
    },
    'packet.validate': {
      id: 'packet.validate',
      visible: !input.hasLocalVerificationSummary,
      enabled: true,
      reason: null,
      ...target,
    },
    'packet.revalidate': {
      id: 'packet.revalidate',
      visible: input.hasLocalVerificationSummary,
      enabled: true,
      reason: null,
      ...target,
    },
    'packet.view_verification': {
      id: 'packet.view_verification',
      visible: input.verificationSummaryAvailable,
      enabled: true,
      reason: null,
      ...target,
      target_surface: 'explorer',
      target_primary_tab: 'verification',
      target_intent: 'open',
    },
    'packet.view_library': {
      id: 'packet.view_library',
      visible: input.currentSurface !== 'library',
      enabled: true,
      reason: null,
      ...target,
      target_surface: 'library',
      target_intent: 'focus',
    },
    'packet.view_raw': {
      id: 'packet.view_raw',
      visible: true,
      enabled: true,
      reason: null,
      ...target,
      target_surface: 'explorer',
      target_view: 'raw',
    },
    'packet.export': {
      id: 'packet.export',
      visible: true,
      enabled: true,
      reason: null,
      ...target,
      target_surface: 'explorer',
      target_home_subtab: 'export',
    },
    'packet.copy_id': {
      id: 'packet.copy_id',
      visible: true,
      enabled: true,
      reason: null,
      ...target,
    },
  };
}

export class NexusPacketActionService {
  private readonly browserQueryService: BrowserQueryService;
  private readonly verificationService: NexusPacketVerificationService;

  constructor(
    browserQueryService: BrowserQueryService,
    verificationService: NexusPacketVerificationService
  ) {
    this.browserQueryService = browserQueryService;
    this.verificationService = verificationService;
  }

  async projectPacketActions(input: {
    target: NexusPacketActionTargetInput;
    currentSurface?: NexusPacketActionSurface | null;
  }): Promise<NexusPacketActionProjection> {
    const packetId = input.target.packet_id;
    const fallbackSurface = normalizeSurface(input.currentSurface, 'library');
    const packetProjection =
      input.target.family && input.target.title && input.target.label
        ? null
        : await this.browserQueryService.getPacket({ packet_id: packetId });
    const family = input.target.family ?? packetProjection?.family ?? null;
    const preferredSurface = normalizeSurface(
      input.target.preferred_surface,
      getBestSurfaceForFamily(family)
    );
    const revisionId =
      input.target.revision_id ?? packetProjection?.revision.revision_id ?? null;
    const verificationOverview =
      await this.verificationService.getVerificationOverview(packetId);

    return {
      packet_id: packetId,
      revision_id: revisionId,
      family,
      label: input.target.label ?? packetProjection?.label ?? null,
      title: input.target.title ?? packetProjection?.title ?? null,
      summary: input.target.summary ?? packetProjection?.summary ?? null,
      preferred_surface: preferredSurface,
      verification_summary: verificationOverview.verificationSummary,
      actions: createBaseActionMap({
        packetId,
        revisionId,
        family,
        currentSurface: fallbackSurface,
        preferredSurface,
        verificationSummaryAvailable: verificationOverview.hasAnyReport,
        hasLocalVerificationSummary: verificationOverview.hasFreshLocalReport,
      }),
      action_descriptors: PACKET_ACTION_DESCRIPTORS,
    };
  }

  async projectPacketActionsBatch(
    request: NexusPacketActionsBatchRequest
  ): Promise<NexusPacketActionsBatchPayload> {
    const currentSurface = normalizeSurface(request.surface, 'dashboard');
    const projections = await Promise.all(
      request.targets.map((target) =>
        this.projectPacketActions({
          target,
          currentSurface,
        })
      )
    );

    return {
      scope_id: request.scope_id ?? null,
      viewer_actor_packet_id: request.viewer_actor_packet_id ?? null,
      surface: currentSurface,
      projections,
    };
  }
}
