import {
	CharacterDraftV2Schema,
	CharacterDraftSchema,
	EngineGameStateV2Schema,
	EngineGameStateV3Schema,
	EngineGameStateV4Schema,
	EngineGameStateV6Schema,
	EngineGameStateV7Schema,
	EngineGameStateV9Schema,
	EngineGameStateV10Schema,
	EngineGameStateV11Schema,
	EngineGameStateV12Schema,
	EngineGameStateV13Schema,
	EngineGameStateV14Schema,
	EngineGameStateV15Schema,
	EngineGameStateV16Schema,
	EngineGameStateV17Schema,
	EngineGameStateV18Schema,
	EngineGameStateV19Schema,
	EngineGameStateV20Schema,
	MissionRunStateV8Schema,
	SocietyStateSchema,
	SocietyStateV3Schema,
	type ActivityKind,
	type ActionSource,
	type AuthoritativeEvent,
	type CharacterDraft,
	type CharacterDraftV2,
	type EngineCommand,
	type EngineGameStateV1,
	type FirstEmberFacility
} from '@summonlab/contracts';
import { COMBAT_RULES_V1 } from '@summonlab/content';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
	ENGINE_INVARIANTS,
	EMPTY_STATE_HASH,
	IllegalActionError,
	ReplayIntegrityError,
	StaleStateVersionError,
	type BootstrapAdditionalHeroInput,
	type BootstrapEngineInput,
	applyCommand,
	applyCatchUpPolicy,
	createCombatMissionClaimProjection,
	createCombatProgressionClaimProjection,
	addGameMinutes,
	capabilityProfileFromLegacyMind,
	createBootstrapEngine,
	createEntropyCursor,
	deterministicUuid,
	drawInteger,
	emitCombatOutcome,
	hashGameState,
	isIrreversibleMasterAction,
	legalActions,
	masterFallbackActionSource,
	masterFallbackMissionChoice,
	masterFallbackSafetySource,
	projectGameTime,
	projectJournal,
	realTimeForGameTime,
	transitionCombatResultClaims,
	resolveDailyRoutine,
	resolveMonsterPolicyIntent,
	selectMasterFallback,
	replayEvents,
	replayEventsStrict,
	monsterArmorReduction,
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

function manualSource() {
	return {
		source: 'manual' as const,
		timing: 'step' as const,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function systemSource() {
	return {
		source: 'system' as const,
		timing: null,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function manualMissionChoice(actorId: string, actionId: string) {
	return {
		actorId,
		actionId,
		source: 'manual' as const,
		policyId: null,
		packetHash: null,
		legalActionHash: null,
		policyResultHash: null,
		publicIntent: `The Master chose ${actionId}.`
	};
}

function scriptedMissionChoice(actorId: string, actionId: string) {
	return {
		actorId,
		actionId,
		source: 'scripted' as const,
		policyId: 'scripted-personality-v1',
		packetHash: sha256Hex(`${actorId}:${actionId}:packet`),
		legalActionHash: sha256Hex(`${actorId}:${actionId}:legal`),
		policyResultHash: sha256Hex(`${actorId}:${actionId}:result`),
		publicIntent: `The hero independently chose ${actionId}.`
	};
}

function fixture() {
	const runId = deterministicUuid('engine-test-run');
	const heroId = deterministicUuid('engine-test-hero');
	return createBootstrapEngine({
		runId,
		seed: 'engine-test-seed',
		heroId,
		manifestHash: sha256Hex('engine-test-manifest')
	});
}

function v2Draft(heroId: string) {
	return CharacterDraftV2Schema.parse({
		recipe: {
			seed: 'engine-v25-character-seed',
			generationVersion: 'human-v6',
			cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
		},
		manifest: {
			characterId: heroId,
			displayName: 'Capability Hero',
			appearanceSeed: 'engine-v25-appearance',
			generationVersion: 'human-v6',
			rarityStars: 3,
			adultAge: 25,
			genderPresentation: 'androgynous',
			pronouns: 'they/them',
			bodyFrame: 'balanced',
			bodyBuild: 'athletic',
			heightCm: 172,
			phenotype: {
				skinTone: 'deep umber',
				faceShape: 'oval',
				noseProfile: 'broad straight',
				hairTexture: 'coiled',
				hairColor: 'black',
				hairStyle: 'high knot',
				eyeColor: 'brown'
			},
			voice: { register: 'mid', texture: 'clear', cadence: 'measured' },
			posture: 'grounded',
			handedness: 'right',
			visualTraits: ['left brow scar'],
			palette: { skin: '#633b2d', hair: '#17151b', cloth: '#272932', accent: '#d49b47' },
			rig: {
				headScale: 1,
				shoulderWidth: 1,
				hipWidth: 1,
				legRatio: 1,
				anchors: { head: [50, 17], leftHand: [27, 56], rightHand: [73, 56], back: [50, 36] }
			},
			artKey: null,
			assetProvenance: 'procedural'
		},
		mind: {
			personality: {
				openness: 55,
				conscientiousness: 60,
				extraversion: 45,
				agreeableness: 50,
				emotionalVolatility: 40
			},
			primaryValue: 'duty',
			primaryDrive: 'survive',
			socialStyle: 'reserved',
			stressResponse: 'prepare',
			dailyHabit: 'checks-exits'
		},
		capabilityProfile: {
			profileVersion: 'character-capability-v1',
			attributes: { might: 81, vitality: 62, agility: 43, spirit: 24 },
			learning: {
				cognitiveLearningScore: 35,
				domainAptitudes: { martial: 46, magical: 57, crafting: 68, survival: 79, social: 90 }
			}
		},
		manifestHash: sha256Hex('engine-v25-character-manifest')
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

function arriveAtTraining() {
	const bootstrap = fixture();
	const heroId = Object.keys(bootstrap.snapshot.state.heroes)[0]!;
	const chosen = applyCommand(bootstrap.snapshot.state, {
		...commandBase(bootstrap.snapshot.state, heroId, 'choose-training'),
		commandType: 'hero.choose.destination',
		destination: 'training-ground',
		firstLine: 'Let me test what this body remembers.',
		storyBranch: 'steel-before-trust'
	});
	const traveling = applyCommand(chosen.state, {
		...commandBase(chosen.state, heroId, 'travel-training'),
		commandType: 'hero.start.travel',
		targetNodeId: 'training-ring'
	});
	const arrived = applyCommand(traveling.state, {
		...commandBase(traveling.state, traveling.state.master.masterId, 'arrive-training'),
		commandType: 'simulation.advance',
		targetGameTime: traveling.scheduled[0]!.dueGameTime
	});
	return { bootstrap, chosen, traveling, arrived, heroId };
}

describe('deterministic engine', () => {
	it('bootstraps v2 drafts directly into v25 capability state without legacy aptitudes', () => {
		const runId = deterministicUuid('engine-v25-test-run');
		const heroId = deterministicUuid('engine-v25-test-hero');
		const draft = v2Draft(heroId);
		const bootstrap = createBootstrapEngine({
			runId,
			seed: 'engine-v25-test-seed',
			draft
		});
		if (bootstrap.snapshot.state.schemaVersion !== 25) {
			throw new Error('Expected engine-v25 state');
		}

		expect(bootstrap.snapshot.state).toMatchObject({
			schemaVersion: 25,
			contentVersion: 'engine-v25',
			heroes: {
				[heroId]: {
					mind: draft.mind,
					capabilityProfile: draft.capabilityProfile,
					health: 348,
					maxHealth: 348,
					mana: 88,
					maxMana: 88
				}
			}
		});
		expect(bootstrap.snapshot.state.heroes[heroId]?.mind).not.toHaveProperty('aptitudes');

		const chosen = applyCommand(bootstrap.snapshot.state, {
			...commandBase(bootstrap.snapshot.state, heroId, 'v25-choose-training'),
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'I will test the practice ring.',
			storyBranch: 'steel-before-trust'
		});
		if (chosen.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		expect(chosen.state.heroes[heroId]).toMatchObject({
			capabilityProfile: draft.capabilityProfile,
			destination: 'training-ground'
		});
		const traveling = applyCommand(chosen.state, {
			...commandBase(chosen.state, heroId, 'v25-travel-training'),
			commandType: 'hero.start.travel',
			targetNodeId: 'training-ring'
		});
		const arrived = applyCommand(traveling.state, {
			...commandBase(traveling.state, traveling.state.master.masterId, 'v25-arrive-training'),
			commandType: 'simulation.advance',
			targetGameTime: traveling.scheduled[0]!.dueGameTime
		});
		if (arrived.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		expect(arrived.state.heroes[heroId]).toMatchObject({
			location: 'training-ground',
			capabilityProfile: draft.capabilityProfile
		});
		expect(arrived.state.heroes[heroId]?.mind).not.toHaveProperty('aptitudes');
		expect(legalActions(arrived.state, heroId).map((action) => action.actionId)).toContain(
			'hero.plan.day'
		);
	});

	it('converts an explicitly migrated v1 draft at the bootstrap boundary only', () => {
		const legacy = fixture();
		if (legacy.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const legacyMind = legacy.snapshot.state.heroes[deterministicUuid('engine-test-hero')]!.mind;
		const nonuniformLegacyMind = {
			...legacyMind,
			aptitudes: { might: 1, finesse: 2, insight: 3, resolve: 4 }
		};
		const profile = capabilityProfileFromLegacyMind(nonuniformLegacyMind);

		expect(profile).toStrictEqual({
			profileVersion: 'character-capability-v1',
			attributes: { might: 10, vitality: 40, agility: 20, spirit: 30 },
			learning: {
				cognitiveLearningScore: 20,
				domainAptitudes: { martial: 78, magical: 81, crafting: 46, survival: 96, social: 27 }
			}
		});
		const changedCombatOnly = {
			...nonuniformLegacyMind,
			aptitudes: { might: 9, finesse: 8, insight: 7, resolve: 6 }
		};
		expect(capabilityProfileFromLegacyMind(changedCombatOnly).learning).toStrictEqual(
			profile.learning
		);

		const source = v2Draft(deterministicUuid('engine-v25-legacy-draft-hero'));
		const legacyDraft = CharacterDraftSchema.parse({
			recipe: source.recipe,
			manifest: source.manifest,
			manifestHash: source.manifestHash,
			mind: { ...source.mind, aptitudes: nonuniformLegacyMind.aptitudes }
		});
		const migrated = createBootstrapEngine({
			runId: deterministicUuid('engine-v25-legacy-draft-run'),
			seed: 'engine-v25-legacy-draft-seed',
			draft: legacyDraft
		});
		if (migrated.snapshot.state.schemaVersion !== 25) {
			throw new Error('Expected migrated engine-v25 state');
		}
		expect(migrated.snapshot.state.heroes[legacyDraft.manifest.characterId]).toMatchObject({
			mind: source.mind,
			capabilityProfile: profile
		});
	});

	it('types bootstrap inputs according to the v25 and legacy runtime branches', () => {
		type DirectV25 = {
			readonly runId: string;
			readonly seed: string;
			readonly draft: CharacterDraftV2;
			readonly additionalHeroes: readonly [{ readonly draft: CharacterDraftV2 }];
		};
		type LegacyDevelopment = {
			readonly runId: string;
			readonly seed: string;
			readonly draft: CharacterDraft;
			readonly developmentEquipmentScenario: { readonly enabled: true };
			readonly additionalHeroes: readonly [{ readonly draft: CharacterDraft }];
		};
		type V2Development = DirectV25 & {
			readonly developmentEquipmentScenario: { readonly enabled: true };
		};
		type LegacyPrimaryWithV2Additional = {
			readonly runId: string;
			readonly seed: string;
			readonly heroId: string;
			readonly manifestHash: string;
			readonly additionalHeroes: readonly [{ readonly draft: CharacterDraftV2 }];
		};
		type DevelopmentScenarioWithV2Additional = {
			readonly runId: string;
			readonly seed: string;
			readonly heroId: string;
			readonly manifestHash: string;
			readonly developmentMissionScenario: {
				readonly initialMissionId: string;
				readonly availableMissionIds: readonly string[];
				readonly additionalHeroes: readonly [{ readonly draft: CharacterDraftV2 }];
			};
		};

		expectTypeOf<DirectV25>().toMatchTypeOf<BootstrapEngineInput>();
		expectTypeOf<LegacyDevelopment>().toMatchTypeOf<BootstrapEngineInput>();
		expectTypeOf<V2Development>().not.toMatchTypeOf<BootstrapEngineInput>();
		expectTypeOf<LegacyPrimaryWithV2Additional>().not.toMatchTypeOf<BootstrapEngineInput>();
		expectTypeOf<DevelopmentScenarioWithV2Additional>().not.toMatchTypeOf<BootstrapEngineInput>();
		expectTypeOf<{
			readonly draft: CharacterDraftV2;
		}>().not.toMatchTypeOf<BootstrapAdditionalHeroInput>();
	});

	it('admits additional v2 drafts only when the whole bootstrap enters v25', () => {
		const primary = v2Draft(deterministicUuid('engine-v25-primary-draft'));
		const additional = v2Draft(deterministicUuid('engine-v25-additional-draft'));
		const direct = createBootstrapEngine({
			runId: deterministicUuid('engine-v25-multiple-drafts'),
			seed: 'engine-v25-multiple-drafts-seed',
			draft: primary,
			additionalHeroes: [{ draft: additional }]
		});
		if (direct.snapshot.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		expect(direct.snapshot.state.heroes[primary.manifest.characterId]!.capabilityProfile).toEqual(
			primary.capabilityProfile
		);
		expect(
			direct.snapshot.state.heroes[additional.manifest.characterId]!.capabilityProfile
		).toEqual(additional.capabilityProfile);
		const legacyDraft = CharacterDraftSchema.parse({
			recipe: primary.recipe,
			manifest: primary.manifest,
			mind: {
				...primary.mind,
				aptitudes: { might: 1, finesse: 2, insight: 3, resolve: 4 }
			},
			manifestHash: primary.manifestHash
		});
		const legacyDevelopment = createBootstrapEngine({
			runId: deterministicUuid('engine-v24-legacy-development-draft'),
			seed: 'engine-v24-legacy-development-draft-seed',
			draft: legacyDraft,
			developmentEquipmentScenario: { enabled: true }
		});
		expect(legacyDevelopment.snapshot.state.schemaVersion).toBe(24);

		const v2Development = {
			runId: deterministicUuid('engine-v25-invalid-development'),
			seed: 'engine-v25-invalid-development-seed',
			draft: primary,
			developmentEquipmentScenario: { enabled: true }
		};
		expect(() => Reflect.apply(createBootstrapEngine, undefined, [v2Development])).toThrow(
			'V2 drafts require the capability engine bootstrap'
		);

		const legacyWithV2Additional = {
			runId: deterministicUuid('engine-v25-invalid-additional'),
			seed: 'engine-v25-invalid-additional-seed',
			heroId: deterministicUuid('engine-v25-legacy-primary'),
			manifestHash: sha256Hex('engine-v25-legacy-primary-manifest'),
			additionalHeroes: [{ draft: additional }]
		};
		expect(() => Reflect.apply(createBootstrapEngine, undefined, [legacyWithV2Additional])).toThrow(
			'V2 drafts require the capability engine bootstrap'
		);
	});

	it('keeps external mutation sources outside the engine contract', () => {
		expect(ENGINE_INVARIANTS).toContain('no-model-sdk');
		expect(ENGINE_INVARIANTS).toContain('no-wall-clock');
	});

	it('keeps bootstrap legal-action ids in their public order', () => {
		const bootstrap = fixture();
		const heroId = Object.keys(bootstrap.snapshot.state.heroes)[0]!;
		const legalActionCases = [
			{
				boundary: 'bootstrap',
				actorId: bootstrap.snapshot.state.master.masterId,
				expected: [
					'master.inspect.gate',
					'mission.prepare',
					`settlement.assign.${heroId}.summoning-gate`,
					`settlement.assign.${heroId}.kitchen`,
					`settlement.assign.${heroId}.dormitory`,
					`settlement.assign.${heroId}.training-ground`,
					`settlement.assign.${heroId}.workshop`,
					`social.communicate.${heroId}`,
					`social.converse.${heroId}`,
					'social.directive.issue',
					`simulation.damage.hero.${heroId}`,
					'simulation.damage.master'
				]
			},
			{
				boundary: 'bootstrap hero choice',
				actorId: heroId,
				expected: ['hero.choose.kitchen', 'hero.choose.training-ground']
			}
		] as const;

		for (const legalActionCase of legalActionCases) {
			expect(
				legalActions(bootstrap.snapshot.state, legalActionCase.actorId).map(
					(action) => action.actionId
				)
			).toEqual(legalActionCase.expected);
		}
	});

	it('keeps ordered legal-action ids at every characterized decision boundary', () => {
		const bootstrap = fixture();
		const initial = bootstrap.snapshot.state;
		const heroId = Object.keys(initial.heroes)[0]!;
		const masterId = initial.master.masterId;
		const baseActions = (targetHeroId: string) => [
			'master.inspect.gate',
			'mission.prepare',
			`settlement.assign.${targetHeroId}.summoning-gate`,
			`settlement.assign.${targetHeroId}.kitchen`,
			`settlement.assign.${targetHeroId}.dormitory`,
			`settlement.assign.${targetHeroId}.training-ground`,
			`settlement.assign.${targetHeroId}.workshop`,
			`social.communicate.${targetHeroId}`,
			`social.converse.${targetHeroId}`,
			'social.directive.issue',
			`simulation.damage.hero.${targetHeroId}`,
			'simulation.damage.master'
		];
		const chosen = applyCommand(initial, {
			...commandBase(initial, heroId, 'compatibility-choose'),
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'I will train before we enter the tower.',
			storyBranch: 'steel-before-trust'
		});
		const traveling = applyCommand(chosen.state, {
			...commandBase(chosen.state, heroId, 'compatibility-travel'),
			commandType: 'hero.start.travel',
			targetNodeId: 'training-ring'
		});
		const settled = applyCommand(traveling.state, {
			...commandBase(traveling.state, masterId, 'compatibility-arrive'),
			commandType: 'simulation.advance',
			targetGameTime: traveling.scheduled[0]!.dueGameTime
		});
		const communication = applyCommand(initial, {
			...commandBase(initial, masterId, 'compatibility-communication'),
			source: manualSource(),
			commandType: 'master.communicate',
			targetHeroId: heroId,
			kind: 'explain',
			topic: 'master-role',
			exactText: 'I will keep the company safe.',
			tone: 'neutral',
			delivery: 'private'
		});
		const conversation = applyCommand(initial, {
			...commandBase(initial, masterId, 'compatibility-conversation'),
			source: manualSource(),
			commandType: 'master.converse',
			targetHeroId: heroId,
			kind: 'ask',
			exactText: 'Are you ready to train?',
			tone: 'neutral',
			delivery: 'private',
			orderIntent: null
		});
		const directive = applyCommand(initial, {
			...commandBase(initial, masterId, 'compatibility-directive'),
			source: manualSource(),
			commandType: 'master.issue.directive',
			text: 'Choose training before the tower.',
			scope: 'decision',
			recipientIds: [heroId],
			priorities: ['training'],
			tone: 'firm',
			delivery: 'private'
		});
		if (directive.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const directiveId = Object.keys(directive.state.society.directives)[0]!;
		const preparation = applyCommand(initial, {
			...commandBase(initial, masterId, 'compatibility-prepare'),
			source: manualSource(),
			commandType: 'mission.prepare',
			heroIds: [heroId]
		});
		const deployment = applyCommand(preparation.state, {
			...commandBase(preparation.state, masterId, 'compatibility-deploy'),
			source: manualSource(),
			commandType: 'mission.deploy'
		});
		const development = (
			key: string,
			flags: {
				readonly initialMissionId: string;
				readonly availableMissionIds: readonly string[];
				readonly enableAttemptAftermath?: boolean;
				readonly enableStoryPatch?: boolean;
				readonly enableSynthesis?: boolean;
				readonly enableFirstBandArchive?: boolean;
			}
		) =>
			createBootstrapEngine({
				runId: deterministicUuid(`compatibility-${key}-run`),
				seed: `compatibility-${key}-seed`,
				heroId: deterministicUuid(`compatibility-${key}-hero`),
				manifestHash: sha256Hex(`compatibility-${key}-manifest`),
				developmentMissionScenario: flags
			}).snapshot.state;
		const developmentScenario = {
			initialMissionId: 'tower-floor-01',
			availableMissionIds: ['tower-floor-01']
		} as const;
		const aftermath = development('aftermath', {
			...developmentScenario,
			enableAttemptAftermath: true
		});
		const storyPatch = development('story-patch', {
			...developmentScenario,
			enableStoryPatch: true
		});
		const synthesis = development('synthesis', {
			...developmentScenario,
			enableSynthesis: true
		});
		const firstBandArchive = development('first-band-archive', {
			...developmentScenario,
			enableFirstBandArchive: true
		});
		const aftermathHeroId = Object.keys(aftermath.heroes)[0]!;
		const storyPatchHeroId = Object.keys(storyPatch.heroes)[0]!;
		const synthesisHeroId = Object.keys(synthesis.heroes)[0]!;
		const firstBandArchiveHeroId = Object.keys(firstBandArchive.heroes)[0]!;
		const cases = [
			{ boundary: 'bootstrap', state: initial, actorId: masterId, expected: baseActions(heroId) },
			{
				boundary: 'settlement idle',
				state: settled.state,
				actorId: masterId,
				expected: [
					'master.inspect.gate',
					'mission.prepare',
					`settlement.assign.${heroId}.summoning-gate`,
					`settlement.assign.${heroId}.kitchen`,
					`settlement.assign.${heroId}.dormitory`,
					`settlement.assign.${heroId}.training-ground`,
					`settlement.assign.${heroId}.workshop`,
					`simulation.damage.hero.${heroId}`,
					'simulation.damage.master'
				]
			},
			{
				boundary: 'travel',
				state: traveling.state,
				actorId: masterId,
				expected: [
					'master.inspect.gate',
					'mission.prepare',
					'simulation.advance',
					`settlement.assign.${heroId}.summoning-gate`,
					`settlement.assign.${heroId}.kitchen`,
					`settlement.assign.${heroId}.dormitory`,
					`settlement.assign.${heroId}.training-ground`,
					`settlement.assign.${heroId}.workshop`,
					`simulation.damage.hero.${heroId}`,
					'simulation.damage.master'
				]
			},
			{
				boundary: 'communication',
				state: communication.state,
				actorId: masterId,
				expected: baseActions(heroId)
			},
			{
				boundary: 'conversation',
				state: conversation.state,
				actorId: masterId,
				expected: baseActions(heroId)
			},
			{
				boundary: 'directive',
				state: directive.state,
				actorId: masterId,
				expected: [
					'master.inspect.gate',
					'mission.prepare',
					`settlement.assign.${heroId}.summoning-gate`,
					`settlement.assign.${heroId}.kitchen`,
					`settlement.assign.${heroId}.dormitory`,
					`settlement.assign.${heroId}.training-ground`,
					`settlement.assign.${heroId}.workshop`,
					`social.communicate.${heroId}`,
					`social.converse.${heroId}`,
					'social.directive.issue',
					`social.directive.replace.${directiveId}`,
					`social.directive.revoke.${directiveId}`,
					`simulation.damage.hero.${heroId}`,
					'simulation.damage.master'
				]
			},
			{
				boundary: 'mission preparation',
				state: preparation.state,
				actorId: masterId,
				expected: ['mission.revise.party', 'mission.deploy', 'mission.cancel']
			},
			{
				boundary: 'mission deployment',
				state: deployment.state,
				actorId: masterId,
				expected: ['mission.hold', 'mission.move.threshold-to-oath-hall', 'mission.retreat']
			},
			{
				boundary: 'mission turn',
				state: deployment.state,
				actorId: heroId,
				expected: ['mission.hold', 'mission.move.threshold-to-oath-hall']
			},
			{
				boundary: 'aftermath',
				state: aftermath,
				actorId: aftermath.master.masterId,
				expected: baseActions(aftermathHeroId)
			},
			{
				boundary: 'story patch',
				state: storyPatch,
				actorId: storyPatch.master.masterId,
				expected: [
					'master.inspect.gate',
					'story.patch.apply',
					`simulation.damage.hero.${storyPatchHeroId}`,
					'simulation.damage.master'
				]
			},
			{
				boundary: 'synthesis',
				state: synthesis,
				actorId: synthesis.master.masterId,
				expected: [
					'master.inspect.gate',
					`simulation.damage.hero.${synthesisHeroId}`,
					'simulation.damage.master'
				]
			},
			{
				boundary: 'first-band archive',
				state: firstBandArchive,
				actorId: firstBandArchive.master.masterId,
				expected: [
					'master.inspect.gate',
					'mission.prepare',
					`simulation.damage.hero.${firstBandArchiveHeroId}`,
					'simulation.damage.master'
				]
			}
		] as const;

		for (const legalActionCase of cases) {
			expect(
				legalActions(legalActionCase.state, legalActionCase.actorId).map(
					(action) => action.actionId
				),
				legalActionCase.boundary
			).toEqual(legalActionCase.expected);
		}
	});

	it('produces a stable named entropy fixture and advances exactly once', () => {
		const first = drawInteger(createEntropyCursor('fixture-seed'), 'gate.resonance', 0, 99);
		const repeated = drawInteger(createEntropyCursor('fixture-seed'), 'gate.resonance', 0, 99);

		expect(first).toEqual(repeated);
		expect(first.draw).toEqual({
			purpose: 'gate.resonance',
			cursor: 0,
			minimum: 0,
			maximum: 99,
			value: 7
		});
		expect(first.next.cursor).toBe(1);
	});

	it('projects the documented four-times clock without reading wall time', () => {
		expect(
			projectGameTime(
				'2000-01-01T00:00:00.000Z',
				'2026-08-24T00:00:00.000Z',
				'2026-08-24T06:00:00.000Z',
				4
			)
		).toBe('2000-01-02T00:00:00.000Z');
		expect(
			realTimeForGameTime(
				'2000-01-01T00:00:00.000Z',
				'2026-08-24T00:00:00.000Z',
				'2000-01-02T00:00:00.000Z',
				4
			)
		).toBe('2026-08-24T06:00:00.000Z');
	});

	it('binds Floor 01 and owns preparation, deployment, retreat, and cancellation', () => {
		const bootstrap = fixture();
		if (bootstrap.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const initial = bootstrap.snapshot.state;
		const heroId = Object.keys(initial.heroes)[0]!;
		expect(initial).toMatchObject({
			contentVersion: 'engine-v13',
			mission: {
				binding: {
					missionId: 'tower-floor-01',
					contentVersion: 'tower-floor-01-v1',
					contentHash: '31f756076a3e67ad9023108400464e9a0ab9995637266b1b9f41c802d3a48b02'
				},
				attemptCount: 0,
				attempt: null
			}
		});
		expect(
			legalActions(initial, initial.master.masterId).map((action) => action.actionId)
		).toContain('mission.prepare');

		const prepared = applyCommand(initial, {
			...commandBase(initial, initial.master.masterId, 'mission-prepare'),
			source: manualSource(),
			commandType: 'mission.prepare',
			heroIds: [heroId]
		});
		if (prepared.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(prepared.state.mission.attempt).toMatchObject({
			ordinal: 1,
			status: 'preparing',
			party: { heroIds: [heroId], memberIds: [initial.master.masterId, heroId] },
			positions: {},
			turnState: {
				turnVersion: 'mission-turn-v2',
				maximumRounds: 48,
				roundNumber: 0,
				rounds: []
			}
		});
		expect(legalActions(prepared.state, heroId)).toEqual([]);
		expect(
			legalActions(prepared.state, initial.master.masterId).map((action) => action.actionId)
		).toEqual(['mission.revise.party', 'mission.deploy', 'mission.cancel']);

		const deployed = applyCommand(prepared.state, {
			...commandBase(prepared.state, initial.master.masterId, 'mission-deploy'),
			source: manualSource(),
			commandType: 'mission.deploy'
		});
		if (deployed.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(deployed.state.mission.attempt).toMatchObject({
			status: 'deployed',
			positions: {
				[initial.master.masterId]: 'tower-threshold',
				[heroId]: 'tower-threshold'
			},
			knowledge: { discoveryIds: [], visitedNodeIds: ['tower-threshold'] }
		});

		const retreated = applyCommand(deployed.state, {
			...commandBase(deployed.state, initial.master.masterId, 'mission-retreat'),
			source: manualSource(),
			commandType: 'mission.retreat'
		});
		if (retreated.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(retreated.state.mission.attempt).toMatchObject({
			status: 'retreat',
			outcome: 'retreat'
		});

		const retried = applyCommand(retreated.state, {
			...commandBase(retreated.state, initial.master.masterId, 'mission-retry'),
			source: manualSource(),
			commandType: 'mission.prepare',
			heroIds: []
		});
		const canceled = applyCommand(retried.state, {
			...commandBase(retried.state, initial.master.masterId, 'mission-cancel'),
			source: manualSource(),
			commandType: 'mission.cancel'
		});
		if (canceled.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(canceled.state.mission).toMatchObject({
			attemptCount: 2,
			attempt: { status: 'canceled', party: { heroIds: [] }, outcome: 'canceled' }
		});
	});

	it('resolves independent party choices through seeded initiative and replays success exactly', () => {
		const bootstrap = fixture();
		if (bootstrap.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const initial = bootstrap.snapshot.state;
		const heroId = Object.keys(initial.heroes)[0]!;
		const prepared = applyCommand(initial, {
			...commandBase(initial, initial.master.masterId, 'success-prepare'),
			source: manualSource(),
			commandType: 'mission.prepare',
			heroIds: [heroId]
		});
		const deployed = applyCommand(prepared.state, {
			...commandBase(prepared.state, initial.master.masterId, 'success-deploy'),
			source: manualSource(),
			commandType: 'mission.deploy'
		});
		if (deployed.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(() =>
			applyCommand(deployed.state, {
				...commandBase(deployed.state, initial.master.masterId, 'missing-party-choice'),
				source: manualSource(),
				commandType: 'mission.resolve.turn',
				choices: [
					manualMissionChoice(initial.master.masterId, 'mission.move.threshold-to-oath-hall')
				]
			})
		).toThrow(IllegalActionError);

		const masterActions = [
			'mission.move.threshold-to-oath-hall',
			'mission.move.oath-hall-to-gallery',
			'mission.move.gallery-to-chain-court',
			'mission.move.chain-court-to-vault',
			'mission.recover.recover-first-ember',
			'mission.move.chain-court-to-vault',
			'mission.move.gallery-to-chain-court',
			'mission.move.oath-hall-to-gallery',
			'mission.move.threshold-to-oath-hall'
		] as const;
		let state = deployed.state;
		const turnEvents: AuthoritativeEvent[] = [];
		for (const [index, actionId] of masterActions.entries()) {
			const committed = applyCommand(state, {
				...commandBase(state, initial.master.masterId, `mission-round-${index + 1}`),
				source: manualSource(),
				commandType: 'mission.resolve.turn',
				choices: [
					manualMissionChoice(initial.master.masterId, actionId),
					scriptedMissionChoice(heroId, 'mission.hold')
				]
			});
			if (committed.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
			state = committed.state;
			turnEvents.push(...committed.events);
		}

		expect(state.mission.attempt).toMatchObject({
			status: 'extraction',
			completedObjectiveIds: ['recover-first-ember'],
			turnState: {
				roundNumber: 9,
				objective: { status: 'delivered', deliveredOnRound: 9 }
			}
		});
		expect(
			state.mission.attempt?.turnState.rounds.flatMap((round) => round.environmentEventIds)
		).not.toHaveLength(0);
		expect(state.mission.attempt?.turnState.rounds[0]?.actions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ actorId: initial.master.masterId, choiceSource: 'manual' }),
				expect.objectContaining({
					actorId: heroId,
					choiceSource: 'scripted',
					packetHash: expect.stringMatching(/^[a-f0-9]{64}$/u)
				})
			])
		);

		const extracted = applyCommand(state, {
			...commandBase(state, initial.master.masterId, 'mission-extract'),
			source: manualSource(),
			commandType: 'mission.extract'
		});
		if (extracted.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(extracted.state.mission.attempt).toMatchObject({
			status: 'success',
			outcome: 'success',
			completedObjectiveIds: ['recover-first-ember']
		});
		expect(
			legalActions(extracted.state, initial.master.masterId).map((action) => action.actionId)
		).not.toContain('mission.prepare');
		const replay = replayEventsStrict([
			bootstrap.event,
			...prepared.events,
			...deployed.events,
			...turnEvents,
			...extracted.events
		]);
		expect(replay.snapshot.state).toEqual(extracted.state);
		expect(replay.verified).toBe(true);
		expect(replay.checks.every((check) => check.verified)).toBe(true);
		expect(
			replay.checks.filter((check) => check.eventType === 'mission.round.resolved')
		).toHaveLength(9);

		const drifted = EngineGameStateV13Schema.parse({
			...initial,
			mission: {
				...initial.mission,
				binding: { ...initial.mission.binding, contentHash: '0'.repeat(64) }
			}
		});
		expect(() =>
			applyCommand(drifted, {
				...commandBase(drifted, drifted.master.masterId, 'drifted-content'),
				source: manualSource(),
				commandType: 'mission.prepare',
				heroIds: []
			})
		).toThrow(ReplayIntegrityError);
	});

	it('retains a Floor 04 schematic holder and replays the Floor 05 cooling strategy', () => {
		const runId = deterministicUuid('foundry-evidence-run');
		const heroId = deterministicUuid('foundry-evidence-hero');
		const bootstrap = createBootstrapEngine({
			runId,
			seed: 'foundry-evidence-seed',
			heroId,
			manifestHash: sha256Hex('foundry-evidence-manifest'),
			developmentMissionScenario: {
				initialMissionId: 'tower-floor-04',
				availableMissionIds: ['tower-floor-04', 'tower-floor-05']
			}
		});
		const initial = EngineGameStateV14Schema.parse(bootstrap.snapshot.state);
		const masterId = initial.master.masterId;
		const events: AuthoritativeEvent[] = [bootstrap.event];
		let state = initial;
		const commit = (command: EngineCommand) => {
			const result = applyCommand(state, command);
			state = EngineGameStateV14Schema.parse(result.state);
			events.push(...result.events);
			return result;
		};
		type MissionCommand = Extract<EngineCommand, { commandType: `mission.${string}` }>;
		type MissionCommandInput<T> = T extends MissionCommand
			? Omit<T, 'commandId' | 'runId' | 'actorId' | 'expectedVersion' | 'correlationId' | 'source'>
			: never;
		const missionCommand = (
			key: string,
			command: MissionCommandInput<MissionCommand>
		): EngineCommand =>
			({
				...commandBase(state, masterId, key),
				source: manualSource(),
				...command
			}) as unknown as EngineCommand;
		const resolve = (key: string, masterActionId: string, heroActionId: string) =>
			commit(
				missionCommand(key, {
					commandType: 'mission.resolve.turn',
					choices: [
						manualMissionChoice(masterId, masterActionId),
						scriptedMissionChoice(heroId, heroActionId)
					]
				})
			);

		commit(
			missionCommand('floor-04-prepare', {
				commandType: 'mission.prepare',
				heroIds: [heroId],
				missionId: 'tower-floor-04'
			})
		);
		commit(missionCommand('floor-04-deploy', { commandType: 'mission.deploy' }));
		resolve(
			'floor-04-balance',
			'mission.move.threshold-to-balance-hall',
			'mission.move.threshold-to-balance-hall'
		);
		resolve(
			'floor-04-left-relay',
			'mission.move.balance-hall-to-left-relay',
			'mission.move.balance-hall-to-left-relay'
		);
		resolve('floor-04-open-archive', 'mission.hold', 'mission.inspect.open-archive-niche');
		resolve(
			'floor-04-enter-archive',
			'mission.move.left-relay-to-archive-niche',
			'mission.move.left-relay-to-archive-niche'
		);
		resolve('floor-04-read-schematic', 'mission.hold', 'mission.inspect.read-foundry-schematic');
		expect(Object.values(state.mission.evidence)).toEqual([
			expect.objectContaining({
				evidenceKey: 'foundry-maintenance-route',
				holderActorId: heroId,
				sourceBinding: expect.objectContaining({ missionId: 'tower-floor-04' })
			})
		]);
		resolve(
			'floor-04-leave-archive',
			'mission.move.left-relay-to-archive-niche',
			'mission.move.left-relay-to-archive-niche'
		);
		resolve(
			'floor-04-return-balance',
			'mission.move.balance-hall-to-left-relay',
			'mission.move.balance-hall-to-left-relay'
		);
		resolve(
			'floor-04-return-threshold',
			'mission.move.threshold-to-balance-hall',
			'mission.move.threshold-to-balance-hall'
		);
		commit(missionCommand('floor-04-retreat', { commandType: 'mission.retreat' }));

		commit(
			missionCommand('floor-05-prepare', {
				commandType: 'mission.prepare',
				heroIds: [heroId],
				missionId: 'tower-floor-05'
			})
		);
		commit(missionCommand('floor-05-deploy', { commandType: 'mission.deploy' }));
		expect(state.mission.attempt?.turnState.arena).toEqual({
			furnaceState: 'lit',
			coolingControlNodeId: 'cooling-control',
			coolingControlExposed: false
		});
		resolve(
			'floor-05-intake',
			'mission.move.threshold-to-ash-intake',
			'mission.move.threshold-to-ash-intake'
		);
		expect(legalActions(state, masterId).map((action) => action.actionId)).not.toContain(
			'mission.inspect.recall-maintenance-seam'
		);
		expect(legalActions(state, heroId).map((action) => action.actionId)).toContain(
			'mission.inspect.recall-maintenance-seam'
		);
		resolve(
			'floor-05-recall',
			'mission.move.ash-intake-to-forge-nave',
			'mission.inspect.recall-maintenance-seam'
		);
		expect(state.mission.attempt?.turnState.arena.coolingControlExposed).toBe(true);
		resolve(
			'floor-05-split',
			'mission.move.forge-nave-to-furnace-heart',
			'mission.move.ash-intake-to-maintenance-seam'
		);
		const litStrike = resolve(
			'floor-05-lit-strike',
			`mission.attack.${Object.values(state.mission.attempt!.turnState.monsters).find((monster) => monster.dutySlotId === 'foundry-warden')!.monsterId}`,
			'mission.move.maintenance-seam-to-cooling-control'
		);
		expect(
			litStrike.events[0]!.payload.round as { effects: Array<{ kind: string; amount: number }> }
		).toMatchObject({
			effects: expect.arrayContaining([
				expect.objectContaining({ kind: 'vitality-damage', amount: 0 })
			])
		});
		const wheelTest = resolve(
			'floor-05-test-wheel',
			'mission.move.cooling-control-to-furnace-heart',
			'mission.inspect.test-cooling-wheel'
		);
		expect(
			wheelTest.events[0]!.payload.round as {
				monsterActions: Array<{ kind: string; toNodeId: string }>;
			}
		).toMatchObject({
			monsterActions: expect.arrayContaining([
				expect.objectContaining({ kind: 'defend-control', toNodeId: 'cooling-control' })
			])
		});
		const wardenId = Object.values(state.mission.attempt!.turnState.monsters).find(
			(monster) => monster.dutySlotId === 'foundry-warden'
		)!.monsterId;
		const cooling = resolve(
			'floor-05-start-cooling',
			`mission.attack.${wardenId}`,
			'mission.control.cooling-wheel'
		);
		const quench = resolve('floor-05-quench', 'mission.hold', 'mission.control.cooling-wheel');
		for (const result of [cooling, quench]) {
			expect(result.events[0]!.payload.round as { effects: Array<{ kind: string }> }).toMatchObject(
				{
					effects: expect.arrayContaining([expect.objectContaining({ kind: 'furnace-change' })])
				}
			);
		}
		expect(state.mission.attempt?.turnState.arena.furnaceState).toBe('quenched');
		const warden = Object.values(state.mission.attempt!.turnState.monsters).find(
			(monster) => monster.dutySlotId === 'foundry-warden'
		)!;
		const quenchedStrike = resolve(
			'floor-05-quenched-strike',
			`mission.attack.${warden.monsterId}`,
			'mission.hold'
		);
		expect(
			quenchedStrike.events[0]!.payload.round as {
				effects: Array<{ kind: string; amount: number }>;
			}
		).toMatchObject({
			effects: expect.arrayContaining([
				expect.objectContaining({ kind: 'vitality-damage', amount: 1 })
			])
		});

		const replay = replayEventsStrict(events);
		expect(replay.verified).toBe(true);
		expect(replay.snapshot.state).toEqual(state);
	});

	it('persists exposed mission harm, witnessed memory, equipment wear, and permadeath', () => {
		const runId = deterministicUuid('mission-aftermath-run');
		const heroId = deterministicUuid('mission-aftermath-hero');
		const bootstrap = createBootstrapEngine({
			runId,
			seed: 'foundry-evidence-seed',
			heroId,
			manifestHash: sha256Hex('mission-aftermath-manifest'),
			developmentMissionScenario: {
				initialMissionId: 'tower-floor-03',
				availableMissionIds: ['tower-floor-03'],
				enableMissionAftermath: true
			}
		});
		let state = EngineGameStateV16Schema.parse(bootstrap.snapshot.state);
		const masterId = state.master.masterId;
		const itemId = state.heroes[heroId]!.equipment.mainHand!;
		const events: AuthoritativeEvent[] = [bootstrap.event];
		const commit = (key: string, body: object) => {
			const result = applyCommand(state, {
				...commandBase(state, masterId, key),
				source: manualSource(),
				...body
			} as unknown as EngineCommand);
			state = EngineGameStateV16Schema.parse(result.state);
			events.push(...result.events);
			return result;
		};
		const turn = (key: string, masterActionId: string, heroActionId: string) =>
			commit(key, {
				commandType: 'mission.resolve.turn',
				choices: [
					manualMissionChoice(masterId, masterActionId),
					scriptedMissionChoice(heroId, heroActionId)
				]
			});

		commit('aftermath-prepare', {
			commandType: 'mission.prepare',
			heroIds: [heroId],
			missionId: 'tower-floor-03'
		});
		commit('aftermath-deploy', { commandType: 'mission.deploy' });
		turn(
			'aftermath-cut-stair',
			'mission.move.threshold-to-cut-stair',
			'mission.move.threshold-to-cut-stair'
		);
		turn(
			'aftermath-red-gallery',
			'mission.move.cut-stair-to-red-gallery',
			'mission.move.cut-stair-to-red-gallery'
		);
		turn(
			'aftermath-tithe-pit',
			'mission.move.red-gallery-to-tithe-pit',
			'mission.move.red-gallery-to-tithe-pit'
		);
		turn('aftermath-split-party', 'mission.move.red-gallery-to-tithe-pit', 'mission.hold');

		let injuryEvent: AuthoritativeEvent | null = null;
		for (let round = 5; round <= 12 && state.mission.attempt?.status === 'resolving'; round += 1) {
			const heroAction = legalActions(state, heroId).find(
				(action) =>
					action.actionId.startsWith('mission.inspect.') ||
					action.actionId.startsWith('mission.attack.')
			);
			expect(heroAction).toBeDefined();
			const result = turn(`aftermath-pressure-${round}`, 'mission.hold', heroAction!.actionId);
			if (!injuryEvent && state.mission.aftermath.consequences.length > 0) {
				injuryEvent = result.events[0]!;
				break;
			}
		}

		expect(injuryEvent).not.toBeNull();
		const firstConsequence = state.mission.aftermath.consequences[0]!;
		expect(firstConsequence).toMatchObject({
			targetHeroId: heroId,
			nodeId: 'tithe-pit',
			guardAfterImpact: 0,
			damage: 25,
			fatal: false,
			itemWear: { itemId, durabilityBefore: 6, durabilityAfter: 5 },
			witnesses: [expect.objectContaining({ heroId })]
		});
		expect(state.heroes[heroId]!.health).toBeLessThanOrEqual(75);
		expect(state.heroes[heroId]).toMatchObject({ lifeState: 'active' });
		expect(state.heroes[heroId]!.injuries.length).toBeGreaterThanOrEqual(1);
		expect(state.items[itemId]!.durability).toBeLessThanOrEqual(5);
		const injuryObservation = Object.values(state.society.observations).find(
			(observation) => observation.kind === 'mission-injury'
		);
		expect(injuryObservation).toMatchObject({
			sourceEventId: injuryEvent!.eventId,
			observerHeroId: heroId,
			subjectIds: [heroId, masterId]
		});
		const relationship = Object.values(state.society.relationships).find(
			(candidate) => candidate.fromHeroId === heroId && candidate.toEntityId === masterId
		)!;
		expect(relationship.dimensions.trust).toBeLessThanOrEqual(-3);
		expect(relationship.dimensions.fear).toBeGreaterThanOrEqual(2);
		expect(relationship.dimensions.resentment).toBeGreaterThanOrEqual(2);
		expect(
			relationship.evidence.some(
				(evidence) => evidence.observationId === injuryObservation?.observationId
			)
		).toBe(true);

		for (let round = 13; round <= 20 && state.mission.attempt?.status === 'resolving'; round += 1) {
			const heroAction = legalActions(state, heroId).find((action) =>
				action.actionId.startsWith('mission.attack.')
			);
			expect(heroAction).toBeDefined();
			turn(`aftermath-fatal-${round}`, 'mission.hold', heroAction!.actionId);
		}

		expect(state.mission.attempt).toMatchObject({ status: 'death', outcome: 'death' });
		expect(state.heroes[heroId]).toMatchObject({ health: 0, lifeState: 'dead' });
		expect(state.mission.aftermath.consequences.at(-1)).toMatchObject({
			targetHeroId: heroId,
			fatal: true,
			healthAfter: 0,
			injury: null
		});
		expect(legalActions(state, heroId)).toEqual([]);

		const replay = replayEventsStrict(events);
		expect(replay.verified).toBe(true);
		expect(replay.snapshot.state).toEqual(state);
		expect(replay.snapshot.stateHash).toBe(hashGameState(state));
		expect(JSON.stringify(events)).not.toContain('sourceAttemptId');
	});

	it('atomically seals the run when the controllable Master dies in a mission', () => {
		const runId = deterministicUuid('mission-master-death-run');
		const heroId = deterministicUuid('mission-master-death-hero');
		const bootstrap = createBootstrapEngine({
			runId,
			seed: 'mission-master-death-seed',
			heroId,
			manifestHash: sha256Hex('mission-master-death-manifest'),
			developmentMissionScenario: {
				initialMissionId: 'tower-floor-03',
				availableMissionIds: ['tower-floor-03'],
				enableMasterPermadeath: true
			}
		});
		let state = EngineGameStateV17Schema.parse(bootstrap.snapshot.state);
		const masterId = state.master.masterId;
		const events: AuthoritativeEvent[] = [bootstrap.event];
		const commit = (key: string, body: object) => {
			const result = applyCommand(state, {
				...commandBase(state, masterId, key),
				source: manualSource(),
				...body
			} as unknown as EngineCommand);
			state = EngineGameStateV17Schema.parse(result.state);
			events.push(...result.events);
			return result;
		};
		const turn = (key: string, masterActionId: string, heroActionId: string) =>
			commit(key, {
				commandType: 'mission.resolve.turn',
				choices: [
					manualMissionChoice(masterId, masterActionId),
					scriptedMissionChoice(heroId, heroActionId)
				]
			});

		commit('master-death-direction', {
			commandType: 'master.issue.directive',
			text: 'Stay with me and guard the living.',
			scope: 'mission',
			recipientIds: [heroId],
			priorities: ['guard'],
			tone: 'urgent',
			delivery: 'private'
		});
		commit('master-death-prepare', {
			commandType: 'mission.prepare',
			heroIds: [heroId],
			missionId: 'tower-floor-03'
		});
		commit('master-death-deploy', { commandType: 'mission.deploy' });
		turn(
			'master-death-cut-stair',
			'mission.move.threshold-to-cut-stair',
			'mission.move.threshold-to-cut-stair'
		);
		turn(
			'master-death-red-gallery',
			'mission.move.cut-stair-to-red-gallery',
			'mission.move.cut-stair-to-red-gallery'
		);
		turn(
			'master-death-tithe-pit',
			'mission.move.red-gallery-to-tithe-pit',
			'mission.move.red-gallery-to-tithe-pit'
		);
		let fatal = turn(
			'master-death-return-red-gallery',
			'mission.move.red-gallery-to-tithe-pit',
			'mission.move.red-gallery-to-tithe-pit'
		);
		for (let round = 5; round <= 10 && state.status === 'active'; round += 1) {
			fatal = turn(`master-death-hold-${round}`, 'mission.hold', 'mission.hold');
		}

		expect(state).toMatchObject({
			status: 'game_over',
			master: { masterId, health: 0, lifeState: 'dead' }
		});
		expect(state.mission.attempt).toMatchObject({ status: 'death', outcome: 'death' });
		expect(state.mission.aftermath.consequences).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					consequenceKind: 'master-harm',
					targetMasterId: masterId,
					sourceId: 'red-slag-fall',
					fatal: true,
					healthAfter: 0
				})
			])
		);
		expect(fatal.events[0]!.payload).toMatchObject({
			summary: expect.stringContaining('run was atomically sealed')
		});
		expect(legalActions(state, masterId)).toEqual([]);
		expect(legalActions(state, heroId)).toEqual([]);

		const replay = replayEventsStrict(events);
		expect(replay.verified).toBe(true);
		expect(replay.snapshot.state).toEqual(state);
		expect(replay.snapshot.stateHash).toBe(hashGameState(state));
		expect(JSON.stringify(events)).not.toContain('sourceAttemptId');
	});

	it('archives one attempt aftermath before a later mission and replays both exactly', () => {
		const runId = deterministicUuid('attempt-aftermath-run');
		const heroId = deterministicUuid('attempt-aftermath-hero');
		const bootstrap = createBootstrapEngine({
			runId,
			seed: 'mission-aftermath-seed',
			heroId,
			manifestHash: sha256Hex('attempt-aftermath-manifest'),
			developmentMissionScenario: {
				initialMissionId: 'tower-floor-04',
				availableMissionIds: ['tower-floor-04', 'tower-floor-05'],
				enableAttemptAftermath: true
			}
		});
		let state = EngineGameStateV18Schema.parse(bootstrap.snapshot.state);
		const masterId = state.master.masterId;
		const events: AuthoritativeEvent[] = [bootstrap.event];
		const commit = (key: string, body: object) => {
			const result = applyCommand(state, {
				...commandBase(state, masterId, key),
				source: manualSource(),
				...body
			} as unknown as EngineCommand);
			state = EngineGameStateV18Schema.parse(result.state);
			events.push(...result.events);
			return result;
		};
		const turn = (key: string, masterActionId: string, heroActionId: string) =>
			commit(key, {
				commandType: 'mission.resolve.turn',
				choices: [
					manualMissionChoice(masterId, masterActionId),
					scriptedMissionChoice(heroId, heroActionId)
				]
			});

		commit('attempt-one-prepare', {
			commandType: 'mission.prepare',
			heroIds: [heroId],
			missionId: 'tower-floor-04'
		});
		const sourceAttemptId = state.mission.attempt!.attemptId;
		commit('attempt-one-deploy', { commandType: 'mission.deploy' });
		turn(
			'attempt-one-balance',
			'mission.move.threshold-to-balance-hall',
			'mission.move.threshold-to-balance-hall'
		);
		turn(
			'attempt-one-left-relay',
			'mission.move.balance-hall-to-left-relay',
			'mission.move.balance-hall-to-left-relay'
		);
		turn('attempt-one-open-archive', 'mission.hold', 'mission.inspect.open-archive-niche');
		turn(
			'attempt-one-enter-archive',
			'mission.move.left-relay-to-archive-niche',
			'mission.move.left-relay-to-archive-niche'
		);
		turn('attempt-one-read-schematic', 'mission.hold', 'mission.inspect.read-foundry-schematic');
		turn(
			'attempt-one-leave-archive',
			'mission.move.left-relay-to-archive-niche',
			'mission.move.left-relay-to-archive-niche'
		);
		turn(
			'attempt-one-return-balance',
			'mission.move.balance-hall-to-left-relay',
			'mission.move.balance-hall-to-left-relay'
		);
		turn(
			'attempt-one-return-threshold',
			'mission.move.threshold-to-balance-hall',
			'mission.move.threshold-to-balance-hall'
		);
		expect(state.mission.aftermath.consequences).toEqual(
			expect.arrayContaining([expect.objectContaining({ sourceAttemptId, fatal: false })])
		);

		commit('attempt-one-retreat', { commandType: 'mission.retreat' });
		const finalRoundNumber = state.mission.attempt!.turnState.roundNumber;

		commit('attempt-two-prepare', {
			commandType: 'mission.prepare',
			heroIds: [heroId],
			missionId: 'tower-floor-05'
		});
		const activeAttemptId = state.mission.attempt!.attemptId;
		expect(activeAttemptId).not.toBe(sourceAttemptId);
		expect(state.mission.aftermath).toMatchObject({
			aftermathVersion: 'mission-aftermath-v3',
			activeAttemptId,
			consequences: [],
			archives: [
				{
					attemptId: sourceAttemptId,
					ordinal: 1,
					binding: expect.objectContaining({ missionId: 'tower-floor-04' }),
					outcome: 'retreat',
					finalRoundNumber,
					consequences: [expect.objectContaining({ sourceAttemptId })]
				}
			]
		});
		expect(
			MissionRunStateV8Schema.safeParse({
				...state.mission,
				aftermath: {
					...state.mission.aftermath,
					consequences: state.mission.aftermath.archives[0]!.consequences
				}
			}).success
		).toBe(false);
		expect(
			MissionRunStateV8Schema.safeParse({
				...state.mission,
				aftermath: {
					...state.mission.aftermath,
					archives: state.mission.aftermath.archives.map((archive) => ({
						...archive,
						consequences: archive.consequences.map((consequence) => ({
							...consequence,
							sourceAttemptId: activeAttemptId
						}))
					}))
				}
			}).success
		).toBe(false);
		commit('attempt-two-deploy', { commandType: 'mission.deploy' });
		expect(state.mission.attempt).toMatchObject({
			attemptId: activeAttemptId,
			ordinal: 2,
			status: 'deployed',
			turnState: { roundNumber: 0 }
		});

		const replay = replayEventsStrict(events);
		expect(replay.verified).toBe(true);
		expect(replay.snapshot.state).toEqual(state);
		expect(replay.snapshot.stateHash).toBe(hashGameState(state));
	});

	it('owns Wait, Countdown, Step, and Continuous Master timing in replayable state', () => {
		const runId = deterministicUuid('master-timing-run');
		const heroId = deterministicUuid('master-timing-hero');
		const bootstrap = createBootstrapEngine({
			runId,
			seed: 'master-timing-seed',
			heroId,
			manifestHash: sha256Hex('master-timing-manifest'),
			developmentMissionScenario: {
				initialMissionId: 'tower-floor-01',
				availableMissionIds: ['tower-floor-01'],
				enableMasterTiming: true
			}
		});
		let state = EngineGameStateV19Schema.parse(bootstrap.snapshot.state);
		const masterId = state.master.masterId;
		const events: AuthoritativeEvent[] = [bootstrap.event];
		const controlSource = manualSource();
		const timingSource = (sourceKind: 'manual' | 'countdown' | 'step' | 'continuous') => ({
			source: sourceKind,
			timing: sourceKind === 'manual' ? state.masterControl.timing : sourceKind,
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		});
		const policyChoice = (actionId: string) => ({
			actorId: masterId,
			actionId,
			source: 'scripted' as const,
			policyId: 'master-timing-baseline-v1',
			packetHash: sha256Hex(`${state.version}:master:packet`),
			legalActionHash: sha256Hex(`${state.version}:master:legal`),
			policyResultHash: sha256Hex(`${state.version}:master:result`),
			publicIntent: 'The deterministic timing baseline chose to hold position.'
		});
		const commit = (key: string, body: object, sourceOverride: ActionSource = controlSource) => {
			const result = applyCommand(state, {
				...commandBase(state, masterId, key),
				source: sourceOverride,
				...body
			} as unknown as EngineCommand);
			state = EngineGameStateV19Schema.parse(result.state);
			events.push(...result.events);
			return result;
		};
		const resolve = (
			key: string,
			resolvedAt: string,
			sourceKind: 'manual' | 'countdown' | 'step' | 'continuous'
		) => {
			const decision = state.masterControl.activeDecision!;
			return commit(
				key,
				{
					commandType: 'mission.resolve.turn',
					decisionId: decision.decisionId,
					resolvedAt,
					choices: [
						sourceKind === 'manual'
							? manualMissionChoice(masterId, 'mission.hold')
							: policyChoice('mission.hold'),
						scriptedMissionChoice(heroId, 'mission.hold')
					]
				},
				timingSource(sourceKind)
			);
		};

		commit('timing-prepare', {
			commandType: 'mission.prepare',
			heroIds: [heroId],
			missionId: 'tower-floor-01'
		});
		commit('timing-deploy', { commandType: 'mission.deploy' });
		commit('timing-open-wait', {
			commandType: 'master.open.decision',
			observedAt: '2030-01-01T00:00:00.000Z'
		});
		expect(state.masterControl.activeDecision).toMatchObject({ timing: 'wait', expiresAt: null });
		resolve('timing-wait-manual', '2030-01-01T00:00:04.000Z', 'manual');
		expect(state.masterControl).toMatchObject({
			timing: 'wait',
			lastResolution: { outcome: 'manual', expiryOutcome: 'not-applicable' },
			activeDecision: { timing: 'wait' }
		});

		commit('timing-countdown', {
			commandType: 'master.configure.timing',
			timing: 'countdown',
			countdownSeconds: 5,
			observedAt: '2030-01-01T00:00:05.000Z'
		});
		const countdown = state.masterControl.activeDecision!;
		expect(countdown.expiresAt).toBe('2030-01-01T00:00:10.000Z');
		expect(() => resolve('timing-countdown-late-manual', countdown.expiresAt!, 'manual')).toThrow(
			IllegalActionError
		);
		resolve('timing-countdown-expired', countdown.expiresAt!, 'countdown');
		expect(state.masterControl.lastResolution).toMatchObject({
			outcome: 'fallback',
			expiryOutcome: 'expired-to-fallback'
		});

		commit('timing-step', {
			commandType: 'master.configure.timing',
			timing: 'step',
			countdownSeconds: 5,
			observedAt: '2030-01-01T00:00:11.000Z'
		});
		resolve('timing-step-once', '2030-01-01T00:00:11.000Z', 'step');
		expect(state.masterControl).toMatchObject({
			timing: 'wait',
			lastResolution: { outcome: 'fallback', expiryOutcome: 'immediate-fallback' },
			activeDecision: { timing: 'wait' }
		});

		commit('timing-continuous', {
			commandType: 'master.configure.timing',
			timing: 'continuous',
			countdownSeconds: 5,
			observedAt: '2030-01-01T00:00:12.000Z'
		});
		resolve('timing-continuous-one', '2030-01-01T00:00:12.000Z', 'continuous');
		resolve('timing-continuous-two', '2030-01-01T00:00:13.000Z', 'continuous');
		expect(state.masterControl).toMatchObject({
			timing: 'continuous',
			lastResolution: { outcome: 'fallback' },
			activeDecision: { timing: 'continuous', ordinal: 9 }
		});

		const replay = replayEventsStrict(events);
		expect(replay.verified).toBe(true);
		expect(replay.snapshot.state).toEqual(state);
		expect(replay.snapshot.stateHash).toBe(hashGameState(state));
	});

	it('selects directed and seeded-random fallbacks with replayable safety stops', () => {
		const runId = deterministicUuid('master-fallback-run');
		const heroId = deterministicUuid('master-fallback-hero');
		const bootstrap = createBootstrapEngine({
			runId,
			seed: 'master-fallback-seed',
			heroId,
			manifestHash: sha256Hex('master-fallback-manifest'),
			developmentMissionScenario: {
				initialMissionId: 'tower-floor-01',
				availableMissionIds: ['tower-floor-01'],
				enableMasterFallback: true
			}
		});
		let state = EngineGameStateV20Schema.parse(bootstrap.snapshot.state);
		const masterId = state.master.masterId;
		const events: AuthoritativeEvent[] = [bootstrap.event];
		const commit = (key: string, body: object, sourceOverride: ActionSource = manualSource()) => {
			const result = applyCommand(state, {
				...commandBase(state, masterId, key),
				source: sourceOverride,
				...body
			} as unknown as EngineCommand);
			state = EngineGameStateV20Schema.parse(result.state);
			events.push(...result.events);
			return result;
		};
		const configure = (
			key: string,
			observedAt: string,
			policy: 'directed' | 'random',
			directionText: string,
			priorities: Array<
				'protect-self' | 'protect-party' | 'focus-objective' | 'seek-secrets' | 'conserve-resources'
			>,
			safetyStops: {
				beforeIrreversibleAction: boolean;
				masterHealthThreshold: number | null;
				whenUnclassified: boolean;
				maximumConsecutiveFallbacks: number | null;
			}
		) =>
			commit(key, {
				commandType: 'master.configure.fallback',
				policy,
				directionText,
				priorities,
				protectedHeroId: null,
				safetyStops,
				observedAt
			});
		const setTiming = (key: string, observedAt: string, timing: 'wait' | 'continuous') =>
			commit(key, {
				commandType: 'master.configure.timing',
				timing,
				countdownSeconds: 5,
				observedAt
			});
		const applySafety = (key: string, observedAt: string) => {
			const decisionId = state.masterControl.activeDecision!.decisionId;
			return commit(
				key,
				{ commandType: 'master.apply.safety-stop', decisionId, observedAt },
				masterFallbackSafetySource(state)
			);
		};
		const resolveFallback = (key: string, resolvedAt: string) => {
			const decisionId = state.masterControl.activeDecision!.decisionId;
			return commit(
				key,
				{
					commandType: 'mission.resolve.turn',
					decisionId,
					resolvedAt,
					choices: [
						masterFallbackMissionChoice(state),
						scriptedMissionChoice(heroId, 'mission.hold')
					]
				},
				masterFallbackActionSource(state)
			);
		};
		const noSafety = {
			beforeIrreversibleAction: false,
			masterHealthThreshold: null,
			whenUnclassified: false,
			maximumConsecutiveFallbacks: null
		};

		commit('fallback-prepare', {
			commandType: 'mission.prepare',
			heroIds: [heroId],
			missionId: 'tower-floor-01'
		});
		const deployAction = legalActions(state, masterId).find(
			(candidate) => candidate.actionId === 'mission.deploy'
		)!;
		expect(isIrreversibleMasterAction(deployAction)).toBe(true);
		commit('fallback-deploy', { commandType: 'mission.deploy' });

		configure(
			'fallback-health-config',
			'2030-01-01T00:00:00.000Z',
			'directed',
			'Advance the objective while protecting the company.',
			['focus-objective', 'protect-self', 'protect-party'],
			{ ...noSafety, masterHealthThreshold: 100 }
		);
		setTiming('fallback-health-timing', '2030-01-01T00:00:01.000Z', 'continuous');
		commit('fallback-health-open', {
			commandType: 'master.open.decision',
			observedAt: '2030-01-01T00:00:02.000Z'
		});
		const directed = selectMasterFallback(state);
		expect(selectMasterFallback(state)).toEqual(directed);
		expect(directed).toMatchObject({
			policy: 'directed',
			classification: 'classified',
			safetyStopReason: 'master-health'
		});
		applySafety('fallback-health-stop', '2030-01-01T00:00:03.000Z');
		expect(state.masterControl).toMatchObject({
			timing: 'wait',
			lastResolution: { outcome: 'safety-stopped' },
			activeDecision: { timing: 'wait' }
		});

		configure(
			'fallback-limit-config',
			'2030-01-01T00:00:04.000Z',
			'directed',
			'Seek the objective and defend if threatened.',
			['focus-objective', 'protect-self'],
			{ ...noSafety, maximumConsecutiveFallbacks: 1 }
		);
		setTiming('fallback-limit-timing', '2030-01-01T00:00:05.000Z', 'continuous');
		resolveFallback('fallback-limit-first-turn', '2030-01-01T00:00:06.000Z');
		expect(selectMasterFallback(state).safetyStopReason).toBe('fallback-limit');
		applySafety('fallback-limit-stop', '2030-01-01T00:00:07.000Z');

		configure(
			'fallback-random-config',
			'2030-01-01T00:00:08.000Z',
			'random',
			'Let the seed choose among the current legal actions.',
			[],
			noSafety
		);
		setTiming('fallback-random-timing', '2030-01-01T00:00:09.000Z', 'continuous');
		const random = selectMasterFallback(state);
		expect(selectMasterFallback(state)).toEqual(random);
		expect(random).toMatchObject({ policy: 'random', safetyStopReason: null });
		resolveFallback('fallback-random-turn', '2030-01-01T00:00:10.000Z');

		configure(
			'fallback-unclassified-config',
			'2030-01-01T00:00:11.000Z',
			'directed',
			'Dance beautifully.',
			[],
			{ ...noSafety, whenUnclassified: true }
		);
		expect(selectMasterFallback(state)).toMatchObject({
			classification: 'unclassified',
			safetyStopReason: 'unclassified-state'
		});
		applySafety('fallback-unclassified-stop', '2030-01-01T00:00:12.000Z');

		const replay = replayEventsStrict(events);
		expect(replay.verified).toBe(true);
		expect(replay.snapshot.state).toEqual(state);
		expect(replay.snapshot.stateHash).toBe(hashGameState(state));
		const tampered = structuredClone(events);
		const fallbackEvent = tampered.find((event) => event.eventType === 'master.fallback.changed')!;
		(fallbackEvent.payload as { directionText: string }).directionText = 'Tampered direction.';
		expect(() => replayEventsStrict(tampered)).toThrow(ReplayIntegrityError);
	});

	it('extracts finite Iron Moon ore before the deterministic portal collapse', () => {
		const runId = deterministicUuid('iron-moon-runtime-run');
		const heroId = deterministicUuid('iron-moon-runtime-hero');
		const bootstrap = createBootstrapEngine({
			runId,
			seed: 'iron-moon-runtime-seed',
			heroId,
			manifestHash: sha256Hex('iron-moon-runtime-manifest'),
			developmentMissionScenario: {
				initialMissionId: 'iron-moon',
				availableMissionIds: ['iron-moon']
			}
		});
		let state = EngineGameStateV15Schema.parse(bootstrap.snapshot.state);
		const masterId = state.master.masterId;
		const events: AuthoritativeEvent[] = [bootstrap.event];
		const commit = (command: EngineCommand) => {
			const result = applyCommand(state, command);
			state = EngineGameStateV15Schema.parse(result.state);
			events.push(...result.events);
			return result;
		};
		const missionCommand = (key: string, body: object): EngineCommand =>
			({
				...commandBase(state, masterId, key),
				source: manualSource(),
				...body
			}) as unknown as EngineCommand;
		const resolve = (key: string, masterActionId: string, heroActionId: string) =>
			commit(
				missionCommand(key, {
					commandType: 'mission.resolve.turn',
					choices: [
						manualMissionChoice(masterId, masterActionId),
						scriptedMissionChoice(heroId, heroActionId)
					]
				})
			);

		commit(
			missionCommand('iron-moon-prepare', {
				commandType: 'mission.prepare',
				heroIds: [heroId],
				missionId: 'iron-moon'
			})
		);
		commit(missionCommand('iron-moon-deploy', { commandType: 'mission.deploy' }));
		expect(state.mission.attempt?.turnState.portal).toMatchObject({
			roundsRemaining: 8,
			pressureStage: 'stable',
			extractionCredited: false
		});

		resolve('iron-moon-shelf', 'mission.move.gate-to-shelf', 'mission.move.gate-to-shelf');
		resolve(
			'iron-moon-split',
			'mission.move.shelf-to-pale-vein',
			'mission.move.shelf-to-crater-heart'
		);
		resolve(
			'iron-moon-mine-one',
			'mission.mine.pale-vein-deposit',
			'mission.mine.crater-heart-deposit'
		);
		resolve(
			'iron-moon-mine-two',
			'mission.mine.pale-vein-deposit',
			'mission.mine.crater-heart-deposit'
		);
		expect(state.mission.attempt?.turnState.objective).toMatchObject({
			status: 'quota-met',
			minedAmount: 6,
			quotaReachedOnRound: 4
		});
		expect(state.mission.attempt?.turnState.portal).toMatchObject({
			roundsRemaining: 4,
			pressureStage: 'warning'
		});
		expect(
			Object.fromEntries(
				Object.entries(state.mission.attempt!.turnState.portal.cargo).map(([actorId, cargo]) => [
					actorId,
					cargo.amount
				])
			)
		).toEqual({ [masterId]: 2, [heroId]: 4 });

		resolve(
			'iron-moon-regroup',
			'mission.move.shelf-to-pale-vein',
			'mission.move.shelf-to-crater-heart'
		);
		const returned = resolve(
			'iron-moon-return',
			'mission.move.gate-to-shelf',
			'mission.move.gate-to-shelf'
		);
		expect(state.mission.attempt).toMatchObject({
			status: 'extraction',
			completedObjectiveIds: ['extract-iron-ore'],
			turnState: {
				objective: { status: 'delivered', deliveredOnRound: 6 },
				portal: { roundsRemaining: 2, pressureStage: 'critical', extractionCredited: false }
			}
		});
		expect(returned.events[0]?.payload.rewardDeltas).toEqual([]);
		expect(state.settlement.resources['iron-ore']).toBe(2);

		const extracted = commit(
			missionCommand('iron-moon-extract', { commandType: 'mission.extract' })
		);
		expect(state.mission.attempt).toMatchObject({
			status: 'success',
			turnState: { portal: { extractedAmount: 6, extractionCredited: true } }
		});
		expect(state.settlement.resources['iron-ore']).toBe(8);
		expect(state.settlement.resourceLedger.at(-1)).toMatchObject({
			resource: 'iron-ore',
			before: 2,
			after: 8,
			delta: 6,
			reason: 'Iron Moon portal extraction'
		});
		expect(extracted.events[0]?.payload.rewardDeltas).toEqual([
			expect.objectContaining({ kind: 'resource', key: 'iron-ore', before: 2, after: 8, delta: 6 })
		]);
		expect(state.mission.attempt?.turnState.portal.oreLedger.map((entry) => entry.kind)).toEqual([
			'mined',
			'mined',
			'mined',
			'mined',
			'extracted',
			'extracted'
		]);

		const replay = replayEventsStrict(events);
		expect(replay.snapshot.state).toEqual(state);
		expect(replay.snapshot.stateHash).toBe(hashGameState(state));
	});

	it('collapses the Iron Moon portal at zero and records carried ore as lost', () => {
		const runId = deterministicUuid('iron-moon-collapse-run');
		const heroId = deterministicUuid('iron-moon-collapse-hero');
		const bootstrap = createBootstrapEngine({
			runId,
			seed: 'iron-moon-collapse-seed',
			heroId,
			manifestHash: sha256Hex('iron-moon-collapse-manifest'),
			developmentMissionScenario: {
				initialMissionId: 'iron-moon',
				availableMissionIds: ['iron-moon']
			}
		});
		let state = EngineGameStateV15Schema.parse(bootstrap.snapshot.state);
		const masterId = state.master.masterId;
		const events: AuthoritativeEvent[] = [bootstrap.event];
		const apply = (key: string, body: object) => {
			const result = applyCommand(state, {
				...commandBase(state, masterId, key),
				source: manualSource(),
				...body
			} as unknown as EngineCommand);
			state = EngineGameStateV15Schema.parse(result.state);
			events.push(...result.events);
		};
		const turn = (key: string, actionId: string) =>
			apply(key, {
				commandType: 'mission.resolve.turn',
				choices: [manualMissionChoice(masterId, actionId)]
			});

		apply('collapse-prepare', {
			commandType: 'mission.prepare',
			heroIds: [],
			missionId: 'iron-moon'
		});
		apply('collapse-deploy', { commandType: 'mission.deploy' });
		turn('collapse-shelf', 'mission.move.gate-to-shelf');
		turn('collapse-vein', 'mission.move.shelf-to-pale-vein');
		turn('collapse-mine-one', 'mission.mine.pale-vein-deposit');
		turn('collapse-mine-two', 'mission.mine.pale-vein-deposit');
		for (let round = 5; round <= 8; round += 1) turn(`collapse-hold-${round}`, 'mission.hold');

		expect(state.mission.attempt).toMatchObject({
			status: 'failure',
			outcome: 'failure',
			turnState: {
				portal: { roundsRemaining: 0, pressureStage: 'collapsed', extractionCredited: false }
			}
		});
		expect(state.mission.attempt?.turnState.portal.cargo[masterId]?.amount).toBe(0);
		expect(state.mission.attempt?.turnState.portal.oreLedger.at(-1)).toMatchObject({
			kind: 'lost',
			actorId: masterId,
			amount: 2,
			cargoBefore: 2,
			cargoAfter: 0
		});
		expect(state.settlement.resources['iron-ore']).toBe(2);
		expect(legalActions(state, masterId).map((action) => action.actionId)).toContain(
			'mission.prepare'
		);
		expect(replayEventsStrict(events).snapshot.state).toEqual(state);
	});

	it('spawns bound goblin duties, telegraphs threats, and resolves them in the shared ledger', () => {
		const bootstrap = fixture();
		if (bootstrap.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const initial = bootstrap.snapshot.state;
		const masterId = initial.master.masterId;
		const heroId = Object.keys(initial.heroes)[0]!;
		const prepared = applyCommand(initial, {
			...commandBase(initial, masterId, 'monster-duty-prepare'),
			source: manualSource(),
			commandType: 'mission.prepare',
			heroIds: [heroId]
		});
		const deployed = applyCommand(prepared.state, {
			...commandBase(prepared.state, masterId, 'monster-duty-deploy'),
			source: manualSource(),
			commandType: 'mission.deploy'
		});
		if (deployed.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const deployedAttempt = deployed.state.mission.attempt!;
		const monsters = Object.values(deployedAttempt.turnState.monsters);
		expect(deployedAttempt.turnState.policyBinding).toEqual({
			contentVersion: 'monster-policies-v1',
			contentHash: '5c1705e15afa8bd59d7a9cc545769044b47abd9d690eab27f3c6c2d361ee99c7'
		});
		expect(monsters.filter((monster) => monster.dutySlotId === 'goblin-chain-watch')).toHaveLength(
			2
		);
		expect(monsters.filter((monster) => monster.dutySlotId === 'goblin-ember-hauler')).toHaveLength(
			1
		);
		expect(deployedAttempt.turnState.currentThreatIntents).toHaveLength(3);
		expect(
			deployedAttempt.turnState.currentThreatIntents.every((intent) => intent.kind === 'hold')
		).toBe(true);
		expect(deployed.events[0]!.payload).toMatchObject({
			entropyDraws: [
				{ purpose: 'goblin-chain-watch-count', cursor: 0, value: 2 },
				{ purpose: 'goblin-ember-hauler-count', cursor: 1, value: 1 }
			]
		});

		let state = deployed.state;
		const roundEvents: AuthoritativeEvent[] = [];
		for (const [index, actionId] of [
			'mission.move.threshold-to-oath-hall',
			'mission.move.oath-hall-to-gallery',
			'mission.move.gallery-to-chain-court'
		].entries()) {
			const turn = applyCommand(state, {
				...commandBase(state, masterId, `monster-duty-move-${index}`),
				source: manualSource(),
				commandType: 'mission.resolve.turn',
				choices: [
					manualMissionChoice(masterId, actionId),
					scriptedMissionChoice(heroId, 'mission.hold')
				]
			});
			if (turn.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
			state = turn.state;
			roundEvents.push(...turn.events);
		}
		const attempt = state.mission.attempt!;
		const chainThreats = attempt.turnState.currentThreatIntents.filter(
			(intent) => attempt.turnState.monsters[intent.monsterId]!.dutySlotId === 'goblin-chain-watch'
		);
		expect(chainThreats.map((intent) => intent.kind)).toEqual(['strike', 'strike']);
		const attackId = legalActions(state, masterId)
			.map((action) => action.actionId)
			.find((actionId) => actionId.startsWith('mission.attack.'))!;
		const combat = applyCommand(state, {
			...commandBase(state, masterId, 'monster-duty-combat'),
			source: manualSource(),
			commandType: 'mission.resolve.turn',
			choices: [
				manualMissionChoice(masterId, attackId),
				scriptedMissionChoice(heroId, 'mission.hold')
			]
		});
		if (combat.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const round = combat.state.mission.attempt!.turnState.rounds.at(-1)!;
		expect(round.initiativeOrder).toHaveLength(round.actions.length + round.monsterActions.length);
		expect(round.monsterActions.filter((action) => action.kind === 'strike')).toHaveLength(2);
		expect(round.effects.some((effect) => effect.kind === 'vitality-damage')).toBe(true);
		expect(round.effects.some((effect) => effect.kind === 'guard-damage')).toBe(true);
		const replay = replayEventsStrict([
			bootstrap.event,
			...prepared.events,
			...deployed.events,
			...roundEvents,
			...combat.events
		]);
		expect(replay.snapshot.state).toEqual(combat.state);
	});

	it('makes the Foundry Warden furnace armor and cooling-control intent explicit', () => {
		const masterId = deterministicUuid('warden-policy-master');
		const monsterId = deterministicUuid('warden-policy-monster');
		const scenario = {
			mission: null,
			monster: {
				monsterId,
				dutySlotId: 'foundry-warden',
				policyId: 'foundry-warden-v1',
				label: 'Foundry Warden',
				ordinal: 1,
				nodeId: 'foundry-heart',
				status: 'active' as const,
				vitality: 18,
				maximumVitality: 18,
				alertState: 'duty' as const,
				defeatedOnRound: null,
				lastActionId: null
			},
			dutyNodeId: 'foundry-heart',
			objectiveNodeId: 'foundry-heart',
			objectiveStatus: 'available' as const,
			objectiveCarrierId: null,
			party: { masterId, heroIds: [], memberIds: [masterId] },
			partyPositions: { [masterId]: 'foundry-heart' },
			arena: {
				furnaceState: 'lit' as const,
				coolingControlNodeId: 'foundry-heart',
				coolingControlExposed: false
			}
		};
		expect(resolveMonsterPolicyIntent(scenario)).toMatchObject({
			kind: 'furnace-surge',
			targetId: masterId,
			policyId: 'foundry-warden-v1'
		});
		expect(monsterArmorReduction('foundry-warden-v1', 'lit')).toBe(3);
		expect(monsterArmorReduction('foundry-warden-v1', 'cooling')).toBe(1);
		expect(monsterArmorReduction('foundry-warden-v1', 'quenched')).toBe(0);
		expect(
			resolveMonsterPolicyIntent({
				...scenario,
				arena: { ...scenario.arena, coolingControlExposed: true }
			})
		).toMatchObject({ kind: 'defend-control', targetId: masterId });
	});

	it('keeps immutable engine-v12 party-only mission rounds replayable', () => {
		const modern = fixture();
		if (modern.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 fixture');
		const initial = EngineGameStateV12Schema.parse({
			...modern.snapshot.state,
			schemaVersion: 12,
			contentVersion: 'engine-v12'
		});
		const bootstrapEvent: AuthoritativeEvent = {
			...modern.event,
			schemaVersion: 12,
			contentVersion: 'engine-v12',
			afterStateHash: hashGameState(initial),
			payload: { ...modern.event.payload, initialState: initial }
		};
		const masterId = initial.master.masterId;
		const heroId = Object.keys(initial.heroes)[0]!;
		const prepared = applyCommand(initial, {
			...commandBase(initial, masterId, 'legacy-v12-prepare'),
			source: manualSource(),
			commandType: 'mission.prepare',
			heroIds: [heroId]
		});
		const deployed = applyCommand(prepared.state, {
			...commandBase(prepared.state, masterId, 'legacy-v12-deploy'),
			source: manualSource(),
			commandType: 'mission.deploy'
		});
		const resolved = applyCommand(deployed.state, {
			...commandBase(deployed.state, masterId, 'legacy-v12-round'),
			source: manualSource(),
			commandType: 'mission.resolve.turn',
			choices: [
				manualMissionChoice(masterId, 'mission.move.threshold-to-oath-hall'),
				scriptedMissionChoice(heroId, 'mission.hold')
			]
		});
		expect(resolved.state.schemaVersion).toBe(12);
		if (resolved.state.schemaVersion !== 12) throw new Error('Expected engine-v12 state');
		expect(resolved.state.mission.attempt?.turnState).toMatchObject({
			turnVersion: 'mission-turn-v1',
			roundNumber: 1
		});
		const replay = replayEventsStrict([
			bootstrapEvent,
			...prepared.events,
			...deployed.events,
			...resolved.events
		]);
		expect(replay.snapshot.state).toEqual(resolved.state);
	});

	it('keeps immutable engine-v11 proof-driven mission streams replayable', () => {
		const modern = fixture();
		if (modern.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 fixture');
		const initial = EngineGameStateV11Schema.parse({
			...modern.snapshot.state,
			schemaVersion: 11,
			contentVersion: 'engine-v11'
		});
		const bootstrapEvent: AuthoritativeEvent = {
			...modern.event,
			schemaVersion: 11,
			contentVersion: 'engine-v11',
			afterStateHash: hashGameState(initial),
			payload: { ...modern.event.payload, initialState: initial }
		};
		const heroId = Object.keys(initial.heroes)[0]!;
		const prepared = applyCommand(initial, {
			...commandBase(initial, initial.master.masterId, 'legacy-v11-prepare'),
			source: manualSource(),
			commandType: 'mission.prepare',
			heroIds: [heroId]
		});
		const deployed = applyCommand(prepared.state, {
			...commandBase(prepared.state, initial.master.masterId, 'legacy-v11-deploy'),
			source: manualSource(),
			commandType: 'mission.deploy'
		});
		const opened = applyCommand(deployed.state, {
			...commandBase(deployed.state, initial.master.masterId, 'legacy-v11-proof'),
			source: systemSource(),
			commandType: 'mission.open.extraction',
			completedObjectiveIds: ['recover-first-ember']
		});
		const extracted = applyCommand(opened.state, {
			...commandBase(opened.state, initial.master.masterId, 'legacy-v11-extract'),
			source: manualSource(),
			commandType: 'mission.extract'
		});

		const replay = replayEventsStrict([
			bootstrapEvent,
			...prepared.events,
			...deployed.events,
			...opened.events,
			...extracted.events
		]);
		expect(replay.snapshot.state).toEqual(extracted.state);
		expect(replay.snapshot.state.schemaVersion).toBe(11);
		expect(replay.verified).toBe(true);
	});

	it('persists legal secret discovery and terminates an idle mission at the round cap', () => {
		const bootstrap = fixture();
		if (bootstrap.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const initial = bootstrap.snapshot.state;
		const masterId = initial.master.masterId;
		const heroId = Object.keys(initial.heroes)[0]!;
		const prepared = applyCommand(initial, {
			...commandBase(initial, masterId, 'bounded-prepare'),
			source: manualSource(),
			commandType: 'mission.prepare',
			heroIds: [heroId]
		});
		const deployed = applyCommand(prepared.state, {
			...commandBase(prepared.state, masterId, 'bounded-deploy'),
			source: manualSource(),
			commandType: 'mission.deploy'
		});
		if (deployed.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const moved = applyCommand(deployed.state, {
			...commandBase(deployed.state, masterId, 'bounded-move'),
			source: manualSource(),
			commandType: 'mission.resolve.turn',
			choices: [
				manualMissionChoice(masterId, 'mission.move.threshold-to-oath-hall'),
				scriptedMissionChoice(heroId, 'mission.hold')
			]
		});
		if (moved.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const discovered = applyCommand(moved.state, {
			...commandBase(moved.state, masterId, 'bounded-discover'),
			source: manualSource(),
			commandType: 'mission.resolve.turn',
			choices: [
				manualMissionChoice(masterId, 'mission.inspect.inspect-soot-seam'),
				scriptedMissionChoice(heroId, 'mission.hold')
			]
		});
		if (discovered.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(discovered.state.mission.attempt?.knowledge.discoveryIds).toContain('soot-seam-route');
		expect(legalActions(discovered.state, masterId).map((action) => action.actionId)).toContain(
			'mission.move.oath-hall-to-ash-duct'
		);

		let state = discovered.state;
		const roundEvents = [...moved.events, ...discovered.events];
		for (let round = 3; round <= 48; round += 1) {
			const committed = applyCommand(state, {
				...commandBase(state, masterId, `bounded-hold-${round}`),
				source: manualSource(),
				commandType: 'mission.resolve.turn',
				choices: [
					manualMissionChoice(masterId, 'mission.hold'),
					scriptedMissionChoice(heroId, 'mission.hold')
				]
			});
			if (committed.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
			state = committed.state;
			roundEvents.push(...committed.events);
		}

		expect(state.mission.attempt).toMatchObject({
			status: 'failure',
			outcome: 'failure',
			endedAt: initial.simulatedAt,
			turnState: { roundNumber: 48 }
		});
		expect(legalActions(state, masterId).map((action) => action.actionId)).toContain(
			'mission.prepare'
		);
		const replay = replayEventsStrict([
			bootstrap.event,
			...prepared.events,
			...deployed.events,
			...roundEvents
		]);
		expect(replay.snapshot.state).toEqual(state);
		expect(replay.verified).toBe(true);
	});

	it('records witnessed directions and consumes decision scope through an influence record', () => {
		const bootstrap = fixture();
		if (bootstrap.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const heroId = Object.keys(bootstrap.snapshot.state.heroes)[0]!;
		const heroActionsBefore = legalActions(bootstrap.snapshot.state, heroId).map(
			(action) => action.actionId
		);
		const issued = applyCommand(bootstrap.snapshot.state, {
			...commandBase(
				bootstrap.snapshot.state,
				bootstrap.snapshot.state.master.masterId,
				'issue-decision-direction'
			),
			source: manualSource(),
			commandType: 'master.issue.directive',
			text: 'Choose the training ground and begin preparing for the tower.',
			scope: 'decision',
			recipientIds: [heroId],
			priorities: ['training', 'tower-readiness'],
			tone: 'firm',
			delivery: 'private'
		});
		if (issued.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const directive = Object.values(issued.state.society.directives)[0]!;
		const act = Object.values(issued.state.society.communicativeActs).find(
			(candidate) => candidate.sourceEventId === issued.events[0]!.eventId
		)!;

		expect(directive).toMatchObject({
			text: 'Choose the training ground and begin preparing for the tower.',
			scope: 'decision',
			status: 'active',
			witnessEventId: issued.events[0]!.eventId,
			witnessObservationIds: [act.witnesses[0]!.observationId]
		});
		expect(act.witnesses[0]).toMatchObject({ heroId, role: 'intended', perception: 'addressed' });
		expect(legalActions(issued.state, heroId).map((action) => action.actionId)).toEqual(
			heroActionsBefore
		);

		const chosen = applyCommand(issued.state, {
			...commandBase(issued.state, heroId, 'follow-decision-direction'),
			source: {
				...source(),
				directiveIds: [directive.directiveId],
				decisionJobId: deterministicUuid('directive-decision-job')
			},
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'Training is the sensible first step.',
			storyBranch: 'steel-before-trust'
		});
		if (chosen.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const influence = Object.values(chosen.state.society.directiveInfluences)[0]!;
		expect(chosen.state.society.directives[directive.directiveId]).toMatchObject({
			status: 'consumed',
			terminalEventId: chosen.events[0]!.eventId
		});
		expect(influence).toMatchObject({
			directiveId: directive.directiveId,
			heroId,
			actionId: 'hero.choose.training-ground',
			outcome: 'advanced'
		});
		expect(projectJournal(chosen.events)[0]!.directionOutcome).toBe('advanced');
		const replay = replayEventsStrict([bootstrap.event, ...issued.events, ...chosen.events]);
		expect(replay.verified).toBe(true);
		expect(replay.snapshot.state).toEqual(chosen.state);
	});

	it.each([
		{
			outcome: 'conflicted' as const,
			text: 'Choose the kitchen and share a meal.',
			priorities: ['kitchen', 'meal']
		},
		{
			outcome: 'unavailable' as const,
			text: 'Sing a ballad beside the sealed tower.',
			priorities: ['sing', 'ballad']
		}
	])('records $outcome when a selected action cannot advance the direction', (scenario) => {
		const bootstrap = fixture();
		if (bootstrap.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const heroId = Object.keys(bootstrap.snapshot.state.heroes)[0]!;
		const issued = applyCommand(bootstrap.snapshot.state, {
			...commandBase(
				bootstrap.snapshot.state,
				bootstrap.snapshot.state.master.masterId,
				`issue-${scenario.outcome}-direction`
			),
			source: manualSource(),
			commandType: 'master.issue.directive',
			text: scenario.text,
			scope: 'decision',
			recipientIds: [heroId],
			priorities: scenario.priorities,
			tone: 'neutral',
			delivery: 'private'
		});
		if (issued.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const directive = Object.values(issued.state.society.directives)[0]!;
		const chosen = applyCommand(issued.state, {
			...commandBase(issued.state, heroId, `choose-${scenario.outcome}-direction`),
			source: { ...source(), directiveIds: [directive.directiveId] },
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'I will test my abilities first.',
			storyBranch: 'steel-before-trust'
		});
		if (chosen.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(Object.values(chosen.state.society.directiveInfluences)[0]?.outcome).toBe(
			scenario.outcome
		);
		expect(projectJournal(chosen.events)[0]?.directionOutcome).toBe(scenario.outcome);
	});

	it('replaces, revokes, and expires directions without deleting their history', () => {
		const bootstrap = fixture();
		if (bootstrap.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const heroId = Object.keys(bootstrap.snapshot.state.heroes)[0]!;
		const issue = (
			state: typeof bootstrap.snapshot.state,
			key: string,
			scope: 'day' | 'until_revoked'
		) =>
			applyCommand(state, {
				...commandBase(state, state.master.masterId, key),
				source: manualSource(),
				commandType: 'master.issue.directive',
				text: 'Rest before taking unnecessary risks.',
				scope,
				recipientIds: [heroId],
				priorities: ['rest', 'recovery'],
				tone: 'reassuring',
				delivery: 'private'
			});
		const day = issue(bootstrap.snapshot.state, 'issue-day-direction', 'day');
		if (day.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const original = Object.values(day.state.society.directives)[0]!;
		expect(day.scheduled[0]?.scheduledEventId).toBe(original.expiryScheduledEventId);
		const replaced = applyCommand(day.state, {
			...commandBase(day.state, day.state.master.masterId, 'replace-direction'),
			source: manualSource(),
			commandType: 'master.replace.directive',
			directiveId: original.directiveId,
			text: 'Prepare your equipment, then choose your own next task.',
			scope: 'until_revoked',
			recipientIds: [heroId],
			priorities: ['equipment', 'prepare'],
			tone: 'neutral',
			delivery: 'private'
		});
		if (replaced.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const replacement = Object.values(replaced.state.society.directives).find(
			(directive) => directive.status === 'active'
		)!;
		expect(replaced.state.society.directives[original.directiveId]).toMatchObject({
			status: 'replaced',
			replacedByDirectiveId: replacement.directiveId
		});
		expect(replaced.canceledScheduledEventIds).toEqual([original.expiryScheduledEventId]);
		const revoked = applyCommand(replaced.state, {
			...commandBase(replaced.state, replaced.state.master.masterId, 'revoke-direction'),
			source: manualSource(),
			commandType: 'master.revoke.directive',
			directiveId: replacement.directiveId
		});
		if (revoked.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(revoked.state.society.directives[replacement.directiveId]?.status).toBe('revoked');

		const expiring = issue(revoked.state, 'issue-expiring-direction', 'day');
		if (expiring.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const active = Object.values(expiring.state.society.directives).find(
			(directive) => directive.status === 'active'
		)!;
		const advanced = applyCommand(expiring.state, {
			...commandBase(expiring.state, expiring.state.master.masterId, 'expire-direction'),
			source: { ...source(), source: 'system', timing: null },
			commandType: 'simulation.advance',
			targetGameTime: active.expiresAt!
		});
		if (advanced.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(advanced.state.society.directives[active.directiveId]).toMatchObject({
			status: 'expired',
			terminalAt: active.expiresAt,
			terminalEventId: advanced.events[0]!.eventId
		});
		expect(advanced.resolvedScheduledEventIds).toEqual([active.expiryScheduledEventId]);
		const replay = replayEventsStrict([
			bootstrap.event,
			...day.events,
			...replaced.events,
			...revoked.events,
			...expiring.events,
			...advanced.events
		]);
		expect(replay.snapshot.state).toEqual(advanced.state);
	});

	it('boots a clean-slate hero with only direct awakening knowledge', () => {
		const bootstrap = fixture();
		if (bootstrap.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const state = bootstrap.snapshot.state;
		const heroId = Object.keys(state.heroes)[0]!;
		const observations = Object.values(state.society.observations);
		const beliefs = Object.values(state.society.beliefs);
		const relationship = Object.values(state.society.relationships)[0]!;
		const authority = Object.values(state.society.authority)[0]!;

		expect(observations).toHaveLength(1);
		expect(observations[0]).toMatchObject({
			observerHeroId: heroId,
			kind: 'awakening',
			sourceEventId: bootstrap.event.eventId
		});
		expect(beliefs.map((belief) => belief.predicate).sort()).toEqual([
			'awakened-at',
			'present-at-awakening'
		]);
		expect(JSON.stringify(beliefs)).not.toContain('tower');
		expect(JSON.stringify(beliefs)).not.toContain('authority');
		expect(relationship.dimensions).toEqual({
			trust: 0,
			respect: 0,
			fear: 0,
			affection: 0,
			resentment: 0,
			debt: 0
		});
		expect(authority.dimensions).toEqual({
			competence: 0,
			provision: 0,
			trust: 0,
			legitimacy: 0,
			fear: 0,
			strength: 0,
			consistency: 0
		});
		expect(state.society.promises).toEqual({});
		const belief = beliefs[0]!;
		expect(
			EngineGameStateV13Schema.safeParse({
				...state,
				society: {
					...state.society,
					beliefs: {
						...state.society.beliefs,
						[belief.beliefId]: {
							...belief,
							provenance: {
								...belief.provenance,
								observationId: deterministicUuid('missing-observation')
							}
						}
					}
				}
			}).success
		).toBe(false);
	});

	it('records exact private words while deriving only the selected structured claim', () => {
		const bootstrap = fixture();
		if (bootstrap.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const state = bootstrap.snapshot.state;
		const heroId = Object.keys(state.heroes)[0]!;
		const committed = applyCommand(state, {
			...commandBase(state, state.master.masterId, 'private-explanation'),
			source: manualSource(),
			commandType: 'master.communicate',
			targetHeroId: heroId,
			kind: 'explain',
			topic: 'master-role',
			exactText: 'I own Floor 100 and can make the sun rise.',
			tone: 'firm',
			delivery: 'private'
		});
		if (committed.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const act = Object.values(committed.state.society.communicativeActs)[0]!;
		const witness = act.witnesses[0]!;
		const belief = witness.beliefId ? committed.state.society.beliefs[witness.beliefId] : null;

		expect(act.exactText).toBe('I own Floor 100 and can make the sun rise.');
		expect(act.witnesses).toHaveLength(1);
		expect(act.claim).toEqual({
			subjectId: state.master.masterId,
			predicate: 'claims-master-role',
			object: { kind: 'text', text: 'Master of Hearth 01' }
		});
		expect(belief).toMatchObject({
			holderHeroId: heroId,
			predicate: 'claims-master-role',
			provenance: {
				kind: 'told',
				learnedFromId: state.master.masterId,
				observationId: witness.observationId,
				chainDepth: 1
			}
		});
		expect(JSON.stringify(belief)).not.toContain('Floor 100');
		const replay = replayEventsStrict([bootstrap.event, ...committed.events]);
		expect(replay.snapshot.state).toEqual(committed.state);
		const tampered = structuredClone(committed.events[0]!);
		(tampered.payload.communicativeAct as { exactText: string }).exactText =
			'I quietly changed the canonical words.';
		expect(() => replayEventsStrict([bootstrap.event, tampered])).toThrow();
	});

	it('records questions as witnessed observations without manufacturing beliefs', () => {
		const bootstrap = fixture();
		if (bootstrap.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const state = bootstrap.snapshot.state;
		const heroId = Object.keys(state.heroes)[0]!;
		const committed = applyCommand(state, {
			...commandBase(state, state.master.masterId, 'memory-question'),
			source: manualSource(),
			commandType: 'master.communicate',
			targetHeroId: heroId,
			kind: 'ask',
			topic: 'hero-memory',
			exactText: 'What do you remember before the gate?',
			tone: 'reassuring',
			delivery: 'private'
		});
		if (committed.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const act = Object.values(committed.state.society.communicativeActs)[0]!;
		expect(act.claim).toBeNull();
		expect(act.witnesses[0]).toMatchObject({
			heroId,
			role: 'intended',
			perception: 'addressed',
			beliefId: null
		});
		expect(Object.values(committed.state.society.beliefs)).toHaveLength(2);
	});

	it('rejects incompatible topics and heroes outside the communication scene', () => {
		const bootstrap = fixture();
		if (bootstrap.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const state = bootstrap.snapshot.state;
		const heroId = Object.keys(state.heroes)[0]!;
		const base = {
			...commandBase(state, state.master.masterId, 'invalid-communication'),
			source: manualSource(),
			commandType: 'master.communicate' as const,
			targetHeroId: heroId,
			exactText: 'Can you hear me?',
			tone: 'neutral' as const,
			delivery: 'private' as const
		};
		expect(() => applyCommand(state, { ...base, kind: 'ask', topic: 'master-role' })).toThrow(
			IllegalActionError
		);

		const remote = EngineGameStateV13Schema.parse({
			...state,
			heroes: {
				...state.heroes,
				[heroId]: {
					...state.heroes[heroId]!,
					location: 'kitchen',
					locationNodeId: 'kitchen-table'
				}
			}
		});
		expect(() =>
			applyCommand(remote, {
				...base,
				kind: 'explain',
				topic: 'master-role'
			})
		).toThrow(IllegalActionError);
	});

	it('lets only available co-located heroes overhear open communication', () => {
		const bootstrap = fixture();
		if (bootstrap.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const state = bootstrap.snapshot.state;
		const targetId = Object.keys(state.heroes)[0]!;
		const bystanderId = deterministicUuid('communication-bystander');
		const distantId = deterministicUuid('communication-distant');
		const target = state.heroes[targetId]!;
		const expanded = EngineGameStateV13Schema.parse({
			...state,
			heroes: {
				...state.heroes,
				[bystanderId]: {
					...target,
					heroId: bystanderId,
					equipment: { mainHand: null },
					assignment: null
				},
				[distantId]: {
					...target,
					heroId: distantId,
					location: 'kitchen',
					locationNodeId: 'kitchen-table',
					equipment: { mainHand: null },
					assignment: null
				}
			}
		});
		const committed = applyCommand(expanded, {
			...commandBase(expanded, expanded.master.masterId, 'open-explanation'),
			source: manualSource(),
			commandType: 'master.communicate',
			targetHeroId: targetId,
			kind: 'explain',
			topic: 'tower-mission',
			exactText: 'The tower is our shared mission.',
			tone: 'neutral',
			delivery: 'open'
		});
		if (committed.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const act = Object.values(committed.state.society.communicativeActs)[0]!;
		expect(act.witnesses.map((witness) => witness.heroId)).toEqual([targetId, bystanderId]);
		expect(act.witnesses[1]).toMatchObject({ role: 'bystander', perception: 'overheard' });
		expect(
			Object.values(committed.state.society.beliefs).some(
				(belief) => belief.holderHeroId === distantId
			)
		).toBe(false);
	});

	it('lets personality and circumstances resolve an order without executing it as an action', () => {
		const receptive = fixture();
		if (receptive.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const receptiveState = receptive.snapshot.state;
		const receptiveHeroId = Object.keys(receptiveState.heroes)[0]!;
		const exactText = 'Train at the practice ring before we enter the tower.';
		const accepted = applyCommand(receptiveState, {
			...commandBase(receptiveState, receptiveState.master.masterId, 'accepted-order'),
			source: manualSource(),
			commandType: 'master.converse',
			targetHeroId: receptiveHeroId,
			kind: 'order',
			exactText,
			tone: 'reassuring',
			delivery: 'private',
			orderIntent: 'train'
		});
		if (accepted.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const acceptedTurn = Object.values(accepted.state.society.conversationTurns)[0]!;

		expect(acceptedTurn.response).toMatchObject({
			orderOutcome: 'accepted',
			preferenceWeight: 24
		});
		expect(acceptedTurn.response.orderScore?.total).toBeGreaterThanOrEqual(24);
		expect(accepted.state.heroes[receptiveHeroId]).toMatchObject({
			destination: null,
			currentActivity: null,
			currentTravel: null,
			currentRoutine: null
		});
		expect(accepted.state.settlement.resources).toEqual(receptiveState.settlement.resources);
		expect(
			accepted.state.society.communicativeActs[acceptedTurn.communicationActId]?.exactText
		).toBe(exactText);

		const resistantHeroId = deterministicUuid('resistant-conversation-hero');
		const resistantRunId = deterministicUuid('resistant-conversation-run');
		const resistant = createBootstrapEngine({
			runId: resistantRunId,
			seed: 'resistant-conversation-seed',
			heroId: resistantHeroId,
			manifestHash: sha256Hex('resistant-conversation-manifest'),
			mind: {
				...receptiveState.heroes[receptiveHeroId]!.mind,
				personality: {
					openness: 70,
					conscientiousness: 5,
					extraversion: 40,
					agreeableness: 5,
					emotionalVolatility: 95
				},
				primaryValue: 'freedom',
				primaryDrive: 'understand',
				socialStyle: 'direct'
			}
		});
		if (resistant.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const refused = applyCommand(resistant.snapshot.state, {
			...commandBase(
				resistant.snapshot.state,
				resistant.snapshot.state.master.masterId,
				'refused-order'
			),
			source: manualSource(),
			commandType: 'master.converse',
			targetHeroId: resistantHeroId,
			kind: 'order',
			exactText,
			tone: 'firm',
			delivery: 'private',
			orderIntent: 'train'
		});
		if (refused.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const refusedTurn = Object.values(refused.state.society.conversationTurns)[0]!;
		expect(refusedTurn.response).toMatchObject({ orderOutcome: 'refused', preferenceWeight: 0 });
		expect(refusedTurn.response.exactText).not.toBe(acceptedTurn.response.exactText);

		const replay = replayEventsStrict([receptive.event, ...accepted.events]);
		expect(replay.snapshot.state).toEqual(accepted.state);
		const tampered = structuredClone(accepted.events[0]!);
		(
			tampered.payload.conversationTurn as { response: { preferenceWeight: number } }
		).response.preferenceWeight = 0;
		expect(() => replayEventsStrict([receptive.event, tampered])).toThrow();
	});

	it('applies and replays choice, arrival, and entropy-bearing commands byte-for-byte', () => {
		const bootstrap = fixture();
		const heroId = Object.keys(bootstrap.snapshot.state.heroes)[0]!;
		const runId = bootstrap.snapshot.state.runId;
		const choose: EngineCommand = {
			commandId: deterministicUuid(`${runId}:choose`),
			runId,
			actorId: heroId,
			expectedVersion: 0,
			correlationId: deterministicUuid(`${runId}:choose:correlation`),
			source: source(),
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'Let me test what this body remembers.',
			storyBranch: 'steel-before-trust'
		};
		const chosen = applyCommand(bootstrap.snapshot.state, choose);
		const traveling = applyCommand(chosen.state, {
			commandId: deterministicUuid(`${runId}:travel`),
			runId,
			actorId: heroId,
			expectedVersion: 1,
			correlationId: deterministicUuid(`${runId}:travel:correlation`),
			source: source(),
			commandType: 'hero.start.travel',
			targetNodeId: 'training-ring'
		});
		const arrived = applyCommand(traveling.state, {
			commandId: deterministicUuid(`${runId}:arrive`),
			runId,
			actorId: traveling.state.master.masterId,
			expectedVersion: 2,
			correlationId: deterministicUuid(`${runId}:arrive:correlation`),
			source: { ...source(), source: 'system', timing: null },
			commandType: 'simulation.advance',
			targetGameTime: traveling.scheduled[0]!.dueGameTime
		});
		const inspected = applyCommand(arrived.state, {
			commandId: deterministicUuid(`${runId}:inspect`),
			runId,
			actorId: arrived.state.master.masterId,
			expectedVersion: 3,
			correlationId: deterministicUuid(`${runId}:inspect:correlation`),
			source: { ...source(), source: 'manual', timing: 'step' },
			commandType: 'master.inspect.gate'
		});
		const events = [
			bootstrap.event,
			...chosen.events,
			...traveling.events,
			...arrived.events,
			...inspected.events
		];
		const replay = replayEventsStrict(events);

		expect(replay.snapshot.state).toEqual(inspected.state);
		expect(replay.snapshot.stateHash).toBe(inspected.stateHash);
		expect(replay.checks.every((check) => check.verified)).toBe(true);
		expect(replay.checks.at(-1)?.entropyDraws).toHaveLength(1);
	});

	it('rejects illegal and stale commands without mutating input state', () => {
		const bootstrap = fixture();
		const before = structuredClone(bootstrap.snapshot.state);
		const heroId = Object.keys(before.heroes)[0]!;
		const base = {
			commandId: deterministicUuid('illegal-command'),
			runId: before.runId,
			actorId: heroId,
			correlationId: deterministicUuid('illegal-correlation'),
			source: source()
		};

		expect(() =>
			applyCommand(before, { ...base, expectedVersion: 1, commandType: 'hero.arrive' })
		).toThrow(StaleStateVersionError);
		expect(() =>
			applyCommand(before, { ...base, expectedVersion: 0, commandType: 'hero.arrive' })
		).toThrow(IllegalActionError);
		expect(before).toEqual(bootstrap.snapshot.state);
	});

	it('schedules a content-bound route and commits location only at authoritative arrival', () => {
		const bootstrap = fixture();
		const heroId = Object.keys(bootstrap.snapshot.state.heroes)[0]!;
		const chosen = applyCommand(bootstrap.snapshot.state, {
			...commandBase(bootstrap.snapshot.state, heroId, 'choose-kitchen-route'),
			commandType: 'hero.choose.destination',
			destination: 'kitchen',
			firstLine: 'Names first.',
			storyBranch: 'names-before-orders'
		});
		const traveling = applyCommand(chosen.state, {
			...commandBase(chosen.state, heroId, 'travel-kitchen'),
			commandType: 'hero.start.travel',
			targetNodeId: 'kitchen-table'
		});
		if (traveling.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const inTransit = traveling.state.heroes[heroId]!;
		expect(inTransit.location).toBe('summoning-gate');
		expect(inTransit.locationNodeId).toBe('gate-dais');
		expect(inTransit.currentTravel).toMatchObject({
			fromNodeId: 'gate-dais',
			toNodeId: 'kitchen-table',
			settlementContentVersion: 'hearth-01-v1',
			settlementContentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9',
			route: {
				nodeIds: ['gate-dais', 'gate-court', 'courtyard-heart', 'kitchen-entry', 'kitchen-table'],
				totalTravelGameSeconds: 124
			}
		});
		expect(traveling.scheduled[0]).toMatchObject({
			eventKind: 'hero.travel.arrive',
			dueGameTime: '2000-01-01T00:02:04.000Z'
		});

		expect(() =>
			applyCommand(traveling.state, {
				...commandBase(traveling.state, traveling.state.master.masterId, 'arrive-early'),
				commandType: 'simulation.advance',
				targetGameTime: '2000-01-01T00:02:03.000Z'
			})
		).toThrow(IllegalActionError);

		const arrived = applyCommand(traveling.state, {
			...commandBase(traveling.state, traveling.state.master.masterId, 'arrive-on-time'),
			commandType: 'simulation.advance',
			targetGameTime: traveling.scheduled[0]!.dueGameTime
		});
		if (arrived.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(arrived.state.heroes[heroId]).toMatchObject({
			location: 'kitchen',
			locationNodeId: 'kitchen-table',
			currentTravel: null
		});
		expect(arrived.resolvedScheduledEventIds).toEqual([traveling.scheduled[0]!.scheduledEventId]);
		const replay = replayEventsStrict([
			bootstrap.event,
			...chosen.events,
			...traveling.events,
			...arrived.events
		]);
		expect(replay.snapshot.stateHash).toBe(arrived.stateHash);

		expect(() =>
			applyCommand(chosen.state, {
				...commandBase(chosen.state, heroId, 'ignore-first-destination'),
				commandType: 'hero.start.travel',
				targetNodeId: 'training-ring'
			})
		).toThrow(IllegalActionError);

		expect(() =>
			applyCommand(arrived.state, {
				...commandBase(arrived.state, heroId, 'travel-locked-forge'),
				commandType: 'hero.start.travel',
				targetNodeId: 'workshop-forge'
			})
		).toThrow(IllegalActionError);

		const died = applyCommand(traveling.state, {
			...commandBase(traveling.state, traveling.state.master.masterId, 'die-in-transit'),
			commandType: 'simulation.apply.damage',
			targetId: heroId,
			amount: 100,
			damageKind: 'hazard'
		});
		if (died.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(died.state.heroes[heroId]?.currentTravel).toBeNull();
		expect(died.canceledScheduledEventIds).toEqual([traveling.scheduled[0]!.scheduledEventId]);
	});

	it('detects a tampered replay hash at the exact event', () => {
		const bootstrap = fixture();
		const tampered = { ...bootstrap.event, afterStateHash: sha256Hex('tampered') };
		const replay = replayEvents([tampered]);

		expect(replay.verified).toBe(false);
		expect(replay.checks[0]?.sequence).toBe(1);
	});

	it('keeps immutable engine-v1 streams replayable under their original hash schema', () => {
		const runId = deterministicUuid('legacy-v1-run');
		const heroId = deterministicUuid('legacy-v1-hero');
		const masterId = deterministicUuid(`${runId}:master`);
		const commandId = deterministicUuid(`${runId}:bootstrap`);
		const state: EngineGameStateV1 = {
			schemaVersion: 1,
			runId,
			seed: 'legacy-seed',
			contentVersion: 'engine-v1',
			status: 'active',
			version: 0,
			eventCursor: 1,
			entropyCursor: 0,
			simulatedAt: '2000-01-01T00:00:00.000Z',
			master: {
				masterId,
				lifeState: 'alive',
				location: 'summoning-gate',
				health: 100,
				maxHealth: 100,
				gateInspectionCount: 0,
				lastGateResonance: null
			},
			heroes: {
				[heroId]: {
					heroId,
					lifeState: 'active',
					location: 'summoning-gate',
					destination: null,
					health: 100,
					maxHealth: 100,
					manifestHash: sha256Hex('legacy-manifest')
				}
			},
			story: { envelopeId: 'first-ember-v1', branch: null }
		};
		const bootstrapEvent: AuthoritativeEvent = {
			eventId: deterministicUuid(`${commandId}:1:run.initialized`),
			runId,
			sequence: 1,
			schemaVersion: 1,
			gameTime: state.simulatedAt,
			eventType: 'run.initialized',
			actorId: null,
			commandId,
			causationId: null,
			correlationId: commandId,
			source: { ...source(), source: 'system', timing: null },
			seedCursor: 0,
			beforeStateHash: EMPTY_STATE_HASH,
			afterStateHash: hashGameState(state),
			contentVersion: 'engine-v1',
			payload: { initialState: state, entropyDraws: [] }
		};
		const inspected = applyCommand(state, {
			...commandBase(state, masterId, 'legacy-inspect'),
			commandType: 'master.inspect.gate'
		});
		const replay = replayEventsStrict([bootstrapEvent, ...inspected.events]);

		expect(replay.snapshot.state).toEqual(inspected.state);
		expect(replay.snapshot.state.schemaVersion).toBe(1);
	});

	it('keeps immutable engine-v2 commands and reducer bytes on their original schema', () => {
		const modern = fixture();
		if (modern.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 fixture');
		const modernHero = Object.values(modern.snapshot.state.heroes)[0]!;
		const hero = { ...modernHero } as Record<string, unknown>;
		delete hero.locationNodeId;
		delete hero.firstArrivalCompleted;
		delete hero.currentTravel;
		delete hero.assignment;
		delete hero.mind;
		delete hero.habit;
		delete hero.dailyPlan;
		delete hero.currentRoutine;
		const settlement = { ...modern.snapshot.state.settlement } as Record<string, unknown>;
		delete settlement.firstEmber;
		delete settlement.navigation;
		delete settlement.poweredBuildingId;
		delete settlement.buildings;
		const legacyState = { ...modern.snapshot.state } as Record<string, unknown>;
		delete legacyState.society;
		delete legacyState.mission;
		const state = EngineGameStateV2Schema.parse({
			...legacyState,
			schemaVersion: 2,
			contentVersion: 'engine-v2',
			heroes: { [modernHero.heroId]: hero },
			settlement
		});
		const stateHash = hashGameState(state);
		const bootstrapEvent: AuthoritativeEvent = {
			...modern.event,
			schemaVersion: 2,
			contentVersion: 'engine-v2',
			afterStateHash: stateHash,
			payload: { ...modern.event.payload, initialState: state }
		};
		const chosen = applyCommand(state, {
			...commandBase(state, modernHero.heroId, 'v2-choose'),
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'Old steel, old trust.',
			storyBranch: 'steel-before-trust'
		});
		const arrived = applyCommand(chosen.state, {
			...commandBase(chosen.state, modernHero.heroId, 'v2-arrive'),
			commandType: 'hero.arrive'
		});
		const replay = replayEventsStrict([bootstrapEvent, ...chosen.events, ...arrived.events]);
		expect(replay.snapshot.state).toEqual(arrived.state);
		expect(replay.snapshot.state.schemaVersion).toBe(2);
	});

	it('keeps immutable engine-v3 travel streams replayable under their original schema', () => {
		const modern = fixture();
		if (modern.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 fixture');
		const modernHero = Object.values(modern.snapshot.state.heroes)[0]!;
		const hero = { ...modernHero } as Record<string, unknown>;
		delete hero.assignment;
		delete hero.mind;
		delete hero.habit;
		delete hero.dailyPlan;
		delete hero.currentRoutine;
		const settlement = { ...modern.snapshot.state.settlement } as Record<string, unknown>;
		delete settlement.firstEmber;
		delete settlement.poweredBuildingId;
		delete settlement.buildings;
		const legacyState = { ...modern.snapshot.state } as Record<string, unknown>;
		delete legacyState.society;
		delete legacyState.mission;
		const state = EngineGameStateV3Schema.parse({
			...legacyState,
			schemaVersion: 3,
			contentVersion: 'engine-v3',
			heroes: { [modernHero.heroId]: hero },
			settlement
		});
		const bootstrapEvent: AuthoritativeEvent = {
			...modern.event,
			schemaVersion: 3,
			contentVersion: 'engine-v3',
			afterStateHash: hashGameState(state),
			payload: { ...modern.event.payload, initialState: state }
		};
		const chosen = applyCommand(state, {
			...commandBase(state, modernHero.heroId, 'v3-choose'),
			commandType: 'hero.choose.destination',
			destination: 'kitchen',
			firstLine: 'Old routes remain true.',
			storyBranch: 'names-before-orders'
		});
		const traveling = applyCommand(chosen.state, {
			...commandBase(chosen.state, modernHero.heroId, 'v3-travel'),
			commandType: 'hero.start.travel',
			targetNodeId: 'kitchen-table'
		});
		const arrived = applyCommand(traveling.state, {
			...commandBase(traveling.state, traveling.state.master.masterId, 'v3-arrive'),
			commandType: 'simulation.advance',
			targetGameTime: traveling.scheduled[0]!.dueGameTime
		});
		const replay = replayEventsStrict([
			bootstrapEvent,
			...chosen.events,
			...traveling.events,
			...arrived.events
		]);
		expect(replay.snapshot.state).toEqual(arrived.state);
		expect(replay.snapshot.state.schemaVersion).toBe(3);
	});

	it('keeps immutable engine-v4 facility streams replayable under their original schema', () => {
		const modern = fixture();
		if (modern.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 fixture');
		const modernHero = Object.values(modern.snapshot.state.heroes)[0]!;
		const hero = { ...modernHero } as Record<string, unknown>;
		delete hero.mind;
		delete hero.habit;
		delete hero.dailyPlan;
		delete hero.currentRoutine;
		const settlement = { ...modern.snapshot.state.settlement } as Record<string, unknown>;
		delete settlement.firstEmber;
		const legacyState = { ...modern.snapshot.state } as Record<string, unknown>;
		delete legacyState.society;
		delete legacyState.mission;
		const state = EngineGameStateV4Schema.parse({
			...legacyState,
			schemaVersion: 4,
			contentVersion: 'engine-v4',
			heroes: { [modernHero.heroId]: hero },
			settlement
		});
		const bootstrapEvent: AuthoritativeEvent = {
			...modern.event,
			schemaVersion: 4,
			contentVersion: 'engine-v4',
			afterStateHash: hashGameState(state),
			payload: { ...modern.event.payload, initialState: state }
		};
		const assigned = applyCommand(state, {
			...commandBase(state, state.master.masterId, 'v4-assign'),
			commandType: 'settlement.assign.hero',
			heroId: modernHero.heroId,
			buildingId: 'workshop',
			role: 'artisan'
		});
		const powered = applyCommand(assigned.state, {
			...commandBase(assigned.state, assigned.state.master.masterId, 'v4-power'),
			commandType: 'settlement.allocate.power',
			buildingId: 'workshop'
		});
		const replay = replayEventsStrict([bootstrapEvent, ...assigned.events, ...powered.events]);
		expect(replay.snapshot.state).toEqual(powered.state);
		expect(replay.snapshot.state.schemaVersion).toBe(4);
	});

	it('keeps immutable engine-v6 First Ember streams free of social backfill', () => {
		const modern = fixture();
		if (modern.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 fixture');
		const legacyState = { ...modern.snapshot.state } as Record<string, unknown>;
		delete legacyState.society;
		delete legacyState.mission;
		const state = EngineGameStateV6Schema.parse({
			...legacyState,
			schemaVersion: 6,
			contentVersion: 'engine-v6'
		});
		const bootstrapEvent: AuthoritativeEvent = {
			...modern.event,
			schemaVersion: 6,
			contentVersion: 'engine-v6',
			afterStateHash: hashGameState(state),
			payload: { ...modern.event.payload, initialState: state }
		};
		const recovered = applyCommand(state, {
			...commandBase(state, state.master.masterId, 'v6-recover'),
			source: { ...source(), source: 'system', timing: null },
			commandType: 'story.recover.first.ember'
		});
		const committed = applyCommand(recovered.state, {
			...commandBase(recovered.state, recovered.state.master.masterId, 'v6-commit'),
			commandType: 'settlement.commit.first.ember',
			buildingId: 'kitchen',
			rationale: 'feed-everyone'
		});
		expect(committed.state.schemaVersion).toBe(6);
		expect(committed.events[0]?.payload).not.toHaveProperty('society');
		const replay = replayEventsStrict([bootstrapEvent, ...recovered.events, ...committed.events]);
		expect(replay.snapshot.state).toEqual(committed.state);
	});

	it('keeps immutable engine-v7 social streams replayable without communication backfill', () => {
		const modern = fixture();
		if (modern.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 fixture');
		const modernSociety = modern.snapshot.state.society;
		const society = SocietyStateSchema.parse({
			contentVersion: 'society-v1',
			observations: modernSociety.observations,
			beliefs: modernSociety.beliefs,
			relationships: modernSociety.relationships,
			promises: modernSociety.promises,
			authority: modernSociety.authority
		});
		const legacyState = { ...modern.snapshot.state } as Record<string, unknown>;
		delete legacyState.mission;
		const state = EngineGameStateV7Schema.parse({
			...legacyState,
			schemaVersion: 7,
			contentVersion: 'engine-v7',
			society
		});
		const bootstrapEvent: AuthoritativeEvent = {
			...modern.event,
			schemaVersion: 7,
			contentVersion: 'engine-v7',
			afterStateHash: hashGameState(state),
			payload: { ...modern.event.payload, initialState: state }
		};
		const inspected = applyCommand(state, {
			...commandBase(state, state.master.masterId, 'v7-inspect'),
			commandType: 'master.inspect.gate'
		});
		const replay = replayEventsStrict([bootstrapEvent, ...inspected.events]);
		expect(replay.snapshot.state).toEqual(inspected.state);
		expect(replay.snapshot.state.schemaVersion).toBe(7);
	});

	it('keeps immutable engine-v9 conversation streams replayable without directive backfill', () => {
		const modern = fixture();
		if (modern.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 fixture');
		const modernSociety = modern.snapshot.state.society;
		const society = SocietyStateV3Schema.parse({
			contentVersion: 'society-v3',
			observations: modernSociety.observations,
			beliefs: modernSociety.beliefs,
			relationships: modernSociety.relationships,
			promises: modernSociety.promises,
			authority: modernSociety.authority,
			communicativeActs: modernSociety.communicativeActs,
			conversationTurns: modernSociety.conversationTurns
		});
		const legacyState = { ...modern.snapshot.state } as Record<string, unknown>;
		delete legacyState.mission;
		const state = EngineGameStateV9Schema.parse({
			...legacyState,
			schemaVersion: 9,
			contentVersion: 'engine-v9',
			society
		});
		const bootstrapEvent: AuthoritativeEvent = {
			...modern.event,
			schemaVersion: 9,
			contentVersion: 'engine-v9',
			afterStateHash: hashGameState(state),
			payload: { ...modern.event.payload, initialState: state }
		};
		const conversed = applyCommand(state, {
			...commandBase(state, state.master.masterId, 'v9-conversation'),
			source: manualSource(),
			commandType: 'master.converse',
			targetHeroId: Object.keys(state.heroes)[0]!,
			kind: 'ask',
			exactText: 'What do you want to do next?',
			tone: 'neutral',
			delivery: 'private',
			orderIntent: null
		});
		const replay = replayEventsStrict([bootstrapEvent, ...conversed.events]);
		expect(replay.snapshot.state).toEqual(conversed.state);
		expect(replay.snapshot.state.schemaVersion).toBe(9);
		expect(replay.snapshot.state).not.toHaveProperty('society.directives');
	});

	it('keeps immutable engine-v10 directive streams replayable without mission backfill', () => {
		const modern = fixture();
		if (modern.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13 fixture');
		const legacyState = { ...modern.snapshot.state } as Record<string, unknown>;
		delete legacyState.mission;
		const state = EngineGameStateV10Schema.parse({
			...legacyState,
			schemaVersion: 10,
			contentVersion: 'engine-v10'
		});
		const bootstrapEvent: AuthoritativeEvent = {
			...modern.event,
			schemaVersion: 10,
			contentVersion: 'engine-v10',
			afterStateHash: hashGameState(state),
			payload: { ...modern.event.payload, initialState: state }
		};
		const heroId = Object.keys(state.heroes)[0]!;
		const issued = applyCommand(state, {
			...commandBase(state, state.master.masterId, 'v10-directive'),
			source: manualSource(),
			commandType: 'master.issue.directive',
			text: 'Prepare for the tower.',
			scope: 'mission',
			recipientIds: [heroId],
			priorities: ['tower-readiness'],
			tone: 'firm',
			delivery: 'private'
		});
		const replay = replayEventsStrict([bootstrapEvent, ...issued.events]);
		expect(replay.snapshot.state).toEqual(issued.state);
		expect(replay.snapshot.state.schemaVersion).toBe(10);
		expect(replay.snapshot.state).not.toHaveProperty('mission');
	});

	it('commits the First Ember once and preserves facility capacity', () => {
		const { bootstrap, chosen, traveling, arrived, heroId } = arriveAtTraining();
		const assigned = applyCommand(arrived.state, {
			...commandBase(arrived.state, arrived.state.master.masterId, 'assign-workshop'),
			commandType: 'settlement.assign.hero',
			heroId,
			buildingId: 'workshop',
			role: 'artisan'
		});
		if (assigned.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(assigned.state.heroes[heroId]?.assignment).toMatchObject({
			buildingId: 'workshop',
			nodeId: 'workshop-bench',
			role: 'artisan'
		});
		expect(assigned.state.settlement.buildings.workshop?.assignedHeroIds).toEqual([heroId]);
		const secondHeroId = deterministicUuid('engine-test-second-hero');
		const saturated = EngineGameStateV13Schema.parse({
			...assigned.state,
			heroes: {
				...assigned.state.heroes,
				[secondHeroId]: {
					...assigned.state.heroes[heroId]!,
					heroId: secondHeroId,
					equipment: { mainHand: null },
					assignment: null
				}
			},
			settlement: {
				...assigned.state.settlement,
				buildings: {
					...assigned.state.settlement.buildings,
					workshop: {
						...assigned.state.settlement.buildings.workshop!,
						assignmentCapacity: 1
					}
				}
			}
		});
		expect(
			legalActions(saturated, saturated.master.masterId).some(
				(candidate) => candidate.actionId === `settlement.assign.${secondHeroId}.workshop`
			)
		).toBe(false);
		expect(() =>
			applyCommand(saturated, {
				...commandBase(saturated, saturated.master.masterId, 'overfill-workshop'),
				commandType: 'settlement.assign.hero',
				heroId: secondHeroId,
				buildingId: 'workshop',
				role: 'artisan'
			})
		).toThrow(IllegalActionError);

		const recovered = applyCommand(assigned.state, {
			...commandBase(assigned.state, assigned.state.master.masterId, 'recover-first-ember'),
			source: { ...source(), source: 'system' as const, timing: null },
			commandType: 'story.recover.first.ember'
		});
		if (recovered.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(recovered.state.settlement.firstEmber.status).toBe('available');
		expect(
			legalActions(recovered.state, recovered.state.master.masterId)
				.filter((candidate) => candidate.actionId.startsWith('settlement.first-ember.'))
				.map((candidate) => candidate.actionId)
		).toEqual([
			'settlement.first-ember.kitchen',
			'settlement.first-ember.dormitory',
			'settlement.first-ember.training-ground'
		]);

		const committed = applyCommand(recovered.state, {
			...commandBase(recovered.state, recovered.state.master.masterId, 'commit-first-ember'),
			source: { ...source(), source: 'manual' as const, timing: 'step' as const },
			commandType: 'settlement.commit.first.ember',
			buildingId: 'training-ground',
			rationale: 'prepare-tower'
		});
		if (committed.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(committed.state.settlement.poweredBuildingId).toBe('training-ground');
		expect(committed.state.settlement.buildings['training-ground']?.powerState).toBe('powered');
		expect(committed.state.settlement.buildings.workshop?.powerState).toBe('unpowered');
		expect(committed.state.settlement.firstEmber).toMatchObject({
			status: 'committed',
			buildingId: 'training-ground',
			rationale: 'prepare-tower',
			modifiers: [
				{ key: 'hero-experience', amount: 4 },
				{ key: 'sword-experience', amount: 3 },
				{ key: 'training-injury-threshold', amount: -7 }
			]
		});
		expect(committed.state.settlement.firstEmber.reactions).toHaveLength(1);
		const commitmentEvent = committed.events[0]!;
		const observation = Object.values(committed.state.society.observations).find(
			(candidate) => candidate.kind === 'first-ember-commitment'
		)!;
		const socialBeliefs = Object.values(committed.state.society.beliefs).filter(
			(candidate) => candidate.provenance.sourceEventId === commitmentEvent.eventId
		);
		const promise = Object.values(committed.state.society.promises)[0]!;
		const relationship = Object.values(committed.state.society.relationships)[0]!;
		const authority = Object.values(committed.state.society.authority)[0]!;
		expect(observation.sourceEventId).toBe(commitmentEvent.eventId);
		expect(socialBeliefs.map((belief) => belief.predicate).sort()).toEqual([
			'first-ember-bound-to',
			'made-founding-promise'
		]);
		expect(
			socialBeliefs.every((belief) => belief.provenance.observationId === observation.observationId)
		).toBe(true);
		expect(promise).toMatchObject({
			status: 'active',
			terms: 'I will prepare this company for the tower as our founding priority.',
			sourceEventId: commitmentEvent.eventId
		});
		expect(relationship.dimensions).toMatchObject({ trust: 8, respect: 10, resentment: 0 });
		expect(authority.dimensions).toMatchObject({
			competence: 5,
			provision: 2,
			trust: 8,
			legitimacy: 8,
			strength: 8,
			consistency: 6
		});
		expect(() =>
			applyCommand(committed.state, {
				...commandBase(committed.state, committed.state.master.masterId, 'change-first-ember'),
				commandType: 'settlement.commit.first.ember',
				buildingId: 'kitchen',
				rationale: 'feed-everyone'
			})
		).toThrow(IllegalActionError);

		const replay = replayEventsStrict([
			bootstrap.event,
			...chosen.events,
			...traveling.events,
			...arrived.events,
			...assigned.events,
			...recovered.events,
			...committed.events
		]);
		expect(replay.snapshot.state).toEqual(committed.state);
		expect(replay.snapshot.stateHash).toBe(committed.stateHash);
	});

	it('applies each First Ember facility advantage to its matching activity', () => {
		function outcome(buildingId: FirstEmberFacility, activity: ActivityKind, powered: boolean) {
			const bootstrap = fixture();
			const heroId = Object.keys(bootstrap.snapshot.state.heroes)[0]!;
			const nodeId = {
				kitchen: 'kitchen-table',
				dormitory: 'dormitory-bunks',
				'training-ground': 'training-ring'
			}[buildingId];
			let state = EngineGameStateV13Schema.parse({
				...bootstrap.snapshot.state,
				heroes: {
					...bootstrap.snapshot.state.heroes,
					[heroId]: {
						...bootstrap.snapshot.state.heroes[heroId]!,
						location: buildingId,
						locationNodeId: nodeId,
						firstArrivalCompleted: true,
						destination: buildingId === 'training-ground' ? 'training-ground' : 'kitchen',
						health: 50,
						needs: { hunger: 100, fatigue: 100 }
					}
				}
			});
			if (powered) {
				const rationale =
					buildingId === 'kitchen'
						? 'feed-everyone'
						: buildingId === 'dormitory'
							? 'protect-recovery'
							: 'prepare-tower';
				const recovered = applyCommand(state, {
					...commandBase(state, state.master.masterId, `recover-${buildingId}`),
					source: { ...source(), source: 'system' as const, timing: null },
					commandType: 'story.recover.first.ember'
				});
				const committed = applyCommand(recovered.state, {
					...commandBase(recovered.state, recovered.state.master.masterId, `commit-${buildingId}`),
					commandType: 'settlement.commit.first.ember',
					buildingId,
					rationale
				});
				if (committed.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
				state = committed.state;
			}
			const started = applyCommand(state, {
				...commandBase(state, heroId, `start-${activity}`),
				commandType: 'hero.start.activity',
				activity
			});
			const completed = applyCommand(started.state, {
				...commandBase(started.state, started.state.master.masterId, `finish-${activity}`),
				commandType: 'simulation.advance',
				targetGameTime: started.scheduled[0]!.dueGameTime
			});
			if (completed.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
			return completed.state.heroes[heroId]!;
		}

		const kitchenBase = outcome('kitchen', 'eat', false);
		const kitchenPowered = outcome('kitchen', 'eat', true);
		expect(kitchenBase.needs.hunger).toBe(55);
		expect(kitchenPowered.needs.hunger).toBe(40);

		const dormitoryBase = outcome('dormitory', 'rest', false);
		const dormitoryPowered = outcome('dormitory', 'rest', true);
		expect(dormitoryBase.needs.fatigue).toBe(50);
		expect(dormitoryPowered.needs.fatigue).toBe(30);
		expect(dormitoryBase.health).toBe(60);
		expect(dormitoryPowered.health).toBe(65);

		const trainingBase = outcome('training-ground', 'train', false);
		const trainingPowered = outcome('training-ground', 'train', true);
		expect(trainingBase.progression.experience).toBe(8);
		expect(trainingPowered.progression.experience).toBe(12);
		expect(trainingBase.progression.skills.swordFighting.experience).toBe(6);
		expect(trainingPowered.progression.skills.swordFighting.experience).toBe(9);
	});

	it('records a conflicting founding explanation as negative consistency evidence', () => {
		const bootstrap = fixture();
		const recovered = applyCommand(bootstrap.snapshot.state, {
			...commandBase(
				bootstrap.snapshot.state,
				bootstrap.snapshot.state.master.masterId,
				'mismatch-recover'
			),
			source: { ...source(), source: 'system', timing: null },
			commandType: 'story.recover.first.ember'
		});
		const committed = applyCommand(recovered.state, {
			...commandBase(recovered.state, recovered.state.master.masterId, 'mismatch-commit'),
			commandType: 'settlement.commit.first.ember',
			buildingId: 'kitchen',
			rationale: 'prepare-tower'
		});
		if (committed.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const authority = Object.values(committed.state.society.authority)[0]!;
		expect(authority.dimensions.consistency).toBe(-8);
		expect(authority.evidence[0]?.summary).toContain('conflicted');
		expect(Object.values(committed.state.society.beliefs)).toContainEqual(
			expect.objectContaining({
				predicate: 'first-ember-bound-to',
				object: { kind: 'commitment', facilityId: 'kitchen', rationale: 'prepare-tower' }
			})
		);
	});

	it('plans four daily intentions and resolves a habit through the injected clock', () => {
		const { bootstrap, chosen, traveling, arrived, heroId } = arriveAtTraining();
		const planned = applyCommand(arrived.state, {
			...commandBase(arrived.state, heroId, 'plan-day'),
			commandType: 'hero.plan.day'
		});
		if (planned.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const plannedHero = planned.state.heroes[heroId]!;
		expect(plannedHero.mind).toMatchObject({
			primaryValue: 'duty',
			primaryDrive: 'survive',
			dailyHabit: 'checks-exits'
		});
		expect(plannedHero.dailyPlan?.entries).toHaveLength(4);
		expect(plannedHero.dailyPlan?.entries.map((entry) => entry.kind)).toEqual([
			'checks-exits',
			'self-directed',
			'meal',
			'sleep'
		]);
		const resolution = resolveDailyRoutine(planned.state, heroId);
		expect(resolution).toMatchObject({
			selectedKind: 'checks-exits',
			decisionRecommended: false,
			fallbackUsed: false
		});
		expect(resolution?.candidateScores).toHaveLength(4);

		const started = applyCommand(planned.state, {
			...commandBase(planned.state, heroId, 'follow-plan'),
			source: { ...source(), source: 'habit' as const },
			commandType: 'hero.start.routine'
		});
		expect(started.scheduled).toHaveLength(1);
		expect(started.scheduled[0]).toMatchObject({ eventKind: 'hero.routine.complete' });
		if (started.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(started.state.heroes[heroId]?.currentRoutine?.resolution).toEqual(resolution);
		expect(
			started.state.heroes[heroId]?.dailyPlan?.entries.find(
				(entry) => entry.planEntryId === resolution?.selectedPlanEntryId
			)?.status
		).toBe('active');

		const advanced = applyCommand(started.state, {
			...commandBase(started.state, started.state.master.masterId, 'finish-routine'),
			commandType: 'simulation.advance',
			targetGameTime: started.scheduled[0]!.dueGameTime
		});
		if (advanced.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const hero = advanced.state.heroes[heroId]!;
		expect(hero.currentRoutine).toBeNull();
		expect(hero.habit).toMatchObject({ strength: 69, repetitions: 1, satisfaction: 58 });
		expect(hero.needs).toMatchObject({ hunger: 23, fatigue: 18 });
		expect(
			hero.dailyPlan?.entries.find((entry) => entry.planEntryId === resolution?.selectedPlanEntryId)
		).toMatchObject({ status: 'completed', completedAt: started.scheduled[0]!.dueGameTime });
		expect(advanced.events[0]?.payload.rewardDeltas).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'habit', key: 'strength', delta: 1 }),
				expect.objectContaining({ kind: 'need', key: 'hunger', delta: 3 })
			])
		);
		const replay = replayEventsStrict([
			bootstrap.event,
			...chosen.events,
			...traveling.events,
			...arrived.events,
			...planned.events,
			...started.events,
			...advanced.events
		]);
		expect(replay.snapshot.state).toEqual(advanced.state);

		const died = applyCommand(started.state, {
			...commandBase(started.state, started.state.master.masterId, 'kill-during-routine'),
			commandType: 'simulation.apply.damage',
			targetId: heroId,
			amount: 100,
			damageKind: 'hazard'
		});
		if (died.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(died.state.heroes[heroId]?.currentRoutine).toBeNull();
		expect(died.state.heroes[heroId]?.dailyPlan?.entries).toEqual(
			expect.arrayContaining([expect.objectContaining({ status: 'skipped' })])
		);
		expect(died.canceledScheduledEventIds).toEqual([started.scheduled[0]!.scheduledEventId]);
	});

	it('keeps one offline day byte-equal to resolving each due event online', () => {
		const { arrived } = arriveAtTraining();
		if (arrived.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const targetGameTime = addGameMinutes(arrived.state.simulatedAt, 24 * 60);
		const offline = applyCatchUpPolicy(arrived.state, targetGameTime);

		let onlineState: Parameters<typeof applyCatchUpPolicy>[0] = arrived.state;
		const onlineCommands: EngineCommand[] = [];
		const onlineEvents: AuthoritativeEvent[] = [];
		const runOnline = (target: string) => {
			const result = applyCatchUpPolicy(onlineState, target);
			onlineState = result.state;
			onlineCommands.push(...result.commands);
			onlineEvents.push(...result.events);
		};
		runOnline(onlineState.simulatedAt);
		while (true) {
			const due = Object.values(onlineState.heroes)
				.map((hero) => hero.currentRoutine?.completesAt)
				.filter((value): value is string => Boolean(value))
				.sort()[0];
			if (!due || Date.parse(due) > Date.parse(targetGameTime)) break;
			runOnline(due);
		}
		runOnline(targetGameTime);

		expect(offline.truncated).toBe(false);
		expect(offline.resolvedScheduledEventIds).toHaveLength(4);
		expect(offline.commands).toEqual(onlineCommands);
		expect(offline.events).toEqual(onlineEvents);
		expect(offline.events.some((event) => event.eventType === 'simulation.clock.synced')).toBe(
			true
		);
		expect(offline.state).toEqual(onlineState);
		expect(offline.state.simulatedAt).toBe(targetGameTime);
		expect(
			Object.values(offline.state.heroes)[0]?.dailyPlan?.entries.filter(
				(entry) => entry.status === 'active'
			)
		).toHaveLength(1);
	});

	it('exposes close routine scores while keeping deterministic fallback replayable', () => {
		const { arrived, heroId } = arriveAtTraining();
		const planned = applyCommand(arrived.state, {
			...commandBase(arrived.state, heroId, 'plan-close-score'),
			commandType: 'hero.plan.day'
		});
		if (planned.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const closeState = EngineGameStateV13Schema.parse({
			...planned.state,
			heroes: {
				...planned.state.heroes,
				[heroId]: {
					...planned.state.heroes[heroId]!,
					needs: { hunger: 10, fatigue: 10 },
					habit: { ...planned.state.heroes[heroId]!.habit, strength: 40 }
				}
			}
		});
		const resolution = resolveDailyRoutine(closeState, heroId);
		expect(resolution).toMatchObject({
			selectedKind: 'self-directed',
			margin: 0,
			decisionRecommended: true,
			fallbackUsed: true
		});
	});

	it('schedules training, advances an injected clock, and projects progression exactly', () => {
		const { bootstrap, chosen, traveling, arrived, heroId } = arriveAtTraining();
		const started = applyCommand(arrived.state, {
			...commandBase(arrived.state, heroId, 'start-training'),
			commandType: 'hero.start.activity',
			activity: 'train'
		});
		expect(started.scheduled).toHaveLength(1);
		expect(started.scheduled[0]?.dueGameTime).toBe('2000-01-01T00:32:06.000Z');
		if (started.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(started.state.heroes[heroId]?.currentActivity?.kind).toBe('train');

		const advanced = applyCommand(started.state, {
			...commandBase(started.state, started.state.master.masterId, 'advance-training'),
			commandType: 'simulation.advance',
			targetGameTime: started.scheduled[0]!.dueGameTime
		});
		if (advanced.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const hero = advanced.state.heroes[heroId]!;
		const blade = advanced.state.items[hero.equipment.mainHand!]!;
		expect(hero.currentActivity).toBeNull();
		expect(hero.progression).toMatchObject({
			level: 1,
			experience: 8,
			skills: { swordFighting: { rank: 1, experience: 6 } }
		});
		expect(blade.durability).toBe(5);
		expect(advanced.resolvedScheduledEventIds).toEqual([started.scheduled[0]!.scheduledEventId]);
		expect(advanced.events[0]?.payload.rewardDeltas).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'experience', delta: 8 }),
				expect.objectContaining({ kind: 'skill', delta: 6 }),
				expect.objectContaining({ kind: 'durability', delta: -1 })
			])
		);

		const replay = replayEventsStrict([
			bootstrap.event,
			...chosen.events,
			...traveling.events,
			...arrived.events,
			...started.events,
			...advanced.events
		]);
		expect(replay.snapshot.state).toEqual(advanced.state);
		expect(replay.checks.at(-1)?.deltas).toHaveLength(
			(advanced.events[0]?.payload.rewardDeltas as unknown[]).length
		);
	});

	it('uses a nonnegative resource ledger to reserve and complete repairs', () => {
		const { arrived, heroId } = arriveAtTraining();
		const trained = applyCommand(arrived.state, {
			...commandBase(arrived.state, heroId, 'start-training-for-repair'),
			commandType: 'hero.start.activity',
			activity: 'train'
		});
		const afterTraining = applyCommand(trained.state, {
			...commandBase(trained.state, trained.state.master.masterId, 'finish-training-for-repair'),
			commandType: 'simulation.advance',
			targetGameTime: trained.scheduled[0]!.dueGameTime
		});
		const repair = applyCommand(afterTraining.state, {
			...commandBase(afterTraining.state, heroId, 'start-repair'),
			commandType: 'hero.start.activity',
			activity: 'repair'
		});
		if (repair.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(repair.state.settlement.resources['iron-ore']).toBe(1);
		expect(repair.state.settlement.resourceLedger.at(-1)).toMatchObject({
			resource: 'iron-ore',
			before: 2,
			after: 1,
			delta: -1
		});
		const repaired = applyCommand(repair.state, {
			...commandBase(repair.state, repair.state.master.masterId, 'finish-repair'),
			commandType: 'simulation.advance',
			targetGameTime: repair.scheduled[0]!.dueGameTime
		});
		if (repaired.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const itemId = repaired.state.heroes[heroId]!.equipment.mainHand!;
		expect(repaired.state.items[itemId]?.durability).toBe(6);
	});

	it('makes hero death permanent and Master death atomically ends the run', () => {
		const { arrived, heroId } = arriveAtTraining();
		const assigned = applyCommand(arrived.state, {
			...commandBase(arrived.state, arrived.state.master.masterId, 'assign-before-death'),
			commandType: 'settlement.assign.hero',
			heroId,
			buildingId: 'training-ground',
			role: 'trainee'
		});
		const started = applyCommand(assigned.state, {
			...commandBase(assigned.state, heroId, 'start-before-death'),
			commandType: 'hero.start.activity',
			activity: 'train'
		});
		const heroDied = applyCommand(started.state, {
			...commandBase(started.state, started.state.master.masterId, 'kill-hero'),
			commandType: 'simulation.apply.damage',
			targetId: heroId,
			amount: 100,
			damageKind: 'hazard'
		});
		if (heroDied.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		expect(heroDied.state.heroes[heroId]).toMatchObject({
			lifeState: 'dead',
			health: 0,
			currentActivity: null,
			assignment: null
		});
		expect(heroDied.state.settlement.buildings['training-ground']?.assignedHeroIds).toEqual([]);
		expect(heroDied.canceledScheduledEventIds).toEqual([started.scheduled[0]!.scheduledEventId]);
		expect(() =>
			applyCommand(heroDied.state, {
				...commandBase(heroDied.state, heroId, 'dead-hero-acts'),
				commandType: 'hero.start.activity',
				activity: 'rest'
			})
		).toThrow(IllegalActionError);

		const masterDied = applyCommand(heroDied.state, {
			...commandBase(heroDied.state, heroDied.state.master.masterId, 'kill-master'),
			commandType: 'simulation.apply.damage',
			targetId: heroDied.state.master.masterId,
			amount: 100,
			damageKind: 'hazard'
		});
		expect(masterDied.state.status).toBe('game_over');
		expect(masterDied.state.master).toMatchObject({ lifeState: 'dead', health: 0 });
		expect(legalActions(masterDied.state, masterDied.state.master.masterId)).toEqual([]);
	});

	it('exposes one public outer-result and claim-reducer seam for either combat mode', () => {
		const attemptId = '63000000-0000-4000-8000-000000000001';
		const result = emitCombatOutcome(
			{
				attemptId,
				modeId: 'legacy-auto-v1',
				rulesVersion: 'legacy-auto-rules-v1',
				endedAtTick: 4,
				termination: { kind: 'retreat' },
				partyHeroIds: [],
				engineDamageTakenByHeroId: {},
				finalCombatants: {},
				resolvedEvents: [],
				engineRecoveredCombatantIds: [],
				securedLoot: [],
				objectiveStates: [],
				decisiveEventIds: []
			},
			COMBAT_RULES_V1
		);
		const applied = transitionCombatResultClaims(
			{
				mission: createCombatMissionClaimProjection({}),
				progression: createCombatProgressionClaimProjection()
			},
			result
		);

		expect(applied.mission.attempts[attemptId]).toMatchObject({
			outcome: 'retreat',
			modeId: 'legacy-auto-v1',
			rulesVersion: 'legacy-auto-rules-v1'
		});
		expect(applied.receipts).toHaveLength(1);
	});
});
