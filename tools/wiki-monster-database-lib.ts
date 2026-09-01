import { createHash } from 'node:crypto';

export const MONSTER_AFFINITIES = ['normal', 'wood', 'fire', 'metal', 'water', 'wind'] as const;

export const CURRENT_MONSTER_PRODUCTION_TARGET = [
	'normal',
	'fire',
	'earth',
	'wind',
	'water'
] as const;

export const LEGACY_MONSTER_VISUAL_STUDIES = ['wood', 'metal'] as const;
export const MONSTER_VISUAL_INDEX_SOURCE_STATUS = 'producer-candidates' as const;

export type MonsterAffinity = (typeof MONSTER_AFFINITIES)[number];
export type CurrentMonsterAffinity = (typeof CURRENT_MONSTER_PRODUCTION_TARGET)[number];
export type LegacyMonsterVisualStudy = (typeof LEGACY_MONSTER_VISUAL_STUDIES)[number];
export type MonsterVisualPresentationStatus = 'current-target-candidate' | 'legacy-candidate';

export interface MonsterVisualCandidate {
	readonly targetId: string;
	readonly speciesId: string;
	readonly affinity: MonsterAffinity;
	readonly status: 'candidate' | 'revise';
	readonly candidatePath: string;
	readonly contentHash: string;
	readonly version: number;
}

export interface MonsterWikiIdentity {
	readonly id: string;
	readonly name: string;
	readonly familyId: string;
	readonly familyName: string;
	readonly role: string;
	readonly telegraph: string;
	readonly counterplay: string;
	readonly skills: readonly string[];
	readonly debutFloor: number | null;
}

export function assertMonsterVisualIndexProvenance(index: {
	readonly sourceStatus?: unknown;
}): void {
	if (index.sourceStatus !== MONSTER_VISUAL_INDEX_SOURCE_STATUS) {
		throw new Error(
			`Monster visual index source status is stale: expected ${MONSTER_VISUAL_INDEX_SOURCE_STATUS}, found ${String(index.sourceStatus)}`
		);
	}
}

function candidateRank(candidate: MonsterVisualCandidate): [number, number] {
	return [candidate.status === 'candidate' ? 1 : 0, candidate.version];
}

export function matchesContentHash(content: Uint8Array, expectedHash: string): boolean {
	return createHash('sha256').update(content).digest('hex') === expectedHash;
}

export function selectCanonicalVariants(
	candidates: readonly MonsterVisualCandidate[]
): readonly MonsterVisualCandidate[] {
	return MONSTER_AFFINITIES.map((affinity) => {
		const matches = candidates
			.filter((candidate) => candidate.affinity === affinity)
			.sort((left, right) => {
				const [leftStatus, leftVersion] = candidateRank(left);
				const [rightStatus, rightVersion] = candidateRank(right);
				return rightStatus - leftStatus || rightVersion - leftVersion;
			});
		const selected = matches[0];
		if (!selected) throw new Error(`Missing affinity ${affinity} from monster visual set`);
		return selected;
	});
}

export function partitionMonsterVisualStudies(candidates: readonly MonsterVisualCandidate[]): {
	readonly currentCandidates: readonly MonsterVisualCandidate[];
	readonly missingCurrentTargets: readonly CurrentMonsterAffinity[];
	readonly legacyCandidates: readonly MonsterVisualCandidate[];
} {
	const candidateByAffinity = new Map(
		candidates.map((candidate) => [candidate.affinity, candidate])
	);
	const currentCandidates = CURRENT_MONSTER_PRODUCTION_TARGET.flatMap((affinity) => {
		const candidate = affinity === 'earth' ? undefined : candidateByAffinity.get(affinity);
		return candidate ? [candidate] : [];
	});
	const missingCurrentTargets = CURRENT_MONSTER_PRODUCTION_TARGET.filter(
		(affinity) => affinity === 'earth' || !candidateByAffinity.has(affinity)
	);
	const legacyCandidates = LEGACY_MONSTER_VISUAL_STUDIES.flatMap((affinity) => {
		const candidate = candidateByAffinity.get(affinity);
		return candidate ? [candidate] : [];
	});
	return { currentCandidates, missingCurrentTargets, legacyCandidates };
}

export function presentationStatusForVisualStudy(
	affinity: MonsterAffinity
): MonsterVisualPresentationStatus {
	return LEGACY_MONSTER_VISUAL_STUDIES.includes(affinity as LegacyMonsterVisualStudy)
		? 'legacy-candidate'
		: 'current-target-candidate';
}

export function wikiPresentationCounterplay(
	monsterId: string,
	authoredCounterplay: string
): string {
	return monsterId === 'giant-tower-dragon'
		? 'arcane scars exposed only after a committed attack'
		: authoredCounterplay;
}

export function buildMonsterWikiPage(monster: MonsterWikiIdentity): string {
	const debut = monster.debutFloor === null ? 'Not assigned' : `Floor ${monster.debutFloor}`;
	const skills = monster.skills.length > 0 ? monster.skills.join(' · ') : 'Not yet assigned';
	return `# ${monster.name}

Wiki ID: \`monster.${monster.id}\`

[← Monster database](README.md)

Design status: **draft**

Runtime status: **${monster.debutFloor === null ? 'not scheduled' : 'roster definition available'}**

## Identity

| Field | Current definition |
| --- | --- |
| Family | [${monster.familyName}](README.md) |
| Battlefield role | ${monster.role} |
| Earliest authored floor | ${debut} |
| Signature skills or actions | ${skills} |
| Telegraph | ${monster.telegraph} |
| Counterplay | ${monster.counterplay} |

## Visual matrix

Current production target: Normal, Fire, Earth, Wind, Water

Legacy visual studies: Wood and Metal candidates; not current affinities and not runtime assets

The online plate leads with the Normal identity reference. The current-target selector presents
available Fire, Wind, and Water candidate evidence; Earth remains a current target even though no
Earth candidate exists in this preserved source set. Candidate evidence is neither approved nor
runtime artwork.

The separate legacy section preserves the old Wood and Metal studies for review without presenting
them as current affinities. Source paths and hashes remain in the visual catalog.

## Canon boundary

- The monster identity, family, battlefield role, telegraph, and counterplay are authored content.
- The six preserved source images are visual proposals for one persistent identity.
- Visual artwork does not establish combat statistics, morality, culture, or a universal affinity
  assignment.
- Human approval and runtime promotion remain separate decisions.

## Visual-production handoff

Future visual work should update the monster's manifest-bound artwork rather than replacing this
page with an untracked image. Re-run the monster-wiki export after review to refresh the online
selector. Authored notes outside the generated visual index remain available to content and systems
workers.
`;
}
