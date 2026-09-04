import { describe, expect, it } from 'vitest';

import { actorVisualRegistration } from './actor-visual-registration';

describe('actor visual registration', () => {
	it('lifts Nessa above the contact point without moving her shadow', () => {
		expect(actorVisualRegistration('moss-archer', 'archer', 'idle')).toEqual({
			bodyOffsetY: -4,
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
