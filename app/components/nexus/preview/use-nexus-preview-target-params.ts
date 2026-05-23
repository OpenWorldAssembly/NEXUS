/**
 * File: use-nexus-preview-target-params.ts
 * Description: Reads reusable Nexus preview target query params for focus/highlight consumers.
 */
import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';

export type NexusPreviewTargetParams = {
  packetId: string | null;
  revisionId: string | null;
  focusPacketId: string | null;
  highlightPacketId: string | null;
  packetType: string | null;
  targetIntent: string | null;
};

function normalizeParam(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim().length > 0) {
    return value[0];
  }

  return null;
}

/**
 * Inputs: route query params produced by nexus-preview-target helpers.
 * Output: normalized packet/focus/highlight ids for destination surfaces.
 */
export function useNexusPreviewTargetParams(): NexusPreviewTargetParams {
  const localParams = useLocalSearchParams<{
    packet_id?: string | string[];
    revision_id?: string | string[];
    focus_packet_id?: string | string[];
    highlight_packet_id?: string | string[];
    packet_type?: string | string[];
    target_intent?: string | string[];
  }>();

  return useMemo(() => {
    const packetId = normalizeParam(localParams.packet_id);
    const focusPacketId = normalizeParam(localParams.focus_packet_id) ?? packetId;
    const highlightPacketId = normalizeParam(localParams.highlight_packet_id) ?? focusPacketId;

    return {
      packetId,
      revisionId: normalizeParam(localParams.revision_id),
      focusPacketId,
      highlightPacketId,
      packetType: normalizeParam(localParams.packet_type),
      targetIntent: normalizeParam(localParams.target_intent),
    };
  }, [
    localParams.focus_packet_id,
    localParams.highlight_packet_id,
    localParams.packet_type,
    localParams.packet_id,
    localParams.revision_id,
    localParams.target_intent,
  ]);
}
