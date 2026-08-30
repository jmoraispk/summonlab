import {
	DECISION_INSPECTOR_VERSION,
	DECISION_JOB_CLIENT_VIEW_VERSION,
	DECISION_JOB_VERSION,
	DECISION_PROVIDER_REQUEST_VERSION,
	EngineCommandSchema,
	EngineGameStateSchema,
	HERO_CONTEXT_POLICY_VERSION,
	HERO_DECISION_PACKET_VERSION,
	HERO_DECISION_PREVIEW_VERSION,
	HERO_DECISION_RESPONSE_VERSION,
	HERO_MEMORY_RETRIEVAL_VERSION,
	HERO_MODEL_PROMPT_VERSION,
	HERO_POLICY_RESULT_VERSION,
	LEGACY_DECISION_JOB_VERSION,
	MODEL_POLICY_VERSION
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { ENGINE_CONTRACT_RUNTIME_EXPORTS } from './engine-public-api.snapshot.js';
import { ENGINE_COMPATIBILITY_STATE_FIXTURES } from './engine-compatibility-states.snapshot.js';
import * as engineContracts from './engine.js';

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
			DECISION_INSPECTOR_VERSION, DECISION_JOB_CLIENT_VIEW_VERSION, DECISION_JOB_VERSION,
			DECISION_PROVIDER_REQUEST_VERSION, HERO_CONTEXT_POLICY_VERSION, HERO_DECISION_PACKET_VERSION,
			HERO_DECISION_PREVIEW_VERSION, HERO_DECISION_RESPONSE_VERSION, HERO_MEMORY_RETRIEVAL_VERSION,
			HERO_MODEL_PROMPT_VERSION, HERO_POLICY_RESULT_VERSION, LEGACY_DECISION_JOB_VERSION,
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
			1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
			22, 23
		]);
		for (const fixture of ENGINE_COMPATIBILITY_STATE_FIXTURES) {
			expect(EngineGameStateSchema.parse(fixture).schemaVersion).toBe(fixture.schemaVersion);
		}
		expect(
			EngineGameStateSchema.safeParse({
				...ENGINE_COMPATIBILITY_STATE_FIXTURES.at(-1)!,
				schemaVersion: 24
			}).success
		).toBe(false);
	});
});
