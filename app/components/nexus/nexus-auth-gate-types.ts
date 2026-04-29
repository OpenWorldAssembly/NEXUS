/**
 * File: nexus-auth-gate-types.ts
 * Description: App-local barrel for shared Nexus auth/write-gate errors.
 */

export {
  NexusAuthGateError,
  isNexusAuthGateError,
  type NexusAuthGatePayload,
  type NexusAuthGateReason,
} from '@runtime/nexus/nexus-auth-gate-error';
