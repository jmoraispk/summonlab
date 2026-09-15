import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('canonical Tower encounter', () => {
	const root = fileURLToPath(new URL('.', import.meta.url));
	const source = readFileSync(`${root}/TowerEncounter.svelte`, 'utf8');

	it('mounts RealtimeCombatStage with the persisted encounter request', () => {
		expect(source).toContain(
			"import RealtimeCombatStage from './automated/RealtimeCombatStage.svelte'"
		);
		expect(source).toContain('<RealtimeCombatStage');
		expect(source).toContain('request={encounterRequest}');
		expect(source).toContain('TOWER_COMBAT_CONTENT_CATALOG');
	});

	it('submits only the completed deterministic receipt', () => {
		expect(source).toContain('onComplete(receipt)');
		expect(source).not.toContain('onResolve(mode)');
		expect(source).not.toContain('Resolve turn');
	});
});
