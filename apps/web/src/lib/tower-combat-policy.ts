import { combatValueHash } from './components/tower/combat/automated/combat-hash';

const CLAIM_VALUES = {
	xpPerDefeatedEnemy: 4,
	practicePerAction: 1,
	materialByEnemyDefinitionId: {
		'goblin-chain-watch': { materialDefinitionId: 'goblin-scrap', quantity: 1 },
		'goblin-ember-hauler': { materialDefinitionId: 'ember-shard', quantity: 1 },
		'rat-brute': { materialDefinitionId: 'plague-rat-tail', quantity: 1 },
		'plague-rat': { materialDefinitionId: 'plague-rat-tail', quantity: 1 }
	}
} as const;

export const TOWER_COMBAT_RULESET_BINDING = Object.freeze({
	contentId: 'tower-automated-combat',
	version: 'tower-automated-combat-v1',
	contentHash: combatValueHash({ ruleset: 'tower-automated-combat-v1' })
});

const ACTION_IDS = [
	'tower-brawler-strike-v1',
	'tower-guardian-strike-v1',
	'tower-archer-shot-v1',
	'tower-goblin-strike-v1',
	// Historical fixture actions remain recognized only so the isolated rat study can replay.
	'saffron-strike-v1',
	'saffron-arc-v1',
	'guardian-strike-v1',
	'moss-arrow-v1',
	'rat-brute-strike-v1',
	'plague-rat-bite-v1'
] as const;

export const TOWER_COMBAT_ACTION_BINDINGS = Object.freeze(
	ACTION_IDS.map((contentId) =>
		Object.freeze({
			kind: 'action' as const,
			contentId,
			version: `${contentId}-content-v1`,
			contentHash: combatValueHash({ action: contentId })
		})
	)
);

export const TOWER_COMBAT_CLAIM_POLICY = Object.freeze({
	contentId: 'tower-combat-claims',
	version: 'tower-combat-claims-v1',
	contentHash: combatValueHash(CLAIM_VALUES),
	...CLAIM_VALUES
});

export const TOWER_COMBAT_CLAIM_POLICY_BINDING = Object.freeze({
	contentId: TOWER_COMBAT_CLAIM_POLICY.contentId,
	version: TOWER_COMBAT_CLAIM_POLICY.version,
	contentHash: TOWER_COMBAT_CLAIM_POLICY.contentHash
});

export const TOWER_COMBAT_ACTION_BY_ROLE = Object.freeze({
	brawler: 'tower-brawler-strike-v1',
	guardian: 'tower-guardian-strike-v1',
	archer: 'tower-archer-shot-v1',
	goblin: 'tower-goblin-strike-v1'
});
