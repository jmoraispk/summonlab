import type {
	CombatMotionPackBinding,
	CombatRasterBinding,
	ExplorationEncounterRequest
} from '@summonlab/contracts';

import {
	createCombatContentCatalog,
	type CombatContentCatalog
} from './components/tower/combat/automated/combat-content-catalog';
import { combatValueHash } from './components/tower/combat/automated/combat-hash';

export const RUINED_THRESHOLD_COMBAT_BINDING = Object.freeze({
	battlefieldId: 'ruined-threshold',
	version: 'ruined-threshold-v1',
	contentHash: combatValueHash({ battlefield: 'ruined-threshold-v1' }),
	environmentAssetBinding: {
		assetKey: 'ruined-threshold-environment',
		source: '/runtime/combat/realtime-study-v1/ruined-threshold-environment-v1.png',
		contentHash: 'cb6db22b2c162f090cfdc3c4ca7be9eb44a7bcc635437ec42679a33e66640063',
		approvalStatus: 'approved' as const,
		approvalId: 'ruined-threshold-automated-combat-approved'
	},
	occluderAssetBindings: [
		{
			assetKey: 'well-foreground-occluder',
			source: '/runtime/combat/realtime-study-v1/environment-occluders-v1/well-foreground-v1.png',
			contentHash: '3daa98cddde1994dc3b76bbdc7fa18e6b495a2d80eeccbad62f230b4fad0e129',
			approvalStatus: 'approved' as const,
			approvalId: 'ruined-threshold-well-occluder-approved'
		}
	]
});

export const FLOOR_ONE_GOBLIN_COMBAT_BINDING = Object.freeze({
	assetKey: 'floor-one-sprout-goblin',
	source: '/runtime/combat/observatory-art-pilot-v1/sprout-goblin-screen-v1.png',
	contentHash: '350507c5b612938c2ab7e473e389e0b8a816ef68c66d3c7a4edf9a3a9a5dcb53',
	approvalStatus: 'approved' as const,
	approvalId: 'floor-one-goblin-automated-combat-approved'
});

function trustedRaster(binding: CombatRasterBinding) {
	return {
		assetKey: binding.assetKey,
		source: binding.source,
		contentHash: binding.contentHash,
		approvalId: binding.approvalId
	};
}

function trustedMotionPack(binding: CombatMotionPackBinding | null) {
	return binding
		? {
				motionPackId: binding.motionPackId,
				source: binding.source,
				atlasImageSource: binding.atlasImageSource,
				version: binding.version,
				contentHash: binding.contentHash,
				atlasImageHash: binding.atlasImageHash,
				approvalId: binding.approvalId
			}
		: null;
}

/**
 * Builds the browser's read-only presentation catalog from the server-issued encounter request.
 * The server independently validates the completed receipt against its private canonical catalog.
 */
export function combatContentCatalogForEncounterRequest(
	request: ExplorationEncounterRequest
): CombatContentCatalog {
	return createCombatContentCatalog({
		heroes: request.party.map((hero) => ({
			heroId: hero.heroRef.heroId,
			characterManifestHash: hero.heroRef.characterManifestHash,
			combatAssetBinding: trustedRaster(hero.presentation.combatAssetBinding),
			motionPackBinding: trustedMotionPack(hero.presentation.motionPackBinding)
		})),
		enemies: request.enemies.map((enemy) => ({
			definitionRef: enemy.definitionRef,
			combatAssetBinding: trustedRaster(enemy.presentation.combatAssetBinding),
			motionPackBinding: trustedMotionPack(enemy.presentation.motionPackBinding)
		})),
		battlefields: [
			{
				battlefieldId: request.battlefieldBinding.battlefieldId,
				version: request.battlefieldBinding.version,
				contentHash: request.battlefieldBinding.contentHash,
				environmentAssetBinding: trustedRaster(request.battlefieldBinding.environmentAssetBinding),
				occluderAssetBindings: request.battlefieldBinding.occluderAssetBindings.map(trustedRaster)
			}
		]
	});
}
