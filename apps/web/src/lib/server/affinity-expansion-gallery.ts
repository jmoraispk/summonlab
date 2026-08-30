import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
	AFFINITY_DEFINITIONS,
	ENEMY_AFFINITY_EXPANSION_SPECIES_IDS,
	ENEMY_AFFINITY_EXPANSION_TARGETS,
	ENEMY_ARCHETYPES,
	ENEMY_REVIEW_FAMILIES,
	PACK_TWO_MONSTER_ARCHETYPES,
	PACK_TWO_MONSTER_FAMILIES,
	type EnemyAffinityExpansionSpeciesId
} from '@summonlab/content';

const EXPERIMENT_ID = 'affinity-expansion-v1';
const AFFINITIES = AFFINITY_DEFINITIONS.map((affinity) => affinity.id);

type AffinityId = (typeof AFFINITIES)[number];
type ResultStatus = 'candidate' | 'revise';
type ResultVersion = 'v3' | 'v2' | 'v1';

const RESULT_VERSIONS: readonly ResultVersion[] = ['v3', 'v2', 'v1'];

interface ResultRecord {
	targetId: string;
	status: string;
	selectedAttemptId: string | null;
	attempts: Array<{
		attemptId: string;
		output: {
			path: string;
			contentHash: string;
			mediaType: string;
			width: number;
			height: number;
			bytes: number;
		} | null;
	}>;
}

function findRepositoryRoot(start: string): string {
	let current = path.resolve(start);
	for (let depth = 0; depth < 10; depth += 1) {
		if (
			existsSync(path.join(current, 'pnpm-workspace.yaml')) &&
			existsSync(path.join(current, `assets/enemies/experiments/${EXPERIMENT_ID}`))
		) {
			return current;
		}
		const parent = path.dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return path.resolve(start);
}

const REPOSITORY_ROOT = findRepositoryRoot(process.cwd());

const familyNameById = new Map([
	...ENEMY_REVIEW_FAMILIES.map((family) => [family.id, family.name] as const),
	...PACK_TWO_MONSTER_FAMILIES.map((family) => [family.id, family.name] as const)
]);

const archetypeById = new Map<
	string,
	{ name: string; familyId: string; familyName: string; role: string }
>([
	...ENEMY_ARCHETYPES.map(
		(archetype) =>
			[
				archetype.id,
				{
					name: archetype.name,
					familyId: archetype.family,
					familyName: familyNameById.get(archetype.family) ?? archetype.family,
					role: archetype.role
				}
			] as const
	),
	...PACK_TWO_MONSTER_ARCHETYPES.map(
		(archetype) =>
			[
				archetype.id,
				{
					name: archetype.name,
					familyId: archetype.family,
					familyName: familyNameById.get(archetype.family) ?? archetype.family,
					role: archetype.duty
				}
			] as const
	)
]);

function targetFor(speciesId: string, affinity: string) {
	return ENEMY_AFFINITY_EXPANSION_TARGETS.find(
		(target) => target.speciesId === speciesId && target.affinity === affinity
	);
}

function versionedOutputPath(outputPath: string, version: ResultVersion): string {
	return outputPath.replace(/-v1(?=\.[^.]+$)/u, `-${version}`);
}

function versionedTargetId(targetId: string, version: ResultVersion): string {
	return version === 'v1' ? targetId : `${targetId}-${version}`;
}

function persistedReviseAttempt(result: ResultRecord, expectedOutputPath: string) {
	for (let index = result.attempts.length - 1; index >= 0; index -= 1) {
		const attempt = result.attempts[index];
		if (attempt?.output?.path === expectedOutputPath) return attempt;
	}
	return null;
}

async function loadResultVersion(
	target: (typeof ENEMY_AFFINITY_EXPANSION_TARGETS)[number],
	version: ResultVersion
) {
	const resultPath = versionedOutputPath(target.output.resultPath, version);
	const candidatePath = versionedOutputPath(target.output.candidatePath, version);
	try {
		const raw = await readFile(path.join(REPOSITORY_ROOT, resultPath), 'utf8');
		const result = JSON.parse(raw) as ResultRecord;
		if (result.targetId !== versionedTargetId(target.targetId, version)) return null;
		if (result.status !== 'candidate' && result.status !== 'revise') return null;
		const attempt =
			result.status === 'candidate'
				? result.attempts.find((candidate) => candidate.attemptId === result.selectedAttemptId)
				: persistedReviseAttempt(result, candidatePath);
		if (!attempt?.output || attempt.output.path !== candidatePath) return null;
		return { result, attempt, status: result.status as ResultStatus, version };
	} catch {
		return null;
	}
}

async function loadResult(target: (typeof ENEMY_AFFINITY_EXPANSION_TARGETS)[number]) {
	const results = await Promise.all(
		RESULT_VERSIONS.map((version) => loadResultVersion(target, version))
	);
	return (
		results.find((loaded) => loaded?.status === 'candidate') ??
		results.find((loaded) => loaded?.status === 'revise') ??
		null
	);
}

export async function loadAffinityExpansionGallery() {
	const rows = await Promise.all(
		ENEMY_AFFINITY_EXPANSION_SPECIES_IDS.map(async (speciesId) => {
			const archetype = archetypeById.get(speciesId);
			if (!archetype) throw new Error(`Missing canonical archetype metadata for ${speciesId}.`);
			const cells = await Promise.all(
				AFFINITY_DEFINITIONS.map(async (affinity) => {
					const target = targetFor(speciesId, affinity.id);
					if (!target) throw new Error(`Missing target for ${speciesId}/${affinity.id}.`);
					const loaded = await loadResult(target);
					return {
						affinity: affinity.id,
						affinityName: affinity.name,
						status: loaded?.status ?? 'pending',
						available: Boolean(loaded),
						mediaUrl: loaded
							? `/forge/enemies/affinity-expansion/media/${speciesId}/${affinity.id}`
							: null
					};
				})
			);
			return { speciesId, ...archetype, cells };
		})
	);
	const completedCount = rows.flatMap((row) => row.cells).filter((cell) => cell.available).length;
	const reviseCount = rows
		.flatMap((row) => row.cells)
		.filter((cell) => cell.status === 'revise').length;
	return {
		experimentId: EXPERIMENT_ID,
		speciesCount: rows.length,
		targetCount: rows.length * AFFINITIES.length,
		completedCount,
		reviseCount,
		rows
	};
}

export async function loadAffinityExpansionMedia(
	speciesId: string,
	affinity: string
): Promise<{
	bytes: ArrayBuffer;
	contentHash: string;
	status: ResultStatus;
} | null> {
	if (!ENEMY_AFFINITY_EXPANSION_SPECIES_IDS.includes(speciesId as EnemyAffinityExpansionSpeciesId))
		return null;
	if (!AFFINITIES.includes(affinity as AffinityId)) return null;
	const target = targetFor(speciesId, affinity);
	if (!target) return null;
	const loaded = await loadResult(target);
	if (!loaded?.attempt.output) return null;
	const candidatePath = path.resolve(REPOSITORY_ROOT, loaded.attempt.output.path);
	if (!candidatePath.startsWith(`${REPOSITORY_ROOT}${path.sep}`)) return null;
	const bytes = await readFile(candidatePath);
	const contentHash = createHash('sha256').update(bytes).digest('hex');
	if (contentHash !== loaded.attempt.output.contentHash) return null;
	const responseBytes = new Uint8Array(bytes.byteLength);
	responseBytes.set(bytes);
	return { bytes: responseBytes.buffer, contentHash, status: loaded.status };
}
