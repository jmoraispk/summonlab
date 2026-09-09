export interface CityCameraState {
	readonly zoom: number;
	readonly offsetX: number;
	readonly offsetY: number;
}

export interface CityCameraPoint {
	readonly x: number;
	readonly y: number;
}

export interface CityViewportSize {
	readonly width: number;
	readonly height: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.9;

export function fitCamera(): CityCameraState {
	return { zoom: 1, offsetX: 0, offsetY: 0 };
}

export function resetCamera(): CityCameraState {
	return fitCamera();
}

export function zoomCamera(
	state: CityCameraState,
	direction: -1 | 1,
	_anchor: CityCameraPoint
): CityCameraState {
	return {
		...state,
		zoom: clamp(state.zoom + direction * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM)
	};
}

export function clampCamera(state: CityCameraState, viewport: CityViewportSize): CityCameraState {
	const maximumX = Math.min(56, viewport.width * 0.06);
	const maximumY = Math.min(56, viewport.height * 0.06);
	return {
		zoom: clamp(state.zoom, MIN_ZOOM, MAX_ZOOM),
		offsetX: clamp(state.offsetX, -maximumX, maximumX),
		offsetY: clamp(state.offsetY, -maximumY, maximumY)
	};
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}
