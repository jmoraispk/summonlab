import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('singleton Village page boundary', () => {
	it('renders the canonical campaign City without a parallel onboarding page', () => {
		const repositoryRoot = fileURLToPath(new URL('../../../../..', import.meta.url));
		const routeSource = readFileSync(
			`${repositoryRoot}/apps/web/src/routes/(city)/[mode=city]/+page.svelte`,
			'utf8'
		);
		const loaderSource = readFileSync(
			`${repositoryRoot}/apps/web/src/lib/server/singleton-village-page.ts`,
			'utf8'
		);

		expect(routeSource).toContain('SingletonCampaign');
		expect(routeSource).not.toContain('SingletonOnboarding');
		expect(routeSource).not.toContain('data.stage');
		expect(loaderSource).not.toContain('selectSingletonVillageStage');
		expect(loaderSource).not.toContain('loadOnboardingPage');
	});
});
