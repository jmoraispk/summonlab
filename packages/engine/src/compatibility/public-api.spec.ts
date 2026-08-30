import { describe, expect, it } from 'vitest';

import { IllegalActionError, ReplayIntegrityError, StaleStateVersionError } from '../errors.js';
import * as engine from '../index.js';
import {
	ENGINE_EVENT_TYPES,
	LEGACY_EVENT_TYPES,
	MODERN_EVENT_TYPES,
	RUN_INITIALIZATION_EVENT_TYPES
} from './event-discriminators.js';
import { ENGINE_PUBLIC_RUNTIME_EXPORTS } from './public-api.snapshot.js';

describe('engine public API compatibility', () => {
	it('matches the checked-in runtime export inventory', () => {
		expect(Object.keys(engine).sort()).toEqual(ENGINE_PUBLIC_RUNTIME_EXPORTS);
	});

	it('preserves public error constructor identity and fields', () => {
		expect(engine.IllegalActionError).toBe(IllegalActionError);
		expect(engine.StaleStateVersionError).toBe(StaleStateVersionError);
		expect(engine.ReplayIntegrityError).toBe(ReplayIntegrityError);

		expect(new engine.IllegalActionError('hero.wait', ['hero.train'])).toMatchObject({
			code: 'ILLEGAL_ACTION',
			legalActionIds: ['hero.train']
		});
		expect(new engine.StaleStateVersionError(3, 4)).toMatchObject({
			code: 'STALE_RUN_VERSION',
			expectedVersion: 3,
			latestVersion: 4
		});
		const replayIntegrity = new engine.ReplayIntegrityError('Replay diverged', 7);
		expect(replayIntegrity).toMatchObject({ sequence: 7 });
		expect(replayIntegrity).not.toHaveProperty('code');
	});

	it('keeps the manually audited event discriminator inventory unique', () => {
		expect(new Set(RUN_INITIALIZATION_EVENT_TYPES).size).toBe(
			RUN_INITIALIZATION_EVENT_TYPES.length
		);
		expect(new Set(LEGACY_EVENT_TYPES).size).toBe(LEGACY_EVENT_TYPES.length);
		expect(new Set(MODERN_EVENT_TYPES).size).toBe(MODERN_EVENT_TYPES.length);
		expect(ENGINE_EVENT_TYPES).toContain('run.initialized');
	});

	it('contains the event types emitted by the bootstrap fixture and builders', () => {
		const bootstrap = engine.createBootstrapEngine({
			runId: engine.deterministicUuid('compatibility-run'),
			seed: 'compatibility-seed',
			heroId: engine.deterministicUuid('compatibility-hero'),
			manifestHash: engine.sha256Hex('compatibility-manifest')
		});
		const heroId = Object.keys(bootstrap.snapshot.state.heroes)[0]!;
		const chosen = engine.applyCommand(bootstrap.snapshot.state, {
			commandId: engine.deterministicUuid('compatibility-choose'),
			runId: bootstrap.snapshot.state.runId,
			actorId: heroId,
			expectedVersion: bootstrap.snapshot.state.version,
			correlationId: engine.deterministicUuid('compatibility-choose'),
			source: {
				source: 'scripted',
				timing: 'continuous',
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			},
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'I will train.',
			storyBranch: 'steel-before-trust'
		});
		const emitted = [bootstrap.event, ...chosen.events].map((event) => event.eventType);
		const inventory = new Set<string>(ENGINE_EVENT_TYPES);
		expect(emitted.every((eventType) => inventory.has(eventType))).toBe(true);
	});
});
