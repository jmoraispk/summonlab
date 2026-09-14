import { ProgressionRulesBindingSchema, type ProgressionRulesBinding } from '@summonlab/contracts';

export type CraftQuality = 'standard' | 'fine' | 'masterwork';
export type ProgressionEquipmentClass =
	| 'dagger'
	| 'sword'
	| 'spear'
	| 'bow'
	| 'axe'
	| 'mace'
	| 'shield'
	| 'staff'
	| 'light-armour'
	| 'robes'
	| 'heavy-armour';

export type ProgressionRulesV1 = Readonly<{
	rulesVersion: 'progression-rules-v1';
	levelCap: 999;
	experiencePerLevel: number;
	powerPerAttributeMilli: readonly number[];
	healthPerVitality: readonly number[];
	crafting: Readonly<{
		equipmentClassDifficulty: Readonly<Record<ProgressionEquipmentClass, number>>;
		difficultyExperience: readonly number[];
		ingredientRarityBps: readonly number[];
		qualityBps: Readonly<Record<CraftQuality, number>>;
		firstSuccessBps: number;
		repetitionBps: readonly number[];
		minimumExperience: number;
	}>;
	combat: Readonly<{
		difficultyExperience: readonly number[];
		objectiveBonus: readonly number[];
		firstClearBps: number;
		repetitionBps: readonly number[];
		minimumExperience: number;
	}>;
}>;

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

export const PROGRESSION_RULES_V1 = deepFreeze({
	rulesVersion: 'progression-rules-v1',
	levelCap: 999,
	experiencePerLevel: 10,
	powerPerAttributeMilli: [1_000, 1_200, 1_400, 1_800, 2_200, 2_600, 3_200, 3_800, 4_400, 5_000],
	healthPerVitality: [5, 6, 7, 9, 11, 13, 16, 19, 22, 25],
	crafting: {
		equipmentClassDifficulty: {
			dagger: 1,
			sword: 2,
			spear: 3,
			bow: 3,
			axe: 3,
			mace: 3,
			shield: 3,
			staff: 4,
			'light-armour': 4,
			robes: 4,
			'heavy-armour': 5
		},
		difficultyExperience: [4, 6, 9, 13, 18, 25, 35],
		ingredientRarityBps: [10_000, 11_000, 12_000, 13_000, 14_000, 15_000, 16_000],
		qualityBps: { standard: 10_000, fine: 12_500, masterwork: 15_000 },
		firstSuccessBps: 15_000,
		repetitionBps: [10_000, 8_000, 6_500, 5_000, 4_000, 3_000, 2_500],
		minimumExperience: 1
	},
	combat: {
		difficultyExperience: [4, 6, 9, 13, 18, 25, 35],
		objectiveBonus: [1, 2, 3, 5, 7, 10, 14],
		firstClearBps: 15_000,
		repetitionBps: [10_000, 8_000, 6_500, 5_000, 4_000, 3_000, 2_500],
		minimumExperience: 1
	}
} as const satisfies ProgressionRulesV1);

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	const object = value as Record<string, unknown>;
	return `{${Object.keys(object)
		.sort((left, right) => left.localeCompare(right))
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
		.join(',')}}`;
}

export async function calculateProgressionRulesContentHash(
	rules: ProgressionRulesV1
): Promise<string> {
	const digest = await globalThis.crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(canonicalJson(rules))
	);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const PROGRESSION_RULES_V1_BINDING: ProgressionRulesBinding = Object.freeze(
	ProgressionRulesBindingSchema.parse({
		rulesVersion: 'progression-rules-v1',
		contentHash: '06fc61271c9c3254836c4f50f845624bea08731952957d0c1d6faf295e8744ce'
	})
);

let verifiedRules: Promise<typeof PROGRESSION_RULES_V1> | undefined;

export function loadProgressionRulesV1(): Promise<typeof PROGRESSION_RULES_V1> {
	verifiedRules ??= (async () => {
		const calculated = await calculateProgressionRulesContentHash(PROGRESSION_RULES_V1);
		if (calculated !== PROGRESSION_RULES_V1_BINDING.contentHash) {
			throw new Error(
				`Progression rules content hash drifted: expected ${PROGRESSION_RULES_V1_BINDING.contentHash}, calculated ${calculated}`
			);
		}
		return PROGRESSION_RULES_V1;
	})();
	return verifiedRules;
}
