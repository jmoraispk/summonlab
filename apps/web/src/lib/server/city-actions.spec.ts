import { CityActionRequestSchema } from '@summonlab/contracts';
import { createBootstrapEngine, deterministicUuid } from '@summonlab/engine';
import { describe, expect, it } from 'vitest';

import { cityActionCommand } from './city-actions';

const runId = '10000000-0000-4000-8000-000000000001';
const heroId = '00000000-0000-4000-8000-000000000001';

function snapshot() {
	return createBootstrapEngine({
		runId,
		seed: 'city-action-mapping',
		heroId,
		manifestHash: 'a'.repeat(64)
	}).snapshot;
}

describe('City action command mapping', () => {
	it('maps Court training to an authoritative training-ground assignment', () => {
		const current = snapshot();
		const commandId = deterministicUuid('city-training-command');
		const request = CityActionRequestSchema.parse({
			action: 'court-training',
			heroId,
			expectedVersion: current.state.version
		});

		expect(cityActionCommand(current, request, commandId)).toEqual({
			commandId,
			runId,
			actorId: current.state.master.masterId,
			expectedVersion: current.state.version,
			correlationId: commandId,
			source: {
				source: 'manual',
				timing: 'step',
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			},
			commandType: 'settlement.assign.hero',
			heroId,
			buildingId: 'training-ground',
			role: 'trainee'
		});
	});

	it('maps Rest to the dormitory without replacing the client version', () => {
		const current = snapshot();
		const commandId = deterministicUuid('city-rest-command');

		expect(
			cityActionCommand(
				current,
				{ action: 'rest', heroId, expectedVersion: current.state.version + 2 },
				commandId
			)
		).toMatchObject({
			expectedVersion: current.state.version + 2,
			buildingId: 'dormitory',
			role: 'resident'
		});
	});

	it('rejects a hero that does not belong to the run', () => {
		expect(() =>
			cityActionCommand(
				snapshot(),
				{
					action: 'rest',
					heroId: '00000000-0000-4000-8000-000000000099',
					expectedVersion: 0
				},
				deterministicUuid('city-missing-hero-command')
			)
		).toThrow('does not belong');
	});

	it('rejects an inactive hero before commit', () => {
		const current = snapshot();
		if (current.state.schemaVersion !== 13) throw new Error('Expected the campaign schema');
		current.state.heroes[heroId]!.lifeState = 'dead';
		current.state.heroes[heroId]!.health = 0;

		expect(() =>
			cityActionCommand(
				current,
				{ action: 'rest', heroId, expectedVersion: current.state.version },
				deterministicUuid('city-inactive-hero-command')
			)
		).toThrow('not active');
	});
});
