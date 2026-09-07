import { RewardDeltaSchema, type EngineReplayReport } from '@summonlab/contracts';

import type {
	PublicActionSource,
	PublicCombatModeBinding,
	PublicEngineEvent,
	PublicEngineReplayReport,
	PublicEventAction,
	PublicEventInput,
	PublicHeroControls,
	PublicPrivateKey,
	PublicProjected
} from '$lib/public-engine';

const PRIVATE_KEYS = new Set<PublicPrivateKey>([
	'seed',
	'entropyCursor',
	'entropyDraws',
	'learning',
	'cognitiveLearningScore',
	'cognitiveFactorBasisPoints',
	'domainAptitudes',
	'domainAptitudeFactorBasisPoints',
	'legalActions',
	'legalActionsByActor',
	'legalActionHash',
	'packetHash',
	'policyId',
	'policyResultHash',
	'providerRequest',
	'providerResponse',
	'providerPacket',
	'privateReasoning',
	'reasoning',
	'reasoningTokens',
	'decisionJobId',
	'initiativeTieBreak',
	'observations',
	'beliefs',
	'relationships',
	'authority',
	'candidateScores',
	'decisionRecommended',
	'fallbackUsed',
	'orderScore',
	'preferenceWeight'
]);

const OMIT = Symbol('omit-private-engine-value');

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function privateKey(key: string): boolean {
	const normalized = key.replaceAll(/[^a-z]/giu, '').toLowerCase();
	return (
		PRIVATE_KEYS.has(key as PublicPrivateKey) ||
		normalized.includes('private') ||
		normalized.includes('provider') ||
		normalized.includes('reasoning') ||
		normalized.endsWith('seed') ||
		normalized.includes('cognitivefactor') ||
		normalized.includes('domainaptitudefactor')
	);
}

function projectUnknown(value: unknown): unknown | typeof OMIT {
	if (Array.isArray(value)) {
		return value.flatMap((entry) => {
			const projected = projectUnknown(entry);
			return projected === OMIT ? [] : [projected];
		});
	}
	if (!isRecord(value)) return value;
	if (value.delivery === 'private' || value.visibility === 'private') return OMIT;
	const projected: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value)) {
		if (privateKey(key)) continue;
		const child = projectUnknown(entry);
		if (child !== OMIT) projected[key] = child;
	}
	return projected;
}

export function projectPublicEngineValue<T>(value: T): PublicProjected<T> {
	const projected = projectUnknown(value);
	if (projected === OMIT) {
		throw new Error('A private-only record cannot be used as a public boundary root');
	}
	return projected as PublicProjected<T>;
}

function publicSource(source: PublicEventInput['source']): PublicActionSource {
	return { source: source.source, timing: source.timing };
}

function heroControls(report: EngineReplayReport): PublicHeroControls {
	const heroId = Object.keys(report.snapshot.state.heroes)[0];
	const actions = heroId ? (report.legalActionsByActor[heroId] ?? []) : [];
	const has = (actionId: string) => actions.some((action) => action.actionId === actionId);
	const equipAction = actions.find((action) => action.actionId.startsWith('hero.equip.'));
	return {
		canTravel: has('hero.travel'),
		canPlanDay: has('hero.plan.day'),
		canFollowPlan: has('hero.follow.plan'),
		activity: {
			train: has('hero.activity.train'),
			eat: has('hero.activity.eat'),
			rest: has('hero.activity.rest'),
			repair: has('hero.activity.repair')
		},
		equipItemId: equipAction?.actionId.replace('hero.equip.', '') ?? null
	};
}

export function projectEngineReplayForPublic(report: EngineReplayReport): PublicEngineReplayReport {
	const masterId = report.snapshot.state.master.masterId;
	return {
		runId: report.runId,
		verified: report.verified,
		eventCount: report.eventCount,
		checks: report.checks.map((check) => ({
			sequence: check.sequence,
			gameTime: check.gameTime,
			eventType: check.eventType,
			actorId: check.actorId,
			source: publicSource(check.source),
			summary: check.summary,
			beforeStateHash: check.beforeStateHash,
			afterStateHash: check.afterStateHash,
			computedStateHash: check.computedStateHash,
			verified: check.verified,
			deltas: check.deltas
		})),
		journalEntries: projectPublicEngineValue(report.journalEntries),
		playerJournal: projectPublicEngineValue(report.playerJournal),
		scheduledEvents: report.scheduledEvents.map((scheduled) => ({
			scheduledEventId: scheduled.scheduledEventId,
			runId: scheduled.runId,
			actorId: scheduled.actorId,
			dueGameTime: scheduled.dueGameTime,
			eventKind: scheduled.eventKind,
			status: scheduled.status,
			createdEventId: scheduled.createdEventId,
			terminalEventId: scheduled.terminalEventId
		})),
		clock: report.clock,
		snapshot: {
			state: projectPublicEngineValue(report.snapshot.state),
			stateHash: report.snapshot.stateHash
		},
		persistedStateHash: report.persistedStateHash,
		hashMatchesPersistedSnapshot: report.hashMatchesPersistedSnapshot,
		playerActions: report.legalActions.filter((action) => action.actorId === masterId),
		heroControls: heroControls(report)
	};
}

function collectPublicActions(value: unknown, found: Map<string, PublicEventAction>): void {
	if (Array.isArray(value)) {
		for (const entry of value) collectPublicActions(entry, found);
		return;
	}
	if (!isRecord(value)) return;
	if (value.delivery === 'private' || value.visibility === 'private') return;
	if (
		typeof value.actorId === 'string' &&
		typeof value.actionId === 'string' &&
		typeof value.publicIntent === 'string'
	) {
		const outcome = ['applied', 'superseded', 'recorded'].includes(String(value.outcome))
			? (value.outcome as PublicEventAction['outcome'])
			: null;
		const action = {
			actorId: value.actorId,
			actionId: value.actionId,
			publicIntent: value.publicIntent,
			outcome
		};
		found.set(`${action.actorId}:${action.actionId}:${action.publicIntent}`, action);
	}
	for (const [key, entry] of Object.entries(value)) {
		if (!privateKey(key)) collectPublicActions(entry, found);
	}
}

function combatModeBinding(value: unknown): PublicCombatModeBinding | null {
	if (Array.isArray(value)) {
		for (const entry of value) {
			const found = combatModeBinding(entry);
			if (found) return found;
		}
		return null;
	}
	if (!isRecord(value)) return null;
	if (
		typeof value.modeId === 'string' &&
		typeof value.rulesVersion === 'string' &&
		typeof value.contentHash === 'string' &&
		typeof value.boundAt === 'string'
	) {
		return {
			modeId: value.modeId,
			rulesVersion: value.rulesVersion,
			contentHash: value.contentHash,
			boundAt: value.boundAt
		};
	}
	for (const entry of Object.values(value)) {
		const found = combatModeBinding(entry);
		if (found) return found;
	}
	return null;
}

function publicRewardDeltas(payload: Record<string, unknown>) {
	if (!Array.isArray(payload.rewardDeltas)) return [];
	return payload.rewardDeltas.flatMap((candidate) => {
		const parsed = RewardDeltaSchema.safeParse(candidate);
		return parsed.success ? [parsed.data] : [];
	});
}

export function projectEngineEventForPublic(event: PublicEventInput): PublicEngineEvent {
	const actions = new Map<string, PublicEventAction>();
	collectPublicActions(event.payload, actions);
	return {
		eventId: event.eventId,
		runId: event.runId,
		sequence: event.sequence,
		schemaVersion: event.schemaVersion,
		gameTime: event.gameTime,
		eventType: event.eventType,
		actorId: event.actorId,
		source: publicSource(event.source),
		beforeStateHash: event.beforeStateHash,
		afterStateHash: event.afterStateHash,
		contentVersion: event.contentVersion,
		summary: typeof event.payload.summary === 'string' ? event.payload.summary : null,
		actions: [...actions.values()],
		rewardDeltas: publicRewardDeltas(event.payload),
		combatModeBinding: combatModeBinding(event.payload)
	};
}
