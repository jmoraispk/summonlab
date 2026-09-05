export type CombatPoint = Readonly<{ x: number; y: number }>;

export type SpatialActor = CombatPoint &
	Readonly<{
		id: string;
		team: 'heroes' | 'rats';
		role: 'brawler' | 'guardian' | 'archer' | 'brute' | 'swarm';
		range: number;
		health: number;
	}>;

export type EllipseObstacle = Readonly<{
	centerX: number;
	centerY: number;
	radiusX: number;
	radiusY: number;
}>;

export const WELL_OBSTACLE: EllipseObstacle = {
	centerX: 0.674,
	centerY: 0.35,
	radiusX: 0.126,
	radiusY: 0.092
};

export type ArenaBounds = Readonly<{
	minimumX: number;
	maximumX: number;
	minimumY: number;
	maximumY: number;
}>;

const clamp = (value: number, minimum: number, maximum: number): number =>
	Math.min(maximum, Math.max(minimum, value));

const stableSide = (id: string): -1 | 1 => {
	let hash = 0;
	for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) | 0;
	return (Math.abs(hash) % 2 === 0 ? -1 : 1) as -1 | 1;
};

const ellipseValue = (point: CombatPoint, obstacle: EllipseObstacle): number => {
	const x = (point.x - obstacle.centerX) / obstacle.radiusX;
	const y = (point.y - obstacle.centerY) / obstacle.radiusY;
	return x * x + y * y;
};

export function isInsideObstacle(
	point: CombatPoint,
	obstacle: EllipseObstacle = WELL_OBSTACLE
): boolean {
	return ellipseValue(point, obstacle) < 1;
}

export function segmentCrossesObstacle(
	start: CombatPoint,
	end: CombatPoint,
	obstacle: EllipseObstacle = WELL_OBSTACLE
): boolean {
	const startX = (start.x - obstacle.centerX) / obstacle.radiusX;
	const startY = (start.y - obstacle.centerY) / obstacle.radiusY;
	const deltaX = (end.x - start.x) / obstacle.radiusX;
	const deltaY = (end.y - start.y) / obstacle.radiusY;
	const divisor = deltaX * deltaX + deltaY * deltaY;
	const closest = divisor === 0 ? 0 : clamp(-(startX * deltaX + startY * deltaY) / divisor, 0, 1);
	const x = startX + deltaX * closest;
	const y = startY + deltaY * closest;
	return x * x + y * y < 1;
}

export function routeAroundObstacle(
	start: CombatPoint,
	goal: CombatPoint,
	actorId: string,
	obstacle: EllipseObstacle = WELL_OBSTACLE
): CombatPoint {
	if (!segmentCrossesObstacle(start, goal, obstacle)) return goal;
	const travelDirection = Math.sign(goal.y - start.y) || 1;
	const side = stableSide(actorId);
	const routeX = obstacle.centerX + side * (obstacle.radiusX + 0.028);
	const entryY = obstacle.centerY - travelDirection * (obstacle.radiusY + 0.018);
	const exitY = obstacle.centerY + travelDirection * (obstacle.radiusY + 0.018);
	const outsideSide = Math.abs(start.x - obstacle.centerX) >= obstacle.radiusX + 0.018;
	const reachedEntry = travelDirection > 0 ? start.y >= entryY - 0.012 : start.y <= entryY + 0.012;
	if (!outsideSide && !reachedEntry) return { x: routeX, y: entryY };
	if (!outsideSide) return { x: routeX, y: start.y };
	const passedExit = travelDirection > 0 ? start.y >= exitY : start.y <= exitY;
	return passedExit ? goal : { x: routeX, y: exitY };
}

export function pushOutsideObstacle(
	point: CombatPoint,
	padding = 0,
	obstacle: EllipseObstacle = WELL_OBSTACLE
): CombatPoint {
	const radiusX = obstacle.radiusX + padding;
	const radiusY = obstacle.radiusY + padding;
	const normalizedX = (point.x - obstacle.centerX) / radiusX;
	const normalizedY = (point.y - obstacle.centerY) / radiusY;
	const length = Math.hypot(normalizedX, normalizedY);
	if (length >= 1) return point;
	const safeLength = length || 1;
	return {
		x: obstacle.centerX + (normalizedX / safeLength) * radiusX,
		y: obstacle.centerY + ((length ? normalizedY : -1) / safeLength) * radiusY
	};
}

const slotOrdinal = (actor: SpatialActor): number => {
	const ratMatch = actor.id.match(/plague-rat-(\d+)/);
	if (ratMatch) return Number.parseInt(ratMatch[1]!, 10) - 1;
	if (actor.id === 'rat-brute') return 4;
	if (actor.id === 'saffron-braid') return 0;
	if (actor.id === 'iron-guardian') return 1;
	if (actor.id === 'moss-archer') return 2;
	return actor.id.length;
};

const collisionRadius = (actor: SpatialActor): number =>
	actor.role === 'brute' ? 0.065 : actor.role === 'swarm' ? 0.025 : 0.04;

export function arenaBounds(actor: SpatialActor): ArenaBounds {
	const horizontalMargin = actor.role === 'brute' ? 0.16 : actor.role === 'swarm' ? 0.09 : 0.13;
	return {
		minimumX: horizontalMargin,
		maximumX: 1 - horizontalMargin,
		minimumY: actor.role === 'brute' ? 0.16 : 0.08,
		maximumY: 0.91
	};
}

export function clampToArena(actor: SpatialActor, point: CombatPoint): CombatPoint {
	const bounds = arenaBounds(actor);
	return {
		x: clamp(point.x, bounds.minimumX, bounds.maximumX),
		y: clamp(point.y, bounds.minimumY, bounds.maximumY)
	};
}

export function engagementRange(actor: SpatialActor, target: SpatialActor): number {
	return Math.max(actor.range, (collisionRadius(actor) + collisionRadius(target)) * 0.96);
}

export function engagementPoint(actor: SpatialActor, target: SpatialActor): CombatPoint {
	const heroAngles = [Math.PI / 2, Math.PI / 2 - 0.72, Math.PI / 2 + 0.72];
	const ratAngles = [-Math.PI / 2, -Math.PI / 2 - 0.68, -Math.PI / 2 + 0.68, Math.PI, 0];
	const angles = actor.team === 'heroes' ? heroAngles : ratAngles;
	const angle = angles[slotOrdinal(actor) % angles.length]!;
	const reach = engagementRange(actor, target) * (actor.role === 'archer' ? 0.88 : 0.82);
	return clampToArena(actor, {
		x: target.x + Math.cos(angle) * reach,
		y: target.y + (Math.sin(angle) * reach) / 1.18
	});
}

export function actorCollisionPadding(actor: SpatialActor): number {
	return collisionRadius(actor) * 0.72;
}
