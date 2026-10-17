import { expect, test, type APIRequestContext } from '@playwright/test';
import type {
	EngineGameStateV15,
	MissionLifecycleRequest,
	MissionRoundV3,
	MissionRunStateV5
} from '@summonlab/contracts';

async function createIronMoon(request: APIRequestContext) {
	const response = await request.post('/api/dev/iron-moon-runs');
	expect(response.status()).toBe(201);
	return (await response.json()) as { runId: string };
}

async function missionAction(
	request: APIRequestContext,
	runId: string,
	data: MissionLifecycleRequest
) {
	const response = await request.post(`/api/runs/${runId}/mission`, { data });
	const receipt = await response.json();
	expect(response.status(), JSON.stringify(receipt)).toBe(200);
	return receipt as { mission: MissionRunStateV5; round: MissionRoundV3 | null };
}

async function replayIronMoon(request: APIRequestContext, runId: string) {
	const response = await request.get(`/api/dev/replays/${runId}`);
	expect(response.ok()).toBe(true);
	const replay = (await response.json()) as {
		verified: boolean;
		hashMatchesPersistedSnapshot: boolean;
		snapshot: { state: EngineGameStateV15; stateHash: string };
	};
	expect(replay.verified).toBe(true);
	expect(replay.hashMatchesPersistedSnapshot).toBe(true);
	expect(replay.snapshot.state.schemaVersion).toBe(15);
	return replay.snapshot;
}

test('launches the development fixture and gives the summoned hero an independent portal decision', async ({
	page,
	request
}) => {
	const campaign = await request.post('/api/campaigns', {
		data: { seed: 'iron-moon-launch-check', controlMode: 'wait' }
	});
	expect(campaign.status()).toBe(201);
	await page.goto('/iron-moon');
	await expect(page.getByRole('heading', { name: /Iron Moon/ })).toBeVisible();
	const creation = page.waitForResponse(
		(response) =>
			response.url().endsWith('/api/dev/iron-moon-runs') && response.request().method() === 'POST'
	);
	await page.getByTestId('open-iron-moon').click();
	const created = await creation;
	expect(created.status()).toBe(201);
	const { runId } = (await created.json()) as { runId: string };
	// The current Tower shell sends an incomplete campaign introduction back to the Village.
	await expect(page).toHaveURL('/village');
	const runResponse = await request.get(`/api/runs/${runId}`);
	expect(runResponse.ok()).toBe(true);
	const run = (await runResponse.json()) as { manifest: { characterId: string } };
	const heroId = run.manifest.characterId;
	await missionAction(request, runId, { action: 'prepare', heroIds: [heroId] });
	await missionAction(request, runId, { action: 'deploy' });
	const receipt = await missionAction(request, runId, {
		action: 'resolve-turn',
		masterActionId: 'mission.move.gate-to-shelf'
	});
	expect(receipt.round?.roundNumber).toBe(1);
	expect(receipt.round?.actions).toHaveLength(2);
	expect(receipt.round?.actions).toContainEqual(
		expect.objectContaining({ actorKind: 'master', choiceSource: 'manual' })
	);
	expect(receipt.round?.actions).toContainEqual(
		expect.objectContaining({
			actorId: heroId,
			actorKind: 'hero',
			choiceSource: 'scripted',
			policyId: expect.any(String),
			packetHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
			legalActionHash: expect.stringMatching(/^[0-9a-f]{64}$/u),
			policyResultHash: expect.stringMatching(/^[0-9a-f]{64}$/u)
		})
	);
	const persisted = await replayIronMoon(request, runId);
	expect(persisted.state.mission.attempt?.turnState.rounds.at(-1)).toEqual(receipt.round);
});

test('mines finite Iron Moon ore and credits it only after extraction', async ({ request }) => {
	const { runId } = await createIronMoon(request);
	await missionAction(request, runId, { action: 'prepare', heroIds: [] });
	const deployed = await missionAction(request, runId, { action: 'deploy' });
	expect(deployed.mission.attempt?.turnState.portal).toMatchObject({
		roundsRemaining: 8,
		extractedAmount: 0,
		extractionCredited: false
	});
	expect((await replayIronMoon(request, runId)).state.settlement.resources['iron-ore']).toBe(2);

	for (const [index, masterActionId] of [
		'mission.move.gate-to-shelf',
		'mission.move.shelf-to-crater-heart',
		'mission.mine.crater-heart-deposit',
		'mission.mine.crater-heart-deposit',
		'mission.move.shelf-to-crater-heart',
		'mission.move.gate-to-shelf'
	].entries()) {
		const receipt = await missionAction(request, runId, { action: 'resolve-turn', masterActionId });
		expect(receipt.round?.roundNumber).toBe(index + 1);
	}

	const returned = await replayIronMoon(request, runId);
	expect(returned.state.mission.attempt).toMatchObject({
		status: 'extraction',
		turnState: {
			objective: { status: 'delivered', minedAmount: 4, quota: 4 },
			portal: {
				roundsRemaining: 2,
				extractionCredited: false,
				deposits: { 'crater-heart-deposit': { initialAmount: 4, remainingAmount: 0 } }
			}
		}
	});
	expect(returned.state.settlement.resources['iron-ore']).toBe(2);
	const extracted = await missionAction(request, runId, { action: 'extract' });
	expect(extracted.mission.attempt).toMatchObject({
		status: 'success',
		turnState: { portal: { extractedAmount: 4, extractionCredited: true } }
	});
	const persisted = await replayIronMoon(request, runId);
	expect(persisted.state.settlement.resources['iron-ore']).toBe(6);
	expect(persisted.state.settlement.resourceLedger.at(-1)).toMatchObject({
		resource: 'iron-ore',
		before: 2,
		after: 6,
		delta: 4,
		reason: 'Iron Moon portal extraction'
	});
	expect(
		persisted.state.mission.attempt?.turnState.portal.oreLedger.map((entry) => entry.kind)
	).toEqual(['mined', 'mined', 'extracted']);
	expect((await replayIronMoon(request, runId)).stateHash).toBe(persisted.stateHash);
});
