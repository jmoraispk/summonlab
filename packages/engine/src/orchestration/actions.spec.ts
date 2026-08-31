import {
	CharacterManifestSchema,
	EngineGameStateSchema,
	HeroDecisionPacketSchema,
	HeroPolicyResultSchema,
	type EngineCommand,
	type HeroDecisionPacket,
	type HeroPolicyResult,
	type LegalAction
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { ENGINE_COMPATIBILITY_STATE_FIXTURES } from '../../../contracts/src/engine-compatibility-states.snapshot.js';
import { assembleHeroDecisionPacket } from '../context.js';
import { applyCommand, createBootstrapEngine, replayEventsStrict } from '../engine.js';
import { IllegalActionError, StaleStateVersionError } from '../errors.js';
import { deterministicUuid, hashCanonical } from '../hash.js';
import { ENGINE_REPLAY_VECTOR_CASES } from '../compatibility/replay-vectors.js';
import { assertCommandIsLegal } from './command-authorization.js';
import { legalActions } from './legal-actions.js';
import { commandFromHeroPolicyResult } from './policy-commands.js';

function manualSource() {
	return {
		source: 'manual' as const,
		timing: 'step' as const,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function errorFrom(run: () => unknown): Error {
	try {
		run();
	} catch (error) {
		if (error instanceof Error) return error;
	}
	throw new Error('Expected the operation to throw');
}

function manifest(heroId: string) {
	return CharacterManifestSchema.parse({
		characterId: heroId,
		displayName: 'Mara Vey',
		appearanceSeed: 'actions-policy-mara',
		generationVersion: 'human-v3',
		rarityStars: 2,
		adultAge: 25,
		genderPresentation: 'feminine',
		pronouns: 'she/her',
		bodyFrame: 'balanced',
		bodyBuild: 'athletic',
		heightCm: 171,
		phenotype: {
			skinTone: 'deep umber',
			faceShape: 'angular oval',
			noseProfile: 'broad straight',
			hairTexture: 'tightly coiled',
			hairColor: 'black',
			hairStyle: 'high coiled knot',
			eyeColor: 'dark brown'
		},
		voice: { register: 'mid', texture: 'warm', cadence: 'measured' },
		posture: 'grounded',
		handedness: 'right',
		visualTraits: ['coiled knot'],
		palette: { skin: '#754c3a', hair: '#171415', cloth: '#243442', accent: '#70c8d9' },
		rig: {
			headScale: 1,
			shoulderWidth: 1,
			hipWidth: 1,
			legRatio: 1,
			anchors: { head: [50, 17], leftHand: [27, 56], rightHand: [73, 56], back: [50, 36] }
		},
		artKey: null,
		assetProvenance: 'procedural'
	});
}

function policyFixture() {
	const runId = deterministicUuid('actions-policy-run');
	const heroId = deterministicUuid('actions-policy-hero');
	const heroManifest = manifest(heroId);
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'actions-policy-seed',
		heroId,
		manifestHash: hashCanonical(heroManifest)
	});
	const packet = assembleHeroDecisionPacket({
		snapshot: bootstrap.snapshot,
		manifest: heroManifest,
		heroId,
		decisionKind: 'settlement-action'
	});
	const actionId = 'hero.choose.kitchen';
	const withoutHash = {
		schemaVersion: 'hero-policy-result-v1' as const,
		policyId: 'random-policy-v1' as const,
		packetId: packet.packetId,
		packetHash: packet.packetHash,
		legalActionHash: packet.legalActionHash,
		decisionKind: packet.decisionKind,
		world: {
			stateVersion: packet.world.stateVersion,
			eventCursor: packet.world.eventCursor,
			stateHash: packet.world.stateHash
		},
		decision: {
			actionId,
			targetIds: [],
			publicIntent: 'I will begin in the kitchen.',
			spokenText: null,
			goalProposal: null,
			memoryCandidateIds: []
		},
		trace: {
			kind: 'random' as const,
			policyVersion: 'random-policy-v1' as const,
			seedHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
			draw: 0,
			candidateActionIds: [actionId],
			selectedIndex: 0
		}
	};
	const result = HeroPolicyResultSchema.parse({
		...withoutHash,
		resultHash: hashCanonical(withoutHash)
	});
	return { state: bootstrap.snapshot.state, packet, result };
}

function resignPacket(
	packet: HeroDecisionPacket,
	changes: Partial<Omit<HeroDecisionPacket, 'packetHash'>>
): HeroDecisionPacket {
	const unsigned = { ...packet, ...changes } as Partial<HeroDecisionPacket>;
	delete unsigned.packetHash;
	return HeroDecisionPacketSchema.parse({ ...unsigned, packetHash: hashCanonical(unsigned) });
}

function resignResult(
	result: HeroPolicyResult,
	changes: Partial<Omit<HeroPolicyResult, 'resultHash'>>
): HeroPolicyResult {
	const unsigned = { ...result, ...changes } as Partial<HeroPolicyResult>;
	delete unsigned.resultHash;
	return HeroPolicyResultSchema.parse({ ...unsigned, resultHash: hashCanonical(unsigned) });
}

describe('orchestration legal actions', () => {
	it('preserves the complete v1 Master action', () => {
		const state = EngineGameStateSchema.parse(ENGINE_COMPATIBILITY_STATE_FIXTURES[0]);
		const expected: readonly LegalAction[] = [
			{
				actionId: 'master.inspect.gate',
				actorId: 'c25e94fa-1fb1-4f0b-8037-8cc350cdd8a2',
				kind: 'interact',
				label: 'Inspect the gate resonance',
				description: 'Draw one named deterministic resonance value without advancing time.',
				targetIds: [],
				resourceCosts: {},
				tags: ['deterministic', 'development-proof']
			}
		];

		expect(legalActions(state, state.master.masterId)).toEqual(expected);
	});

	it('preserves complete ordered Master and active-hero arrays for Checkpoint A v1-v23', () => {
		const actual = ENGINE_COMPATIBILITY_STATE_FIXTURES.map((fixture) => {
			const state = EngineGameStateSchema.parse(fixture);
			const heroId = Object.keys(state.heroes)[0]!;
			return {
				schemaVersion: state.schemaVersion,
				master: legalActions(state, state.master.masterId),
				hero: legalActions(state, heroId)
			};
		});

		expect(actual).toMatchSnapshot();
	});

	it('preserves terminal, reserved, synthesis-rumor, and recovered-archive branches', () => {
		const v23 = EngineGameStateSchema.parse(ENGINE_COMPATIBILITY_STATE_FIXTURES[22]);
		if (v23.schemaVersion !== 23) throw new Error('Expected v23 checkpoint');
		const heroId = Object.keys(v23.heroes)[0]!;
		const terminal = EngineGameStateSchema.parse({
			...v23,
			heroes: {
				...v23.heroes,
				[heroId]: { ...v23.heroes[heroId]!, lifeState: 'dead', health: 0 }
			}
		});
		const prepared = applyCommand(v23, {
			commandId: deterministicUuid('actions-reserved-prepare'),
			runId: v23.runId,
			actorId: v23.master.masterId,
			expectedVersion: v23.version,
			correlationId: deterministicUuid('actions-reserved-prepare'),
			source: manualSource(),
			commandType: 'mission.prepare',
			heroIds: [heroId]
		}).state;
		const v22Vector = ENGINE_REPLAY_VECTOR_CASES.find(
			(candidate) => candidate.vector.id === 'v22-synthesis-and-rumor'
		)!;
		const beforeRumor = replayEventsStrict(v22Vector.vector.events.slice(0, -1)).snapshot.state;
		const rumorActorId = v22Vector.vector.events.at(-1)!.actorId!;
		const v23Vector = ENGINE_REPLAY_VECTOR_CASES.find(
			(candidate) => candidate.vector.id === 'v23-first-band-archive'
		)!;
		const recoveredArchive = replayEventsStrict(v23Vector.vector.events.slice(0, -1)).snapshot
			.state;

		expect({
			terminalHero: legalActions(terminal, heroId),
			reservedHero: legalActions(prepared, heroId),
			synthesisRumor: legalActions(beforeRumor, rumorActorId),
			recoveredArchive: legalActions(recoveredArchive, recoveredArchive.master.masterId)
		}).toMatchSnapshot();
	});
});

describe('orchestration command authorization', () => {
	it('rejects a wrong run before a stale expected version', () => {
		const state = EngineGameStateSchema.parse(ENGINE_COMPATIBILITY_STATE_FIXTURES[12]);
		const command: EngineCommand = {
			commandId: deterministicUuid('authorization-envelope'),
			runId: deterministicUuid('authorization-wrong-run'),
			actorId: state.master.masterId,
			expectedVersion: state.version + 1,
			correlationId: deterministicUuid('authorization-envelope'),
			source: manualSource(),
			commandType: 'master.inspect.gate'
		};
		const error = errorFrom(() => assertCommandIsLegal(state, command));
		expect(error).toBeInstanceOf(IllegalActionError);
		expect(error).not.toBeInstanceOf(StaleStateVersionError);
		expect(error).toMatchObject({
			message: 'Action is not legal in the current state: master.inspect.gate',
			code: 'ILLEGAL_ACTION',
			legalActionIds: []
		});
	});

	it('passes complete composed action IDs into settlement authorization', () => {
		const state = EngineGameStateSchema.parse(ENGINE_COMPATIBILITY_STATE_FIXTURES[12]);
		const command: EngineCommand = {
			commandId: deterministicUuid('authorization-composed-actions'),
			runId: state.runId,
			actorId: state.master.masterId,
			expectedVersion: state.version,
			correlationId: deterministicUuid('authorization-composed-actions'),
			source: manualSource(),
			commandType: 'hero.start.activity',
			activity: 'train'
		};
		const error = errorFrom(() => assertCommandIsLegal(state, command));
		expect(error).toMatchObject({
			message: 'Action is not legal in the current state: hero.activity.train',
			legalActionIds: expect.arrayContaining(['master.inspect.gate', 'mission.prepare'])
		});
	});

	it('does not let a mission-reserved hero use a suppressed settlement action', () => {
		const state = EngineGameStateSchema.parse(ENGINE_COMPATIBILITY_STATE_FIXTURES[12]);
		const heroId = Object.keys(state.heroes)[0]!;
		const prepared = applyCommand(state, {
			commandId: deterministicUuid('authorization-reserved-prepare'),
			runId: state.runId,
			actorId: state.master.masterId,
			expectedVersion: state.version,
			correlationId: deterministicUuid('authorization-reserved-prepare'),
			source: manualSource(),
			commandType: 'mission.prepare',
			heroIds: [heroId]
		}).state;
		const command: EngineCommand = {
			commandId: deterministicUuid('authorization-reserved-choice'),
			runId: prepared.runId,
			actorId: heroId,
			expectedVersion: prepared.version,
			correlationId: deterministicUuid('authorization-reserved-choice'),
			source: { ...manualSource(), source: 'scripted', timing: 'continuous' },
			commandType: 'hero.choose.destination',
			destination: 'kitchen',
			firstLine: 'I will cook.',
			storyBranch: 'names-before-orders'
		};
		const error = errorFrom(() => assertCommandIsLegal(prepared, command));
		expect(error).toMatchObject({
			message: 'Action is not legal in the current state: hero.choose.kitchen',
			legalActionIds: []
		});
	});

	it('keeps Master-control domain source validation before action availability', () => {
		const state = EngineGameStateSchema.parse(ENGINE_COMPATIBILITY_STATE_FIXTURES[18]);
		const command: EngineCommand = {
			commandId: deterministicUuid('authorization-master-source'),
			runId: state.runId,
			actorId: state.master.masterId,
			expectedVersion: state.version,
			correlationId: deterministicUuid('authorization-master-source'),
			source: { ...manualSource(), source: 'system', timing: null },
			commandType: 'master.configure.timing',
			timing: 'wait',
			countdownSeconds: 5,
			observedAt: state.simulatedAt
		};
		const error = errorFrom(() => assertCommandIsLegal(state, command));
		expect(error).toMatchObject({
			message: 'Action is not legal in the current state: master.configure.timing',
			legalActionIds: []
		});
	});

	it('validates first-archive domain rules before complete-composer availability', () => {
		const vector = ENGINE_REPLAY_VECTOR_CASES.find(
			(candidate) => candidate.vector.id === 'v23-first-band-archive'
		)!;
		const state = replayEventsStrict(vector.vector.events.slice(0, -1)).snapshot.state;
		if (state.schemaVersion !== 23) throw new Error('Expected recovered v23 archive');
		const validReader = state.firstBandArchive.recovery!.survivingHeroIds[0]!;
		const badReaderCommand: EngineCommand = {
			commandId: deterministicUuid('authorization-archive-domain'),
			runId: state.runId,
			actorId: state.master.masterId,
			expectedVersion: state.version,
			correlationId: deterministicUuid('authorization-archive-domain'),
			source: manualSource(),
			commandType: 'story.reveal.first.archive',
			readerHeroId: deterministicUuid('authorization-missing-reader')
		};
		const domainError = errorFrom(() => assertCommandIsLegal(state, badReaderCommand));
		expect(domainError).toMatchObject({
			message: 'Action is not legal in the current state: story.reveal.first.archive',
			legalActionIds: []
		});

		const availableCommand: EngineCommand = {
			...badReaderCommand,
			commandId: deterministicUuid('authorization-archive-available'),
			correlationId: deterministicUuid('authorization-archive-available'),
			readerHeroId: validReader
		};
		expect(() => assertCommandIsLegal(state, availableCommand)).not.toThrow();
	});
});

describe('orchestration policy translation', () => {
	it('pins invalid packet hash, result hash, world binding, and legal-action hash errors', () => {
		const base = policyFixture();
		const invalidPacket = { ...base.packet, packetHash: '0'.repeat(64) } as HeroDecisionPacket;
		const invalidResult = { ...base.result, resultHash: '0'.repeat(64) } as HeroPolicyResult;
		const staleWorldPacket = resignPacket(base.packet, {
			world: { ...base.packet.world, stateVersion: base.packet.world.stateVersion + 1 }
		});
		const staleWorldResult = resignResult(base.result, {
			packetHash: staleWorldPacket.packetHash,
			world: {
				stateVersion: staleWorldPacket.world.stateVersion,
				eventCursor: staleWorldPacket.world.eventCursor,
				stateHash: staleWorldPacket.world.stateHash
			}
		});
		const staleActionsPacket = resignPacket(base.packet, { legalActionHash: '1'.repeat(64) });
		const staleActionsResult = resignResult(base.result, {
			packetHash: staleActionsPacket.packetHash,
			legalActionHash: staleActionsPacket.legalActionHash
		});
		const cases = [
			{
				packet: invalidPacket,
				result: base.result,
				message: 'Decision result is not bound to the current engine state'
			},
			{
				packet: base.packet,
				result: invalidResult,
				message: 'Decision result is not bound to the current engine state'
			},
			{
				packet: staleWorldPacket,
				result: staleWorldResult,
				message: 'Decision result is not bound to the current engine state'
			},
			{
				packet: staleActionsPacket,
				result: staleActionsResult,
				message: 'Decision legal actions are stale'
			}
		];
		for (const testCase of cases) {
			expect(() =>
				commandFromHeroPolicyResult({
					state: base.state,
					packet: testCase.packet,
					result: testCase.result,
					decisionJobId: deterministicUuid('actions-policy-job')
				})
			).toThrow(testCase.message);
		}
	});

	it('pins missing-action and invalid-target IllegalActionError fields', () => {
		const base = policyFixture();
		if (base.result.trace.kind !== 'random') throw new Error('Expected random policy fixture');
		const missingAction = 'hero.choose.nowhere';
		const missingResult = resignResult(base.result, {
			decision: { ...base.result.decision, actionId: missingAction },
			trace: {
				...base.result.trace,
				candidateActionIds: [missingAction]
			}
		});
		const invalidTarget = deterministicUuid('actions-policy-invalid-target');
		const invalidTargetResult = resignResult(base.result, {
			decision: { ...base.result.decision, targetIds: [invalidTarget] }
		});
		for (const [result, actionId] of [
			[missingResult, missingAction],
			[invalidTargetResult, base.result.decision.actionId]
		] as const) {
			const error = errorFrom(() =>
				commandFromHeroPolicyResult({
					state: base.state,
					packet: base.packet,
					result,
					decisionJobId: deterministicUuid('actions-policy-job')
				})
			);
			expect(error).toBeInstanceOf(IllegalActionError);
			expect(error).toMatchObject({
				message: `Action is not legal in the current state: ${actionId}`,
				code: 'ILLEGAL_ACTION',
				legalActionIds: ['hero.choose.kitchen', 'hero.choose.training-ground']
			});
		}
	});
});
