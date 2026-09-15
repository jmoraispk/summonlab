import { expect, test } from '@playwright/test';

const emberRecipe = {
	seed: 'ember-01',
	generationVersion: 'human-v1',
	cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
};

test('replays the same seeded-random identity and first choice', async ({ request }) => {
	const create = () =>
		request.post('/api/runs', {
			data: { recipe: emberRecipe, controlMode: 'random', directive: '' }
		});
	const [leftResponse, rightResponse] = await Promise.all([create(), create()]);
	expect(leftResponse.status()).toBe(201);
	expect(rightResponse.status()).toBe(201);
	const leftCreated = (await leftResponse.json()) as { runId: string; manifestHash: string };
	const rightCreated = (await rightResponse.json()) as { runId: string; manifestHash: string };
	const [left, right] = await Promise.all([
		request.get(`/api/runs/${leftCreated.runId}`).then((response) => response.json()),
		request.get(`/api/runs/${rightCreated.runId}`).then((response) => response.json())
	]);

	expect(leftCreated.manifestHash).toBe(rightCreated.manifestHash);
	expect(left.manifest).toEqual(right.manifest);
	expect(left.mind).toEqual(right.mind);
	expect(left.destination).toBe(right.destination);
	expect(left.storyBranch).toBe(right.storyBranch);
});

test('retains witnessed communication, replies, directives, and redacted decisions without the legacy summon page', async ({
	request
}) => {
	const created = await request.post('/api/runs', {
		data: { recipe: emberRecipe, controlMode: 'wait', directive: '' }
	});
	expect(created.status()).toBe(201);
	const { runId } = (await created.json()) as { runId: string };
	const runResponse = await request.get(`/api/runs/${runId}`);
	expect(runResponse.ok()).toBe(true);
	const run = (await runResponse.json()) as { manifest: { characterId: string } };
	const heroId = run.manifest.characterId;

	const communication = await request.post(`/api/runs/${runId}/communications`, {
		data: {
			targetHeroId: heroId,
			kind: 'explain',
			topic: 'tower-mission',
			exactText: 'The tower is real, but how we climb it is not yet written.',
			tone: 'reassuring',
			delivery: 'private'
		}
	});
	expect(communication.ok()).toBe(true);
	const communicationView = (await communication.json()) as {
		acts: ReadonlyArray<{ exactText: string; witnesses: readonly unknown[] }>;
	};
	expect(communicationView.acts.at(-1)).toMatchObject({
		exactText: 'The tower is real, but how we climb it is not yet written.'
	});
	expect(communicationView.acts.at(-1)?.witnesses.length).toBeGreaterThan(0);

	const conversation = await request.post(`/api/runs/${runId}/conversations`, {
		data: {
			targetHeroId: heroId,
			kind: 'ask',
			exactText: 'What do you need before we enter the tower?',
			tone: 'reassuring',
			delivery: 'private',
			orderIntent: null
		}
	});
	expect(conversation.ok()).toBe(true);
	const conversationView = (await conversation.json()) as {
		turns: ReadonlyArray<{ heroResponse: { exactText: string } }>;
	};
	expect(conversationView.turns.at(-1)?.heroResponse.exactText.length).toBeGreaterThan(0);

	const directive = await request.post(`/api/runs/${runId}/directives`, {
		data: {
			action: 'issue',
			text: 'Protect the company and prepare for the tower.',
			scope: 'until_revoked',
			recipientIds: [heroId],
			priorities: ['protect', 'prepare'],
			tone: 'firm',
			delivery: 'private'
		}
	});
	expect(directive.ok()).toBe(true);
	const directiveView = (await directive.json()) as {
		directives: ReadonlyArray<{ text: string; witnessObservationIds: readonly string[] }>;
	};
	expect(directiveView.directives.at(-1)).toMatchObject({
		text: 'Protect the company and prepare for the tower.'
	});
	expect(directiveView.directives.at(-1)?.witnessObservationIds.length).toBeGreaterThan(0);

	const preview = await request.get(`/api/runs/${runId}/decision-preview?heroId=${heroId}`);
	expect(preview.ok()).toBe(true);
	const previewView = (await preview.json()) as {
		packet: {
			activeDirectives: ReadonlyArray<{ text: string }>;
			knowledge: unknown;
			legalActions: readonly unknown[];
		};
	};
	expect(previewView.packet.activeDirectives).toContainEqual(
		expect.objectContaining({ text: 'Protect the company and prepare for the tower.' })
	);
	expect(previewView.packet.legalActions.length).toBeGreaterThan(0);
	expect(JSON.stringify(previewView.packet.knowledge)).toContain('tower');
});
