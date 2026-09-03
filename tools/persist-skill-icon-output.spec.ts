import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
	access,
	mkdir,
	mkdtemp,
	open,
	readFile,
	readdir,
	rename,
	rm,
	symlink,
	writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

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
const execFileAsync = promisify(execFile);
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true }))));
const canonicalGeometrySourceBytes = await readFile(
	'assets/wiki/skills/icon-production-v1/geometry.json'
);
const referenceBytes = Buffer.from('immutable geometry reference fixture');
const referenceHash = createHash('sha256').update(referenceBytes).digest('hex');
const referencePath = 'assets/wiki/skills/icon-production-v1/references/geometry-guide.png';

async function seedReference(root: string): Promise<void> {
	const absolute = path.join(root, referencePath);
	await mkdir(path.dirname(absolute), { recursive: true });
	await writeFile(absolute, referenceBytes);
}

function crc32(bytes: Buffer): number {
	let crc = 0xffffffff;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function declareSrgb(png: Buffer): Buffer {
	const type = Buffer.from('sRGB', 'ascii');
	const data = Buffer.from([0]);
	const chunk = Buffer.alloc(13);
	chunk.writeUInt32BE(1, 0);
	type.copy(chunk, 4);
	data.copy(chunk, 8);
	chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), 9);
	const ihdrEnd = 8 + 12 + png.readUInt32BE(8);
	return Buffer.concat([png.subarray(0, ihdrEnd), chunk, png.subarray(ihdrEnd)]);
}

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
				path: referencePath,
				purpose: 'Geometry.',
				contentHash: referenceHash
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
				path: referencePath,
				purpose: 'Geometry.',
				contentHash: referenceHash
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
	const png = await sharp({
		create: { width: 1254, height: 1254, channels: 3, background: '#00ff00' }
	})
		.composite([
			{
				input: Buffer.from(
					'<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg"><polygon points="627,118 1087,382 1087,872 627,1136 167,872 167,382" fill="#292c33"/></svg>'
				)
			}
		])
		.removeAlpha()
		.png({ progressive: false, palette: false })
		.toBuffer();
	return declareSrgb(png);
}

async function workspace() {
	const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-persist-'));
	roots.push(root);
	await seedReference(root);
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

async function seedPackets(
	root: string,
	target: SkillIconTarget | SkillIconTargetV2,
	assignment: SkillIconAssignment | SkillIconAssignmentV2
): Promise<void> {
	for (const [relativePath, value] of [
		[assignment.targetPath, target],
		[assignment.assignmentPath, assignment]
	] as const) {
		await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
		await writeFile(path.join(root, relativePath), JSON.stringify(value));
	}
}

describe('persistSkillIconOutput', () => {
	it('normalizes a hash-bound V2 provider source only inside the collision-safe transaction', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-persist-v2-'));
		roots.push(root);
		const sourcePath = path.join(root, 'provider.png');
		await seedReference(root);
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
			await seedReference(root);
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
								? {
										afterCandidateOpen: async () => {
											await expect(access(candidate)).rejects.toMatchObject({ code: 'ENOENT' });
											const siblings = await readdir(path.dirname(candidate));
											expect(siblings.some((name) => name.includes('.skill-icon-tmp-'))).toBe(true);
											throw new Error('candidate write stop');
										}
									}
								: {
										afterResultOpen: async () => {
											const result = path.join(root, target.output.resultPath);
											await expect(access(result)).rejects.toMatchObject({ code: 'ENOENT' });
											const siblings = await readdir(path.dirname(result));
											expect(siblings.some((name) => name.includes('.skill-icon-tmp-'))).toBe(true);
											throw new Error('result write stop');
										}
									}
				})
			).rejects.toThrow();
			await expect(access(candidate)).rejects.toMatchObject({ code: 'ENOENT' });
			await expect(access(path.join(root, target.output.resultPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
			for (const parent of [
				path.dirname(candidate),
				path.dirname(path.join(root, target.output.resultPath))
			])
				expect((await readdir(parent)).filter((name) => name.includes('.skill-icon-tmp-'))).toEqual(
					[]
				);
		}
	});

	it('revalidates every target reference immediately before staging output bytes', async () => {
		for (const failure of ['missing', 'mutated'] as const) {
			const { root, sourcePath } = await workspace();
			const { target, assignment, candidatePath } = packet();
			const reference = path.join(root, referencePath);
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
						beforeCandidateWrite: () =>
							failure === 'missing'
								? rm(reference)
								: writeFile(reference, Buffer.from('changed reference bytes'))
					}
				})
			).rejects.toThrow(/reference|ENOENT|no such file/iu);
			await expect(access(path.join(root, candidatePath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
			await expect(access(path.join(root, target.output.resultPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		}
	});

	it('never unlinks a foreign inode raced into a staged temporary pathname', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		const candidateParent = path.dirname(path.join(root, candidatePath));
		let foreignPath: string | undefined;
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
					afterCandidateOpen: async () => {
						const temporaryName = (await readdir(candidateParent)).find((name) =>
							name.includes('.skill-icon-tmp-')
						);
						if (!temporaryName) throw new Error('missing staged fixture');
						foreignPath = path.join(candidateParent, temporaryName);
						await rename(foreignPath, `${foreignPath}.original-inode`);
						await writeFile(foreignPath, Buffer.from('foreign staged-name victim'));
						throw new Error('stop after staged-name replacement');
					}
				}
			})
		).rejects.toThrow(/ownership changed|cleanup required/iu);
		expect(foreignPath).toBeDefined();
		await expect(readFile(foreignPath!, 'utf8')).resolves.toBe('foreign staged-name victim');
		await expect(access(path.join(root, candidatePath))).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('rolls back both outputs when a bound reference mutates after result installation', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		const candidate = path.join(root, candidatePath);
		const result = path.join(root, target.output.resultPath);
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
					afterResultInstall: () =>
						writeFile(path.join(root, referencePath), Buffer.from('late reference mutation'))
				}
			})
		).rejects.toThrow(/reference .*changed during persistence/iu);
		await expect(access(candidate)).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(access(result)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('rejects a same-byte result inode replacement and does not delete the replacement', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		const candidate = path.join(root, candidatePath);
		const result = path.join(root, target.output.resultPath);
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
					afterResultInstall: async () => {
						const replacement = `${result}.replacement`;
						await writeFile(replacement, await readFile(result));
						await rename(replacement, result);
					}
				}
			})
		).rejects.toThrow(/result identity|rollback was incomplete/iu);
		await expect(access(candidate)).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(access(result)).resolves.toBeUndefined();
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
		await rm(path.join(root, 'assets/wiki/skills/icon-production-v1'), { recursive: true });
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
			const expectedSourceHash = createHash('sha256')
				.update(await readFile(sourcePath))
				.digest('hex');
			const receipt = await persistSkillIconOutput(
				{
					sourcePath,
					candidatePath,
					expectedRole: 'skill-art',
					geometry,
					expectedSourceHash
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

	it.each(['target', 'assignment'] as const)(
		'rolls back when the public API %s packet changes after its authority read',
		async (changedAuthority) => {
			const { root, sourcePath } = await workspace();
			const { target, assignment, candidatePath } = packet();
			await seedPackets(root, target, assignment);
			const expectedSourceHash = createHash('sha256')
				.update(await readFile(sourcePath))
				.digest('hex');
			const changedPath = path.join(
				root,
				changedAuthority === 'target' ? assignment.targetPath : assignment.assignmentPath
			);
			const previous = process.cwd();
			try {
				process.chdir(root);
				await expect(
					persistSkillIconOutput(
						{
							sourcePath,
							candidatePath,
							expectedRole: 'skill-art',
							geometry,
							expectedSourceHash
						},
						{
							testHooks: {
								afterAuthorityRead: () => writeFile(changedPath, Buffer.from('changed packet'))
							}
						}
					)
				).rejects.toThrow(new RegExp(`${changedAuthority} packet changed`, 'iu'));
			} finally {
				process.chdir(previous);
			}
			await expect(access(path.join(root, candidatePath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
			await expect(access(path.join(root, target.output.resultPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		}
	);

	it('rolls back when V2 geometry changes after the public authority read', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-public-v2-authority-'));
		roots.push(root);
		await seedReference(root);
		const sourcePath = path.join(root, 'provider.png');
		const source = await v2ProviderSource();
		await writeFile(sourcePath, source);
		const { target, assignment, candidatePath } = packetV2(canonicalGeometrySourceBytes);
		await seedPackets(root, target, assignment);
		const geometryPath = path.join(root, target.normalization.geometry.path);
		await mkdir(path.dirname(geometryPath), { recursive: true });
		await writeFile(geometryPath, canonicalGeometrySourceBytes);
		const previous = process.cwd();
		try {
			process.chdir(root);
			await expect(
				persistSkillIconOutput(
					{
						sourcePath,
						candidatePath,
						expectedRole: 'backing',
						geometry,
						expectedSourceHash: createHash('sha256').update(source).digest('hex')
					},
					{
						testHooks: {
							afterAuthorityRead: () =>
								writeFile(
									geometryPath,
									Buffer.concat([canonicalGeometrySourceBytes, Buffer.from(' ')])
								)
						}
					}
				)
			).rejects.toThrow(/geometry authority changed/iu);
		} finally {
			process.chdir(previous);
		}
		await expect(access(path.join(root, candidatePath))).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(access(path.join(root, target.output.resultPath))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	}, 15_000);

	it.each(['fifo', 'huge'] as const)(
		'rejects a %s packet authority without blocking or unbounded allocation',
		async (unsafeKind) => {
			const { root, sourcePath } = await workspace();
			const { target, assignment, candidatePath } = packet();
			await mkdir(path.dirname(path.join(root, assignment.targetPath)), { recursive: true });
			await mkdir(path.dirname(path.join(root, assignment.assignmentPath)), { recursive: true });
			await writeFile(path.join(root, assignment.assignmentPath), JSON.stringify(assignment));
			const targetPath = path.join(root, assignment.targetPath);
			if (unsafeKind === 'fifo') await execFileAsync('mkfifo', [targetPath]);
			else {
				const handle = await open(targetPath, 'w');
				try {
					await handle.truncate(65 * 1024 * 1024);
				} finally {
					await handle.close();
				}
			}
			const previous = process.cwd();
			try {
				process.chdir(root);
				await expect(
					persistSkillIconOutput({
						sourcePath,
						candidatePath,
						expectedRole: 'skill-art',
						geometry,
						expectedSourceHash: createHash('sha256')
							.update(await readFile(sourcePath))
							.digest('hex')
					})
				).rejects.toThrow(/regular file|safety limit/iu);
			} finally {
				process.chdir(previous);
			}
		},
		3_000
	);

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
			).rejects.toThrow(/symbolic link|escaped|unsafe/iu);
			expect(await readdir(outside)).toEqual([]);
		}
	});

	it('keeps staging bound to the held candidate directory during a post-open parent swap', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		const outside = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-held-parent-outside-'));
		roots.push(outside);
		const candidateParent = path.dirname(path.join(root, candidatePath));
		const movedParent = `${candidateParent}-moved`;
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
					afterCandidateOpen: async () => {
						await rename(candidateParent, movedParent);
						await symlink(outside, candidateParent);
					}
				}
			})
		).rejects.toThrow(/parent identity changed|parent identity is unsafe/iu);
		expect(await readdir(outside)).toEqual([]);
		expect(
			(await readdir(movedParent)).filter((name) => name.includes('.skill-icon-tmp-'))
		).toEqual([]);
		await expect(
			access(path.join(movedParent, path.basename(candidatePath)))
		).rejects.toMatchObject({
			code: 'ENOENT'
		});
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
		).rejects.toThrow(/trigger safe rollback/iu);
		await expect(readFile(outsideVictim, 'utf8')).resolves.toBe('outside-victim');
		await expect(
			access(path.join(movedParent, path.basename(candidatePath)))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});
});
