import {
	EngineGameStateSchema,
	type AuthoritativeEvent,
	type EngineCommand
} from '@summonlab/contracts';

import {
	applyCommand,
	createBootstrapEngine,
	hashGameState,
	replayEventsStrict
} from './engine.js';
import { deterministicUuid, hashCanonical } from './hash.js';

function source(source: 'random' | 'manual') {
	return {
		source,
		timing: source === 'random' ? ('continuous' as const) : ('step' as const),
		fallbackPolicy: source === 'random' ? ('random' as const) : null,
		directiveIds: [],
		decisionJobId: null
	};
}

export interface SimulationReport {
	readonly sequenceCount: number;
	readonly commandCount: number;
	readonly replayCount: number;
	readonly invariantFailures: number;
	readonly finalDigest: string;
}

export function simulateFoundation(sequenceCount = 10_000): SimulationReport {
	if (!Number.isSafeInteger(sequenceCount) || sequenceCount < 1) {
		throw new Error('Simulation sequence count must be a positive integer');
	}
	let commandCount = 0;
	let replayCount = 0;
	let digestInput = '';
	for (let index = 0; index < sequenceCount; index += 1) {
		const runId = deterministicUuid(`simulation.run.${index}`);
		const heroId = deterministicUuid(`simulation.hero.${index}`);
		const bootstrap = createBootstrapEngine({
			runId,
			seed: `simulation-seed-${index}`,
			heroId,
			manifestHash: hashCanonical({ heroId })
		});
		let state = bootstrap.snapshot.state;
		const events: AuthoritativeEvent[] = [bootstrap.event];
		const destination = index % 2 === 0 ? 'kitchen' : 'training-ground';
		const commands: EngineCommand[] = [
			{
				commandId: deterministicUuid(`${runId}:choose`),
				runId,
				actorId: heroId,
				expectedVersion: 0,
				correlationId: deterministicUuid(`${runId}:correlation:choose`),
				source: source('random'),
				commandType: 'hero.choose.destination',
				destination,
				firstLine: 'A deterministic simulation choice.',
				storyBranch: destination === 'kitchen' ? 'names-before-orders' : 'steel-before-trust'
			},
			{
				commandId: deterministicUuid(`${runId}:arrive`),
				runId,
				actorId: heroId,
				expectedVersion: 1,
				correlationId: deterministicUuid(`${runId}:correlation:arrive`),
				source: source('manual'),
				commandType: 'hero.arrive'
			},
			...Array.from({ length: index % 4 }, (_, inspectionIndex): EngineCommand => ({
				commandId: deterministicUuid(`${runId}:inspect:${inspectionIndex}`),
				runId,
				actorId: state.master.masterId,
				expectedVersion: 2 + inspectionIndex,
				correlationId: deterministicUuid(`${runId}:correlation:inspect:${inspectionIndex}`),
				source: source('manual'),
				commandType: 'master.inspect.gate'
			}))
		];
		for (const command of commands) {
			const result = applyCommand(state, command);
			state = EngineGameStateSchema.parse(result.state);
			events.push(...result.events);
			commandCount += 1;
		}
		const replay = replayEventsStrict(events);
		if (replay.snapshot.stateHash !== hashGameState(state)) {
			throw new Error(`Simulation replay mismatch at sequence ${index}`);
		}
		replayCount += 1;
		digestInput += replay.snapshot.stateHash.slice(0, 8);
	}
	return {
		sequenceCount,
		commandCount,
		replayCount,
		invariantFailures: 0,
		finalDigest: hashCanonical(digestInput)
	};
}
