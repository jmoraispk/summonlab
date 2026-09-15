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
		expect(stageSource).toContain('fixtureRequestHash?: string;');
		expect(stageSource).toContain('claimPolicyBinding: CombatClaimPolicyBinding;');
		expect(stageSource).toContain(
			'stageSessionDependencies(\n\t\tclaimPolicyForSession,\n\t\tclaimPolicyBindingForSession,\n\t\tfixtureRequestHashForSession\n\t)'
		);
		expect(stageSource).toContain(
			'enterCombatSession(requestForSession, dependencies, registryForSession)'
		);
		expect(stageSource).toContain(
			'createReplayCombatSession(requestForSession, replayForSession, dependencies)'
		);
		expect(stageSource).not.toContain('createRealtimeCombat(RAT_ENCOUNTER_REQUEST)');
		expect(stageSource).not.toContain('restartKey');
	});

	it('verifies request-declared raster, motion JSON, and atlas bytes before Pixi decodes them', () => {
		expect(stageSource).toContain(
			'const rasterBindings = combatRasterBindings(presentationRequest);'
		);
		expect(stageSource).toContain(
			'const motionBindings = combatMotionBindings(presentationRequest);'
		);
		expect(stageSource).toContain('routeStageEntry(entry, {');
		expect(stageSource).toContain('sources: requestAssetBindings(presentationRequest),');
		expect(stageSource).toContain(
			'stageAssetOwner(createVerifiedStageAssetLoader()).claim(sources);'
		);
		expect(stageSource).toContain("parser: 'texture'");
		expect(stageSource).toContain('new Spritesheet({');
		expect(stageSource).not.toContain('Assets.load(source)');
	});

	it('uses a whole-sprite fallback when an approved actor has no motion pack', () => {
		expect(stageSource).toContain('const motionBinding = entry.presentation.motionPackBinding;');
		expect(stageSource).toContain('new Sprite({');
		expect(stageSource).toContain('rasterTexture.width / rasterTexture.height');
		expect(stageSource).toContain('data-static-actor-count');
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
