import { useEffect, useMemo, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';

import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusSegmentedPill,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import type {
  NexusPacketExplorerImportCommitPayload,
  NexusPacketExplorerImportPreviewPayload,
  NexusPacketExplorerImportRequest,
} from '@runtime/nexus/nexus-api-types';
import {
  commitNexusPacketExplorerImport,
  previewNexusPacketExplorerImport,
} from '@runtime/nexus/nexus-query-api';

type NexusPacketExplorerImportPanelProps = {
  shortcutIntent?: 'packet' | 'bundle' | null;
  onOpenPacketInExplorer: (input: {
    packetId: string;
    preferredRevisionId?: string | null;
    titleSnapshot?: string | null;
    seedSummary?: {
      family: string | null;
      summary: string | null;
      label: string | null;
    } | null;
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

function createIdleWorkflowState(): ImportWorkflowState {
  return {
    result: null,
    error: null,
    isAnalyzing: false,
    isCommitting: false,
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
}): NexusPacketExplorerImportRequest {
  return {
    source_text: input.sourceText,
    file_name: input.fileName,
  };
}

function canCommitResult(
  result:
    | NexusPacketExplorerImportPreviewPayload
    | NexusPacketExplorerImportCommitPayload
    | null
): boolean {
  return (
    result?.status === 'ready' ||
    result?.status === 'duplicates_only' ||
    result?.status === 'partial_risk'
  );
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
  const openLabel =
    'committed' in input.result && input.result.committed
      ? input.result.root_packet_refs.length === 1
        ? 'Open root packet'
        : input.result.open_packet_id
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
          label={`${input.result.family_conflict_count} family conflicts`}
          tone={input.result.family_conflict_count > 0 ? 'rose' : 'default'}
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
          <Text className={appearance.itemMetaClass}>Affected packets</Text>
          {input.result.affected_packet_ids.map((packetId) => (
            <Text key={packetId} className={appearance.itemBodyClass}>
              {packetId}
            </Text>
          ))}
          {input.result.affected_packet_count > input.result.affected_packet_ids.length ? (
            <Text className={appearance.itemBodyClass}>
              +{input.result.affected_packet_count - input.result.affected_packet_ids.length}{' '}
              more packet ids
            </Text>
          ) : null}
        </View>
      ) : null}

      {'committed' in input.result ? (
        <View className="flex-row flex-wrap gap-2">
          <NexusBadge
            label={
              input.result.committed
                ? `${input.result.imported_revision_count} imported`
                : 'Commit blocked'
            }
            tone={input.result.committed ? 'mint' : 'rose'}
          />
          <NexusBadge
            label={`${input.result.skipped_duplicate_count} skipped duplicates`}
            tone="gold"
          />
          <NexusBadge
            label={`${input.result.restored_preferred_packet_count} preferred restored`}
            tone="sky"
          />
          <NexusBadge
            label={`${input.result.diverged_packet_count} diverged`}
            tone={input.result.diverged_packet_count > 0 ? 'gold' : 'default'}
          />
        </View>
      ) : null}

      {openLabel && input.result.open_packet_id ? (
        <NexusActionButton
          label={openLabel}
          variant="primary"
          onPress={() =>
            input.onOpenPacketInExplorer({
              packetId: input.result.open_packet_id!,
            })
          }
        />
      ) : null}
    </NexusCard>
  );
}

export function NexusPacketExplorerImportPanel({
  shortcutIntent = null,
  onOpenPacketInExplorer,
}: NexusPacketExplorerImportPanelProps) {
  const appearance = useNexusAppearance();
  const [sourceMode, setSourceMode] = useState<ImportSourceMode>('paste');
  const [sourceText, setSourceText] = useState('');
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<ImportWorkflowState>(
    createIdleWorkflowState
  );

  useEffect(() => {
    setWorkflow(createIdleWorkflowState());
  }, [sourceText, sourceFileName, sourceMode]);

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
    }
  };

  const handleCommit = async () => {
    const requestBody = buildImportRequest({
      sourceText,
      fileName: sourceFileName,
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
    } catch (error) {
      setWorkflow((currentState) => ({
        ...currentState,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to commit this import source.',
        isCommitting: false,
      }));
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
              <NexusCard tone="gold">
                <Text className={appearance.itemBodyClass}>
                  JSON file upload is only available in a browser session right
                  now. Paste JSON directly on other platforms.
                </Text>
              </NexusCard>
            ) : null}
          </View>
        ) : null}

        <TextInput
          className={`rounded-[22px] border px-4 py-3 ${appearance.textInputClass}`}
          multiline
          onChangeText={setSourceText}
          placeholder={
            sourceMode === 'upload'
              ? 'Loaded JSON file contents will appear here and can still be edited.'
              : 'Paste raw packet JSON, bundle JSON, legacy revisions JSON, or a raw packet array.'
          }
          placeholderTextColor={appearance.textInputPlaceholderColor}
          style={{ minHeight: 220, textAlignVertical: 'top' }}
          value={sourceText}
        />

        <View className="flex-row flex-wrap gap-3">
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
        </View>

        {workflow.error ? (
          <NexusCard tone="rose">
            <Text className={appearance.itemBodyClass}>{workflow.error}</Text>
          </NexusCard>
        ) : null}
      </NexusCard>

      {workflow.result ? (
        <ImportResultCard
          result={workflow.result}
          onOpenPacketInExplorer={onOpenPacketInExplorer}
        />
      ) : null}
    </View>
  );
}
