/**
 * File: location-search.ts
 * Description: Defines provider-agnostic location lookup payloads and descriptor helpers for Nexus locality flows.
 */

export type LegacyLocalityLevel = 'nation' | 'region' | 'city' | 'district';

export type LocalityHierarchySystem =
  | 'planetary'
  | 'administrative'
  | 'electoral'
  | 'postal'
  | 'addressing'
  | 'building'
  | 'custom';

export type LocalityManualStatus =
  | 'manual'
  | 'provisional'
  | 'provider_backed';

export type LocalityScopeDescriptor = {
  hierarchy_system: LocalityHierarchySystem;
  local_type_label: string;
  local_type_key: string;
  legacy_level: LegacyLocalityLevel;
};

const LOCALITY_HIERARCHY_SYSTEMS: LocalityHierarchySystem[] = [
  'planetary',
  'administrative',
  'electoral',
  'postal',
  'addressing',
  'building',
  'custom',
];

const FALLBACK_SCOPE_DESCRIPTOR_BY_LEVEL: Record<
  LegacyLocalityLevel,
  LocalityScopeDescriptor
> = {
  nation: {
    hierarchy_system: 'administrative',
    local_type_label: 'Nation / Country',
    local_type_key: 'nation',
    legacy_level: 'nation',
  },
  region: {
    hierarchy_system: 'administrative',
    local_type_label: 'State / Province / Region',
    local_type_key: 'region',
    legacy_level: 'region',
  },
  city: {
    hierarchy_system: 'administrative',
    local_type_label: 'City / Town / Village',
    local_type_key: 'city',
    legacy_level: 'city',
  },
  district: {
    hierarchy_system: 'administrative',
    local_type_label: 'District / Neighborhood',
    local_type_key: 'district',
    legacy_level: 'district',
  },
};

export function isLegacyLocalityLevel(
  value: unknown
): value is LegacyLocalityLevel {
  return (
    value === 'nation' ||
    value === 'region' ||
    value === 'city' ||
    value === 'district'
  );
}

export function isLocalityHierarchySystem(
  value: unknown
): value is LocalityHierarchySystem {
  return (
    typeof value === 'string' &&
    LOCALITY_HIERARCHY_SYSTEMS.includes(value as LocalityHierarchySystem)
  );
}

export function createFallbackLocalityScopeDescriptor(
  level: LegacyLocalityLevel
): LocalityScopeDescriptor {
  return {
    ...FALLBACK_SCOPE_DESCRIPTOR_BY_LEVEL[level],
  };
}

export function readLocalityScopeDescriptor(
  value: unknown,
  fallbackLevel?: LegacyLocalityLevel | null
): LocalityScopeDescriptor | null {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    isLocalityHierarchySystem((value as { hierarchy_system?: unknown }).hierarchy_system) &&
    typeof (value as { local_type_label?: unknown }).local_type_label === 'string' &&
    typeof (value as { local_type_key?: unknown }).local_type_key === 'string' &&
    isLegacyLocalityLevel((value as { legacy_level?: unknown }).legacy_level)
  ) {
    return {
      hierarchy_system: (value as { hierarchy_system: LocalityHierarchySystem })
        .hierarchy_system,
      local_type_label: (value as { local_type_label: string }).local_type_label,
      local_type_key: (value as { local_type_key: string }).local_type_key,
      legacy_level: (value as { legacy_level: LegacyLocalityLevel }).legacy_level,
    };
  }

  if (fallbackLevel) {
    return createFallbackLocalityScopeDescriptor(fallbackLevel);
  }

  return null;
}

export function readLocalityManualStatus(input: {
  spatialPayload?: Record<string, unknown> | null;
  status?: string | null;
}): LocalityManualStatus | null {
  const source = input.spatialPayload?.source;

  if (
    source &&
    typeof source === 'object' &&
    !Array.isArray(source) &&
    typeof (source as { kind?: unknown }).kind === 'string'
  ) {
    const sourceKind = (source as { kind: string }).kind;

    if (sourceKind === 'manual') {
      return 'manual';
    }

    if (sourceKind === 'provider' || sourceKind === 'provider_backed') {
      return 'provider_backed';
    }
  }

  if (input.status === 'provisional') {
    return 'provisional';
  }

  return null;
}

export type NexusLocationDisclosureOption = {
  scope: LegacyLocalityLevel;
  value: string;
  label: string;
  description: string;
};

export type NexusLocationSearchPathEntry = {
  scope_id: string;
  name: string;
  level: LegacyLocalityLevel;
  scope_type_label?: string | null;
};

export type NexusLocationSearchResult = {
  scope_id: string;
  name: string;
  short_label: string;
  locality_label: string;
  level: LegacyLocalityLevel;
  path_label: string;
  parent_path_label: string | null;
  canonical_name_key: string;
  alias_keys?: string[];
  display_aliases?: string[];
  path_entries?: NexusLocationSearchPathEntry[];
  match_type: 'exact' | 'alias' | 'fuzzy' | 'path' | 'create_candidate';
  description: string;
  duplicate_warnings?: string[];
  disclosure_options: NexusLocationDisclosureOption[];
  scope_descriptor?: LocalityScopeDescriptor | null;
  scope_type_label?: string | null;
  scope_type_key?: string | null;
  scope_hierarchy_system?: LocalityHierarchySystem | null;
  legacy_level?: LegacyLocalityLevel | null;
  manual_status?: LocalityManualStatus | null;
};

export type NexusLocationCreateCandidate = {
  query: string;
  canonical_name_key: string;
  label: string;
  description: string;
  level?: NexusLocationSearchResult['level'] | null;
  parent_scope_id?: string | null;
};
