import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusInlineSelect,
  NexusSegmentedPill,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import type {
  NexusPacketExplorerBundleExportMode,
  NexusPacketExplorerExportPreviewPayload,
  NexusPacketExplorerExportRequest,
  NexusPacketExplorerSearchPayload,
  NexusPacketExplorerSearchResultRow,
} from '@runtime/nexus/nexus-api-types';
import {
  downloadNexusPacketExplorerExport,
  previewNexusPacketExplorerExport,
  searchNexusPacketExplorerPackets,
} from '@runtime/nexus/nexus-query-api';

type NexusPacketExplorerExportPanelProps = {
  selectedPacketId: string | null;
  selectedPacketTitle: string | null;
  onSelectPacketForExport: (input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: {
      family: string | null;
      summary: string | null;
      label: string | null;
    } | null;
  }) => void;
  onClearPacketExportTarget: () => void;
};

type ExportWorkflowState = {
  preview: NexusPacketExplorerExportPreviewPayload | null;
  error: string | null;
  isLoadingPreview: boolean;
  isDownloading: boolean;
};

const BUNDLE_SCOPE_OPTIONS: {
  id: NexusPacketExplorerBundleExportMode;
  label: string;
}[] = [
  { id: 'packet_history', label: 'Packet history' },
  { id: 'with_references', label: 'With references' },
  { id: 'with_referrers', label: 'With referrers' },
  { id: 'with_scope_stack', label: 'With scope stack' },
  {
    id: 'with_references_referrers_scope_stack',
    label: 'With references + referrers + scope stack',
  },
];

function getVerificationLookupBadge(
  verification: NexusPacketExplorerSearchResultRow['verification']
): { label: string; tone?: 'default' | 'sky' | 'gold' | 'rose' | 'mint' } | null {
  if (!verification) {
    return null;
  }

  if (
    verification.status === 'signature_invalid' ||
    verification.status === 'canonicalization_mismatch'
  ) {
    return { label: 'Validation failed', tone: 'rose' };
  }

  if (verification.status === 'trusted_signer') {
    return { label: 'Validated locally', tone: 'mint' };
  }

  if (verification.status === 'unsigned') {
    return { label: 'Unsigned', tone: 'gold' };
  }

  if (verification.status === 'unknown_signer') {
    return { label: 'Signer unavailable locally', tone: 'gold' };
  }

  if (verification.status === 'external_report_only') {
    return { label: 'External report only', tone: 'gold' };
  }

  return { label: verification.status.replace(/_/g, ' ') };
}

function createIdleWorkflowState(): ExportWorkflowState {
  return {
    preview: null,
    error: null,
    isLoadingPreview: false,
    isDownloading: false,
  };
}

function normalizeLookupQuery(value: string): string {
  return value.trim().toLowerCase();
}

function flattenSearchResults(
  searchPayload: NexusPacketExplorerSearchPayload | null
): NexusPacketExplorerSearchResultRow[] {
  if (!searchPayload) {
    return [];
  }

  return searchPayload.groups
    .flatMap((group) => group.results)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return right.created_at.localeCompare(left.created_at);
    });
}

function buildPacketExportRequest(input: {
  selectedPacketId: string;
  artifactMode: 'raw_packet' | 'bundle';
  bundleMode: NexusPacketExplorerBundleExportMode;
  title: string;
  note: string;
}): NexusPacketExplorerExportRequest {
  return {
    artifact_mode: input.artifactMode,
    root_packet_id: input.selectedPacketId,
    bundle_mode: input.artifactMode === 'bundle' ? input.bundleMode : null,
    title: input.artifactMode === 'bundle' ? input.title : null,
    note: input.artifactMode === 'bundle' ? input.note : null,
  };
}

function buildStoreExportRequest(input: {
  title: string;
  note: string;
}): NexusPacketExplorerExportRequest {
  return {
    artifact_mode: 'bundle',
    bundle_mode: 'full_store',
    root_packet_id: null,
    title: input.title,
    note: input.note,
  };
}

function ExportPreviewCard({
  preview,
}: {
  preview: NexusPacketExplorerExportPreviewPayload;
}) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard className="gap-4">
      <View className="flex-row flex-wrap gap-2">
        <NexusBadge
          label={preview.artifact_mode === 'raw_packet' ? 'Raw packet' : 'Bundle'}
          tone="sky"
        />
        <NexusBadge label={`${preview.packet_count} packets`} />
        <NexusBadge label={`${preview.revision_count} revisions`} />
        <NexusBadge label={`${preview.byte_count} bytes`} tone="gold" />
      </View>

      <View className="gap-2">
        <Text className={appearance.itemMetaClass}>Export mode</Text>
        <Text className={appearance.itemBodyClass}>{preview.export_mode}</Text>
      </View>

      {preview.root_packet_refs.length > 0 ? (
        <View className="gap-2">
          <Text className={appearance.itemMetaClass}>Root packet refs</Text>
          {preview.root_packet_refs.map((packetRef) => (
            <Text key={packetRef.packet_id} className={appearance.itemBodyClass}>
              {packetRef.packet_id}
            </Text>
          ))}
        </View>
      ) : null}

      {preview.preview_suppressed ? (
        <NexusCard tone="gold" className="gap-2">
          <Text className={appearance.itemBodyClass}>
            This export is too large to preview inline. Download the JSON instead.
          </Text>
        </NexusCard>
      ) : preview.preview_json ? (
        <NexusCard className="gap-3">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Export JSON
          </Text>
          <Text className={`text-xs leading-6 ${appearance.itemMetaClass}`} selectable>
            {preview.preview_json}
          </Text>
        </NexusCard>
      ) : null}
    </NexusCard>
  );
}

export function NexusPacketExplorerExportPanel({
  selectedPacketId,
  selectedPacketTitle,
  onSelectPacketForExport,
  onClearPacketExportTarget,
}: NexusPacketExplorerExportPanelProps) {
  const appearance = useNexusAppearance();
  const [packetArtifactMode, setPacketArtifactMode] = useState<
    'raw_packet' | 'bundle'
  >('raw_packet');
  const [packetBundleMode, setPacketBundleMode] =
    useState<NexusPacketExplorerBundleExportMode>('packet_history');
  const [packetTitle, setPacketTitle] = useState('');
  const [packetNote, setPacketNote] = useState('');
  const [packetWorkflow, setPacketWorkflow] = useState<ExportWorkflowState>(
    createIdleWorkflowState
  );
  const [storeTitle, setStoreTitle] = useState('');
  const [storeNote, setStoreNote] = useState('');
  const [storeWorkflow, setStoreWorkflow] = useState<ExportWorkflowState>(
    createIdleWorkflowState
  );
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResults, setLookupResults] = useState<
    NexusPacketExplorerSearchResultRow[]
  >([]);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [activeLookupIndex, setActiveLookupIndex] = useState(0);

  useEffect(() => {
    setPacketWorkflow(createIdleWorkflowState());
  }, [selectedPacketId, packetArtifactMode, packetBundleMode, packetTitle, packetNote]);

  useEffect(() => {
    if (!selectedPacketId) {
      setPacketArtifactMode('raw_packet');
      setPacketBundleMode('packet_history');
      setPacketTitle('');
      setPacketNote('');
      setPacketWorkflow(createIdleWorkflowState());
    }
  }, [selectedPacketId]);

  useEffect(() => {
    setStoreWorkflow(createIdleWorkflowState());
  }, [storeTitle, storeNote]);

  useEffect(() => {
    if (selectedPacketId) {
      setLookupQuery('');
      setLookupResults([]);
      setLookupError(null);
      setIsLookupLoading(false);
      setActiveLookupIndex(0);
    }
  }, [selectedPacketId]);

  useEffect(() => {
    if (selectedPacketId) {
      return;
    }

    const trimmedQuery = lookupQuery.trim();
    const isIdentifierLike =
      trimmedQuery.includes(':') ||
      trimmedQuery.includes('@') ||
      trimmedQuery.includes('/');

    if ((!isIdentifierLike && trimmedQuery.length < 2) || trimmedQuery.length === 0) {
      setLookupResults([]);
      setLookupError(null);
      setIsLookupLoading(false);
      setActiveLookupIndex(0);
      return;
    }

    let isMounted = true;
    const timeoutHandle = setTimeout(() => {
      setIsLookupLoading(true);
      setLookupError(null);

      void searchNexusPacketExplorerPackets({
        query: trimmedQuery,
        limit_per_group: 5,
        scope_mode: 'all_known',
      })
        .then((payload) => {
          if (!isMounted) {
            return;
          }

          setLookupResults(flattenSearchResults(payload).slice(0, 5));
          setLookupError(null);
          setActiveLookupIndex(0);
        })
        .catch((error) => {
          if (!isMounted) {
            return;
          }

          setLookupResults([]);
          setLookupError(
            error instanceof Error
              ? error.message
              : 'Unable to search export targets right now.'
          );
        })
        .finally(() => {
          if (isMounted) {
            setIsLookupLoading(false);
          }
        });
    }, 180);

    return () => {
      isMounted = false;
      clearTimeout(timeoutHandle);
    };
  }, [lookupQuery, selectedPacketId]);

  const lookupSelection = useMemo(() => {
    if (lookupResults.length === 0) {
      return null;
    }

    const normalizedQuery = normalizeLookupQuery(lookupQuery);
    const exactPacketMatch =
      lookupResults.find(
        (result) => normalizeLookupQuery(result.packet_id) === normalizedQuery
      ) ?? null;

    if (exactPacketMatch) {
      return exactPacketMatch;
    }

    const exactTitleOrLabelMatch =
      lookupResults.find(
        (result) =>
          normalizeLookupQuery(result.title) === normalizedQuery ||
          normalizeLookupQuery(result.label) === normalizedQuery
      ) ?? null;

    if (exactTitleOrLabelMatch) {
      return exactTitleOrLabelMatch;
    }

    return lookupResults[activeLookupIndex] ?? lookupResults[0] ?? null;
  }, [activeLookupIndex, lookupQuery, lookupResults]);

  const handleSelectLookupResult = (result: NexusPacketExplorerSearchResultRow) => {
    onSelectPacketForExport({
      packetId: result.packet_id,
      preferredRevisionId: result.revision_id,
      titleSnapshot: result.title,
      seedSummary: {
        family: result.family,
        summary: result.summary,
        label: result.label,
      },
    });
  };

  const handlePacketPreview = async () => {
    if (!selectedPacketId) {
      return;
    }

    const requestBody = buildPacketExportRequest({
      selectedPacketId,
      artifactMode: packetArtifactMode,
      bundleMode: packetBundleMode,
      title: packetTitle,
      note: packetNote,
    });

    setPacketWorkflow((currentState) => ({
      ...currentState,
      error: null,
      isLoadingPreview: true,
    }));

    try {
      const preview = await previewNexusPacketExplorerExport(requestBody);

      setPacketWorkflow({
        preview,
        error: null,
        isLoadingPreview: false,
        isDownloading: false,
      });
    } catch (error) {
      setPacketWorkflow({
        preview: null,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to preview this packet export.',
        isLoadingPreview: false,
        isDownloading: false,
      });
    }
  };

  const handlePacketDownload = async () => {
    if (!selectedPacketId) {
      return;
    }

    const requestBody = buildPacketExportRequest({
      selectedPacketId,
      artifactMode: packetArtifactMode,
      bundleMode: packetBundleMode,
      title: packetTitle,
      note: packetNote,
    });

    setPacketWorkflow((currentState) => ({
      ...currentState,
      error: null,
      isDownloading: true,
    }));

    try {
      await downloadNexusPacketExplorerExport(requestBody);
      setPacketWorkflow((currentState) => ({
        ...currentState,
        isDownloading: false,
      }));
    } catch (error) {
      setPacketWorkflow((currentState) => ({
        ...currentState,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to download this packet export.',
        isDownloading: false,
      }));
    }
  };

  const handleStorePreview = async () => {
    const requestBody = buildStoreExportRequest({
      title: storeTitle,
      note: storeNote,
    });

    setStoreWorkflow((currentState) => ({
      ...currentState,
      error: null,
      isLoadingPreview: true,
    }));

    try {
      const preview = await previewNexusPacketExplorerExport(requestBody);

      setStoreWorkflow({
        preview,
        error: null,
        isLoadingPreview: false,
        isDownloading: false,
      });
    } catch (error) {
      setStoreWorkflow({
        preview: null,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to preview the local store export.',
        isLoadingPreview: false,
        isDownloading: false,
      });
    }
  };

  const handleStoreDownload = async () => {
    const requestBody = buildStoreExportRequest({
      title: storeTitle,
      note: storeNote,
    });

    setStoreWorkflow((currentState) => ({
      ...currentState,
      error: null,
      isDownloading: true,
    }));

    try {
      await downloadNexusPacketExplorerExport(requestBody);
      setStoreWorkflow((currentState) => ({
        ...currentState,
        isDownloading: false,
      }));
    } catch (error) {
      setStoreWorkflow((currentState) => ({
        ...currentState,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to download the local store export.',
        isDownloading: false,
      }));
    }
  };

  return (
    <View className="gap-4">
      <NexusCard className="gap-4">
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Packet Export
          </Text>
          <Text className={appearance.surfaceTitleClass}>Export packet data</Text>
          <Text className={appearance.sectionBodyClass}>
            Generate raw packet JSON or a bounded bundle from the selected packet.
          </Text>
        </View>

        {selectedPacketId ? (
          <>
            <View className="gap-2">
              <Text className={appearance.itemMetaClass}>Selected packet</Text>
              <Text className={appearance.itemTitleClass}>
                {selectedPacketTitle ?? selectedPacketId}
              </Text>
              <Text className={appearance.itemBodyClass}>{selectedPacketId}</Text>
            </View>

            <View className="gap-3">
              <Text className={appearance.itemMetaClass}>Artifact</Text>
              <NexusSegmentedPill
                options={[
                  { id: 'raw_packet', label: 'RAW PACKET' },
                  { id: 'bundle', label: 'AS BUNDLE' },
                ]}
                activeId={packetArtifactMode}
                onSelect={(optionId) =>
                  setPacketArtifactMode(optionId as 'raw_packet' | 'bundle')
                }
              />
            </View>

            {packetArtifactMode === 'bundle' ? (
              <View className="gap-4">
                <NexusInlineSelect
                  label="Bundle scope"
                  valueLabel={
                    BUNDLE_SCOPE_OPTIONS.find(
                      (option) => option.id === packetBundleMode
                    )?.label ?? 'Packet history'
                  }
                  options={BUNDLE_SCOPE_OPTIONS}
                  onSelect={(optionId) =>
                    setPacketBundleMode(
                      optionId as NexusPacketExplorerBundleExportMode
                    )
                  }
                />

                <TextInput
                  className={`rounded-[22px] border px-4 py-3 ${appearance.textInputClass}`}
                  onChangeText={setPacketTitle}
                  placeholder="Optional bundle title"
                  placeholderTextColor={appearance.textInputPlaceholderColor}
                  value={packetTitle}
                />

                <TextInput
                  className={`rounded-[22px] border px-4 py-3 ${appearance.textInputClass}`}
                  multiline
                  onChangeText={setPacketNote}
                  placeholder="Optional bundle note"
                  placeholderTextColor={appearance.textInputPlaceholderColor}
                  style={{ minHeight: 108, textAlignVertical: 'top' }}
                  value={packetNote}
                />
              </View>
            ) : null}

            <View className="flex-row flex-wrap gap-3">
              <NexusActionButton
                label={
                  packetWorkflow.isLoadingPreview ? 'Previewing...' : 'Preview JSON'
                }
                onPress={() => void handlePacketPreview()}
                disabled={packetWorkflow.isLoadingPreview || packetWorkflow.isDownloading}
              />
              <NexusActionButton
                label={
                  packetWorkflow.isDownloading ? 'Downloading...' : 'Download JSON'
                }
                variant="primary"
                onPress={() => void handlePacketDownload()}
                disabled={packetWorkflow.isLoadingPreview || packetWorkflow.isDownloading}
              />
              <NexusActionButton
                label="Cancel"
                variant="ghost"
                onPress={() => {
                  setPacketArtifactMode('raw_packet');
                  setPacketBundleMode('packet_history');
                  setPacketTitle('');
                  setPacketNote('');
                  setPacketWorkflow(createIdleWorkflowState());
                  onClearPacketExportTarget();
                }}
                disabled={packetWorkflow.isLoadingPreview || packetWorkflow.isDownloading}
              />
            </View>
          </>
        ) : (
          <View className="gap-4">
            <View className="gap-3">
              <Text className={appearance.itemMetaClass}>Enter packet id/etc</Text>
              <TextInput
                className={`rounded-[22px] border px-4 py-3 ${appearance.textInputClass}`}
                onChangeText={setLookupQuery}
                onKeyPress={(event) => {
                  if (lookupResults.length === 0) {
                    return;
                  }

                  if (event.nativeEvent.key === 'ArrowDown') {
                    setActiveLookupIndex((currentValue) =>
                      Math.min(currentValue + 1, lookupResults.length - 1)
                    );
                    return;
                  }

                  if (event.nativeEvent.key === 'ArrowUp') {
                    setActiveLookupIndex((currentValue) =>
                      Math.max(currentValue - 1, 0)
                    );
                    return;
                  }

                  if (event.nativeEvent.key === 'Escape') {
                    setLookupResults([]);
                  }
                }}
                onSubmitEditing={() => {
                  if (lookupSelection) {
                    handleSelectLookupResult(lookupSelection);
                  }
                }}
                placeholder="Load a packet by packet id or exact title"
                placeholderTextColor={appearance.textInputPlaceholderColor}
                returnKeyType="search"
                value={lookupQuery}
              />
              <Text className={appearance.itemBodyClass}>
                Use Search for broader packet lookup.
              </Text>

              {isLookupLoading ? (
                <Text className={appearance.itemMetaClass}>
                  Searching packets...
                </Text>
              ) : null}

              {lookupError ? (
                <NexusCard tone="rose">
                  <Text className={appearance.itemBodyClass}>{lookupError}</Text>
                </NexusCard>
              ) : null}

              {lookupResults.length > 0 ? (
                <NexusCard className="gap-2">
                  {lookupResults.map((result, resultIndex) => (
                    (() => {
                      const verificationBadge = getVerificationLookupBadge(
                        result.verification
                      );

                      return (
                        <Pressable
                          key={`${result.packet_id}:${result.match_type}:${result.matched_revision_id ?? result.revision_id ?? 'none'}`}
                          className={`rounded-[3px] border px-3 py-3 ${
                            resultIndex === activeLookupIndex
                              ? appearance.cardInsetClass
                              : 'border-transparent'
                          }`}
                          onPress={() => handleSelectLookupResult(result)}
                        >
                          <View className="flex-row flex-wrap items-center gap-2">
                            <Text className={appearance.itemTitleClass}>
                              {result.title}
                            </Text>
                            {verificationBadge ? (
                              <NexusBadge
                                label={verificationBadge.label}
                                tone={verificationBadge.tone}
                              />
                            ) : null}
                          </View>
                          <Text className={appearance.itemMetaClass}>
                            {result.match_reason}
                          </Text>
                          <Text className={appearance.itemBodyClass}>
                            {result.packet_id}
                          </Text>
                        </Pressable>
                      );
                    })()
                  ))}
                </NexusCard>
              ) : null}
            </View>
          </View>
        )}

        {packetWorkflow.error ? (
          <NexusCard tone="rose">
            <Text className={appearance.itemBodyClass}>
              {packetWorkflow.error}
            </Text>
          </NexusCard>
        ) : null}

        {packetWorkflow.preview ? (
          <ExportPreviewCard preview={packetWorkflow.preview} />
        ) : null}
      </NexusCard>

      <NexusCard className="gap-4">
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Local Store Export
          </Text>
          <Text className={appearance.surfaceTitleClass}>
            Export full local store
          </Text>
          <Text className={appearance.sectionBodyClass}>
            Create a node-level raw bundle snapshot of every known packet and
            revision in this local store.
          </Text>
        </View>

        <TextInput
          className={`rounded-[22px] border px-4 py-3 ${appearance.textInputClass}`}
          onChangeText={setStoreTitle}
          placeholder="Optional bundle title"
          placeholderTextColor={appearance.textInputPlaceholderColor}
          value={storeTitle}
        />

        <TextInput
          className={`rounded-[22px] border px-4 py-3 ${appearance.textInputClass}`}
          multiline
          onChangeText={setStoreNote}
          placeholder="Optional bundle note"
          placeholderTextColor={appearance.textInputPlaceholderColor}
          style={{ minHeight: 108, textAlignVertical: 'top' }}
          value={storeNote}
        />

        <View className="flex-row flex-wrap gap-3">
          <NexusActionButton
            label={storeWorkflow.isLoadingPreview ? 'Previewing...' : 'Preview JSON'}
            onPress={() => void handleStorePreview()}
            disabled={storeWorkflow.isLoadingPreview || storeWorkflow.isDownloading}
          />
          <NexusActionButton
            label={storeWorkflow.isDownloading ? 'Downloading...' : 'Download JSON'}
            variant="primary"
            onPress={() => void handleStoreDownload()}
            disabled={storeWorkflow.isLoadingPreview || storeWorkflow.isDownloading}
          />
        </View>

        {storeWorkflow.error ? (
          <NexusCard tone="rose">
            <Text className={appearance.itemBodyClass}>
              {storeWorkflow.error}
            </Text>
          </NexusCard>
        ) : null}

        {storeWorkflow.preview ? (
          <ExportPreviewCard preview={storeWorkflow.preview} />
        ) : null}
      </NexusCard>
    </View>
  );
}
