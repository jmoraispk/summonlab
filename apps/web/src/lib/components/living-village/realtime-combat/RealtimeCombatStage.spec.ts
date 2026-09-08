import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const stageSource = readFileSync(
	resolve(import.meta.dirname, 'RealtimeCombatStage.svelte'),
	'utf8'
);

describe('RealtimeCombatStage session boundary', () => {
	it('owns a request-bound live or replay session instead of a local fixture simulation', () => {
		expect(stageSource).toContain('request: ExplorationEncounterRequest;');
		expect(stageSource).toContain(
			'enterCombatSession(requestForSession, dependencies, registryForSession)'
		);
		expect(stageSource).toContain(
			'createReplayCombatSession(requestForSession, replayForSession, dependencies)'
		);
		expect(stageSource).not.toContain('createRealtimeCombat(RAT_ENCOUNTER_REQUEST)');
		expect(stageSource).not.toContain('restartKey');
	});

	it('loads and unloads the request-declared raster and motion sources', () => {
		expect(stageSource).toContain(
			'const rasterBindings = combatRasterBindings(requestForSession);'
		);
		expect(stageSource).toContain(
			'const motionBindings = combatMotionBindings(requestForSession);'
		);
		expect(stageSource).toContain('stageAssetOwner({');
		expect(stageSource).toContain('}).claim(sources);');
	});

	it('advances only the session fixed step and keeps replay completion separate', () => {
		expect(stageSource).toContain(
			'advanceStageSession(activeSession, paused, accumulator, frameSeconds)'
		);
		expect(stageSource).toContain('activeSession.markAssetsReady()');
		expect(stageSource).toContain('bindStageSessionNotifications');
		expect(stageSource).toContain('activeSession.markUnavailable(unavailable)');
	});
});
