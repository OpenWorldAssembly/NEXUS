/**
 * File: rank_trusted_definition_candidates.ts
 * Description: Applies node runtime definition preferences and returns ranked Trusted Definition candidates.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  TRUSTED_DEFINITION_COORDINATOR_ID,
  type RankTrustedDefinitionCandidatesInput,
  type TrustedDefinitionCandidate,
} from '../trusted_definition_types.ts';
import {
  candidatePreferenceMatches,
  candidateSort,
  definitionTrace,
  trustTierForMode,
} from '../trusted_definition_internal.ts';

function applyPreferences(input: RankTrustedDefinitionCandidatesInput): TrustedDefinitionCandidate[] {
  return input.candidates.map((candidate) => {
    const matchingPreferences = [...(input.preferences ?? [])]
      .filter((preference) => candidatePreferenceMatches({ candidate, preference }))
      .sort((a, b) => b.priority - a.priority || a.preference_id.localeCompare(b.preference_id));

    if (matchingPreferences.length === 0) {
      return candidate;
    }

    const topPreference = matchingPreferences[0];
    const trustStatus = trustTierForMode(topPreference.trust_mode);
    const status =
      topPreference.trust_mode === 'ignore'
        ? 'ignored_candidate'
        : topPreference.trust_mode === 'quarantine'
          ? 'quarantined_candidate'
          : topPreference.trust_mode === 'compatibility_only'
            ? 'compatibility_candidate'
            : 'active_candidate';

    return {
      ...candidate,
      status,
      trust_status: trustStatus,
      priority: candidate.priority + topPreference.priority,
      compatibility_posture:
        topPreference.trust_mode === 'compatibility_only'
          ? 'compatibility_reader'
          : candidate.compatibility_posture,
    };
  });
}

export function rankTrustedDefinitionCandidates(
  input: RankTrustedDefinitionCandidatesInput
): TrustedRuntimeCoordinatorResult<TrustedDefinitionCandidate[]> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const ranked = applyPreferences(input)
    .filter((candidate) => input.include_quarantined || candidate.status !== 'quarantined_candidate')
    .sort(candidateSort);

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_DEFINITION_COORDINATOR_ID,
    coordinator_kind: 'definition',
    value: ranked,
    issues,
    trace: [
      definitionTrace({
        step_id: 'definition.candidates.rank',
        status: 'ok',
        notes: `Ranked ${ranked.length} trusted definition candidates using ${input.preferences?.length ?? 0} node runtime preferences.`,
      }),
    ],
  });
}
