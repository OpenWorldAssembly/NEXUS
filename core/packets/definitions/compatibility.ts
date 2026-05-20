/**
 * File: compatibility.ts
 * Description: Compatibility packet-type work lives under Definition.packet_compatibility.
 *
 * This file remains as a narrow transition shim so older local imports fail less abruptly while the active
 * manifest exposes Definition, Preference, and Bundle as canonical packet families.
 */

export {
  PacketCompatibilityDefinitionBodySchema as DefinitionPacketCompatibilityBodySchema,
  type DefinitionBody,
} from './definition.ts';
