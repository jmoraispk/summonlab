export type ProjectedPoint = Readonly<{ x: number; y: number }>;
export type GridPoint = Readonly<{ column: number; row: number }>;
export type ProjectedCell = Readonly<{
	topLeft: ProjectedPoint;
	topRight: ProjectedPoint;
	bottomRight: ProjectedPoint;
	bottomLeft: ProjectedPoint;
	center: ProjectedPoint;
}>;

export type PerspectiveBoardCalibration = Readonly<{
	columns: number;
	rows: number;
	topLeft: ProjectedPoint;
	topRight: ProjectedPoint;
	bottomRight: ProjectedPoint;
	bottomLeft: ProjectedPoint;
}>;

const interpolate = (start: number, end: number, progress: number) =>
	start + (end - start) * progress;

function assertCalibration(calibration: PerspectiveBoardCalibration): void {
	if (!Number.isInteger(calibration.columns) || calibration.columns <= 0) {
		throw new Error('Projected combat boards require a positive integer column count.');
	}
	if (!Number.isInteger(calibration.rows) || calibration.rows <= 0) {
		throw new Error('Projected combat boards require a positive integer row count.');
	}
	const topWidth = calibration.topRight.x - calibration.topLeft.x;
	const bottomWidth = calibration.bottomRight.x - calibration.bottomLeft.x;
	const leftHeight = calibration.bottomLeft.y - calibration.topLeft.y;
	const rightHeight = calibration.bottomRight.y - calibration.topRight.y;
	if (topWidth <= 0 || bottomWidth <= 0 || leftHeight <= 0 || rightHeight <= 0) {
		throw new Error(
			'Projected combat board corners must preserve left-to-right and top-to-bottom order.'
		);
	}
}

export function createPerspectiveBoardProjection(calibration: PerspectiveBoardCalibration) {
	assertCalibration(calibration);

	const projectGridPoint = ({ column, row }: GridPoint): ProjectedPoint => {
		const horizontalProgress = column / calibration.columns;
		const verticalProgress = row / calibration.rows;
		const left = {
			x: interpolate(calibration.topLeft.x, calibration.bottomLeft.x, verticalProgress),
			y: interpolate(calibration.topLeft.y, calibration.bottomLeft.y, verticalProgress)
		};
		const right = {
			x: interpolate(calibration.topRight.x, calibration.bottomRight.x, verticalProgress),
			y: interpolate(calibration.topRight.y, calibration.bottomRight.y, verticalProgress)
		};
		return {
			x: interpolate(left.x, right.x, horizontalProgress),
			y: interpolate(left.y, right.y, horizontalProgress)
		};
	};

	const projectCell = ({ column, row }: GridPoint): ProjectedCell => {
		if (
			!Number.isInteger(column) ||
			!Number.isInteger(row) ||
			column < 0 ||
			row < 0 ||
			column >= calibration.columns ||
			row >= calibration.rows
		) {
			throw new Error(`Projected combat cell ${column}:${row} is outside the board.`);
		}
		return {
			topLeft: projectGridPoint({ column, row }),
			topRight: projectGridPoint({ column: column + 1, row }),
			bottomRight: projectGridPoint({ column: column + 1, row: row + 1 }),
			bottomLeft: projectGridPoint({ column, row: row + 1 }),
			center: projectGridPoint({ column: column + 0.5, row: row + 0.5 })
		};
	};

	const projectCellCenter = ({ column, row }: GridPoint): ProjectedPoint =>
		projectGridPoint({ column: column + 0.5, row: row + 0.5 });

	return Object.freeze({ projectGridPoint, projectCell, projectCellCenter });
}
