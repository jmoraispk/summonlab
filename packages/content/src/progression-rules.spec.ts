import { describe, expect, it } from 'vitest';

import {
	PROGRESSION_RULES_V1,
	PROGRESSION_RULES_V1_BINDING,
	calculateProgressionRulesContentHash,
	loadProgressionRulesV1
} from './progression-rules.js';

describe('progression-rules-v1 content', () => {
	it('publishes the accepted immutable awakening tables', () => {
		expect(PROGRESSION_RULES_V1).toMatchObject({
			rulesVersion: 'progression-rules-v1',
			levelCap: 999,
			experiencePerLevel: 10,
			powerPerAttributeMilli: [
				1_000, 1_200, 1_400, 1_800, 2_200, 2_600, 3_200, 3_800, 4_400, 5_000
			],
			healthPerVitality: [5, 6, 7, 9, 11, 13, 16, 19, 22, 25]
		});
		expect(Object.isFrozen(PROGRESSION_RULES_V1)).toBe(true);
		expect(Object.isFrozen(PROGRESSION_RULES_V1.powerPerAttributeMilli)).toBe(true);
		expect(Object.isFrozen(PROGRESSION_RULES_V1.crafting.qualityBps)).toBe(true);
	});

	it('binds canonical rules bytes to one replayable content hash', async () => {
		expect(await calculateProgressionRulesContentHash(PROGRESSION_RULES_V1)).toBe(
			PROGRESSION_RULES_V1_BINDING.contentHash
		);
		expect(await loadProgressionRulesV1()).toBe(PROGRESSION_RULES_V1);
	});

	it('detects a data-only tuning change', async () => {
		const changed = {
			...PROGRESSION_RULES_V1,
			powerPerAttributeMilli: [...PROGRESSION_RULES_V1.powerPerAttributeMilli.slice(0, 9), 4_800]
		};
		expect(await calculateProgressionRulesContentHash(changed)).not.toBe(
			PROGRESSION_RULES_V1_BINDING.contentHash
		);
	});
});
