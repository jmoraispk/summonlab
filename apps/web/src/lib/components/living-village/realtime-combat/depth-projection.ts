export type CombatPresentationMode = '2d' | '2.5d' | '2.5d-v2';

export type ProjectedCombatPoint = Readonly<{
	x: number;
	y: number;
	scale: number;
	depth: number;
	laneWidth: number;
}>;

export type ProjectionOptions = Readonly<{
	width: number;
	height: number;
}>;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const smoothstep = (value: number): number => value * value * (3 - 2 * value);

export function projectCombatPoint(
	mode: CombatPresentationMode,
	worldX: number,
	worldY: number,
	options: ProjectionOptions
): ProjectedCombatPoint {
	const x = clamp01(worldX);
	const y = clamp01(worldY);
	if (mode === '2d') {
		return {
			x: x * options.width,
			y: y * options.height,
			scale: 0.91,
			depth: Math.round(y * 1000),
			laneWidth: options.width
		};
	}

	if (mode === '2.5d') {
		return {
			x: x * options.width,
			y: y * options.height,
			scale: 0.7 + y * 0.38,
			depth: Math.round(y * 1000),
			laneWidth: options.width
		};
	}

	const depthProgress = smoothstep(y);
	const laneFactor = 0.68 + depthProgress * 0.42;
	const laneWidth = options.width * laneFactor;
	return {
		x: options.width / 2 + (x - 0.5) * laneWidth,
		y: Math.pow(y, 0.95) * options.height,
		scale: 0.57 + depthProgress * 0.56,
		depth: Math.round(Math.pow(y, 0.95) * 1000),
		laneWidth
	};
}
