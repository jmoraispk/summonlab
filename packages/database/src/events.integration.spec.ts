import { randomUUID } from 'node:crypto';

import { FIRST_OBSERVATION, generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import type { EngineCommand } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { commitEngineCommand, getEngineReplay } from './engine.js';
import {
	getEngineEventHead,
	getEngineEventPage,
	getReturnRecap,
	subscribeToEngineEventCursor
} from './events.js';
import { createProofRun } from './proof.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

describe('reconnect event delivery', () => {
	run('pages exact cursors, publishes commits, detects gaps, and projects a recap', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const draft = await generateCharacterDraft(recipeFromSeed(`events-${randomUUID()}`));
		const runId = randomUUID();
		await createProofRun(databaseUrl, {
			runId,
			draft,
			controlMode: 'wait',
			directive: '',
			firstObservation: FIRST_OBSERVATION,
			choice: null
		});
		const replay = await getEngineReplay(databaseUrl, runId);
		if (!replay) throw new Error('Expected initialized replay');
		const initial = await getEngineEventHead(databaseUrl, runId);
		expect(initial).toMatchObject({ eventCursor: 1, version: 0 });
		const bootstrap = await getEngineEventPage(databaseUrl, runId, 0, 1);
		expect(bootstrap).toMatchObject({ nextCursor: 1, latestCursor: 1, hasMore: false, gap: null });
		expect(bootstrap?.events[0]?.eventType).toBe('run.initialized');

		let notified!: (cursor: number) => void;
		const notification = new Promise<number>((resolve) => {
			notified = resolve;
		});
		const subscription = await subscribeToEngineEventCursor(databaseUrl, runId, notified);
		try {
			const commandId = randomUUID();
			const command: EngineCommand = {
				commandId,
				runId,
				actorId: replay.snapshot.state.master.masterId,
				expectedVersion: 0,
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
			await commitEngineCommand(databaseUrl, command);
			let timeout: ReturnType<typeof setTimeout> | undefined;
			try {
				await expect(
					Promise.race([
						notification,
						new Promise<never>((_, reject) => {
							timeout = setTimeout(() => reject(new Error('Notification timed out')), 5_000);
						})
					])
				).resolves.toBe(2);
			} finally {
				if (timeout) clearTimeout(timeout);
			}
		} finally {
			await subscription.close();
		}

		const next = await getEngineEventPage(databaseUrl, runId, 1);
		expect(next).toMatchObject({ nextCursor: 2, latestCursor: 2, gap: null });
		expect(next?.events.map((event) => event.eventType)).toEqual(['master.gate.inspected']);
		const ahead = await getEngineEventPage(databaseUrl, runId, 3);
		expect(ahead).toMatchObject({ latestCursor: 2, gap: 'cursor_ahead', events: [] });

		const recap = await getReturnRecap(databaseUrl, runId, 1);
		expect(recap).toMatchObject({
			fromCursor: 1,
			toCursor: 2,
			eventCount: 1,
			omittedEventCount: 0
		});
		expect(recap?.highlights[0]?.replayCursor).toBe(2);
		const unchanged = await getReturnRecap(databaseUrl, runId, 2);
		expect(unchanged).toMatchObject({ eventCount: 0, highlights: [] });
	});
});
