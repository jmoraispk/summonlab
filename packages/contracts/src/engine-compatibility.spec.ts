import {
	DECISION_INSPECTOR_VERSION,
	DECISION_JOB_CLIENT_VIEW_VERSION,
	DECISION_JOB_VERSION,
	DECISION_PROVIDER_REQUEST_VERSION,
	EngineCommandSchema,
	EngineGameStateSchema,
	FirstBandArchiveStateSchema as PublicFirstBandArchiveStateSchema,
	HERO_CONTEXT_POLICY_VERSION,
	HERO_DECISION_PACKET_VERSION,
	HERO_DECISION_PREVIEW_VERSION,
	HERO_DECISION_RESPONSE_VERSION,
	HERO_MEMORY_RETRIEVAL_VERSION,
	HERO_MODEL_PROMPT_VERSION,
	HERO_POLICY_RESULT_VERSION,
	LEGACY_DECISION_JOB_VERSION,
	MasterControlStateSchema as PublicMasterControlStateSchema,
	MasterControlStateV2Schema as PublicMasterControlStateV2Schema,
	MasterControlRequestSchema as PublicMasterControlRequestSchema,
	MasterDecisionWindowSchema as PublicMasterDecisionWindowSchema,
	MasterDecisionWindowRequestSchema as PublicMasterDecisionWindowRequestSchema,
	MasterFallbackConfigurationSchema as PublicMasterFallbackConfigurationSchema,
	MissionRunStateSchema as PublicMissionRunStateSchema,
	MissionRunStateV2Schema as PublicMissionRunStateV2Schema,
	MissionRunStateV3Schema as PublicMissionRunStateV3Schema,
	MissionRunStateV4Schema as PublicMissionRunStateV4Schema,
	MissionRunStateV5Schema as PublicMissionRunStateV5Schema,
	MissionRunStateV6Schema as PublicMissionRunStateV6Schema,
	MissionRunStateV7Schema as PublicMissionRunStateV7Schema,
	MissionRunStateV8Schema as PublicMissionRunStateV8Schema,
	MODEL_POLICY_VERSION,
	StoryPatchCandidateSchema as PublicStoryPatchCandidateSchema,
	SynthesisReceiptSchema as PublicSynthesisReceiptSchema,
	SynthesisRumorRecordSchema as PublicSynthesisRumorRecordSchema
} from '@summonlab/contracts';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import {
	EngineHeroStateV2Schema,
	EngineItemStateSchema,
	EngineMasterStateV2Schema,
	EngineStoryStateSchema
} from './engine/base-state.js';
import {
	EngineHeroStateV5Schema,
	EngineSettlementStateSchema,
	EngineSettlementStateV6Schema
} from './engine/settlement-state.js';
import {
	MasterControlRequestSchema,
	MasterControlStateSchema,
	MasterControlStateV2Schema,
	MasterDecisionWindowRequestSchema,
	MasterDecisionWindowSchema,
	MasterFallbackConfigurationSchema
} from './engine/master-control.js';
import {
	MissionRunStateSchema,
	MissionRunStateV2Schema,
	MissionRunStateV3Schema,
	MissionRunStateV4Schema,
	MissionRunStateV5Schema,
	MissionRunStateV6Schema,
	MissionRunStateV7Schema,
	MissionRunStateV8Schema
} from './engine/mission-state.js';
import {
	FirstBandArchiveStateSchema,
	StoryPatchCandidateSchema,
	SynthesisReceiptSchema,
	SynthesisRumorRecordSchema
} from './engine/story-synthesis-state.js';
import * as commandContracts from './engine/commands.js';
import * as gameStateContracts from './engine/game-state.js';
import * as runtimeContracts from './engine/runtime.js';
import { ENGINE_CONTRACT_RUNTIME_EXPORTS } from './engine-public-api.snapshot.js';
import { ENGINE_COMPATIBILITY_STATE_FIXTURES } from './engine-compatibility-states.snapshot.js';
import * as engineContracts from './engine.js';
import { SocietyStateV4Schema } from './social.js';

const V24_COMBAT_REPLAY_FINAL_STATE_HASH =
	'be17653a611538c5820f595dd04b61265e94896c399dca7d05e02d5d19491d20';

function canonicalJson(value: unknown): string {
	if (value === null) return 'null';
	if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
	if (typeof value === 'number') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	if (typeof value === 'object') {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort((left, right) => left.localeCompare(right))
			.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
			.join(',')}}`;
	}
	throw new Error(`Canonical JSON cannot encode ${typeof value}`);
}

function hashCanonical(value: unknown): string {
	return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

// Provenance: gzip-compressed JSON captured from the engine's v24-equipment-mission-resolution
// replay final state. Its canonical hash is pinned here and in replay-vectors.ts.
const V24_COMBAT_REPLAY_FINAL_STATE_SNAPSHOT =
	'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' +
	'wb0Zhna64vn/APRbU6MjYAAA';

const V24_COMBAT_REPLAY_FINAL_STATE_FIXTURE = JSON.parse(
	gunzipSync(Buffer.from(V24_COMBAT_REPLAY_FINAL_STATE_SNAPSHOT, 'base64')).toString('utf8')
);

describe('engine contracts compatibility', () => {
	it('keeps the engine runtime exports available through the contracts entrypoint', async () => {
		const contracts = await import('@summonlab/contracts');
		const expectedExports = new Set<string>(ENGINE_CONTRACT_RUNTIME_EXPORTS);
		expect(
			Object.keys(contracts)
				.filter((name) => expectedExports.has(name))
				.sort()
		).toEqual(ENGINE_CONTRACT_RUNTIME_EXPORTS);
		expect(Object.keys(engineContracts).sort()).toEqual(ENGINE_CONTRACT_RUNTIME_EXPORTS);
	});

	it('keeps frozen public engine schema coverage at v24', () => {
		expect(ENGINE_CONTRACT_RUNTIME_EXPORTS).toContain('EngineGameStateV24Schema');
		expect(ENGINE_CONTRACT_RUNTIME_EXPORTS).not.toContain('EngineGameStateV25Schema');
		expect(
			EngineGameStateSchema.parse(ENGINE_COMPATIBILITY_STATE_FIXTURES.at(-1)!).schemaVersion
		).toBe(24);
		expect(
			EngineGameStateSchema.safeParse({
				...ENGINE_COMPATIBILITY_STATE_FIXTURES.at(-1)!,
				schemaVersion: 25
			}).success
		).toBe(false);
	});

	it('parses the frozen v24 combat replay final state through public schemas', () => {
		const union = EngineGameStateSchema.parse(V24_COMBAT_REPLAY_FINAL_STATE_FIXTURE);
		const v24 = engineContracts.EngineGameStateV24Schema.parse(
			V24_COMBAT_REPLAY_FINAL_STATE_FIXTURE
		);
		expect(union).toStrictEqual(v24);
		expect(v24).toMatchObject({
			schemaVersion: 24,
			entropyCursor: 14,
			mission: { attempt: { status: 'resolving', turnState: { roundNumber: 2 } } }
		});
		expect(Object.keys(v24.mission.attempt!.turnState.monsters)).toHaveLength(4);
		expect(
			v24.mission.attempt!.turnState.rounds.map((round) => round.initiativeOrder)
		).toStrictEqual([
			[
				'a767dcaf-1cf6-4f8f-b6af-865201eaa215',
				'2db6fc66-291b-4e94-a32c-0b24f4070908',
				'64aa6816-ff1a-40af-8e75-f986e4fd110b',
				'3265f390-d551-426d-bcc5-1765a7921b7c',
				'e0cbdd02-a512-4fe2-9f67-230e8d4c5440',
				'34226d2b-db27-471c-a687-896c3fd54f63'
			],
			[
				'3265f390-d551-426d-bcc5-1765a7921b7c',
				'34226d2b-db27-471c-a687-896c3fd54f63',
				'a767dcaf-1cf6-4f8f-b6af-865201eaa215',
				'e0cbdd02-a512-4fe2-9f67-230e8d4c5440',
				'64aa6816-ff1a-40af-8e75-f986e4fd110b',
				'2db6fc66-291b-4e94-a32c-0b24f4070908'
			]
		]);
		expect(hashCanonical(v24)).toBe(V24_COMBAT_REPLAY_FINAL_STATE_HASH);
	});

	it('keeps command discriminators and public version constants stable', () => {
		expect(EngineCommandSchema.options.map((option) => option.shape.commandType.value).sort())
			.toMatchInlineSnapshot(`
		[
		  "hero.arrive",
		  "hero.choose.destination",
		  "hero.equip.item",
		  "hero.plan.day",
		  "hero.share.synthesis.rumor",
		  "hero.start.activity",
		  "hero.start.forging",
		  "hero.start.routine",
		  "hero.start.travel",
		  "master.apply.safety-stop",
		  "master.communicate",
		  "master.configure.fallback",
		  "master.configure.timing",
		  "master.converse",
		  "master.inspect.gate",
		  "master.issue.directive",
		  "master.open.decision",
		  "master.replace.directive",
		  "master.revoke.directive",
		  "mission.cancel",
		  "mission.deploy",
		  "mission.extract",
		  "mission.open.extraction",
		  "mission.prepare",
		  "mission.resolve.turn",
		  "mission.retreat",
		  "mission.revise.party",
		  "settlement.allocate.power",
		  "settlement.assign.hero",
		  "settlement.commit.first.ember",
		  "settlement.synthesize.hero",
		  "settlement.unassign.hero",
		  "simulation.advance",
		  "simulation.apply.damage",
		  "simulation.sync.clock",
		  "story.apply.patch",
		  "story.recover.first.ember",
		  "story.reveal.first.archive",
		]
	`);
		expect({
			DECISION_INSPECTOR_VERSION,
			DECISION_JOB_CLIENT_VIEW_VERSION,
			DECISION_JOB_VERSION,
			DECISION_PROVIDER_REQUEST_VERSION,
			HERO_CONTEXT_POLICY_VERSION,
			HERO_DECISION_PACKET_VERSION,
			HERO_DECISION_PREVIEW_VERSION,
			HERO_DECISION_RESPONSE_VERSION,
			HERO_MEMORY_RETRIEVAL_VERSION,
			HERO_MODEL_PROMPT_VERSION,
			HERO_POLICY_RESULT_VERSION,
			LEGACY_DECISION_JOB_VERSION,
			MODEL_POLICY_VERSION
		}).toEqual({
			DECISION_INSPECTOR_VERSION: 'decision-inspector-v1',
			DECISION_JOB_CLIENT_VIEW_VERSION: 'decision-job-client-v1',
			DECISION_JOB_VERSION: 'decision-job-v2',
			DECISION_PROVIDER_REQUEST_VERSION: 'decision-provider-request-v1',
			HERO_CONTEXT_POLICY_VERSION: 'hero-context-v1',
			HERO_DECISION_PACKET_VERSION: 'hero-decision-packet-v1',
			HERO_DECISION_PREVIEW_VERSION: 'hero-decision-preview-v1',
			HERO_DECISION_RESPONSE_VERSION: 'hero-decision-v1',
			HERO_MEMORY_RETRIEVAL_VERSION: 'hero-memory-v1',
			HERO_MODEL_PROMPT_VERSION: 'hero-model-prompt-v1',
			HERO_POLICY_RESULT_VERSION: 'hero-policy-result-v1',
			LEGACY_DECISION_JOB_VERSION: 'decision-job-v1',
			MODEL_POLICY_VERSION: 'model-policy-v1'
		});
	});

	it('parses the checked-in replay and development-bootstrap states', () => {
		expect(ENGINE_COMPATIBILITY_STATE_FIXTURES.map((fixture) => fixture.schemaVersion)).toEqual([
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24
		]);
		for (const fixture of ENGINE_COMPATIBILITY_STATE_FIXTURES) {
			expect(EngineGameStateSchema.parse(fixture).schemaVersion).toBe(fixture.schemaVersion);
		}
		expect(
			EngineGameStateSchema.safeParse({
				...ENGINE_COMPATIBILITY_STATE_FIXTURES.at(-1)!,
				schemaVersion: 25
			}).success
		).toBe(false);
	});

	it('parses every state version identically through the direct composition module', () => {
		const cases = [
			{
				schemaVersion: 1,
				direct: gameStateContracts.EngineGameStateV1Schema,
				publicSchema: engineContracts.EngineGameStateV1Schema
			},
			{
				schemaVersion: 2,
				direct: gameStateContracts.EngineGameStateV2Schema,
				publicSchema: engineContracts.EngineGameStateV2Schema
			},
			{
				schemaVersion: 3,
				direct: gameStateContracts.EngineGameStateV3Schema,
				publicSchema: engineContracts.EngineGameStateV3Schema
			},
			{
				schemaVersion: 4,
				direct: gameStateContracts.EngineGameStateV4Schema,
				publicSchema: engineContracts.EngineGameStateV4Schema
			},
			{
				schemaVersion: 5,
				direct: gameStateContracts.EngineGameStateV5Schema,
				publicSchema: engineContracts.EngineGameStateV5Schema
			},
			{
				schemaVersion: 6,
				direct: gameStateContracts.EngineGameStateV6Schema,
				publicSchema: engineContracts.EngineGameStateV6Schema
			},
			{
				schemaVersion: 7,
				direct: gameStateContracts.EngineGameStateV7Schema,
				publicSchema: engineContracts.EngineGameStateV7Schema
			},
			{
				schemaVersion: 8,
				direct: gameStateContracts.EngineGameStateV8Schema,
				publicSchema: engineContracts.EngineGameStateV8Schema
			},
			{
				schemaVersion: 9,
				direct: gameStateContracts.EngineGameStateV9Schema,
				publicSchema: engineContracts.EngineGameStateV9Schema
			},
			{
				schemaVersion: 10,
				direct: gameStateContracts.EngineGameStateV10Schema,
				publicSchema: engineContracts.EngineGameStateV10Schema
			},
			{
				schemaVersion: 11,
				direct: gameStateContracts.EngineGameStateV11Schema,
				publicSchema: engineContracts.EngineGameStateV11Schema
			},
			{
				schemaVersion: 12,
				direct: gameStateContracts.EngineGameStateV12Schema,
				publicSchema: engineContracts.EngineGameStateV12Schema
			},
			{
				schemaVersion: 13,
				direct: gameStateContracts.EngineGameStateV13Schema,
				publicSchema: engineContracts.EngineGameStateV13Schema
			},
			{
				schemaVersion: 14,
				direct: gameStateContracts.EngineGameStateV14Schema,
				publicSchema: engineContracts.EngineGameStateV14Schema
			},
			{
				schemaVersion: 15,
				direct: gameStateContracts.EngineGameStateV15Schema,
				publicSchema: engineContracts.EngineGameStateV15Schema
			},
			{
				schemaVersion: 16,
				direct: gameStateContracts.EngineGameStateV16Schema,
				publicSchema: engineContracts.EngineGameStateV16Schema
			},
			{
				schemaVersion: 17,
				direct: gameStateContracts.EngineGameStateV17Schema,
				publicSchema: engineContracts.EngineGameStateV17Schema
			},
			{
				schemaVersion: 18,
				direct: gameStateContracts.EngineGameStateV18Schema,
				publicSchema: engineContracts.EngineGameStateV18Schema
			},
			{
				schemaVersion: 19,
				direct: gameStateContracts.EngineGameStateV19Schema,
				publicSchema: engineContracts.EngineGameStateV19Schema
			},
			{
				schemaVersion: 20,
				direct: gameStateContracts.EngineGameStateV20Schema,
				publicSchema: engineContracts.EngineGameStateV20Schema
			},
			{
				schemaVersion: 21,
				direct: gameStateContracts.EngineGameStateV21Schema,
				publicSchema: engineContracts.EngineGameStateV21Schema
			},
			{
				schemaVersion: 22,
				direct: gameStateContracts.EngineGameStateV22Schema,
				publicSchema: engineContracts.EngineGameStateV22Schema
			},
			{
				schemaVersion: 23,
				direct: gameStateContracts.EngineGameStateV23Schema,
				publicSchema: engineContracts.EngineGameStateV23Schema
			},
			{
				schemaVersion: 24,
				direct: gameStateContracts.EngineGameStateV24Schema,
				publicSchema: engineContracts.EngineGameStateV24Schema
			}
		] as const;

		expect(cases.map(({ schemaVersion }) => schemaVersion)).toStrictEqual([
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24
		]);
		for (const stateCase of cases) {
			const fixture = ENGINE_COMPATIBILITY_STATE_FIXTURES[stateCase.schemaVersion - 1];
			expect(stateCase.direct.parse(fixture)).toStrictEqual(stateCase.publicSchema.parse(fixture));
			const invalid = { ...fixture, schemaVersion: 25 };
			expect(stateCase.direct.safeParse(invalid)).toStrictEqual(
				stateCase.publicSchema.safeParse(invalid)
			);
		}

		const unsupported = {
			...ENGINE_COMPATIBILITY_STATE_FIXTURES[23],
			schemaVersion: 25
		};
		const directVersionResult = gameStateContracts.EngineGameStateV24Schema.safeParse(unsupported);
		expect(directVersionResult).toStrictEqual(
			engineContracts.EngineGameStateV24Schema.safeParse(unsupported)
		);
		expect(directVersionResult.success).toBe(false);
		if (directVersionResult.success) {
			throw new Error('Version 24 state schema unexpectedly accepted schema version 25');
		}
		expect(
			directVersionResult.error.issues.map(({ code, path, message }) => ({ code, path, message }))
		).toStrictEqual([
			{
				code: 'invalid_value',
				path: ['schemaVersion'],
				message: 'Invalid input: expected 24'
			}
		]);

		const directUnionResult = gameStateContracts.EngineGameStateSchema.safeParse(unsupported);
		expect(directUnionResult).toStrictEqual(
			engineContracts.EngineGameStateSchema.safeParse(unsupported)
		);
		expect(directUnionResult.success).toBe(false);
		if (directUnionResult.success) {
			throw new Error('Engine state union unexpectedly accepted schema version 25');
		}
		expect(
			directUnionResult.error.issues.map(({ code, path, message }) => ({ code, path, message }))
		).toStrictEqual([
			{
				code: 'invalid_union',
				path: ['schemaVersion'],
				message:
					"Invalid discriminator value. Expected '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20' | '21' | '22' | '23' | '24'"
			}
		]);
	});

	it('parses every command discriminator in its exact union order through the direct module', () => {
		const commandBase = {
			commandId: '50000000-0000-4000-8000-000000000001',
			runId: '50000000-0000-4000-8000-000000000002',
			actorId: '50000000-0000-4000-8000-000000000003',
			expectedVersion: 0,
			correlationId: '50000000-0000-4000-8000-000000000004',
			source: {
				source: 'manual',
				timing: null,
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			}
		} as const;
		const heroId = '50000000-0000-4000-8000-000000000005';
		const secondHeroId = '50000000-0000-4000-8000-000000000006';
		const directiveId = '50000000-0000-4000-8000-000000000007';
		const storyCandidate = {
			patchVersion: 'story-patch-v1',
			patchId: '50000000-0000-4000-8000-000000000008',
			envelopeId: 'first-band-unclaimed-authority',
			envelopeContentHash: '1'.repeat(64),
			baseHistoryHash: '2'.repeat(64),
			slotId: 'floor-four-company-choice',
			selectedProposalIds: ['floor-four-route-holder'],
			roleBindings: [{ proposalId: 'floor-four-route-holder', heroId }],
			publicIntent: 'Let the route holder carry the discovery into the confrontation.'
		};
		const directive = {
			text: 'Protect the party while advancing the objective.',
			scope: 'mission',
			recipientIds: [heroId],
			priorities: ['protect-party'],
			tone: 'firm',
			delivery: 'open'
		} as const;
		const commands = [
			{
				...commandBase,
				commandType: 'hero.choose.destination',
				destination: 'kitchen',
				firstLine: 'We begin at the hearth.',
				storyBranch: 'kitchen-first'
			},
			{ ...commandBase, commandType: 'hero.arrive' },
			{ ...commandBase, commandType: 'hero.start.travel', targetNodeId: 'kitchen-hearth' },
			{
				...commandBase,
				commandType: 'settlement.assign.hero',
				heroId,
				buildingId: 'kitchen',
				role: 'cook'
			},
			{ ...commandBase, commandType: 'settlement.unassign.hero', heroId },
			{ ...commandBase, commandType: 'settlement.allocate.power', buildingId: 'kitchen' },
			{ ...commandBase, commandType: 'story.recover.first.ember' },
			{
				...commandBase,
				commandType: 'settlement.commit.first.ember',
				buildingId: 'kitchen',
				rationale: 'feed-everyone'
			},
			{
				...commandBase,
				commandType: 'master.communicate',
				targetHeroId: heroId,
				kind: 'tell',
				topic: 'daily-order',
				exactText: 'Keep the hearth supplied.',
				tone: 'firm',
				delivery: 'open'
			},
			{
				...commandBase,
				commandType: 'master.converse',
				targetHeroId: heroId,
				kind: 'order',
				exactText: 'Prepare for the tower.',
				tone: 'firm',
				delivery: 'private',
				orderIntent: 'prepare-tower'
			},
			{ ...commandBase, commandType: 'master.issue.directive', ...directive },
			{ ...commandBase, commandType: 'master.replace.directive', directiveId, ...directive },
			{ ...commandBase, commandType: 'master.revoke.directive', directiveId },
			{
				...commandBase,
				commandType: 'master.configure.timing',
				timing: 'countdown',
				countdownSeconds: 5,
				observedAt: '2000-01-01T00:00:00.000Z'
			},
			{
				...commandBase,
				commandType: 'master.open.decision',
				observedAt: '2000-01-01T00:00:00.000Z'
			},
			{
				...commandBase,
				commandType: 'master.configure.fallback',
				policy: 'directed',
				directionText: 'Protect the party.',
				priorities: ['protect-party'],
				protectedHeroId: heroId,
				safetyStops: {
					beforeIrreversibleAction: true,
					masterHealthThreshold: 35,
					whenUnclassified: true,
					maximumConsecutiveFallbacks: 8
				},
				observedAt: '2000-01-01T00:00:00.000Z'
			},
			{
				...commandBase,
				commandType: 'master.apply.safety-stop',
				decisionId: '50000000-0000-4000-8000-000000000009',
				observedAt: '2000-01-01T00:00:00.000Z'
			},
			{ ...commandBase, commandType: 'hero.plan.day' },
			{ ...commandBase, commandType: 'hero.start.routine' },
			{ ...commandBase, commandType: 'master.inspect.gate' },
			{ ...commandBase, commandType: 'hero.start.activity', activity: 'train' },
			{
				...commandBase,
				commandType: 'hero.equip.item',
				itemId: '50000000-0000-4000-8000-000000000010'
			},
			{
				...commandBase,
				commandType: 'hero.start.forging',
				definitionId: 'equipment-bronze-sword',
				materialId: 'bronze',
				craftsmanship: { label: 'standard', bonus: 0 }
			},
			{
				...commandBase,
				commandType: 'simulation.advance',
				targetGameTime: '2000-01-01T00:01:00.000Z'
			},
			{
				...commandBase,
				commandType: 'simulation.sync.clock',
				targetGameTime: '2000-01-01T00:01:00.000Z'
			},
			{
				...commandBase,
				commandType: 'simulation.apply.damage',
				targetId: heroId,
				amount: 1,
				damageKind: 'training'
			},
			{
				...commandBase,
				commandType: 'mission.prepare',
				heroIds: [heroId],
				missionId: 'tower-floor-01'
			},
			{ ...commandBase, commandType: 'mission.revise.party', heroIds: [heroId, secondHeroId] },
			{ ...commandBase, commandType: 'mission.cancel' },
			{ ...commandBase, commandType: 'mission.deploy' },
			{
				...commandBase,
				commandType: 'mission.resolve.turn',
				choices: [
					{
						actorId: heroId,
						actionId: 'hero.wait',
						source: 'manual',
						policyId: null,
						packetHash: null,
						legalActionHash: null,
						policyResultHash: null,
						publicIntent: 'Hold position.'
					}
				],
				decisionId: '50000000-0000-4000-8000-000000000011',
				resolvedAt: '2000-01-01T00:01:00.000Z'
			},
			{
				...commandBase,
				commandType: 'mission.open.extraction',
				completedObjectiveIds: ['first-ember']
			},
			{ ...commandBase, commandType: 'mission.extract' },
			{ ...commandBase, commandType: 'mission.retreat' },
			{ ...commandBase, commandType: 'story.apply.patch', candidate: storyCandidate },
			{ ...commandBase, commandType: 'story.reveal.first.archive', readerHeroId: heroId },
			{
				...commandBase,
				commandType: 'settlement.synthesize.hero',
				sourceHeroId: heroId,
				recipientHeroId: secondHeroId,
				visibility: 'private',
				warningVersion: 'synthesis-warning-v1',
				confirmedIrreversible: true,
				rationale: 'Transfer bounded essence.'
			},
			{
				...commandBase,
				commandType: 'hero.share.synthesis.rumor',
				receiptId: '50000000-0000-4000-8000-000000000012',
				targetHeroId: secondHeroId
			}
		] as const;
		const expectedCommandTypes = [
			'hero.choose.destination',
			'hero.arrive',
			'hero.start.travel',
			'settlement.assign.hero',
			'settlement.unassign.hero',
			'settlement.allocate.power',
			'story.recover.first.ember',
			'settlement.commit.first.ember',
			'master.communicate',
			'master.converse',
			'master.issue.directive',
			'master.replace.directive',
			'master.revoke.directive',
			'master.configure.timing',
			'master.open.decision',
			'master.configure.fallback',
			'master.apply.safety-stop',
			'hero.plan.day',
			'hero.start.routine',
			'master.inspect.gate',
			'hero.start.activity',
			'hero.equip.item',
			'hero.start.forging',
			'simulation.advance',
			'simulation.sync.clock',
			'simulation.apply.damage',
			'mission.prepare',
			'mission.revise.party',
			'mission.cancel',
			'mission.deploy',
			'mission.resolve.turn',
			'mission.open.extraction',
			'mission.extract',
			'mission.retreat',
			'story.apply.patch',
			'story.reveal.first.archive',
			'settlement.synthesize.hero',
			'hero.share.synthesis.rumor'
		] as const;

		expect(commands.map(({ commandType }) => commandType)).toStrictEqual(expectedCommandTypes);
		expect(
			commandContracts.EngineCommandSchema.options.map((option) => option.shape.commandType.value)
		).toStrictEqual(expectedCommandTypes);
		expect(
			engineContracts.EngineCommandSchema.options.map((option) => option.shape.commandType.value)
		).toStrictEqual(expectedCommandTypes);
		for (const command of commands) {
			expect(commandContracts.EngineCommandSchema.parse(command)).toStrictEqual(
				engineContracts.EngineCommandSchema.parse(command)
			);
		}
		const invalid = { ...commandBase, commandType: 'engine.unknown' };
		const directResult = commandContracts.EngineCommandSchema.safeParse(invalid);
		expect(directResult).toStrictEqual(engineContracts.EngineCommandSchema.safeParse(invalid));
		expect(directResult.success).toBe(false);
		if (directResult.success) {
			throw new Error('Engine command union unexpectedly accepted an unknown discriminator');
		}
		expect(
			directResult.error.issues.map(({ code, path, message }) => ({ code, path, message }))
		).toStrictEqual([
			{
				code: 'invalid_union',
				path: ['commandType'],
				message:
					"Invalid discriminator value. Expected 'hero.choose.destination' | 'hero.arrive' | 'hero.start.travel' | 'settlement.assign.hero' | 'settlement.unassign.hero' | 'settlement.allocate.power' | 'story.recover.first.ember' | 'settlement.commit.first.ember' | 'master.communicate' | 'master.converse' | 'master.issue.directive' | 'master.replace.directive' | 'master.revoke.directive' | 'master.configure.timing' | 'master.open.decision' | 'master.configure.fallback' | 'master.apply.safety-stop' | 'hero.plan.day' | 'hero.start.routine' | 'master.inspect.gate' | 'hero.start.activity' | 'hero.equip.item' | 'hero.start.forging' | 'simulation.advance' | 'simulation.sync.clock' | 'simulation.apply.damage' | 'mission.prepare' | 'mission.revise.party' | 'mission.cancel' | 'mission.deploy' | 'mission.resolve.turn' | 'mission.open.extraction' | 'mission.extract' | 'mission.retreat' | 'story.apply.patch' | 'story.reveal.first.archive' | 'settlement.synthesize.hero' | 'hero.share.synthesis.rumor'"
			}
		]);
	});

	it('parses every remaining request branch identically through the direct command module', () => {
		const heroId = '51000000-0000-4000-8000-000000000001';
		const secondHeroId = '51000000-0000-4000-8000-000000000002';
		const directiveId = '51000000-0000-4000-8000-000000000003';
		const directive = {
			text: 'Keep the hearth supplied.',
			scope: 'day',
			recipientIds: [heroId],
			priorities: ['supply-hearth'],
			tone: 'firm',
			delivery: 'open'
		} as const;
		const cases = [
			{
				schema: commandContracts.CommunicationRequestSchema,
				publicSchema: engineContracts.CommunicationRequestSchema,
				value: {
					targetHeroId: heroId,
					kind: 'tell',
					topic: 'daily-order',
					exactText: 'Keep the hearth supplied.',
					tone: 'firm',
					delivery: 'open'
				}
			},
			{
				schema: commandContracts.ConversationRequestSchema,
				publicSchema: engineContracts.ConversationRequestSchema,
				value: {
					targetHeroId: heroId,
					kind: 'say',
					exactText: 'The hearth is ready.',
					tone: 'neutral',
					delivery: 'private',
					orderIntent: null
				}
			},
			{
				schema: commandContracts.ConversationRequestSchema,
				publicSchema: engineContracts.ConversationRequestSchema,
				value: {
					targetHeroId: heroId,
					kind: 'ask',
					exactText: 'Is the hearth ready?',
					tone: 'neutral',
					delivery: 'open',
					orderIntent: null
				}
			},
			{
				schema: commandContracts.ConversationRequestSchema,
				publicSchema: engineContracts.ConversationRequestSchema,
				value: {
					targetHeroId: heroId,
					kind: 'order',
					exactText: 'Prepare for the tower.',
					tone: 'firm',
					delivery: 'private',
					orderIntent: 'prepare-tower'
				}
			},
			{
				schema: commandContracts.DirectiveRequestSchema,
				publicSchema: engineContracts.DirectiveRequestSchema,
				value: { action: 'issue', ...directive }
			},
			{
				schema: commandContracts.DirectiveRequestSchema,
				publicSchema: engineContracts.DirectiveRequestSchema,
				value: { action: 'replace', directiveId, ...directive }
			},
			{
				schema: commandContracts.DirectiveRequestSchema,
				publicSchema: engineContracts.DirectiveRequestSchema,
				value: { action: 'revoke', directiveId }
			},
			{
				schema: commandContracts.FirstEmberRequestSchema,
				publicSchema: engineContracts.FirstEmberRequestSchema,
				value: { action: 'recover' }
			},
			{
				schema: commandContracts.FirstEmberRequestSchema,
				publicSchema: engineContracts.FirstEmberRequestSchema,
				value: { action: 'commit', buildingId: 'kitchen', rationale: 'feed-everyone' }
			},
			{
				schema: commandContracts.MissionLifecycleRequestSchema,
				publicSchema: engineContracts.MissionLifecycleRequestSchema,
				value: { action: 'prepare', heroIds: [heroId], missionId: 'tower-floor-01' }
			},
			{
				schema: commandContracts.MissionLifecycleRequestSchema,
				publicSchema: engineContracts.MissionLifecycleRequestSchema,
				value: { action: 'revise-party', heroIds: [heroId, secondHeroId] }
			},
			{
				schema: commandContracts.MissionLifecycleRequestSchema,
				publicSchema: engineContracts.MissionLifecycleRequestSchema,
				value: { action: 'cancel' }
			},
			{
				schema: commandContracts.MissionLifecycleRequestSchema,
				publicSchema: engineContracts.MissionLifecycleRequestSchema,
				value: { action: 'deploy' }
			},
			{
				schema: commandContracts.MissionLifecycleRequestSchema,
				publicSchema: engineContracts.MissionLifecycleRequestSchema,
				value: { action: 'resolve-turn', masterActionId: 'master.wait' }
			},
			{
				schema: commandContracts.MissionLifecycleRequestSchema,
				publicSchema: engineContracts.MissionLifecycleRequestSchema,
				value: { action: 'resolve-fallback' }
			},
			{
				schema: commandContracts.MissionLifecycleRequestSchema,
				publicSchema: engineContracts.MissionLifecycleRequestSchema,
				value: { action: 'extract' }
			},
			{
				schema: commandContracts.MissionLifecycleRequestSchema,
				publicSchema: engineContracts.MissionLifecycleRequestSchema,
				value: { action: 'retreat' }
			},
			{
				schema: commandContracts.SynthesisRequestSchema,
				publicSchema: engineContracts.SynthesisRequestSchema,
				value: {
					action: 'synthesize',
					sourceHeroId: heroId,
					recipientHeroId: secondHeroId,
					visibility: 'private',
					warningVersion: 'synthesis-warning-v1',
					confirmedIrreversible: true,
					rationale: 'Transfer bounded essence.'
				}
			},
			{
				schema: commandContracts.SynthesisRequestSchema,
				publicSchema: engineContracts.SynthesisRequestSchema,
				value: {
					action: 'share-rumor',
					receiptId: '51000000-0000-4000-8000-000000000004',
					speakerHeroId: heroId,
					targetHeroId: secondHeroId
				}
			},
			{
				schema: commandContracts.FirstBandArchiveRequestSchema,
				publicSchema: engineContracts.FirstBandArchiveRequestSchema,
				value: { action: 'reveal', readerHeroId: heroId }
			},
			{
				schema: commandContracts.CatchUpRequestSchema,
				publicSchema: engineContracts.CatchUpRequestSchema,
				value: { wallTime: '2000-01-01T00:00:00.000Z' }
			}
		] as const;
		const expectedBranches = [
			'tell',
			'say',
			'ask',
			'order',
			'issue',
			'replace',
			'revoke',
			'recover',
			'commit',
			'prepare',
			'revise-party',
			'cancel',
			'deploy',
			'resolve-turn',
			'resolve-fallback',
			'extract',
			'retreat',
			'synthesize',
			'share-rumor',
			'reveal',
			'catch-up'
		];
		expect(
			cases.map(({ value }) =>
				'action' in value ? value.action : 'kind' in value ? value.kind : 'catch-up'
			)
		).toStrictEqual(expectedBranches);
		for (const requestCase of cases) {
			expect(requestCase.schema.parse(requestCase.value)).toStrictEqual(
				requestCase.publicSchema.parse(requestCase.value)
			);
		}

		const invalidCases = [
			{
				schema: commandContracts.CommunicationRequestSchema,
				publicSchema: engineContracts.CommunicationRequestSchema,
				value: { ...cases[0].value, unexpected: true }
			},
			{
				schema: commandContracts.ConversationRequestSchema,
				publicSchema: engineContracts.ConversationRequestSchema,
				value: { ...cases[1].value, orderIntent: 'train' }
			},
			{
				schema: commandContracts.DirectiveRequestSchema,
				publicSchema: engineContracts.DirectiveRequestSchema,
				value: { action: 'unknown' }
			},
			{
				schema: commandContracts.FirstEmberRequestSchema,
				publicSchema: engineContracts.FirstEmberRequestSchema,
				value: { action: 'unknown' }
			},
			{
				schema: commandContracts.MissionLifecycleRequestSchema,
				publicSchema: engineContracts.MissionLifecycleRequestSchema,
				value: { action: 'unknown' }
			},
			{
				schema: commandContracts.SynthesisRequestSchema,
				publicSchema: engineContracts.SynthesisRequestSchema,
				value: { action: 'unknown' }
			},
			{
				schema: commandContracts.FirstBandArchiveRequestSchema,
				publicSchema: engineContracts.FirstBandArchiveRequestSchema,
				value: { action: 'reveal', readerHeroId: heroId, unexpected: true }
			},
			{
				schema: commandContracts.CatchUpRequestSchema,
				publicSchema: engineContracts.CatchUpRequestSchema,
				value: { unexpected: true }
			}
		] as const;
		for (const invalidCase of invalidCases) {
			expect(invalidCase.schema.safeParse(invalidCase.value)).toStrictEqual(
				invalidCase.publicSchema.safeParse(invalidCase.value)
			);
		}

		const conversationResult = commandContracts.ConversationRequestSchema.safeParse({
			...cases[1].value,
			orderIntent: 'train'
		});
		expect(conversationResult.success).toBe(false);
		if (conversationResult.success) {
			throw new Error('Conversation request unexpectedly accepted an order intent for say');
		}
		expect(
			conversationResult.error.issues.map(({ code, path, message }) => ({ code, path, message }))
		).toStrictEqual([
			{
				code: 'custom',
				path: [],
				message: 'Only an order has an order intent'
			}
		]);

		const strictResult = commandContracts.CommunicationRequestSchema.safeParse({
			...cases[0].value,
			unexpected: true
		});
		expect(strictResult.success).toBe(false);
		if (strictResult.success) {
			throw new Error('Strict communication request unexpectedly accepted an extra key');
		}
		expect(
			strictResult.error.issues.map(({ code, path, message }) => ({ code, path, message }))
		).toStrictEqual([
			{
				code: 'unrecognized_keys',
				path: [],
				message: 'Unrecognized key: "unexpected"'
			}
		]);

		const requestUnionResult = commandContracts.DirectiveRequestSchema.safeParse({
			action: 'unknown'
		});
		expect(requestUnionResult.success).toBe(false);
		if (requestUnionResult.success) {
			throw new Error('Directive request union unexpectedly accepted an unknown discriminator');
		}
		expect(
			requestUnionResult.error.issues.map(({ code, path, message }) => ({ code, path, message }))
		).toStrictEqual([
			{
				code: 'invalid_union',
				path: ['action'],
				message: "Invalid discriminator value. Expected 'issue' | 'replace' | 'revoke'"
			}
		]);
	});

	it('parses one strict replay report identically through the direct runtime module', () => {
		const runId = '52000000-0000-4000-8000-000000000001';
		const actorId = '52000000-0000-4000-8000-000000000002';
		const eventId = '52000000-0000-4000-8000-000000000003';
		const hash = 'a'.repeat(64);
		const source = {
			source: 'system',
			timing: null,
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		} as const;
		const journalEntry = {
			journalEntryId: '52000000-0000-4000-8000-000000000004',
			runId,
			eventIds: [eventId],
			sequenceStart: 1,
			sequenceEnd: 1,
			gameTime: '2000-01-01T00:00:00.000Z',
			category: 'story',
			title: 'Run initialized',
			summary: 'The deterministic run began.',
			participantIds: [actorId],
			deltas: [],
			source,
			directionOutcome: null,
			replayCursor: 1
		} as const;
		const legalAction = {
			actionId: 'master.wait',
			actorId,
			kind: 'wait',
			label: 'Wait',
			description: 'Hold the current decision.',
			targetIds: [],
			resourceCosts: {},
			tags: []
		} as const;
		const clock = {
			runId,
			speed: 1,
			anchorGameTime: '2000-01-01T00:00:00.000Z',
			anchorRealTime: '2000-01-01T00:00:00.000Z',
			currentGameTime: '2000-01-01T00:00:00.000Z',
			projectedGameTime: '2000-01-01T00:00:00.000Z',
			lastCatchUpAt: null,
			nextDueGameTime: null,
			nextDueRealTime: null,
			backlogGameMinutes: 0,
			leaseStatus: 'idle'
		} as const;
		const report = {
			runId,
			verified: true,
			eventCount: 1,
			checks: [
				{
					sequence: 1,
					gameTime: '2000-01-01T00:00:00.000Z',
					eventType: 'run.initialized',
					actorId,
					source,
					summary: 'The deterministic run began.',
					beforeStateHash: hash,
					afterStateHash: hash,
					computedStateHash: hash,
					verified: true,
					entropyDraws: [{ purpose: 'run.bootstrap', cursor: 0, minimum: 0, maximum: 0, value: 0 }],
					deltas: []
				}
			],
			journalEntries: [journalEntry],
			playerJournal: {
				reportVersion: 'player-journal-v1',
				runId,
				fromCursor: 1,
				toCursor: 1,
				entryCount: 1,
				eventStreamHash: hash,
				reportHash: hash,
				entries: [
					{
						...journalEntry,
						entryVersion: 'player-journal-entry-v1',
						eventType: 'run.initialized',
						stateHash: hash,
						dayNumber: 1,
						facets: ['story'],
						mission: null,
						actions: [],
						partyProgressDeltas: [],
						directions: [],
						storyChanges: []
					}
				],
				deltaTotals: [],
				partyTotals: {
					attemptsStarted: 0,
					deployments: 0,
					roundsResolved: 0,
					objectivesCompleted: 0,
					discoveries: 0,
					threatsDefeated: 0,
					successfulExtractions: 0,
					retreats: 0,
					casualties: 0
				},
				filterOptions: {
					days: [1],
					missionIds: [],
					floors: [],
					heroIds: [actorId],
					eventTypes: ['run.initialized'],
					facets: ['story'],
					sources: ['system']
				}
			},
			scheduledEvents: [
				{
					scheduledEventId: '52000000-0000-4000-8000-000000000005',
					runId,
					actorId,
					dueGameTime: '2000-01-01T00:01:00.000Z',
					eventKind: 'routine.complete',
					payload: {},
					status: 'pending',
					createdEventId: eventId,
					terminalEventId: null
				}
			],
			clock,
			snapshot: { state: ENGINE_COMPATIBILITY_STATE_FIXTURES[0], stateHash: hash },
			persistedStateHash: hash,
			hashMatchesPersistedSnapshot: true,
			legalActions: [legalAction],
			legalActionsByActor: { [actorId]: [legalAction] }
		};

		expect(runtimeContracts.EngineReplayReportSchema.parse(report)).toStrictEqual(
			engineContracts.EngineReplayReportSchema.parse(report)
		);
		const invalid = { ...report, unexpected: true };
		const directResult = runtimeContracts.EngineReplayReportSchema.safeParse(invalid);
		const publicResult = engineContracts.EngineReplayReportSchema.safeParse(invalid);
		expect(directResult).toStrictEqual(publicResult);
		expect(directResult.success).toBe(false);
		if (directResult.success) {
			throw new Error('Strict replay report unexpectedly accepted an extra key');
		}
		expect(
			directResult.error.issues.map(({ code, path, message }) => ({ code, path, message }))
		).toStrictEqual([
			{
				code: 'unrecognized_keys',
				path: [],
				message: 'Unrecognized key: "unexpected"'
			}
		]);
	});

	it('parses base and settlement society state identically through leaf and composed schemas', () => {
		const baseFixture = ENGINE_COMPATIBILITY_STATE_FIXTURES.find(
			(fixture) => fixture.schemaVersion === 2
		)!;
		const composedBaseState = EngineGameStateSchema.parse(baseFixture);
		if (composedBaseState.schemaVersion !== 2) {
			throw new Error('Expected the base compatibility fixture to parse as schema version 2');
		}
		const leafBaseState = {
			master: EngineMasterStateV2Schema.parse(baseFixture.master),
			heroes: Object.fromEntries(
				Object.entries(baseFixture.heroes).map(([heroId, hero]) => [
					heroId,
					EngineHeroStateV2Schema.parse(hero)
				])
			),
			settlement: EngineSettlementStateSchema.parse(baseFixture.settlement),
			items: Object.fromEntries(
				Object.entries(baseFixture.items).map(([itemId, item]) => [
					itemId,
					EngineItemStateSchema.parse(item)
				])
			),
			story: EngineStoryStateSchema.parse(baseFixture.story)
		};
		expect(leafBaseState).toStrictEqual({
			master: composedBaseState.master,
			heroes: composedBaseState.heroes,
			settlement: composedBaseState.settlement,
			items: composedBaseState.items,
			story: composedBaseState.story
		});

		const baseSettlementSocietyFixture = ENGINE_COMPATIBILITY_STATE_FIXTURES.find(
			(fixture) => fixture.schemaVersion === 10
		)!;
		const baseSettlementHero = Object.values(baseSettlementSocietyFixture.heroes)[0]!;
		const activityHeroId = '10000000-0000-4000-8000-000000000001';
		const travelHeroId = '10000000-0000-4000-8000-000000000002';
		const routineHeroId = '10000000-0000-4000-8000-000000000003';
		const communicationEventId = '10000000-0000-4000-8000-000000000004';
		const communicationActId = '10000000-0000-4000-8000-000000000005';
		const communicationObservationId = '10000000-0000-4000-8000-000000000006';
		const conversationTurnId = '10000000-0000-4000-8000-000000000007';
		const directiveId = '10000000-0000-4000-8000-000000000008';
		const directiveInfluenceId = '10000000-0000-4000-8000-000000000009';
		const planId = '10000000-0000-4000-8000-000000000010';
		const activePlanEntryId = '10000000-0000-4000-8000-000000000011';
		const settlementSocietyFixture = {
			...baseSettlementSocietyFixture,
			heroes: {
				...baseSettlementSocietyFixture.heroes,
				[activityHeroId]: {
					...baseSettlementHero,
					heroId: activityHeroId,
					equipment: { mainHand: null },
					currentActivity: {
						activityId: '10000000-0000-4000-8000-000000000012',
						scheduledEventId: '10000000-0000-4000-8000-000000000013',
						kind: 'train',
						startedAt: '2000-01-01T00:00:00.000Z',
						completesAt: '2000-01-01T00:05:00.000Z'
					}
				},
				[travelHeroId]: {
					...baseSettlementHero,
					heroId: travelHeroId,
					equipment: { mainHand: null },
					currentTravel: {
						travelId: '10000000-0000-4000-8000-000000000014',
						scheduledEventId: '10000000-0000-4000-8000-000000000015',
						fromNodeId: 'gate-dais',
						toNodeId: 'kitchen-hearth',
						destinationZone: 'kitchen',
						route: {
							fromNodeId: 'gate-dais',
							toNodeId: 'kitchen-hearth',
							nodeIds: ['gate-dais', 'kitchen-hearth'],
							steps: [
								{
									edgeId: 'gate-to-kitchen',
									fromNodeId: 'gate-dais',
									toNodeId: 'kitchen-hearth',
									travelGameSeconds: 60
								}
							],
							totalTravelGameSeconds: 60,
							bottleneckCapacity: 4
						},
						settlementContentVersion:
							baseSettlementSocietyFixture.settlement.navigation.contentVersion,
						settlementContentHash: baseSettlementSocietyFixture.settlement.navigation.contentHash,
						startedAt: '2000-01-01T00:00:00.000Z',
						arrivesAt: '2000-01-01T00:01:00.000Z'
					}
				},
				[routineHeroId]: {
					...baseSettlementHero,
					heroId: routineHeroId,
					equipment: { mainHand: null },
					assignment: {
						buildingId: 'kitchen',
						nodeId: 'kitchen-hearth',
						role: 'cook',
						assignedAt: '2000-01-01T00:00:00.000Z'
					},
					dailyPlan: {
						planId,
						dayIndex: 0,
						createdAt: '2000-01-01T00:00:00.000Z',
						entries: [
							{
								planEntryId: activePlanEntryId,
								period: 'dawn',
								kind: 'meal',
								buildingId: 'kitchen',
								status: 'active',
								startedAt: '2000-01-01T00:00:00.000Z',
								completedAt: null
							},
							{
								planEntryId: '10000000-0000-4000-8000-000000000016',
								period: 'day',
								kind: 'assigned-duty',
								buildingId: 'kitchen',
								status: 'pending',
								startedAt: null,
								completedAt: null
							},
							{
								planEntryId: '10000000-0000-4000-8000-000000000017',
								period: 'evening',
								kind: 'self-directed',
								buildingId: null,
								status: 'pending',
								startedAt: null,
								completedAt: null
							},
							{
								planEntryId: '10000000-0000-4000-8000-000000000018',
								period: 'night',
								kind: 'sleep',
								buildingId: 'dormitory',
								status: 'pending',
								startedAt: null,
								completedAt: null
							}
						]
					},
					currentRoutine: {
						routineId: '10000000-0000-4000-8000-000000000019',
						scheduledEventId: '10000000-0000-4000-8000-000000000020',
						planId,
						planEntryId: activePlanEntryId,
						kind: 'meal',
						resolution: {
							selectedPlanEntryId: activePlanEntryId,
							selectedKind: 'meal',
							candidateScores: [
								{
									planEntryId: activePlanEntryId,
									kind: 'meal',
									score: 80,
									eligible: true,
									reasons: ['Breakfast is due.']
								}
							],
							margin: 20,
							decisionRecommended: false,
							fallbackUsed: false,
							summary: 'The assigned cook begins breakfast.'
						},
						startedAt: '2000-01-01T00:00:00.000Z',
						completesAt: '2000-01-01T00:10:00.000Z'
					}
				}
			},
			settlement: {
				...baseSettlementSocietyFixture.settlement,
				poweredBuildingId: 'kitchen',
				buildings: {
					...baseSettlementSocietyFixture.settlement.buildings,
					kitchen: {
						...baseSettlementSocietyFixture.settlement.buildings.kitchen,
						assignedHeroIds: [routineHeroId],
						powerState: 'powered'
					}
				},
				firstEmber: {
					coreId: 'first-ember-core',
					status: 'committed',
					recoveredFrom: 'tower-floor-01',
					recoveredAt: '2000-01-01T00:00:00.000Z',
					committedAt: '2000-01-01T00:01:00.000Z',
					buildingId: 'kitchen',
					rationale: 'feed-everyone',
					modifiers: [{ key: 'hunger-recovery', amount: 10 }],
					reactions: [
						{
							heroId: baseSettlementHero.heroId,
							stance: 'support',
							score: 75,
							summary: 'A warm kitchen will sustain the settlement.',
							factors: ['Food is scarce.', 'Everyone needs a shared meal.']
						}
					]
				}
			},
			society: {
				...baseSettlementSocietyFixture.society,
				observations: {
					...baseSettlementSocietyFixture.society.observations,
					[communicationObservationId]: {
						observationId: communicationObservationId,
						sourceEventId: communicationEventId,
						observerHeroId: baseSettlementHero.heroId,
						observedAt: '2000-01-01T00:02:00.000Z',
						kind: 'communication',
						communicationActId,
						summary: 'The Master assigns the first daily priority.',
						subjectIds: [baseSettlementSocietyFixture.master.masterId, baseSettlementHero.heroId]
					}
				},
				communicativeActs: {
					[communicationActId]: {
						actId: communicationActId,
						sourceEventId: communicationEventId,
						speakerId: baseSettlementSocietyFixture.master.masterId,
						intendedAudienceIds: [baseSettlementHero.heroId],
						kind: 'tell',
						topic: 'open-conversation',
						exactText: 'Keep the hearth supplied before training begins.',
						tone: 'firm',
						delivery: 'open',
						location: 'summoning-gate',
						occurredAt: '2000-01-01T00:02:00.000Z',
						claim: null,
						witnesses: [
							{
								heroId: baseSettlementHero.heroId,
								role: 'intended',
								perception: 'addressed',
								observationId: communicationObservationId,
								beliefId: null
							}
						]
					}
				},
				conversationTurns: {
					[conversationTurnId]: {
						turnId: conversationTurnId,
						sourceEventId: communicationEventId,
						communicationActId,
						masterId: baseSettlementSocietyFixture.master.masterId,
						heroId: baseSettlementHero.heroId,
						kind: 'say',
						orderIntent: null,
						response: {
							exactText: 'I will make sure the hearth is ready.',
							publicReason: 'The settlement needs food before drills.',
							orderOutcome: null,
							orderScore: null,
							preferenceWeight: 0
						},
						occurredAt: '2000-01-01T00:02:00.000Z'
					}
				},
				directives: {
					[directiveId]: {
						directiveId,
						runId: baseSettlementSocietyFixture.runId,
						authorId: baseSettlementSocietyFixture.master.masterId,
						text: 'Keep the hearth supplied before training begins.',
						scope: 'until_revoked',
						recipientIds: [baseSettlementHero.heroId],
						witnessEventId: communicationEventId,
						priorities: ['supply-hearth'],
						createdAt: '2000-01-01T00:02:00.000Z',
						expiresAt: null,
						revokedAt: null,
						delivery: 'open',
						status: 'active',
						witnessObservationIds: [communicationObservationId],
						expiryScheduledEventId: null,
						replacesDirectiveId: null,
						replacedByDirectiveId: null,
						terminalAt: null,
						terminalEventId: null
					}
				},
				directiveInfluences: {
					[directiveInfluenceId]: {
						influenceId: directiveInfluenceId,
						directiveId,
						heroId: baseSettlementHero.heroId,
						sourceEventId: communicationEventId,
						decisionJobId: null,
						actionId: 'hero.start.routine',
						outcome: 'advanced',
						rationale: 'The hearth priority supports the planned meal.',
						evaluatedAt: '2000-01-01T00:03:00.000Z'
					}
				}
			}
		} as const;
		const settlementHeroes = Object.values(settlementSocietyFixture.heroes);
		expect({
			currentActivity: settlementHeroes.some((hero) => hero.currentActivity !== null),
			currentTravel: settlementHeroes.some((hero) => hero.currentTravel !== null),
			assignment: settlementHeroes.some((hero) => hero.assignment !== null),
			dailyPlan: settlementHeroes.some((hero) => hero.dailyPlan !== null),
			currentRoutine: settlementHeroes.some((hero) => hero.currentRoutine !== null),
			firstEmberModifiers: settlementSocietyFixture.settlement.firstEmber.modifiers.length > 0,
			firstEmberReactions: settlementSocietyFixture.settlement.firstEmber.reactions.length > 0,
			communicativeActs: Object.keys(settlementSocietyFixture.society.communicativeActs).length > 0,
			conversationTurns: Object.keys(settlementSocietyFixture.society.conversationTurns).length > 0,
			directives: Object.keys(settlementSocietyFixture.society.directives).length > 0,
			directiveInfluences:
				Object.keys(settlementSocietyFixture.society.directiveInfluences).length > 0
		}).toStrictEqual({
			currentActivity: true,
			currentTravel: true,
			assignment: true,
			dailyPlan: true,
			currentRoutine: true,
			firstEmberModifiers: true,
			firstEmberReactions: true,
			communicativeActs: true,
			conversationTurns: true,
			directives: true,
			directiveInfluences: true
		});
		const composedSettlementSocietyState = EngineGameStateSchema.parse(settlementSocietyFixture);
		if (composedSettlementSocietyState.schemaVersion !== 10) {
			throw new Error(
				'Expected the settlement society compatibility fixture to parse as schema version 10'
			);
		}
		const leafSettlementSocietyState = {
			heroes: Object.fromEntries(
				Object.entries(settlementSocietyFixture.heroes).map(([heroId, hero]) => [
					heroId,
					EngineHeroStateV5Schema.parse(hero)
				])
			),
			settlement: EngineSettlementStateV6Schema.parse(settlementSocietyFixture.settlement),
			society: SocietyStateV4Schema.parse(settlementSocietyFixture.society)
		};
		expect(leafSettlementSocietyState).toStrictEqual({
			heroes: composedSettlementSocietyState.heroes,
			settlement: composedSettlementSocietyState.settlement,
			society: composedSettlementSocietyState.society
		});
	});

	it('parses every historical mission state identically and preserves its run refinement', () => {
		const cases = [
			{
				label: 'v1',
				schemaVersion: 11,
				leaf: MissionRunStateSchema,
				publicSchema: PublicMissionRunStateSchema,
				expectedReason: 'Mission attempt count is inconsistent'
			},
			{
				label: 'v2',
				schemaVersion: 12,
				leaf: MissionRunStateV2Schema,
				publicSchema: PublicMissionRunStateV2Schema,
				expectedReason: 'Mission attempt count is inconsistent'
			},
			{
				label: 'v3',
				schemaVersion: 13,
				leaf: MissionRunStateV3Schema,
				publicSchema: PublicMissionRunStateV3Schema,
				expectedReason: 'Mission combat attempt count is inconsistent'
			},
			{
				label: 'v4',
				schemaVersion: 14,
				leaf: MissionRunStateV4Schema,
				publicSchema: PublicMissionRunStateV4Schema,
				expectedReason: 'Mission evidence attempt count is inconsistent'
			},
			{
				label: 'v5',
				schemaVersion: 15,
				leaf: MissionRunStateV5Schema,
				publicSchema: PublicMissionRunStateV5Schema,
				expectedReason: 'Portal mission attempt count is inconsistent'
			},
			{
				label: 'v6',
				schemaVersion: 16,
				leaf: MissionRunStateV6Schema,
				publicSchema: PublicMissionRunStateV6Schema,
				expectedReason: 'Mission aftermath lifecycle is inconsistent'
			},
			{
				label: 'v7',
				schemaVersion: 17,
				leaf: MissionRunStateV7Schema,
				publicSchema: PublicMissionRunStateV7Schema,
				expectedReason: 'Mission Master aftermath lifecycle is inconsistent'
			},
			{
				label: 'v8',
				schemaVersion: 18,
				leaf: MissionRunStateV8Schema,
				publicSchema: PublicMissionRunStateV8Schema,
				expectedReason: 'Mission attempt aftermath lifecycle is inconsistent'
			}
		] as const;

		for (const missionCase of cases) {
			const state = ENGINE_COMPATIBILITY_STATE_FIXTURES.find(
				(fixture) => fixture.schemaVersion === missionCase.schemaVersion
			);
			if (!state || !('mission' in state)) {
				throw new Error(`Missing mission compatibility fixture for ${missionCase.label}`);
			}

			expect(missionCase.leaf.parse(state.mission)).toStrictEqual(
				missionCase.publicSchema.parse(state.mission)
			);

			const invalidMission = { ...state.mission, attemptCount: 1 };
			for (const schema of [missionCase.leaf, missionCase.publicSchema]) {
				const result = schema.safeParse(invalidMission);
				expect(result.success, `${missionCase.label} must reject an inconsistent count`).toBe(
					false
				);
				if (result.success) {
					throw new Error(`${missionCase.label} unexpectedly accepted an inconsistent count`);
				}
				expect(result.error.issues.map((issue) => issue.message)).toContain(
					missionCase.expectedReason
				);
			}
		}
	});

	it('parses every Master timing variant identically and preserves deadline refinements', () => {
		const state = ENGINE_COMPATIBILITY_STATE_FIXTURES.find(
			(fixture) => fixture.schemaVersion === 19
		);
		if (!state || !('masterControl' in state)) {
			throw new Error('Missing Master-control v1 compatibility fixture');
		}
		const decisionId = '10000000-0000-4000-8000-000000000019';
		const openedAt = '2000-01-01T00:00:00.000Z';
		const timingCases = [
			{ timing: 'wait', expiresAt: null, invalidExpiresAt: '2000-01-01T00:01:00.000Z' },
			{
				timing: 'countdown',
				expiresAt: '2000-01-01T00:01:00.000Z',
				invalidExpiresAt: null
			},
			{ timing: 'step', expiresAt: null, invalidExpiresAt: '2000-01-01T00:01:00.000Z' },
			{
				timing: 'continuous',
				expiresAt: null,
				invalidExpiresAt: '2000-01-01T00:01:00.000Z'
			}
		] as const;

		for (const timingCase of timingCases) {
			const control = { ...state.masterControl, timing: timingCase.timing };
			expect(MasterControlStateSchema.parse(control)).toStrictEqual(
				PublicMasterControlStateSchema.parse(control)
			);

			const window = {
				decisionId,
				ordinal: 1,
				timing: timingCase.timing,
				openedAt,
				expiresAt: timingCase.expiresAt
			};
			expect(MasterDecisionWindowSchema.parse(window)).toStrictEqual(
				PublicMasterDecisionWindowSchema.parse(window)
			);

			const invalidWindow = { ...window, expiresAt: timingCase.invalidExpiresAt };
			for (const schema of [MasterDecisionWindowSchema, PublicMasterDecisionWindowSchema]) {
				const result = schema.safeParse(invalidWindow);
				expect(result.success, `${timingCase.timing} must enforce deadline presence`).toBe(false);
				if (result.success) {
					throw new Error(`${timingCase.timing} unexpectedly accepted its invalid deadline`);
				}
				expect(result.error.issues.map((issue) => issue.message)).toContain(
					'Only Countdown decisions have a deadline'
				);
			}
		}
	});

	it('parses every Master fallback variant identically and preserves priority refinements', () => {
		const state = ENGINE_COMPATIBILITY_STATE_FIXTURES.find(
			(fixture) => fixture.schemaVersion === 20
		);
		if (!state || !('masterControl' in state)) {
			throw new Error('Missing Master-control v2 compatibility fixture');
		}

		for (const policy of ['directed', 'random'] as const) {
			const fallback = { ...state.masterControl.fallback, policy };
			const control = { ...state.masterControl, fallback };
			expect(MasterControlStateV2Schema.parse(control)).toStrictEqual(
				PublicMasterControlStateV2Schema.parse(control)
			);
			expect(MasterFallbackConfigurationSchema.parse(fallback)).toStrictEqual(
				PublicMasterFallbackConfigurationSchema.parse(fallback)
			);

			const invalidFallback = {
				...fallback,
				priorities: ['focus-objective', 'focus-objective']
			};
			for (const schema of [
				MasterFallbackConfigurationSchema,
				PublicMasterFallbackConfigurationSchema
			]) {
				const result = schema.safeParse(invalidFallback);
				expect(result.success, `${policy} must reject duplicate priorities`).toBe(false);
				if (result.success) {
					throw new Error(`${policy} unexpectedly accepted duplicate priorities`);
				}
				expect(result.error.issues.map((issue) => issue.message)).toContain(
					'Fallback priorities must be unique'
				);
			}
		}
	});

	it('parses every Master-control request branch and default identically through the leaf', () => {
		for (const timing of ['wait', 'countdown', 'step', 'continuous'] as const) {
			const request = { action: 'timing' as const, timing };
			const leafRequest = MasterControlRequestSchema.parse(request);
			expect(leafRequest).toStrictEqual(PublicMasterControlRequestSchema.parse(request));
			expect(leafRequest).toStrictEqual({ action: 'timing', timing, countdownSeconds: 5 });
		}

		for (const policy of ['directed', 'random'] as const) {
			const request = {
				action: 'fallback' as const,
				policy,
				directionText: 'Protect the party while advancing the objective.',
				priorities: ['protect-party', 'focus-objective'],
				protectedHeroId: null,
				safetyStops: {
					beforeIrreversibleAction: true,
					masterHealthThreshold: 35,
					whenUnclassified: true,
					maximumConsecutiveFallbacks: 8
				}
			};
			const leafRequest = MasterControlRequestSchema.parse(request);
			expect(leafRequest).toStrictEqual(PublicMasterControlRequestSchema.parse(request));
			expect(leafRequest).toStrictEqual(request);
		}
	});

	it('preserves the strict empty Master decision-window request through the leaf', () => {
		expect(MasterDecisionWindowRequestSchema.parse({})).toStrictEqual(
			PublicMasterDecisionWindowRequestSchema.parse({})
		);
		expect(MasterDecisionWindowRequestSchema.parse({})).toStrictEqual({});
		for (const schema of [
			MasterDecisionWindowRequestSchema,
			PublicMasterDecisionWindowRequestSchema
		]) {
			const result = schema.safeParse({ unexpected: true });
			expect(result.success).toBe(false);
			if (result.success) {
				throw new Error('Master decision-window request unexpectedly accepted an extra key');
			}
			expect(result.error.issues.map((issue) => issue.code)).toContain('unrecognized_keys');
		}
	});

	it('parses a story patch identically and preserves its selection refinement through the leaf', () => {
		const candidate = {
			patchVersion: 'story-patch-v1',
			patchId: '41000000-0000-4000-8000-000000000001',
			envelopeId: 'first-band-unclaimed-authority',
			envelopeContentHash: '1'.repeat(64),
			baseHistoryHash: '2'.repeat(64),
			slotId: 'floor-four-company-choice',
			selectedProposalIds: ['floor-four-route-holder'],
			roleBindings: [
				{
					proposalId: 'floor-four-route-holder',
					heroId: '41000000-0000-4000-8000-000000000002'
				}
			],
			publicIntent: 'Let the route holder carry the optional discovery into the confrontation.'
		};
		expect(StoryPatchCandidateSchema).toBe(PublicStoryPatchCandidateSchema);
		expect(StoryPatchCandidateSchema.parse(candidate)).toStrictEqual(
			PublicStoryPatchCandidateSchema.parse(candidate)
		);

		const invalidCandidate = {
			...candidate,
			selectedProposalIds: ['floor-four-route-holder', 'floor-four-route-holder']
		};
		const leafResult = StoryPatchCandidateSchema.safeParse(invalidCandidate);
		const publicResult = PublicStoryPatchCandidateSchema.safeParse(invalidCandidate);
		expect(leafResult).toStrictEqual(publicResult);
		expect(leafResult.success).toBe(false);
		if (leafResult.success) {
			throw new Error('Story patch unexpectedly accepted duplicate selections');
		}
		expect(
			leafResult.error.issues.map(({ code, path, message }) => ({ code, path, message }))
		).toStrictEqual([
			{
				code: 'custom',
				path: [],
				message: 'Story patch selections must be unique'
			}
		]);
	});

	it('parses first-band archive state identically and preserves lifecycle validation through the leaf', () => {
		const state = ENGINE_COMPATIBILITY_STATE_FIXTURES.find(
			(fixture) => fixture.schemaVersion === 23
		);
		if (!state || !('firstBandArchive' in state)) {
			throw new Error('Missing first-band archive compatibility fixture');
		}
		expect(FirstBandArchiveStateSchema).toBe(PublicFirstBandArchiveStateSchema);
		expect(FirstBandArchiveStateSchema.parse(state.firstBandArchive)).toStrictEqual(
			PublicFirstBandArchiveStateSchema.parse(state.firstBandArchive)
		);

		const invalidArchive = { ...state.firstBandArchive, status: 'recovered' };
		const leafResult = FirstBandArchiveStateSchema.safeParse(invalidArchive);
		const publicResult = PublicFirstBandArchiveStateSchema.safeParse(invalidArchive);
		expect(leafResult).toStrictEqual(publicResult);
		expect(leafResult.success).toBe(false);
		if (leafResult.success) {
			throw new Error('First-band archive unexpectedly accepted an inconsistent lifecycle');
		}
		expect(
			leafResult.error.issues.map(({ code, path, message }) => ({ code, path, message }))
		).toStrictEqual([
			{
				code: 'custom',
				path: [],
				message: 'First-band archive lifecycle is inconsistent'
			}
		]);
	});

	it('parses a synthesis receipt identically and preserves participant validation through the leaf', () => {
		const progression = {
			stars: 1,
			level: 1,
			experience: 0,
			skills: { swordFighting: { rank: 0, experience: 0 } }
		};
		const receipt = {
			receiptVersion: 'synthesis-receipt-v1',
			receiptId: '42000000-0000-4000-8000-000000000001',
			sourceEventId: '42000000-0000-4000-8000-000000000002',
			masterId: '42000000-0000-4000-8000-000000000003',
			sourceHeroId: '42000000-0000-4000-8000-000000000004',
			recipientHeroId: '42000000-0000-4000-8000-000000000005',
			visibility: 'private',
			warningVersion: 'synthesis-warning-v1',
			confirmedIrreversible: true,
			rationale: 'Convert one summon into bounded essence before the next tower attempt.',
			committedAt: '2000-01-01T00:00:00.000Z',
			essenceExperience: 40,
			sourceProgression: progression,
			recipientProgressionBefore: progression,
			recipientProgressionAfter: progression,
			socialConsequences: [
				{
					heroId: '42000000-0000-4000-8000-000000000005',
					knowledge: 'participant',
					observationId: '42000000-0000-4000-8000-000000000006',
					beliefId: '42000000-0000-4000-8000-000000000007',
					relationshipId: '42000000-0000-4000-8000-000000000008',
					confidence: 100,
					relationshipDeltas: {
						trust: -1,
						respect: 0,
						fear: 1,
						affection: 0,
						resentment: 1,
						debt: 0
					}
				}
			]
		};
		expect(SynthesisReceiptSchema).toBe(PublicSynthesisReceiptSchema);
		expect(SynthesisReceiptSchema.parse(receipt)).toStrictEqual(
			PublicSynthesisReceiptSchema.parse(receipt)
		);

		const invalidReceipt = { ...receipt, recipientHeroId: receipt.sourceHeroId };
		const leafResult = SynthesisReceiptSchema.safeParse(invalidReceipt);
		const publicResult = PublicSynthesisReceiptSchema.safeParse(invalidReceipt);
		expect(leafResult).toStrictEqual(publicResult);
		expect(leafResult.success).toBe(false);
		if (leafResult.success) {
			throw new Error('Synthesis receipt unexpectedly accepted identical participants');
		}
		expect(
			leafResult.error.issues.map(({ code, path, message }) => ({ code, path, message }))
		).toStrictEqual([
			{
				code: 'custom',
				path: [],
				message: 'Synthesis source and recipient must differ'
			}
		]);
	});

	it('parses a synthesis rumor identically and preserves confidence bounds through the leaf', () => {
		const rumor = {
			rumorVersion: 'synthesis-rumor-v1',
			rumorId: '43000000-0000-4000-8000-000000000001',
			receiptId: '43000000-0000-4000-8000-000000000002',
			sourceEventId: '43000000-0000-4000-8000-000000000003',
			originObservationId: '43000000-0000-4000-8000-000000000004',
			speakerHeroId: '43000000-0000-4000-8000-000000000005',
			listenerHeroId: '43000000-0000-4000-8000-000000000006',
			observationId: '43000000-0000-4000-8000-000000000007',
			beliefId: '43000000-0000-4000-8000-000000000008',
			relationshipId: '43000000-0000-4000-8000-000000000009',
			confidence: 85,
			chainDepth: 1,
			relationshipDeltas: {
				trust: -1,
				respect: 0,
				fear: 1,
				affection: 0,
				resentment: 1,
				debt: 0
			},
			sharedAt: '2000-01-01T00:01:00.000Z'
		};
		expect(SynthesisRumorRecordSchema).toBe(PublicSynthesisRumorRecordSchema);
		expect(SynthesisRumorRecordSchema.parse(rumor)).toStrictEqual(
			PublicSynthesisRumorRecordSchema.parse(rumor)
		);

		const invalidRumor = { ...rumor, confidence: 0 };
		const leafResult = SynthesisRumorRecordSchema.safeParse(invalidRumor);
		const publicResult = PublicSynthesisRumorRecordSchema.safeParse(invalidRumor);
		expect(leafResult).toStrictEqual(publicResult);
		expect(leafResult.success).toBe(false);
		if (leafResult.success) {
			throw new Error('Synthesis rumor unexpectedly accepted zero confidence');
		}
		expect(
			leafResult.error.issues.map(({ code, path, message }) => ({ code, path, message }))
		).toStrictEqual([
			{
				code: 'too_small',
				path: ['confidence'],
				message: 'Too small: expected number to be >=1'
			}
		]);
	});
});
