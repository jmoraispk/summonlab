import { describe, expect, it } from 'vitest';

import {
	WELL_OBSTACLE,
	engagementPoint,
	engagementRange,
	isInsideObstacle,
	pushOutsideObstacle,
	routeAroundObstacle,
	segmentCrossesObstacle,
	separationSteering,
	type SpatialActor
} from './combat-spatial';

const rat = (id: string, x: number, y: number): SpatialActor => ({
	id,
	team: 'rats',
	role: 'swarm',
	range: 0.062,
	health: 58,
	x,
	y
});

const hero: SpatialActor = {
	id: 'iron-guardian',
	team: 'heroes',
	role: 'guardian',
	range: 0.072,
	health: 190,
	x: 0.5,
	y: 0.6
};

describe('combat spatial layout', () => {
	it('routes a direct crossing toward a deterministic side waypoint', () => {
		const start = { x: WELL_OBSTACLE.centerX, y: 0.2 };
		const goal = { x: WELL_OBSTACLE.centerX, y: 0.7 };
		expect(segmentCrossesObstacle(start, goal)).toBe(true);

		const waypoint = routeAroundObstacle(start, goal, 'plague-rat-1');
		expect(waypoint).toEqual(routeAroundObstacle(start, goal, 'plague-rat-1'));
		expect(Math.abs(waypoint.x - WELL_OBSTACLE.centerX)).toBeGreaterThan(WELL_OBSTACLE.radiusX);
	});

	it('projects an actor out of the solid well footprint', () => {
		const inside = { x: WELL_OBSTACLE.centerX, y: WELL_OBSTACLE.centerY };
		expect(isInsideObstacle(inside)).toBe(true);
		expect(isInsideObstacle(pushOutsideObstacle(inside, 0.01))).toBe(false);
	});

	it('assigns distinct engagement positions around one target', () => {
		const points = [1, 2, 3, 4].map((index) =>
			engagementPoint(rat(`plague-rat-${index}`, 0, 0), hero)
		);
		expect(new Set(points.map((point) => `${point.x.toFixed(3)}:${point.y.toFixed(3)}`)).size).toBe(
			4
		);
	});

	it('reserves more contact space when a brute engages a hero', () => {
		const brute: SpatialActor = {
			...rat('rat-brute', 0.5, 0.4),
			role: 'brute',
			range: 0.082
		};
		expect(engagementRange(brute, hero)).toBeGreaterThan(hero.range);
	});

	it('steers overlapping actors away from one another', () => {
		const first = rat('plague-rat-1', 0.4, 0.4);
		const second = rat('plague-rat-2', 0.41, 0.4);
		const steering = separationSteering(first, [first, second]);
		expect(steering.x).toBeLessThan(0);
	});
});
