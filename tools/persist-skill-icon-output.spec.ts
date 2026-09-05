import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
	access,
	lstat,
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
	SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH,
	SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
	SkillIconResultV2Schema,
	SkillIconResultSchema,
	type SkillIconAssignmentV2,
	type SkillIconAssignment,
	type SkillIconGeometry,
	type SkillIconGeometryV2,
	type SkillIconTargetV2,
	type SkillIconTarget
} from '../packages/contracts/src/index.js';
import {
	parsePersistSkillIconCliRequest,
	persistSkillIconOutput,
	persistSkillIconOutputBound,
	persistSkillIconSupersededResult,
	skillIconSupersessionIntentPath,
	SkillIconSupersessionIntentSchema,
	SKILL_ICON_PERSISTENCE_JOURNAL_PATH,
	SKILL_ICON_PERSISTENCE_LOCK_PATH,
	SKILL_ICON_PERSISTENCE_TOKEN_PATH
} from './persist-skill-icon-output.js';
import {
	normalizeSkillIconProviderSource,
	SKILL_ICON_NORMALIZATION_PROFILE_V2,
	SKILL_ICON_NORMALIZATION_PROFILE_V3
} from './normalize-skill-icon-provider-source.js';
import { parseSupersedeSkillIconCliRequest } from './supersede-skill-icon-result.js';

const roots: string[] = [];
const execFileAsync = promisify(execFile);
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true }))));
const canonicalGeometrySourceBytes = await readFile(
	'assets/wiki/skills/icon-production-v1/geometry.json'
);
const canonicalGeometryV2SourceBytes = await readFile(SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH);
const canonicalGuideV2Bytes = await readFile(SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH);
const referenceBytes = await readFile(
	'assets/wiki/skills/icon-production-v1/references/geometry-guide.png'
);
const referenceHash = createHash('sha256').update(referenceBytes).digest('hex');
const referencePath = 'assets/wiki/skills/icon-production-v1/references/geometry-guide.png';

async function seedReference(root: string): Promise<void> {
	const absolute = path.join(root, referencePath);
	await mkdir(path.dirname(absolute), { recursive: true });
	await writeFile(absolute, referenceBytes);
}

async function seedGuideV2(root: string): Promise<void> {
	const absolute = path.join(root, SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH);
	await mkdir(path.dirname(absolute), { recursive: true });
	await writeFile(absolute, canonicalGuideV2Bytes);
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

function declareCabx(png: Buffer): Buffer {
	const payload = Buffer.from('persist-profile-v2-container-evidence', 'ascii');
	const data = Buffer.alloc(8 + payload.length);
	data.writeUInt32BE(data.length, 0);
	data.write('jumb', 4, 'ascii');
	payload.copy(data, 8);
	const type = Buffer.from('caBX', 'ascii');
	const chunk = Buffer.alloc(data.length + 12);
	chunk.writeUInt32BE(data.length, 0);
	type.copy(chunk, 4);
	data.copy(chunk, 8);
	chunk.writeUInt32BE(crc32(Buffer.concat([type, data])), data.length + 8);
	const ihdrEnd = 8 + 12 + png.readUInt32BE(8);
	return Buffer.concat([png.subarray(0, ihdrEnd), chunk, png.subarray(ihdrEnd)]);
}

function withoutPngChunk(png: Buffer, removedType: string): Buffer {
	const chunks = [png.subarray(0, 8)];
	let offset = 8;
	while (offset < png.length) {
		const length = png.readUInt32BE(offset);
		const end = offset + length + 12;
		if (png.toString('ascii', offset + 4, offset + 8) !== removedType)
			chunks.push(png.subarray(offset, end));
		offset = end;
	}
	return Buffer.concat(chunks);
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
const geometryV2: SkillIconGeometryV2 = JSON.parse(
	canonicalGeometryV2SourceBytes.toString('utf8')
) as SkillIconGeometryV2;

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
				purpose: 'Geometry guide for registration and safe zones.',
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
				purpose: 'Geometry guide for registration and safe zones.',
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

function packetProfileV2(geometrySourceBytes: Buffer) {
	const prior = packetV2(geometrySourceBytes);
	const jobId = 'charcoal-forged-stone-v3';
	const candidatePath = `assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`;
	const resultPath = `assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`;
	const target: SkillIconTargetV2 = {
		...prior.target,
		jobId,
		revision: 3,
		output: { candidatePath, resultPath },
		normalization: {
			profile: 'skill-icon-green-key-role-mask-v2',
			sourceContract: prior.target.normalization.sourceContract,
			outputContract: prior.target.normalization.outputContract,
			geometry: {
				path: 'assets/wiki/skills/icon-production-v1/geometry.json',
				contentHash: SKILL_ICON_NORMALIZATION_GEOMETRY_HASH
			}
		}
	};
	const assignment: SkillIconAssignmentV2 = {
		...prior.assignment,
		assignmentId: `assignment-${jobId}`,
		jobId,
		revision: 3,
		targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`,
		assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`,
		skillVersion: 'summonlab-skill-icon-production-v3',
		normalization: { profile: 'skill-icon-green-key-role-mask-v2' },
		permittedOutputs: { candidatePath, resultPath }
	};
	return { target, assignment, candidatePath };
}

function packetProfileV3() {
	const prior = packetV2(canonicalGeometrySourceBytes);
	const jobId = 'charcoal-forged-stone-v4';
	const candidatePath = `assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`;
	const resultPath = `assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`;
	const target: SkillIconTargetV2 = {
		...prior.target,
		jobId,
		revision: 4,
		references: [
			{
				path: SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
				purpose: SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
				contentHash: SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH
			}
		],
		output: { candidatePath, resultPath },
		normalization: {
			profile: 'skill-icon-green-key-role-mask-v3',
			sourceContract: prior.target.normalization.sourceContract,
			outputContract: prior.target.normalization.outputContract,
			geometry: {
				path: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
				contentHash: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH
			}
		}
	};
	const assignment: SkillIconAssignmentV2 = {
		...prior.assignment,
		assignmentId: `assignment-${jobId}`,
		jobId,
		revision: 4,
		targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`,
		assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`,
		skillVersion: 'summonlab-skill-icon-production-v4',
		normalization: { profile: 'skill-icon-green-key-role-mask-v3' },
		permittedOutputs: { candidatePath, resultPath }
	};
	return { target, assignment, candidatePath };
}

function packetGeometryRoleMask() {
	const prior = packetProfileV3();
	const jobId = 'charcoal-forged-stone-v6';
	const candidatePath = `assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`;
	const resultPath = `assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`;
	const target: SkillIconTargetV2 = {
		...prior.target,
		jobId,
		revision: 6,
		output: { candidatePath, resultPath },
		normalization: {
			profile: 'skill-icon-geometry-role-mask-v1',
			sourceContract: prior.target.normalization.sourceContract,
			outputContract: prior.target.normalization.outputContract,
			geometry: {
				path: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
				contentHash: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH
			}
		}
	};
	const assignment: SkillIconAssignmentV2 = {
		...prior.assignment,
		assignmentId: `assignment-${jobId}`,
		jobId,
		revision: 6,
		targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`,
		assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`,
		skillVersion: 'summonlab-skill-icon-production-v5',
		normalization: { profile: 'skill-icon-geometry-role-mask-v1' },
		permittedOutputs: { candidatePath, resultPath }
	};
	return { target, assignment, candidatePath };
}

async function v2ProviderSource(
	profile:
		| 'skill-icon-green-key-role-mask-v1'
		| 'skill-icon-green-key-role-mask-v2'
		| 'skill-icon-green-key-role-mask-v3'
		| 'skill-icon-geometry-role-mask-v1' = 'skill-icon-green-key-role-mask-v1'
): Promise<Buffer> {
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
	return profile === 'skill-icon-green-key-role-mask-v2' ||
		profile === 'skill-icon-green-key-role-mask-v3' ||
		profile === 'skill-icon-geometry-role-mask-v1'
		? declareCabx(withoutPngChunk(png, 'pHYs'))
		: declareSrgb(png);
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

type PersistenceCrashBoundary =
	| 'afterTokenStageOpen'
	| 'afterTokenStageComplete'
	| 'afterTokenInstall'
	| 'afterLockInstall'
	| 'afterOutputStagesComplete'
	| 'afterCandidateInstall'
	| 'afterJournalRemoval';

async function crashPersistenceAt(
	input: {
		readonly root: string;
		readonly sourcePath: string;
		readonly target: SkillIconTarget;
		readonly assignment: SkillIconAssignment;
		readonly candidatePath: string;
	},
	boundary: PersistenceCrashBoundary
): Promise<void> {
	const payloadPath = path.join(input.root, 'crash-payload.json');
	await writeFile(
		payloadPath,
		JSON.stringify({
			...input,
			geometry,
			receivedAt: '2026-09-02T09:10:11.000Z'
		})
	);
	const moduleUrl = new URL('./persist-skill-icon-output.ts', import.meta.url).href;
	const program = `
		import { readFile } from 'node:fs/promises';
		const { persistSkillIconOutputBound } = await import(${JSON.stringify(moduleUrl)});
		const payload = JSON.parse(await readFile(${JSON.stringify(payloadPath)}, 'utf8'));
		await persistSkillIconOutputBound({
			...payload,
			expectedRole: 'skill-art',
			testHooks: { [${JSON.stringify(boundary)}]: () => process.kill(process.pid, 'SIGKILL') }
		});
	`;
	await expect(
		execFileAsync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', program], {
			cwd: process.cwd()
		})
	).rejects.toMatchObject({ signal: 'SIGKILL' });
}

describe('persistSkillIconOutput', () => {
	it('uses one immutable bound request when its caller mutates every field during source read', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		const sourceHash = createHash('sha256')
			.update(await readFile(sourcePath))
			.digest('hex');
		const redirectedCandidatePath = candidatePath.replace('.png', '-redirected.png');
		const redirectedSourcePath = path.join(root, 'redirected-provider.png');
		await writeFile(redirectedSourcePath, Buffer.from('not the authorized source'));
		const options: Parameters<typeof persistSkillIconOutputBound>[0] = {
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'skill-art' as const,
			geometry,
			target,
			assignment,
			receivedAt: '2026-09-02T09:10:11.000Z',
			expectedSourceHash: sourceHash,
			testHooks: {
				afterSourceRead: mutateOptions
			}
		};
		function mutateOptions(): void {
			Object.assign(options, {
				root: path.join(root, 'redirected-root'),
				sourcePath: redirectedSourcePath,
				candidatePath: redirectedCandidatePath,
				expectedRole: 'backing',
				geometry: { ...geometry, canvas: { width: 1, height: 1 } },
				target: { ...target, jobId: 'redirected-job-v1' },
				assignment: { ...assignment, jobId: 'redirected-job-v1' },
				receivedAt: '2026-09-02T10:11:12.000Z',
				expectedSourceHash: '1'.repeat(64),
				testHooks: undefined
			});
		}

		const receipt = await persistSkillIconOutputBound(options);
		expect(receipt).toMatchObject({
			jobId: target.jobId,
			role: 'skill-art',
			receivedAt: '2026-09-02T09:10:11.000Z',
			source: { path: sourcePath },
			retained: { path: candidatePath }
		});
		await expect(access(path.join(root, candidatePath))).resolves.toBeUndefined();
		await expect(access(path.join(root, redirectedCandidatePath))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});

	it('does not let a bound hook heal an unauthorized source hash', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		const actualHash = createHash('sha256')
			.update(await readFile(sourcePath))
			.digest('hex');
		const options: Parameters<typeof persistSkillIconOutputBound>[0] = {
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'skill-art' as const,
			geometry,
			target,
			assignment,
			receivedAt: '2026-09-02T09:10:11.000Z',
			expectedSourceHash: '1'.repeat(64),
			testHooks: {
				afterSourceRead: healSourceHash
			}
		};
		function healSourceHash(): void {
			Object.assign(options, { expectedSourceHash: actualHash });
		}

		await expect(persistSkillIconOutputBound(options)).rejects.toThrow(/hash mismatch/iu);
		await expect(access(path.join(root, candidatePath))).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(access(path.join(root, target.output.resultPath))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});

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

	it('persists the exact profile-v2 caBX normalization and its completed evidence', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-persist-profile-v2-'));
		roots.push(root);
		const sourcePath = path.join(root, 'provider.png');
		await seedReference(root);
		const source = await v2ProviderSource(SKILL_ICON_NORMALIZATION_PROFILE_V2);
		await writeFile(sourcePath, source);
		const geometrySourceBytes = canonicalGeometrySourceBytes;
		const { target, assignment, candidatePath } = packetProfileV2(geometrySourceBytes);
		const expected = await normalizeSkillIconProviderSource(
			source,
			'backing',
			geometrySourceBytes,
			SKILL_ICON_NORMALIZATION_PROFILE_V2
		);
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
		expect(retained).toEqual(expected.bytes);
		expect(receipt.source.contentHash).toBe(sourceHash);
		const result = SkillIconResultV2Schema.parse(
			JSON.parse(await readFile(path.join(root, target.output.resultPath), 'utf8'))
		);
		expect(result.normalization).toMatchObject({
			profile: SKILL_ICON_NORMALIZATION_PROFILE_V2,
			outcome: 'completed',
			providerSource: { contentHash: sourceHash },
			sourceContentHash: sourceHash,
			decoderInputContentHash: expected.normalization.decoderInputContentHash,
			containerBox: expected.normalization.containerBox,
			colorSpaceDisposition: 'assigned-srgb',
			outputContentHash: createHash('sha256').update(retained).digest('hex')
		});
		if (
			result.normalization.profile !== SKILL_ICON_NORMALIZATION_PROFILE_V2 ||
			result.normalization.outcome !== 'completed'
		)
			throw new Error('Expected completed profile-v2 normalization evidence');
		expect(result.normalization.decoderInputContentHash).not.toBe(sourceHash);
	}, 15_000);

	it('persists profile-v3 only through skill-v4 with raw geometry-v2 and guide-v2 authorities', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-persist-profile-v3-'));
		roots.push(root);
		const sourcePath = path.join(root, 'provider.png');
		await seedGuideV2(root);
		const source = await v2ProviderSource(SKILL_ICON_NORMALIZATION_PROFILE_V3);
		await writeFile(sourcePath, source);
		const { target, assignment, candidatePath } = packetProfileV3();
		const sourceHash = createHash('sha256').update(source).digest('hex');

		await persistSkillIconOutputBound({
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'backing',
			geometry: geometryV2,
			geometrySourceBytes: canonicalGeometryV2SourceBytes,
			target,
			assignment,
			receivedAt: '2026-09-02T09:10:11.000Z',
			expectedSourceHash: sourceHash
		});

		const result = SkillIconResultV2Schema.parse(
			JSON.parse(await readFile(path.join(root, target.output.resultPath), 'utf8'))
		);
		expect(result.normalization).toMatchObject({
			profile: SKILL_ICON_NORMALIZATION_PROFILE_V3,
			outcome: 'completed',
			geometryHash: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH,
			providerSource: { contentHash: sourceHash },
			colorSpaceDisposition: 'assigned-srgb'
		});
	}, 15_000);

	it('persists the complete geometry-role-mask v5 provenance tuple', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-persist-geometry-mask-'));
		roots.push(root);
		const sourcePath = path.join(root, 'provider.png');
		await seedGuideV2(root);
		const source = await v2ProviderSource('skill-icon-geometry-role-mask-v1');
		await writeFile(sourcePath, source);
		const { target, assignment, candidatePath } = packetGeometryRoleMask();
		const sourceHash = createHash('sha256').update(source).digest('hex');
		const ihdrEnd = 8 + 12 + source.readUInt32BE(8);
		const cabxLength = source.readUInt32BE(ihdrEnd);
		const cabxData = source.subarray(ihdrEnd + 8, ihdrEnd + 8 + cabxLength);
		const decoderInput = declareSrgb(withoutPngChunk(source, 'caBX'));

		await persistSkillIconOutputBound({
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'backing',
			geometry: geometryV2,
			geometrySourceBytes: canonicalGeometryV2SourceBytes,
			target,
			assignment,
			receivedAt: '2026-09-02T09:10:11.000Z',
			expectedSourceHash: sourceHash
		});

		const retained = await readFile(path.join(root, candidatePath));
		const result = SkillIconResultV2Schema.parse(
			JSON.parse(await readFile(path.join(root, target.output.resultPath), 'utf8'))
		);
		expect(result.normalization).toEqual({
			profile: 'skill-icon-geometry-role-mask-v1',
			outcome: 'completed',
			geometryHash: createHash('sha256').update(canonicalGeometryV2SourceBytes).digest('hex'),
			providerSource: {
				mediaType: 'image/png',
				width: 1254,
				height: 1254,
				bytes: source.byteLength,
				alphaMode: 'rgb',
				contentHash: sourceHash
			},
			sourceContentHash: sourceHash,
			decoderInputContentHash: createHash('sha256').update(decoderInput).digest('hex'),
			containerBox: {
				chunkType: 'caBX',
				bytes: cabxData.byteLength,
				contentHash: createHash('sha256').update(cabxData).digest('hex')
			},
			colorSpaceDisposition: 'assigned-srgb',
			outputContentHash: createHash('sha256').update(retained).digest('hex')
		});
	}, 20_000);

	it('never replaces geometry-role-mask candidate or result paths', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-persist-geometry-collision-'));
		roots.push(root);
		const sourcePath = path.join(root, 'provider.png');
		await seedGuideV2(root);
		const source = await v2ProviderSource('skill-icon-geometry-role-mask-v1');
		await writeFile(sourcePath, source);
		const packet = packetGeometryRoleMask();
		const request = {
			root,
			sourcePath,
			candidatePath: packet.candidatePath,
			expectedRole: 'backing' as const,
			geometry: geometryV2,
			geometrySourceBytes: canonicalGeometryV2SourceBytes,
			target: packet.target,
			assignment: packet.assignment,
			receivedAt: '2026-09-02T09:10:11.000Z',
			expectedSourceHash: createHash('sha256').update(source).digest('hex')
		};
		await persistSkillIconOutputBound(request);
		const candidateBefore = await readFile(path.join(root, packet.candidatePath));
		const resultBefore = await readFile(path.join(root, packet.target.output.resultPath));

		await expect(persistSkillIconOutputBound(request)).rejects.toThrow(
			/already exists|collision/iu
		);
		expect(await readFile(path.join(root, packet.candidatePath))).toEqual(candidateBefore);
		expect(await readFile(path.join(root, packet.target.output.resultPath))).toEqual(resultBefore);
	}, 20_000);

	it('rejects changed guide-v2 authority for the geometry-role-mask profile', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-persist-geometry-guide-'));
		roots.push(root);
		const sourcePath = path.join(root, 'provider.png');
		await seedGuideV2(root);
		await writeFile(path.join(root, SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH), 'changed guide');
		const source = await v2ProviderSource('skill-icon-geometry-role-mask-v1');
		await writeFile(sourcePath, source);
		const packet = packetGeometryRoleMask();

		await expect(
			persistSkillIconOutputBound({
				root,
				sourcePath,
				candidatePath: packet.candidatePath,
				expectedRole: 'backing',
				geometry: geometryV2,
				geometrySourceBytes: canonicalGeometryV2SourceBytes,
				target: packet.target,
				assignment: packet.assignment,
				receivedAt: '2026-09-02T09:10:11.000Z',
				expectedSourceHash: createHash('sha256').update(source).digest('hex')
			})
		).rejects.toThrow(/geometry guide|reference hash changed/iu);
	}, 20_000);

	it('rejects profile-v3 cross-profile, legacy-geometry, and changed-guide authority mixes', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-persist-profile-v3-mix-'));
		roots.push(root);
		const sourcePath = path.join(root, 'provider.png');
		await seedGuideV2(root);
		const source = await v2ProviderSource(SKILL_ICON_NORMALIZATION_PROFILE_V3);
		await writeFile(sourcePath, source);
		const { target, assignment, candidatePath } = packetProfileV3();
		const common = {
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'backing' as const,
			geometry: geometryV2,
			geometrySourceBytes: canonicalGeometryV2SourceBytes,
			target,
			receivedAt: '2026-09-02T09:10:11.000Z',
			expectedSourceHash: createHash('sha256').update(source).digest('hex')
		};

		await expect(
			persistSkillIconOutputBound({
				...common,
				assignment: {
					...assignment,
					skillVersion: 'summonlab-skill-icon-production-v3',
					normalization: { profile: 'skill-icon-green-key-role-mask-v2' }
				}
			})
		).rejects.toThrow(/normalization profiles do not match|profile.*requires/iu);
		await expect(
			persistSkillIconOutputBound({
				...common,
				geometry: geometry,
				geometrySourceBytes: canonicalGeometrySourceBytes,
				assignment
			})
		).rejects.toThrow(/geometry|hash/iu);
		await writeFile(path.join(root, SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH), 'changed');
		await expect(persistSkillIconOutputBound({ ...common, assignment })).rejects.toThrow(
			/reference hash changed|guide/iu
		);
		await expect(access(path.join(root, candidatePath))).rejects.toMatchObject({ code: 'ENOENT' });
	}, 20_000);

	it('rejects cross-profile and profile skill-version mismatches before persistence', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-persist-profile-mismatch-'));
		roots.push(root);
		const sourcePath = path.join(root, 'provider.png');
		await seedReference(root);
		const source = await v2ProviderSource(SKILL_ICON_NORMALIZATION_PROFILE_V2);
		await writeFile(sourcePath, source);
		const geometrySourceBytes = canonicalGeometrySourceBytes;
		const { target, assignment, candidatePath } = packetProfileV2(geometrySourceBytes);
		const common = {
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'backing' as const,
			geometry,
			geometrySourceBytes,
			target,
			receivedAt: '2026-09-02T09:10:11.000Z',
			expectedSourceHash: createHash('sha256').update(source).digest('hex')
		};

		await expect(
			persistSkillIconOutputBound({
				...common,
				assignment: {
					...assignment,
					skillVersion: 'summonlab-skill-icon-production-v2',
					normalization: { profile: 'skill-icon-green-key-role-mask-v1' }
				}
			})
		).rejects.toThrow(/normalization profiles do not match/iu);
		await expect(
			persistSkillIconOutputBound({
				...common,
				assignment: {
					...assignment,
					skillVersion: 'summonlab-skill-icon-production-v2'
				} as SkillIconAssignmentV2
			})
		).rejects.toThrow(/production-v3|requires/iu);
		await expect(access(path.join(root, candidatePath))).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(access(path.join(root, target.output.resultPath))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	}, 15_000);

	it('rejects profile-v2 source mutation during the bound read', async () => {
		const root = await mkdtemp(
			path.join(os.tmpdir(), 'skill-icon-persist-profile-v2-source-race-')
		);
		roots.push(root);
		const sourcePath = path.join(root, 'provider.png');
		await seedReference(root);
		const source = await v2ProviderSource(SKILL_ICON_NORMALIZATION_PROFILE_V2);
		await writeFile(sourcePath, source);
		const geometrySourceBytes = canonicalGeometrySourceBytes;
		const { target, assignment, candidatePath } = packetProfileV2(geometrySourceBytes);
		const replacement = await v2ProviderSource(SKILL_ICON_NORMALIZATION_PROFILE_V2);
		replacement[replacement.length - 1] ^= 1;

		await expect(
			persistSkillIconOutputBound({
				root,
				sourcePath,
				candidatePath,
				expectedRole: 'backing',
				geometry,
				geometrySourceBytes,
				target,
				assignment,
				receivedAt: '2026-09-02T09:10:11.000Z',
				expectedSourceHash: createHash('sha256').update(source).digest('hex'),
				testHooks: { afterSourceRead: () => writeFile(sourcePath, replacement) }
			})
		).rejects.toThrow(/source changed while it was being read/iu);
		await expect(access(path.join(root, candidatePath))).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(access(path.join(root, target.output.resultPath))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	}, 15_000);

	it('rejects a profile-v2 provider source that does not match its authority hash', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-persist-profile-v2-tamper-'));
		roots.push(root);
		const sourcePath = path.join(root, 'provider.png');
		await seedReference(root);
		const source = await v2ProviderSource(SKILL_ICON_NORMALIZATION_PROFILE_V2);
		await writeFile(sourcePath, source);
		const geometrySourceBytes = canonicalGeometrySourceBytes;
		const { target, assignment, candidatePath } = packetProfileV2(geometrySourceBytes);

		await expect(
			persistSkillIconOutputBound({
				root,
				sourcePath,
				candidatePath,
				expectedRole: 'backing',
				geometry,
				geometrySourceBytes,
				target,
				assignment,
				receivedAt: '2026-09-02T09:10:11.000Z',
				expectedSourceHash: '1'.repeat(64)
			})
		).rejects.toThrow(/hash mismatch/iu);
		await expect(access(path.join(root, candidatePath))).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(access(path.join(root, target.output.resultPath))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	}, 15_000);

	it('uses one immutable V2 geometry snapshot when the caller mutates its buffer during source read', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-persist-v2-geometry-race-'));
		roots.push(root);
		const sourcePath = path.join(root, 'provider.png');
		await seedReference(root);
		const source = await v2ProviderSource();
		await writeFile(sourcePath, source);
		const mutableGeometryBytes = Buffer.from(canonicalGeometrySourceBytes);
		const { target, assignment, candidatePath } = packetV2(mutableGeometryBytes);
		const receipt = await persistSkillIconOutputBound({
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'backing',
			geometry,
			geometrySourceBytes: mutableGeometryBytes,
			target,
			assignment,
			receivedAt: '2026-09-02T09:10:11.000Z',
			expectedSourceHash: createHash('sha256').update(source).digest('hex'),
			testHooks: {
				afterSourceRead: () => {
					mutableGeometryBytes.fill(0);
				}
			}
		});
		expect(receipt.jobId).toBe(target.jobId);
		const result = SkillIconResultV2Schema.parse(
			JSON.parse(await readFile(path.join(root, target.output.resultPath), 'utf8'))
		);
		expect(result.normalization.geometryHash).toBe(SKILL_ICON_NORMALIZATION_GEOMETRY_HASH);
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
			if (failure === 'candidate-mutation') {
				await expect(readFile(candidate, 'utf8')).resolves.toBe('mutated');
				await expect(
					access(path.join(root, SKILL_ICON_PERSISTENCE_JOURNAL_PATH))
				).resolves.toBeUndefined();
			} else await expect(access(candidate)).rejects.toMatchObject({ code: 'ENOENT' });
			await expect(access(path.join(root, target.output.resultPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
			if (failure !== 'candidate-mutation') {
				for (const parent of [
					path.dirname(candidate),
					path.dirname(path.join(root, target.output.resultPath))
				])
					expect(
						(await readdir(parent)).filter((name) => name.includes('.skill-icon-tmp-'))
					).toEqual([]);
			}
		}
	});

	it('recovers a real SIGKILL after candidate publication and completes a clean retry', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		await crashPersistenceAt(
			{ root, sourcePath, target, assignment, candidatePath },
			'afterCandidateInstall'
		);
		await expect(access(path.join(root, candidatePath))).resolves.toBeUndefined();
		await expect(access(path.join(root, target.output.resultPath))).rejects.toMatchObject({
			code: 'ENOENT'
		});
		await expect(
			access(path.join(root, SKILL_ICON_PERSISTENCE_JOURNAL_PATH))
		).resolves.toBeUndefined();

		const receipt = await persistSkillIconOutputBound({
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'skill-art',
			geometry,
			target,
			assignment,
			receivedAt: '2026-09-02T09:10:11.000Z'
		});
		expect(receipt.jobId).toBe(target.jobId);
		for (const relativePath of [
			SKILL_ICON_PERSISTENCE_TOKEN_PATH,
			SKILL_ICON_PERSISTENCE_LOCK_PATH,
			SKILL_ICON_PERSISTENCE_JOURNAL_PATH
		])
			await expect(access(path.join(root, relativePath))).rejects.toMatchObject({ code: 'ENOENT' });
		for (const parent of [
			path.dirname(path.join(root, candidatePath)),
			path.dirname(path.join(root, target.output.resultPath))
		])
			expect((await readdir(parent)).filter((name) => name.includes('.skill-icon-tmp-'))).toEqual(
				[]
			);
	});

	it.each(['afterTokenInstall', 'afterLockInstall'] as const)(
		'recovers stale %s setup authority and completes the retry',
		async (boundary) => {
			const { root, sourcePath } = await workspace();
			const { target, assignment, candidatePath } = packet();
			await crashPersistenceAt({ root, sourcePath, target, assignment, candidatePath }, boundary);
			await expect(
				access(path.join(root, SKILL_ICON_PERSISTENCE_TOKEN_PATH))
			).resolves.toBeUndefined();
			await expect(
				access(path.join(root, SKILL_ICON_PERSISTENCE_JOURNAL_PATH))
			).rejects.toMatchObject({ code: 'ENOENT' });
			const receipt = await persistSkillIconOutputBound({
				root,
				sourcePath,
				candidatePath,
				expectedRole: 'skill-art',
				geometry,
				target,
				assignment,
				receivedAt: '2026-09-02T09:10:11.000Z'
			});
			expect(receipt.jobId).toBe(target.jobId);
		},
		15_000
	);

	it('preserves but ignores a partial token stage whose ownership cannot be authenticated', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		await crashPersistenceAt(
			{ root, sourcePath, target, assignment, candidatePath },
			'afterTokenStageOpen'
		);
		const authorityRoot = path.join(root, 'assets/wiki/skills/icon-production-v1');
		expect(
			(await readdir(authorityRoot)).some((name) =>
				name.startsWith('.persistence-recovery-token.json.skill-icon-tmp-authority-')
			)
		).toBe(true);
		const receipt = await persistSkillIconOutputBound({
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'skill-art',
			geometry,
			target,
			assignment,
			receivedAt: '2026-09-02T09:10:11.000Z'
		});
		expect(receipt.jobId).toBe(target.jobId);
		expect(
			(await readdir(authorityRoot)).some((name) =>
				name.startsWith('.persistence-recovery-token.json.skill-icon-tmp-authority-')
			)
		).toBe(true);
	}, 15_000);

	it('cleans a complete authenticated token stage left before atomic publication', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		await crashPersistenceAt(
			{ root, sourcePath, target, assignment, candidatePath },
			'afterTokenStageComplete'
		);
		const receipt = await persistSkillIconOutputBound({
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'skill-art',
			geometry,
			target,
			assignment,
			receivedAt: '2026-09-02T09:10:11.000Z'
		});
		expect(receipt.jobId).toBe(target.jobId);
		const authorityRoot = path.join(root, 'assets/wiki/skills/icon-production-v1');
		expect(
			(await readdir(authorityRoot)).filter((name) => name.includes('.skill-icon-tmp-authority-'))
		).toEqual([]);
	}, 15_000);

	it('never adopts identical-byte replacement stages without signed inode authority', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		await crashPersistenceAt(
			{ root, sourcePath, target, assignment, candidatePath },
			'afterOutputStagesComplete'
		);
		const stageIn = async (parent: string): Promise<string> => {
			const name = (await readdir(parent)).find((entry) => entry.includes('skill-icon-tmp-'));
			if (!name) throw new Error('Expected a pre-journal stage');
			return path.join(parent, name);
		};
		const [candidateStage, resultStage] = await Promise.all([
			stageIn(path.dirname(path.join(root, candidatePath))),
			stageIn(path.dirname(path.join(root, target.output.resultPath)))
		]);
		const replacementBytes = await readFile(candidateStage);
		const originalInode = (await lstat(candidateStage)).ino;
		const replacementPath = `${candidateStage}.replacement`;
		await writeFile(replacementPath, replacementBytes, { mode: 0o644 });
		await rename(replacementPath, candidateStage);
		const replacementInode = (await lstat(candidateStage)).ino;
		expect(replacementInode).not.toBe(originalInode);
		const receipt = await persistSkillIconOutputBound({
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'skill-art',
			geometry,
			target,
			assignment,
			receivedAt: '2026-09-02T09:10:11.000Z'
		});
		expect(receipt.jobId).toBe(target.jobId);
		await expect(readFile(candidateStage)).resolves.toEqual(replacementBytes);
		expect((await lstat(candidateStage)).ino).toBe(replacementInode);
		await expect(access(resultStage)).resolves.toBeUndefined();
	}, 15_000);

	it('leaves a malformed foreign orphan stage untouched while allowing persistence', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		const authorityRoot = path.join(root, 'assets/wiki/skills/icon-production-v1');
		const foreignStages = [
			path.join(
				authorityRoot,
				`.persistence-recovery-token.json.skill-icon-tmp-authority-${randomUUID()}-${process.pid}`
			),
			path.join(
				authorityRoot,
				`.persistence-recovery-token.json.skill-icon-tmp-authority-${'0'.repeat(36)}-${process.pid}`
			),
			path.join(
				authorityRoot,
				`.persistence-recovery-token.json.skill-icon-tmp-authority-${randomUUID()}-${'9'.repeat(30)}`
			)
		];
		await Promise.all(
			foreignStages.map((foreign) => writeFile(foreign, 'foreign malformed stage', { mode: 0o600 }))
		);
		const receipt = await persistSkillIconOutputBound({
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'skill-art',
			geometry,
			target,
			assignment,
			receivedAt: '2026-09-02T09:10:11.000Z'
		});
		expect(receipt.jobId).toBe(target.jobId);
		for (const foreign of foreignStages)
			await expect(readFile(foreign, 'utf8')).resolves.toBe('foreign malformed stage');
	}, 15_000);

	it('uses process epoch rather than a reused live PID for orphan-token recovery', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		const transactionId = randomUUID();
		const tokenStage = path.join(
			root,
			'assets/wiki/skills/icon-production-v1',
			`.persistence-recovery-token.json.skill-icon-tmp-authority-${transactionId}-${process.pid}`
		);
		const outputs = [
			{ kind: 'candidate', path: candidatePath, contentHash: '1'.repeat(64) },
			{ kind: 'result', path: target.output.resultPath, contentHash: '2'.repeat(64) }
		].map((output) => ({
			...output,
			stagedPath: `${path.dirname(output.path)}/.${path.basename(output.path)}.skill-icon-tmp-transaction-${transactionId}`
		}));
		await writeFile(
			tokenStage,
			`${JSON.stringify({
				schemaVersion: 'skill-icon-persistence-recovery-token-v1',
				transactionId,
				recoveryToken: randomUUID(),
				pid: process.pid,
				processIdentity: {
					bootId: (await readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim(),
					startTicks: '0'
				},
				createdAt: '2026-09-02T09:10:11.000Z',
				outputs
			})}\n`,
			{ mode: 0o600 }
		);
		const receipt = await persistSkillIconOutputBound({
			root,
			sourcePath,
			candidatePath,
			expectedRole: 'skill-art',
			geometry,
			target,
			assignment,
			receivedAt: '2026-09-02T09:10:11.000Z'
		});
		expect(receipt.jobId).toBe(target.jobId);
		await expect(access(tokenStage)).rejects.toMatchObject({ code: 'ENOENT' });
	}, 15_000);

	it('preserves committed outputs while recovering stale post-commit authority residue', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		await crashPersistenceAt(
			{ root, sourcePath, target, assignment, candidatePath },
			'afterJournalRemoval'
		);
		const candidateBefore = await readFile(path.join(root, candidatePath));
		const resultBefore = await readFile(path.join(root, target.output.resultPath));
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
		).rejects.toThrow(/already exists|collision/iu);
		expect(await readFile(path.join(root, candidatePath))).toEqual(candidateBefore);
		expect(await readFile(path.join(root, target.output.resultPath))).toEqual(resultBefore);
		for (const relativePath of [
			SKILL_ICON_PERSISTENCE_TOKEN_PATH,
			SKILL_ICON_PERSISTENCE_LOCK_PATH,
			SKILL_ICON_PERSISTENCE_JOURNAL_PATH
		])
			await expect(access(path.join(root, relativePath))).rejects.toMatchObject({ code: 'ENOENT' });
	}, 15_000);

	it('fails closed without deleting a foreign candidate raced into stale recovery', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		await crashPersistenceAt(
			{ root, sourcePath, target, assignment, candidatePath },
			'afterCandidateInstall'
		);
		const candidate = path.join(root, candidatePath);
		await rename(candidate, `${candidate}.owned-before-crash`);
		await writeFile(candidate, 'foreign recovery victim');
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
		).rejects.toThrow(/foreign candidate final path blocks persistence recovery/iu);
		await expect(readFile(candidate, 'utf8')).resolves.toBe('foreign recovery victim');
		await expect(
			access(path.join(root, SKILL_ICON_PERSISTENCE_JOURNAL_PATH))
		).resolves.toBeUndefined();
	});

	it('rejects a structurally valid but unauthenticated stale journal without mutation', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		await crashPersistenceAt(
			{ root, sourcePath, target, assignment, candidatePath },
			'afterCandidateInstall'
		);
		const journalPath = path.join(root, SKILL_ICON_PERSISTENCE_JOURNAL_PATH);
		const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { jobId: string };
		journal.jobId = 'tampered-job-v1';
		await writeFile(journalPath, `${JSON.stringify(journal, null, '\t')}\n`);
		const candidateBefore = await readFile(path.join(root, candidatePath));
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
		).rejects.toThrow(/authorization tag/iu);
		expect(await readFile(path.join(root, candidatePath))).toEqual(candidateBefore);
		await expect(access(journalPath)).resolves.toBeUndefined();
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

	it('snapshots the public request before its packet-authority await', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		await seedPackets(root, target, assignment);
		const expectedSourceHash = createHash('sha256')
			.update(await readFile(sourcePath))
			.digest('hex');
		const redirectedCandidatePath = candidatePath.replace('.png', '-redirected.png');
		const redirectedSourcePath = path.join(root, 'redirected-provider.png');
		await writeFile(redirectedSourcePath, Buffer.from('not the authorized source'));
		const options: Parameters<typeof persistSkillIconOutput>[0] = {
			sourcePath,
			candidatePath,
			expectedRole: 'skill-art',
			geometry,
			expectedSourceHash
		};
		const previous = process.cwd();
		try {
			process.chdir(root);
			const receipt = await persistSkillIconOutput(options, {
				now: () => new Date('2026-09-02T12:34:56.000Z'),
				testHooks: {
					afterAuthorityRead: () => {
						Object.assign(options, {
							sourcePath: redirectedSourcePath,
							candidatePath: redirectedCandidatePath,
							expectedRole: 'backing',
							geometry: { ...geometry, canvas: { width: 1, height: 1 } },
							expectedSourceHash: '1'.repeat(64)
						});
					}
				}
			});
			expect(receipt).toMatchObject({
				jobId: target.jobId,
				role: 'skill-art',
				source: { path: sourcePath },
				retained: { path: candidatePath }
			});
		} finally {
			process.chdir(previous);
		}
		await expect(access(path.join(root, candidatePath))).resolves.toBeUndefined();
		await expect(access(path.join(root, redirectedCandidatePath))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});

	it('does not let the public authority-read hook heal an unauthorized source hash', async () => {
		const { root, sourcePath } = await workspace();
		const { target, assignment, candidatePath } = packet();
		await seedPackets(root, target, assignment);
		const actualHash = createHash('sha256')
			.update(await readFile(sourcePath))
			.digest('hex');
		const options: Parameters<typeof persistSkillIconOutput>[0] = {
			sourcePath,
			candidatePath,
			expectedRole: 'skill-art',
			geometry,
			expectedSourceHash: '1'.repeat(64)
		};
		const previous = process.cwd();
		try {
			process.chdir(root);
			await expect(
				persistSkillIconOutput(options, {
					testHooks: {
						afterAuthorityRead: () => {
							Object.assign(options, { expectedSourceHash: actualHash });
						}
					}
				})
			).rejects.toThrow(/hash mismatch/iu);
		} finally {
			process.chdir(previous);
		}
		await expect(access(path.join(root, candidatePath))).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(access(path.join(root, target.output.resultPath))).rejects.toMatchObject({
			code: 'ENOENT'
		});
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
			const { assignment, candidatePath } = packet();
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

	function supersessionPackets() {
		const retired = packetV2(canonicalGeometrySourceBytes);
		const supersedingJobId = 'charcoal-forged-stone-v3';
		const supersedingCandidatePath = `assets/wiki/skills/icon-production-v1/candidates/references/${supersedingJobId}.png`;
		const supersedingResultPath = `assets/wiki/skills/icon-production-v1/results/references/${supersedingJobId}.json`;
		const supersedingTarget: SkillIconTargetV2 = {
			...retired.target,
			jobId: supersedingJobId,
			revision: 3,
			output: {
				candidatePath: supersedingCandidatePath,
				resultPath: supersedingResultPath
			}
		};
		const supersedingAssignment: SkillIconAssignmentV2 = {
			...retired.assignment,
			assignmentId: `assignment-${supersedingJobId}`,
			jobId: supersedingJobId,
			revision: 3,
			targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${supersedingJobId}.json`,
			assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${supersedingJobId}.json`,
			permittedOutputs: {
				candidatePath: supersedingCandidatePath,
				resultPath: supersedingResultPath
			}
		};
		return { retired, supersedingTarget, supersedingAssignment };
	}

	async function supersessionWorkspace() {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-supersede-'));
		roots.push(root);
		await seedReference(root);
		const packets = supersessionPackets();
		await seedPackets(root, packets.retired.target, packets.retired.assignment);
		await seedPackets(root, packets.supersedingTarget, packets.supersedingAssignment);
		return { root, ...packets };
	}

	function supersedeOptions(input: Awaited<ReturnType<typeof supersessionWorkspace>>) {
		return {
			root: input.root,
			targetPath: input.retired.assignment.targetPath,
			assignmentPath: input.retired.assignment.assignmentPath,
			supersedingTargetPath: input.supersedingAssignment.targetPath,
			supersedingAssignmentPath: input.supersedingAssignment.assignmentPath,
			reason: 'unattempted-packet-superseded-by-higher-revision' as const,
			completedAt: '2026-09-02T13:00:00.000Z'
		};
	}

	async function crashSupersessionAt(
		input: Awaited<ReturnType<typeof supersessionWorkspace>>,
		boundary:
			| 'afterTokenInstall'
			| 'afterLockInstall'
			| 'afterIntentInstall'
			| 'afterOutputStageComplete'
			| 'afterJournalInstall'
			| 'afterResultInstall'
			| 'afterJournalRemoval'
			| 'afterIntentRemoval'
	): Promise<void> {
		const payloadPath = path.join(input.root, 'supersede-crash-payload.json');
		await writeFile(payloadPath, JSON.stringify(supersedeOptions(input)));
		const moduleUrl = new URL('./persist-skill-icon-output.ts', import.meta.url).href;
		const program = `
			import { readFile } from 'node:fs/promises';
			const { persistSkillIconSupersededResult } = await import(${JSON.stringify(moduleUrl)});
			const payload = JSON.parse(await readFile(${JSON.stringify(payloadPath)}, 'utf8'));
			await persistSkillIconSupersededResult({
				...payload,
				testHooks: { [${JSON.stringify(boundary)}]: () => process.kill(process.pid, 'SIGKILL') }
			});
		`;
		await expect(
			execFileAsync(
				process.execPath,
				['--import', 'tsx', '--input-type=module', '--eval', program],
				{
					cwd: process.cwd()
				}
			)
		).rejects.toMatchObject({ signal: 'SIGKILL' });
	}

	it('coordinator supersedes only an output-free older packet and writes one result', async () => {
		const input = await supersessionWorkspace();
		const before = await Promise.all(
			[
				input.retired.assignment.targetPath,
				input.retired.assignment.assignmentPath,
				input.supersedingAssignment.targetPath,
				input.supersedingAssignment.assignmentPath
			].map((relativePath) => readFile(path.join(input.root, relativePath)))
		);
		const result = await persistSkillIconSupersededResult(supersedeOptions(input));
		expect(result).toMatchObject({
			status: 'superseded',
			attemptCount: 0,
			supersessionReason: 'unattempted-packet-superseded-by-higher-revision',
			output: null,
			normalization: {
				outcome: 'not-run',
				providerSource: null,
				sourceContentHash: null,
				outputContentHash: null
			},
			findings: [],
			totalWallTimeMs: 0,
			writtenOutputPaths: [input.retired.target.output.resultPath],
			supersedingAuthority: {
				jobId: input.supersedingTarget.jobId,
				logicalIdentity: input.supersedingTarget.logicalIdentity,
				revision: 3,
				role: 'backing'
			}
		});
		await expect(
			access(path.join(input.root, input.retired.target.output.candidatePath))
		).rejects.toMatchObject({ code: 'ENOENT' });
		expect(
			JSON.parse(
				await readFile(path.join(input.root, input.retired.target.output.resultPath), 'utf8')
			)
		).toEqual(result);
		const after = await Promise.all(
			[
				input.retired.assignment.targetPath,
				input.retired.assignment.assignmentPath,
				input.supersedingAssignment.targetPath,
				input.supersedingAssignment.assignmentPath
			].map((relativePath) => readFile(path.join(input.root, relativePath)))
		);
		expect(after).toEqual(before);
		for (const authorityPath of [
			SKILL_ICON_PERSISTENCE_TOKEN_PATH,
			SKILL_ICON_PERSISTENCE_LOCK_PATH,
			SKILL_ICON_PERSISTENCE_JOURNAL_PATH,
			skillIconSupersessionIntentPath(input.retired.target.output.resultPath)
		]) {
			await expect(access(path.join(input.root, authorityPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		}
	});

	it('publishes a mode-0600 intent bound to the recovery token and result', async () => {
		const input = await supersessionWorkspace();
		const intentPath = path.join(
			input.root,
			skillIconSupersessionIntentPath(input.retired.target.output.resultPath)
		);
		await persistSkillIconSupersededResult({
			...supersedeOptions(input),
			testHooks: {
				afterIntentInstall: async () => {
					const [intentBytes, tokenBytes, metadata] = await Promise.all([
						readFile(intentPath),
						readFile(path.join(input.root, SKILL_ICON_PERSISTENCE_TOKEN_PATH)),
						lstat(intentPath)
					]);
					const intent = SkillIconSupersessionIntentSchema.parse(
						JSON.parse(intentBytes.toString('utf8'))
					);
					const token = JSON.parse(tokenBytes.toString('utf8')) as { recoveryToken: string };
					expect(intent).toMatchObject({
						resultPath: input.retired.target.output.resultPath,
						pid: process.pid,
						recoveryTokenHash: createHash('sha256')
							.update(Buffer.from(token.recoveryToken))
							.digest('hex')
					});
					expect(metadata.mode & 0o777).toBe(0o600);
				}
			}
		});
		await expect(access(intentPath)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it.each(['candidate', 'result'] as const)(
		'refuses to supersede a packet that already owns %s output',
		async (kind) => {
			const input = await supersessionWorkspace();
			const outputPath =
				kind === 'candidate'
					? input.retired.target.output.candidatePath
					: input.retired.target.output.resultPath;
			await mkdir(path.dirname(path.join(input.root, outputPath)), { recursive: true });
			await writeFile(path.join(input.root, outputPath), 'existing output');
			await expect(persistSkillIconSupersededResult(supersedeOptions(input))).rejects.toThrow(
				/output-free|already exists|already has candidate/iu
			);
			await expect(readFile(path.join(input.root, outputPath), 'utf8')).resolves.toBe(
				'existing output'
			);
		}
	);

	it.each(['owner', 'stage'] as const)(
		'rejects a live Python failed-result %s and cleans every owned JS authority',
		async (kind) => {
			const input = await supersessionWorkspace();
			const resultPath = input.retired.target.output.resultPath;
			const artifactPath = `${path.dirname(resultPath)}/.${path.basename(resultPath)}.${
				kind === 'owner' ? 'failed-result-owner.json' : 'failed-result-stage'
			}`;
			await mkdir(path.dirname(path.join(input.root, artifactPath)), { recursive: true });
			await writeFile(path.join(input.root, artifactPath), `python-${kind}`);

			await expect(persistSkillIconSupersededResult(supersedeOptions(input))).rejects.toThrow(
				/Python failed-result transaction blocks supersession/iu
			);
			await expect(readFile(path.join(input.root, artifactPath), 'utf8')).resolves.toBe(
				`python-${kind}`
			);
			for (const authorityPath of [
				SKILL_ICON_PERSISTENCE_TOKEN_PATH,
				SKILL_ICON_PERSISTENCE_LOCK_PATH,
				SKILL_ICON_PERSISTENCE_JOURNAL_PATH,
				skillIconSupersessionIntentPath(resultPath)
			]) {
				await expect(access(path.join(input.root, authorityPath))).rejects.toMatchObject({
					code: 'ENOENT'
				});
			}
		}
	);

	it.each([
		[
			'same revision',
			(input: Awaited<ReturnType<typeof supersessionWorkspace>>) => {
				input.supersedingTarget.revision = 2;
				input.supersedingTarget.jobId = input.retired.target.jobId;
			}
		],
		[
			'different identity',
			(input: Awaited<ReturnType<typeof supersessionWorkspace>>) => {
				input.supersedingTarget.logicalIdentity = 'different-backing';
			}
		],
		[
			'different role',
			(input: Awaited<ReturnType<typeof supersessionWorkspace>>) => {
				Object.assign(
					input.supersedingTarget as unknown as {
						role: 'rarity-frame';
						rarity: 'F';
					},
					{ role: 'rarity-frame', rarity: 'F' }
				);
			}
		]
	] as const)('rejects superseding authority with %s', async (_label, mutate) => {
		const input = await supersessionWorkspace();
		mutate(input);
		await writeFile(
			path.join(input.root, input.supersedingAssignment.targetPath),
			JSON.stringify(input.supersedingTarget)
		);
		await expect(persistSkillIconSupersededResult(supersedeOptions(input))).rejects.toThrow();
		await expect(
			access(path.join(input.root, input.retired.target.output.resultPath))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it.each(['target', 'assignment', 'superseding-target', 'superseding-assignment'] as const)(
		'rolls back result-only persistence when %s authority changes after its read',
		async (authority) => {
			const input = await supersessionWorkspace();
			const relativePath =
				authority === 'target'
					? input.retired.assignment.targetPath
					: authority === 'assignment'
						? input.retired.assignment.assignmentPath
						: authority === 'superseding-target'
							? input.supersedingAssignment.targetPath
							: input.supersedingAssignment.assignmentPath;
			await expect(
				persistSkillIconSupersededResult({
					...supersedeOptions(input),
					testHooks: {
						afterAuthorityRead: () =>
							writeFile(path.join(input.root, relativePath), Buffer.from('changed authority'))
					}
				})
			).rejects.toThrow(/changed/iu);
			await expect(
				access(path.join(input.root, input.retired.target.output.resultPath))
			).rejects.toMatchObject({ code: 'ENOENT' });
		}
	);

	it('serializes concurrent coordinator writers without overwriting the winner', async () => {
		const input = await supersessionWorkspace();
		const attempts = await Promise.allSettled([
			persistSkillIconSupersededResult(supersedeOptions(input)),
			persistSkillIconSupersededResult(supersedeOptions(input))
		]);
		expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
		expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
		expect(
			JSON.parse(
				await readFile(path.join(input.root, input.retired.target.output.resultPath), 'utf8')
			)
		).toMatchObject({ status: 'superseded', attemptCount: 0 });
	});

	it('never deletes a foreign same-byte result replacement during result-only rollback', async () => {
		const input = await supersessionWorkspace();
		const resultPath = path.join(input.root, input.retired.target.output.resultPath);
		let foreignBytes = Buffer.alloc(0);
		await expect(
			persistSkillIconSupersededResult({
				...supersedeOptions(input),
				testHooks: {
					afterResultInstall: async () => {
						foreignBytes = await readFile(resultPath);
						await rm(resultPath);
						await writeFile(resultPath, foreignBytes);
						throw new Error('force rollback after foreign replacement');
					}
				}
			})
		).rejects.toThrow(/rollback was incomplete/iu);
		await expect(readFile(resultPath)).resolves.toEqual(foreignBytes);
		await expect(access(path.join(input.root, SKILL_ICON_PERSISTENCE_JOURNAL_PATH))).resolves.toBe(
			undefined
		);
		await expect(persistSkillIconSupersededResult(supersedeOptions(input))).rejects.toThrow(
			/live coordinator|foreign result final path blocks persistence recovery/iu
		);
		await expect(readFile(resultPath)).resolves.toEqual(foreignBytes);
	});

	it('rolls back the result while preserving a candidate that appears during supersession', async () => {
		const input = await supersessionWorkspace();
		const candidatePath = path.join(input.root, input.retired.target.output.candidatePath);
		await expect(
			persistSkillIconSupersededResult({
				...supersedeOptions(input),
				testHooks: {
					afterJournalInstall: async () => {
						await mkdir(path.dirname(candidatePath), { recursive: true });
						await writeFile(candidatePath, Buffer.from('foreign candidate'));
					}
				}
			})
		).rejects.toThrow(/candidate appeared/iu);
		await expect(readFile(candidatePath, 'utf8')).resolves.toBe('foreign candidate');
		await expect(
			access(path.join(input.root, input.retired.target.output.resultPath))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it.each([
		['afterJournalInstall', 'delete'],
		['afterJournalInstall', 'replace'],
		['afterResultInstall', 'delete'],
		['afterResultInstall', 'replace']
	] as const)('fails closed when the intent is %s at %s', async (boundary, mutation) => {
		const input = await supersessionWorkspace();
		const intentPath = path.join(
			input.root,
			skillIconSupersessionIntentPath(input.retired.target.output.resultPath)
		);
		let replacement = Buffer.alloc(0);
		await expect(
			persistSkillIconSupersededResult({
				...supersedeOptions(input),
				testHooks: {
					[boundary]: async () => {
						replacement = await readFile(intentPath);
						await rm(intentPath);
						if (mutation === 'replace') await writeFile(intentPath, replacement);
					}
				}
			})
		).rejects.toThrow(/rollback was incomplete/iu);
		await expect(
			access(path.join(input.root, input.retired.target.output.resultPath))
		).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(
			access(path.join(input.root, SKILL_ICON_PERSISTENCE_JOURNAL_PATH))
		).resolves.toBeUndefined();
		if (mutation === 'replace') await expect(readFile(intentPath)).resolves.toEqual(replacement);
		else await expect(access(intentPath)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it.each([
		'afterTokenInstall',
		'afterLockInstall',
		'afterIntentInstall',
		'afterOutputStageComplete',
		'afterJournalInstall',
		'afterResultInstall'
	] as const)(
		'recovers a killed result-only transaction at %s and commits one clean retry',
		async (boundary) => {
			const input = await supersessionWorkspace();
			await crashSupersessionAt(input, boundary);
			const result = await persistSkillIconSupersededResult(supersedeOptions(input));
			expect(result.status).toBe('superseded');
			await expect(
				access(path.join(input.root, input.retired.target.output.candidatePath))
			).rejects.toMatchObject({ code: 'ENOENT' });
			for (const authorityPath of [
				SKILL_ICON_PERSISTENCE_TOKEN_PATH,
				SKILL_ICON_PERSISTENCE_LOCK_PATH,
				SKILL_ICON_PERSISTENCE_JOURNAL_PATH,
				skillIconSupersessionIntentPath(input.retired.target.output.resultPath)
			]) {
				await expect(access(path.join(input.root, authorityPath))).rejects.toMatchObject({
					code: 'ENOENT'
				});
			}
		}
	);

	it.each(['afterJournalRemoval', 'afterIntentRemoval'] as const)(
		'treats journal removal as the result-only commit point across %s death',
		async (boundary) => {
			const input = await supersessionWorkspace();
			await crashSupersessionAt(input, boundary);
			const resultPath = path.join(input.root, input.retired.target.output.resultPath);
			expect(JSON.parse(await readFile(resultPath, 'utf8'))).toMatchObject({
				status: 'superseded',
				attemptCount: 0
			});
			await expect(persistSkillIconSupersededResult(supersedeOptions(input))).rejects.toThrow(
				/output-free/iu
			);
			for (const authorityPath of [
				SKILL_ICON_PERSISTENCE_TOKEN_PATH,
				SKILL_ICON_PERSISTENCE_LOCK_PATH,
				SKILL_ICON_PERSISTENCE_JOURNAL_PATH,
				skillIconSupersessionIntentPath(input.retired.target.output.resultPath)
			]) {
				await expect(access(path.join(input.root, authorityPath))).rejects.toMatchObject({
					code: 'ENOENT'
				});
			}
		}
	);

	it('keeps producer and coordinator CLI authority separate with an exact reason', () => {
		const input = supersessionPackets();
		const args = [
			'--target',
			input.retired.assignment.targetPath,
			'--assignment',
			input.retired.assignment.assignmentPath,
			'--superseding-target',
			input.supersedingAssignment.targetPath,
			'--superseding-assignment',
			input.supersedingAssignment.assignmentPath,
			'--reason',
			'unattempted-packet-superseded-by-higher-revision'
		];
		expect(parseSupersedeSkillIconCliRequest(args)).toMatchObject({
			reason: 'unattempted-packet-superseded-by-higher-revision'
		});
		expect(() =>
			parseSupersedeSkillIconCliRequest([...args.slice(0, -1), 'producer-decided-to-skip'])
		).toThrow(/reason/iu);
		expect(() => parsePersistSkillIconCliRequest(args)).toThrow(/unknown/iu);
	});
});
