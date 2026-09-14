import type { ReadinessCombatStateV1 } from '@summonlab/contracts';

type Position = Readonly<{ x: number; y: number }>;
type Facing = ReadinessCombatStateV1['combatants'][string]['facing'];
type SpatialCombatState = Pick<ReadinessCombatStateV1, 'combatants' | 'terrain'>;
export type EntityRelativeRelation = 'adjacent' | 'behind' | 'flank-left' | 'flank-right';

export type EntityRelativePositionResolution =
	| Readonly<{ ok: true; position: Position }>
	| Readonly<{
			ok: false;
			reason: 'inactive-target' | 'impossible-geometry' | 'blocked' | 'occupied';
			position: Position | null;
	  }>;

function facingVector(facing: Facing): Position {
	if (facing === 'north') return { x: 0, y: -1 };
	if (facing === 'east') return { x: 1, y: 0 };
	if (facing === 'south') return { x: 0, y: 1 };
	return { x: -1, y: 0 };
}

export function relativePositionsForFacing(
	targetPosition: Position,
	targetFacing: Facing,
	relation: EntityRelativeRelation
): readonly Position[] {
	const forward = facingVector(targetFacing);
	const offsets =
		relation === 'adjacent'
			? [
					{ x: -forward.x, y: -forward.y },
					{ x: forward.y, y: -forward.x },
					{ x: -forward.y, y: forward.x },
					forward
				]
			: relation === 'behind'
				? [{ x: -forward.x, y: -forward.y }]
				: relation === 'flank-left'
					? [{ x: forward.y, y: -forward.x }]
					: [{ x: -forward.y, y: forward.x }];
	return offsets.map((offset) => ({
		x: targetPosition.x + offset.x,
		y: targetPosition.y + offset.y
	}));
}

export function positionIsAtFacingRelation(
	position: Position,
	targetPosition: Position,
	targetFacing: Facing,
	relation: EntityRelativeRelation
): boolean {
	return relativePositionsForFacing(targetPosition, targetFacing, relation).some(
		(candidate) => candidate.x === position.x && candidate.y === position.y
	);
}

export function resolveEntityRelativePosition(
	state: SpatialCombatState,
	actorId: string,
	targetId: string,
	relation: EntityRelativeRelation
): EntityRelativePositionResolution {
	const target = state.combatants[targetId];
	if (!target || !target.active || target.downed) {
		return { ok: false, reason: 'inactive-target', position: null };
	}
	const positions = relativePositionsForFacing(target.position, target.facing, relation);
	let blocked: Position | null = null;
	let occupied: Position | null = null;
	for (const position of positions) {
		if (
			position.x < 0 ||
			position.y < 0 ||
			position.x >= state.terrain.width ||
			position.y >= state.terrain.height
		) {
			continue;
		}
		if (
			state.terrain.blockedTiles.some(
				(candidate) => candidate.x === position.x && candidate.y === position.y
			)
		) {
			blocked ??= position;
			continue;
		}
		if (
			Object.values(state.combatants).some(
				(combatant) =>
					combatant.combatantId !== actorId &&
					combatant.position.x === position.x &&
					combatant.position.y === position.y
			)
		) {
			occupied ??= position;
			continue;
		}
		return { ok: true, position };
	}
	if (occupied) return { ok: false, reason: 'occupied', position: occupied };
	if (blocked) return { ok: false, reason: 'blocked', position: blocked };
	return { ok: false, reason: 'impossible-geometry', position: positions[0] ?? null };
}
