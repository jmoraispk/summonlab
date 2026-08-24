import {
	CharacterManifestSchema,
	EngineGameStateV8Schema,
	EngineSnapshotSchema,
	HeroDecisionPacketSchema,
	type CharacterManifest,
	type EngineGameStateV8,
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

function snapshot(state: EngineGameStateV8) {
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

function communicate(state: EngineGameStateV8, heroId: string, key = 'context-words') {
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
	it('assembles a deterministic, hash-bound packet from only the hero view', () => {
		const { engine, heroId, heroManifest } = bootstrap();
		if (engine.snapshot.state.schemaVersion !== 8) throw new Error('Expected engine-v8');
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
		if (engine.snapshot.state.schemaVersion !== 8) throw new Error('Expected engine-v8');
		const committed = communicate(engine.snapshot.state, heroId);
		if (committed.state.schemaVersion !== 8) throw new Error('Expected engine-v8');
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

	it('does not leak private communication to a hero who did not witness it', () => {
		const { engine, heroId, heroManifest } = bootstrap();
		if (engine.snapshot.state.schemaVersion !== 8) throw new Error('Expected engine-v8');
		const distantId = deterministicUuid('context-distant-hero');
		const distantManifest = manifest(distantId, 'Tarin Sol');
		const original = engine.snapshot.state;
		const expanded = EngineGameStateV8Schema.parse({
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
		if (committed.state.schemaVersion !== 8) throw new Error('Expected engine-v8');
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
		if (engine.snapshot.state.schemaVersion !== 8) throw new Error('Expected engine-v8');
		let state = engine.snapshot.state;
		for (let index = 0; index < 4; index += 1) {
			const committed = communicate(state, heroId, `repeat-${index}`);
			if (committed.state.schemaVersion !== 8) throw new Error('Expected engine-v8');
			state = committed.state;
		}
		const reversed = EngineGameStateV8Schema.parse({
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
