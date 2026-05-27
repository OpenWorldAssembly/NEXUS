/**
 * File: nexus-packet-explorer-inspection-panels.tsx
 * Description: Feature-local packet inspection panels for Packet Explorer.
 */
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import type {
  NexusPacketVerificationStatus,
  NexusPacketVerificationSummary,
} from '@core/contracts';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusLoadingBoundary,
  useNexusAppearance,
} from '@app/components/nexus/ui';
import type { NexusPacketExplorerPayload } from '@runtime/nexus/nexus-api-types';
import type {
  PacketExplorerPrimaryTab,
  PacketExplorerTab,
} from '@runtime/nexus/packet-explorer-session';

import { NexusPacketExplorerDataPanel } from './nexus-packet-explorer-data-panel';
import { NexusPacketExplorerLinksPanel } from './nexus-packet-explorer-links-panel';
import {
  formatActionLabel,
  getActionState,
  getActionsBasisLabel,
  getViewModeLabel,
} from './nexus-packet-explorer-utils';

type PacketExplorerRoutePacketInput = {
  packetId: string;
  preferredRevisionId?: string | null;
  titleSnapshot?: string | null;
  seedSummary?: {
    type: string | null;
    summary: string | null;
    label: string | null;
  } | null;
  activePrimaryTab?: 'data' | 'lineage' | 'verification' | 'links' | 'actions';
};

function formatVerificationStatusLabel(
  status: NexusPacketVerificationStatus | null
): string {
  switch (status) {
    case 'trusted_signer':
      return 'Locally validated';
    case 'unknown_signer':
      return 'Signer unavailable locally';
    case 'signature_invalid':
      return 'Invalid signature';
    case 'canonicalization_mismatch':
      return 'Canonicalization mismatch';
    case 'external_report_only':
      return 'External report only';
    case 'unsigned':
      return 'Unsigned';
    case 'signature_valid':
      return 'Signature valid';
    default:
      return 'Not validated';
  }
}

function formatVerificationFreshnessLabel(
  freshness: NexusPacketExplorerPayload['verification_freshness']
): string {
  switch (freshness) {
    case 'current':
      return 'Current';
    case 'stale':
      return 'Stale';
    default:
      return 'No local validation yet';
  }
}

function formatVerificationDetailLabel(
  kind:
    | 'signature'
    | 'signer'
    | 'trust'
    | 'provenance'
    | 'compatibility'
    | 'structural',
  value:
    | NexusPacketVerificationSummary['signature_status']
    | NexusPacketVerificationSummary['signer_status']
    | NexusPacketVerificationSummary['local_trust_status']
    | NexusPacketVerificationSummary['provenance_status']
    | NexusPacketVerificationSummary['compatibility_status']
    | 'self_asserted'
    | 'unsigned'
    | boolean
    | null
): string {
  if (kind === 'structural') {
    return value === true ? 'Valid' : value === false ? 'Invalid' : 'Unknown';
  }

  switch (kind) {
    case 'signature':
      switch (value) {
        case 'valid':
          return 'Valid';
        case 'invalid':
          return 'Invalid';
        case 'unsigned':
          return 'Unsigned';
        default:
          return 'Unknown';
      }
    case 'signer':
      switch (value) {
        case 'known':
          return 'Known signer';
        case 'unknown':
          return 'Unknown signer';
        case 'self_asserted':
          return 'Self-asserted only';
        default:
          return 'Unknown';
      }
    case 'trust':
      switch (value) {
        case 'trusted':
          return 'Trusted locally';
        case 'untrusted':
          return 'Untrusted locally';
        default:
          return 'Unknown';
      }
    case 'provenance':
      switch (value) {
        case 'known':
          return 'Known';
        case 'unknown':
          return 'Unknown';
        default:
          return 'Unknown';
      }
    case 'compatibility':
      switch (value) {
        case 'native':
          return 'Native';
        case 'adapted':
          return 'Adapted';
        case 'lossy':
          return 'Lossy adaptation';
        case 'blocked':
          return 'Blocked';
        default:
          return 'Unknown';
      }
    default:
      return 'Unknown';
  }
}

export function NexusPacketExplorerSeededSummary({
  activeTab,
}: {
  activeTab: PacketExplorerTab;
}) {
  const appearance = useNexusAppearance();

  if (activeTab.kind !== 'packet') {
    return null;
  }

  return (
    <View className="gap-4">
      <NexusCard className="gap-4">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className={appearance.surfaceTitleClass}>
            {activeTab.title_snapshot}
          </Text>
          {activeTab.seed_summary?.type ? (
            <NexusBadge label={activeTab.seed_summary.type} tone="sky" />
          ) : null}
          <NexusBadge label="Seeded from current surface" tone="gold" />
        </View>

        <Text className={appearance.sectionBodyClass}>
          {activeTab.seed_summary?.summary ??
            activeTab.seed_summary?.label ??
            'Explorer is loading the full packet inspector payload.'}
        </Text>

        <View className="gap-2">
          <Text className={appearance.itemMetaClass}>
            Packet ID: {activeTab.packet_id}
          </Text>
          <Text className={appearance.itemMetaClass}>
            Preferred revision:{' '}
            {activeTab.preferred_revision_id ?? 'Loading current preferred revision...'}
          </Text>
        </View>
      </NexusCard>

      <NexusCard tone="gold">
        <Text className={appearance.itemBodyClass}>
          Loading packet details...
        </Text>
      </NexusCard>
    </View>
  );
}

function NexusPacketExplorerLineagePanel({
  payload,
}: {
  payload: NexusPacketExplorerPayload;
}) {
  const appearance = useNexusAppearance();

  return (
    <View className="gap-4">
      <NexusCard className="gap-3">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Revision State
          </Text>
          <NexusBadge label={getViewModeLabel(payload.inspection_lens)} tone="default" />
        </View>
        <Text className={appearance.surfaceTitleClass}>
          {payload.revision_state}
        </Text>
        <Text className={appearance.itemMetaClass}>
          Preferred revision: {payload.preferred_revision.revision_id}
        </Text>
        <Text className={appearance.itemMetaClass}>
          Head count: {payload.head_revisions.length}
        </Text>
        <Text className={appearance.itemBodyClass}>
          Current lineage remains revision-graph based while the inspection lens is{' '}
          {getViewModeLabel(payload.inspection_lens)}.
        </Text>
        <View className="flex-row flex-wrap gap-2">
          <NexusActionButton
            label="Compare revisions"
            disabled
            featureStatusId="explorer.lineage.compare_revisions"
          />
          <NexusActionButton
            label="Diff"
            disabled
            featureStatusId="explorer.lineage.diff"
          />
        </View>
      </NexusCard>

      <NexusCard className="gap-3">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          Head Revisions
        </Text>
        {payload.head_revisions.map((revision) => (
          <Text key={revision.revision_id} className={appearance.itemBodyClass}>
            {revision.revision_id}
          </Text>
        ))}
      </NexusCard>
    </View>
  );
}

function NexusPacketExplorerActionsPanel({
  payload,
}: {
  payload: NexusPacketExplorerPayload;
}) {
  const appearance = useNexusAppearance();

  return (
    <View className="gap-4">
      <NexusCard className="gap-3">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Action Basis
          </Text>
          <NexusBadge label={getViewModeLabel(payload.inspection_lens)} tone="default" />
          <NexusBadge label={getActionsBasisLabel(payload)} tone="gold" />
        </View>
        <Text className={appearance.itemBodyClass}>
          Actions remain operational/runtime affordances in this pass, even when
          the selected inspection lens is {getViewModeLabel(payload.inspection_lens)}.
        </Text>
      </NexusCard>

      {payload.action_descriptors.length === 0 ? (
        <NexusCard>
          <Text className={appearance.itemBodyClass}>
            No runtime action descriptors are projected for this packet yet.
          </Text>
        </NexusCard>
      ) : (
        payload.action_descriptors.map((descriptor) => {
          const actionState = getActionState(payload, descriptor);

          return (
            <NexusCard key={descriptor.id} className="gap-3">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className={appearance.surfaceTitleClass}>
                  {formatActionLabel(descriptor.id)}
                </Text>
                <NexusBadge label={descriptor.execution_kind} tone="sky" />
                {descriptor.mutation_kind ? (
                  <NexusBadge label={descriptor.mutation_kind} tone="gold" />
                ) : null}
                <NexusBadge
                  label={
                    actionState
                      ? actionState.enabled
                        ? 'enabled'
                        : 'blocked'
                      : 'not_applicable'
                  }
                  tone={
                    actionState
                      ? actionState.enabled
                        ? 'mint'
                        : 'rose'
                      : 'default'
                  }
                />
              </View>

              <Text className={appearance.itemMetaClass}>
                Action id: {descriptor.id}
              </Text>
              {descriptor.target_kind ? (
                <Text className={appearance.itemMetaClass}>
                  Target kind: {descriptor.target_kind}
                </Text>
              ) : null}
              {actionState ? (
                <View className="gap-2">
                  <Text className={appearance.itemBodyClass}>
                    Reason: {actionState.reason ?? 'Available'}
                  </Text>
                  {actionState.auth_gate_reason ? (
                    <Text className={appearance.itemMetaClass}>
                      Auth gate: {actionState.auth_gate_reason}
                    </Text>
                  ) : null}
                  {actionState.target_packet_id ? (
                    <Text className={appearance.itemMetaClass}>
                      Target packet: {actionState.target_packet_id}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text className={appearance.itemBodyClass}>
                  No runtime state is projected for this action on the current
                  packet.
                </Text>
              )}
            </NexusCard>
          );
        })
      )}
    </View>
  );
}

function NexusPacketExplorerValidationPanel({
  payload,
  onRunValidation,
}: {
  payload: NexusPacketExplorerPayload;
  onRunValidation: (packetId: string) => Promise<void>;
}) {
  const appearance = useNexusAppearance();
  const packetId = payload.packet_summary.packet.packet_id;
  const validationLoadingScope = `packet-explorer:validation:${packetId}`;
  const summary = payload.verification_summary;
  const validationStatusTone =
    summary?.status === 'trusted_signer'
      ? 'mint'
      : summary?.status === 'signature_invalid' ||
          summary?.status === 'canonicalization_mismatch'
        ? 'rose'
        : summary?.status === 'unsigned' ||
            summary?.status === 'unknown_signer' ||
            summary?.status === 'external_report_only'
          ? 'gold'
          : 'default';

  return (
    <NexusLoadingBoundary
      label="Validating packet..."
      scope={validationLoadingScope}
    >
      <View className="gap-4">
        <NexusCard className="gap-3">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
              Validation
            </Text>
            <NexusBadge
              label={formatVerificationStatusLabel(summary?.status ?? null)}
              tone={validationStatusTone}
            />
            <NexusBadge
              label={formatVerificationFreshnessLabel(payload.verification_freshness)}
              tone={
                payload.verification_freshness === 'current'
                  ? 'mint'
                  : payload.verification_freshness === 'stale'
                    ? 'gold'
                    : 'default'
              }
            />
            <NexusActionButton
              label={
                payload.verification_freshness === 'current'
                  ? 'Revalidate'
                  : 'Validate'
              }
              loadingScope={validationLoadingScope}
              onPress={() => onRunValidation(packetId)}
            />
          </View>
          <Text className={appearance.itemBodyClass}>
            Local validator: {payload.local_validator_packet_id ?? 'Unavailable'}
          </Text>
          <Text className={appearance.itemBodyClass}>
            Basis: {payload.verification_basis.replace(/_/g, ' ')}
          </Text>
          <Text className={appearance.itemBodyClass}>
            Validation target revision:{' '}
            {payload.verification_report_target_revision_id ?? 'No local validation yet'}
          </Text>
          <Text className={appearance.itemBodyClass}>
            Current preferred revision: {payload.preferred_revision.revision_id}
          </Text>
          <Text className={appearance.itemBodyClass}>
            Freshness: {formatVerificationFreshnessLabel(payload.verification_freshness)}
          </Text>
          <Text className={appearance.itemBodyClass}>
            Signature:{' '}
            {formatVerificationDetailLabel(
              'signature',
              summary?.signature_status ?? null
            )}
          </Text>
          <Text className={appearance.itemBodyClass}>
            Signer:{' '}
            {formatVerificationDetailLabel('signer', summary?.signer_status ?? null)}
          </Text>
          <Text className={appearance.itemBodyClass}>
            Local trust:{' '}
            {formatVerificationDetailLabel(
              'trust',
              summary?.local_trust_status ?? null
            )}
          </Text>
          <Text className={appearance.itemMetaClass}>
            Validated at: {summary?.validated_at ?? 'Not validated locally'}
          </Text>
        </NexusCard>

        <NexusCard className="gap-3">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Breakdown
          </Text>
          <Text className={appearance.itemBodyClass}>
            Structural validity:{' '}
            {formatVerificationDetailLabel(
              'structural',
              summary?.structural_valid ?? null
            )}
          </Text>
          <Text className={appearance.itemBodyClass}>
            Compatibility:{' '}
            {formatVerificationDetailLabel(
              'compatibility',
              summary?.compatibility_status ?? null
            )}
          </Text>
          <Text className={appearance.itemBodyClass}>
            Signature result:{' '}
            {formatVerificationDetailLabel(
              'signature',
              summary?.signature_status ?? null
            )}
          </Text>
          <Text className={appearance.itemBodyClass}>
            Signer result:{' '}
            {formatVerificationDetailLabel('signer', summary?.signer_status ?? null)}
          </Text>
          <Text className={appearance.itemBodyClass}>
            Provenance:{' '}
            {formatVerificationDetailLabel(
              'provenance',
              summary?.provenance_status ?? null
            )}
          </Text>
          <Text className={appearance.itemBodyClass}>
            Local trust result:{' '}
            {formatVerificationDetailLabel(
              'trust',
              summary?.local_trust_status ?? null
            )}
          </Text>
          <Text className={appearance.itemMetaClass}>
            Warning count: {summary?.warnings_count ?? 0}
          </Text>
        </NexusCard>

        <NexusCard className="gap-3">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Local Validation Reports
          </Text>
          {payload.local_verification_reports.length === 0 ? (
            <Text className={appearance.itemBodyClass}>
              No local validation reports yet.
            </Text>
          ) : (
            payload.local_verification_reports.map((report) => (
              <View key={report.report_revision_id} className="gap-1">
                <Text className={appearance.itemBodyClass}>{report.title}</Text>
                <Text className={appearance.itemMetaClass}>
                  {report.report_packet_id} • {report.created_at}
                </Text>
                {report.summary ? (
                  <Text className={appearance.itemBodyClass}>{report.summary}</Text>
                ) : null}
              </View>
            ))
          )}
        </NexusCard>

        <NexusCard className="gap-3">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            External Validation Reports
          </Text>
          {payload.external_verification_reports.length === 0 ? (
            <Text className={appearance.itemBodyClass}>
              No imported external validation reports are attached here.
            </Text>
          ) : (
            payload.external_verification_reports.map((report) => (
              <View key={report.report_revision_id} className="gap-1">
                <Text className={appearance.itemBodyClass}>{report.title}</Text>
                <Text className={appearance.itemMetaClass}>
                  {report.report_packet_id} • {report.created_at}
                </Text>
                {report.summary ? (
                  <Text className={appearance.itemBodyClass}>{report.summary}</Text>
                ) : null}
              </View>
            ))
          )}
        </NexusCard>
      </View>
    </NexusLoadingBoundary>
  );
}

export function renderPayloadPanel(input: {
  payload: NexusPacketExplorerPayload;
  activePrimaryTab: PacketExplorerPrimaryTab;
  selectedDataViewMode: PacketExplorerTab['selected_data_view_mode'];
  rawCodeCardClass: string;
  headingTextClass: string;
  onOpenPacketInNewTab: (input: PacketExplorerRoutePacketInput) => void;
  onOpenPacketInCurrentTab: (input: PacketExplorerRoutePacketInput) => void;
  onViewInLibrary: (packetId: string, type?: string | null) => void;
  onRunVerificationForActivePacket: (packetId: string) => Promise<void>;
}): ReactNode {
  if (input.activePrimaryTab === 'data') {
    return (
      <NexusPacketExplorerDataPanel
        payload={input.payload}
        viewMode={input.selectedDataViewMode}
        rawCodeCardClass={input.rawCodeCardClass}
        headingTextClass={input.headingTextClass}
      />
    );
  }

  if (input.activePrimaryTab === 'lineage') {
    return <NexusPacketExplorerLineagePanel payload={input.payload} />;
  }

  if (input.activePrimaryTab === 'verification') {
    return (
      <NexusPacketExplorerValidationPanel
        payload={input.payload}
        onRunValidation={input.onRunVerificationForActivePacket}
      />
    );
  }

  if (input.activePrimaryTab === 'links') {
    return (
      <NexusPacketExplorerLinksPanel
        payload={input.payload}
        onOpenPacketInNewTab={input.onOpenPacketInNewTab}
        onOpenPacketInCurrentTab={input.onOpenPacketInCurrentTab}
        onViewInLibrary={input.onViewInLibrary}
      />
    );
  }

  return <NexusPacketExplorerActionsPanel payload={input.payload} />;
}
