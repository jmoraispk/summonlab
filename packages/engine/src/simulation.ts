import type { AuthoritativeEvent, EngineCommand, EngineGameState } from '@summonlab/contracts';

import { applyCommand, createBootstrapEngine, legalActions, replayEventsStrict } from './engine.js';
import { deterministicUuid, hashCanonical } from './hash.js';

function source(source: 'random' | 'manual' | 'habit' | 'system') {
	return {
		source,
		timing:
			source === 'random'
				? ('continuous' as const)
				: source === 'manual'
					? ('step' as const)
					: source === 'habit'
						? ('continuous' as const)
						: null,
		fallbackPolicy: source === 'random' ? ('random' as const) : null,
		directiveIds: [],
		decisionJobId: null
	};
}

export interface SimulationReport {
	readonly sequenceCount: number;
	readonly commandCount: number;
	readonly replayCount: number;
	readonly scheduledCount: number;
	readonly resolvedScheduleCount: number;
	readonly heroDeathCount: number;
	readonly gameOverCount: number;
	readonly invariantFailures: number;
	readonly finalDigest: string;
}

type WithoutEnvelope<T> = T extends EngineCommand
	? Omit<T, 'commandId' | 'runId' | 'expectedVersion' | 'correlationId'>
	: never;
type SimulationCommand = WithoutEnvelope<EngineCommand>;

function assertSimulationInvariants(state: EngineGameState): void {
	if (
		state.schemaVersion !== 2 &&
		state.schemaVersion !== 3 &&
		state.schemaVersion !== 4 &&
		state.schemaVersion !== 5 &&
		state.schemaVersion !== 6 &&
		state.schemaVersion !== 7 &&
		state.schemaVersion !== 8
	)
		return;
	for (const balance of Object.values(state.settlement.resources)) {
		if (balance < 0) throw new Error('Simulation produced a negative resource balance');
	}
	for (const hero of Object.values(state.heroes)) {
		if (hero.lifeState !== 'active' && legalActions(state, hero.heroId).length > 0) {
			throw new Error('Simulation allowed a terminal hero to act');
		}
	}
	if (state.master.lifeState === 'dead' && state.status !== 'game_over') {
		throw new Error('Simulation failed to end on Master death');
	}
}

export function simulateFoundation(sequenceCount = 10_000): SimulationReport {
	if (!Number.isSafeInteger(sequenceCount) || sequenceCount < 1) {
		throw new Error('Simulation sequence count must be a positive integer');
	}
	let commandCount = 0;
	let replayCount = 0;
	let scheduledCount = 0;
	let resolvedScheduleCount = 0;
	let heroDeathCount = 0;
	let gameOverCount = 0;
	let digestInput = '';

	for (let index = 0; index < sequenceCount; index += 1) {
		const runId = deterministicUuid(`simulation.run.${index}`);
		const heroId = deterministicUuid(`simulation.hero.${index}`);
		const bootstrap = createBootstrapEngine({
			runId,
			seed: `simulation-seed-${index}`,
			heroId,
			manifestHash: hashCanonical({ heroId }),
			rarityStars: (index % 3) + 1
		});
		let state = bootstrap.snapshot.state;
		const events: AuthoritativeEvent[] = [bootstrap.event];
		const destination = index % 2 === 0 ? 'kitchen' : 'training-ground';

		const apply = (key: string, command: SimulationCommand) => {
			const commandId = deterministicUuid(`${runId}:${key}:${state.version}`);
			const result = applyCommand(state, {
				...command,
				commandId,
				runId,
				expectedVersion: state.version,
				correlationId: commandId
			} as EngineCommand);
			state = result.state;
			events.push(...result.events);
			commandCount += 1;
			scheduledCount += result.scheduled.length;
			resolvedScheduleCount += result.resolvedScheduledEventIds.length;
			assertSimulationInvariants(state);
			return result;
		};

		apply('choose', {
			actorId: heroId,
			source: source('random'),
			commandType: 'hero.choose.destination',
			destination,
			firstLine: 'A deterministic survival simulation choice.',
			storyBranch: destination === 'kitchen' ? 'names-before-orders' : 'steel-before-trust'
		});
		const traveling = apply('travel', {
			actorId: heroId,
			source: source('system'),
			commandType: 'hero.start.travel',
			targetNodeId: destination === 'kitchen' ? 'kitchen-table' : 'training-ring'
		});
		apply('arrive', {
			actorId: state.master.masterId,
			source: source('system'),
			commandType: 'simulation.advance',
			targetGameTime: traveling.scheduled[0]!.dueGameTime
		});
		if (
			state.schemaVersion === 4 ||
			state.schemaVersion === 5 ||
			state.schemaVersion === 6 ||
			state.schemaVersion === 7 ||
			state.schemaVersion === 8
		) {
			apply('assign-facility', {
				actorId: state.master.masterId,
				source: source('manual'),
				commandType: 'settlement.assign.hero',
				heroId,
				buildingId: destination,
				role: destination === 'kitchen' ? 'cook' : 'trainee'
			});
			if (
				index % 3 === 0 &&
				state.schemaVersion !== 6 &&
				state.schemaVersion !== 7 &&
				state.schemaVersion !== 8
			) {
				apply('power-workshop', {
					actorId: state.master.masterId,
					source: source('manual'),
					commandType: 'settlement.allocate.power',
					buildingId: 'workshop'
				});
			}
		}
		if (
			(state.schemaVersion === 5 ||
				state.schemaVersion === 6 ||
				state.schemaVersion === 7 ||
				state.schemaVersion === 8) &&
			index % 5 === 0
		) {
			apply('plan-day', {
				actorId: heroId,
				source: source('manual'),
				commandType: 'hero.plan.day'
			});
			const routine = apply('follow-plan', {
				actorId: heroId,
				source: source('habit'),
				commandType: 'hero.start.routine'
			});
			apply('finish-routine', {
				actorId: state.master.masterId,
				source: source('system'),
				commandType: 'simulation.advance',
				targetGameTime: routine.scheduled[0]!.dueGameTime
			});
		}

		if (index % 2 === 0) {
			const started = apply('eat', {
				actorId: heroId,
				source: source('random'),
				commandType: 'hero.start.activity',
				activity: 'eat'
			});
			apply('finish-eat', {
				actorId: state.master.masterId,
				source: source('system'),
				commandType: 'simulation.advance',
				targetGameTime: started.scheduled[0]!.dueGameTime
			});
		} else {
			const started = apply('train', {
				actorId: heroId,
				source: source('random'),
				commandType: 'hero.start.activity',
				activity: 'train'
			});
			apply('finish-train', {
				actorId: state.master.masterId,
				source: source('system'),
				commandType: 'simulation.advance',
				targetGameTime: started.scheduled[0]!.dueGameTime
			});
			if (index % 4 === 1) {
				const repair = apply('repair', {
					actorId: heroId,
					source: source('manual'),
					commandType: 'hero.start.activity',
					activity: 'repair'
				});
				apply('finish-repair', {
					actorId: state.master.masterId,
					source: source('system'),
					commandType: 'simulation.advance',
					targetGameTime: repair.scheduled[0]!.dueGameTime
				});
			}
			if (
				index % 5 === 1 &&
				(state.schemaVersion === 2 ||
					state.schemaVersion === 3 ||
					state.schemaVersion === 4 ||
					state.schemaVersion === 5 ||
					state.schemaVersion === 6 ||
					state.schemaVersion === 7 ||
					state.schemaVersion === 8)
			) {
				const bow = Object.values(state.items).find((item) => item.templateId === 'short-bow');
				if (bow) {
					apply('equip-bow', {
						actorId: heroId,
						source: source('manual'),
						commandType: 'hero.equip.item',
						itemId: bow.itemId
					});
				}
			}
		}

		if (index % 7 === 0) {
			apply('injure-hero', {
				actorId: state.master.masterId,
				source: source('system'),
				commandType: 'simulation.apply.damage',
				targetId: heroId,
				amount: 25,
				damageKind: 'hazard'
			});
		}
		if (index % 17 === 0) {
			apply('kill-hero', {
				actorId: state.master.masterId,
				source: source('system'),
				commandType: 'simulation.apply.damage',
				targetId: heroId,
				amount: 100,
				damageKind: 'hazard'
			});
			heroDeathCount += 1;
		}
		if (index % 31 === 0) {
			apply('kill-master', {
				actorId: state.master.masterId,
				source: source('system'),
				commandType: 'simulation.apply.damage',
				targetId: state.master.masterId,
				amount: 100,
				damageKind: 'hazard'
			});
			gameOverCount += 1;
		}

		const replay = replayEventsStrict(events);
		if (replay.snapshot.stateHash !== hashCanonical(state)) {
			throw new Error(`Simulation replay mismatch at sequence ${index}`);
		}
		replayCount += 1;
		digestInput += replay.snapshot.stateHash.slice(0, 8);
	}

	return {
		sequenceCount,
		commandCount,
		replayCount,
		scheduledCount,
		resolvedScheduleCount,
		heroDeathCount,
		gameOverCount,
		invariantFailures: 0,
		finalDigest: hashCanonical(digestInput)
	};
}
