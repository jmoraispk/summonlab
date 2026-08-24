import { EngineGameStateSchema, type EngineCommand } from '@summonlab/contracts';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
	applyCommand,
	createBootstrapEngine,
	deterministicUuid,
	replayEventsStrict,
	sha256Hex,
	simulateFoundation
} from './index.js';

describe('engine properties', () => {
	it('preserves schema validity and replay hashes across generated seeds and legal paths', () => {
		fc.assert(
			fc.property(
				fc.string({ minLength: 1, maxLength: 64 }),
				fc.boolean(),
				fc.integer({ min: 0, max: 12 }),
				(seed, kitchen, inspectionCount) => {
					const runId = deterministicUuid(`property.run.${seed}`);
					const heroId = deterministicUuid(`property.hero.${seed}`);
					const bootstrap = createBootstrapEngine({
						runId,
						seed,
						heroId,
						manifestHash: sha256Hex(`manifest:${seed}`)
					});
					const events = [bootstrap.event];
					let state = bootstrap.snapshot.state;
					const destination = kitchen ? 'kitchen' : 'training-ground';
					const choose: EngineCommand = {
						commandId: deterministicUuid(`${runId}:choose`),
						runId,
						actorId: heroId,
						expectedVersion: 0,
						correlationId: deterministicUuid(`${runId}:choose:corr`),
						source: {
							source: 'random',
							timing: 'continuous',
							fallbackPolicy: 'random',
							directiveIds: [],
							decisionJobId: null
						},
						commandType: 'hero.choose.destination',
						destination,
						firstLine: 'Generated property path.',
						storyBranch: kitchen ? 'names-before-orders' : 'steel-before-trust'
					};
					const chosen = applyCommand(state, choose);
					state = EngineGameStateSchema.parse(chosen.state);
					events.push(...chosen.events);
					const travel: EngineCommand = {
						commandId: deterministicUuid(`${runId}:travel`),
						runId,
						actorId: heroId,
						expectedVersion: 1,
						correlationId: deterministicUuid(`${runId}:travel:corr`),
						source: {
							source: 'system',
							timing: null,
							fallbackPolicy: null,
							directiveIds: [],
							decisionJobId: null
						},
						commandType: 'hero.start.travel',
						targetNodeId: kitchen ? 'kitchen-table' : 'training-ring'
					};
					const traveling = applyCommand(state, travel);
					state = EngineGameStateSchema.parse(traveling.state);
					events.push(...traveling.events);
					const arrive: EngineCommand = {
						commandId: deterministicUuid(`${runId}:arrive`),
						runId,
						actorId: state.master.masterId,
						expectedVersion: 2,
						correlationId: deterministicUuid(`${runId}:arrive:corr`),
						source: {
							source: 'system',
							timing: null,
							fallbackPolicy: null,
							directiveIds: [],
							decisionJobId: null
						},
						commandType: 'simulation.advance',
						targetGameTime: traveling.scheduled[0]!.dueGameTime
					};
					const arrived = applyCommand(state, arrive);
					state = EngineGameStateSchema.parse(arrived.state);
					events.push(...arrived.events);
					const commands: EngineCommand[] = [
						...Array.from({ length: inspectionCount }, (_, index): EngineCommand => ({
							commandId: deterministicUuid(`${runId}:inspect:${index}`),
							runId,
							actorId: state.master.masterId,
							expectedVersion: index + 3,
							correlationId: deterministicUuid(`${runId}:inspect:${index}:corr`),
							source: {
								source: 'manual',
								timing: 'step',
								fallbackPolicy: null,
								directiveIds: [],
								decisionJobId: null
							},
							commandType: 'master.inspect.gate'
						}))
					];
					for (const command of commands) {
						const result = applyCommand(state, command);
						state = EngineGameStateSchema.parse(result.state);
						events.push(...result.events);
					}
					const replay = replayEventsStrict(events);
					expect(replay.snapshot.state).toEqual(state);
				}
			),
			{ numRuns: 250 }
		);
	});

	it('runs 10,000 generated survival histories without an invariant failure', () => {
		const report = simulateFoundation(10_000);

		expect(report.sequenceCount).toBe(10_000);
		expect(report.commandCount).toBeGreaterThanOrEqual(40_000);
		expect(report.replayCount).toBe(10_000);
		expect(report.scheduledCount).toBeGreaterThanOrEqual(10_000);
		expect(report.resolvedScheduleCount).toBe(report.scheduledCount);
		expect(report.heroDeathCount).toBeGreaterThan(0);
		expect(report.gameOverCount).toBeGreaterThan(0);
		expect(report.invariantFailures).toBe(0);
	}, 180_000);
});
