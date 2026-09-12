import { generateSummonableCharacterDraft, listSummonableHeroDrafts } from '@summonlab/characters';
import {
	EngineGameStateV26Schema,
	type CombatChoiceBatchV1,
	type EngineGameStateV26
} from '@summonlab/contracts';
import { COMBAT_CONTENT_BINDING, COMBAT_RULES_V1 } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { applyCombatChoiceBatch, combatChoiceBatchHash } from '../combat/arbitration.js';
import { advanceUntilDecision } from '../combat/window.js';
import { createEquipmentItem } from '../settlement/equipment.js';
import { createBootstrapEngine } from '../../orchestration/bootstrap.js';
import { deterministicUuid } from '../../hash.js';
import { createMissionReadinessState } from './readiness-runtime.js';

async function readinessFixture(additionalHero = false): Promise<{
	state: EngineGameStateV26;
	heroId: string;
	heroIds: readonly string[];
}> {
	const source = listSummonableHeroDrafts()[0];
	if (!source) throw new Error('Expected an approved summonable draft');
	const draft = await generateSummonableCharacterDraft(source.recipe, {
		capabilityEntropy: '8'.repeat(64)
	});
	const secondDraft = additionalHero
		? await generateSummonableCharacterDraft(
				{ ...source.recipe, seed: 'readiness-runtime:second-character' },
				{ capabilityEntropy: '9'.repeat(64) }
			)
		: null;
	const state = createBootstrapEngine({
		runId: deterministicUuid('readiness-runtime:run'),
		seed: 'readiness-runtime:seed',
		draft,
		combatMode: 'agent-readiness-v1',
		...(secondDraft ? { additionalHeroes: [{ draft: secondDraft }] } : {})
	}).snapshot.state;
	if (state.schemaVersion !== 26) throw new Error('Expected engine-v26 state');
	return {
		state,
		heroId: draft.manifest.characterId,
		heroIds: [
			draft.manifest.characterId,
			...(secondDraft ? [secondDraft.manifest.characterId] : [])
		]
	};
}

function equippedItem(heroId: string, definitionId: string, key: string) {
	return createEquipmentItem({
		itemId: deterministicUuid(`readiness-runtime:${key}`),
		definitionId,
		ownerId: heroId,
		equippedById: heroId,
		craftsmanship: { label: 'standard', bonus: 0 },
		origin: {
			kind: 'dropped',
			missionId: 'tower-floor-01',
			rewardId: `readiness-runtime-${key}`,
			sourceId: 'readiness-runtime-fixture'
		}
	});
}

function choiceBatch(
	state: ReturnType<typeof createMissionReadinessState>,
	selections: Readonly<Record<string, { targetId: string; fallbackTargetId?: string }>>
): CombatChoiceBatchV1 {
	const advanced = advanceUntilDecision(state, COMBAT_RULES_V1);
	if (advanced.kind !== 'decision-window') throw new Error('Expected a decision window');
	const choices = advanced.views.map((view) => {
		const selection = selections[view.actorId];
		if (!selection) throw new Error(`Missing selection for ${view.actorId}`);
		const action = view.legalActions.find((candidate) => candidate.actionKind === 'attack');
		if (!action) throw new Error(`Expected an authored attack for ${view.actorId}`);
		const fallbackId: string | null = selection.fallbackTargetId
			? (action.fallbackOptions.find(
					(option) =>
						option.target.kind === 'entity' &&
						option.target.combatantId === selection.fallbackTargetId
				)?.fallbackId ?? null)
			: null;
		if (selection.fallbackTargetId && !fallbackId) {
			throw new Error(`Expected a fallback targeting ${selection.fallbackTargetId}`);
		}
		return {
			windowId: advanced.snapshot.windowId,
			attemptId: advanced.snapshot.attemptId,
			tick: advanced.snapshot.tick,
			actorId: view.actorId,
			snapshotHash: advanced.snapshot.snapshotHash,
			actorViewHash: view.actorViewHash,
			legalActionSetHash: view.legalActionSetHash,
			actionId: action.actionId,
			actionInstanceId: action.actionInstanceId,
			actionKind: action.actionKind,
			skillId: action.skillId,
			target: { kind: 'entity' as const, combatantId: selection.targetId },
			fallbackId
		};
	});
	const unsigned = {
		batchVersion: 'combat-choice-batch-v1' as const,
		batchId: deterministicUuid(`${advanced.snapshot.windowId}:readiness-runtime-batch`),
		windowId: advanced.snapshot.windowId,
		attemptId: advanced.snapshot.attemptId,
		tick: advanced.snapshot.tick,
		snapshotHash: advanced.snapshot.snapshotHash,
		choices
	};
	return { ...unsigned, batchHash: combatChoiceBatchHash(unsigned) };
}

describe('mission readiness construction', () => {
	it('keeps a cancel-policy sword attack executable without requiring an authored fallback', async () => {
		const fixture = await readinessFixture();
		const readiness = createMissionReadinessState(
			fixture.state,
			deterministicUuid('readiness-runtime:sword-window'),
			[fixture.heroId],
			'tower-floor-01'
		);
		readiness.combatants[fixture.heroId]!.readiness = {
			value: 10_000,
			exactNumerator: 10_000,
			recoveryUntilTick: 0
		};

		const advance = advanceUntilDecision(readiness, COMBAT_RULES_V1);

		expect(advance.kind).toBe('decision-window');
		if (advance.kind !== 'decision-window') return;
		expect(advance.views[0]!.legalActions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					actionId: 'combat-skill-basic-sword-strike',
					actionKind: 'attack',
					fallbackOptions: []
				})
			])
		);
	});

	it('projects canonical grown attributes, caps, explicit training, equipment tags, and resistances', async () => {
		const fixture = await readinessFixture();
		const hero = fixture.state.heroes[fixture.heroId]!;
		const bow = equippedItem(fixture.heroId, 'equipment-ash-bow', 'bow');
		const torso = equippedItem(fixture.heroId, 'equipment-iron-heavy-armour-torso', 'heavy-torso');
		const oldMainHand = hero.equipment.mainHand!;
		const configured = {
			...fixture.state,
			items: {
				...fixture.state.items,
				[oldMainHand]: { ...fixture.state.items[oldMainHand]!, equippedById: null },
				[bow.itemId]: bow,
				[torso.itemId]: torso
			},
			heroes: {
				...fixture.state.heroes,
				[fixture.heroId]: {
					...hero,
					capabilityProfile: {
						...hero.capabilityProfile,
						attributes: { strength: 44, vitality: 30, agility: 40, magic: 50 }
					},
					progression: {
						...hero.progression,
						level: 2,
						experience: 10,
						attributeGrowthReceipts: [
							{
								receiptId: deterministicUuid('readiness-runtime:strength-growth'),
								heroId: fixture.heroId,
								attribute: 'strength' as const,
								beforeIntrinsicValue: 44,
								afterIntrinsicValue: 45,
								spentPoints: 1,
								sourceLevel: 2,
								rulesVersion: 'combat-rules-v1' as const,
								commandId: deterministicUuid('readiness-runtime:strength-growth-command'),
								gameTime: fixture.state.simulatedAt
							}
						],
						unspentAttributePoints: 0
					},
					equipment: {
						mainHand: bow.itemId,
						offHand: null,
						head: null,
						torso: torso.itemId,
						legs: null,
						boots: null
					},
					combatTraining: {
						schemaVersion: 'hero-combat-training-v1',
						proficiencyTags: ['armour-training'],
						learnedSkills: [
							{
								schemaVersion: 'learned-combat-skill-v1',
								skillId: 'combat-skill-basic-bow-shot',
								mastery: 50,
								trainedDeliveryTags: ['bow']
							}
						]
					}
				}
			}
		} as unknown as EngineGameStateV26;
		const readiness = createMissionReadinessState(
			configured,
			deterministicUuid('readiness-runtime:attempt'),
			[fixture.heroId],
			'tower-floor-01'
		);
		const combatant = readiness.combatants[fixture.heroId]!;
		const templates = readiness.actorContexts[fixture.heroId]!.legalActionTemplates;

		expect(combatant.attributes).toStrictEqual({
			strength: 45,
			vitality: 30,
			agility: 40,
			magic: 50
		});
		expect(combatant.resources).toStrictEqual({
			health: { current: 220, maximum: 220 },
			mana: { current: 140, maximum: 140 }
		});
		expect(combatant.resistances).toStrictEqual({ cut: 800, impact: 600 });
		expect(templates).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					actionId: 'combat-skill-basic-bow-shot',
					resolutionProfile: expect.objectContaining({ deliveryTag: 'bow' })
				})
			])
		);
		expect(templates.map((template) => template.actionId)).not.toContain(
			'combat-skill-basic-sword-strike'
		);
	});

	it('authors executable enemy attacks that can damage and down the party', async () => {
		const fixture = await readinessFixture();
		const readiness = createMissionReadinessState(
			fixture.state,
			deterministicUuid('readiness-runtime:enemy-attempt'),
			[fixture.heroId],
			'tower-floor-01'
		);
		const monsterIds = Object.values(readiness.combatants)
			.filter((combatant) => combatant.combatantKind === 'monster')
			.map((combatant) => combatant.combatantId)
			.sort();
		expect(monsterIds).toHaveLength(3);
		for (const monsterId of monsterIds) {
			const templates = readiness.actorContexts[monsterId]!.legalActionTemplates;
			expect(templates[0]).toMatchObject({ actionKind: 'attack' });
			expect(templates).toEqual(
				expect.arrayContaining([expect.objectContaining({ actionKind: 'attack' })])
			);
		}

		let downingEvent: ReturnType<typeof applyCombatChoiceBatch>['events'][number] | undefined;
		for (let seedDigit = 0; seedDigit < 10 && !downingEvent; seedDigit += 1) {
			const contested = structuredClone(readiness);
			contested.seed = String(seedDigit).repeat(64);
			contested.combatants[fixture.heroId]!.resources.health.current = 1;
			contested.outcomeEvidence.partyHeroes[fixture.heroId]!.startingHealth = 1;
			contested.outcomeEvidence.partyHeroes[fixture.heroId]!.currentHealth = 1;
			contested.combatants[monsterIds[0]!]!.readiness = {
				value: 10_000,
				exactNumerator: 12_000,
				recoveryUntilTick: 0
			};
			const batch = choiceBatch(contested, {
				[monsterIds[0]!]: { targetId: fixture.heroId }
			});
			const event = applyCombatChoiceBatch(contested, batch, COMBAT_RULES_V1).events.find(
				(candidate) => candidate.actorId === monsterIds[0]
			);
			if (
				event?.effects.some(
					(effect) => effect.kind === 'downed' && effect.combatantId === fixture.heroId
				)
			) {
				downingEvent = event;
			}
		}

		expect(downingEvent?.effects).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'downed', combatantId: fixture.heroId })
			])
		);
	});

	it('reconstructs the immutable readiness-v1 hold-only monster catalog', async () => {
		const fixture = await readinessFixture();
		const readiness = createMissionReadinessState(
			fixture.state,
			deterministicUuid('readiness-runtime:v1-attempt'),
			[fixture.heroId],
			'tower-floor-01',
			'agent-readiness-rules-v1'
		);
		for (const combatant of Object.values(readiness.combatants)) {
			if (combatant.combatantKind !== 'monster') continue;
			expect(readiness.actorContexts[combatant.combatantId]!.legalActionTemplates).toEqual([
				expect.objectContaining({
					actionKind: 'guard',
					resolutionProfile: {
						profileKind: 'non-damaging',
						rulesVersion: 'combat-rules-v1',
						contentHash: COMBAT_CONTENT_BINDING.contentHash
					}
				})
			]);
		}
	});

	it('applies an authored entity retarget when an earlier attack invalidates the primary', async () => {
		const fixture = await readinessFixture(true);
		const configured = structuredClone(fixture.state) as EngineGameStateV26;
		for (const [index, heroId] of fixture.heroIds.entries()) {
			const hero = configured.heroes[heroId]!;
			hero.capabilityProfile.attributes.strength = 50;
			const bow = equippedItem(heroId, 'equipment-ash-bow', `fallback-bow-${index}`);
			if (hero.equipment.mainHand) {
				configured.items[hero.equipment.mainHand] = {
					...configured.items[hero.equipment.mainHand]!,
					equippedById: null
				};
			}
			configured.items[bow.itemId] = bow;
			hero.equipment.mainHand = bow.itemId;
			hero.equipment.offHand = null;
			hero.combatTraining = {
				schemaVersion: 'hero-combat-training-v1',
				proficiencyTags: [],
				learnedSkills: [
					{
						schemaVersion: 'learned-combat-skill-v1',
						skillId: 'combat-skill-basic-bow-shot',
						mastery: 0,
						trainedDeliveryTags: ['bow']
					}
				]
			};
		}
		const readiness = createMissionReadinessState(
			configured,
			deterministicUuid('readiness-runtime:fallback-attempt'),
			fixture.heroIds,
			'tower-floor-01'
		);
		const monsterIds = Object.values(readiness.combatants)
			.filter((combatant) => combatant.combatantKind === 'monster')
			.map((combatant) => combatant.combatantId)
			.sort();
		const contested = structuredClone(readiness);
		contested.seed = '2'.repeat(64);
		contested.combatants[monsterIds[0]!]!.resources.health.current = 1;
		contested.combatants[fixture.heroIds[0]!]!.readiness = {
			value: 10_000,
			exactNumerator: 12_000,
			recoveryUntilTick: 0
		};
		contested.combatants[fixture.heroIds[1]!]!.readiness = {
			value: 10_000,
			exactNumerator: 11_000,
			recoveryUntilTick: 0
		};
		const batch = choiceBatch(contested, {
			[fixture.heroIds[0]!]: {
				targetId: monsterIds[0]!,
				fallbackTargetId: monsterIds[1]!
			},
			[fixture.heroIds[1]!]: {
				targetId: monsterIds[0]!,
				fallbackTargetId: monsterIds[1]!
			}
		});
		const fallbackId = batch.choices[0]!.fallbackId;
		expect(fallbackId).not.toBeNull();
		const result = applyCombatChoiceBatch(contested, batch, COMBAT_RULES_V1);
		const first = result.events.find((event) => event.actorId === fixture.heroIds[0])!;
		const second = result.events.find((event) => event.actorId === fixture.heroIds[1])!;

		expect(first.effects).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'downed', combatantId: monsterIds[0] })
			])
		);
		expect(second).toMatchObject({
			fallbackApplied: {
				fallbackId,
				target: { kind: 'entity', combatantId: monsterIds[1] }
			},
			finalOutcome: 'superseded'
		});
	});

	it('requires the V26-only explicit combat-training boundary', async () => {
		const fixture = await readinessFixture();
		const hero = fixture.state.heroes[fixture.heroId]!;
		expect(() =>
			EngineGameStateV26Schema.parse({
				...fixture.state,
				heroes: {
					...fixture.state.heroes,
					[fixture.heroId]: { ...hero, combatTraining: undefined }
				}
			})
		).toThrow();
	});
});
