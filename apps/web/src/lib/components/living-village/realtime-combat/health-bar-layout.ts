import type { ProjectedCombatPoint } from './depth-projection';

export type HealthBarLayout = Readonly<{
	x: number;
	y: number;
	width: number;
	height: number;
}>;

export function layoutHealthBar(
	projected: ProjectedCombatPoint,
	bodyDisplaySize: number,
	options: Readonly<{
		anchorY?: number;
		clearance?: number;
		width?: number;
		height?: number;
	}> = {}
): HealthBarLayout {
	const anchorY = options.anchorY ?? 0.96;
	const clearance = options.clearance ?? 12;
	return {
		x: projected.x,
		y: projected.y - bodyDisplaySize * projected.scale * anchorY - clearance,
		width: options.width ?? 64,
		height: options.height ?? 7
	};
}
