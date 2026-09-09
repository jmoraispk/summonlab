import { describe, expect, it } from 'vitest';

import { createDecodedStageAssetOwner } from './stage-decoded-assets';

function deferred<T>() {
	let resolve: (value: T) => void;
	let reject: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve: resolve!, reject: reject! };
}

describe('decoded stage asset ownership', () => {
	it('disposes a late spritesheet and blob URL exactly once after a sibling decode failure', async () => {
		type Sheet = { id: string };
		const firstDecode = deferred<void>();
		const siblingDecode = deferred<Sheet>();
		const destroyedSheets: string[] = [];
		const unloadedUrls: string[] = [];
		const revokedUrls: string[] = [];
		const owner = createDecodedStageAssetOwner<Sheet>({
			destroySheet: (sheet) => destroyedSheets.push(sheet.id),
			unloadObjectUrl: async (url) => {
				unloadedUrls.push(url);
			},
			revokeObjectUrl: (url) => revokedUrls.push(url)
		});

		const normalSheet = { id: 'normal-sheet' };
		expect(owner.retainSheet(normalSheet)).toBe(true);
		const failedMotionDecode = (async () => {
			expect(owner.retainObjectUrl('blob:failed-motion')).toBe(true);
			await firstDecode.promise;
			throw new Error('malformed motion JSON');
		})();
		const lateMotionDecode = (async () => {
			expect(owner.retainObjectUrl('blob:late-motion')).toBe(true);
			const sheet = await siblingDecode.promise;
			expect(owner.retainSheet(sheet)).toBe(false);
			expect(await owner.settleObjectUrl('blob:late-motion')).toBe(false);
		})();

		firstDecode.reject(new Error('malformed motion JSON'));
		await expect(failedMotionDecode).rejects.toThrow('malformed motion JSON');
		const cleanup = owner.release();
		expect(owner.released).toBe(true);
		siblingDecode.resolve({ id: 'late-sheet' });
		await lateMotionDecode;
		await cleanup;

		expect(destroyedSheets).toEqual(['normal-sheet', 'late-sheet']);
		expect(revokedUrls).toEqual(['blob:failed-motion', 'blob:late-motion']);
		expect(unloadedUrls).toEqual(['blob:failed-motion', 'blob:late-motion', 'blob:late-motion']);
		expect(owner.retainedCounts).toEqual({ objectUrls: 0, sheets: 0 });

		await owner.release();
		expect(destroyedSheets).toEqual(['normal-sheet', 'late-sheet']);
		expect(revokedUrls).toEqual(['blob:failed-motion', 'blob:late-motion']);
	});
});
