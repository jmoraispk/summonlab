import {
	ReturnRecapSchema,
	type AuthoritativeEvent,
	type ReturnRecap,
	type ReturnRecapCounts,
	type ReturnRecapDelta
} from '@summonlab/contracts';

import { eventDeltas, projectJournal } from './journal.js';
import { gameMinutesBetween } from './time.js';

export interface ReturnRecapAggregate {
	readonly eventCount: number;
	readonly counts: ReturnRecapCounts;
	readonly deltas: readonly ReturnRecapDelta[];
}

export interface ReturnRecapInput {
	readonly runId: string;
	readonly fromCursor: number;
	readonly toCursor: number;
	readonly fromGameTime: string | null;
	readonly toGameTime: string;
	readonly candidateEvents: readonly AuthoritativeEvent[];
	readonly aggregate: ReturnRecapAggregate;
}

function eventPriority(event: AuthoritativeEvent): number {
	if (event.eventType.endsWith('.died')) return 100;
	if (event.eventType.endsWith('.damaged')) return 90;
	if (eventDeltas(event).length > 0) return 80;
	if (event.eventType === 'simulation.advanced') return 70;
	if (event.eventType === 'hero.daily.plan.created') return 60;
	if (event.eventType === 'hero.routine.started') return 50;
	if (event.eventType === 'hero.travel.started') return 40;
	if (event.eventType === 'simulation.clock.synced') return 0;
	return 20;
}

function selectHighlights(events: readonly AuthoritativeEvent[]) {
	const ranked = [...events].sort(
		(left, right) => eventPriority(right) - eventPriority(left) || right.sequence - left.sequence
	);
	const selected: AuthoritativeEvent[] = [];
	const typeCounts = new Map<string, number>();
	for (const event of ranked) {
		if ((typeCounts.get(event.eventType) ?? 0) >= 2) continue;
		selected.push(event);
		typeCounts.set(event.eventType, (typeCounts.get(event.eventType) ?? 0) + 1);
		if (selected.length === 6) break;
	}
	selected.sort((left, right) => left.sequence - right.sequence);
	return projectJournal(selected);
}

function headlineFor(aggregate: ReturnRecapAggregate): string {
	if (aggregate.eventCount === 0) return 'Hearth 01 held its course.';
	if (aggregate.counts.failures > 0) return 'Something changed the settlement’s balance.';
	if (aggregate.counts.routinesCompleted >= 4) return 'A full settlement day unfolded.';
	if (aggregate.counts.routinesCompleted > 0) return 'Life continued inside the walls.';
	return 'Hearth 01 moved while you were away.';
}

function summaryFor(input: ReturnRecapInput, spanGameMinutes: number): string {
	if (input.aggregate.eventCount === 0) {
		return 'No authoritative events were committed after your last observed cursor.';
	}
	const parts = [`${input.aggregate.eventCount} authoritative changes`];
	if (spanGameMinutes >= 60)
		parts.push(`across ${Math.round((spanGameMinutes / 60) * 10) / 10} game hours`);
	else if (spanGameMinutes > 0) parts.push(`across ${spanGameMinutes} game minutes`);
	const activityParts = [
		input.aggregate.counts.routinesCompleted > 0
			? `${input.aggregate.counts.routinesCompleted} routines completed`
			: null,
		input.aggregate.counts.activitiesCompleted > 0
			? `${input.aggregate.counts.activitiesCompleted} activities resolved`
			: null,
		input.aggregate.counts.travelArrivals > 0
			? `${input.aggregate.counts.travelArrivals} arrivals`
			: null
	].filter((part): part is string => Boolean(part));
	const base = `${parts.join(' ')}.`;
	return activityParts.length > 0 ? `${base} ${activityParts.join(' · ')}.` : base;
}

export function projectReturnRecap(input: ReturnRecapInput): ReturnRecap {
	const spanGameMinutes = input.fromGameTime
		? Math.max(0, Math.floor(gameMinutesBetween(input.fromGameTime, input.toGameTime)))
		: 0;
	const highlights = selectHighlights(input.candidateEvents);
	return ReturnRecapSchema.parse({
		runId: input.runId,
		fromCursor: input.fromCursor,
		toCursor: input.toCursor,
		fromGameTime: input.fromGameTime,
		toGameTime: input.toGameTime,
		spanGameMinutes,
		eventCount: input.aggregate.eventCount,
		omittedEventCount: Math.max(0, input.aggregate.eventCount - highlights.length),
		headline: headlineFor(input.aggregate),
		summary: summaryFor(input, spanGameMinutes),
		counts: input.aggregate.counts,
		deltas: input.aggregate.deltas,
		highlights
	});
}
