import { CombatSkillDefinitionSchema, type CombatSkillDefinition } from '@summonlab/contracts';

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

export const COMBAT_SKILLS = Object.freeze([BASIC_SWORD_STRIKE, BASIC_BOW_SHOT]);

export const COMBAT_SKILLS_BY_ID = Object.freeze(
	Object.fromEntries(COMBAT_SKILLS.map((skill) => [skill.skillId, skill])) as Readonly<
		Record<string, Readonly<CombatSkillDefinition>>
	>
);
