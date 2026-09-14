import {
	CombatSkillCatalogSchema,
	CombatSkillDefinitionSchema,
	type CombatSkillCatalog,
	type CombatSkillDefinition
} from '@summonlab/contracts';

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

export const BASIC_SWORD_STRIKE = deepFreeze(
	CombatSkillDefinitionSchema.parse({
		schemaVersion: 'combat-skill-v1',
		skillId: 'combat-skill-basic-sword-strike',
		displayName: 'Basic Sword Strike',
		kind: 'attack',
		deliveryTags: ['one-handed-blade'],
		damageTags: ['physical', 'cut'],
		masteryProgression: [
			{ minimumMastery: 0, accuracyBasisPoints: 6_750, reliabilityBasisPoints: 9_000 },
			{ minimumMastery: 50, accuracyBasisPoints: 8_000, reliabilityBasisPoints: 9_500 },
			{ minimumMastery: 100, accuracyBasisPoints: 9_250, reliabilityBasisPoints: 9_900 }
		],
		resistanceGrants: []
	})
);

export const BASIC_BOW_SHOT = deepFreeze(
	CombatSkillDefinitionSchema.parse({
		schemaVersion: 'combat-skill-v1',
		skillId: 'combat-skill-basic-bow-shot',
		displayName: 'Basic Bow Shot',
		kind: 'attack',
		deliveryTags: ['bow'],
		damageTags: ['physical', 'pierce'],
		masteryProgression: [
			{ minimumMastery: 0, accuracyBasisPoints: 6_750, reliabilityBasisPoints: 9_000 },
			{ minimumMastery: 50, accuracyBasisPoints: 8_000, reliabilityBasisPoints: 9_500 },
			{ minimumMastery: 100, accuracyBasisPoints: 9_250, reliabilityBasisPoints: 9_900 }
		],
		resistanceGrants: []
	})
);

export const COMBAT_SKILL_CATALOG = deepFreeze(
	CombatSkillCatalogSchema.parse({
		schemaVersion: 'combat-skill-catalog-v1',
		contentVersion: 'combat-skills-v1',
		contentHash: '2e0767343ddb1d80969612c7c8485cda6345a086f3dfb1b9cf474fce450e62d5',
		skills: [BASIC_SWORD_STRIKE, BASIC_BOW_SHOT]
	})
);

export const COMBAT_SKILLS = COMBAT_SKILL_CATALOG.skills;

export const COMBAT_SKILLS_BY_ID = Object.freeze(
	Object.fromEntries(COMBAT_SKILLS.map((skill) => [skill.skillId, skill])) as Readonly<
		Record<string, Readonly<CombatSkillDefinition>>
	>
);

/** Readiness-v1 arbitration policy sidecar; kept outside the frozen v1 skill catalog. */
export const COMBAT_SKILL_CONFLICT_POLICIES_V1 = deepFreeze({
	[BASIC_SWORD_STRIKE.skillId]: {
		invalidTarget: 'cancel',
		occupiedDestination: 'cancel',
		cancellationRefund: { mana: 'none', readiness: 'none' }
	},
	[BASIC_BOW_SHOT.skillId]: {
		invalidTarget: 'selected-fallback',
		occupiedDestination: 'cancel',
		cancellationRefund: { mana: 'full', readiness: 'full' }
	}
} as const);

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	const object = value as Record<string, unknown>;
	return `{${Object.keys(object)
		.sort((left, right) => left.localeCompare(right))
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
		.join(',')}}`;
}

export async function calculateCombatSkillContentHash(
	catalog: CombatSkillCatalog
): Promise<string> {
	const payload: Partial<CombatSkillCatalog> = { ...catalog };
	delete payload.contentHash;
	const digest = await globalThis.crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(canonicalJson(payload))
	);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyCombatSkillCatalog(
	catalogInput: CombatSkillCatalog
): Promise<CombatSkillCatalog> {
	const catalog = CombatSkillCatalogSchema.parse(catalogInput);
	const calculated = await calculateCombatSkillContentHash(catalog);
	if (calculated !== catalog.contentHash) {
		throw new Error(
			`Combat skill content hash drifted: expected ${catalog.contentHash}, calculated ${calculated}`
		);
	}
	return catalog;
}

let verifiedCatalog: Promise<CombatSkillCatalog> | undefined;

export function loadCombatSkillCatalog(): Promise<CombatSkillCatalog> {
	verifiedCatalog ??= verifyCombatSkillCatalog(COMBAT_SKILL_CATALOG);
	return verifiedCatalog;
}
