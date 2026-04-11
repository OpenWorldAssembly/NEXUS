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
  description: string;
  disclosure_options: NexusLocationDisclosureOption[];
};
