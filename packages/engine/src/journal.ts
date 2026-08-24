import {
	JournalEntrySchema,
	RewardDeltaSchema,
	type AuthoritativeEvent,
	type JournalEntry,
	type RewardDelta
} from '@summonlab/contracts';
import { z } from 'zod';

import { deterministicUuid } from './hash.js';

const EventMetadataSchema = z
	.object({
		summary: z.string().min(1).max(1_000).optional(),
		rewardDeltas: z.array(RewardDeltaSchema).optional()
	})
	.passthrough();

const summaries: Readonly<Record<string, string>> = {
	'run.initialized': 'The run began at the summoning gate.',
	'hero.destination.selected': 'A summoned hero selected a first destination.',
	'hero.arrived': 'A summoned hero arrived at the selected destination.',
	'master.gate.inspected': 'The Master inspected the summoning gate.'
};

export function eventSummary(event: AuthoritativeEvent): string {
	const metadata = EventMetadataSchema.safeParse(event.payload);
	return metadata.success && metadata.data.summary
		? metadata.data.summary
		: (summaries[event.eventType] ?? event.eventType.replaceAll('.', ' '));
}

export function eventDeltas(event: AuthoritativeEvent): readonly RewardDelta[] {
	const metadata = EventMetadataSchema.safeParse(event.payload);
	return metadata.success ? (metadata.data.rewardDeltas ?? []) : [];
}

function categoryFor(event: AuthoritativeEvent): JournalEntry['category'] {
	if (event.eventType.includes('died') || event.eventType.includes('damaged')) return 'failure';
	if (event.eventType.includes('destination') || event.eventType.includes('branch')) return 'story';
	if (eventDeltas(event).some((delta) => delta.kind === 'resource')) return 'reward';
	if (eventDeltas(event).some((delta) => ['experience', 'level', 'skill'].includes(delta.kind)))
		return 'progression';
	return 'action';
}

function participantIds(event: AuthoritativeEvent): string[] {
	const result = new Set<string>();
	if (event.actorId) result.add(event.actorId);
	const payload = event.payload as Record<string, unknown>;
	for (const key of ['heroId', 'masterId', 'targetId']) {
		const value = payload[key];
		if (typeof value === 'string') result.add(value);
	}
	return [...result];
}

export function projectJournal(events: readonly AuthoritativeEvent[]): readonly JournalEntry[] {
	return events.map((event) =>
		JournalEntrySchema.parse({
			journalEntryId: deterministicUuid(`${event.eventId}:journal`),
			runId: event.runId,
			eventIds: [event.eventId],
			sequenceStart: event.sequence,
			sequenceEnd: event.sequence,
			gameTime: event.gameTime,
			category: categoryFor(event),
			title: event.eventType.replaceAll('.', ' '),
			summary: eventSummary(event),
			participantIds: participantIds(event),
			deltas: eventDeltas(event),
			source: event.source,
			directionOutcome: event.source.directiveIds.length > 0 ? 'advanced' : null,
			replayCursor: event.sequence
		})
	);
}
