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
	radiusX: 0.094,
	radiusY: 0.066
};

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

export function engagementRange(actor: SpatialActor, target: SpatialActor): number {
	return Math.max(actor.range, (collisionRadius(actor) + collisionRadius(target)) * 0.96);
}

export function engagementPoint(actor: SpatialActor, target: SpatialActor): CombatPoint {
	const heroAngles = [Math.PI / 2, Math.PI / 2 - 0.72, Math.PI / 2 + 0.72];
	const ratAngles = [-Math.PI / 2, -Math.PI / 2 - 0.68, -Math.PI / 2 + 0.68, Math.PI, 0];
	const angles = actor.team === 'heroes' ? heroAngles : ratAngles;
	const angle = angles[slotOrdinal(actor) % angles.length]!;
	const reach = engagementRange(actor, target) * (actor.role === 'archer' ? 0.88 : 0.82);
	return {
		x: clamp(target.x + Math.cos(angle) * reach, 0.07, 0.93),
		y: clamp(target.y + (Math.sin(angle) * reach) / 1.18, 0.07, 0.93)
	};
}

export function separationSteering(
	actor: SpatialActor,
	actors: readonly SpatialActor[]
): CombatPoint {
	let x = 0;
	let y = 0;
	for (const other of actors) {
		if (other.id === actor.id || other.health <= 0) continue;
		const deltaX = actor.x - other.x;
		const deltaY = (actor.y - other.y) * 1.18;
		const distance = Math.hypot(deltaX, deltaY);
		const minimum = collisionRadius(actor) + collisionRadius(other);
		if (distance >= minimum) continue;
		const safeDistance = distance || 0.0001;
		const strength = (minimum - distance) / minimum;
		x += (deltaX / safeDistance || stableSide(actor.id)) * strength;
		y += ((deltaY / safeDistance || -1) * strength) / 1.18;
	}
	const length = Math.hypot(x, y);
	return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

export function actorCollisionPadding(actor: SpatialActor): number {
	return collisionRadius(actor) * 0.45;
}
