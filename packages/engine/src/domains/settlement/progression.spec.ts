import { generateSummonableCharacterDraft, listSummonableHeroDrafts } from '@summonlab/characters';
import {
	AttributeGrowthReceiptSchema,
	AttributeModifierSchema,
	EngineCommandSchema,
	EngineGameStateV24Schema,
	EngineGameStateV25Schema,
	EngineGameStateV26Schema,
	EngineGameStateV27Schema,
	type ActionSource,
	type EngineCommand,
	type EngineGameStateV25,
	type EngineGameStateV26,
	type EngineGameStateV27
} from '@summonlab/contracts';
import { COMBAT_RULES_V1 } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { effectiveAttribute, intrinsicAttributes } from '../combat/capability.js';
import { IllegalActionError, StaleStateVersionError } from '../../errors.js';
import { deterministicUuid, sha256Hex } from '../../hash.js';
import { applyCommand } from '../../orchestration/apply-command.js';
import { createBootstrapEngine } from '../../orchestration/bootstrap.js';
import { legalActions } from '../../orchestration/legal-actions.js';
import { attributePointsForLevelTransition } from './routines.js';
import { createEquipmentItem } from './equipment.js';

function manualSource(): ActionSource {
	return {
		source: 'manual',
		timing: 'step',
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function systemSource(): ActionSource {
	return { ...manualSource(), source: 'system', timing: null };
}

function command(
	state: EngineGameStateV25 | EngineGameStateV26 | EngineGameStateV27,
	actorId: string,
	key: string,
	body: object,
	source: ActionSource = manualSource()
): EngineCommand {
	const commandId = deterministicUuid(`progression:${key}:${state.version}`);
	return EngineCommandSchema.parse({
		commandId,
		runId: state.runId,
		actorId,
		expectedVersion: state.version,
		correlationId: deterministicUuid(`progression:${key}:correlation:${state.version}`),
		source,
		...body
	});
}

async function capabilityState(key: string): Promise<{
	state: EngineGameStateV25;
	heroId: string;
}> {
	const legacyDraft = listSummonableHeroDrafts()[0];
	if (!legacyDraft) throw new Error('Expected an approved summonable draft');
	const draft = await generateSummonableCharacterDraft(legacyDraft.recipe, {
		capabilityEntropy: '6'.repeat(64)
	});
	const bootstrap = createBootstrapEngine({
		runId: deterministicUuid(`progression:${key}:run`),
		seed: `progression:${key}:seed`,
		draft,
		developmentEngineVersion: 25
	});
	if (bootstrap.snapshot.state.schemaVersion !== 25) {
		throw new Error('Expected engine-v25 capability state');
	}
	const heroId = draft.manifest.characterId;
	const hero = bootstrap.snapshot.state.heroes[heroId]!;
	return {
		heroId,
		state: EngineGameStateV25Schema.parse({
			...bootstrap.snapshot.state,
			heroes: {
				...bootstrap.snapshot.state.heroes,
				[heroId]: {
					...hero,
					location: 'training-ground',
					locationNodeId: 'training-ring',
					firstArrivalCompleted: true,
					destination: 'training-ground',
					health: 220,
					maxHealth: 220,
					mana: 140,
					maxMana: 140,
					capabilityProfile: {
						...hero.capabilityProfile,
						attributes: { strength: 20, vitality: 30, agility: 40, magic: 50 }
					}
				}
			}
		})
	};
}

async function readinessFixtureForEquipmentCommand(): Promise<{
	state: EngineGameStateV26;
	heroId: string;
	torso: ReturnType<typeof createEquipmentItem>;
}> {
	const legacyDraft = listSummonableHeroDrafts()[0];
	if (!legacyDraft) throw new Error('Expected an approved summonable draft');
	const draft = await generateSummonableCharacterDraft(legacyDraft.recipe, {
		capabilityEntropy: '5'.repeat(64)
	});
	const initial = createBootstrapEngine({
		runId: deterministicUuid('v26-equipment-command:run'),
		seed: 'v26-equipment-command:seed',
		draft,
		combatMode: 'agent-readiness-v1',
		developmentEngineVersion: 26
	}).snapshot.state;
	if (initial.schemaVersion !== 26) throw new Error('Expected engine-v26 state');
	const heroId = draft.manifest.characterId;
	const torso = createEquipmentItem({
		itemId: deterministicUuid('v26-equipment-command:torso'),
		definitionId: 'equipment-iron-heavy-armour-torso',
		ownerId: heroId,
		equippedById: null,
		craftsmanship: { label: 'standard', bonus: 0 },
		origin: {
			kind: 'dropped',
			missionId: 'tower-floor-01',
			rewardId: 'v26-equipment-command-torso',
			sourceId: 'v26-equipment-command'
		}
	});
	return {
		heroId,
		torso,
		state: EngineGameStateV26Schema.parse({
			...initial,
			items: { ...initial.items, [torso.itemId]: torso },
			heroes: {
				...initial.heroes,
				[heroId]: {
					...initial.heroes[heroId]!,
					location: 'training-ground',
					locationNodeId: 'training-ring',
					firstArrivalCompleted: true,
					destination: 'training-ground'
				}
			}
		})
	};
}

function withProgression(
	state: EngineGameStateV25,
	heroId: string,
	progression: Partial<EngineGameStateV25['heroes'][string]['progression']>
): EngineGameStateV25 {
	const hero = state.heroes[heroId]!;
	return EngineGameStateV25Schema.parse({
		...state,
		heroes: {
			...state.heroes,
			[heroId]: {
				...hero,
				progression: { ...hero.progression, ...progression }
			}
		}
	});
}

describe('engine-v25 intrinsic attribute progression', () => {
	it('bootstraps level one with no points or receipts while v24 stays unchanged', async () => {
		const { state, heroId } = await capabilityState('bootstrap');
		expect(state.heroes[heroId]!.progression).toMatchObject({
			level: 1,
			unspentAttributePoints: 0,
			attributeGrowthReceipts: []
		});
		expect(
			legalActions(state, heroId).some((action) => action.actionId.startsWith('hero.allocate.'))
		).toBe(false);

		const legacy = createBootstrapEngine({
			runId: deterministicUuid('progression:v24:run'),
			seed: 'progression:v24:seed',
			heroId: deterministicUuid('progression:v24:hero'),
			manifestHash: sha256Hex('progression:v24:manifest'),
			developmentEquipmentScenario: { enabled: true }
		});
		const v24 = EngineGameStateV24Schema.parse(legacy.snapshot.state);
		const v24HeroId = Object.keys(v24.heroes)[0]!;
		expect(v24.heroes[v24HeroId]!.progression).not.toHaveProperty('unspentAttributePoints');
		expect(
			legalActions(v24, v24HeroId).some((action) => action.actionId.startsWith('hero.allocate.'))
		).toBe(false);
	});

	it('grants exactly one point per gained level and supports multi-level transitions', async () => {
		expect(attributePointsForLevelTransition(7, 10, 13)).toBe(10);
		expect(attributePointsForLevelTransition(7, 13, 13)).toBe(7);

		const fixture = await capabilityState('level-up');
		const ready = withProgression(fixture.state, fixture.heroId, {
			experience: 9,
			level: 1,
			unspentAttributePoints: 0,
			attributeGrowthReceipts: []
		});
		const started = applyCommand(
			ready,
			command(ready, fixture.heroId, 'train', {
				commandType: 'hero.start.activity',
				activity: 'train'
			})
		);
		if (started.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		const completed = applyCommand(
			started.state,
			command(
				started.state,
				started.state.master.masterId,
				'complete-train',
				{
					commandType: 'simulation.advance',
					targetGameTime: started.scheduled[0]!.dueGameTime
				},
				systemSource()
			)
		);
		if (completed.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		expect(completed.state.heroes[fixture.heroId]!.progression).toMatchObject({
			level: 2,
			unspentAttributePoints: 1,
			attributeGrowthReceipts: []
		});
		expect(legalActions(completed.state, fixture.heroId).map((action) => action.actionId)).toEqual(
			expect.arrayContaining([
				'hero.allocate.attribute.strength',
				'hero.allocate.attribute.vitality',
				'hero.allocate.attribute.agility',
				'hero.allocate.attribute.magic'
			])
		);
	});

	it('allocates one intrinsic point with an exact typed append-only receipt', async () => {
		const fixture = await capabilityState('allocation');
		const ready = withProgression(fixture.state, fixture.heroId, {
			level: 3,
			experience: 20,
			unspentAttributePoints: 2,
			attributeGrowthReceipts: []
		});
		const mightModifier = AttributeModifierSchema.parse({
			modifierId: deterministicUuid('progression:temporary-strength'),
			attribute: 'strength',
			scope: 'physical-damage',
			stackingRule: 'additive-flat',
			value: 50,
			cap: 50,
			duration: { kind: 'action' },
			source: {
				receiptId: deterministicUuid('progression:temporary-strength:source'),
				sourceKind: 'status',
				sourceId: 'status:test-strength'
			},
			rulesVersion: 'combat-rules-v1'
		});
		expect(effectiveAttribute(20, [mightModifier], 'physical-damage', COMBAT_RULES_V1)).toBe(70);

		const allocateMight = command(ready, fixture.heroId, 'allocate-strength', {
			commandType: 'hero.allocate.attribute',
			attribute: 'strength'
		});
		const first = applyCommand(ready, allocateMight);
		if (first.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		const firstReceipt = AttributeGrowthReceiptSchema.parse(
			first.events[0]!.payload.attributeGrowthReceipt
		);
		expect(firstReceipt).toStrictEqual({
			receiptId: deterministicUuid(`${first.events[0]!.eventId}:attribute-growth`),
			heroId: fixture.heroId,
			attribute: 'strength',
			beforeIntrinsicValue: 20,
			afterIntrinsicValue: 21,
			spentPoints: 1,
			sourceLevel: 3,
			rulesVersion: 'combat-rules-v1',
			commandId: allocateMight.commandId,
			gameTime: ready.simulatedAt
		});
		expect(first.state.heroes[fixture.heroId]!.progression).toMatchObject({
			unspentAttributePoints: 1,
			attributeGrowthReceipts: [firstReceipt]
		});
		expect(first.state.heroes[fixture.heroId]!.capabilityProfile.attributes.strength).toBe(20);

		const allocateVitality = command(first.state, fixture.heroId, 'allocate-vitality', {
			commandType: 'hero.allocate.attribute',
			attribute: 'vitality'
		});
		const second = applyCommand(first.state, allocateVitality);
		if (second.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		expect(second.state.heroes[fixture.heroId]!.progression.attributeGrowthReceipts).toEqual([
			firstReceipt,
			expect.objectContaining({
				attribute: 'vitality',
				beforeIntrinsicValue: 30,
				afterIntrinsicValue: 31
			})
		]);
		expect(second.state.heroes[fixture.heroId]).toMatchObject({
			health: 220,
			maxHealth: 224,
			mana: 140,
			maxMana: 140
		});
	});

	it('feeds an emitted allocation receipt into canonical intrinsic combat attributes', async () => {
		const fixture = await capabilityState('canonical-intrinsic');
		const ready = withProgression(fixture.state, fixture.heroId, {
			level: 2,
			experience: 10,
			unspentAttributePoints: 1,
			attributeGrowthReceipts: []
		});
		const allocated = applyCommand(
			ready,
			command(ready, fixture.heroId, 'canonical-strength', {
				commandType: 'hero.allocate.attribute',
				attribute: 'strength'
			})
		);
		if (allocated.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		const hero = allocated.state.heroes[fixture.heroId]!;

		expect(
			intrinsicAttributes(
				hero.capabilityProfile,
				hero.progression.attributeGrowthReceipts,
				COMBAT_RULES_V1
			)
		).toStrictEqual({ strength: 21, vitality: 30, agility: 40, magic: 50 });
	});

	it('rejects stale, insufficient, terminal, capped, and invalid allocations', async () => {
		const fixture = await capabilityState('rejections');
		const stale = {
			...command(fixture.state, fixture.heroId, 'stale', {
				commandType: 'hero.allocate.attribute',
				attribute: 'strength'
			}),
			expectedVersion: fixture.state.version + 1
		};
		expect(() => applyCommand(fixture.state, stale)).toThrow(StaleStateVersionError);
		expect(() =>
			applyCommand(
				fixture.state,
				command(fixture.state, fixture.heroId, 'insufficient', {
					commandType: 'hero.allocate.attribute',
					attribute: 'strength'
				})
			)
		).toThrow(IllegalActionError);

		const pointReady = withProgression(fixture.state, fixture.heroId, {
			level: 2,
			experience: 10,
			unspentAttributePoints: 1,
			attributeGrowthReceipts: []
		});
		const hero = pointReady.heroes[fixture.heroId]!;
		const capped = EngineGameStateV25Schema.parse({
			...pointReady,
			heroes: {
				...pointReady.heroes,
				[fixture.heroId]: {
					...hero,
					capabilityProfile: {
						...hero.capabilityProfile,
						attributes: { ...hero.capabilityProfile.attributes, strength: 100 }
					}
				}
			}
		});
		expect(legalActions(capped, fixture.heroId).map((action) => action.actionId)).not.toContain(
			'hero.allocate.attribute.strength'
		);
		expect(() =>
			applyCommand(
				capped,
				command(capped, fixture.heroId, 'capped', {
					commandType: 'hero.allocate.attribute',
					attribute: 'strength'
				})
			)
		).toThrow(IllegalActionError);

		const dead = EngineGameStateV25Schema.parse({
			...pointReady,
			heroes: {
				...pointReady.heroes,
				[fixture.heroId]: {
					...hero,
					lifeState: 'dead',
					health: 0,
					assignment: null,
					currentActivity: null,
					currentTravel: null,
					currentRoutine: null,
					currentForging: null,
					dailyPlan: null
				}
			}
		});
		expect(
			legalActions(dead, fixture.heroId).some((action) =>
				action.actionId.startsWith('hero.allocate.')
			)
		).toBe(false);
		expect(() =>
			applyCommand(
				dead,
				command(dead, fixture.heroId, 'dead', {
					commandType: 'hero.allocate.attribute',
					attribute: 'strength'
				})
			)
		).toThrow(IllegalActionError);

		expect(
			EngineCommandSchema.safeParse({
				...command(pointReady, fixture.heroId, 'invalid-attribute', {
					commandType: 'hero.allocate.attribute',
					attribute: 'strength'
				}),
				attribute: 'dexterity'
			}).success
		).toBe(false);
	});
});

describe('engine-v26 intrinsic attribute progression', () => {
	it('preserves the V25 attribute-growth receipt chain validation in both versions', async () => {
		const v25 = await capabilityState('bad-receipt-chain-v25');
		const v25Hero = v25.state.heroes[v25.heroId]!;
		const badReceipt = {
			receiptId: deterministicUuid('bad-receipt-chain:receipt'),
			heroId: v25.heroId,
			attribute: 'strength' as const,
			beforeIntrinsicValue: v25Hero.capabilityProfile.attributes.strength + 1,
			afterIntrinsicValue: v25Hero.capabilityProfile.attributes.strength + 2,
			spentPoints: 1,
			sourceLevel: 2,
			rulesVersion: 'combat-rules-v1' as const,
			commandId: deterministicUuid('bad-receipt-chain:command'),
			gameTime: v25.state.simulatedAt
		};
		expect(
			EngineGameStateV25Schema.safeParse({
				...v25.state,
				heroes: {
					...v25.state.heroes,
					[v25.heroId]: {
						...v25Hero,
						progression: { ...v25Hero.progression, attributeGrowthReceipts: [badReceipt] }
					}
				}
			}).success
		).toBe(false);

		const legacyDraft = listSummonableHeroDrafts()[0];
		if (!legacyDraft) throw new Error('Expected an approved summonable draft');
		const draft = await generateSummonableCharacterDraft(legacyDraft.recipe, {
			capabilityEntropy: '4'.repeat(64)
		});
		const v26 = createBootstrapEngine({
			runId: deterministicUuid('bad-receipt-chain:v26-run'),
			seed: 'bad-receipt-chain:v26-seed',
			draft,
			combatMode: 'agent-readiness-v1',
			developmentEngineVersion: 26
		}).snapshot.state;
		if (v26.schemaVersion !== 26) throw new Error('Expected engine-v26 state');
		const v26Hero = v26.heroes[draft.manifest.characterId]!;
		expect(
			EngineGameStateV26Schema.safeParse({
				...v26,
				heroes: {
					...v26.heroes,
					[v26Hero.heroId]: {
						...v26Hero,
						progression: {
							...v26Hero.progression,
							attributeGrowthReceipts: [
								{ ...badReceipt, heroId: v26Hero.heroId, gameTime: v26.simulatedAt }
							]
						}
					}
				}
			}).success
		).toBe(false);
	});

	it('persists explicit combat training and allocates one enumerated attribute point', async () => {
		const legacyDraft = listSummonableHeroDrafts()[0];
		if (!legacyDraft) throw new Error('Expected an approved summonable draft');
		const draft = await generateSummonableCharacterDraft(legacyDraft.recipe, {
			capabilityEntropy: '7'.repeat(64)
		});
		const initial = createBootstrapEngine({
			runId: deterministicUuid('progression:v26-allocation:run'),
			seed: 'progression:v26-allocation:seed',
			draft,
			combatMode: 'agent-readiness-v1',
			developmentEngineVersion: 26
		}).snapshot.state;
		if (initial.schemaVersion !== 26) throw new Error('Expected engine-v26 state');
		const heroId = draft.manifest.characterId;
		const bootstrappedHero = initial.heroes[heroId]!;
		expect(bootstrappedHero.combatTraining).toStrictEqual({
			schemaVersion: 'hero-combat-training-v1',
			proficiencyTags: [],
			learnedSkills: [
				{
					schemaVersion: 'learned-combat-skill-v1',
					skillId: 'combat-skill-basic-sword-strike',
					mastery: 0,
					trainedDeliveryTags: ['one-handed-blade']
				}
			]
		});

		const ready = EngineGameStateV26Schema.parse({
			...initial,
			heroes: {
				...initial.heroes,
				[heroId]: {
					...bootstrappedHero,
					progression: {
						...bootstrappedHero.progression,
						level: 2,
						experience: 10,
						unspentAttributePoints: 1
					}
				}
			}
		});
		expect(legalActions(ready, heroId).map((action) => action.actionId)).toContain(
			'hero.allocate.attribute.agility'
		);

		const allocated = applyCommand(
			ready,
			command(ready, heroId, 'v26-allocate-agility', {
				commandType: 'hero.allocate.attribute',
				attribute: 'agility'
			})
		);
		if (allocated.state.schemaVersion !== 26) throw new Error('Expected engine-v26 state');
		expect(allocated.state.heroes[heroId]!.progression).toMatchObject({
			unspentAttributePoints: 0,
			attributeGrowthReceipts: [
				expect.objectContaining({
					attribute: 'agility',
					beforeIntrinsicValue: bootstrappedHero.capabilityProfile.attributes.agility,
					afterIntrinsicValue: bootstrappedHero.capabilityProfile.attributes.agility + 1
				})
			]
		});
	});

	it('enumerates and applies a V26 equipment command to its authored non-main-hand slot', async () => {
		const fixture = await readinessFixtureForEquipmentCommand();
		const hero = fixture.state.heroes[fixture.heroId]!;
		const trained = EngineGameStateV26Schema.parse({
			...fixture.state,
			heroes: {
				...fixture.state.heroes,
				[fixture.heroId]: {
					...hero,
					capabilityProfile: {
						...hero.capabilityProfile,
						attributes: { ...hero.capabilityProfile.attributes, strength: 45 }
					},
					combatTraining: {
						...hero.combatTraining,
						proficiencyTags: ['armour-training']
					}
				}
			}
		});
		const actions = legalActions(trained, fixture.heroId);
		expect(actions.map((candidate) => candidate.actionId)).toContain(
			`hero.equip.${fixture.torso.itemId}`
		);

		const applied = applyCommand(
			trained,
			command(trained, fixture.heroId, 'v26-equip-torso', {
				commandType: 'hero.equip.item',
				itemId: fixture.torso.itemId
			})
		);
		if (applied.state.schemaVersion !== 26) throw new Error('Expected engine-v26 state');
		expect(applied.state.heroes[fixture.heroId]!.equipment.torso).toBe(fixture.torso.itemId);
		expect(applied.state.items[fixture.torso.itemId]!.equippedById).toBe(fixture.heroId);
	});
});

describe('engine-v27 typed intrinsic growth', () => {
	it('applies a multi-point allocation through the authoritative command and receipt', async () => {
		const legacyDraft = listSummonableHeroDrafts()[0];
		if (!legacyDraft) throw new Error('Expected an approved summonable draft');
		const draft = await generateSummonableCharacterDraft(legacyDraft.recipe, {
			capabilityEntropy: '8'.repeat(64)
		});
		const bootstrapped = createBootstrapEngine({
			runId: deterministicUuid('progression:v27-allocation:run'),
			seed: 'progression:v27-allocation:seed',
			draft
		}).snapshot.state;
		if (bootstrapped.schemaVersion !== 27) throw new Error('Expected engine-v27 state');
		const heroId = draft.manifest.characterId;
		const hero = bootstrapped.heroes[heroId]!;
		const ready = EngineGameStateV27Schema.parse({
			...bootstrapped,
			heroes: {
				...bootstrapped.heroes,
				[heroId]: {
					...hero,
					progression: { ...hero.progression, unallocatedAttributePoints: 3 }
				}
			}
		});
		const applied = applyCommand(
			ready,
			command(ready, heroId, 'v27-allocate-strength', {
				commandType: 'hero.allocate.attribute',
				attribute: 'strength',
				amount: 3
			})
		);
		if (applied.state.schemaVersion !== 27) throw new Error('Expected engine-v27 state');
		expect(applied.events[0]).toMatchObject({ eventType: 'hero.attribute.growth.applied' });
		expect(applied.events[0]!.payload.receipt).toMatchObject({
			pointsSpent: 3,
			intrinsicBefore: hero.capabilityProfile.attributes.strength,
			intrinsicAfter: hero.capabilityProfile.attributes.strength + 3
		});
		expect(applied.state.heroes[heroId]!.progression).toMatchObject({
			unallocatedAttributePoints: 0,
			permanentGrowth: { strength: 3 }
		});
	});

	it('routes training XP through the shared claim and crosses an awakening without healing', async () => {
		const legacyDraft = listSummonableHeroDrafts()[0];
		if (!legacyDraft) throw new Error('Expected an approved summonable draft');
		const draft = await generateSummonableCharacterDraft(legacyDraft.recipe, {
			capabilityEntropy: '9'.repeat(64)
		});
		const initial = createBootstrapEngine({
			runId: deterministicUuid('progression:v27-training:run'),
			seed: 'progression:v27-training:seed',
			draft
		}).snapshot.state;
		if (initial.schemaVersion !== 27) throw new Error('Expected engine-v27 state');
		const heroId = draft.manifest.characterId;
		const hero = initial.heroes[heroId]!;
		const ready = EngineGameStateV27Schema.parse({
			...initial,
			heroes: {
				...initial.heroes,
				[heroId]: {
					...hero,
					location: 'training-ground',
					locationNodeId: 'training-ring',
					firstArrivalCompleted: true,
					destination: 'training-ground',
					health: hero.maxHealth - 10,
					progression: { ...hero.progression, level: 99, experience: 985 }
				}
			}
		});
		const started = applyCommand(
			ready,
			command(ready, heroId, 'v27-start-training', {
				commandType: 'hero.start.activity',
				activity: 'train'
			})
		);
		if (started.state.schemaVersion !== 27) throw new Error('Expected engine-v27 state');
		const completed = applyCommand(
			started.state,
			command(
				started.state,
				started.state.master.masterId,
				'v27-complete-training',
				{
					commandType: 'simulation.advance',
					targetGameTime: started.scheduled[0]!.dueGameTime
				},
				systemSource()
			)
		);
		if (completed.state.schemaVersion !== 27) throw new Error('Expected engine-v27 state');
		const trained = completed.state.heroes[heroId]!;
		expect(trained.progression).toMatchObject({
			level: 100,
			experience: 993,
			unallocatedAttributePoints: hero.progression.stars
		});
		const activityOutcomes = completed.events[0]!.payload.activityOutcomes as Array<{
			experienceReceipt: unknown;
		}>;
		expect(activityOutcomes[0]!.experienceReceipt).toMatchObject({
			claim: { sourceKind: 'training', amount: 8 },
			levelsCrossed: [100],
			pointsGranted: hero.progression.stars
		});
		expect(trained.health).toBe(hero.maxHealth - 10);
		expect(trained.maxHealth).toBeGreaterThan(hero.maxHealth);
	});
});

describe('engine-v25 settlement resource transitions', () => {
	it('resolves damage, rest, and sleep while Health remains above the legacy cap', async () => {
		const fixture = await capabilityState('resource-transitions');
		const damaged = applyCommand(
			fixture.state,
			command(
				fixture.state,
				fixture.state.master.masterId,
				'damage',
				{
					commandType: 'simulation.apply.damage',
					targetId: fixture.heroId,
					amount: 10,
					damageKind: 'hazard'
				},
				systemSource()
			)
		);
		if (damaged.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		expect(damaged.events[0]!.payload).toMatchObject({ healthBefore: 220, healthAfter: 210 });

		const restingState = EngineGameStateV25Schema.parse({
			...damaged.state,
			heroes: {
				...damaged.state.heroes,
				[fixture.heroId]: {
					...damaged.state.heroes[fixture.heroId]!,
					health: 150,
					injuries: []
				}
			}
		});
		const restStarted = applyCommand(
			restingState,
			command(restingState, fixture.heroId, 'rest', {
				commandType: 'hero.start.activity',
				activity: 'rest'
			})
		);
		if (restStarted.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		const restCompleted = applyCommand(
			restStarted.state,
			command(
				restStarted.state,
				restStarted.state.master.masterId,
				'complete-rest',
				{
					commandType: 'simulation.advance',
					targetGameTime: restStarted.scheduled[0]!.dueGameTime
				},
				systemSource()
			)
		);
		if (restCompleted.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		expect(restCompleted.state.heroes[fixture.heroId]!.health).toBe(160);

		const planCreated = applyCommand(
			restCompleted.state,
			command(restCompleted.state, fixture.heroId, 'plan', {
				commandType: 'hero.plan.day'
			})
		);
		if (planCreated.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		const sleepReady = EngineGameStateV25Schema.parse({
			...planCreated.state,
			heroes: {
				...planCreated.state.heroes,
				[fixture.heroId]: {
					...planCreated.state.heroes[fixture.heroId]!,
					health: 150,
					needs: { hunger: 0, fatigue: 100 }
				}
			}
		});
		const sleepStarted = applyCommand(
			sleepReady,
			command(sleepReady, fixture.heroId, 'sleep', { commandType: 'hero.start.routine' })
		);
		if (sleepStarted.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		expect(sleepStarted.state.heroes[fixture.heroId]!.currentRoutine?.kind).toBe('sleep');
		const sleepCompleted = applyCommand(
			sleepStarted.state,
			command(
				sleepStarted.state,
				sleepStarted.state.master.masterId,
				'complete-sleep',
				{
					commandType: 'simulation.advance',
					targetGameTime: sleepStarted.scheduled[0]!.dueGameTime
				},
				systemSource()
			)
		);
		if (sleepCompleted.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		expect(sleepCompleted.state.heroes[fixture.heroId]!.health).toBe(158);
	});
});
