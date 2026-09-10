import { describe, expect, it } from 'vitest';

import { selectSingletonVillageStage } from './singleton-village-page';

describe('singleton Village page stage', () => {
	it('keeps incomplete campaigns in onboarding', () => {
		expect(selectSingletonVillageStage({ onboardingStep: 0, arrived: false })).toBe('onboarding');
		expect(selectSingletonVillageStage({ onboardingStep: 2, arrived: true })).toBe('onboarding');
	});

	it('shows the journey after onboarding and before arrival', () => {
		expect(selectSingletonVillageStage({ onboardingStep: 3, arrived: false })).toBe('journey');
	});

	it('shows the City after onboarding and arrival', () => {
		expect(selectSingletonVillageStage({ onboardingStep: 3, arrived: true })).toBe('city');
	});
});
