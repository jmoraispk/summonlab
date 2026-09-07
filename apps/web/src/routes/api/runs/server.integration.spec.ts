import { recipeFromSeed } from '@summonlab/characters';
import { getEngineSnapshot } from '@summonlab/database';
import { createEntropyCursor, drawInteger } from '@summonlab/engine';
import { describe, expect, it, vi } from 'vitest';

const environment = vi.hoisted(() => ({ databaseUrl: process.env.TEST_DATABASE_URL }));

vi.mock('@summonlab/config', () => ({
	getConfig: () => ({
		databaseUrl: environment.databaseUrl,
		simulationSpeed: 1
	})
}));

import { POST } from './+server.js';

const run = environment.databaseUrl ? it : it.skip;

function initiativeDraws(seed: string): number[] {
	let cursor = createEntropyCursor(seed);
	return Array.from({ length: 16 }, () => {
		const result = drawInteger(cursor, 'initiative-tie-break', 0, 99);
		cursor = result.next;
		return result.draw.value;
	});
}

async function createRun(recipe: ReturnType<typeof recipeFromSeed>) {
	return (await POST({
		request: new Request('http://summonlab.test/api/runs', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ recipe, controlMode: 'wait', directive: '' })
		})
	} as never)) as Response;
}

describe('POST /api/runs production private engine entropy', () => {
	run('makes initiative entropy unreproducible from an identical public recipe', async () => {
		if (!environment.databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const recipe = recipeFromSeed('production-private-engine-seed');
		const [leftResponse, rightResponse] = await Promise.all([createRun(recipe), createRun(recipe)]);
		expect(leftResponse.status).toBe(201);
		expect(rightResponse.status).toBe(201);
		const [leftBody, rightBody] = await Promise.all([leftResponse.json(), rightResponse.json()]);
		const [left, right] = await Promise.all([
			getEngineSnapshot(environment.databaseUrl, leftBody.runId),
			getEngineSnapshot(environment.databaseUrl, rightBody.runId)
		]);
		if (left?.state.schemaVersion !== 25 || right?.state.schemaVersion !== 25) {
			throw new Error('Expected real v25 create-path states');
		}

		expect(left.state.seed).not.toBe(recipe.seed);
		expect(right.state.seed).not.toBe(recipe.seed);
		expect(left.state.seed).not.toBe(right.state.seed);
		expect(initiativeDraws(left.state.seed)).not.toEqual(initiativeDraws(recipe.seed));
		expect(initiativeDraws(right.state.seed)).not.toEqual(initiativeDraws(recipe.seed));
		expect(initiativeDraws(left.state.seed)).not.toEqual(initiativeDraws(right.state.seed));
		expect(JSON.stringify(leftBody)).not.toContain(left.state.seed);
		expect(JSON.stringify(rightBody)).not.toContain(right.state.seed);
	});
});
