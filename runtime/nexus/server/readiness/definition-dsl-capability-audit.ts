/**
 * File: definition-dsl-capability-audit.ts
 * Description: Static audit of definition DSL coverage for defaults, preferences, policies, dependencies, workflows, and projections.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type DefinitionDslCapabilityLayer =
  | 'core_nexus'
  | 'trusted_runtime'
  | 'adapter_runtime'
  | 'ui_wrapper';

export type DefinitionDslCapabilityStatus =
  | 'runtime_ready'
  | 'definition_ready'
  | 'metadata_only'
  | 'custom_runtime_owned'
  | 'needs_design_decision';

export type DefinitionDslCapabilityArea =
  | 'resolution_language'
  | 'workflow_language'
  | 'projection_language'
  | 'defaults_language'
  | 'policy_language'
  | 'dependency_language'
  | 'preference_language'
  | 'discussion_projection'
  | 'seed_defaults';

export type DefinitionDslCapabilityFindingSeverity = 'error' | 'warning' | 'info';

export type DefinitionDslCapabilityFinding = {
  severity: DefinitionDslCapabilityFindingSeverity;
  area: DefinitionDslCapabilityArea;
  code: string;
  message: string;
};

export type DefinitionDslCapabilityEntry = {
  area: DefinitionDslCapabilityArea;
  layer: DefinitionDslCapabilityLayer;
  status: DefinitionDslCapabilityStatus;
  source_files: string[];
  evidence: string[];
  next_step: string;
};

export type DefinitionDslCapabilityAuditReport = {
  report_kind: 'packet.definition_dsl_capability_audit';
  status: 'pass' | 'warn' | 'fail';
  scanned_files: string[];
  counts: {
    resolution_binding_kinds: number;
    resolution_presets: number;
    workflow_plans: number;
    workflow_condition_steps: number;
    projection_descriptors: number;
    rich_projection_sources: number;
    defaults_definition_parts: number;
    dependencies_definition_parts: number;
    policy_requirement_sources: number;
  };
  entries: DefinitionDslCapabilityEntry[];
  findings: DefinitionDslCapabilityFinding[];
};

const SOURCE_FILES = [
  'core/packets/resolution-dsl.ts',
  'core/packets/packet-workflow-planner.ts',
  'core/packets/definitions/packet-definition-types.ts',
  'core/packets/definitions/generic-type.ts',
  'core/packets/definitions/bundle.ts',
  'core/packets/definitions/definition.ts',
  'core/packets/definitions/preference.ts',
  'core/packets/definitions/discussion.ts',
  'core/packets/packet-defaults.ts',
  'core/packets/packet-policy-dependency.ts',
  'core/packets/packet-policy-semantics.ts',
  'runtime/trusted_coordinators/trusted_resolution_coordinator/functions/run_resolution_step.ts',
  'runtime/trusted_coordinators/trusted_resolution_coordinator/functions/resolve_resolution_binding.ts',
  'runtime/trusted_coordinators/trusted_projection_coordinator/functions/resolve_packet_projection.ts',
  'runtime/trusted_coordinators/trusted_regulation_coordinator/functions/resolve_trusted_policy_context.ts',
  'runtime/nexus/server/discussion/discussion-service.ts',
  'runtime/nexus/server/discussion/default-discussion-surfaces.ts',
  'core/packets/defaults/element-discussion-defaults.ts',
] as const;

function repoPath(path: string): string {
  return join(process.cwd(), path);
}

function readRepoFile(path: string): string {
  const absolutePath = repoPath(path);

  if (!existsSync(absolutePath)) {
    return '';
  }

  return readFileSync(absolutePath, 'utf8');
}

function countMatches(source: string, pattern: RegExp): number {
  return Array.from(source.matchAll(pattern)).length;
}


function countGenericPacketTypes(source: string): number {
  const configMatch = source.match(/const GENERIC_TYPE_CONFIGS = \[([\s\S]*?)\] as const/s);
  return countMatches(configMatch?.[1] ?? '', /type:\s*'[A-Z][A-Za-z0-9]+'/g);
}

function hasAll(source: string, fragments: readonly string[]): boolean {
  return fragments.every((fragment) => source.includes(fragment));
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function statusFromFindings(
  findings: readonly DefinitionDslCapabilityFinding[]
): DefinitionDslCapabilityAuditReport['status'] {
  if (findings.some((finding) => finding.severity === 'error')) {
    return 'fail';
  }

  if (findings.some((finding) => finding.severity === 'warning')) {
    return 'warn';
  }

  return 'pass';
}

function createEntry(input: DefinitionDslCapabilityEntry): DefinitionDslCapabilityEntry {
  return {
    ...input,
    source_files: uniqueSorted(input.source_files),
  };
}

export function createDefinitionDslCapabilityAuditReport(): DefinitionDslCapabilityAuditReport {
  const sources = Object.fromEntries(
    SOURCE_FILES.map((filePath) => [filePath, readRepoFile(filePath)])
  ) as Record<(typeof SOURCE_FILES)[number], string>;
  const resolutionDsl = sources['core/packets/resolution-dsl.ts'];
  const workflowPlanner = sources['core/packets/packet-workflow-planner.ts'];
  const definitionTypes = sources['core/packets/definitions/packet-definition-types.ts'];
  const genericTypeDefinition = sources['core/packets/definitions/generic-type.ts'];
  const bundleDefinition = sources['core/packets/definitions/bundle.ts'];
  const definitionDefinition = sources['core/packets/definitions/definition.ts'];
  const preferenceDefinition = sources['core/packets/definitions/preference.ts'];
  const discussionDefinition = sources['core/packets/definitions/discussion.ts'];
  const packetDefaults = sources['core/packets/packet-defaults.ts'];
  const policyDependency = sources['core/packets/packet-policy-dependency.ts'];
  const policySemantics = sources['core/packets/packet-policy-semantics.ts'];
  const resolutionRunner = sources['runtime/trusted_coordinators/trusted_resolution_coordinator/functions/run_resolution_step.ts'];
  const bindingRunner = sources['runtime/trusted_coordinators/trusted_resolution_coordinator/functions/resolve_resolution_binding.ts'];
  const projectionRunner = sources['runtime/trusted_coordinators/trusted_projection_coordinator/functions/resolve_packet_projection.ts'];
  const policyContext = sources['runtime/trusted_coordinators/trusted_regulation_coordinator/functions/resolve_trusted_policy_context.ts'];
  const discussionService = sources['runtime/nexus/server/discussion/discussion-service.ts'];
  const discussionDefaults = sources['runtime/nexus/server/discussion/default-discussion-surfaces.ts'];
  const elementDiscussionDefaults = sources['core/packets/defaults/element-discussion-defaults.ts'];

  const genericPacketTypeCount = countGenericPacketTypes(genericTypeDefinition);
  const nativeDefinitionSources = [bundleDefinition, definitionDefinition, preferenceDefinition, discussionDefinition];
  const counts = {
    resolution_binding_kinds: countMatches(resolutionDsl, /binding_kind: '/g),
    resolution_presets: countMatches(resolutionDsl, /preset_id: '/g),
    workflow_plans:
      countMatches(genericTypeDefinition, /workflow_plan_id:\s*'/g) +
      countMatches(preferenceDefinition, /workflow_plan_id:\s*'/g),
    workflow_condition_steps: countMatches(genericTypeDefinition, /step_kind:\s*'condition'/g),
    projection_descriptors:
      genericPacketTypeCount * 2 +
      nativeDefinitionSources.reduce((count, source) => count + countMatches(source, /projection_key:\s*'/g), 0),
    rich_projection_sources:
      genericPacketTypeCount * 2 +
      nativeDefinitionSources.reduce((count, source) => count + countMatches(source, /field_descriptors:\s*/g), 0),
    defaults_definition_parts:
      countMatches(genericTypeDefinition, /part_subtype:\s*'defaults_definition'/g) +
      nativeDefinitionSources.reduce((count, source) => count + countMatches(source, /part_subtype:\s*'defaults_definition'/g), 0),
    dependencies_definition_parts:
      countMatches(genericTypeDefinition, /part_subtype:\s*'dependencies_definition'/g) +
      nativeDefinitionSources.reduce((count, source) => count + countMatches(source, /part_subtype:\s*'dependencies_definition'/g), 0),
    policy_requirement_sources:
      countMatches(policyDependency, /PacketPolicyRequirementDescriptor/g) +
      countMatches(policySemantics, /PacketPolicySemanticDescriptor/g),
  };

  const entries: DefinitionDslCapabilityEntry[] = [
    createEntry({
      area: 'resolution_language',
      layer: 'core_nexus',
      status: hasAll(resolutionDsl, [
        'ResolutionValueBinding',
        'ResolutionConditionDescriptor',
        'RESOLUTION_DSL_PRESETS',
      ]) && hasAll(bindingRunner, [
        'binding_kind',
        'definition_path',
        'current_packet',
      ])
        ? 'runtime_ready'
        : 'metadata_only',
      source_files: [
        'core/packets/resolution-dsl.ts',
        'runtime/trusted_coordinators/trusted_resolution_coordinator/functions/resolve_resolution_binding.ts',
        'runtime/trusted_coordinators/trusted_resolution_coordinator/functions/run_resolution_step.ts',
      ],
      evidence: [
        `${counts.resolution_binding_kinds} binding-kind declarations and ${counts.resolution_presets} preset declarations found.`,
        'Resolution bindings are executable through Trusted Resolution Coordinator for current packet, actor, input, static, step-output, and definition-path values.',
      ],
      next_step:
        'Keep expanding bindings only when definitions hit a real missing resolver; avoid a speculative mega-language.',
    }),
    createEntry({
      area: 'workflow_language',
      layer: 'core_nexus',
      status: hasAll(workflowPlanner, [
        'PacketWorkflowPlanDescriptor',
        'resolvePacketWorkflowDryRunPlan',
        'auditPacketWorkflowPlanDescriptor',
      ])
        ? 'definition_ready'
        : 'metadata_only',
      source_files: [
        'core/packets/packet-workflow-planner.ts',
        'core/packets/definitions/generic-type.ts',
        'core/packets/definitions/bundle.ts',
        'core/packets/definitions/definition.ts',
        'core/packets/definitions/preference.ts',
      ],
      evidence: [
        `${counts.workflow_plans} workflow-plan descriptor declarations found across generic and Preference definitions.`,
        `${counts.workflow_condition_steps} condition-step declarations found, so branchable workflows are already modeled at definition level.`,
      ],
      next_step:
        'Do not build a full live interpreter yet; enroll only the next operation family that needs runtime execution.',
    }),
    createEntry({
      area: 'projection_language',
      layer: 'trusted_runtime',
      status: hasAll(definitionTypes, [
        'PacketProjectionDescriptor',
        'PacketProjectionFieldDescriptor',
        'PacketProjectionLayoutDescriptor',
      ]) && hasAll(projectionRunner, [
        'projection.field_descriptors',
        'resolveTrustedResolutionBinding',
        'projection.layout?.layout_key',
      ])
        ? 'runtime_ready'
        : 'metadata_only',
      source_files: [
        'core/packets/definitions/packet-definition-types.ts',
        'core/packets/definitions/generic-type.ts',
        'core/packets/definitions/bundle.ts',
        'core/packets/definitions/definition.ts',
        'core/packets/definitions/preference.ts',
        'core/packets/definitions/discussion.ts',
        'runtime/trusted_coordinators/trusted_projection_coordinator/functions/resolve_packet_projection.ts',
      ],
      evidence: [
        `${counts.projection_descriptors} projection-key declarations found and ${counts.rich_projection_sources} rich field-descriptor sources found.`,
        'Trusted Projection Coordinator already resolves field descriptors through the shared resolution binding runner.',
      ],
      next_step:
        'Upgrade discussion/forum/feed projections by adding richer descriptors before adding any more custom surface code.',
    }),
    createEntry({
      area: 'defaults_language',
      layer: 'core_nexus',
      status: hasAll(packetDefaults, [
        'default_values',
        'default_merge_strategy',
        'resolvePacketDefaultProfile',
      ])
        ? 'definition_ready'
        : 'metadata_only',
      source_files: [
        'core/packets/packet-defaults.ts',
        'core/packets/definitions/generic-type.ts',
        'core/packets/definitions/bundle.ts',
        'core/packets/definitions/definition.ts',
        'core/packets/definitions/preference.ts',
      ],
      evidence: [
        `${counts.defaults_definition_parts} defaults_definition part declarations found in the generic factory and Preference definition.`,
        'Defaults are modeled as definition parts with deep-overlay semantics, not runtime special cases.',
      ],
      next_step:
        'Move OWA flagship defaults into default Definition/seed packets rather than adding packet-specific runtime defaults.',
    }),
    createEntry({
      area: 'policy_language',
      layer: 'trusted_runtime',
      status: hasAll(policyDependency, [
        'PacketPolicyRequirementDescriptor',
        'listPacketPolicyRequirementDescriptorsFromDefinitions',
      ]) && hasAll(policyContext, [
        'resolveTrustedPolicyContext',
        'resolution.policy_gate.v0',
      ])
        ? 'definition_ready'
        : 'metadata_only',
      source_files: [
        'core/packets/packet-policy-dependency.ts',
        'core/packets/packet-policy-semantics.ts',
        'runtime/trusted_coordinators/trusted_regulation_coordinator/functions/resolve_trusted_policy_context.ts',
      ],
      evidence: [
        `${counts.policy_requirement_sources} policy requirement/semantic descriptor references found.`,
        'Regulation resolves policy requirements from packet definitions and Policy packet semantics.',
      ],
      next_step:
        'Keep write enforcement in Regulation, but express new policy needs as Policy/Definition metadata first.',
    }),
    createEntry({
      area: 'dependency_language',
      layer: 'core_nexus',
      status: hasAll(policyDependency, [
        'PacketDependencyRequirementDescriptor',
        'listPacketDependencyRequirementDescriptorsFromDefinitions',
      ])
        ? 'definition_ready'
        : 'metadata_only',
      source_files: [
        'core/packets/packet-policy-dependency.ts',
        'core/packets/definitions/generic-type.ts',
        'core/packets/definitions/bundle.ts',
        'core/packets/definitions/definition.ts',
        'core/packets/definitions/preference.ts',
      ],
      evidence: [
        `${counts.dependencies_definition_parts} dependencies_definition part declarations found in the generic factory and Preference definition.`,
        'Dependencies already resolve as requirement descriptors anchored to definition parts or trusted capability seams.',
      ],
      next_step:
        'Use dependencies_definition refs to describe needed runtime capabilities; only implement adapters where a trusted coordinator needs one.',
    }),
    createEntry({
      area: 'preference_language',
      layer: 'trusted_runtime',
      status: hasAll(preferenceDefinition, [
        'preference.element.set.workflow.v0',
        'scope_display_preferences',
        'field_descriptors',
        'defaults_definition',
        'dependencies_definition',
      ])
        ? 'runtime_ready'
        : 'metadata_only',
      source_files: [
        'core/packets/definitions/preference.ts',
      ],
      evidence: [
        'Preference.element now carries builder, planner, workflow, projection, default, dependency, and compatibility descriptors.',
        'Preference is the current pilot pattern for keeping runtime/core free of preference-specific semantics.',
      ],
      next_step:
        'Use Preference.element as the template for the next flagship packet definition pass.',
    }),
    createEntry({
      area: 'discussion_projection',
      layer: 'adapter_runtime',
      status: hasAll(discussionDefinition, [
        'DISCUSSION_AGGREGATE_PROJECTIONS',
        'discussion.workspace.aggregate.v0',
        'discussion.forum.feed.aggregate.v0',
        'discussion.post.thread.aggregate.v0',
        'discussion.composer.surface.v0',
      ]) && hasAll(discussionService, [
        'resolveDiscussionDefinitionProjection',
        'trustedProjectionCoordinator.resolvePacketProjection',
        'definition_projection',
      ])
        ? 'runtime_ready'
        : hasAll(discussionDefinition, [
          'DISCUSSION_AGGREGATE_PROJECTIONS',
          'discussion.workspace.aggregate.v0',
          'discussion.forum.feed.aggregate.v0',
          'discussion.post.thread.aggregate.v0',
          'discussion.composer.surface.v0',
        ])
          ? 'definition_ready'
          : hasAll(discussionService, [
            'DiscussionWorkspaceModel',
            'DiscussionForumProjection',
            'ReactionVoteSummary',
          ])
            ? 'custom_runtime_owned'
            : 'needs_design_decision',
      source_files: [
        'core/packets/definitions/discussion.ts',
        'core/packets/definitions/generic-type.ts',
        'runtime/nexus/server/discussion/discussion-service.ts',
      ],
      evidence: [
        'Discussion workspace/forum/topic/thread/reply/composer projection descriptors now live in the Discussion definition overlay.',
        'Adapter aggregation can still compute child lists, vote summaries, and pagination, but layout, action keys, and query intent are definition-owned.',
        'The discussion service now attaches definition_projection metadata resolved through Trusted Projection while preserving its existing UI-compatible aggregate payloads.',
      ],
      next_step:
        'Keep aggregation adapter-owned; the next high-value step is promoting default discussion surface recipes into definition/reseed material.',
    }),
    createEntry({
      area: 'seed_defaults',
      layer: 'adapter_runtime',
      status: hasAll(discussionDefaults, [
        'ensureDefaultDiscussionSurfaces',
        'buildElementDefaultDiscussionPackets',
      ]) && hasAll(elementDiscussionDefaults, [
        'ElementDiscussionProfile',
        'createDiscussionForumPacketId',
      ])
        ? 'custom_runtime_owned'
        : 'needs_design_decision',
      source_files: [
        'runtime/nexus/server/discussion/default-discussion-surfaces.ts',
        'core/packets/defaults/element-discussion-defaults.ts',
      ],
      evidence: [
        'Default discussion surfaces are still planned by helper code instead of Definition default/dependency projection packets.',
        'The behavior is contained and useful, but it is not yet expressed as reseed-ready default metadata.',
      ],
      next_step:
        'Promote OWA/default discussion surface recipes into definitions/seeds before the big reseed.',
    }),
  ];

  const findings: DefinitionDslCapabilityFinding[] = [];

  for (const [filePath, source] of Object.entries(sources)) {
    if (source.length > 0) {
      continue;
    }

    findings.push({
      severity: 'error',
      area: 'resolution_language',
      code: 'source_file_missing',
      message: `Expected audit source file is missing: ${filePath}.`,
    });
  }

  if (counts.resolution_presets === 0 || counts.resolution_binding_kinds === 0) {
    findings.push({
      severity: 'error',
      area: 'resolution_language',
      code: 'resolution_dsl_missing',
      message: 'Resolution DSL presets or binding kinds were not detected.',
    });
  }

  if (!projectionRunner.includes('resolveTrustedResolutionBinding')) {
    findings.push({
      severity: 'error',
      area: 'projection_language',
      code: 'projection_runner_not_definition_bound',
      message: 'Trusted Projection Coordinator is not resolving projection fields through Resolution DSL bindings.',
    });
  }

  findings.push({
    severity: 'info',
    area: 'workflow_language',
    code: 'workflow_interpreter_not_next_by_default',
    message:
      'Workflow plans are definition-ready and dry-run auditable, but live execution is still intentionally enrolled through trusted local coordinators instead of a broad generic interpreter.',
  });

  if (!discussionDefinition.includes('discussion.workspace.aggregate.v0')) {
    findings.push({
      severity: 'warning',
      area: 'discussion_projection',
      code: 'discussion_workspace_projection_custom',
      message:
        'Discussion workspace/forum/thread/feed projection remains custom runtime composition; generic card/detail projection is not enough for the current discussion surface.',
    });
  } else {
    findings.push({
      severity: 'info',
      area: 'discussion_projection',
      code: 'discussion_aggregate_projection_definition_ready',
      message:
        discussionService.includes('resolveDiscussionDefinitionProjection')
          ? 'Discussion aggregate projection descriptors are definition-backed and consumed through Trusted Projection; adapter aggregation remains contained behind trusted coordinator seams.'
          : 'Discussion aggregate projection descriptors are now definition-backed; adapter aggregation remains contained behind trusted coordinator seams.',
    });
  }

  findings.push({
    severity: 'warning',
    area: 'seed_defaults',
    code: 'discussion_defaults_not_definition_seeded',
    message:
      'Default discussion surfaces are still generated by helper code; promote the recipes into Definition/default seed material before reseed.',
  });

  return {
    report_kind: 'packet.definition_dsl_capability_audit',
    status: statusFromFindings(findings),
    scanned_files: [...SOURCE_FILES],
    counts,
    entries,
    findings,
  };
}
