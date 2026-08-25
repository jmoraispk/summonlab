import {
	JournalEntrySchema,
	DirectiveInfluenceRecordSchema,
	PlayerJournalReportSchema,
	RewardDeltaSchema,
	type AuthoritativeEvent,
	type JournalEntry,
	type PlayerJournalAction,
	type PlayerJournalDirection,
	type PlayerJournalEntry,
	type PlayerJournalFacet,
	type PlayerJournalMissionContext,
	type PlayerJournalPartyProgressDelta,
	type PlayerJournalPartyProgressKind,
	type PlayerJournalPartyTotals,
	type PlayerJournalReport,
	type PlayerJournalStoryChange,
	type RewardDelta
} from '@summonlab/contracts';
import { z } from 'zod';

import { deterministicUuid, hashCanonical } from './hash.js';

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
	if (event.eventType === 'master.safety.stopped') return 'failure';
	if (event.eventType.startsWith('master.')) return 'control';
	if (event.eventType.startsWith('social.')) return 'social';
	if (
		event.eventType.startsWith('story.') ||
		event.eventType.includes('destination') ||
		event.eventType.includes('branch')
	)
		return 'story';
	if (eventDeltas(event).some((delta) => delta.kind === 'resource')) return 'reward';
	if (eventDeltas(event).some((delta) => ['experience', 'level', 'skill'].includes(delta.kind)))
		return 'progression';
	if (event.eventType === 'mission.round.resolved') return 'combat';
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
	const act = payload.communicativeAct;
	if (act && typeof act === 'object') {
		const candidate = act as {
			speakerId?: unknown;
			intendedAudienceIds?: unknown;
			witnesses?: unknown;
		};
		if (typeof candidate.speakerId === 'string') result.add(candidate.speakerId);
		if (Array.isArray(candidate.intendedAudienceIds)) {
			for (const value of candidate.intendedAudienceIds) {
				if (typeof value === 'string') result.add(value);
			}
		}
		if (Array.isArray(candidate.witnesses)) {
			for (const witness of candidate.witnesses) {
				if (
					witness &&
					typeof witness === 'object' &&
					'heroId' in witness &&
					typeof witness.heroId === 'string'
				) {
					result.add(witness.heroId);
				}
			}
		}
	}
	const conversationTurn = payload.conversationTurn;
	if (conversationTurn && typeof conversationTurn === 'object') {
		for (const key of ['masterId', 'heroId']) {
			if (
				key in conversationTurn &&
				typeof (conversationTurn as Record<string, unknown>)[key] === 'string'
			) {
				result.add((conversationTurn as Record<string, string>)[key]!);
			}
		}
	}
	const mission = record(payload.mission) ?? record(record(payload.initialState)?.mission);
	const attempt = record(mission?.attempt);
	const party = record(attempt?.party);
	for (const value of stringArray(party?.memberIds)) result.add(value);
	const round = record(payload.round);
	for (const action of arrayRecords(round?.actions)) {
		if (typeof action.actorId === 'string') result.add(action.actorId);
	}
	return [...result];
}

function directionOutcome(event: AuthoritativeEvent): JournalEntry['directionOutcome'] {
	const parsed = z
		.array(DirectiveInfluenceRecordSchema)
		.safeParse(event.payload.directiveInfluences);
	if (!parsed.success || parsed.data.length === 0) return null;
	if (parsed.data.some((influence) => influence.outcome === 'conflicted')) return 'conflicted';
	if (parsed.data.some((influence) => influence.outcome === 'unavailable')) return 'unavailable';
	return 'advanced';
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
			directionOutcome: directionOutcome(event),
			replayCursor: event.sequence
		})
	);
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as JsonRecord)
		: null;
}

function arrayRecords(value: unknown): JsonRecord[] {
	return Array.isArray(value)
		? value.map(record).filter((item): item is JsonRecord => item !== null)
		: [];
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === 'string')
		: [];
}

function numberValue(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function missionRecord(event: AuthoritativeEvent): JsonRecord | null {
	const payload = event.payload as JsonRecord;
	return record(payload.mission);
}

function floorForMission(missionId: string): number | null {
	const match = /^tower-floor-(\d{2})$/u.exec(missionId);
	return match ? Number(match[1]) : null;
}

function missionContext(event: AuthoritativeEvent): PlayerJournalMissionContext | null {
	const mission = missionRecord(event);
	const binding = record(mission?.binding);
	if (typeof binding?.missionId !== 'string') return null;
	const attempt = record(mission?.attempt);
	const party = record(attempt?.party);
	const turnState = record(attempt?.turnState);
	const status = typeof attempt?.status === 'string' ? attempt.status : null;
	return {
		missionId: binding.missionId,
		floor: floorForMission(binding.missionId),
		attemptId: typeof attempt?.attemptId === 'string' ? attempt.attemptId : null,
		attemptOrdinal: numberValue(attempt?.ordinal),
		roundNumber: numberValue(turnState?.roundNumber),
		status: status as PlayerJournalMissionContext['status'],
		partyMemberIds: stringArray(party?.memberIds),
		completedObjectiveIds: stringArray(attempt?.completedObjectiveIds),
		discoveryIds: stringArray(record(attempt?.knowledge)?.discoveryIds)
	};
}

function defeatedThreatCount(event: AuthoritativeEvent): number {
	const mission = missionRecord(event);
	const monsters = record(record(record(mission?.attempt)?.turnState)?.monsters);
	return monsters
		? Object.values(monsters).filter((monster) => record(monster)?.status === 'defeated').length
		: 0;
}

function evidenceKeys(event: AuthoritativeEvent): string[] {
	const evidence = record(missionRecord(event)?.evidence);
	if (!evidence) return [];
	return Object.values(evidence)
		.map((item) => record(item)?.evidenceKey)
		.filter((item): item is string => typeof item === 'string')
		.sort((left, right) => left.localeCompare(right));
}

function dayNumber(gameTime: string, startedAt: number): number {
	return 1 + Math.max(0, Math.floor((Date.parse(gameTime) - startedAt) / 86_400_000));
}

function activeMissionContext(
	context: PlayerJournalMissionContext | null
): PlayerJournalMissionContext | null {
	return context?.status &&
		!['success', 'failure', 'retreat', 'canceled', 'death'].includes(context.status)
		? context
		: null;
}

function choiceSource(value: unknown): PlayerJournalAction['decisionSource'] {
	return ['manual', 'random', 'scripted', 'model'].includes(String(value))
		? (value as PlayerJournalAction['decisionSource'])
		: 'system';
}

function actorKind(
	actorId: string,
	context: PlayerJournalMissionContext | null,
	masterId: string | null,
	heroIds: ReadonlySet<string>
): PlayerJournalAction['actorKind'] {
	if (actorId === masterId) return 'master';
	if (heroIds.has(actorId) || context?.partyMemberIds.includes(actorId)) return 'hero';
	return 'system';
}

function eventActions(
	event: AuthoritativeEvent,
	context: PlayerJournalMissionContext | null,
	masterId: string | null,
	heroIds: ReadonlySet<string>
): PlayerJournalAction[] {
	const payload = event.payload as JsonRecord;
	const round = record(payload.round);
	const actions: PlayerJournalAction[] = [];
	for (const action of arrayRecords(round?.actions)) {
		if (typeof action.actorId !== 'string' || typeof action.actionId !== 'string') continue;
		actions.push({
			actorId: action.actorId,
			actorKind:
				action.actorKind === 'master' || action.actorKind === 'hero'
					? action.actorKind
					: actorKind(action.actorId, context, masterId, heroIds),
			actionId: action.actionId,
			decisionSource:
				action.actorId === masterId ? event.source.source : choiceSource(action.choiceSource),
			policyId: typeof action.policyId === 'string' ? action.policyId : null,
			publicIntent:
				typeof action.publicIntent === 'string'
					? action.publicIntent
					: typeof action.summary === 'string'
						? action.summary
						: action.actionId,
			outcome: action.outcome === 'superseded' ? 'superseded' : 'applied'
		});
	}
	for (const action of arrayRecords(round?.monsterActions)) {
		if (typeof action.monsterId !== 'string' || typeof action.actionId !== 'string') continue;
		actions.push({
			actorId: action.monsterId,
			actorKind: 'monster',
			actionId: action.actionId,
			decisionSource: 'system',
			policyId: typeof action.policyId === 'string' ? action.policyId : null,
			publicIntent: typeof action.summary === 'string' ? action.summary : action.actionId,
			outcome: action.outcome === 'superseded' ? 'superseded' : 'applied'
		});
	}
	if (actions.length === 0 && event.actorId) {
		actions.push({
			actorId: event.actorId,
			actorKind: actorKind(event.actorId, context, masterId, heroIds),
			actionId: event.eventType,
			decisionSource: event.source.source,
			policyId: null,
			publicIntent: eventSummary(event),
			outcome: 'recorded'
		});
	}
	return actions;
}

function directiveInfluenceMap(event: AuthoritativeEvent) {
	const parsed = z
		.array(DirectiveInfluenceRecordSchema)
		.safeParse(event.payload.directiveInfluences);
	return new Map(
		(parsed.success ? parsed.data : []).map((influence) => [influence.directiveId, influence])
	);
}

function eventDirections(
	event: AuthoritativeEvent,
	directives: Map<string, { text: string; priorities: string[] }>
): PlayerJournalDirection[] {
	const payload = event.payload as JsonRecord;
	const changedDirective = record(payload.directive);
	if (
		typeof changedDirective?.directiveId === 'string' &&
		typeof changedDirective.text === 'string'
	) {
		directives.set(changedDirective.directiveId, {
			text: changedDirective.text,
			priorities: stringArray(changedDirective.priorities)
		});
	}
	const influences = directiveInfluenceMap(event);
	const results: PlayerJournalDirection[] = [];
	const directiveIds = new Set([
		...event.source.directiveIds,
		...(typeof changedDirective?.directiveId === 'string' ? [changedDirective.directiveId] : [])
	]);
	for (const directionId of directiveIds) {
		const known = directives.get(directionId);
		if (!known) continue;
		const influence = influences.get(directionId);
		const status = changedDirective?.directiveId === directionId ? changedDirective.status : null;
		results.push({
			directionId,
			kind: 'directive',
			text: known.text,
			priorities: known.priorities,
			outcome: influence
				? influence.outcome
				: status === 'expired' || status === 'revoked' || status === 'replaced'
					? 'unavailable'
					: 'not-evaluated',
			rationale: influence?.rationale ?? `Directive status: ${String(status ?? 'active')}.`
		});
	}

	const resolution = record(payload.decisionResolution);
	const control = record(payload.masterControl);
	const fallback =
		record(resolution?.fallback) ??
		(event.eventType === 'master.fallback.changed' ? record(control?.fallback) : null);
	if (typeof fallback?.directionId === 'string' && typeof fallback.directionText === 'string') {
		const selection = record(resolution?.fallbackSelection);
		const resolutionOutcome = typeof resolution?.outcome === 'string' ? resolution.outcome : null;
		const outcome: PlayerJournalDirection['outcome'] =
			resolutionOutcome === 'safety-stopped'
				? 'safety-stopped'
				: selection?.classification === 'unclassified'
					? 'unclassified'
					: resolutionOutcome === 'fallback'
						? 'selected'
						: resolutionOutcome === 'paused'
							? 'paused'
							: resolutionOutcome === 'mission-ended'
								? 'mission-ended'
								: 'not-evaluated';
		results.push({
			directionId: fallback.directionId,
			kind: 'fallback',
			text: fallback.directionText,
			priorities: stringArray(fallback.priorities),
			outcome,
			rationale:
				typeof selection?.explanation === 'string'
					? selection.explanation
					: event.eventType === 'master.fallback.changed'
						? 'The Master bound a new fallback doctrine.'
						: `Fallback outcome: ${resolutionOutcome ?? 'not evaluated'}.`
		});
	}
	return results;
}

function pushStoryChange(
	changes: PlayerJournalStoryChange[],
	kind: PlayerJournalStoryChange['kind'],
	key: string,
	before: string | null,
	after: string,
	summary: string
) {
	changes.push({ kind, key, before, after, summary });
}

function eventStoryChanges(
	event: AuthoritativeEvent,
	context: PlayerJournalMissionContext | null,
	previousContext: PlayerJournalMissionContext | null,
	previousEvidence: readonly string[],
	branch: string | null,
	firstEmberStatus: string | null
): { changes: PlayerJournalStoryChange[]; branch: string | null; firstEmberStatus: string | null } {
	const payload = event.payload as JsonRecord;
	const changes: PlayerJournalStoryChange[] = [];
	let nextBranch = branch;
	let nextFirstEmberStatus = firstEmberStatus;
	if (typeof payload.storyBranch === 'string' && payload.storyBranch !== branch) {
		pushStoryChange(
			changes,
			'branch',
			'first-ember-branch',
			branch,
			payload.storyBranch,
			`The run entered the ${payload.storyBranch.replaceAll('-', ' ')} branch.`
		);
		nextBranch = payload.storyBranch;
	}
	const firstEmber = record(payload.firstEmber);
	if (typeof firstEmber?.status === 'string' && firstEmber.status !== firstEmberStatus) {
		pushStoryChange(
			changes,
			'first-ember',
			'first-ember-status',
			firstEmberStatus,
			firstEmber.status,
			`The First Ember became ${firstEmber.status}.`
		);
		nextFirstEmberStatus = firstEmber.status;
	}
	if (context && previousContext && context.missionId !== previousContext.missionId) {
		pushStoryChange(
			changes,
			'mission',
			'mission-binding',
			previousContext.missionId,
			context.missionId,
			`The company bound its history to ${context.missionId}.`
		);
	}
	if (context) {
		const sameAttempt =
			context.attemptId !== null && context.attemptId === previousContext?.attemptId;
		const previousObjectives = new Set(
			sameAttempt ? previousContext?.completedObjectiveIds : ([] as string[])
		);
		for (const objectiveId of context.completedObjectiveIds) {
			if (!previousObjectives.has(objectiveId)) {
				pushStoryChange(
					changes,
					'objective',
					objectiveId,
					null,
					'completed',
					`The party completed ${objectiveId.replaceAll('-', ' ')}.`
				);
			}
		}
		const previousDiscoveries = new Set(
			sameAttempt ? previousContext?.discoveryIds : ([] as string[])
		);
		for (const discoveryId of context.discoveryIds) {
			if (!previousDiscoveries.has(discoveryId)) {
				pushStoryChange(
					changes,
					'discovery',
					discoveryId,
					null,
					'discovered',
					`The party discovered ${discoveryId.replaceAll('-', ' ')}.`
				);
			}
		}
	}
	const previousEvidenceSet = new Set(previousEvidence);
	for (const evidenceKey of evidenceKeys(event)) {
		if (!previousEvidenceSet.has(evidenceKey)) {
			pushStoryChange(
				changes,
				'evidence',
				evidenceKey,
				null,
				'retained',
				`A living holder retained ${evidenceKey.replaceAll('-', ' ')}.`
			);
		}
	}
	const storyPatch = record(payload.storyPatch) ?? record(payload.patch);
	const patchCandidate = record(storyPatch?.candidate) ?? storyPatch;
	if (typeof patchCandidate?.patchId === 'string') {
		pushStoryChange(
			changes,
			'patch',
			patchCandidate.patchId,
			null,
			'accepted',
			`The validated story patch ${patchCandidate.patchId} entered the run.`
		);
	}
	return { changes, branch: nextBranch, firstEmberStatus: nextFirstEmberStatus };
}

const partyTotalProperty: Record<
	Exclude<PlayerJournalPartyProgressKind, 'party-members'>,
	keyof PlayerJournalPartyTotals
> = {
	'attempts-started': 'attemptsStarted',
	deployments: 'deployments',
	'rounds-resolved': 'roundsResolved',
	'objectives-completed': 'objectivesCompleted',
	discoveries: 'discoveries',
	'threats-defeated': 'threatsDefeated',
	'successful-extractions': 'successfulExtractions',
	retreats: 'retreats',
	casualties: 'casualties'
};

function addCumulativeProgress(
	deltas: PlayerJournalPartyProgressDelta[],
	totals: PlayerJournalPartyTotals,
	kind: Exclude<PlayerJournalPartyProgressKind, 'party-members'>,
	key: string,
	delta: number
) {
	if (delta <= 0) return;
	const property = partyTotalProperty[kind];
	const before = totals[property];
	totals[property] = before + delta;
	deltas.push({ kind, key, before, after: totals[property], delta });
}

function partyProgress(
	event: AuthoritativeEvent,
	context: PlayerJournalMissionContext | null,
	previousContext: PlayerJournalMissionContext | null,
	currentDefeatedThreats: number,
	previousDefeatedThreats: number,
	totals: PlayerJournalPartyTotals
): PlayerJournalPartyProgressDelta[] {
	const deltas: PlayerJournalPartyProgressDelta[] = [];
	const sameAttempt =
		context !== null &&
		previousContext !== null &&
		context.attemptId !== null &&
		context.attemptId === previousContext.attemptId;
	if (
		context &&
		context.partyMemberIds.length !== (sameAttempt ? previousContext!.partyMemberIds.length : 0)
	) {
		const before = sameAttempt ? previousContext!.partyMemberIds.length : 0;
		deltas.push({
			kind: 'party-members',
			key: context.attemptId ?? context.missionId,
			before,
			after: context.partyMemberIds.length,
			delta: context.partyMemberIds.length - before
		});
	}
	if (event.eventType === 'mission.preparation.started') {
		addCumulativeProgress(deltas, totals, 'attempts-started', context?.missionId ?? 'mission', 1);
	}
	if (event.eventType === 'mission.deployed') {
		addCumulativeProgress(deltas, totals, 'deployments', context?.missionId ?? 'mission', 1);
	}
	if (event.eventType === 'mission.round.resolved') {
		addCumulativeProgress(deltas, totals, 'rounds-resolved', context?.missionId ?? 'mission', 1);
	}
	const beforeObjectives = sameAttempt ? previousContext!.completedObjectiveIds.length : 0;
	const objectiveDelta = Math.max(
		0,
		(context?.completedObjectiveIds.length ?? 0) - beforeObjectives
	);
	addCumulativeProgress(
		deltas,
		totals,
		'objectives-completed',
		context?.missionId ?? 'mission',
		objectiveDelta
	);
	const beforeDiscoveries = sameAttempt ? previousContext!.discoveryIds.length : 0;
	const discoveryDelta = Math.max(0, (context?.discoveryIds.length ?? 0) - beforeDiscoveries);
	addCumulativeProgress(
		deltas,
		totals,
		'discoveries',
		context?.missionId ?? 'mission',
		discoveryDelta
	);
	addCumulativeProgress(
		deltas,
		totals,
		'threats-defeated',
		context?.missionId ?? 'mission',
		Math.max(0, currentDefeatedThreats - (sameAttempt ? previousDefeatedThreats : 0))
	);
	if (event.eventType === 'mission.extracted') {
		addCumulativeProgress(
			deltas,
			totals,
			'successful-extractions',
			context?.missionId ?? 'mission',
			1
		);
	}
	if (event.eventType === 'mission.retreated') {
		addCumulativeProgress(deltas, totals, 'retreats', context?.missionId ?? 'mission', 1);
	}
	const casualties = arrayRecords(event.payload.consequences).filter(
		(consequence) => consequence.fatal === true
	).length;
	addCumulativeProgress(
		deltas,
		totals,
		'casualties',
		context?.attemptId ?? context?.missionId ?? 'mission',
		casualties
	);
	return deltas;
}

function facetsFor(
	event: AuthoritativeEvent,
	entry: JournalEntry,
	actions: readonly PlayerJournalAction[],
	progress: readonly PlayerJournalPartyProgressDelta[],
	directions: readonly PlayerJournalDirection[],
	storyChanges: readonly PlayerJournalStoryChange[]
): PlayerJournalFacet[] {
	const facets = new Set<PlayerJournalFacet>();
	if (actions.length > 0) facets.add('action');
	if (entry.category === 'combat') facets.add('combat');
	if (entry.category === 'failure') facets.add('failure');
	if (event.eventType.startsWith('master.')) facets.add('control');
	if (entry.deltas.some((delta) => ['resource', 'item'].includes(delta.kind))) facets.add('reward');
	if (entry.deltas.some((delta) => ['experience', 'level', 'skill'].includes(delta.kind))) {
		facets.add('progression');
	}
	if (progress.length > 0) facets.add('party');
	if (progress.some((delta) => delta.kind === 'casualties' && delta.delta > 0)) {
		facets.add('failure');
	}
	if (directions.length > 0) facets.add('direction');
	if (storyChanges.length > 0 || entry.category === 'story') facets.add('story');
	if (facets.size === 0) facets.add('action');
	return [...facets];
}

function bootstrapIdentity(events: readonly AuthoritativeEvent[]) {
	const initialState = record(events[0]?.payload.initialState);
	const master = record(initialState?.master);
	const heroes = record(initialState?.heroes);
	return {
		masterId: typeof master?.masterId === 'string' ? master.masterId : null,
		heroIds: new Set(heroes ? Object.keys(heroes) : [])
	};
}

export function projectPlayerJournal(events: readonly AuthoritativeEvent[]): PlayerJournalReport {
	if (events.length === 0) throw new Error('A player journal requires at least one event');
	const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
	const runId = ordered[0]!.runId;
	if (
		ordered.some(
			(event, index) => event.runId !== runId || event.sequence !== ordered[0]!.sequence + index
		)
	) {
		throw new Error('A player journal requires one contiguous run event stream');
	}
	const startedAt = Date.parse(ordered[0]!.gameTime);
	const identity = bootstrapIdentity(ordered);
	const directives = new Map<string, { text: string; priorities: string[] }>();
	const totals: PlayerJournalPartyTotals = {
		attemptsStarted: 0,
		deployments: 0,
		roundsResolved: 0,
		objectivesCompleted: 0,
		discoveries: 0,
		threatsDefeated: 0,
		successfulExtractions: 0,
		retreats: 0,
		casualties: 0
	};
	let previousContext: PlayerJournalMissionContext | null = null;
	let previousDefeatedThreats = 0;
	let previousEvidence: string[] = [];
	let branch: string | null = null;
	let firstEmberStatus: string | null = null;
	const entries: PlayerJournalEntry[] = [];
	for (const event of ordered) {
		const projected = projectJournal([event])[0]!;
		const directContext = missionContext(event);
		const context = directContext ?? activeMissionContext(previousContext);
		const currentDefeatedThreats = directContext
			? defeatedThreatCount(event)
			: previousDefeatedThreats;
		const actions = eventActions(event, context, identity.masterId, identity.heroIds);
		const progress = partyProgress(
			event,
			context,
			previousContext,
			currentDefeatedThreats,
			previousDefeatedThreats,
			totals
		);
		const directions = eventDirections(event, directives);
		const story = eventStoryChanges(
			event,
			context,
			previousContext,
			previousEvidence,
			branch,
			firstEmberStatus
		);
		branch = story.branch;
		firstEmberStatus = story.firstEmberStatus;
		const facets = facetsFor(event, projected, actions, progress, directions, story.changes);
		entries.push({
			...projected,
			entryVersion: 'player-journal-entry-v1',
			eventType: event.eventType,
			stateHash: event.afterStateHash,
			dayNumber: dayNumber(event.gameTime, startedAt),
			facets,
			mission: context,
			actions,
			partyProgressDeltas: progress,
			directions,
			storyChanges: story.changes
		});
		if (directContext) {
			previousContext = directContext;
			previousDefeatedThreats = currentDefeatedThreats;
			previousEvidence = evidenceKeys(event);
		}
	}
	const deltaMap = new Map<
		string,
		{ ownerId: string; kind: RewardDelta['kind']; key: string; delta: number }
	>();
	for (const entry of entries) {
		for (const delta of entry.deltas) {
			const key = `${delta.ownerId}|${delta.kind}|${delta.key}`;
			const current = deltaMap.get(key);
			deltaMap.set(key, {
				ownerId: delta.ownerId,
				kind: delta.kind,
				key: delta.key,
				delta: (current?.delta ?? 0) + delta.delta
			});
		}
	}
	const deltaTotals = [...deltaMap.values()].sort(
		(left, right) =>
			left.ownerId.localeCompare(right.ownerId) ||
			left.kind.localeCompare(right.kind) ||
			left.key.localeCompare(right.key)
	);
	const filterOptions = {
		days: [...new Set(entries.map((entry) => entry.dayNumber))].sort((left, right) => left - right),
		missionIds: [...new Set(entries.flatMap((entry) => entry.mission?.missionId ?? []))].sort(),
		floors: [...new Set(entries.flatMap((entry) => entry.mission?.floor ?? []))].sort(
			(left, right) => left - right
		),
		heroIds: [...identity.heroIds].sort(),
		eventTypes: [...new Set(entries.map((entry) => entry.eventType))].sort(),
		facets: [...new Set(entries.flatMap((entry) => entry.facets))].sort(),
		sources: [...new Set(entries.map((entry) => entry.source.source))].sort()
	};
	const eventStreamHash = hashCanonical(
		ordered.map((event) => ({
			eventId: event.eventId,
			sequence: event.sequence,
			afterStateHash: event.afterStateHash
		}))
	);
	const reportWithoutHash = {
		reportVersion: 'player-journal-v1' as const,
		runId,
		fromCursor: entries[0]!.sequenceStart,
		toCursor: entries.at(-1)!.sequenceEnd,
		entryCount: entries.length,
		eventStreamHash,
		entries,
		deltaTotals,
		partyTotals: totals,
		filterOptions
	};
	return PlayerJournalReportSchema.parse({
		...reportWithoutHash,
		reportHash: hashCanonical(reportWithoutHash)
	});
}
