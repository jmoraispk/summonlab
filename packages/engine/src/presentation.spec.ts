import { HEARTH_01_DEFINITION } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import {
	applyCommand,
	createBootstrapEngine,
	deterministicUuid,
	hashGameState,
	projectHeroConversationPresentation,
	projectSettlementPresentation,
	routineSettlementPose,
	settlementDayPhase,
	sha256Hex
} from './index.js';

function source() {
	return {
		source: 'scripted' as const,
		timing: 'continuous' as const,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function fixture() {
	const runId = deterministicUuid('presentation-test-run');
	const heroId = deterministicUuid('presentation-test-hero');
	return createBootstrapEngine({
		runId,
		seed: 'presentation-test-seed',
		heroId,
		manifestHash: sha256Hex('presentation-test-manifest')
	});
}

function commandBase(
	state: ReturnType<typeof fixture>['snapshot']['state'],
	actorId: string,
	key: string
) {
	const commandId = deterministicUuid(`${state.runId}:${key}:${state.version}`);
	return {
		commandId,
		runId: state.runId,
		actorId,
		expectedVersion: state.version,
		correlationId: commandId,
		source: source()
	};
}

describe('settlement presentation projection', () => {
	it.each([
		[299, 'night'],
		[300, 'dawn'],
		[479, 'dawn'],
		[480, 'day'],
		[1_079, 'day'],
		[1_080, 'dusk'],
		[1_259, 'dusk'],
		[1_260, 'night']
	] as const)('maps minute %i to %s', (minute, phase) => {
		expect(settlementDayPhase(minute)).toBe(phase);
	});

	it('maps every routine family to a visible pose', () => {
		expect(routineSettlementPose('sleep')).toBe('sleep');
		expect(routineSettlementPose('meal')).toBe('eat');
		expect(routineSettlementPose('shares-breakfast')).toBe('eat');
		expect(routineSettlementPose('stretches-at-dawn')).toBe('train');
		expect(routineSettlementPose('practices-knots')).toBe('train');
		expect(routineSettlementPose('assigned-duty')).toBe('work');
		expect(routineSettlementPose('catalogs-tools')).toBe('work');
		expect(routineSettlementPose('self-directed')).toBe('idle');
	});

	it('projects authoritative occupancy and caps cosmetic travel before arrival', () => {
		const bootstrap = fixture();
		const heroId = Object.keys(bootstrap.snapshot.state.heroes)[0]!;
		const initial = projectSettlementPresentation(
			bootstrap.snapshot,
			HEARTH_01_DEFINITION,
			'2000-01-01T06:30:00.000Z'
		);
		expect(initial).toMatchObject({
			dayNumber: 1,
			dayPhase: 'dawn',
			minuteOfDay: 390,
			firstEmber: { status: 'unrecovered' }
		});
		expect(initial.occupants[0]).toMatchObject({
			heroId,
			nodeId: 'gate-dais',
			buildingId: 'summoning-gate',
			pose: 'idle',
			travel: null
		});
		expect(initial.social[0]).toMatchObject({
			heroId,
			beliefCount: 2,
			latestObservation: { kind: 'awakening' },
			relationshipToMaster: { tone: 'neutral', latestEvidence: null },
			authority: { standing: 'unrecognized', latestEvidence: null },
			activePromiseTerms: []
		});

		const chosen = applyCommand(bootstrap.snapshot.state, {
			...commandBase(bootstrap.snapshot.state, heroId, 'choose-training'),
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'I need to know what this body can do.',
			storyBranch: 'steel-before-trust'
		});
		const traveling = applyCommand(chosen.state, {
			...commandBase(chosen.state, heroId, 'travel-training'),
			commandType: 'hero.start.travel',
			targetNodeId: 'training-ring'
		});
		const travel =
			traveling.state.schemaVersion === 13 ? traveling.state.heroes[heroId]!.currentTravel! : null;
		if (!travel) throw new Error('Expected an engine-v13 travel state');
		const afterDueTime = new Date(Date.parse(travel.arrivesAt) + 60_000).toISOString();
		const inMotion = projectSettlementPresentation(
			{ state: traveling.state, stateHash: hashGameState(traveling.state) },
			HEARTH_01_DEFINITION,
			afterDueTime
		);
		expect(inMotion.occupants[0]).toMatchObject({
			nodeId: 'gate-dais',
			buildingId: 'summoning-gate',
			pose: 'walk',
			travel: { toNodeId: 'training-ring', progress: 0.98 }
		});
		expect(
			inMotion.buildings.find((building) => building.buildingId === 'summoning-gate')
				?.occupantHeroIds
		).toEqual([heroId]);
	});

	it('projects witnessed words and learned claims without exposing unavailable communication', () => {
		const bootstrap = fixture();
		if (bootstrap.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const heroId = Object.keys(bootstrap.snapshot.state.heroes)[0]!;
		const committed = applyCommand(bootstrap.snapshot.state, {
			...commandBase(bootstrap.snapshot.state, bootstrap.snapshot.state.master.masterId, 'speak'),
			source: { ...source(), source: 'manual', timing: 'step' },
			commandType: 'master.communicate',
			targetHeroId: heroId,
			kind: 'tell',
			topic: 'summoning-situation',
			exactText: 'You crossed this gate without a settlement history.',
			tone: 'reassuring',
			delivery: 'private'
		});
		const presentation = projectHeroConversationPresentation(
			{ state: committed.state, stateHash: hashGameState(committed.state) },
			heroId
		);
		expect(presentation).toMatchObject({
			canCommunicate: true,
			availability: 'available',
			masterLocation: 'summoning-gate',
			heroLocation: 'summoning-gate'
		});
		expect(presentation.acts[0]).toMatchObject({
			kind: 'tell',
			topic: 'summoning-situation',
			exactText: 'You crossed this gate without a settlement history.',
			witnesses: [{ heroId, role: 'intended', perception: 'addressed', learnedBelief: true }]
		});
		expect(presentation.beliefsLearnedFromCommunication[0]).toMatchObject({
			predicate: 'was-summoned-into',
			objectSummary: 'summoning gate',
			confidence: 85
		});
	});
});
