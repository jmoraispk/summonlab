import { generateSummonableCharacterDraft, listSummonableHeroDrafts } from '@summonlab/characters';
import {
	AttributeGrowthReceiptSchema,
	AttributeModifierSchema,
	EngineCommandSchema,
	EngineGameStateV24Schema,
	EngineGameStateV25Schema,
	type ActionSource,
	type EngineCommand,
	type EngineGameStateV25
} from '@summonlab/contracts';
import { COMBAT_RULES_V1 } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { effectiveAttribute } from '../combat/capability.js';
import { IllegalActionError, StaleStateVersionError } from '../../errors.js';
import { deterministicUuid, sha256Hex } from '../../hash.js';
import { applyCommand } from '../../orchestration/apply-command.js';
import { createBootstrapEngine } from '../../orchestration/bootstrap.js';
import { legalActions } from '../../orchestration/legal-actions.js';
import { attributePointsForLevelTransition } from './routines.js';

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
	state: EngineGameStateV25,
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
	const draft = await generateSummonableCharacterDraft(legacyDraft.recipe);
	const bootstrap = createBootstrapEngine({
		runId: deterministicUuid(`progression:${key}:run`),
		seed: `progression:${key}:seed`,
		draft
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
						attributes: { might: 20, vitality: 30, agility: 40, spirit: 50 }
					}
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
				'hero.allocate.attribute.might',
				'hero.allocate.attribute.vitality',
				'hero.allocate.attribute.agility',
				'hero.allocate.attribute.spirit'
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
			modifierId: deterministicUuid('progression:temporary-might'),
			attribute: 'might',
			scope: 'physical-damage',
			stackingRule: 'additive-flat',
			value: 50,
			cap: 50,
			duration: { kind: 'action' },
			source: {
				receiptId: deterministicUuid('progression:temporary-might:source'),
				sourceKind: 'status',
				sourceId: 'status:test-might'
			},
			rulesVersion: 'combat-rules-v1'
		});
		expect(effectiveAttribute(20, [mightModifier], 'physical-damage', COMBAT_RULES_V1)).toBe(70);

		const allocateMight = command(ready, fixture.heroId, 'allocate-might', {
			commandType: 'hero.allocate.attribute',
			attribute: 'might'
		});
		const first = applyCommand(ready, allocateMight);
		if (first.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		const firstReceipt = AttributeGrowthReceiptSchema.parse(
			first.events[0]!.payload.attributeGrowthReceipt
		);
		expect(firstReceipt).toStrictEqual({
			receiptId: deterministicUuid(`${first.events[0]!.eventId}:attribute-growth`),
			heroId: fixture.heroId,
			attribute: 'might',
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
		expect(first.state.heroes[fixture.heroId]!.capabilityProfile.attributes.might).toBe(20);

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

	it('rejects stale, insufficient, terminal, capped, and invalid allocations', async () => {
		const fixture = await capabilityState('rejections');
		const stale = {
			...command(fixture.state, fixture.heroId, 'stale', {
				commandType: 'hero.allocate.attribute',
				attribute: 'might'
			}),
			expectedVersion: fixture.state.version + 1
		};
		expect(() => applyCommand(fixture.state, stale)).toThrow(StaleStateVersionError);
		expect(() =>
			applyCommand(
				fixture.state,
				command(fixture.state, fixture.heroId, 'insufficient', {
					commandType: 'hero.allocate.attribute',
					attribute: 'might'
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
						attributes: { ...hero.capabilityProfile.attributes, might: 100 }
					}
				}
			}
		});
		expect(legalActions(capped, fixture.heroId).map((action) => action.actionId)).not.toContain(
			'hero.allocate.attribute.might'
		);
		expect(() =>
			applyCommand(
				capped,
				command(capped, fixture.heroId, 'capped', {
					commandType: 'hero.allocate.attribute',
					attribute: 'might'
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
					attribute: 'might'
				})
			)
		).toThrow(IllegalActionError);

		expect(
			EngineCommandSchema.safeParse({
				...command(pointReady, fixture.heroId, 'invalid-attribute', {
					commandType: 'hero.allocate.attribute',
					attribute: 'might'
				}),
				attribute: 'dexterity'
			}).success
		).toBe(false);
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
