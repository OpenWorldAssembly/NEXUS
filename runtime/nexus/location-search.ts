/**
 * File: location-search.ts
 * Description: Defines provider-agnostic location lookup payloads for Nexus identity flows.
 */

export type NexusLocationDisclosureOption = {
  scope: 'nation' | 'region' | 'city' | 'district';
  value: string;
  label: string;
  description: string;
};

export type NexusLocationSearchResult = {
  scope_id: string;
  name: string;
  short_label: string;
  locality_label: string;
  level: 'nation' | 'region' | 'city' | 'district';
  path_label: string;
  parent_path_label: string | null;
  canonical_name_key: string;
  match_type: 'exact' | 'alias' | 'fuzzy' | 'path' | 'create_candidate';
  description: string;
  duplicate_warnings?: string[];
  disclosure_options: NexusLocationDisclosureOption[];
};

export type NexusLocationCreateCandidate = {
  query: string;
  canonical_name_key: string;
  label: string;
  description: string;
  level?: NexusLocationSearchResult['level'] | null;
  parent_scope_id?: string | null;
};
