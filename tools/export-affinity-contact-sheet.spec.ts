import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

import {
	AFFINITY_CONTACT_SHEET_HEIGHT,
	AFFINITY_CONTACT_SHEET_WIDTH,
	orderAffinityContactSheetSources,
	renderAffinityContactSheet,
	type AffinityContactSheetSource
} from './export-affinity-contact-sheet.js';

async function fixtures(): Promise<readonly AffinityContactSheetSource[]> {
	return Promise.all(
		Array.from({ length: 24 }, async (_, index) => ({
			targetId: `target-${String(index + 1).padStart(2, '0')}`,
			status: index % 7 === 0 ? ('revise' as const) : ('candidate' as const),
			bytes: await sharp({
				create: {
					width: 48,
					height: 32,
					channels: 3,
					background: { r: 20 + index * 5, g: 30 + index * 3, b: 50 + index * 2 }
				}
			})
				.png()
				.toBuffer()
		}))
	);
}

describe('affinity controlled contact sheet', () => {
	it('uses a deterministic opaque order independent of input order', async () => {
		const sources = await fixtures();
		const expected = orderAffinityContactSheetSources(sources).map((source) => source.targetId);
		expect(
			orderAffinityContactSheetSources([...sources].reverse()).map((source) => source.targetId)
		).toEqual(expected);
		expect(expected).not.toEqual(sources.map((source) => source.targetId));
	});

	it('renders the exact 24-source review canvas deterministically', async () => {
		const sources = await fixtures();
		const first = await renderAffinityContactSheet(sources);
		const second = await renderAffinityContactSheet([...sources].reverse());
		expect(first.equals(second)).toBe(true);
		expect(await sharp(first).metadata()).toEqual(
			expect.objectContaining({
				format: 'png',
				width: AFFINITY_CONTACT_SHEET_WIDTH,
				height: AFFINITY_CONTACT_SHEET_HEIGHT
			})
		);
	});

	it('rejects incomplete or duplicate source sets', async () => {
		const sources = await fixtures();
		await expect(renderAffinityContactSheet(sources.slice(0, 23))).rejects.toThrow(
			'exactly 24 sources'
		);
		await expect(
			renderAffinityContactSheet([...sources.slice(0, 23), sources[0]!])
		).rejects.toThrow('target IDs must be unique');
	});
});
