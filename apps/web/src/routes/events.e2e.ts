import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';

const recipe = {
	seed: 'ember-01',
	generationVersion: 'human-v1',
	cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
};

async function readStreamFrame(
	page: Page,
	runId: string,
	afterCursor: number,
	eventName: 'engine-event' | 'cursor-gap',
	lastEventId?: number
) {
	return page.evaluate(
		async ({ runId, afterCursor, eventName, lastEventId }) => {
			const response = await fetch(`/api/runs/${runId}/events?after=${afterCursor}`, {
				headers: lastEventId === undefined ? {} : { 'last-event-id': String(lastEventId) }
			});
			if (!response.ok || !response.body) throw new Error(`Stream failed with ${response.status}`);
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			try {
				while (true) {
					const chunk = await reader.read();
					if (chunk.done) throw new Error(`Stream closed before ${eventName}`);
					buffer += decoder.decode(chunk.value, { stream: true }).replaceAll('\r\n', '\n');
					let boundary = buffer.indexOf('\n\n');
					while (boundary >= 0) {
						const raw = buffer.slice(0, boundary);
						buffer = buffer.slice(boundary + 2);
						const lines = raw.split('\n');
						const name = lines.find((line) => line.startsWith('event: '))?.slice(7);
						if (name === eventName) {
							const data = lines.find((line) => line.startsWith('data: '))?.slice(6);
							if (!data) throw new Error(`Stream ${eventName} frame had no data`);
							return JSON.parse(data) as Record<string, unknown>;
						}
						boundary = buffer.indexOf('\n\n');
					}
				}
			} finally {
				await reader.cancel();
			}
		},
		{ runId, afterCursor, eventName, lastEventId }
	);
}

test('streams exact events, resumes Last-Event-ID, and reports cursor gaps', async ({
	page,
	request
}) => {
	await page.goto('/');
	const createdResponse = await request.post('/api/runs', {
		data: { recipe, controlMode: 'wait', directive: '' }
	});
	expect(createdResponse.status()).toBe(201);
	const created = (await createdResponse.json()) as { runId: string };
	let replay = (await request
		.get(`/api/dev/replays/${created.runId}`)
		.then((response) => response.json())) as {
		snapshot: { state: { master: { masterId: string }; version: number; eventCursor: number } };
	};
	const initialCursor = replay.snapshot.state.eventCursor;

	const commitInspection = async () => {
		const commandId = randomUUID();
		const response = await request.post(`/api/runs/${created.runId}/commands`, {
			data: {
				commandId,
				runId: created.runId,
				actorId: replay.snapshot.state.master.masterId,
				expectedVersion: replay.snapshot.state.version,
				correlationId: commandId,
				source: {
					source: 'manual',
					timing: 'step',
					fallbackPolicy: null,
					directiveIds: [],
					decisionJobId: null
				},
				commandType: 'master.inspect.gate'
			}
		});
		expect(response.ok()).toBe(true);
		replay = (await request
			.get(`/api/dev/replays/${created.runId}`)
			.then((result) => result.json())) as typeof replay;
	};

	await commitInspection();
	const first = await readStreamFrame(page, created.runId, initialCursor, 'engine-event');
	expect(first).toMatchObject({ sequence: initialCursor + 1, eventType: 'master.gate.inspected' });

	await commitInspection();
	const resumed = await readStreamFrame(
		page,
		created.runId,
		initialCursor,
		'engine-event',
		initialCursor + 1
	);
	expect(resumed).toMatchObject({
		sequence: initialCursor + 2,
		eventType: 'master.gate.inspected'
	});

	const gap = await readStreamFrame(page, created.runId, initialCursor + 100, 'cursor-gap');
	expect(gap).toMatchObject({
		runId: created.runId,
		latestCursor: initialCursor + 2,
		reason: 'cursor_ahead'
	});
});

test('refreshes the living settlement from an ordered world event', async ({ page, request }) => {
	const createdResponse = await request.post('/api/runs', {
		data: { recipe, controlMode: 'autonomous', directive: '' }
	});
	expect(createdResponse.status()).toBe(201);
	const created = (await createdResponse.json()) as { runId: string };
	const arrival = await request.post(`/api/runs/${created.runId}/arrive`, { data: {} });
	expect(arrival.ok()).toBe(true);

	await page.goto(`/play/${created.runId}`);
	const scene = page.getByTestId('living-settlement');
	await expect(scene).toBeVisible();
	await expect(scene).toHaveAttribute('data-day-phase', 'night');
	await expect(scene).toHaveAttribute('data-hero-pose', 'idle');
	await expect(page.getByTestId('run-connection')).toContainText('Live');

	const replay = (await request
		.get(`/api/dev/replays/${created.runId}`)
		.then((response) => response.json())) as {
		snapshot: {
			state: { master: { masterId: string }; version: number; eventCursor: number };
		};
	};
	const commandId = randomUUID();
	const committed = await request.post(`/api/runs/${created.runId}/commands`, {
		data: {
			commandId,
			runId: created.runId,
			actorId: replay.snapshot.state.master.masterId,
			expectedVersion: replay.snapshot.state.version,
			correlationId: commandId,
			source: {
				source: 'manual',
				timing: 'step',
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			},
			commandType: 'master.inspect.gate'
		}
	});
	expect(committed.ok()).toBe(true);
	await expect(
		page.getByText(`World event #${replay.snapshot.state.eventCursor + 1}`)
	).toBeVisible();
	await expect(scene).toHaveAttribute(
		'data-event-cursor',
		String(replay.snapshot.state.eventCursor + 1)
	);
});
