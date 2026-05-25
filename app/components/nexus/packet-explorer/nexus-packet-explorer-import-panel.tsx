import { useEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import type { NexusPacketValidationMode } from '@core/contracts';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusErrorState,
  NexusFieldActionRow,
  NexusSegmentedPill,
  NexusTextArea,
  NexusWarningState,
  useNexusAppearance,
} from '@app/components/nexus/ui';
import type {
  NexusPacketExplorerImportCommitPayload,
  NexusPacketExplorerImportHistoryEntry,
  NexusPacketExplorerImportHistoryPayload,
  NexusPacketExplorerImportPreviewPayload,
  NexusPacketExplorerImportRequest,
} from '@runtime/nexus/nexus-api-types';
import {
  commitNexusPacketExplorerImport,
  fetchNexusPacketExplorerImportHistory,
  previewNexusPacketExplorerImport,
} from '@runtime/nexus/nexus-query-api';
import { NexusOutcomeDialog } from '@app/components/nexus/ui/overlays';

type NexusPacketExplorerImportPanelProps = {
  shortcutIntent?: 'packet' | 'bundle' | null;
  onOpenPacketInExplorer: (input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: {
      type: string | null;
      summary: string | null;
      label: string | null;
    } | null;
    activePrimaryTab?: 'data' | 'lineage' | 'verification' | 'links' | 'actions';
  }) => void;
};

type ImportSourceMode = 'paste' | 'upload';

type ImportWorkflowState = {
  result:
    | NexusPacketExplorerImportPreviewPayload
    | NexusPacketExplorerImportCommitPayload
    | null;
  error: string | null;
  isAnalyzing: boolean;
  isCommitting: boolean;
};

type ImportOutcomeModalState = {
  title: string;
  body: string;
  tone: 'mint' | 'gold' | 'rose';
} | null;

type ImportHistoryState = {
  entries: NexusPacketExplorerImportHistoryEntry[];
  error: string | null;
  isLoading: boolean;
};

function createIdleWorkflowState(): ImportWorkflowState {
  return {
    result: null,
    error: null,
    isAnalyzing: false,
    isCommitting: false,
  };
}

function createInitialImportHistoryState(): ImportHistoryState {
  return {
    entries: [],
    error: null,
    isLoading: true,
  };
}

function canUseBrowserFilePicker(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof document !== 'undefined' &&
    typeof window !== 'undefined' &&
    typeof FileReader !== 'undefined'
  );
}

function isLikelyJsonFile(file: File): boolean {
  const normalizedType = file.type.toLowerCase();
  const normalizedName = file.name.toLowerCase();

  if (normalizedType.includes('json')) {
    return true;
  }

  return normalizedName.endsWith('.json');
}

function pickJsonFileFromBrowser(): Promise<{
  fileName: string;
  sourceText: string;
}> {
  return new Promise((resolve, reject) => {
    if (!canUseBrowserFilePicker()) {
      reject(
        new Error('JSON file upload is only available in a browser session.')
      );
      return;
    }

    const input = document.createElement('input');

    input.type = 'file';
    input.accept = '.json,application/json,text/json';
    input.onchange = () => {
      const file = input.files?.[0] ?? null;

      if (!file) {
        reject(new Error('Choose a .json file to import.'));
        return;
      }

      if (!isLikelyJsonFile(file)) {
        reject(new Error('Only .json import files are supported in this phase.'));
        return;
      }

      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error(`Unable to read ${file.name}.`));
      };
      reader.onload = () => {
        resolve({
          fileName: file.name,
          sourceText: typeof reader.result === 'string' ? reader.result : '',
        });
      };
      reader.readAsText(file);
    };

    input.click();
  });
}

function buildImportRequest(input: {
  sourceText: string;
  fileName: string | null;
  validationMode: NexusPacketValidationMode;
}): NexusPacketExplorerImportRequest {
  return {
    source_text: input.sourceText,
    file_name: input.fileName,
    validation_mode: input.validationMode,
  };
}

function canCommitResult(
  result:
    | NexusPacketExplorerImportPreviewPayload
    | NexusPacketExplorerImportCommitPayload
    | null
): boolean {
  return (
    (result?.status === 'ready' || result?.status === 'partial_risk') &&
    result.new_revision_count > 0
  );
}

function buildNonCommittableAnalysisModal(
  result: NexusPacketExplorerImportPreviewPayload
): ImportOutcomeModalState {
  if (result.status === 'duplicates_only') {
    return {
      title: 'No new revisions to import',
      body:
        result.duplicate_revision_count > 0
          ? `Everything in this source already exists locally. ${result.duplicate_revision_count} duplicate revision${result.duplicate_revision_count === 1 ? '' : 's'} were detected, so there is nothing new to commit.`
          : 'This source does not contain any new revisions to commit.',
      tone: 'gold',
    };
  }

  if (result.blocking_errors.length > 0) {
    return {
      title: 'Import cannot be committed',
      body: result.blocking_errors[0],
      tone: 'rose',
    };
  }

  return {
    title: 'Import cannot be committed',
    body:
      result.status === 'invalid_json'
        ? 'This source is not valid JSON yet. Fix the JSON and analyze again.'
        : 'This import is not ready to commit yet. Review the analysis details and try again.',
    tone: result.status === 'invalid_json' ? 'rose' : 'gold',
  };
}

function getStatusTone(
  status: NexusPacketExplorerImportPreviewPayload['status']
): 'sky' | 'mint' | 'gold' | 'rose' | 'default' {
  if (status === 'ready') {
    return 'mint';
  }

  if (status === 'duplicates_only' || status === 'partial_risk') {
    return 'gold';
  }

  if (status === 'blocked' || status === 'invalid_json') {
    return 'rose';
  }

  return 'default';
}

function getShortcutHint(shortcutIntent: 'packet' | 'bundle' | null | undefined): {
  title: string;
  body: string;
} | null {
  if (shortcutIntent === 'packet') {
    return {
      title: 'Packet import hint',
      body:
        'Paste one raw packet envelope or upload a single packet JSON file. If it references missing parent revisions, import a packet-history bundle instead.',
    };
  }

  if (shortcutIntent === 'bundle') {
    return {
      title: 'Bundle import hint',
      body:
        'Paste or upload a transport bundle with packet history. Exported Explorer bundles and legacy revisions arrays are both supported here.',
    };
  }

  return null;
}

function ImportResultCard(input: {
  result: NexusPacketExplorerImportPreviewPayload | NexusPacketExplorerImportCommitPayload;
  onOpenPacketInExplorer: NexusPacketExplorerImportPanelProps['onOpenPacketInExplorer'];
}) {
  const appearance = useNexusAppearance();
  const [isAffectedPacketListOpen, setIsAffectedPacketListOpen] = useState(false);
  const commitResult = 'committed' in input.result ? input.result : null;
  const openLabel =
    commitResult?.committed
      ? commitResult.root_packet_refs.length === 1
        ? 'Open root packet'
        : commitResult.open_packet_id
          ? 'Open imported packet'
          : null
      : null;

  return (
    <NexusCard className="gap-4">
      <View className="flex-row flex-wrap gap-2">
        <NexusBadge
          label={input.result.status.replace(/_/g, ' ')}
          tone={getStatusTone(input.result.status)}
        />
        <NexusBadge
          label={input.result.validation_mode.replace(/_/g, ' ')}
          tone="sky"
        />
        {input.result.artifact_type ? (
          <NexusBadge
            label={input.result.artifact_type.replace(/_/g, ' ')}
            tone="sky"
          />
        ) : null}
        <NexusBadge label={`${input.result.packet_count} entries`} />
        <NexusBadge label={`${input.result.unique_packet_count} packets`} />
        <NexusBadge label={`${input.result.unique_revision_count} revisions`} />
      </View>

      {input.result.source_file_name ? (
        <View className="gap-1">
          <Text className={appearance.itemMetaClass}>Source file</Text>
          <Text className={appearance.itemBodyClass}>
            {input.result.source_file_name}
          </Text>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        <NexusBadge label={`${input.result.new_revision_count} new`} tone="mint" />
        <NexusBadge
          label={`${input.result.duplicate_revision_count} duplicates`}
          tone="gold"
        />
        <NexusBadge
          label={`${input.result.invalid_entry_count} invalid`}
          tone={input.result.invalid_entry_count > 0 ? 'rose' : 'default'}
        />
        <NexusBadge
          label={`${input.result.missing_parent_count} missing parents`}
          tone={input.result.missing_parent_count > 0 ? 'rose' : 'default'}
        />
        <NexusBadge
          label={`${input.result.type_conflict_count} type conflicts`}
          tone={input.result.type_conflict_count > 0 ? 'rose' : 'default'}
        />
        <NexusBadge
          label={`${input.result.validation_blocked_count} validation blocked`}
          tone={input.result.validation_blocked_count > 0 ? 'rose' : 'default'}
        />
      </View>

      <View className="flex-row flex-wrap gap-2">
        <NexusBadge
          label={`${input.result.validation_counts.signature_valid} signature valid`}
          tone="mint"
        />
        <NexusBadge
          label={`${input.result.validation_counts.unknown_signer} signer unavailable locally`}
          tone="gold"
        />
        <NexusBadge
          label={`${input.result.validation_counts.unsigned} unsigned`}
          tone="gold"
        />
        <NexusBadge
          label={`${input.result.validation_counts.signature_invalid} invalid sig`}
          tone={input.result.validation_counts.signature_invalid > 0 ? 'rose' : 'default'}
        />
        <NexusBadge
          label={`${input.result.validation_counts.canonicalization_mismatch} canonical mismatch`}
          tone={
            input.result.validation_counts.canonicalization_mismatch > 0
              ? 'rose'
              : 'default'
          }
        />
      </View>

      {input.result.title || input.result.note || input.result.export_mode ? (
        <View className="gap-2">
          {input.result.title ? (
            <Text className={appearance.itemBodyClass}>
              Title: {input.result.title}
            </Text>
          ) : null}
          {input.result.note ? (
            <Text className={appearance.itemBodyClass}>
              Note: {input.result.note}
            </Text>
          ) : null}
          {input.result.export_mode ? (
            <Text className={appearance.itemBodyClass}>
              Export mode: {input.result.export_mode}
            </Text>
          ) : null}
        </View>
      ) : null}

      {input.result.blocking_errors.length > 0 ? (
        <NexusCard tone="rose" className="gap-2">
          <Text className={appearance.itemMetaClass}>Blocking errors</Text>
          {input.result.blocking_errors.map((error) => (
            <Text key={error} className={appearance.itemBodyClass}>
              {error}
            </Text>
          ))}
        </NexusCard>
      ) : null}

      {input.result.warnings.length > 0 ? (
        <NexusCard tone="gold" className="gap-2">
          <Text className={appearance.itemMetaClass}>Warnings</Text>
          {input.result.warnings.map((warning) => (
            <Text key={warning} className={appearance.itemBodyClass}>
              {warning}
            </Text>
          ))}
        </NexusCard>
      ) : null}

      {input.result.affected_packet_ids.length > 0 ? (
        <View className="gap-2">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className={appearance.itemMetaClass}>
              Affected packets ({input.result.affected_packet_count})
            </Text>
            <NexusActionButton
              label={isAffectedPacketListOpen ? 'Hide list' : 'Show list'}
              variant="ghost"
              onPress={() => setIsAffectedPacketListOpen((currentValue) => !currentValue)}
            />
          </View>
          {isAffectedPacketListOpen ? (
            <View className="gap-1">
              {input.result.affected_packet_ids.map((packetId) => (
                <Text key={packetId} className={appearance.itemBodyClass}>
                  {packetId}
                </Text>
              ))}
            </View>
          ) : (
            <Text className={appearance.itemBodyClass}>
              {input.result.affected_packet_count === 1
                ? '1 packet will be affected.'
                : `${input.result.affected_packet_count} packets are part of this import. Expand the list to inspect every packet id.`}
            </Text>
          )}
        </View>
      ) : null}

      {commitResult ? (
        <View className="gap-3">
          <View className="flex-row flex-wrap gap-2">
            <NexusBadge
              label={
                commitResult.committed
                  ? `${commitResult.imported_revision_count} imported`
                  : 'Commit blocked'
              }
              tone={commitResult.committed ? 'mint' : 'rose'}
            />
            <NexusBadge
              label={`${commitResult.skipped_duplicate_count} skipped duplicates`}
              tone="gold"
            />
            <NexusBadge
              label={`${commitResult.restored_preferred_packet_count} preferred restored`}
              tone="sky"
            />
            <NexusBadge
              label={`${commitResult.diverged_packet_count} diverged`}
              tone={commitResult.diverged_packet_count > 0 ? 'gold' : 'default'}
            />
            {commitResult.import_report_packet_id ? (
              <NexusBadge label="Import report created" tone="sky" />
            ) : null}
          </View>

          {commitResult.import_report_packet_id ? (
            <View className="flex-row flex-wrap gap-3">
              <NexusActionButton
                label="Open import report"
                onPress={() =>
                  input.onOpenPacketInExplorer({
                    packetId: commitResult.import_report_packet_id!,
                  })
                }
              />
              {commitResult.created_verification_report_packet_ids[0] ? (
                <NexusActionButton
                  label="Open validation report"
                  variant="ghost"
                  onPress={() =>
                    input.onOpenPacketInExplorer({
                      packetId: commitResult.created_verification_report_packet_ids[0]!,
                    })
                  }
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {openLabel && commitResult?.open_packet_id ? (
        <NexusActionButton
          label={openLabel}
          variant="primary"
          onPress={() =>
            input.onOpenPacketInExplorer({
              packetId: commitResult.open_packet_id!,
            })
          }
        />
      ) : null}
    </NexusCard>
  );
}

function ImportHistoryCard(input: {
  entry: NexusPacketExplorerImportHistoryEntry;
  onOpenPacketInExplorer: NexusPacketExplorerImportPanelProps['onOpenPacketInExplorer'];
}) {
  const appearance = useNexusAppearance();

  return (
    <NexusCard className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        <NexusBadge label={input.entry.source === 'local' ? 'local report' : 'external report'} tone="sky" />
        {input.entry.validation_mode ? (
          <NexusBadge label={input.entry.validation_mode.replace(/_/g, ' ')} tone="gold" />
        ) : null}
        {input.entry.artifact_type ? (
          <NexusBadge label={input.entry.artifact_type.replace(/_/g, ' ')} />
        ) : null}
      </View>
      <Text className={appearance.surfaceTitleClass}>{input.entry.title}</Text>
      <Text className={appearance.itemMetaClass}>{input.entry.created_at}</Text>
      {input.entry.summary ? (
        <Text className={appearance.itemBodyClass}>{input.entry.summary}</Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        <NexusBadge label={`${input.entry.imported_count} imported`} tone="mint" />
        <NexusBadge label={`${input.entry.skipped_count} skipped`} tone="gold" />
        <NexusBadge
          label={`${input.entry.blocked_count} blocked`}
          tone={input.entry.blocked_count > 0 ? 'rose' : 'default'}
        />
        <NexusBadge label={`${input.entry.affected_packet_ids.length} packets`} />
      </View>
      {input.entry.source_file_name || input.entry.source_digest ? (
        <View className="gap-1">
          {input.entry.source_file_name ? (
            <Text className={appearance.itemBodyClass}>
              Source file: {input.entry.source_file_name}
            </Text>
          ) : null}
          {input.entry.source_digest ? (
            <Text className={appearance.itemMetaClass}>
              Digest: {input.entry.source_digest}
            </Text>
          ) : null}
        </View>
      ) : null}
      <View className="flex-row flex-wrap gap-3">
        <NexusActionButton
          label="Open report"
          onPress={() =>
            input.onOpenPacketInExplorer({
              packetId: input.entry.report_packet_id,
            })
          }
        />
        {input.entry.affected_packet_ids[0] ? (
          <NexusActionButton
            label="Open first packet"
            variant="ghost"
            onPress={() =>
              input.onOpenPacketInExplorer({
                packetId: input.entry.affected_packet_ids[0]!,
              })
            }
          />
        ) : null}
      </View>
    </NexusCard>
  );
}

export function NexusPacketExplorerImportPanel({
  shortcutIntent = null,
  onOpenPacketInExplorer,
}: NexusPacketExplorerImportPanelProps) {
  const appearance = useNexusAppearance();
  const [sourceMode, setSourceMode] = useState<ImportSourceMode>('paste');
  const [validationMode, setValidationMode] =
    useState<NexusPacketValidationMode>('validate_before_commit');
  const [sourceText, setSourceText] = useState('');
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<ImportWorkflowState>(
    createIdleWorkflowState
  );
  const [importHistory, setImportHistory] = useState<ImportHistoryState>(
    createInitialImportHistoryState
  );
  const [outcomeModal, setOutcomeModal] = useState<ImportOutcomeModalState>(null);

  const loadImportHistory = async () => {
    setImportHistory((currentState) => ({
      ...currentState,
      error: null,
      isLoading: true,
    }));

    try {
      const payload: NexusPacketExplorerImportHistoryPayload =
        await fetchNexusPacketExplorerImportHistory({ limit: 8 });

      setImportHistory({
        entries: payload.entries,
        error: null,
        isLoading: false,
      });
    } catch (error) {
      setImportHistory({
        entries: [],
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load import history.',
        isLoading: false,
      });
    }
  };

  useEffect(() => {
    void loadImportHistory();
  }, []);

  useEffect(() => {
    setWorkflow(createIdleWorkflowState());
  }, [sourceText, sourceFileName, sourceMode, validationMode]);

  const shortcutHint = useMemo(
    () => getShortcutHint(shortcutIntent),
    [shortcutIntent]
  );
  const hasSource = sourceText.trim().length > 0;

  const handlePickFile = async () => {
    setWorkflow((currentState) => ({
      ...currentState,
      error: null,
    }));

    try {
      const selectedFile = await pickJsonFileFromBrowser();

      setSourceFileName(selectedFile.fileName);
      setSourceText(selectedFile.sourceText);
    } catch (error) {
      setWorkflow((currentState) => ({
        ...currentState,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to load this JSON file.',
      }));
    }
  };

  const handleAnalyze = async () => {
    const requestBody = buildImportRequest({
      sourceText,
      fileName: sourceFileName,
      validationMode,
    });

    setWorkflow((currentState) => ({
      ...currentState,
      error: null,
      isAnalyzing: true,
    }));

    try {
      const result = await previewNexusPacketExplorerImport(requestBody);

      setWorkflow({
        result,
        error: null,
        isAnalyzing: false,
        isCommitting: false,
      });
      if (!canCommitResult(result)) {
        setOutcomeModal(buildNonCommittableAnalysisModal(result));
      }
    } catch (error) {
      setWorkflow({
        result: null,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to analyze this import source.',
        isAnalyzing: false,
        isCommitting: false,
      });
      setOutcomeModal({
        title: 'Import analysis failed',
        body:
          error instanceof Error
            ? error.message
            : 'Unable to analyze this import source.',
        tone: 'rose',
      });
    }
  };

  const handleCommit = async () => {
    const requestBody = buildImportRequest({
      sourceText,
      fileName: sourceFileName,
      validationMode,
    });

    setWorkflow((currentState) => ({
      ...currentState,
      error: null,
      isCommitting: true,
    }));

    try {
      const result = await commitNexusPacketExplorerImport(requestBody);

      setWorkflow({
        result,
        error: null,
        isAnalyzing: false,
        isCommitting: false,
      });
      void loadImportHistory();
      setOutcomeModal(
        result.committed
          ? result.imported_revision_count > 0
            ? {
                title: 'Import complete',
                body:
                  result.open_packet_id
                    ? `Imported ${result.imported_revision_count} new revision${result.imported_revision_count === 1 ? '' : 's'}. You can review the result card below or open the imported packet now.`
                    : `Imported ${result.imported_revision_count} new revision${result.imported_revision_count === 1 ? '' : 's'} across ${result.affected_packet_count} packet${result.affected_packet_count === 1 ? '' : 's'}.`,
                tone: 'mint',
              }
            : {
                title: 'No new revisions imported',
                body:
                  result.skipped_duplicate_count > 0
                    ? `Everything in this import already exists locally. ${result.skipped_duplicate_count} duplicate revision${result.skipped_duplicate_count === 1 ? '' : 's'} were skipped.`
                    : 'This import did not add any new revisions.',
                tone: 'gold',
              }
          : {
              title: 'Import blocked',
              body:
                result.blocking_errors[0] ??
                'This import could not be committed. Review the blocking details below.',
              tone: 'rose',
            }
      );
    } catch (error) {
      setWorkflow((currentState) => ({
        ...currentState,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to commit this import source.',
        isCommitting: false,
      }));
      setOutcomeModal({
        title: 'Import failed',
        body:
          error instanceof Error
            ? error.message
            : 'Unable to commit this import source.',
        tone: 'rose',
      });
    }
  };

  const handleClear = () => {
    setSourceText('');
    setSourceFileName(null);
    setWorkflow(createIdleWorkflowState());
  };

  return (
    <View className="gap-4">
      <NexusCard className="gap-4">
        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
            Packet Import
          </Text>
          <Text className={appearance.surfaceTitleClass}>
            Analyze and commit packet data
          </Text>
          <Text className={appearance.sectionBodyClass}>
            Load raw packet JSON or bundle JSON, inspect what would change, then
            commit accepted revisions into the local store.
          </Text>
        </View>

        <View className="gap-3">
          <Text className={appearance.itemMetaClass}>Source</Text>
          <NexusSegmentedPill
            options={[
              { id: 'paste', label: 'PASTE JSON' },
              { id: 'upload', label: 'UPLOAD JSON FILE' },
            ]}
            activeId={sourceMode}
            onSelect={(optionId) => setSourceMode(optionId as ImportSourceMode)}
          />
        </View>

        <View className="gap-3">
          <Text className={appearance.itemMetaClass}>Validation mode</Text>
          <NexusSegmentedPill
            options={[
              { id: 'validate_before_commit', label: 'VALIDATE FIRST' },
              { id: 'validate_after_commit', label: 'VALIDATE AFTER' },
              { id: 'dont_validate', label: `DON'T VALIDATE` },
            ]}
            activeId={validationMode}
            onSelect={(optionId) =>
              setValidationMode(optionId as NexusPacketValidationMode)
            }
          />
        </View>

        {shortcutHint ? (
          <NexusCard tone="gold" className="gap-2">
            <Text className={appearance.itemMetaClass}>{shortcutHint.title}</Text>
            <Text className={appearance.itemBodyClass}>{shortcutHint.body}</Text>
          </NexusCard>
        ) : null}

        {sourceMode === 'upload' ? (
          <View className="gap-3">
            <View className="flex-row flex-wrap gap-3">
              <NexusActionButton
                label="Choose JSON file"
                onPress={() => void handlePickFile()}
                disabled={!canUseBrowserFilePicker()}
              />
              {sourceFileName ? (
                <NexusBadge label={sourceFileName} tone="sky" />
              ) : null}
            </View>

            {!canUseBrowserFilePicker() ? (
              <NexusWarningState>
                JSON file upload is only available in a browser session right
                now. Paste JSON directly on other platforms.
              </NexusWarningState>
            ) : null}
          </View>
        ) : null}

        <NexusTextArea
          inputClassName="rounded-[22px]"
          multiline
          onChangeText={setSourceText}
          placeholder={
            sourceMode === 'upload'
              ? 'Loaded JSON file contents will appear here and can still be edited.'
              : 'Paste raw packet JSON, bundle JSON, legacy revisions JSON, or a raw packet array.'
          }
          style={{ minHeight: 220, textAlignVertical: 'top' }}
          value={sourceText}
        />

        <NexusFieldActionRow>
          <NexusActionButton
            label={workflow.isAnalyzing ? 'Analyzing...' : 'Analyze Import'}
            onPress={() => void handleAnalyze()}
            disabled={!hasSource || workflow.isAnalyzing || workflow.isCommitting}
          />
          <NexusActionButton
            label={workflow.isCommitting ? 'Committing...' : 'Commit Import'}
            variant="primary"
            onPress={() => void handleCommit()}
            disabled={
              !hasSource ||
              workflow.isAnalyzing ||
              workflow.isCommitting ||
              !canCommitResult(workflow.result)
            }
          />
          <NexusActionButton
            label="Clear"
            variant="ghost"
            onPress={handleClear}
            disabled={!hasSource && !workflow.result}
          />
        </NexusFieldActionRow>

        {workflow.error ? (
          <NexusErrorState>{workflow.error}</NexusErrorState>
        ) : null}
      </NexusCard>

      {workflow.result ? (
        <ImportResultCard
          result={workflow.result}
          onOpenPacketInExplorer={onOpenPacketInExplorer}
        />
      ) : null}

      <NexusCard className="gap-4">
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          <View className="gap-1">
            <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
              Import History
            </Text>
            <Text className={appearance.surfaceTitleClass}>Recent import reports</Text>
            <Text className={appearance.itemMetaClass}>
              Recent entries reflect the latest local report for each imported
              artifact identity, not a full event-by-event ledger.
            </Text>
          </View>
          <NexusActionButton
            label={importHistory.isLoading ? 'Refreshing...' : 'Refresh'}
            variant="ghost"
            onPress={() => void loadImportHistory()}
            disabled={importHistory.isLoading}
          />
        </View>

        {importHistory.error ? (
          <NexusCard tone="rose">
            <Text className={appearance.itemBodyClass}>{importHistory.error}</Text>
          </NexusCard>
        ) : null}

        {importHistory.isLoading && importHistory.entries.length === 0 ? (
          <Text className={appearance.itemBodyClass}>Loading import history...</Text>
        ) : importHistory.entries.length === 0 ? (
          <Text className={appearance.itemBodyClass}>
            No import reports yet.
          </Text>
        ) : (
          <View className="gap-3">
            {importHistory.entries.map((entry) => (
              <ImportHistoryCard
                key={entry.report_revision_id}
                entry={entry}
                onOpenPacketInExplorer={onOpenPacketInExplorer}
              />
            ))}
          </View>
        )}
      </NexusCard>

      <NexusOutcomeDialog
        body={outcomeModal?.body ?? ''}
        onClose={() => setOutcomeModal(null)}
        title={outcomeModal?.title ?? ''}
        tone={outcomeModal?.tone ?? 'default'}
        visible={outcomeModal !== null}
      />
    </View>
  );
}
