import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import type { NexusPacketValidationMode } from '@core/contracts';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusErrorState,
  NexusFieldActionRow,
  NexusLoadingBoundary,
  NexusSegmentedPill,
  NexusTextArea,
  NexusWarningState,
  useNexusAppearance,
  useNexusLoading,
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
import {
  ImportHistoryCard,
  ImportResultCard,
} from './nexus-packet-explorer-import-cards';

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

const PACKET_EXPLORER_IMPORT_ANALYZE_LOADING_SCOPE =
  'packet-explorer:import-analyze';
const PACKET_EXPLORER_IMPORT_COMMIT_LOADING_SCOPE =
  'packet-explorer:import-commit';
const PACKET_EXPLORER_IMPORT_HISTORY_LOADING_SCOPE =
  'packet-explorer:import-history';

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

export function NexusPacketExplorerImportPanel({
  shortcutIntent = null,
  onOpenPacketInExplorer,
}: NexusPacketExplorerImportPanelProps) {
  const appearance = useNexusAppearance();
  const { runWithLoading } = useNexusLoading();
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

  const loadImportHistory = useCallback(async () => {
    await runWithLoading(
      PACKET_EXPLORER_IMPORT_HISTORY_LOADING_SCOPE,
      async () => {
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
      },
      { label: 'Loading import history...' }
    );
  }, [runWithLoading]);

  useEffect(() => {
    void loadImportHistory();
  }, [loadImportHistory]);

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

        <NexusLoadingBoundary
          label="Analyzing import..."
          scope={PACKET_EXPLORER_IMPORT_ANALYZE_LOADING_SCOPE}
        >
          <NexusLoadingBoundary
            label="Committing import..."
            scope={PACKET_EXPLORER_IMPORT_COMMIT_LOADING_SCOPE}
          >
            <NexusFieldActionRow>
              <NexusActionButton
                label={workflow.isAnalyzing ? 'Analyzing...' : 'Analyze Import'}
                loadingScope={PACKET_EXPLORER_IMPORT_ANALYZE_LOADING_SCOPE}
                onPress={() => handleAnalyze()}
                disabled={!hasSource || workflow.isAnalyzing || workflow.isCommitting}
              />
              <NexusActionButton
                label={workflow.isCommitting ? 'Committing...' : 'Commit Import'}
                loadingScope={PACKET_EXPLORER_IMPORT_COMMIT_LOADING_SCOPE}
                variant="primary"
                onPress={() => handleCommit()}
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
          </NexusLoadingBoundary>
        </NexusLoadingBoundary>

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
            onPress={() => loadImportHistory()}
            disabled={importHistory.isLoading}
          />
        </View>

        {importHistory.error ? (
          <NexusCard tone="rose">
            <Text className={appearance.itemBodyClass}>{importHistory.error}</Text>
          </NexusCard>
        ) : null}

        <NexusLoadingBoundary
          label="Loading import history..."
          scope={PACKET_EXPLORER_IMPORT_HISTORY_LOADING_SCOPE}
        >
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
        </NexusLoadingBoundary>
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
