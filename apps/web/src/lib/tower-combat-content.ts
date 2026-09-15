import { TOWER_FLOOR_01_PACKAGE } from '@summonlab/content';
import {
	SummonableHeroRuntimeManifestSchema,
	type CombatRasterBinding
} from '@summonlab/contracts';

import summonableHeroRuntimeManifestSource from '../../static/runtime/summonable-heroes-v1/manifest.json';
import {
	createCombatContentCatalog,
	type CombatContentCatalog
} from './components/tower/combat/automated/combat-content-catalog';
import { combatValueHash } from './components/tower/combat/automated/combat-hash';

const runtimeManifest = SummonableHeroRuntimeManifestSchema.parse(
	summonableHeroRuntimeManifestSource
);
const runtimePortraits = runtimeManifest.entries.flatMap((entry) => entry.bundle.assets);

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

export function runtimeCombatBindingFor(
	manifestHash: string,
	artKey: string | null
): CombatRasterBinding | null {
	const asset = runtimePortraits.find(
		(candidate) =>
			candidate.usage === 'combat-chibi' &&
			candidate.sourceStatus === 'approved' &&
			(candidate.manifestHashes.includes(manifestHash) ||
				(artKey !== null && candidate.sourceAssetKey === artKey))
	);
	return asset
		? {
				assetKey: asset.sourceAssetKey,
				source: asset.publicPath,
				contentHash: asset.contentHash,
				approvalStatus: 'approved',
				approvalId: `${asset.sourceAssetKey}-runtime-approved`
			}
		: null;
}

function trustedRaster(binding: CombatRasterBinding) {
	return {
		assetKey: binding.assetKey,
		source: binding.source,
		contentHash: binding.contentHash,
		approvalId: binding.approvalId
	};
}

export const TOWER_COMBAT_CONTENT_CATALOG: CombatContentCatalog = createCombatContentCatalog({
	heroes: runtimeManifest.entries.flatMap((entry) => {
		const combatAssetBinding = runtimeCombatBindingFor(entry.manifestHash, null);
		return combatAssetBinding
			? [
					{
						heroId: entry.characterId,
						characterManifestHash: entry.manifestHash,
						combatAssetBinding: trustedRaster(combatAssetBinding),
						motionPackBinding: null
					}
				]
			: [];
	}),
	enemies: TOWER_FLOOR_01_PACKAGE.monsterDuties.map((duty) => ({
		definitionRef: {
			enemyDefinitionId: duty.dutySlotId,
			definitionVersion: `${duty.dutySlotId}-v1`,
			contentHash: combatValueHash(duty)
		},
		combatAssetBinding: trustedRaster(FLOOR_ONE_GOBLIN_COMBAT_BINDING),
		motionPackBinding: null
	})),
	battlefields: [
		{
			battlefieldId: RUINED_THRESHOLD_COMBAT_BINDING.battlefieldId,
			version: RUINED_THRESHOLD_COMBAT_BINDING.version,
			contentHash: RUINED_THRESHOLD_COMBAT_BINDING.contentHash,
			environmentAssetBinding: trustedRaster(
				RUINED_THRESHOLD_COMBAT_BINDING.environmentAssetBinding
			),
			occluderAssetBindings:
				RUINED_THRESHOLD_COMBAT_BINDING.occluderAssetBindings.map(trustedRaster)
		}
	]
});
