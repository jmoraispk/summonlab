import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import { renderReversalCutRuntimeIcon } from './activate-reversal-cut-runtime-icon.js';

const FIXTURE_PATHS = [
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v6/completion.json',
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v6/owner-selected/visual-approval.json',
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v6/owner-selected/rarity-frame-a-source.png',
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v6/presentation/rarity-frame-a.png',
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v6/candidates/martial-blade-reversal-cut-framed-v2.png',
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v6/review/martial-blade-reversal-cut-framed-96.png',
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v4/presentation/charcoal-backing.png',
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v4/owner-frame-feedback.json',
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v3/activation.json',
	'assets/wiki/skills/icon-production-v1/geometry-v2.json',
	'assets/wiki/skills/icon-production-v1/masters/icons/martial-blade-reversal-cut.png',
	'assets/wiki/skills/icon-production-v1/masters/composites/martial-blade-reversal-cut.png',
	'assets/wiki/skills/icon-production-v1/review/recognition/martial-blade-reversal-cut.png',
	'apps/web/static/skill-icons/v1/512/martial-blade-reversal-cut.webp',
	'apps/web/static/skill-icons/v1/256/martial-blade-reversal-cut.webp',
	'apps/web/static/skill-icons/v1/128/martial-blade-reversal-cut.webp'
] as const;

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function fixtureRoot(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'reversal-cut-promotion-'));
	temporaryRoots.push(root);
	for (const pathname of FIXTURE_PATHS) {
		const destination = path.join(root, pathname);
		await mkdir(path.dirname(destination), { recursive: true });
		await cp(path.resolve(pathname), destination);
	}
	const art = await readFile(
		path.join(
			root,
			'assets/wiki/skills/icon-production-v1/masters/icons/martial-blade-reversal-cut.png'
		)
	);
	for (const [pathname, size] of [
		[
			'assets/wiki/skills/icon-production-v1/masters/composites/martial-blade-reversal-cut.png',
			1024
		],
		['apps/web/static/skill-icons/v1/512/martial-blade-reversal-cut.webp', 512],
		['apps/web/static/skill-icons/v1/256/martial-blade-reversal-cut.webp', 256],
		['apps/web/static/skill-icons/v1/128/martial-blade-reversal-cut.webp', 128],
		['assets/wiki/skills/icon-production-v1/review/recognition/martial-blade-reversal-cut.png', 96]
	] as const) {
		await writeFile(path.join(root, pathname), await renderReversalCutRuntimeIcon(art, size));
	}
	return root;
}

describe('approved Reversal Cut frame promotion', () => {
	it('publishes the accepted composite to the master and complete runtime size ladder', async () => {
		const promotionModule = await import('./promote-reversal-cut-approved-frame.js').catch(
			() => ({})
		);
		const promote = (
			promotionModule as {
				promoteApprovedReversalCutFrame?: (options: {
					root: string;
					mode: 'check' | 'write';
				}) => Promise<{ current: boolean; written: readonly string[] }>;
			}
		).promoteApprovedReversalCutFrame;
		expect(promote).toBeTypeOf('function');

		const root = await fixtureRoot();
		const report = await promote!({ root, mode: 'write' });
		expect(report.current).toBe(true);
		expect(report.written).toEqual(
			expect.arrayContaining([
				'assets/wiki/skills/icon-production-v1/masters/composites/martial-blade-reversal-cut.png',
				'apps/web/static/skill-icons/v1/512/martial-blade-reversal-cut.webp',
				'apps/web/static/skill-icons/v1/256/martial-blade-reversal-cut.webp',
				'apps/web/static/skill-icons/v1/128/martial-blade-reversal-cut.webp',
				'assets/wiki/skills/icon-production-v1/review/recognition/martial-blade-reversal-cut.png',
				'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v7/owner-review.json',
				'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v7/activation.json'
			])
		);

		const candidate = await readFile(
			path.join(
				root,
				'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v6/candidates/martial-blade-reversal-cut-framed-v2.png'
			)
		);
		const master = await readFile(
			path.join(
				root,
				'assets/wiki/skills/icon-production-v1/masters/composites/martial-blade-reversal-cut.png'
			)
		);
		expect(master.equals(candidate)).toBe(true);

		for (const size of [512, 256, 128] as const) {
			const runtime = await readFile(
				path.join(root, `apps/web/static/skill-icons/v1/${size}/martial-blade-reversal-cut.webp`)
			);
			expect(await sharp(runtime).metadata()).toMatchObject({
				format: 'webp',
				width: size,
				height: size,
				hasAlpha: true
			});
		}

		const review = JSON.parse(
			await readFile(
				path.join(
					root,
					'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v7/owner-review.json'
				),
				'utf8'
			)
		);
		const activation = JSON.parse(
			await readFile(
				path.join(
					root,
					'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v7/activation.json'
				),
				'utf8'
			)
		);
		expect(review).toMatchObject({
			decision: 'accepted',
			reviewerRole: 'owner',
			approvedCandidate: { contentHash: sha256(candidate) }
		});
		expect(activation).toMatchObject({
			activationId: 'martial-blade-reversal-cut-activation-v3',
			status: 'approved-runtime',
			compositeMaster: { contentHash: sha256(master) },
			runtimeUpdated: true,
			selfPromoted: false
		});

		await expect(promote!({ root, mode: 'check' })).resolves.toMatchObject({
			current: true,
			written: []
		});
	}, 40_000);
});
