import { createHash } from 'node:crypto';
import {
	access,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rename,
	rm,
	symlink,
	writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
	SkillIconResultSchema,
	type SkillIconAssignment,
	type SkillIconGeometry,
	type SkillIconTarget
} from '../packages/contracts/src/index.js';
import {
	parsePersistSkillIconCliRequest,
	persistSkillIconOutput,
	persistSkillIconOutputBound
} from './persist-skill-icon-output.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true }))));

const geometry: SkillIconGeometry = {
	schemaVersion: 'skill-icon-geometry-v1',
	canvas: { width: 1024, height: 1024 },
	center: { x: 512, y: 512 },
	aperturePoints: [
		[0.5, 0.078125],
		[0.8828125, 0.296875],
		[0.8828125, 0.703125],
		[0.5, 0.921875],
		[0.1171875, 0.703125],
		[0.1171875, 0.296875]
	],
	subjectSafePercent: 64,
	effectSafePercent: 72,
	rarityMedallionExclusion: [
		[0.41015625, 0],
		[0.58984375, 0],
		[0.58984375, 0.21484375],
		[0.41015625, 0.21484375]
	],
	runtimeSizes: [512, 256, 128],
	recognitionSize: 96
};

function packet() {
	const jobId = 'martial-blade-horizontal-slash-v1';
	const candidatePath = `assets/wiki/skills/icon-production-v1/candidates/icons/${jobId}.png`;
	const resultPath = `assets/wiki/skills/icon-production-v1/results/icons/${jobId}.json`;
	const target: SkillIconTarget = {
		schemaVersion: 'skill-icon-target-v1',
		jobId,
		role: 'skill-art',
		skillTargetId: 'martial:blade:horizontal-slash',
		motifFamily: null,
		rarity: null,
		exactPrompt: 'Paint one centered horizontal sword slash.',
		references: [
			{
				path: 'assets/wiki/skills/icon-production-v1/references/geometry-guide.png',
				purpose: 'Geometry.',
				contentHash: 'a'.repeat(64)
			}
		],
		canvas: { width: 1024, height: 1024, mediaType: 'image/png' },
		output: { candidatePath, resultPath }
	};
	const assignment: SkillIconAssignment = {
		schemaVersion: 'skill-icon-assignment-v1',
		assignmentId: `assignment-${jobId}`,
		jobId,
		targetPath: `assets/wiki/skills/icon-production-v1/targets/icons/${jobId}.json`,
		assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/icons/${jobId}.json`,
		skillVersion: 'summonlab-skill-icon-production-v1',
		assignedAt: '2026-09-02T08:00:00.000Z',
		retryCeiling: 1,
		permittedOutputs: { candidatePath, resultPath },
		forbiddenSharedPaths: ['assets/wiki/skills/icon-production-v1/catalog.json'],
		completionContract: {
			oneTargetOneImage: true,
			structuredResultRequired: true,
			sharedFilesMustRemainUntouched: true,
			selfPromotionForbidden: true
		}
	};
	return { target, assignment, candidatePath };
}

async function workspace() {
	const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-persist-'));
	roots.push(root);
	const sourcePath = path.join(root, 'provider.png');
	await writeFile(
		sourcePath,
		await sharp(
			Buffer.from(
				'<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><circle cx="512" cy="560" r="220" fill="red"/></svg>'
			)
		)
			.png()
			.toBuffer()
	);
	return { root, sourcePath };
}

describe('persistSkillIconOutput', () => {
	it('retains exact PNG bytes with caller-owned timestamp and collision safety', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		const receivedAt = '2026-09-02T09:10:11.000Z';
		const receipt = await persistSkillIconOutputBound({
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'skill-art',
			geometry,
			target,
			assignment,
			receivedAt
		});
		const bytes = await readFile(sourcePath);
		expect(receipt).toMatchObject({
			receivedAt,
			role: 'skill-art',
			source: { path: sourcePath },
			retained: {
				path: candidatePath,
				width: 1024,
				height: 1024,
				alphaMode: 'rgba',
				mediaType: 'image/png',
				bytes: bytes.byteLength,
				contentHash: createHash('sha256').update(bytes).digest('hex')
			}
		});
		expect(await readFile(path.join(root, candidatePath))).toEqual(bytes);
		const result = SkillIconResultSchema.parse(
			JSON.parse(await readFile(path.join(root, target.output.resultPath), 'utf8'))
		);
		expect(result).toMatchObject({
			jobId: target.jobId,
			status: 'candidate',
			output: { path: candidatePath, contentHash: receipt.retained.contentHash },
			writtenOutputPaths: [candidatePath, target.output.resultPath]
		});
		expect(receipt.result.path).toBe(target.output.resultPath);
		await expect(
			persistSkillIconOutputBound({
				root,
				sourcePath,
				candidatePath,
				expectedRole: 'skill-art',
				geometry,
				target,
				assignment,
				receivedAt
			})
		).rejects.toThrow(/exist|collision/iu);
	});

	it('preflights result collisions without leaving a candidate behind', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		await mkdir(path.dirname(path.join(root, target.output.resultPath)), { recursive: true });
		await writeFile(path.join(root, target.output.resultPath), 'existing evidence');
		await expect(
			persistSkillIconOutputBound({
				root,
				sourcePath,
				candidatePath,
				expectedRole: 'skill-art',
				geometry,
				target,
				assignment,
				receivedAt: '2026-09-02T09:10:11.000Z'
			})
		).rejects.toThrow(/result.*exist|collision/iu);
		await expect(access(path.join(root, candidatePath))).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('rejects identity, hash, location, format, dimension, and symlink violations', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		const base = {
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'skill-art' as const,
			geometry,
			target,
			assignment,
			receivedAt: '2026-09-02T09:10:11.000Z'
		};
		await expect(
			persistSkillIconOutputBound({ ...base, expectedSourceHash: 'b'.repeat(64) })
		).rejects.toThrow(/hash mismatch/u);
		await expect(
			persistSkillIconOutputBound({ ...base, candidatePath: 'outside.png' })
		).rejects.toThrow(/candidate/u);
		await expect(
			persistSkillIconOutputBound({ ...base, assignment: { ...assignment, jobId: 'different-v1' } })
		).rejects.toThrow(/assignment|identity|job/iu);

		const wrong = path.join(root, 'wrong.png');
		await writeFile(
			wrong,
			await sharp({ create: { width: 512, height: 512, channels: 4, background: '#f00f' } })
				.png()
				.toBuffer()
		);
		await expect(persistSkillIconOutputBound({ ...base, sourcePath: wrong })).rejects.toThrow(
			/1024|dimensions/u
		);
		const jpeg = path.join(root, 'wrong.jpg');
		await writeFile(
			jpeg,
			await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#f00' } })
				.jpeg()
				.toBuffer()
		);
		await expect(persistSkillIconOutputBound({ ...base, sourcePath: jpeg })).rejects.toThrow(
			/PNG/u
		);

		const outside = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-outside-'));
		roots.push(outside);
		await mkdir(path.join(root, 'assets/wiki/skills'), { recursive: true });
		await symlink(outside, path.join(root, 'assets/wiki/skills/icon-production-v1'));
		await expect(persistSkillIconOutputBound(base)).rejects.toThrow(/symbolic link/u);
		await expect(
			access(path.join(outside, 'candidates/icons', path.basename(candidatePath)))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('supports the promised four-field API by resolving its immutable packet identity', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		for (const [relativePath, value] of [
			[assignment.targetPath, target],
			[assignment.assignmentPath, assignment]
		] as const) {
			await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
			await writeFile(path.join(root, relativePath), JSON.stringify(value));
		}
		const previous = process.cwd();
		try {
			process.chdir(root);
			const receipt = await persistSkillIconOutput({
				sourcePath,
				candidatePath,
				expectedRole: 'skill-art',
				geometry
			});
			expect(receipt).toMatchObject({
				jobId: target.jobId,
				receivedAt: assignment.assignedAt,
				retained: { path: candidatePath }
			});
		} finally {
			process.chdir(previous);
		}
	});

	it('requires an explicit CLI receipt timestamp', () => {
		expect(() =>
			parsePersistSkillIconCliRequest([
				'--source',
				'/tmp/output.png',
				'--target',
				'assets/wiki/skills/icon-production-v1/targets/icons/example-v1.json',
				'--assignment',
				'assets/wiki/skills/icon-production-v1/assignments/icons/example-v1.json'
			])
		).toThrow(/--received-at/u);
	});

	it('rejects candidate and result ancestor swaps before either external write', async () => {
		for (const swap of ['candidate', 'result'] as const) {
			const { root, sourcePath } = await workspace();
			const { target, assignment, candidatePath } = packet();
			const outside = await mkdtemp(path.join(os.tmpdir(), `skill-icon-${swap}-outside-`));
			roots.push(outside);
			const swappedParent = path.join(
				root,
				swap === 'candidate'
					? 'assets/wiki/skills/icon-production-v1/candidates/icons'
					: 'assets/wiki/skills/icon-production-v1/results/icons'
			);
			await expect(
				persistSkillIconOutputBound({
					root,
					sourcePath,
					candidatePath,
					expectedRole: 'skill-art',
					geometry,
					target,
					assignment,
					receivedAt: '2026-09-02T09:10:11.000Z',
					testHooks: {
						[swap === 'candidate' ? 'beforeCandidateWrite' : 'beforeResultWrite']: async () => {
							await rename(swappedParent, `${swappedParent}-moved`);
							await symlink(outside, swappedParent);
						}
					}
				})
			).rejects.toThrow(/symbolic link|escaped/iu);
			expect(await readdir(outside)).toEqual([]);
		}
	});
});
