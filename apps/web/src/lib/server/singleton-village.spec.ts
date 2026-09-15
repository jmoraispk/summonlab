import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { CampaignRun } from '@summonlab/contracts';
import { describe, expect, it, vi } from 'vitest';

import { campaignResumePath, generateCampaignCompany } from './campaign';
import { runtimePortraitFor } from './runtime-portraits';
import { createSingletonVillageResolver, SINGLETON_VILLAGE_SEED } from './singleton-village';

interface TestCampaign {
	readonly runId: string;
}

describe('singleton Village resolver', () => {
	it('summons only residents with approved Village cutouts', async () => {
		const company = await generateCampaignCompany(SINGLETON_VILLAGE_SEED);

		expect(
			company.map((hero) =>
				runtimePortraitFor(hero.manifestHash, hero.manifest.artKey, 'village-cutout')
			)
		).toEqual([
			expect.objectContaining({ publicPath: expect.stringContaining('/yaso-dreno/') }),
			expect.objectContaining({ publicPath: expect.stringContaining('/oren-sorin/') }),
			expect.objectContaining({ publicPath: expect.stringContaining('/joror-pelleth/') })
		]);
	});

	it('returns the active campaign without creating another', async () => {
		const existing = { runId: 'existing-run' } satisfies TestCampaign;
		const create = vi.fn<() => Promise<TestCampaign>>();
		const resolver = createSingletonVillageResolver({
			loadActive: vi.fn().mockResolvedValue(existing),
			create
		});

		await expect(resolver()).resolves.toBe(existing);
		expect(create).not.toHaveBeenCalled();
	});

	it('coalesces concurrent first-entry requests', async () => {
		const created = { runId: 'created-run' } satisfies TestCampaign;
		let releaseCreation: ((campaign: TestCampaign) => void) | undefined;
		const create = vi.fn(
			() =>
				new Promise<TestCampaign>((resolve) => {
					releaseCreation = resolve;
				})
		);
		const resolver = createSingletonVillageResolver({
			loadActive: vi.fn().mockResolvedValue(null),
			create
		});

		const resolutions = Promise.all([resolver(), resolver(), resolver()]);
		await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
		releaseCreation?.(created);

		const results = await resolutions;
		expect(new Set(results.map(({ runId }) => runId))).toEqual(new Set([created.runId]));
		expect(create).toHaveBeenCalledTimes(1);
	});

	it('clears a failed creation so the next request can retry', async () => {
		const created = { runId: 'retry-run' } satisfies TestCampaign;
		const create = vi
			.fn<() => Promise<TestCampaign>>()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValueOnce(created);
		const resolver = createSingletonVillageResolver({
			loadActive: vi.fn().mockResolvedValue(null),
			create
		});

		await expect(resolver()).rejects.toThrow('offline');
		await expect(resolver()).resolves.toEqual(created);
		expect(create).toHaveBeenCalledTimes(2);
	});

	it('uses the canonical Village path for every campaign stage', () => {
		expect(campaignResumePath({ onboardingStep: 0 } as CampaignRun)).toBe('/village');
		expect(campaignResumePath({ onboardingStep: 3 } as CampaignRun)).toBe('/village');
	});

	it('keeps singleton creation behind the Enter Village server action', () => {
		const repositoryRoot = fileURLToPath(new URL('../../../../..', import.meta.url));
		const rootPage = readFileSync(`${repositoryRoot}/apps/web/src/routes/+page.svelte`, 'utf8');
		const rootServer = readFileSync(
			`${repositoryRoot}/apps/web/src/routes/+page.server.ts`,
			'utf8'
		);

		expect(rootPage).toContain('<form method="POST"');
		expect(rootPage).not.toContain('/living-village-lab');
		expect(rootServer).toContain('getOrCreateSingletonVillage');
		expect(rootServer).toContain("redirect(303, '/village')");
	});
});
