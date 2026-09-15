import { TOWER_FLOOR_01_PACKAGE } from '@summonlab/content';
import {
	ExplorationEncounterRequestSchema,
	type ExplorationAttemptState,
	type ExplorationCombatHero,
	type ExplorationEncounterRequest
} from '@summonlab/contracts';

import {
	TOWER_COMBAT_ACTION_BINDINGS,
	TOWER_COMBAT_ACTION_BY_ROLE,
	TOWER_COMBAT_CLAIM_POLICY_BINDING,
	TOWER_COMBAT_RULESET_BINDING
} from '../tower-combat-policy';
import {
	combatDeterministicId,
	combatValueHash
} from '../components/tower/combat/automated/combat-hash';
import { runtimeCombatBindingFor } from './runtime-portraits';

export interface TowerEncounterHeroSource {
	readonly heroId: string;
	readonly manifestHash: string;
	readonly artKey: string | null;
	readonly displayName: string;
	readonly health: number;
	readonly maximumHealth: number;
	readonly level: number;
	readonly equipment: unknown;
}

export interface BuildTowerEncounterRequestInput {
	readonly attempt: ExplorationAttemptState;
	readonly heroes: readonly TowerEncounterHeroSource[];
	readonly dutySlotId: string;
	readonly observedGameTime: string;
}

const RUINED_THRESHOLD = {
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
} as const;

const FLOOR_ONE_GOBLIN = {
	assetKey: 'floor-one-sprout-goblin',
	source: '/runtime/combat/observatory-art-pilot-v1/sprout-goblin-screen-v1.png',
	contentHash: '350507c5b612938c2ab7e473e389e0b8a816ef68c66d3c7a4edf9a3a9a5dcb53',
	approvalStatus: 'approved' as const,
	approvalId: 'floor-one-goblin-automated-combat-approved'
} as const;

const HERO_ROLES = ['brawler', 'guardian', 'archer'] as const;
const HERO_DEPLOYMENTS = [
	{ x: 0.34, y: 0.82 },
	{ x: 0.5, y: 0.86 },
	{ x: 0.66, y: 0.82 }
] as const;
const ENEMY_DEPLOYMENTS = [
	{ x: 0.38, y: 0.24 },
	{ x: 0.62, y: 0.24 },
	{ x: 0.5, y: 0.17 }
] as const;

function actionBinding(contentId: string) {
	const binding = TOWER_COMBAT_ACTION_BINDINGS.find(
		(candidate) => candidate.contentId === contentId
	);
	if (!binding) throw new Error(`Tower combat action binding is missing: ${contentId}`);
	return binding;
}

function projectHero(
	source: TowerEncounterHeroSource,
	index: number,
	availabilityRevision: number
): ExplorationCombatHero {
	if (source.health <= 0 || source.health > source.maximumHealth) {
		throw new Error(`${source.displayName} is not combat-capable.`);
	}
	const combatAssetBinding = runtimeCombatBindingFor(source.manifestHash, source.artKey);
	if (!combatAssetBinding) {
		throw new Error(`${source.displayName} has no approved combat chibi.`);
	}
	const role = HERO_ROLES[index] ?? 'brawler';
	const actionId = TOWER_COMBAT_ACTION_BY_ROLE[role];
	const level = Math.max(1, source.level);
	return {
		heroRef: {
			heroId: source.heroId,
			characterManifestHash: source.manifestHash,
			lifeState: 'combat-capable',
			availabilityRevision,
			rulesetVersion: TOWER_COMBAT_RULESET_BINDING.version
		},
		displayName: source.displayName,
		resources: {
			health: source.health,
			maximumHealth: source.maximumHealth,
			mana: 0,
			maximumMana: 0
		},
		capability: {
			capabilitySnapshotHash: combatValueHash({
				heroId: source.heroId,
				level,
				role,
				actionId
			}),
			loadoutHash: combatValueHash(source.equipment),
			actionDefinitionRefs: [actionId],
			combatRole: role
		},
		combatProfile: {
			movementUnitsPerSecond: role === 'guardian' ? 0.063 : role === 'archer' ? 0.071 : 0.082,
			attackRange: role === 'archer' ? 0.25 : 0.08,
			attackPower: 10 + level * 2,
			armour: role === 'guardian' ? 4 + Math.floor(level / 2) : Math.floor(level / 3),
			attackIntervalTicks: role === 'guardian' ? 57 : role === 'archer' ? 65 : 47
		},
		deployment: HERO_DEPLOYMENTS[index] ?? { x: 0.5, y: 0.9 },
		presentation: {
			combatAssetBinding,
			motionPackBinding: null,
			visualTuning: {
				bodyOffsetY: 0,
				shadowRadiusX: 34,
				shadowRadiusY: 12,
				displaySize: 150
			}
		}
	};
}

export function buildTowerEncounterRequest(
	input: BuildTowerEncounterRequestInput
): ExplorationEncounterRequest {
	if (
		input.heroes.length !== input.attempt.partyHeroIds.length ||
		input.heroes.some((hero, index) => hero.heroId !== input.attempt.partyHeroIds[index])
	) {
		throw new Error('Tower encounter heroes must match the persisted exploration party exactly.');
	}
	const duty = TOWER_FLOOR_01_PACKAGE.monsterDuties.find(
		(candidate) => candidate.dutySlotId === input.dutySlotId
	);
	if (!duty) throw new Error(`Unknown Floor One encounter duty: ${input.dutySlotId}`);
	const enemyCount = duty.count.min;
	const enemyDefinitionHash = combatValueHash(duty);
	const heroActionIds = input.heroes.map(
		(_, index) => TOWER_COMBAT_ACTION_BY_ROLE[HERO_ROLES[index] ?? 'brawler']
	);
	const enemyActionId = TOWER_COMBAT_ACTION_BY_ROLE.goblin;
	const enemies = Array.from({ length: enemyCount }, (_, index) => ({
		enemyInstanceId: `${duty.dutySlotId}-${index + 1}`,
		displayName: `Floor One Goblin ${index + 1}`,
		definitionRef: {
			enemyDefinitionId: duty.dutySlotId,
			definitionVersion: `${duty.dutySlotId}-v1`,
			contentHash: enemyDefinitionHash
		},
		resources: {
			health: duty.dutySlotId === 'goblin-ember-hauler' ? 72 : 64,
			maximumHealth: duty.dutySlotId === 'goblin-ember-hauler' ? 72 : 64,
			mana: 0,
			maximumMana: 0
		},
		combatRole: 'swarm' as const,
		actionDefinitionRefs: [enemyActionId],
		combatProfile: {
			movementUnitsPerSecond: 0.09,
			attackRange: 0.065,
			attackPower: 8,
			armour: 0,
			attackIntervalTicks: 58 + index * 3
		},
		deployment: ENEMY_DEPLOYMENTS[index] ?? { x: 0.5, y: 0.16 },
		requiredForVictory: true,
		presentation: {
			combatAssetBinding: FLOOR_ONE_GOBLIN,
			motionPackBinding: null,
			visualTuning: {
				bodyOffsetY: 0,
				shadowRadiusX: 28,
				shadowRadiusY: 10,
				displaySize: 112
			}
		}
	}));
	const requestIdentity = {
		runId: input.attempt.runId,
		attemptId: input.attempt.attemptId,
		version: input.attempt.version,
		tileId: input.attempt.positionTileId,
		dutySlotId: duty.dutySlotId
	};
	const body = {
		schemaVersion: 'exploration-encounter-request-v1' as const,
		requestId: combatDeterministicId('tower-encounter-request', requestIdentity),
		idempotencyKey: `tower-encounter-${input.attempt.attemptId}`,
		runId: input.attempt.runId,
		correlationId: combatDeterministicId('tower-encounter-correlation', requestIdentity),
		encounterId: `floor-one-${duty.dutySlotId}`,
		explorationAttemptId: input.attempt.attemptId,
		observedGameTime: input.observedGameTime,
		expectedExplorationStateHash: combatValueHash(input.attempt),
		rulesetVersion: TOWER_COMBAT_RULESET_BINDING.version,
		contentBindings: [
			{ kind: 'ruleset' as const, ...TOWER_COMBAT_RULESET_BINDING },
			...[...new Set([...heroActionIds, enemyActionId])].map((actionId) => actionBinding(actionId)),
			{
				kind: 'enemy' as const,
				contentId: duty.dutySlotId,
				version: `${duty.dutySlotId}-v1`,
				contentHash: enemyDefinitionHash
			},
			{ kind: 'claim-policy' as const, ...TOWER_COMBAT_CLAIM_POLICY_BINDING },
			{
				kind: 'battlefield' as const,
				contentId: RUINED_THRESHOLD.battlefieldId,
				version: RUINED_THRESHOLD.version,
				contentHash: RUINED_THRESHOLD.contentHash
			}
		],
		seed: `tower:${input.attempt.runId}:${input.attempt.attemptId}:${duty.dutySlotId}`,
		entropyCursor: input.attempt.version,
		visualStatus: 'production' as const,
		party: input.heroes.map((hero, index) => projectHero(hero, index, input.attempt.version)),
		enemies,
		battlefieldBinding: {
			...RUINED_THRESHOLD,
			occluderAssetBindings: [...RUINED_THRESHOLD.occluderAssetBindings]
		},
		bounds: {
			maximumCombatants: input.heroes.length + enemies.length,
			maximumSimulationTicks: 3_600,
			maximumTraceEvents: 2_000
		}
	} satisfies Omit<ExplorationEncounterRequest, 'requestHash'>;

	return ExplorationEncounterRequestSchema.parse({
		...body,
		requestHash: combatValueHash(body)
	});
}
