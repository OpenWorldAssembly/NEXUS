/**
 * File: index.ts
 * Description: Public exports for the Trusted Regulation Coordinator. Internal function modules are intentionally not exported here.
 */

export { trustedRegulationCoordinator } from './trusted_regulation_coordinator.ts';
export type {
  AuditTrustedRegulationReadinessInput,
  ResolveTrustedPolicyContextInput,
  ResolveTrustedRegulationContextInput,
  ResolveTrustedWritePolicyGateInput,
  TrustedPolicyContext,
  TrustedRegulationContext,
  TrustedRegulationContextMode,
  TrustedRegulationOperationKind,
  TrustedRegulationProfile,
  TrustedRegulationReadinessReport,
  TrustedRegulationRequirement,
  TrustedWritePolicyGate,
} from './trusted_regulation_types.ts';
