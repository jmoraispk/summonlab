import { describe, expect, it } from 'vitest';

import { clampCamera, fitCamera, resetCamera, zoomCamera } from './camera';

describe('City camera', () => {
	it('fits, resets, and clamps zoom without moving authoritative scene points', () => {
		const fitted = fitCamera();
		expect(fitted).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
		expect(zoomCamera(fitted, 1, { x: 0.5, y: 0.5 }).zoom).toBe(1.9);
		expect(zoomCamera({ zoom: 2.8, offsetX: 0, offsetY: 0 }, 1, { x: 0.5, y: 0.5 }).zoom).toBe(3);
		expect(resetCamera()).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
	});

	it('bounds drag offsets for desktop and phone viewports', () => {
		expect(
			clampCamera({ zoom: 1, offsetX: 500, offsetY: -500 }, { width: 1440, height: 900 })
		).toEqual({ zoom: 1, offsetX: 56, offsetY: -54 });
		expect(
			clampCamera({ zoom: 1, offsetX: -500, offsetY: 500 }, { width: 390, height: 844 })
		).toEqual({ zoom: 1, offsetX: -23.4, offsetY: 50.64 });
	});
});
