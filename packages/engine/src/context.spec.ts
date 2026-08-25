import {
	CharacterManifestSchema,
	EngineCommandSchema,
	EngineGameStateV13Schema,
	EngineGameStateV15Schema,
	EngineSnapshotSchema,
	HeroDecisionPacketSchema,
	type CharacterManifest,
	type EngineGameStateV13,
	type PlayerDirective
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	applyCommand,
	assembleHeroDecisionPacket,
	createBootstrapEngine,
	deterministicUuid,
	hashCanonical,
	hashGameState,
	hashHeroDecisionPacket,
	verifyHeroDecisionPacket
} from './index.js';

function manifest(heroId: string, displayName = 'Mara Vey'): CharacterManifest {
	return CharacterManifestSchema.parse({
		characterId: heroId,
		displayName,
		appearanceSeed: `appearance:${heroId}`,
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

function bootstrap() {
	const runId = deterministicUuid('context-run');
	const heroId = deterministicUuid('context-hero');
	const heroManifest = manifest(heroId);
	const engine = createBootstrapEngine({
		runId,
		seed: 'context-seed',
		heroId,
		manifestHash: hashCanonical(heroManifest)
	});
	return { engine, heroId, heroManifest };
}

function snapshot(state: EngineGameStateV13) {
	return EngineSnapshotSchema.parse({ state, stateHash: hashGameState(state) });
}

function source() {
	return {
		source: 'manual' as const,
		timing: 'step' as const,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function communicate(state: EngineGameStateV13, heroId: string, key = 'context-words') {
	const commandId = deterministicUuid(`${state.runId}:${key}:${state.version}`);
	return applyCommand(state, {
		commandId,
		runId: state.runId,
		actorId: state.master.masterId,
		expectedVersion: state.version,
		correlationId: commandId,
		source: source(),
		commandType: 'master.communicate',
		targetHeroId: heroId,
		kind: 'explain',
		topic: 'master-role',
		exactText: 'I am the Master of Hearth 01. You may still question what I ask of you.',
		tone: 'reassuring',
		delivery: 'private'
	});
}

describe('hero decision context', () => {
	it('gives an Iron Moon hero the authoritative timer, cargo, quota, and finite deposits', () => {
		const runId = deterministicUuid('context-iron-moon-run');
		const heroId = deterministicUuid('context-iron-moon-hero');
		const heroManifest = manifest(heroId, 'Sumi Vale');
		const bootstrap = createBootstrapEngine({
			runId,
			seed: 'context-iron-moon-seed',
			heroId,
			manifestHash: hashCanonical(heroManifest),
			developmentMissionScenario: {
				initialMissionId: 'iron-moon',
				availableMissionIds: ['iron-moon']
			}
		});
		let state = EngineGameStateV15Schema.parse(bootstrap.snapshot.state);
		for (const [key, command] of [
			['prepare', { commandType: 'mission.prepare', heroIds: [heroId], missionId: 'iron-moon' }],
			['deploy', { commandType: 'mission.deploy' }]
		] as const) {
			const commandId = deterministicUuid(`${runId}:${key}`);
			state = EngineGameStateV15Schema.parse(
				applyCommand(
					state,
					EngineCommandSchema.parse({
						commandId,
						runId,
						actorId: state.master.masterId,
						expectedVersion: state.version,
						correlationId: commandId,
						source: source(),
						...command
					})
				).state
			);
		}
		const packet = assembleHeroDecisionPacket({
			snapshot: EngineSnapshotSchema.parse({ state, stateHash: hashGameState(state) }),
			manifest: heroManifest,
			heroId,
			decisionKind: 'mission-action'
		});

		expect(packet.environment.mission).toMatchObject({
			missionId: 'iron-moon',
			positionNodeId: 'moon-gate',
			portal: {
				roundsRemaining: 8,
				pressureStage: 'stable',
				extractionQuota: 4,
				minedAmount: 0,
				cargoAmount: 0,
				cargoCapacity: 4
			}
		});
		expect(packet.environment.mission?.portal?.deposits).toHaveLength(3);
		expect(packet.legalActions.map((action) => action.actionId)).toContain(
			'mission.move.gate-to-shelf'
		);
		expect(verifyHeroDecisionPacket(packet)).toBe(true);
	});

	it('assembles a deterministic, hash-bound packet from only the hero view', () => {
		const { engine, heroId, heroManifest } = bootstrap();
		if (engine.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13');
		const left = assembleHeroDecisionPacket({
			snapshot: engine.snapshot,
			manifest: heroManifest,
			heroId,
			decisionKind: 'settlement-action'
		});
		const right = assembleHeroDecisionPacket({
			snapshot: engine.snapshot,
			manifest: heroManifest,
			heroId,
			decisionKind: 'settlement-action'
		});

		expect(left).toEqual(right);
		expect(HeroDecisionPacketSchema.parse(left)).toEqual(left);
		expect(left.legalActions.map((action) => action.actionId)).toEqual([
			'hero.choose.kitchen',
			'hero.choose.training-ground'
		]);
		expect(left.legalActionHash).toBe(hashCanonical(left.legalActions));
		expect(left.packetHash).toBe(hashHeroDecisionPacket(left));
		expect(verifyHeroDecisionPacket(left)).toBe(true);
		expect(left.environment.visibleEntities).toContainEqual(
			expect.objectContaining({
				entityId: engine.snapshot.state.master.masterId,
				kind: 'person',
				knownAs: null
			})
		);
		expect(JSON.stringify(left)).not.toContain(engine.snapshot.state.seed);
	});

	it('retrieves exact witnessed words with provenance and a bounded score trace', () => {
		const { engine, heroId, heroManifest } = bootstrap();
		if (engine.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13');
		const committed = communicate(engine.snapshot.state, heroId);
		if (committed.state.schemaVersion !== 13) throw new Error('Expected engine-v13');
		const act = Object.values(committed.state.society.communicativeActs)[0]!;
		const directive: PlayerDirective = {
			directiveId: deterministicUuid('context-directive'),
			runId: committed.state.runId,
			authorId: committed.state.master.masterId,
			text: 'Meet people before you train.',
			scope: 'decision',
			recipientIds: [heroId],
			witnessEventId: act.sourceEventId,
			priorities: ['social contact'],
			createdAt: committed.state.simulatedAt,
			expiresAt: null,
			revokedAt: null
		};
		const packet = assembleHeroDecisionPacket({
			snapshot: snapshot(committed.state),
			manifest: heroManifest,
			heroId,
			decisionKind: 'settlement-action',
			directives: [directive],
			memoryItemLimit: 1
		});

		expect(packet.knowledge.memoryRetrieval).toMatchObject({
			candidateCount: 2,
			selectedCount: 1,
			maxItems: 1
		});
		expect(packet.knowledge.memoryRetrieval.memories[0]).toMatchObject({
			observationId: act.witnesses[0]?.observationId,
			sourceEventId: act.sourceEventId,
			exactCommunication: {
				actId: act.actId,
				exactText: act.exactText,
				perception: 'addressed'
			}
		});
		expect(packet.knowledge.memoryRetrieval.memories[0]?.score.total).toBeGreaterThan(100);
		expect(packet.activeDirectives).toEqual([directive]);
		expect(packet.environment.visibleEntities).toContainEqual(
			expect.objectContaining({ entityId: committed.state.master.masterId, knownAs: 'Master' })
		);
	});

	it('turns an accepted witnessed order into an inspectable decision preference', () => {
		const { engine, heroId, heroManifest } = bootstrap();
		if (engine.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13');
		const state = engine.snapshot.state;
		const commandId = deterministicUuid('context-accepted-order');
		const committed = applyCommand(state, {
			commandId,
			runId: state.runId,
			actorId: state.master.masterId,
			expectedVersion: state.version,
			correlationId: commandId,
			source: source(),
			commandType: 'master.converse',
			targetHeroId: heroId,
			kind: 'order',
			exactText: 'Train before we enter the tower.',
			tone: 'reassuring',
			delivery: 'private',
			orderIntent: 'train'
		});
		if (committed.state.schemaVersion !== 13) throw new Error('Expected engine-v13');
		const turn = Object.values(committed.state.society.conversationTurns)[0]!;
		const packet = assembleHeroDecisionPacket({
			snapshot: snapshot(committed.state),
			manifest: heroManifest,
			heroId,
			decisionKind: 'settlement-action'
		});

		expect(turn.response).toMatchObject({ orderOutcome: 'accepted', preferenceWeight: 24 });
		expect(packet.activeDirectives).toHaveLength(1);
		expect(packet.activeDirectives[0]).toMatchObject({
			text: 'Train before we enter the tower.',
			witnessEventId: turn.sourceEventId,
			priorities: ['conversation-weight-24', 'train', 'training', 'practice']
		});
		expect(packet.knowledge.memoryRetrieval.memories[0]?.exactCommunication?.exactText).toBe(
			'Train before we enter the tower.'
		);
	});

	it('quotes persisted directions only inside their witnessed scope', () => {
		const { engine, heroId, heroManifest } = bootstrap();
		if (engine.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13');
		const commandId = deterministicUuid('context-mission-directive');
		const issued = applyCommand(engine.snapshot.state, {
			commandId,
			runId: engine.snapshot.state.runId,
			actorId: engine.snapshot.state.master.masterId,
			expectedVersion: engine.snapshot.state.version,
			correlationId: commandId,
			source: source(),
			commandType: 'master.issue.directive',
			text: 'Protect the wounded scout before chasing the goblin captain.',
			scope: 'mission',
			recipientIds: [heroId],
			priorities: ['protect', 'wounded', 'scout'],
			tone: 'urgent',
			delivery: 'private'
		});
		if (issued.state.schemaVersion !== 13) throw new Error('Expected engine-v13');
		const engineSnapshot = EngineSnapshotSchema.parse({
			state: issued.state,
			stateHash: hashGameState(issued.state)
		});
		const settlementPacket = assembleHeroDecisionPacket({
			snapshot: engineSnapshot,
			manifest: heroManifest,
			heroId,
			decisionKind: 'settlement-action'
		});
		const missionPacket = assembleHeroDecisionPacket({
			snapshot: engineSnapshot,
			manifest: heroManifest,
			heroId,
			decisionKind: 'mission-action'
		});

		expect(settlementPacket.activeDirectives).toEqual([]);
		expect(missionPacket.activeDirectives).toHaveLength(1);
		expect(missionPacket.activeDirectives[0]).toMatchObject({
			text: 'Protect the wounded scout before chasing the goblin captain.',
			scope: 'mission',
			witnessEventId: issued.events[0]!.eventId
		});
		expect(missionPacket.legalActions).toEqual(settlementPacket.legalActions);
	});

	it('does not leak private communication to a hero who did not witness it', () => {
		const { engine, heroId, heroManifest } = bootstrap();
		if (engine.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13');
		const distantId = deterministicUuid('context-distant-hero');
		const distantManifest = manifest(distantId, 'Tarin Sol');
		const original = engine.snapshot.state;
		const expanded = EngineGameStateV13Schema.parse({
			...original,
			heroes: {
				...original.heroes,
				[distantId]: {
					...original.heroes[heroId]!,
					heroId: distantId,
					manifestHash: hashCanonical(distantManifest),
					location: 'kitchen',
					locationNodeId: 'kitchen-table',
					equipment: { mainHand: null },
					assignment: null
				}
			}
		});
		const committed = communicate(expanded, heroId, 'private-target-only');
		if (committed.state.schemaVersion !== 13) throw new Error('Expected engine-v13');
		const packet = assembleHeroDecisionPacket({
			snapshot: snapshot(committed.state),
			manifest: distantManifest,
			heroId: distantId,
			decisionKind: 'settlement-action'
		});

		expect(packet.knowledge.memoryRetrieval.candidateCount).toBe(0);
		expect(packet.knowledge.beliefs).toHaveLength(0);
		expect(JSON.stringify(packet)).not.toContain('I am the Master of Hearth 01.');
		expect(JSON.stringify(packet)).not.toContain(heroManifest.displayName);
	});

	it('rejects stale state hashes and mismatched identities', () => {
		const { engine, heroId, heroManifest } = bootstrap();
		expect(() =>
			assembleHeroDecisionPacket({
				snapshot: { ...engine.snapshot, stateHash: '0'.repeat(64) },
				manifest: heroManifest,
				heroId,
				decisionKind: 'settlement-action'
			})
		).toThrow('state hash');

		expect(() =>
			assembleHeroDecisionPacket({
				snapshot: engine.snapshot,
				manifest: { ...heroManifest, displayName: 'A forged identity' },
				heroId,
				decisionKind: 'settlement-action'
			})
		).toThrow('manifest hash');
	});

	it('is byte-stable when source records have a different insertion order', () => {
		const { engine, heroId, heroManifest } = bootstrap();
		if (engine.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13');
		let state = engine.snapshot.state;
		for (let index = 0; index < 4; index += 1) {
			const committed = communicate(state, heroId, `repeat-${index}`);
			if (committed.state.schemaVersion !== 13) throw new Error('Expected engine-v13');
			state = committed.state;
		}
		const reversed = EngineGameStateV13Schema.parse({
			...state,
			society: {
				...state.society,
				observations: Object.fromEntries(Object.entries(state.society.observations).reverse()),
				beliefs: Object.fromEntries(Object.entries(state.society.beliefs).reverse()),
				communicativeActs: Object.fromEntries(
					Object.entries(state.society.communicativeActs).reverse()
				)
			}
		});
		const left = assembleHeroDecisionPacket({
			snapshot: snapshot(state),
			manifest: heroManifest,
			heroId,
			decisionKind: 'settlement-action'
		});
		const right = assembleHeroDecisionPacket({
			snapshot: snapshot(reversed),
			manifest: heroManifest,
			heroId,
			decisionKind: 'settlement-action'
		});

		expect(right).toEqual(left);
		expect(right.packetHash).toBe(left.packetHash);
	});
});
