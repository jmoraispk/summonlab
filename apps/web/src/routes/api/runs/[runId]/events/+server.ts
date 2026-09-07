import { getConfig } from '@summonlab/config';
import { EngineCursorGapSchema, EngineStreamReadySchema } from '@summonlab/contracts';
import {
	catchUpRun,
	getEngineEventHead,
	getEngineEventPage,
	getSimulationClock,
	subscribeToEngineEventCursor
} from '@summonlab/database';
import { json } from '@sveltejs/kit';

import { projectEngineEventForPublic } from '$lib/server/public-engine-presentation';

import type { RequestHandler } from './$types';

const HEARTBEAT_MS = 15_000;
const encoder = new TextEncoder();

function parseCursor(value: string | null): number | null {
	if (value === null || !/^\d+$/u.test(value)) return value === null ? 0 : null;
	const cursor = Number(value);
	return Number.isSafeInteger(cursor) ? cursor : null;
}

function frame(event: string, data: unknown, id?: number): Uint8Array {
	return encoder.encode(
		`${id === undefined ? '' : `id: ${id}\n`}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
	);
}

export const GET: RequestHandler = async ({ params, request, url }) => {
	const requested = parseCursor(
		request.headers.get('last-event-id') ?? url.searchParams.get('after')
	);
	if (requested === null) {
		return json({ message: 'The event cursor must be a nonnegative integer.' }, { status: 400 });
	}
	const config = getConfig();
	const clock = await getSimulationClock(config.databaseUrl, params.runId).catch(() => null);
	if (clock && clock.backlogGameMinutes >= 1) {
		await catchUpRun(config.databaseUrl, params.runId, { owner: 'sse-reconnect' }).catch(
			() => null
		);
	}
	const head = await getEngineEventHead(config.databaseUrl, params.runId).catch(() => null);
	if (!head) return json({ message: 'Engine run not found.' }, { status: 404 });

	let wakePending = false;
	let wake = () => {
		wakePending = true;
	};
	const subscription = await subscribeToEngineEventCursor(config.databaseUrl, params.runId, () =>
		wake()
	);
	let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
	let heartbeat: ReturnType<typeof setInterval> | null = null;
	let currentCursor = requested;
	let flushing = false;
	let rerun = false;
	let closed = false;

	const close = async () => {
		if (closed) return;
		closed = true;
		if (heartbeat) clearInterval(heartbeat);
		heartbeat = null;
		await subscription.close();
		try {
			controller?.close();
		} catch {
			// The browser may already have canceled the stream.
		}
		controller = null;
	};

	const flush = async () => {
		if (closed || !controller) return;
		if (flushing) {
			rerun = true;
			return;
		}
		flushing = true;
		try {
			do {
				rerun = false;
				while (!closed) {
					const page = await getEngineEventPage(config.databaseUrl, params.runId, currentCursor);
					if (!page) {
						await close();
						return;
					}
					if (page.gap) {
						controller.enqueue(
							frame(
								'cursor-gap',
								EngineCursorGapSchema.parse({
									runId: params.runId,
									requestedAfter: currentCursor,
									latestCursor: page.latestCursor,
									reason: page.gap
								})
							)
						);
						await close();
						return;
					}
					for (const event of page.events) {
						controller.enqueue(
							frame('engine-event', projectEngineEventForPublic(event), event.sequence)
						);
						currentCursor = event.sequence;
					}
					if (!page.hasMore) break;
				}
			} while (rerun && !closed);
		} catch {
			if (!closed && controller) {
				controller.enqueue(frame('stream-error', { message: 'Event delivery interrupted.' }));
			}
			await close();
		} finally {
			flushing = false;
		}
	};

	const stream = new ReadableStream<Uint8Array>({
		start(streamController) {
			controller = streamController;
			controller.enqueue(encoder.encode('retry: 1000\n\n'));
			controller.enqueue(
				frame(
					'ready',
					EngineStreamReadySchema.parse({
						runId: params.runId,
						afterCursor: requested,
						latestCursor: head.eventCursor,
						heartbeatMs: HEARTBEAT_MS
					})
				)
			);
			heartbeat = setInterval(() => {
				if (!closed && controller) controller.enqueue(encoder.encode(': heartbeat\n\n'));
			}, HEARTBEAT_MS);
			heartbeat.unref?.();
			wake = () => void flush();
			if (wakePending) wakePending = false;
			void flush();
			request.signal.addEventListener('abort', () => void close(), { once: true });
		},
		cancel() {
			return close();
		}
	});

	return new Response(stream, {
		headers: {
			'cache-control': 'no-store, no-transform',
			connection: 'keep-alive',
			'content-type': 'text/event-stream; charset=utf-8',
			'x-accel-buffering': 'no'
		}
	});
};
