import { describe, expect, it } from 'vitest';
import { createPerspectiveBoardProjection } from './combat-board-projection';

const projection = createPerspectiveBoardProjection({
	columns: 7,
	rows: 9,
	topLeft: { x: 72, y: 102 },
	topRight: { x: 628, y: 102 },
	bottomRight: { x: 637, y: 846 },
	bottomLeft: { x: 62, y: 846 }
});

describe('perspective combat-board projection', () => {
	it('maps the authoritative board corners onto the authored scene', () => {
		expect(projection.projectGridPoint({ column: 0, row: 0 })).toEqual({ x: 72, y: 102 });
		expect(projection.projectGridPoint({ column: 7, row: 9 })).toEqual({ x: 637, y: 846 });
	});

	it('shares exact projected edges between adjacent logical cells', () => {
		const left = projection.projectCell({ column: 2, row: 4 });
		const right = projection.projectCell({ column: 3, row: 4 });

		expect(left.topRight).toEqual(right.topLeft);
		expect(left.bottomRight).toEqual(right.bottomLeft);
	});

	it('widens nearby cells without changing their logical topology', () => {
		const farCell = projection.projectCell({ column: 3, row: 0 });
		const nearCell = projection.projectCell({ column: 3, row: 8 });
		const farWidth = farCell.topRight.x - farCell.topLeft.x;
		const nearWidth = nearCell.bottomRight.x - nearCell.bottomLeft.x;

		expect(nearWidth).toBeGreaterThan(farWidth);
		expect(projection.projectCellCenter({ column: 3, row: 7 })).toEqual(
			projection.projectGridPoint({ column: 3.5, row: 7.5 })
		);
	});

	it('rejects cells outside the authoritative board', () => {
		expect(() => projection.projectCell({ column: 7, row: 0 })).toThrow(/outside the board/);
	});
});
