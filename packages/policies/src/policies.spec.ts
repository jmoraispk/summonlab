import {
	CharacterManifestSchema,
	HeroDecisionPacketSchema,
	HeroPolicyResultSchema,
	type CharacterManifest,
	type CharacterMind,
	type HeroDecisionKind,
	type HeroDecisionPacket,
	type LegalAction,
	type PlayerDirective
} from '@summonlab/contracts';
import {
	assembleHeroDecisionPacket,
	createBootstrapEngine,
	deterministicUuid,
	hashCanonical
} from '@summonlab/engine';
import { describe, expect, it } from 'vitest';

import {
	RandomPolicy,
	ScriptedPolicy,
	createHeroDecisionPreview,
	policyResultBytes,
	verifyHeroPolicyResult
} from './index.js';

const MINDS = {
	social: {
		personality: {
			openness: 58,
			conscientiousness: 52,
			extraversion: 82,
			agreeableness: 88,
			emotionalVolatility: 24
		},
		primaryValue: 'belonging',
		primaryDrive: 'connect',
		socialStyle: 'warm',
		stressResponse: 'seek-allies',
		dailyHabit: 'shares-breakfast',
		aptitudes: { might: 3, finesse: 5, insight: 7, resolve: 5 }
	},
	martial: {
		personality: {
			openness: 42,
			conscientiousness: 90,
			extraversion: 38,
			agreeableness: 34,
			emotionalVolatility: 18
		},
		primaryValue: 'mastery',
		primaryDrive: 'prove',
		socialStyle: 'direct',
		stressResponse: 'confront',
		dailyHabit: 'stretches-at-dawn',
		aptitudes: { might: 9, finesse: 6, insight: 3, resolve: 9 }
	}
} as const satisfies Record<string, CharacterMind>;

function manifest(heroId: string): CharacterManifest {
	return CharacterManifestSchema.parse({
		characterId: heroId,
		displayName: 'Mara Vey',
		appearanceSeed: 'policy-mara',
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

function packetFor(
	decisionKind: HeroDecisionKind,
	mind: CharacterMind = MINDS.social
): HeroDecisionPacket {
	const runId = deterministicUuid(`policy-run:${decisionKind}:${mind.primaryDrive}`);
	const heroId = deterministicUuid(`policy-hero:${decisionKind}:${mind.primaryDrive}`);
	const heroManifest = manifest(heroId);
	const engine = createBootstrapEngine({
		runId,
		seed: `policy-seed:${decisionKind}:${mind.primaryDrive}`,
		heroId,
		manifestHash: hashCanonical(heroManifest),
		mind
	});
	return assembleHeroDecisionPacket({
		snapshot: engine.snapshot,
		manifest: heroManifest,
		heroId,
		decisionKind
	});
}

function resignPacket(
	packet: HeroDecisionPacket,
	changes: {
		readonly legalActions?: readonly LegalAction[];
		readonly activeDirectives?: readonly PlayerDirective[];
	}
): HeroDecisionPacket {
	const legalActions = [...(changes.legalActions ?? packet.legalActions)].sort((left, right) =>
		left.actionId.localeCompare(right.actionId)
	);
	const unsigned = {
		...packet,
		legalActions,
		legalActionHash: hashCanonical(legalActions),
		environment: {
			...packet.environment,
			affordanceActionIds: legalActions.map((action) => action.actionId)
		},
		activeDirectives: [...(changes.activeDirectives ?? packet.activeDirectives)]
	};
	const withoutPacketHash: Partial<HeroDecisionPacket> = { ...unsigned };
	delete withoutPacketHash.packetHash;
	return HeroDecisionPacketSchema.parse({
		...withoutPacketHash,
		packetHash: hashCanonical(withoutPacketHash)
	});
}

describe('packet-bound hero policies', () => {
	it('returns valid, hash-bound results for every decision kind', async () => {
		for (const decisionKind of [
			'settlement-action',
			'mission-action',
			'conversation-response',
			'story-expression'
		] as const) {
			const packet = packetFor(decisionKind);
			const preview = await createHeroDecisionPreview(packet, 'every-kind-seed');
			expect(preview.schemaVersion).toBe('hero-decision-preview-v1');
			for (const result of Object.values(preview.policies)) {
				expect(HeroPolicyResultSchema.parse(result)).toEqual(result);
				expect(verifyHeroPolicyResult(result)).toBe(true);
				expect(result.decisionKind).toBe(decisionKind);
				expect(packet.legalActions.map((action) => action.actionId)).toContain(
					result.decision.actionId
				);
				expect(result.packetHash).toBe(packet.packetHash);
				expect(result.legalActionHash).toBe(packet.legalActionHash);
			}
			if (decisionKind === 'conversation-response' || decisionKind === 'story-expression') {
				expect(preview.policies.scripted.decision.spokenText).not.toBeNull();
			}
		}
	});

	it('makes seeded random choices byte-stable without Math.random or wall time', async () => {
		const packet = packetFor('mission-action');
		const policy = new RandomPolicy('repeatable-random-seed');
		const left = await policy.decide(packet);
		const right = await policy.decide(packet);
		expect(policyResultBytes(left)).toBe(policyResultBytes(right));
		expect(left.trace.kind).toBe('random');
		if (left.trace.kind !== 'random') throw new Error('Expected a random trace');
		expect(left.trace.candidateActionIds).toEqual(
			packet.legalActions.map((action) => action.actionId)
		);
		expect(left.decision.actionId).toBe(left.trace.candidateActionIds[left.trace.selectedIndex]);
	});

	it('lets personality, values, drives, and habits change the scripted first choice', async () => {
		const social = await new ScriptedPolicy().decide(packetFor('settlement-action', MINDS.social));
		const martial = await new ScriptedPolicy().decide(
			packetFor('settlement-action', MINDS.martial)
		);
		expect(social.decision.actionId).toBe('hero.choose.kitchen');
		expect(martial.decision.actionId).toBe('hero.choose.training-ground');
		expect(social.trace.kind).toBe('scripted');
		expect(martial.trace.kind).toBe('scripted');
	});

	it('scores only witnessed directives included in the packet', async () => {
		const base = packetFor('settlement-action', MINDS.social);
		const neutralActions = base.legalActions.map((action, index) => ({
			...action,
			actionId: index === 0 ? 'hero.choose.gather' : 'hero.choose.prepare',
			label: index === 0 ? 'Gather quietly' : 'Prepare quietly',
			description: index === 0 ? 'Take the gathering route.' : 'Take the preparation route.',
			tags: ['settlement', index === 0 ? 'gather' : 'prepare']
		}));
		const withoutDirective = resignPacket(base, { legalActions: neutralActions });
		const directive: PlayerDirective = {
			directiveId: deterministicUuid('policy-directive'),
			runId: base.runId,
			authorId: deterministicUuid('policy-master'),
			text: 'Prepare before taking social risks.',
			scope: 'decision',
			recipientIds: [base.heroId],
			witnessEventId: deterministicUuid('policy-directive-witness'),
			priorities: ['prepare'],
			createdAt: base.assembledAtGameTime,
			expiresAt: null,
			revokedAt: null
		};
		const withDirective = resignPacket(withoutDirective, { activeDirectives: [directive] });
		const result = await new ScriptedPolicy().decide(withDirective);
		expect(result.decision.actionId).toBe('hero.choose.prepare');
		if (result.trace.kind !== 'scripted') throw new Error('Expected a scripted trace');
		expect(
			result.trace.actionScores
				.find((score) => score.actionId === 'hero.choose.prepare')
				?.contributions.some((item) => item.key === 'directive.witnessed-match')
		).toBe(true);
	});

	it('rejects tampered packets and detects tampered policy results', async () => {
		const packet = packetFor('settlement-action');
		const tampered = {
			...packet,
			legalActions: [
				{ ...packet.legalActions[0]!, label: 'Invent a hidden action' },
				...packet.legalActions.slice(1)
			]
		};
		await expect(new RandomPolicy('tamper-seed').decide(tampered)).rejects.toThrow('integrity');
		await expect(new ScriptedPolicy().decide(tampered)).rejects.toThrow('integrity');

		const result = await new ScriptedPolicy().decide(packet);
		expect(
			verifyHeroPolicyResult({
				...result,
				decision: { ...result.decision, publicIntent: 'A forged explanation.' }
			})
		).toBe(false);
	});
});
