import { describe, expect, it } from 'vitest';

import { actorVisualRegistration } from './actor-visual-registration';

describe('actor visual registration', () => {
	it.each([
		['idle', -4],
		['advance', -4],
		['attack', -4],
		['hit', -4],
		['down', 0]
	] as const)('registers Nessa %s at body offset %i', (clip, bodyOffsetY) => {
		expect(actorVisualRegistration('moss-archer', 'archer', clip)).toEqual({
			bodyOffsetY,
			shadowRadiusX: 45,
			shadowRadiusY: 14
		});
	});

	it('lifts Toma and tightens only his contact shadow', () => {
		expect(actorVisualRegistration('iron-guardian', 'guardian', 'advance')).toEqual({
			bodyOffsetY: -3,
			shadowRadiusX: 39,
			shadowRadiusY: 13
		});
	});

	it('rests defeated actors on the shared ground line', () => {
		expect(actorVisualRegistration('moss-archer', 'archer', 'down').bodyOffsetY).toBe(0);
		expect(actorVisualRegistration('iron-guardian', 'guardian', 'down').bodyOffsetY).toBe(0);
	});

	it('preserves the established registration for other heroes', () => {
		expect(actorVisualRegistration('saffron-braid', 'brawler', 'idle')).toEqual({
			bodyOffsetY: 0,
			shadowRadiusX: 45,
			shadowRadiusY: 14
		});
	});
});
