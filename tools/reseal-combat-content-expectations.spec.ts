import { describe, expect, it } from 'vitest';

import { resealCombatContentSources } from './reseal-combat-content-expectations.js';

const OLD_HASH = 'a'.repeat(64);
const COMBAT_HASH = 'b'.repeat(64);
const READINESS_HASH = 'c'.repeat(64);

describe('combat content expectation resealing', () => {
	it('reseals both named aggregates and their contract constants', () => {
		const result = resealCombatContentSources(
			`export const COMBAT_CONTENT_BINDING = { contentHash: '${OLD_HASH}' };\n`,
			`export const AGENT_READINESS_CONTENT_BINDING_V2 = { contentHash: '${OLD_HASH}' };\n`,
			[
				`const LEGACY_AND_READINESS_V1_CONTENT_HASH = '${OLD_HASH}';`,
				`const READINESS_V2_CONTENT_HASH = '${OLD_HASH}';`
			].join('\n'),
			COMBAT_HASH,
			READINESS_HASH
		);

		expect(result.combatBindingSource).toContain(COMBAT_HASH);
		expect(result.readinessBindingSource).toContain(READINESS_HASH);
		expect(result.readinessContractSource).toContain(
			`LEGACY_AND_READINESS_V1_CONTENT_HASH = '${COMBAT_HASH}'`
		);
		expect(result.readinessContractSource).toContain(
			`READINESS_V2_CONTENT_HASH = '${READINESS_HASH}'`
		);
	});

	it('rejects an ambiguous or missing named binding', () => {
		expect(() =>
			resealCombatContentSources(
				`export const COMBAT_CONTENT_BINDING = { contentHash: '${OLD_HASH}', duplicate: { contentHash: '${OLD_HASH}' } };\n`,
				`export const AGENT_READINESS_CONTENT_BINDING_V2 = { contentHash: '${OLD_HASH}' };\n`,
				`const LEGACY_AND_READINESS_V1_CONTENT_HASH = '${OLD_HASH}';\nconst READINESS_V2_CONTENT_HASH = '${OLD_HASH}';`,
				COMBAT_HASH,
				READINESS_HASH
			)
		).toThrow(/exactly one COMBAT_CONTENT_BINDING/u);
	});
});
