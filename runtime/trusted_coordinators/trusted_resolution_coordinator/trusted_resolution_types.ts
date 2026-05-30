/**
 * File: trusted_resolution_types.ts
 * Description: Local contracts for Trusted Resolution Coordinator binding execution.
 */

import type { PacketEnvelope, PacketRef } from '@core/schema/packet-schema';
import type { ResolutionStepDescriptor } from '@core/packets/resolution-dsl.ts';

export const TRUSTED_RESOLUTION_COORDINATOR_ID = 'trusted_resolution_coordinator.v0' as const;

export type TrustedResolutionCoordinatorContext = {
  actor_ref?: PacketRef | null;
  current_packet?: PacketEnvelope | null;
  definition?: unknown;
  input?: Record<string, unknown>;
  step_outputs?: Record<string, Record<string, unknown>>;
};

export type TrustedResolutionStepValue = {
  step_id: string;
  output_key: string;
  preset_ids: string[];
  values: Record<string, unknown>;
};

export type RunTrustedResolutionStepInput = {
  step: ResolutionStepDescriptor;
  context: TrustedResolutionCoordinatorContext;
};

export type TrustedResolutionOperation = 'run_step';

export type TrustedResolutionCoordinatorRequest = {
  operation: 'run_step';
  input: RunTrustedResolutionStepInput;
};
