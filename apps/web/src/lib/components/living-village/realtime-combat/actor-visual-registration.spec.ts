import { describe, expect, it } from 'vitest';

import { actorVisualRegistration } from './actor-visual-registration';

describe('actor visual registration', () => {
	const archerTuning = {
		bodyOffsetY: -4,
		shadowRadiusX: 45,
		shadowRadiusY: 14,
		displaySize: 168
	};

	it('uses request visual tuning without recognizing fixture identities', () => {
		const registration = actorVisualRegistration({
			role: 'guardian',
			clip: 'idle',
			visualTuning: { bodyOffsetY: -3, shadowRadiusX: 39, shadowRadiusY: 13, displaySize: 184 }
		});

		expect(registration).toEqual({
			bodyOffsetY: -3,
			shadowRadiusX: 39,
			shadowRadiusY: 13,
			displaySize: 184
		});
	});

	it.each([
		['idle', -4],
		['advance', -4],
		['attack', -4],
		['hit', -4],
		['down', 0]
	] as const)('registers Nessa %s at body offset %i', (clip, bodyOffsetY) => {
		expect(actorVisualRegistration({ role: 'archer', clip, visualTuning: archerTuning })).toEqual({
			bodyOffsetY,
			shadowRadiusX: 45,
			shadowRadiusY: 14,
			displaySize: 168
		});
	});

	it('uses a guardian request binding for its contact shadow', () => {
		expect(
			actorVisualRegistration({
				role: 'guardian',
				clip: 'advance',
				visualTuning: { bodyOffsetY: -3, shadowRadiusX: 39, shadowRadiusY: 13, displaySize: 184 }
			})
		).toEqual({
			bodyOffsetY: -3,
			shadowRadiusX: 39,
			shadowRadiusY: 13,
			displaySize: 184
		});
	});

	it('rests defeated actors on the shared ground line', () => {
		expect(
			actorVisualRegistration({ role: 'archer', clip: 'down', visualTuning: archerTuning })
				.bodyOffsetY
		).toBe(0);
		expect(
			actorVisualRegistration({
				role: 'guardian',
				clip: 'down',
				visualTuning: { bodyOffsetY: -3, shadowRadiusX: 39, shadowRadiusY: 13, displaySize: 184 }
			}).bodyOffsetY
		).toBe(0);
	});

	it('preserves an independent brawler request binding', () => {
		expect(
			actorVisualRegistration({
				role: 'brawler',
				clip: 'idle',
				visualTuning: { bodyOffsetY: 0, shadowRadiusX: 45, shadowRadiusY: 14, displaySize: 178 }
			})
		).toEqual({
			bodyOffsetY: 0,
			shadowRadiusX: 45,
			shadowRadiusY: 14,
			displaySize: 178
		});
	});
});
