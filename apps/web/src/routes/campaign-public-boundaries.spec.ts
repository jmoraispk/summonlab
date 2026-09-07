import { generateSummonableCompany } from '@summonlab/characters';
import {
	CampaignRunSchema,
	ProofRunSnapshotSchema,
	type EngineSnapshot
} from '@summonlab/contracts';
import { createBootstrapEngine } from '@summonlab/engine';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	campaign: null as ReturnType<typeof CampaignRunSchema.parse> | null,
	proof: null as ReturnType<typeof ProofRunSnapshotSchema.parse> | null,
	engine: null as EngineSnapshot | null,
	failure: null as string | null
}));

vi.mock('@summonlab/config', () => ({
	getConfig: () => ({ databaseUrl: 'postgres://unused', simulationSpeed: 1 })
}));

vi.mock('@summonlab/database', () => {
	const failIfRequested = (): void => {
		if (mocks.failure) throw new Error(mocks.failure);
	};
	return {
		getLatestActiveCampaignRun: vi.fn(async () => {
			failIfRequested();
			return mocks.campaign;
		}),
		getCampaignRun: vi.fn(async () => {
			failIfRequested();
			return mocks.campaign;
		}),
		getProofRun: vi.fn(async () => {
			failIfRequested();
			return mocks.proof;
		}),
		getEngineSnapshot: vi.fn(async () => {
			failIfRequested();
			return mocks.engine;
		}),
		createProofRun: vi.fn(async () => {
			failIfRequested();
			return mocks.proof;
		}),
		registerCampaignRun: vi.fn(async () => {
			failIfRequested();
			return mocks.campaign;
		}),
		advanceCampaignOnboarding: vi.fn(async () => {
			failIfRequested();
			return mocks.campaign;
		})
	};
});

vi.mock('$lib/server/health', () => ({
	getWebHealth: vi.fn(async () => ({
		status: 'ok',
		service: 'web',
		database: { status: 'available' }
	}))
}));

import { GET as getCampaigns, POST as createCampaign } from './api/campaigns/+server.js';
import { GET as getCampaign } from './api/campaigns/[runId]/+server.js';
import { POST as advanceOnboarding } from './api/campaigns/[runId]/onboarding/+server.js';
import { POST as restartCampaign } from './api/campaigns/[runId]/restart/+server.js';
import { load as loadOnboarding } from './onboarding/[runId]/+page.server.js';
import { load as loadTitle } from './+page.server.js';

beforeAll(async () => {
	const drafts = await generateSummonableCompany('campaign-boundary-seed', 3);
	const primary = drafts[0]!;
	const runId = '00000000-0000-4000-8000-000000000001';
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'private-campaign-engine-seed',
		heroId: primary.manifest.characterId,
		manifestHash: primary.manifestHash,
		rarityStars: primary.manifest.rarityStars,
		mind: primary.mind,
		additionalHeroes: drafts.slice(1).map((draft) => ({
			heroId: draft.manifest.characterId,
			manifestHash: draft.manifestHash,
			rarityStars: draft.manifest.rarityStars,
			mind: draft.mind
		}))
	});
	if (bootstrap.snapshot.state.schemaVersion !== 13)
		throw new Error('Expected campaign engine-v13');
	mocks.engine = bootstrap.snapshot;
	mocks.campaign = CampaignRunSchema.parse({
		runId,
		campaignSeed: 'campaign-boundary-seed',
		controlMode: 'wait',
		lifecycle: 'active',
		engineStatus: 'active',
		onboardingStep: 2,
		restartedFromRunId: null,
		heroes: drafts.map((draft, index) => ({ ordinal: index + 1, draft })),
		createdAt: '2026-09-06T00:00:00.000Z',
		updatedAt: '2026-09-06T00:00:00.000Z'
	});
	mocks.proof = ProofRunSnapshotSchema.parse({
		runId,
		storyEnvelopeId: 'first-ember-v1',
		controlMode: 'wait',
		directive: '',
		recipe: primary.recipe,
		manifest: primary.manifest,
		mind: primary.mind,
		manifestHash: primary.manifestHash,
		firstObservation: 'A sealed gate cools behind the hero.',
		firstLine: null,
		destination: null,
		storyBranch: null,
		arrived: false,
		events: [],
		createdAt: '2026-09-06T00:00:00.000Z'
	});
	(mocks.campaign.heroes[0]!.draft.mind as unknown as Record<string, unknown>).futureSecret =
		'campaign-private-mind-sentinel';
	(mocks.campaign.heroes[0]!.draft.manifest as unknown as Record<string, unknown>).futureSecret =
		'campaign-private-manifest-sentinel';
});

function expectPublic(value: unknown): void {
	const serialized = JSON.stringify(value);
	for (const forbidden of [
		'campaign-private-',
		'private-campaign-engine-seed',
		'manifestHash',
		'stateHash',
		'projectionHash',
		'campaignSeed',
		'"recipe"',
		'"mind"',
		'"personality"',
		'"aptitudes"'
	]) {
		expect(serialized).not.toContain(forbidden);
	}
}

function request(path: string, data: unknown): Request {
	return new Request(`http://summonlab.test${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(data)
	});
}

describe('production campaign boundaries', () => {
	it('serializes only public identity, demeanor, and objective DTOs', async () => {
		const runId = mocks.campaign!.runId;
		const responses = await Promise.all([
			getCampaigns({} as never) as Promise<Response>,
			createCampaign({
				request: request('/api/campaigns', { seed: 'new-campaign', controlMode: 'wait' })
			} as never) as Promise<Response>,
			getCampaign({ params: { runId } } as never) as Promise<Response>,
			advanceOnboarding({
				params: { runId },
				request: request(`/api/campaigns/${runId}/onboarding`, { step: 1 })
			} as never) as Promise<Response>,
			restartCampaign({
				params: { runId },
				request: request(`/api/campaigns/${runId}/restart`, {
					seedMode: 'same',
					controlMode: 'wait'
				})
			} as never) as Promise<Response>
		]);
		for (const response of responses) {
			expect(response.status).toBeLessThan(300);
			expectPublic(await response.json());
		}

		const page = await loadOnboarding({ params: { runId } } as never);
		expectPublic(page);
		const pageRecord = page as { view: { heroes: Record<string, unknown>[] } };
		expect(Object.keys(pageRecord.view.heroes[0]!).sort()).toEqual(
			['ordinal', 'manifest', 'publicManifestHash', 'demeanor', 'firstReply'].sort()
		);
		const title = await loadTitle({
			request: new Request('http://summonlab.test/')
		} as never);
		expectPublic(title);
	});

	it('uses fixed public failures while logging private diagnostics server-side', async () => {
		mocks.failure = 'campaign-private-error-sentinel';
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		try {
			const response = (await getCampaigns({} as never)) as Response;
			expect(response.status).toBe(500);
			expect(await response.text()).not.toContain(mocks.failure);
		} finally {
			mocks.failure = null;
			consoleError.mockRestore();
		}
	});
});
