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
	SKILL_ICON_NORMALIZATION_GEOMETRY_HASH,
	SkillIconResultV2Schema,
	SkillIconResultSchema,
	type SkillIconAssignmentV2,
	type SkillIconAssignment,
	type SkillIconGeometry,
	type SkillIconTargetV2,
	type SkillIconTarget
} from '../packages/contracts/src/index.js';
import {
	parsePersistSkillIconCliRequest,
	persistSkillIconOutput,
	persistSkillIconOutputBound
} from './persist-skill-icon-output.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true }))));
const canonicalGeometrySourceBytes = await readFile(
	'assets/wiki/skills/icon-production-v1/geometry.json'
);

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

function packetV2(geometrySourceBytes: Buffer) {
	const jobId = 'charcoal-forged-stone-v2';
	const candidatePath = `assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`;
	const resultPath = `assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`;
	if (
		createHash('sha256').update(geometrySourceBytes).digest('hex') !==
		SKILL_ICON_NORMALIZATION_GEOMETRY_HASH
	)
		throw new Error('V2 fixture must use canonical raw geometry bytes');
	const exactPrompt =
		'Paint charcoal forged stone over an opaque #00FF00 matte with no baked checkerboard.';
	const target: SkillIconTargetV2 = {
		schemaVersion: 'skill-icon-target-v2',
		jobId,
		logicalIdentity: 'charcoal-forged-stone',
		revision: 2,
		role: 'backing',
		skillTargetId: null,
		motifFamily: null,
		rarity: null,
		exactPrompt,
		references: [
			{
				path: 'assets/wiki/skills/icon-production-v1/references/geometry-guide.png',
				purpose: 'Geometry.',
				contentHash: 'a'.repeat(64)
			}
		],
		canvas: { width: 1024, height: 1024, mediaType: 'image/png' },
		output: { candidatePath, resultPath },
		normalization: {
			profile: 'skill-icon-green-key-role-mask-v1',
			sourceContract: {
				mediaType: 'image/png',
				width: 1254,
				height: 1254,
				alphaMode: 'rgb',
				matteColor: '#00FF00'
			},
			outputContract: {
				mediaType: 'image/png',
				width: 1024,
				height: 1024,
				alphaMode: 'rgba'
			},
			geometry: {
				path: 'assets/wiki/skills/icon-production-v1/geometry.json',
				contentHash: SKILL_ICON_NORMALIZATION_GEOMETRY_HASH
			}
		}
	};
	const assignment: SkillIconAssignmentV2 = {
		schemaVersion: 'skill-icon-assignment-v2',
		assignmentId: `assignment-${jobId}`,
		jobId,
		logicalIdentity: 'charcoal-forged-stone',
		revision: 2,
		targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`,
		assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`,
		skillVersion: 'summonlab-skill-icon-production-v2',
		normalization: { profile: 'skill-icon-green-key-role-mask-v1' },
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

async function v2ProviderSource(): Promise<Buffer> {
	return sharp({ create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' } })
		.composite([
			{
				input: Buffer.from(
					'<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><polygon points="627,98 1107,372 1107,882 627,1156 147,882 147,372" fill="#292c33"/></svg>'
				)
			}
		])
		.removeAlpha()
		.png({ progressive: false, palette: false })
		.toBuffer();
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
	it('normalizes a hash-bound V2 provider source only inside the collision-safe transaction', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-persist-v2-'));
		roots.push(root);
		const sourcePath = path.join(root, 'provider.png');
		const source = await v2ProviderSource();
		await writeFile(sourcePath, source);
		const geometrySourceBytes = canonicalGeometrySourceBytes;
		const { target, assignment, candidatePath } = packetV2(geometrySourceBytes);
		const sourceHash = createHash('sha256').update(source).digest('hex');
		const receipt = await persistSkillIconOutputBound({
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'backing',
			geometry,
			geometrySourceBytes,
			target,
			assignment,
			receivedAt: '2026-09-02T09:10:11.000Z',
			expectedSourceHash: sourceHash
		});
		const retained = await readFile(path.join(root, candidatePath));
		expect(retained).not.toEqual(source);
		expect(receipt.source).toMatchObject({
			path: sourcePath,
			width: 1254,
			height: 1254,
			alphaMode: 'rgb',
			contentHash: sourceHash
		});
		const result = SkillIconResultV2Schema.parse(
			JSON.parse(await readFile(path.join(root, target.output.resultPath), 'utf8'))
		);
		expect(result.normalization).toMatchObject({
			outcome: 'completed',
			sourceContentHash: sourceHash,
			outputContentHash: createHash('sha256').update(retained).digest('hex')
		});
	}, 15_000);

	it('rejects V2 source/geometry tampering and rolls back normalized candidates', async () => {
		for (const failure of ['source-hash', 'geometry-hash', 'result-write'] as const) {
			const root = await mkdtemp(path.join(os.tmpdir(), `skill-icon-persist-v2-${failure}-`));
			roots.push(root);
			const sourcePath = path.join(root, 'provider.png');
			const source = await v2ProviderSource();
			await writeFile(sourcePath, source);
			const geometrySourceBytes = canonicalGeometrySourceBytes;
			const { target, assignment, candidatePath } = packetV2(geometrySourceBytes);
			const options = {
				root,
				sourcePath,
				candidatePath,
				expectedRole: 'backing' as const,
				geometry,
				geometrySourceBytes:
					failure === 'geometry-hash'
						? Buffer.concat([geometrySourceBytes, Buffer.from(' ')])
						: geometrySourceBytes,
				target: target,
				assignment,
				receivedAt: '2026-09-02T09:10:11.000Z',
				expectedSourceHash:
					failure === 'source-hash'
						? '1'.repeat(64)
						: createHash('sha256').update(source).digest('hex'),
				...(failure === 'result-write'
					? { testHooks: { beforeResultWrite: () => Promise.reject(new Error('result stop')) } }
					: {})
			};
			await expect(persistSkillIconOutputBound(options)).rejects.toThrow();
			await expect(access(path.join(root, candidatePath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
			await expect(access(path.join(root, target.output.resultPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		}
	}, 20_000);

	it('revalidates candidate bytes after the result hook and rolls back owned partial files', async () => {
		for (const failure of ['candidate-mutation', 'candidate-partial', 'result-partial'] as const) {
			const { root, sourcePath } = await workspace();
			const { target, assignment, candidatePath } = packet();
			const candidate = path.join(root, candidatePath);
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
					testHooks:
						failure === 'candidate-mutation'
							? { beforeResultWrite: () => writeFile(candidate, Buffer.from('mutated')) }
							: failure === 'candidate-partial'
								? { afterCandidateOpen: () => Promise.reject(new Error('candidate write stop')) }
								: { afterResultOpen: () => Promise.reject(new Error('result write stop')) }
				})
			).rejects.toThrow();
			await expect(access(candidate)).rejects.toMatchObject({ code: 'ENOENT' });
			await expect(access(path.join(root, target.output.resultPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		}
	});
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
			const receipt = await persistSkillIconOutput(
				{
					sourcePath,
					candidatePath,
					expectedRole: 'skill-art',
					geometry
				},
				{ now: () => new Date('2026-09-02T12:34:56.000Z') }
			);
			expect(receipt).toMatchObject({
				jobId: target.jobId,
				receivedAt: '2026-09-02T12:34:56.000Z',
				retained: { path: candidatePath }
			});
			expect(receipt.receivedAt).not.toBe(assignment.assignedAt);
		} finally {
			process.chdir(previous);
		}
	});

	it('keeps the documented no-timestamp CLI grammar and accepts an optional timestamp', () => {
		expect(
			parsePersistSkillIconCliRequest([
				'--source',
				'/tmp/output.png',
				'--target',
				'assets/wiki/skills/icon-production-v1/targets/icons/example-v1.json',
				'--assignment',
				'assets/wiki/skills/icon-production-v1/assignments/icons/example-v1.json'
			])
		).not.toHaveProperty('receivedAt');
		expect(
			parsePersistSkillIconCliRequest([
				'--source',
				'/tmp/output.png',
				'--target',
				'assets/wiki/skills/icon-production-v1/targets/icons/example-v1.json',
				'--assignment',
				'assets/wiki/skills/icon-production-v1/assignments/icons/example-v1.json',
				'--received-at',
				'2026-09-02T12:34:56.000Z'
			])
		).toHaveProperty('receivedAt', '2026-09-02T12:34:56.000Z');
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

	it('never deletes an outside same-name victim when rollback sees a swapped candidate parent', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		const outside = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-rollback-outside-'));
		roots.push(outside);
		const candidateParent = path.dirname(path.join(root, candidatePath));
		const movedParent = `${candidateParent}-moved`;
		const outsideVictim = path.join(outside, path.basename(candidatePath));
		await writeFile(outsideVictim, 'outside-victim');
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
					beforeResultWrite: async () => {
						await rename(candidateParent, movedParent);
						await symlink(outside, candidateParent);
						throw new Error('trigger safe rollback');
					}
				}
			})
		).rejects.toThrow(/cleanup required|rollback was incomplete/iu);
		await expect(readFile(outsideVictim, 'utf8')).resolves.toBe('outside-victim');
		await expect(
			access(path.join(movedParent, path.basename(candidatePath)))
		).resolves.toBeUndefined();
	});
});
