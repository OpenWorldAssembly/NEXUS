/**
 * File: compatibility.ts
 * Description: Compatibility packet-type R&D has moved under Definition.packet_compatibility for the current shadow experiment.
 *
 * This file remains as a narrow transition shim so older local imports fail less abruptly while the active
 * experimental manifest enrolls Definition, Preference, and Bundle only.
 */

export {
  PacketCompatibilityDefinitionBodySchema as DefinitionPacketCompatibilityBodySchema,
  type DefinitionBody,
} from './definition.ts';
