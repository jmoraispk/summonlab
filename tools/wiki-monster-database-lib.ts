import { createHash } from 'node:crypto';

export const MONSTER_AFFINITIES = ['normal', 'fire', 'earth', 'wind', 'water'] as const;
export const AVAILABLE_MONSTER_CANDIDATE_AFFINITIES = ['normal', 'fire', 'wind', 'water'] as const;
export const MONSTER_VISUAL_INDEX_SOURCE_STATUS = 'producer-candidates' as const;

export type MonsterAffinity = (typeof MONSTER_AFFINITIES)[number];
export type CurrentMonsterAffinity = MonsterAffinity;
export type MonsterVisualPresentationStatus = 'candidate-only';

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
	return AVAILABLE_MONSTER_CANDIDATE_AFFINITIES.map((affinity) => {
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
} {
	const candidateByAffinity = new Map(
		candidates.map((candidate) => [candidate.affinity, candidate])
	);
	const currentCandidates = MONSTER_AFFINITIES.flatMap((affinity) => {
		const candidate = candidateByAffinity.get(affinity);
		return candidate ? [candidate] : [];
	});
	const missingCurrentTargets = MONSTER_AFFINITIES.filter(
		(affinity) => !candidateByAffinity.has(affinity)
	);
	return { currentCandidates, missingCurrentTargets };
}

export function presentationStatusForVisualStudy(): MonsterVisualPresentationStatus {
	return 'candidate-only';
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

The online plate leads with the Normal identity reference. The selector presents available Fire,
Wind, and Water candidate evidence; Earth remains a current target even though no Earth candidate
exists in this source set. Candidate evidence is neither approved nor runtime artwork.

## Canon boundary

- The monster identity, family, battlefield role, telegraph, and counterplay are authored content.
- The four available source images are visual proposals for one persistent identity.
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
