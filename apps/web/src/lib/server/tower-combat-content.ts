import { TOWER_FLOOR_01_PACKAGE } from '@summonlab/content';
import {
	SummonableHeroRuntimeManifestSchema,
	type CombatRasterBinding
} from '@summonlab/contracts';

import summonableHeroRuntimeManifestSource from '../../../static/runtime/summonable-heroes-v1/manifest.json';
import {
	createCombatContentCatalog,
	type CombatContentCatalog
} from '../components/tower/combat/automated/combat-content-catalog';
import { combatValueHash } from '../components/tower/combat/automated/combat-hash';
import {
	FLOOR_ONE_GOBLIN_COMBAT_BINDING,
	RUINED_THRESHOLD_COMBAT_BINDING
} from '../tower-combat-content';

const runtimeManifest = SummonableHeroRuntimeManifestSchema.parse(
	summonableHeroRuntimeManifestSource
);
const runtimePortraits = runtimeManifest.entries.flatMap((entry) => entry.bundle.assets);

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
