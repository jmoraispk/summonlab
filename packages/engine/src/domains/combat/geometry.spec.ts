import type { ReadinessCombatStateV1 } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { relativePositionsForFacing, resolveEntityRelativePosition } from './geometry.js';

function spatialState(input: {
	target?: Partial<ReadinessCombatStateV1['combatants'][string]>;
	blockedTiles?: readonly { x: number; y: number }[];
	blockerPosition?: { x: number; y: number } | null;
}): Pick<ReadinessCombatStateV1, 'combatants' | 'terrain'> {
	const combatant = (
		combatantId: string,
		position: { x: number; y: number }
	): ReadinessCombatStateV1['combatants'][string] => ({
		combatantId,
		combatantKind: 'hero',
		teamId: 'party',
		position,
		facing: 'east',
		resources: { health: { current: 10, maximum: 10 }, mana: { current: 0, maximum: 0 } },
		lastDamagedAtTick: null,
		attributes: { strength: 1, vitality: 1, agility: 1, magic: 1 },
		armour: 0,
		resistances: {},
		readiness: { value: 0, exactNumerator: 0, recoveryUntilTick: 0 },
		conditions: [],
		cooldowns: {},
		downed: false,
		active: true
	});
	const actor = combatant('actor', { x: 0, y: 0 });
	const target = { ...combatant('target', { x: 2, y: 2 }), ...input.target };
	const combatants = { actor, target };
	if (input.blockerPosition) {
		Object.assign(combatants, { blocker: combatant('blocker', input.blockerPosition) });
	}
	return {
		combatants,
		terrain: {
			width: 5,
			height: 5,
			blockedTiles: [...(input.blockedTiles ?? [])],
			features: []
		}
	};
}

describe('target-facing combat geometry', () => {
	it('places behind west and flanks north/south for an east-facing target', () => {
		const target = { x: 3, y: 3 };
		expect(relativePositionsForFacing(target, 'east', 'behind')).toStrictEqual([{ x: 2, y: 3 }]);
		expect(relativePositionsForFacing(target, 'east', 'flank-left')).toStrictEqual([
			{ x: 3, y: 2 }
		]);
		expect(relativePositionsForFacing(target, 'east', 'flank-right')).toStrictEqual([
			{ x: 3, y: 4 }
		]);
	});

	it('distinguishes inactive, impossible, blocked, and occupied relative destinations', () => {
		expect(
			resolveEntityRelativePosition(
				spatialState({ target: { active: false } }),
				'actor',
				'target',
				'behind'
			)
		).toMatchObject({ ok: false, reason: 'inactive-target', position: null });
		expect(
			resolveEntityRelativePosition(
				spatialState({ target: { position: { x: 0, y: 0 } } }),
				'actor',
				'target',
				'behind'
			)
		).toMatchObject({ ok: false, reason: 'impossible-geometry', position: { x: -1, y: 0 } });
		expect(
			resolveEntityRelativePosition(
				spatialState({ blockedTiles: [{ x: 1, y: 2 }] }),
				'actor',
				'target',
				'behind'
			)
		).toMatchObject({ ok: false, reason: 'blocked', position: { x: 1, y: 2 } });
		expect(
			resolveEntityRelativePosition(
				spatialState({ blockerPosition: { x: 1, y: 2 } }),
				'actor',
				'target',
				'behind'
			)
		).toMatchObject({ ok: false, reason: 'occupied', position: { x: 1, y: 2 } });
	});
});
