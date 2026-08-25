import { randomUUID } from 'node:crypto';

import { FIRST_OBSERVATION, generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import { EngineCommandSchema, type EngineCommand } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand,
	getEngineReplay
} from './engine.js';
import { createProofRun, markProofArrival } from './proof.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

function inspectionCommand(
	runId: string,
	masterId: string,
	expectedVersion: number,
	commandId = randomUUID()
): EngineCommand {
	return {
		commandId,
		runId,
		actorId: masterId,
		expectedVersion,
		correlationId: commandId,
		source: {
			source: 'manual',
			timing: 'step',
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		},
		commandType: 'master.inspect.gate'
	};
}

function engineCommand(
	runId: string,
	actorId: string,
	expectedVersion: number,
	fields: Record<string, unknown>
): EngineCommand {
	const commandId = randomUUID();
	return EngineCommandSchema.parse({
		commandId,
		runId,
		actorId,
		expectedVersion,
		correlationId: commandId,
		source: {
			source: 'manual',
			timing: 'step',
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		},
		...fields
	});
}

describe('engine event store', () => {
	run('accepts one concurrent command, rejects stale input, and retries idempotently', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const draft = await generateCharacterDraft(recipeFromSeed(`engine-${randomUUID()}`));
		const runId = randomUUID();
		await createProofRun(databaseUrl, {
			runId,
			draft,
			controlMode: 'wait',
			directive: '',
			firstObservation: FIRST_OBSERVATION,
			choice: null
		});
		const initial = await getEngineReplay(databaseUrl, runId);
		if (!initial) throw new Error('Expected initialized engine replay');
		const masterId = initial.snapshot.state.master.masterId;
		const left = inspectionCommand(runId, masterId, 0);
		const right = inspectionCommand(runId, masterId, 0);
		const results = await Promise.allSettled([
			commitEngineCommand(databaseUrl, left),
			commitEngineCommand(databaseUrl, right)
		]);
		const fulfilled = results.filter((result) => result.status === 'fulfilled');
		const rejected = results.filter((result) => result.status === 'rejected');
		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(StaleRunVersionError);

		const accepted = (
			fulfilled[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof commitEngineCommand>>>
		).value;
		const retryCommand = accepted.events[0]?.commandId === left.commandId ? left : right;
		const retried = await commitEngineCommand(databaseUrl, retryCommand);
		expect(retried.idempotentReplay).toBe(true);
		expect(retried.events[0]?.eventId).toBe(accepted.events[0]?.eventId);
		await expect(
			commitEngineCommand(databaseUrl, { ...retryCommand, expectedVersion: 1 })
		).rejects.toBeInstanceOf(IdempotencyConflictError);

		const replay = await getEngineReplay(databaseUrl, runId);
		expect(replay?.verified).toBe(true);
		expect(replay?.eventCount).toBe(2);
		expect(replay?.snapshot.state.version).toBe(1);
		expect(replay?.snapshot.state.entropyCursor).toBe(1);
	});

	run('coalesces concurrent duplicate delivery without consuming entropy twice', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const draft = await generateCharacterDraft(recipeFromSeed(`duplicate-${randomUUID()}`));
		const runId = randomUUID();
		await createProofRun(databaseUrl, {
			runId,
			draft,
			controlMode: 'wait',
			directive: '',
			firstObservation: FIRST_OBSERVATION,
			choice: null
		});
		const initial = await getEngineReplay(databaseUrl, runId);
		if (!initial) throw new Error('Expected initialized engine replay');
		const command = inspectionCommand(runId, initial.snapshot.state.master.masterId, 0);
		const [left, right] = await Promise.all([
			commitEngineCommand(databaseUrl, command),
			commitEngineCommand(databaseUrl, command)
		]);
		expect([left.idempotentReplay, right.idempotentReplay].sort()).toEqual([false, true]);
		expect(left.events[0]?.eventId).toBe(right.events[0]?.eventId);

		const replay = await getEngineReplay(databaseUrl, runId);
		expect(replay?.eventCount).toBe(2);
		expect(replay?.snapshot.state.entropyCursor).toBe(1);
	});

	run('persists witnessed communication and its belief provenance through replay', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const draft = await generateCharacterDraft(recipeFromSeed(`communication-${randomUUID()}`));
		const runId = randomUUID();
		await createProofRun(databaseUrl, {
			runId,
			draft,
			controlMode: 'wait',
			directive: '',
			firstObservation: FIRST_OBSERVATION,
			choice: null
		});
		const initial = await getEngineReplay(databaseUrl, runId);
		if (!initial || initial.snapshot.state.schemaVersion !== 13) {
			throw new Error('Expected engine-v13 replay');
		}
		const committed = await commitEngineCommand(
			databaseUrl,
			engineCommand(runId, initial.snapshot.state.master.masterId, 0, {
				commandType: 'master.communicate',
				targetHeroId: draft.manifest.characterId,
				kind: 'explain',
				topic: 'tower-mission',
				exactText: 'The tower is real, but how we climb it is not yet written.',
				tone: 'reassuring',
				delivery: 'private'
			})
		);
		expect(committed.events[0]?.eventType).toBe('social.communicative.act.recorded');
		const replay = await getEngineReplay(databaseUrl, runId);
		if (!replay || replay.snapshot.state.schemaVersion !== 13) throw new Error('Expected replay');
		const act = Object.values(replay.snapshot.state.society.communicativeActs)[0]!;
		const witness = act.witnesses[0]!;
		expect(replay.verified).toBe(true);
		expect(act.exactText).toBe('The tower is real, but how we climb it is not yet written.');
		expect(replay.snapshot.state.society.observations[witness.observationId]).toMatchObject({
			observerHeroId: draft.manifest.characterId,
			communicationActId: act.actId
		});
		expect(replay.snapshot.state.society.beliefs[witness.beliefId!]).toMatchObject({
			predicate: 'described-tower-mission',
			provenance: {
				sourceEventId: act.sourceEventId,
				observationId: witness.observationId,
				learnedFromId: initial.snapshot.state.master.masterId
			}
		});
	});

	run('persists scoped direction delivery and its expiry schedule through replay', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const draft = await generateCharacterDraft(recipeFromSeed(`directive-${randomUUID()}`));
		const runId = randomUUID();
		await createProofRun(databaseUrl, {
			runId,
			draft,
			controlMode: 'wait',
			directive: '',
			firstObservation: FIRST_OBSERVATION,
			choice: null
		});
		const initial = await getEngineReplay(databaseUrl, runId);
		if (!initial || initial.snapshot.state.schemaVersion !== 13) {
			throw new Error('Expected engine-v13 replay');
		}
		const committed = await commitEngineCommand(
			databaseUrl,
			engineCommand(runId, initial.snapshot.state.master.masterId, 0, {
				commandType: 'master.issue.directive',
				text: 'Eat and rest before training again.',
				scope: 'day',
				recipientIds: [draft.manifest.characterId],
				priorities: ['eat', 'rest', 'recovery'],
				tone: 'reassuring',
				delivery: 'private'
			})
		);
		expect(committed.scheduled).toHaveLength(1);
		const replay = await getEngineReplay(databaseUrl, runId);
		if (!replay || replay.snapshot.state.schemaVersion !== 13) throw new Error('Expected replay');
		const directive = Object.values(replay.snapshot.state.society.directives)[0]!;
		expect(replay.verified).toBe(true);
		expect(directive).toMatchObject({
			text: 'Eat and rest before training again.',
			status: 'active',
			expiryScheduledEventId: committed.scheduled[0]!.scheduledEventId
		});
		expect(
			replay.snapshot.state.society.observations[directive.witnessObservationIds[0]!]
		).toMatchObject({
			observerHeroId: draft.manifest.characterId,
			sourceEventId: committed.events[0]!.eventId
		});
	});

	run(
		'persists a hero order outcome and its witnessed agency evidence through replay',
		async () => {
			if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
			const draft = await generateCharacterDraft(recipeFromSeed(`conversation-${randomUUID()}`));
			const runId = randomUUID();
			await createProofRun(databaseUrl, {
				runId,
				draft,
				controlMode: 'wait',
				directive: '',
				firstObservation: FIRST_OBSERVATION,
				choice: null
			});
			const initial = await getEngineReplay(databaseUrl, runId);
			if (!initial || initial.snapshot.state.schemaVersion !== 13) {
				throw new Error('Expected engine-v13 replay');
			}
			const exactText = 'Train before we risk the first tower floor.';
			const committed = await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, initial.snapshot.state.master.masterId, 0, {
					commandType: 'master.converse',
					targetHeroId: draft.manifest.characterId,
					kind: 'order',
					exactText,
					tone: 'reassuring',
					delivery: 'private',
					orderIntent: 'train'
				})
			);
			expect(committed.events[0]?.eventType).toBe('social.conversation.turn.recorded');
			const replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 13) throw new Error('Expected replay');
			const turn = Object.values(replay.snapshot.state.society.conversationTurns)[0]!;
			const act = replay.snapshot.state.society.communicativeActs[turn.communicationActId]!;
			expect(replay.verified).toBe(true);
			expect(act.exactText).toBe(exactText);
			expect(turn.response.orderOutcome).toMatch(/accepted|negotiated|deferred|refused/u);
			expect(turn.response.publicReason).toContain('outcome totals');
			expect(replay.snapshot.state.heroes[draft.manifest.characterId]).toMatchObject({
				destination: null,
				currentActivity: null
			});
		}
	);

	run(
		'persists scheduled survival work, progression deltas, cancellation, and game over',
		async () => {
			if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
			const draft = await generateCharacterDraft(recipeFromSeed(`survival-${randomUUID()}`));
			const runId = randomUUID();
			await createProofRun(databaseUrl, {
				runId,
				draft,
				controlMode: 'autonomous',
				directive: 'Train and preserve useful equipment.',
				firstObservation: FIRST_OBSERVATION,
				choice: {
					destination: 'training-ground',
					source: 'scripted',
					firstLine: 'I will learn what this body can do.',
					storyBranch: 'steel-before-trust',
					score: { kitchen: 0, trainingGround: 1 }
				}
			});
			await markProofArrival(databaseUrl, runId);
			let replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 13) {
				throw new Error('Expected an engine-v13 replay');
			}
			const heroId = draft.manifest.characterId;
			const masterId = replay.snapshot.state.master.masterId;
			await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, masterId, replay.snapshot.state.version, {
					commandType: 'settlement.assign.hero',
					heroId,
					buildingId: 'training-ground',
					role: 'trainee'
				})
			);
			replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 13) throw new Error('Expected replay');
			await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, masterId, replay.snapshot.state.version, {
					commandType: 'story.recover.first.ember',
					source: {
						source: 'system',
						timing: null,
						fallbackPolicy: null,
						directiveIds: [],
						decisionJobId: null
					}
				})
			);
			replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 13) throw new Error('Expected replay');
			await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, masterId, replay.snapshot.state.version, {
					commandType: 'settlement.commit.first.ember',
					buildingId: 'training-ground',
					rationale: 'prepare-tower'
				})
			);
			replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 13) throw new Error('Expected replay');
			expect(
				replay.snapshot.state.settlement.buildings['training-ground']?.assignedHeroIds
			).toEqual([heroId]);
			expect(replay.snapshot.state.settlement.navigation.activeSystemIds).toContain(
				'training-system'
			);
			expect(replay.snapshot.state.settlement.firstEmber.reactions).toHaveLength(1);
			expect(replay.snapshot.state.heroes[heroId]?.mind).toEqual(draft.mind);
			expect(
				Object.values(replay.snapshot.state.society.observations).map(
					(observation) => observation.kind
				)
			).toEqual(['awakening', 'first-ember-commitment']);
			expect(Object.values(replay.snapshot.state.society.promises)[0]).toMatchObject({
				status: 'active',
				terms: 'I will prepare this company for the tower as our founding priority.'
			});
			const stance = replay.snapshot.state.settlement.firstEmber.reactions[0]!.stance;
			const expectedTrust = { support: 8, accept: 3, question: -2, oppose: -8 }[stance];
			const expectedLegitimacy = { support: 8, accept: 4, question: -2, oppose: -8 }[stance];
			expect(Object.values(replay.snapshot.state.society.authority)[0]?.dimensions).toMatchObject({
				trust: expectedTrust,
				legitimacy: expectedLegitimacy,
				consistency: 6
			});

			const planned = await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, heroId, replay.snapshot.state.version, {
					commandType: 'hero.plan.day'
				})
			);
			if (planned.snapshot.state.schemaVersion !== 13) throw new Error('Expected routine state');
			expect(planned.snapshot.state.heroes[heroId]?.dailyPlan?.entries).toHaveLength(4);
			const routine = await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, heroId, planned.snapshot.state.version, {
					commandType: 'hero.start.routine',
					source: {
						source: 'habit',
						timing: 'continuous',
						fallbackPolicy: null,
						directiveIds: [],
						decisionJobId: null
					}
				})
			);
			expect(routine.scheduled[0]).toMatchObject({ eventKind: 'hero.routine.complete' });
			replay = await getEngineReplay(databaseUrl, runId);
			expect(
				replay?.scheduledEvents.find((scheduled) => scheduled.eventKind === 'hero.routine.complete')
					?.status
			).toBe('pending');
			await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, masterId, routine.snapshot.state.version, {
					commandType: 'simulation.advance',
					targetGameTime: routine.scheduled[0]!.dueGameTime
				})
			);
			replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 13) throw new Error('Expected replay');
			expect(replay.snapshot.state.heroes[heroId]?.currentRoutine).toBeNull();
			expect(
				replay.snapshot.state.heroes[heroId]?.dailyPlan?.entries.filter(
					(entry) => entry.status === 'completed'
				)
			).toHaveLength(1);
			expect(replay.checks.some((check) => check.eventType === 'hero.routine.started')).toBe(true);

			const training = await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, heroId, replay.snapshot.state.version, {
					commandType: 'hero.start.activity',
					activity: 'train'
				})
			);
			expect(training.scheduled).toHaveLength(1);
			replay = await getEngineReplay(databaseUrl, runId);
			expect(
				replay?.scheduledEvents.find(
					(scheduled) => scheduled.eventKind === 'hero.activity.complete'
				)?.status
			).toBe('pending');
			const trainingDue = training.scheduled[0]?.dueGameTime;
			if (!trainingDue) throw new Error('Expected a scheduled training outcome');

			await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, masterId, training.snapshot.state.version, {
					commandType: 'simulation.advance',
					targetGameTime: trainingDue
				})
			);
			replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 13) throw new Error('Expected replay');
			expect(
				replay.scheduledEvents.find(
					(scheduled) => scheduled.scheduledEventId === training.scheduled[0]?.scheduledEventId
				)?.status
			).toBe('resolved');
			expect(replay.snapshot.state.heroes[heroId]?.progression.experience).toBe(12);
			expect(
				replay.journalEntries.some((entry) =>
					entry.deltas.some(
						(delta) => delta.kind === 'experience' && delta.key === 'hero' && delta.delta === 12
					)
				)
			).toBe(true);

			const repair = await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, heroId, replay.snapshot.state.version, {
					commandType: 'hero.start.activity',
					activity: 'repair'
				})
			);
			expect(repair.snapshot.state.schemaVersion).toBe(13);
			if (repair.snapshot.state.schemaVersion !== 13) throw new Error('Expected survival state');
			expect(repair.snapshot.state.settlement.resources['iron-ore']).toBe(1);
			const repairDue = repair.scheduled[0]?.dueGameTime;
			if (!repairDue) throw new Error('Expected a scheduled repair outcome');
			await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, masterId, repair.snapshot.state.version, {
					commandType: 'simulation.advance',
					targetGameTime: repairDue
				})
			);

			replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 13) throw new Error('Expected replay');
			const rest = await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, heroId, replay.snapshot.state.version, {
					commandType: 'hero.start.activity',
					activity: 'rest'
				})
			);
			const killed = await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, masterId, rest.snapshot.state.version, {
					commandType: 'simulation.apply.damage',
					targetId: heroId,
					amount: 100,
					damageKind: 'hazard'
				})
			);
			expect(killed.canceledScheduledEventIds).toEqual([rest.scheduled[0]?.scheduledEventId]);
			replay = await getEngineReplay(databaseUrl, runId);
			expect(replay?.scheduledEvents.at(-1)?.status).toBe('canceled');
			expect(replay?.legalActionsByActor[heroId]).toEqual([]);

			const ended = await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, masterId, killed.snapshot.state.version, {
					commandType: 'simulation.apply.damage',
					targetId: masterId,
					amount: 100,
					damageKind: 'hazard'
				})
			);
			expect(ended.snapshot.state.status).toBe('game_over');
			replay = await getEngineReplay(databaseUrl, runId);
			expect(replay?.verified).toBe(true);
			expect(replay?.legalActions).toEqual([]);
		}
	);

	run(
		'persists the exact Floor 01 deployment and extraction lifecycle through replay',
		async () => {
			if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
			const draft = await generateCharacterDraft(recipeFromSeed(`mission-${randomUUID()}`));
			const runId = randomUUID();
			await createProofRun(databaseUrl, {
				runId,
				draft,
				controlMode: 'wait',
				directive: '',
				firstObservation: FIRST_OBSERVATION,
				choice: null
			});

			let replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 13) {
				throw new Error('Expected engine-v13 mission state');
			}
			const masterId = replay.snapshot.state.master.masterId;
			const heroId = draft.manifest.characterId;
			expect(replay.snapshot.state.mission.binding).toEqual({
				missionId: 'tower-floor-01',
				contentVersion: 'tower-floor-01-v1',
				contentHash: '31f756076a3e67ad9023108400464e9a0ab9995637266b1b9f41c802d3a48b02'
			});

			const commit = async (fields: Record<string, unknown>) => {
				const current = replay;
				if (!current) throw new Error('Expected replay before mission command');
				const committed = await commitEngineCommand(
					databaseUrl,
					engineCommand(runId, masterId, current.snapshot.state.version, fields)
				);
				expect(committed.snapshot.state.schemaVersion).toBe(13);
				replay = await getEngineReplay(databaseUrl, runId);
				if (!replay || replay.snapshot.state.schemaVersion !== 13) {
					throw new Error('Expected replayed engine-v13 mission state');
				}
			};

			await commit({ commandType: 'mission.prepare', heroIds: [heroId] });
			await commit({ commandType: 'mission.deploy' });
			for (const actionId of [
				'mission.move.threshold-to-oath-hall',
				'mission.move.oath-hall-to-gallery',
				'mission.move.gallery-to-chain-court',
				'mission.move.chain-court-to-vault',
				'mission.recover.recover-first-ember',
				'mission.move.chain-court-to-vault',
				'mission.move.gallery-to-chain-court',
				'mission.move.oath-hall-to-gallery',
				'mission.move.threshold-to-oath-hall'
			]) {
				await commit({
					commandType: 'mission.resolve.turn',
					choices: [
						{
							actorId: masterId,
							actionId,
							source: 'manual',
							policyId: null,
							packetHash: null,
							legalActionHash: null,
							policyResultHash: null,
							publicIntent: `The Master chose ${actionId}.`
						},
						{
							actorId: heroId,
							actionId: 'mission.hold',
							source: 'scripted',
							policyId: 'scripted-personality-v1',
							packetHash: '1'.repeat(64),
							legalActionHash: '2'.repeat(64),
							policyResultHash: '3'.repeat(64),
							publicIntent: 'The hero independently holds the threshold.'
						}
					]
				});
			}
			await commit({ commandType: 'mission.extract' });

			expect(replay.verified).toBe(true);
			expect(replay.hashMatchesPersistedSnapshot).toBe(true);
			expect(replay.snapshot.state.mission.attempt).toMatchObject({
				ordinal: 1,
				status: 'success',
				party: { heroIds: [heroId], memberIds: [masterId, heroId] },
				completedObjectiveIds: ['recover-first-ember'],
				outcome: 'success'
			});
			expect(
				replay.checks.filter((check) => check.eventType === 'mission.round.resolved')
			).toHaveLength(9);
			expect(replay.checks.at(-1)?.eventType).toBe('mission.extracted');
			expect(replay.legalActionsByActor[masterId]?.map((action) => action.actionId)).not.toContain(
				'mission.prepare'
			);
		}
	);
});
