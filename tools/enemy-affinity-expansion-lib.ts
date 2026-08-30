import { createHash } from 'node:crypto';

import {
	ImageProductionAssignmentSchema,
	ImageProductionExpansionTargetSchema,
	type ImageProductionAssignment,
	type ImageProductionExpansionTarget
} from '../packages/contracts/src/index.js';
import {
	AFFINITY_IDS,
	ALL_AFFINITY_TARGETS,
	ENEMY_AFFINITY_EXPANSION_SPECIES_IDS,
	ENEMY_AFFINITY_EXPANSION_TARGETS,
	ENEMY_AFFINITY_EXPANSION_VERSION
} from '../packages/content/src/index.js';

export const ENEMY_AFFINITY_EXPANSION_ROOT =
	'assets/enemies/experiments/affinity-expansion-v1' as const;
export const ENEMY_AFFINITY_EXPANSION_EXPORT_TIMESTAMP = '2026-08-30T20:00:00.000Z' as const;

export interface EnemyAffinityExpansionArtifact {
	readonly path: string;
	readonly value: unknown;
}

export function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
		.join(',')}}`;
}

export function sha256Json(value: unknown): string {
	return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function expansionTargetPath(target: ImageProductionExpansionTarget): string {
	return `${ENEMY_AFFINITY_EXPANSION_ROOT}/targets/${target.speciesId}/${target.affinity}.json`;
}

export function expansionAssignmentPath(target: ImageProductionExpansionTarget): string {
	return `${ENEMY_AFFINITY_EXPANSION_ROOT}/assignments/${target.speciesId}/${target.affinity}.json`;
}

export function createEnemyAffinityExpansionAssignments(
	targets: readonly ImageProductionExpansionTarget[]
): readonly ImageProductionAssignment[] {
	const forbiddenSharedPaths = [
		`${ENEMY_AFFINITY_EXPANSION_ROOT}/manifest.json`,
		`${ENEMY_AFFINITY_EXPANSION_ROOT}/review/catalog.json`,
		`${ENEMY_AFFINITY_EXPANSION_ROOT}/review/blind-review.json`,
		`${ENEMY_AFFINITY_EXPANSION_ROOT}/review/evaluation.json`,
		`${ENEMY_AFFINITY_EXPANSION_ROOT}/review/contact-sheet.png`,
		`${ENEMY_AFFINITY_EXPANSION_ROOT}/generation-record.md`
	];
	return targets.map((target) =>
		ImageProductionAssignmentSchema.parse({
			schemaVersion: 'image-production-assignment-v1',
			assignmentId: `assignment-${target.targetId}`,
			targetId: target.targetId,
			skillVersion: 'summonlab-image-production-v2',
			assignedAt: ENEMY_AFFINITY_EXPANSION_EXPORT_TIMESTAMP,
			dryRun: false,
			retryCeiling: 1,
			permittedOutputs: target.output,
			forbiddenSharedPaths,
			completionContract: {
				oneTargetOneImage: true,
				structuredResultRequired: true,
				sharedFilesMustRemainUntouched: true,
				selfPromotionForbidden: true
			}
		})
	);
}

export function createEnemyAffinityExpansionBundle(): {
	readonly targets: readonly ImageProductionExpansionTarget[];
	readonly assignments: readonly ImageProductionAssignment[];
	readonly artifacts: readonly EnemyAffinityExpansionArtifact[];
} {
	const targets = ENEMY_AFFINITY_EXPANSION_TARGETS.map((target) =>
		ImageProductionExpansionTargetSchema.parse(target)
	);
	const assignments = createEnemyAffinityExpansionAssignments(targets);
	if (targets.length !== 204 || assignments.length !== 204) {
		throw new Error(
			`Expected 204 targets and assignments; found ${targets.length}/${assignments.length}`
		);
	}
	const targetIds = new Set(targets.map((target) => target.targetId));
	const assignmentIds = new Set(assignments.map((assignment) => assignment.assignmentId));
	const outputPaths = new Set(
		targets.flatMap((target) => [target.output.candidatePath, target.output.resultPath])
	);
	if (targetIds.size !== 204 || assignmentIds.size !== 204 || outputPaths.size !== 408) {
		throw new Error('Expansion IDs and all 408 owned output paths must be unique');
	}
	for (const speciesId of ENEMY_AFFINITY_EXPANSION_SPECIES_IDS) {
		for (const affinity of AFFINITY_IDS) {
			if (
				targets.filter((target) => target.speciesId === speciesId && target.affinity === affinity)
					.length !== 1
			) {
				throw new Error(`Expected exactly one expansion target for ${speciesId}/${affinity}`);
			}
		}
	}
	const manifest = {
		schemaVersion: 'enemy-affinity-expansion-manifest-v1',
		experimentId: ENEMY_AFFINITY_EXPANSION_VERSION,
		generatedAt: ENEMY_AFFINITY_EXPANSION_EXPORT_TIMESTAMP,
		status: 'producer-complete',
		affinities: AFFINITY_IDS,
		species: ENEMY_AFFINITY_EXPANSION_SPECIES_IDS.map((speciesId, index) => ({
			speciesId,
			priority: index < 9 ? 1 : index < 22 ? 2 : 3,
			targetCount: 6,
			targetPaths: targets
				.filter((target) => target.speciesId === speciesId)
				.map((target) => expansionTargetPath(target))
		})),
		counts: {
			species: 34,
			affinitiesPerSpecies: 6,
			targets: 204,
			assignments: 204,
			ownedOutputPaths: 408,
			maximumProviderCallsWithOneRetry: 408
		},
		baselineGuard: {
			experimentId: 'affinity-workflow-v1',
			targetCount: ALL_AFFINITY_TARGETS.length,
			definitionHash: sha256Json(ALL_AFFINITY_TARGETS)
		}
	};
	const artifacts: EnemyAffinityExpansionArtifact[] = [
		...targets.map((target) => ({ path: expansionTargetPath(target), value: target })),
		...targets.map((target, index) => ({
			path: expansionAssignmentPath(target),
			value: assignments[index]!
		})),
		{ path: `${ENEMY_AFFINITY_EXPANSION_ROOT}/manifest.json`, value: manifest }
	];
	return { targets, assignments, artifacts };
}
