import { createHash } from 'node:crypto';

export const MONSTER_AFFINITIES = ['normal', 'wood', 'fire', 'metal', 'water', 'wind'] as const;

export type MonsterAffinity = (typeof MONSTER_AFFINITIES)[number];

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

export function buildMonsterWikiPage(monster: MonsterWikiIdentity): string {
	const debut = monster.debutFloor === null ? 'Not assigned' : `Floor ${monster.debutFloor}`;
	const skills = monster.skills.length > 0 ? monster.skills.join(' · ') : 'Not yet assigned';
	return `# ${monster.name}

Wiki ID: \`monster.${monster.id}\`

[← Monster database](README.md)

Design status: **draft**

Visual status: **candidate matrix**

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

The online plate above leads with the identity reference, then presents Wood, Fire, Metal,
Water, and Wind as variants of the same monster identity. Affinity may change material, effect,
equipment treatment, or local anatomy only where the bound production manifest permits it.

The visual matrix above is generated from hash-bound review catalogs. Its images are production
candidates, not automatically approved runtime assets. The status shown on each image is preserved
from its source review record.

## Canon boundary

- The monster identity, family, battlefield role, telegraph, and counterplay are authored content.
- The six images are visual proposals for one persistent identity across affinity changes.
- A candidate or revision image does not establish combat statistics, morality, culture, or a
  universal affinity assignment.
- Human approval and runtime promotion remain separate decisions.

## Visual-production handoff

Future visual work should update the monster's manifest-bound target and candidate output rather
than replacing this page with an untracked image. Re-run the monster-wiki export after review to
refresh the online plate, hashes, and statuses. Authored notes outside the generated visual index
remain available to content and systems workers.
`;
}
