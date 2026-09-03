import { createHash, createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
	access,
	cp,
	copyFile,
	mkdir,
	mkdtemp,
	lstat,
	open,
	readFile,
	readdir,
	realpath,
	rename,
	rm,
	symlink,
	unlink,
	writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import { CANONICAL_SKILL_SOURCE_PATHS } from './skill-icon-production-lib.js';
import { exportSkillIconRuntime } from './compose-skill-icon-assets.js';
import {
	SKILL_ICON_MOTIF_SOURCE_PATH,
	SKILL_ICON_VISUAL_SPECS_PATH,
	exportSkillIconProduction
} from './export-skill-icon-production.js';
import {
	SKILL_ICON_PROMOTION_JOURNAL_PATH,
	SKILL_ICON_PROMOTION_LOCK_PATH,
	SKILL_ICON_PROMOTION_RECEIPT_ROOT,
	SKILL_ICON_PROMOTION_TOKEN_PATH,
	parsePromotionCliRequest,
	promoteReviewedSkillIconOutputs,
	promoteSkillIconOutput,
	recoverSkillIconPromotion,
	runSkillIconPromotionCli,
	type SkillIconDerivativeResolver
} from './promote-skill-icon-output.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true }))));

const aperturePoints = [
	[512, 80],
	[904, 304],
	[904, 720],
	[512, 944],
	[120, 720],
	[120, 304]
] as const;

function signJournalForTest(journal: Record<string, unknown>, token: string) {
	const unsigned = { ...journal, authorizationTag: '0'.repeat(64) };
	const payload = Object.fromEntries(
		Object.entries(unsigned).filter(([key]) => key !== 'authorizationTag')
	);
	return {
		...unsigned,
		authorizationTag: createHmac('sha256', token).update(JSON.stringify(payload)).digest('hex')
	};
}

function inAperture(x: number, y: number): boolean {
	let inside = false;
	for (
		let index = 0, previous = aperturePoints.length - 1;
		index < aperturePoints.length;
		previous = index++
	) {
		const [xi, yi] = aperturePoints[index]!;
		const [xj, yj] = aperturePoints[previous]!;
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

async function backingPng(): Promise<Buffer> {
	const pixels = Buffer.alloc(1024 * 1024 * 4);
	for (let y = 0; y < 1024; y += 1) {
		for (let x = 0; x < 1024; x += 1) {
			const offset = (y * 1024 + x) * 4;
			pixels[offset] = 51;
			pixels[offset + 1] = 51;
			pixels[offset + 2] = 51;
			pixels[offset + 3] = inAperture(x + 0.5, y + 0.5) ? 255 : 0;
		}
	}
	return sharp(pixels, { raw: { width: 1024, height: 1024, channels: 4 } })
		.png()
		.toBuffer();
}

async function framePng(): Promise<Buffer> {
	const inner = aperturePoints.map(
		([x, y]) => [512 + (x - 512) * 0.86, 512 + (y - 512) * 0.86] as const
	);
	const pixels = Buffer.alloc(1024 * 1024 * 4);
	for (let y = 0; y < 1024; y += 1) {
		for (let x = 0; x < 1024; x += 1) {
			const offset = (y * 1024 + x) * 4;
			pixels[offset + 2] = 200;
			pixels[offset + 3] =
				inAperture(x + 0.5, y + 0.5) &&
				!(() => {
					let inside = false;
					for (
						let index = 0, previous = inner.length - 1;
						index < inner.length;
						previous = index++
					) {
						const [xi, yi] = inner[index]!;
						const [xj, yj] = inner[previous]!;
						if (
							yi > y + 0.5 !== yj > y + 0.5 &&
							x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi
						)
							inside = !inside;
					}
					return inside;
				})()
					? 255
					: 0;
		}
	}
	return sharp(pixels, { raw: { width: 1024, height: 1024, channels: 4 } })
		.png()
		.toBuffer();
}

async function installApprovedReferenceEvidence(
	root: string,
	role: 'backing' | 'rarity-frame',
	bytes: Buffer,
	rarity: 'F' | null
): Promise<void> {
	const jobId =
		role === 'backing' ? 'charcoal-forged-stone-v1' : `rarity-frame-${rarity!.toLowerCase()}-v1`;
	const candidatePath = `assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`;
	const resultPath = `assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`;
	const targetPath = `assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`;
	const assignmentPath = `assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`;
	const reviewPath = `assets/wiki/skills/icon-production-v1/review/decisions/references/${jobId}.json`;
	const masterPath =
		role === 'backing'
			? 'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
			: `assets/wiki/skills/icon-production-v1/masters/frames/${rarity!.toLowerCase()}.png`;
	const contentHash = createHash('sha256').update(bytes).digest('hex');
	const exactPrompt =
		role === 'backing' ? 'Paint the canonical backing.' : `Paint rarity ${rarity}.`;
	const referenceBytes = Buffer.from('reference authority');
	const target = {
		schemaVersion: 'skill-icon-target-v1',
		jobId,
		role,
		skillTargetId: null,
		motifFamily: null,
		rarity,
		exactPrompt,
		references: [
			{
				path: 'assets/wiki/skills/icon-production-v1/references/geometry-guide.png',
				purpose: 'Geometry.',
				contentHash: createHash('sha256').update(referenceBytes).digest('hex')
			}
		],
		canvas: { width: 1024, height: 1024, mediaType: 'image/png' },
		output: { candidatePath, resultPath }
	};
	const assignment = {
		schemaVersion: 'skill-icon-assignment-v1',
		assignmentId: `assignment-${jobId}`,
		jobId,
		targetPath,
		assignmentPath,
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
	const findings = [
		{ category: 'geometry', evaluator: 'automated', outcome: 'pass', observation: 'Valid.' },
		{
			category: 'manifest-fidelity',
			evaluator: 'producer',
			outcome: 'pass',
			observation: 'Matched.'
		}
	];
	const result = {
		schemaVersion: 'skill-icon-result-v1',
		resultId: `result-${jobId}`,
		jobId,
		assignmentId: assignment.assignmentId,
		status: 'candidate',
		exactPrompt,
		promptHash: createHash('sha256').update(exactPrompt).digest('hex'),
		referenceInputs: target.references.map(({ path, contentHash }) => ({ path, contentHash })),
		output: {
			path: candidatePath,
			mediaType: 'image/png',
			width: 1024,
			height: 1024,
			bytes: bytes.byteLength,
			alphaMode: 'rgba',
			contentHash
		},
		resultPath,
		findings,
		startedAt: '2026-09-02T08:01:00.000Z',
		completedAt: '2026-09-02T08:02:00.000Z',
		totalWallTimeMs: 60000,
		writtenOutputPaths: [candidatePath, resultPath],
		noSharedFilesEdited: true,
		selfPromoted: false
	};
	const resultBytes = Buffer.from(JSON.stringify(result));
	const review = {
		schemaVersion: 'skill-icon-review-v1',
		reviewId: `review-${jobId}`,
		jobId,
		role,
		skillTargetId: null,
		candidatePath,
		candidateHash: contentHash,
		reviewer: 'Skills visual owner',
		reviewerRole: 'owner',
		decision: 'accepted',
		rationale: 'Accepted authority.',
		findings: [{ criterion: 'geometry', outcome: 'pass', observation: 'Valid.' }],
		reviewedAt: '2026-09-02T10:00:00.000Z'
	};
	const reviewBytes = Buffer.from(JSON.stringify(review));
	const receiptPath = `${SKILL_ICON_PROMOTION_RECEIPT_ROOT}/${jobId}.json`;
	const receipt = {
		schemaVersion: 'skill-icon-promotion-receipt-v1',
		transactionId: '11111111-1111-4111-8111-111111111111',
		jobId,
		role,
		ownerReviewer: review.reviewer,
		review: {
			path: reviewPath,
			contentHash: createHash('sha256').update(reviewBytes).digest('hex')
		},
		result: {
			path: resultPath,
			contentHash: createHash('sha256').update(resultBytes).digest('hex')
		},
		candidate: { path: candidatePath, contentHash },
		master: { path: masterPath, contentHash }
	};
	for (const [relativePath, value] of [
		[candidatePath, bytes],
		[masterPath, bytes],
		[targetPath, JSON.stringify(target)],
		[assignmentPath, JSON.stringify(assignment)],
		[resultPath, resultBytes],
		[reviewPath, reviewBytes],
		[receiptPath, JSON.stringify(receipt)]
	] as const) {
		await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
		await writeFile(path.join(root, relativePath), value);
	}
}

async function fixture(
	jobId: string,
	decision: 'accepted' | 'rejected' = 'accepted',
	role: 'backing' | 'calibration-plate' = 'backing'
) {
	const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-promote-'));
	roots.push(root);
	const scope = role === 'calibration-plate' ? 'calibration' : 'references';
	const candidatePath = `assets/wiki/skills/icon-production-v1/candidates/${scope}/${jobId}.png`;
	const resultPath = `assets/wiki/skills/icon-production-v1/results/${scope}/${jobId}.json`;
	const targetPath = `assets/wiki/skills/icon-production-v1/targets/${scope}/${jobId}.json`;
	const assignmentPath = `assets/wiki/skills/icon-production-v1/assignments/${scope}/${jobId}.json`;
	const reviewPath = `assets/wiki/skills/icon-production-v1/review/decisions/${scope}/${jobId}.json`;
	const bytes = await backingPng();
	const hash = createHash('sha256').update(bytes).digest('hex');
	const target = {
		schemaVersion: 'skill-icon-target-v1',
		jobId,
		role,
		skillTargetId: null,
		motifFamily: role === 'calibration-plate' ? 'blade.sweeping-cut' : null,
		rarity: null,
		exactPrompt: 'Paint charcoal forged stone backing.',
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
	const assignment = {
		schemaVersion: 'skill-icon-assignment-v1',
		assignmentId: `assignment-${jobId}`,
		jobId,
		targetPath,
		assignmentPath,
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
	const finding = {
		category: 'geometry',
		evaluator: 'automated',
		outcome: 'pass',
		observation: 'Geometry passes.'
	};
	const producer = {
		category: 'manifest-fidelity',
		evaluator: 'producer',
		outcome: 'pass',
		observation: 'Prompt matched.'
	};
	const result = {
		schemaVersion: 'skill-icon-result-v1',
		resultId: `result-${jobId}`,
		jobId,
		assignmentId: assignment.assignmentId,
		status: 'candidate',
		exactPrompt: target.exactPrompt,
		promptHash: createHash('sha256').update(target.exactPrompt).digest('hex'),
		referenceInputs: target.references.map(({ path, contentHash }) => ({ path, contentHash })),
		output: {
			path: candidatePath,
			mediaType: 'image/png',
			width: 1024,
			height: 1024,
			bytes: bytes.byteLength,
			alphaMode: 'rgba',
			contentHash: hash
		},
		resultPath,
		findings: [finding, producer],
		startedAt: '2026-09-02T08:01:00.000Z',
		completedAt: '2026-09-02T08:02:00.000Z',
		totalWallTimeMs: 60000,
		writtenOutputPaths: [candidatePath, resultPath],
		noSharedFilesEdited: true,
		selfPromoted: false
	};
	const review = {
		schemaVersion: 'skill-icon-review-v1',
		reviewId: `review-${jobId}`,
		jobId,
		role,
		skillTargetId: null,
		candidatePath,
		candidateHash: hash,
		reviewer: 'Skills visual owner',
		reviewerRole: 'owner',
		decision,
		rationale: 'The backing is clear and usable.',
		findings: [{ criterion: 'geometry', outcome: 'pass', observation: 'Aperture fits.' }],
		reviewedAt: '2026-09-02T10:00:00.000Z'
	};
	const geometryPath = 'assets/wiki/skills/icon-production-v1/geometry.json';
	const geometry = {
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
	for (const [relativePath, value] of [
		[candidatePath, bytes],
		[targetPath, JSON.stringify(target)],
		[assignmentPath, JSON.stringify(assignment)],
		[resultPath, JSON.stringify(result)],
		[reviewPath, JSON.stringify(review)],
		[geometryPath, JSON.stringify(geometry)]
	] as const) {
		await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
		await writeFile(path.join(root, relativePath), value);
	}
	return { root, reviewPath, candidatePath, resultPath, hash };
}

async function installBackingV2Packet(
	root: string,
	mode: 'target-only' | 'candidate' | 'failed'
): Promise<{
	readonly jobId: string;
	readonly candidatePath: string;
	readonly resultPath: string;
}> {
	const jobId = 'charcoal-forged-stone-v2';
	const logicalIdentity = 'charcoal-forged-stone';
	const candidatePath = `assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`;
	const resultPath = `assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`;
	const targetPath = `assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`;
	const assignmentPath = `assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`;
	const exactPrompt =
		'Paint charcoal forged stone over an opaque #00FF00 matte with no baked checkerboard.';
	const geometryPath = path.join(root, 'assets/wiki/skills/icon-production-v1/geometry.json');
	const geometryBytes = await readFile(
		path.resolve('assets/wiki/skills/icon-production-v1/geometry.json')
	);
	await writeFile(geometryPath, geometryBytes);
	const geometryHash = createHash('sha256').update(geometryBytes).digest('hex');
	const target = {
		schemaVersion: 'skill-icon-target-v2',
		jobId,
		logicalIdentity,
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
				contentHash: geometryHash
			}
		}
	};
	const assignment = {
		schemaVersion: 'skill-icon-assignment-v2',
		assignmentId: `assignment-${jobId}`,
		jobId,
		logicalIdentity,
		revision: 2,
		targetPath,
		assignmentPath,
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
	await mkdir(path.dirname(path.join(root, targetPath)), { recursive: true });
	await writeFile(path.join(root, targetPath), JSON.stringify(target));
	if (mode === 'target-only') return { jobId, candidatePath, resultPath };
	const sourceHash = 'b'.repeat(64);
	const candidateBytes =
		mode === 'candidate' ? await readFile(path.join(root, candidatePath)) : null;
	const outputHash = candidateBytes
		? createHash('sha256').update(candidateBytes).digest('hex')
		: null;
	const result = {
		schemaVersion: 'skill-icon-result-v2',
		resultId: `result-${jobId}`,
		jobId,
		logicalIdentity,
		revision: 2,
		assignmentId: assignment.assignmentId,
		status: mode,
		exactPrompt,
		promptHash: createHash('sha256').update(exactPrompt).digest('hex'),
		referenceInputs: target.references.map(({ path: referencePath, contentHash }) => ({
			path: referencePath,
			contentHash
		})),
		normalization:
			mode === 'candidate'
				? {
						profile: 'skill-icon-green-key-role-mask-v1',
						outcome: 'completed',
						geometryHash,
						providerSource: {
							mediaType: 'image/png',
							width: 1254,
							height: 1254,
							bytes: 2_000_000,
							alphaMode: 'rgb',
							contentHash: sourceHash
						},
						sourceContentHash: sourceHash,
						outputContentHash: outputHash
					}
				: {
						profile: 'skill-icon-green-key-role-mask-v1',
						outcome: 'not-run',
						geometryHash,
						providerSource: null,
						sourceContentHash: null,
						outputContentHash: null
					},
		output:
			mode === 'candidate'
				? {
						path: candidatePath,
						mediaType: 'image/png',
						width: 1024,
						height: 1024,
						bytes: candidateBytes!.byteLength,
						alphaMode: 'rgba',
						contentHash: outputHash
					}
				: null,
		resultPath,
		findings:
			mode === 'candidate'
				? [
						{
							category: 'geometry',
							evaluator: 'automated',
							outcome: 'pass',
							observation: 'Geometry passes.'
						},
						{
							category: 'manifest-fidelity',
							evaluator: 'producer',
							outcome: 'pass',
							observation: 'Prompt matched.'
						}
					]
				: [
						{
							category: 'provider-output',
							evaluator: 'producer',
							outcome: 'fail',
							observation: 'Provider did not return a source.'
						}
					],
		...(mode === 'failed'
			? { failureReason: { kind: 'provider-failure', message: 'Provider failed.' } }
			: {}),
		startedAt: '2026-09-02T08:01:00.000Z',
		completedAt: '2026-09-02T08:02:00.000Z',
		totalWallTimeMs: 60000,
		writtenOutputPaths: mode === 'candidate' ? [candidatePath, resultPath] : [resultPath],
		noSharedFilesEdited: true,
		selfPromoted: false
	};
	for (const [relativePath, value] of [
		[assignmentPath, JSON.stringify(assignment)],
		[resultPath, JSON.stringify(result)]
	] as const) {
		await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
		await writeFile(path.join(root, relativePath), value);
	}
	return { jobId, candidatePath, resultPath };
}

async function recoveryState(item: Awaited<ReturnType<typeof fixture>>) {
	const transactionId = randomUUID();
	const transactionToken = randomUUID();
	const masterPath =
		'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png';
	const master = path.join(item.root, masterPath);
	const stagingDirectoryPath = `assets/wiki/skills/icon-production-v1/.promotion-staging/${transactionId}`;
	const stagingDirectory = path.join(item.root, stagingDirectoryPath);
	await mkdir(path.dirname(master), { recursive: true });
	await mkdir(stagingDirectory, { recursive: true, mode: 0o700 });
	const bytes = await readFile(path.join(item.root, item.candidatePath));
	await writeFile(master, bytes);
	const [
		parentMetadata,
		fileMetadata,
		parentRealPath,
		stagingParentMetadata,
		stagingMetadata,
		stagingParentRealPath
	] = await Promise.all([
		lstat(path.dirname(master)),
		lstat(master),
		realpath(path.dirname(master)),
		lstat(path.dirname(stagingDirectory)),
		lstat(stagingDirectory),
		realpath(path.dirname(stagingDirectory))
	]);
	const lock = {
		schemaVersion: 'skill-icon-promotion-lock-v1',
		transactionId,
		recoveryTokenHash: createHash('sha256').update(transactionToken).digest('hex'),
		pid: 999_999,
		processIdentity: null,
		acquiredAt: '2026-09-02T10:00:00.000Z'
	};
	const journal = {
		schemaVersion: 'skill-icon-promotion-transaction-v1',
		transactionId,
		recoveryTokenHash: lock.recoveryTokenHash,
		authorizationTag: '0'.repeat(64),
		phase: 'outputs-writing',
		jobs: [{ jobId: 'charcoal-forged-stone-v1', masterPath, contentHash: item.hash }],
		planned: [
			{
				path: masterPath,
				contentHash: item.hash,
				parent: {
					realPath: parentRealPath,
					device: parentMetadata.dev,
					inode: parentMetadata.ino
				},
				file: { device: fileMetadata.dev, inode: fileMetadata.ino }
			}
		],
		created: [
			{
				path: masterPath,
				contentHash: item.hash,
				parent: {
					realPath: parentRealPath,
					device: parentMetadata.dev,
					inode: parentMetadata.ino
				},
				file: { device: fileMetadata.dev, inode: fileMetadata.ino }
			}
		],
		shared: [],
		staging: {
			directoryPath: stagingDirectoryPath,
			parent: {
				realPath: stagingParentRealPath,
				device: stagingParentMetadata.dev,
				inode: stagingParentMetadata.ino
			},
			directory: { device: stagingMetadata.dev, inode: stagingMetadata.ino },
			files: []
		}
	};
	Object.assign(journal, signJournalForTest(journal, transactionToken));
	await writeFile(
		path.join(item.root, SKILL_ICON_PROMOTION_TOKEN_PATH),
		JSON.stringify({
			schemaVersion: 'skill-icon-promotion-recovery-token-v1',
			transactionId,
			recoveryToken: transactionToken,
			pid: lock.pid,
			processIdentity: lock.processIdentity,
			createdAt: '2026-09-02T10:00:00.000Z'
		}),
		{ mode: 0o600 }
	);
	await writeFile(path.join(item.root, SKILL_ICON_PROMOTION_LOCK_PATH), JSON.stringify(lock));
	await writeFile(path.join(item.root, SKILL_ICON_PROMOTION_JOURNAL_PATH), JSON.stringify(journal));
	return { transactionId, transactionToken, masterPath, master, lock, journal };
}

describe('promoteSkillIconOutput', () => {
	it('copies the exact accepted owner-reviewed candidate and preserves evidence', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const record = await promoteSkillIconOutput({
			jobId: 'charcoal-forged-stone-v1',
			reviewPath: item.reviewPath,
			root: item.root
		});
		expect(record).toMatchObject({
			jobId: 'charcoal-forged-stone-v1',
			role: 'backing',
			candidate: { path: item.candidatePath, contentHash: item.hash },
			approvedMaster: {
				path: 'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png',
				contentHash: item.hash
			},
			reviewContentHash: createHash('sha256')
				.update(await readFile(path.join(item.root, item.reviewPath)))
				.digest('hex')
		});
		expect(await readFile(path.join(item.root, record.approvedMaster.path))).toEqual(
			await readFile(path.join(item.root, item.candidatePath))
		);
		const receiptBytes = await readFile(path.join(item.root, record.promotionReceipt.path));
		expect(createHash('sha256').update(receiptBytes).digest('hex')).toBe(
			record.promotionReceipt.contentHash
		);
		expect(JSON.parse(receiptBytes.toString('utf8'))).toMatchObject({
			transactionId: record.transactionId,
			ownerReviewer: 'Skills visual owner',
			review: { path: item.reviewPath },
			result: { path: item.resultPath, contentHash: record.resultContentHash },
			candidate: { path: item.candidatePath, contentHash: item.hash },
			master: { path: record.approvedMaster.path, contentHash: item.hash }
		});
		await expect(access(path.join(item.root, item.resultPath))).resolves.toBeUndefined();
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root
			})
		).rejects.toThrow(/exist|collision/iu);
	});

	it('promotes a latest target with a fully bound v2 target, assignment, and result', async () => {
		const item = await fixture('charcoal-forged-stone-v2');
		await installBackingV2Packet(item.root, 'candidate');
		const record = await promoteSkillIconOutput({
			jobId: 'charcoal-forged-stone-v2',
			reviewPath: item.reviewPath,
			root: item.root
		});
		expect(record).toMatchObject({
			jobId: 'charcoal-forged-stone-v2',
			role: 'backing',
			candidate: { path: item.candidatePath, contentHash: item.hash },
			approvedMaster: {
				path: 'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png',
				contentHash: item.hash
			}
		});
	});

	it('blocks an older candidate whenever a newer target is incomplete or terminally failed', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		await installBackingV2Packet(item.root, 'target-only');
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root
			})
		).rejects.toThrow(/not the unique latest target.*charcoal-forged-stone-v2/iu);

		await installBackingV2Packet(item.root, 'failed');
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root
			})
		).rejects.toThrow(/not the unique latest target.*charcoal-forged-stone-v2/iu);
		await expect(
			access(
				path.join(
					item.root,
					'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
				)
			)
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('binds v2 promotion to the single-read raw geometry hash', async () => {
		const item = await fixture('charcoal-forged-stone-v2');
		await installBackingV2Packet(item.root, 'candidate');
		const geometryPath = path.join(
			item.root,
			'assets/wiki/skills/icon-production-v1/geometry.json'
		);
		await writeFile(geometryPath, Buffer.concat([await readFile(geometryPath), Buffer.from('\n')]));
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v2',
				reviewPath: item.reviewPath,
				root: item.root
			})
		).rejects.toThrow(/geometry hash mismatch/iu);
	});

	it('replaces a verified prior canonical master while preserving immutable receipt history', async () => {
		const item = await fixture('charcoal-forged-stone-v2');
		await installBackingV2Packet(item.root, 'candidate');
		const oldBytes = await sharp(await backingPng())
			.tint('#8a4f2d')
			.png()
			.toBuffer();
		await installApprovedReferenceEvidence(item.root, 'backing', oldBytes, null);
		const oldReceiptPath = `${SKILL_ICON_PROMOTION_RECEIPT_ROOT}/charcoal-forged-stone-v1.json`;
		const oldReceiptBytes = await readFile(path.join(item.root, oldReceiptPath));
		const masterPath = path.join(
			item.root,
			'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
		);
		let stopObserver = false;
		let observerSawMissingMaster = false;
		const observer = (async () => {
			while (!stopObserver) {
				try {
					await access(masterPath);
				} catch {
					observerSawMissingMaster = true;
				}
				await new Promise<void>((resolve) => setImmediate(resolve));
			}
		})();
		let record: Awaited<ReturnType<typeof promoteSkillIconOutput>>;
		try {
			record = await promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v2',
				reviewPath: item.reviewPath,
				root: item.root
			});
		} finally {
			stopObserver = true;
			await observer;
		}
		expect(observerSawMissingMaster).toBe(false);
		expect(await readFile(path.join(item.root, record.approvedMaster.path))).toEqual(
			await readFile(path.join(item.root, item.candidatePath))
		);
		expect(await readFile(path.join(item.root, oldReceiptPath))).toEqual(oldReceiptBytes);
		await expect(
			access(
				path.join(item.root, `${SKILL_ICON_PROMOTION_RECEIPT_ROOT}/charcoal-forged-stone-v2.json`)
			)
		).resolves.toBeUndefined();
	});

	it('rejects an existing canonical master without verified promotion evidence', async () => {
		const item = await fixture('charcoal-forged-stone-v2');
		await installBackingV2Packet(item.root, 'candidate');
		const masterPath = path.join(
			item.root,
			'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
		);
		await mkdir(path.dirname(masterPath), { recursive: true });
		await writeFile(masterPath, await backingPng());
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v2',
				reviewPath: item.reviewPath,
				root: item.root
			})
		).rejects.toThrow(/lacks verified promotion history/iu);
	});

	it('rejects a raced prior master instead of overwriting unverified bytes', async () => {
		const item = await fixture('charcoal-forged-stone-v2');
		await installBackingV2Packet(item.root, 'candidate');
		const oldBytes = await sharp(await backingPng())
			.tint('#8a4f2d')
			.png()
			.toBuffer();
		await installApprovedReferenceEvidence(item.root, 'backing', oldBytes, null);
		const masterPath = path.join(
			item.root,
			'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
		);
		const racedBytes = await sharp(oldBytes).tint('#274e75').png().toBuffer();
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v2',
				reviewPath: item.reviewPath,
				root: item.root,
				testHooks: { beforeMasterWrite: () => writeFile(masterPath, racedBytes) }
			})
		).rejects.toThrow(/changed|rollback was incomplete|durable recovery state/iu);
		expect(await readFile(masterPath)).toEqual(racedBytes);
	});

	it('restores the prior canonical master when replacement transaction rolls back', async () => {
		const item = await fixture('charcoal-forged-stone-v2');
		await installBackingV2Packet(item.root, 'candidate');
		const oldBytes = await sharp(await backingPng())
			.tint('#8a4f2d')
			.png()
			.toBuffer();
		await installApprovedReferenceEvidence(item.root, 'backing', oldBytes, null);
		const masterPath = path.join(
			item.root,
			'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
		);
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v2',
				reviewPath: item.reviewPath,
				root: item.root,
				testHooks: {
					afterMasterWrite: () => {
						throw new Error('replace rollback');
					}
				}
			})
		).rejects.toThrow(/replace rollback/iu);
		expect(await readFile(masterPath)).toEqual(oldBytes);
		await expect(
			access(
				path.join(item.root, `${SKILL_ICON_PROMOTION_RECEIPT_ROOT}/charcoal-forged-stone-v2.json`)
			)
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('promotes an accepted calibration plate without imposing alpha safe-zone rules', async () => {
		const item = await fixture(
			'blade-sweeping-cut-calibration-v1',
			'accepted',
			'calibration-plate'
		);
		const record = await promoteSkillIconOutput({
			jobId: 'blade-sweeping-cut-calibration-v1',
			reviewPath: item.reviewPath,
			root: item.root
		});
		expect(record).toMatchObject({
			role: 'calibration-plate',
			approvedMaster: {
				path: 'assets/wiki/skills/icon-production-v1/masters/calibration/blade-sweeping-cut.png'
			}
		});
	});

	it('rejects preseeded derivatives and atomically promotes skill art with recomputed defaults', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-promote-skill-'));
		roots.push(root);
		for (const relativePath of [
			...CANONICAL_SKILL_SOURCE_PATHS,
			SKILL_ICON_MOTIF_SOURCE_PATH,
			'assets/wiki/skills/icon-production-v1/geometry.json'
		]) {
			await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
			await copyFile(path.resolve(relativePath), path.join(root, relativePath));
		}
		const sourceVisual = JSON.parse(
			await readFile(path.resolve(SKILL_ICON_VISUAL_SPECS_PATH), 'utf8')
		) as { schemaVersion: string; records: Record<string, unknown>[] };
		const targetId = 'martial:blade:swordsmanship';
		const slug = targetId.replaceAll(':', '-');
		const jobId = `${slug}-v1`;
		const candidatePath = `assets/wiki/skills/icon-production-v1/candidates/icons/${jobId}.png`;
		const resultPath = `assets/wiki/skills/icon-production-v1/results/icons/${jobId}.json`;
		const targetPath = `assets/wiki/skills/icon-production-v1/targets/icons/${jobId}.json`;
		const assignmentPath = `assets/wiki/skills/icon-production-v1/assignments/icons/${jobId}.json`;
		const reviewPath = `assets/wiki/skills/icon-production-v1/review/decisions/icons/${jobId}.json`;
		const candidate = await sharp(
			Buffer.from(
				'<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><circle cx="512" cy="560" r="220" fill="red"/></svg>'
			)
		)
			.png()
			.toBuffer();
		const candidateHash = createHash('sha256').update(candidate).digest('hex');
		const findings = [
			{
				category: 'geometry',
				evaluator: 'automated',
				outcome: 'pass',
				observation: 'Geometry passes.'
			},
			{
				category: 'manifest-fidelity',
				evaluator: 'producer',
				outcome: 'pass',
				observation: 'Prompt matched.'
			}
		];
		const geometryReference = Buffer.from('deterministic geometry reference');
		const geometryReferencePath =
			'assets/wiki/skills/icon-production-v1/references/geometry-guide.png';
		const exactPrompt = 'Paint one centered practice sword.';
		const output = {
			path: candidatePath,
			mediaType: 'image/png',
			width: 1024,
			height: 1024,
			bytes: candidate.byteLength,
			alphaMode: 'rgba',
			contentHash: candidateHash
		};
		const target = {
			schemaVersion: 'skill-icon-target-v1',
			jobId,
			role: 'skill-art',
			skillTargetId: targetId,
			motifFamily: null,
			rarity: null,
			exactPrompt,
			references: [
				{
					path: geometryReferencePath,
					purpose: 'Geometry.',
					contentHash: createHash('sha256').update(geometryReference).digest('hex')
				}
			],
			canvas: { width: 1024, height: 1024, mediaType: 'image/png' },
			output: { candidatePath, resultPath }
		};
		const assignment = {
			schemaVersion: 'skill-icon-assignment-v1',
			assignmentId: `assignment-${jobId}`,
			jobId,
			targetPath,
			assignmentPath,
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
		const result = {
			schemaVersion: 'skill-icon-result-v1',
			resultId: `result-${jobId}`,
			jobId,
			assignmentId: assignment.assignmentId,
			status: 'candidate',
			exactPrompt,
			promptHash: createHash('sha256').update(exactPrompt).digest('hex'),
			referenceInputs: target.references.map(({ path, contentHash }) => ({ path, contentHash })),
			output,
			resultPath,
			findings,
			startedAt: '2026-09-02T08:01:00.000Z',
			completedAt: '2026-09-02T08:02:00.000Z',
			totalWallTimeMs: 60000,
			writtenOutputPaths: [candidatePath, resultPath],
			noSharedFilesEdited: true,
			selfPromoted: false
		};
		const resultBytes = Buffer.from(JSON.stringify(result));
		const review = {
			schemaVersion: 'skill-icon-review-v1',
			reviewId: `review-${jobId}`,
			jobId,
			role: 'skill-art',
			skillTargetId: targetId,
			candidatePath,
			candidateHash,
			reviewer: 'Skills visual owner',
			reviewerRole: 'owner',
			decision: 'accepted',
			rationale: 'Recognizable and coherent.',
			findings: [
				{ criterion: 'recognition', outcome: 'pass', observation: 'Readable at 96 pixels.' }
			],
			reviewedAt: '2026-09-02T10:00:00.000Z'
		};
		const untouchedRecord = sourceVisual.records.find((record) => record.targetId !== targetId)!;
		sourceVisual.records = sourceVisual.records.map((record) =>
			record.targetId === targetId
				? {
						...record,
						status: 'candidate',
						visualSpec: {
							dominantSubject: 'One practice sword',
							supportingCue: null,
							semanticPalette: ['steel blue'],
							composition: 'Centered emblem',
							exclusions: ['No text']
						},
						producerResult: {
							jobId,
							status: 'candidate',
							path: resultPath,
							contentHash: createHash('sha256').update(resultBytes).digest('hex'),
							findings
						},
						assets: { candidate: output },
						review: null
					}
				: record
		);
		for (const [relativePath, value] of [
			[SKILL_ICON_VISUAL_SPECS_PATH, JSON.stringify(sourceVisual)],
			[geometryReferencePath, geometryReference],
			[candidatePath, candidate],
			[targetPath, JSON.stringify(target)],
			[assignmentPath, JSON.stringify(assignment)],
			[resultPath, resultBytes],
			[reviewPath, JSON.stringify(review)]
		] as const) {
			await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
			await writeFile(path.join(root, relativePath), value);
		}
		await installApprovedReferenceEvidence(root, 'backing', await backingPng(), null);
		await installApprovedReferenceEvidence(root, 'rarity-frame', await framePng(), 'F');
		for (const size of [512, 256, 128] as const) {
			const relativePath = `apps/web/static/skill-icons/v1/${size}/${slug}.webp`;
			await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
			await writeFile(
				path.join(root, relativePath),
				await sharp(candidate).resize(size, size).webp().toBuffer()
			);
		}
		const recognitionPath = `assets/wiki/skills/icon-production-v1/review/recognition/${slug}.png`;
		await mkdir(path.dirname(path.join(root, recognitionPath)), { recursive: true });
		await writeFile(
			path.join(root, recognitionPath),
			await sharp(candidate).resize(96, 96).png().toBuffer()
		);
		await exportSkillIconProduction({ root, mode: 'write' });
		const cliRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-promote-cli-'));
		roots.push(cliRoot);
		await cp(root, cliRoot, { recursive: true, force: false });
		for (const relativePath of [
			...([512, 256, 128] as const).map(
				(size) => `apps/web/static/skill-icons/v1/${size}/${slug}.webp`
			),
			recognitionPath
		]) {
			await rm(path.join(cliRoot, relativePath));
		}
		const cliPromoted = await runSkillIconPromotionCli(['--job', jobId, '--review', reviewPath], {
			root: cliRoot
		});
		expect(cliPromoted).toMatchObject({ role: 'skill-art' });
		for (const relativePath of [
			`assets/wiki/skills/icon-production-v1/masters/icons/${slug}.png`,
			`apps/web/static/skill-icons/v1/512/${slug}.webp`,
			`apps/web/static/skill-icons/v1/256/${slug}.webp`,
			`apps/web/static/skill-icons/v1/128/${slug}.webp`,
			`assets/wiki/skills/icon-production-v1/review/recognition/${slug}.png`,
			`${SKILL_ICON_PROMOTION_RECEIPT_ROOT}/${jobId}.json`
		]) {
			await expect(access(path.join(cliRoot, relativePath))).resolves.toBeUndefined();
		}
		const unreviewedRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-unreviewed-ref-'));
		roots.push(unreviewedRoot);
		await cp(root, unreviewedRoot, { recursive: true, force: false });
		await rm(
			path.join(unreviewedRoot, SKILL_ICON_PROMOTION_RECEIPT_ROOT, 'charcoal-forged-stone-v1.json')
		);
		await expect(
			promoteSkillIconOutput({ jobId, reviewPath, root: unreviewedRoot })
		).rejects.toThrow(/exactly one accepted promotion receipt/iu);

		const replacedRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-replaced-ref-'));
		roots.push(replacedRoot);
		await cp(root, replacedRoot, { recursive: true, force: false });
		await writeFile(
			path.join(
				replacedRoot,
				'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
			),
			candidate
		);
		await expect(promoteSkillIconOutput({ jobId, reviewPath, root: replacedRoot })).rejects.toThrow(
			/evidence hash mismatch/iu
		);

		const invalidRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-invalid-ref-'));
		roots.push(invalidRoot);
		await cp(root, invalidRoot, { recursive: true, force: false });
		await installApprovedReferenceEvidence(invalidRoot, 'backing', candidate, null);
		await expect(promoteSkillIconOutput({ jobId, reviewPath, root: invalidRoot })).rejects.toThrow(
			/reference geometry is invalid/iu
		);

		await expect(promoteSkillIconOutput({ jobId, reviewPath, root })).rejects.toThrow(
			/collision/iu
		);
		const visualAfter = JSON.parse(
			await readFile(path.join(root, SKILL_ICON_VISUAL_SPECS_PATH), 'utf8')
		) as { records: Record<string, unknown>[] };
		expect(visualAfter.records.find((record) => record.targetId === targetId)).toMatchObject({
			status: 'candidate',
			review: null,
			assets: { candidate: { contentHash: candidateHash } }
		});
		expect(
			visualAfter.records.find((record) => record.targetId === untouchedRecord.targetId)
		).toEqual(untouchedRecord);
		const catalogAfter = JSON.parse(
			await readFile(path.join(root, 'assets/wiki/skills/icon-production-v1/catalog.json'), 'utf8')
		) as { records: Record<string, unknown>[] };
		expect(catalogAfter.records.find((record) => record.targetId === targetId)).toMatchObject({
			status: 'candidate'
		});
		await expect(access(path.join(root, candidatePath))).resolves.toBeUndefined();
		await expect(access(path.join(root, resultPath))).resolves.toBeUndefined();
		await expect(
			access(path.join(root, `assets/wiki/skills/icon-production-v1/masters/icons/${slug}.png`))
		).rejects.toMatchObject({ code: 'ENOENT' });

		const forgedVisual = JSON.parse(
			await readFile(path.join(root, SKILL_ICON_VISUAL_SPECS_PATH), 'utf8')
		) as { records: Record<string, unknown>[] };
		forgedVisual.records = forgedVisual.records.map((record) =>
			record.targetId === targetId
				? {
						...record,
						producerResult: {
							...(record.producerResult as object),
							contentHash: 'b'.repeat(64)
						}
					}
				: record
		);
		await writeFile(
			path.join(root, SKILL_ICON_VISUAL_SPECS_PATH),
			`${JSON.stringify(forgedVisual, null, '\t')}\n`
		);
		await expect(promoteSkillIconOutput({ jobId, reviewPath, root })).rejects.toThrow(
			/result evidence hash/iu
		);

		await writeFile(
			path.join(root, SKILL_ICON_VISUAL_SPECS_PATH),
			`${JSON.stringify(visualAfter, null, '\t')}\n`
		);
		for (const relativePath of [
			...([512, 256, 128] as const).map(
				(size) => `apps/web/static/skill-icons/v1/${size}/${slug}.webp`
			),
			recognitionPath
		]) {
			await rm(path.join(root, relativePath));
		}
		const derivativeResolver: SkillIconDerivativeResolver = async (input) => {
			return {
				runtime512: await sharp(input.candidate.bytes).resize(512, 512).webp().toBuffer(),
				runtime256: await sharp(input.candidate.bytes).resize(256, 256).webp().toBuffer(),
				runtime128: await sharp(input.candidate.bytes).resize(128, 128).webp().toBuffer(),
				recognition96: await sharp(input.candidate.bytes).resize(96, 96).png().toBuffer()
			};
		};
		await expect(
			promoteSkillIconOutput({
				jobId,
				reviewPath,
				root,
				testHooks: { derivativeResolver }
			})
		).rejects.toThrow(/did not match fixed/iu);
		await expect(
			promoteSkillIconOutput({
				jobId,
				reviewPath,
				root,
				testHooks: {
					afterSharedReplaceBeforeProgress: ({ path: sharedPath }) => {
						if (sharedPath === SKILL_ICON_VISUAL_SPECS_PATH)
							throw new Error('injected shared-state failure');
					}
				}
			})
		).rejects.toThrow(/injected shared-state failure/iu);
		expect(
			JSON.parse(
				await readFile(path.join(root, SKILL_ICON_VISUAL_SPECS_PATH), 'utf8')
			).records.find((record: Record<string, unknown>) => record.targetId === targetId)
		).toMatchObject({ status: 'candidate' });
		for (const relativePath of [
			`assets/wiki/skills/icon-production-v1/masters/icons/${slug}.png`,
			`${SKILL_ICON_PROMOTION_RECEIPT_ROOT}/${jobId}.json`,
			`apps/web/static/skill-icons/v1/512/${slug}.webp`,
			`apps/web/static/skill-icons/v1/256/${slug}.webp`,
			`apps/web/static/skill-icons/v1/128/${slug}.webp`,
			`assets/wiki/skills/icon-production-v1/review/recognition/${slug}.png`
		]) {
			await expect(access(path.join(root, relativePath))).rejects.toMatchObject({ code: 'ENOENT' });
		}
		const promoted = await promoteSkillIconOutput({
			jobId,
			reviewPath,
			root
		});
		expect(promoted).toMatchObject({ role: 'skill-art', transactionId: expect.any(String) });
		const approvedVisual = JSON.parse(
			await readFile(path.join(root, SKILL_ICON_VISUAL_SPECS_PATH), 'utf8')
		) as { records: Record<string, unknown>[] };
		expect(approvedVisual.records.find((record) => record.targetId === targetId)).toMatchObject({
			status: 'approved',
			assets: {
				approvedMaster: { contentHash: candidateHash },
				runtime512: { width: 512 },
				recognition96: { width: 96 }
			}
		});
		for (const relativePath of [
			`apps/web/static/skill-icons/v1/512/${slug}.webp`,
			`apps/web/static/skill-icons/v1/256/${slug}.webp`,
			`apps/web/static/skill-icons/v1/128/${slug}.webp`,
			`assets/wiki/skills/icon-production-v1/review/recognition/${slug}.png`,
			`${SKILL_ICON_PROMOTION_RECEIPT_ROOT}/${jobId}.json`
		]) {
			await expect(access(path.join(root, relativePath))).resolves.toBeUndefined();
		}
		const approvedCatalog = JSON.parse(
			await readFile(path.join(root, 'assets/wiki/skills/icon-production-v1/catalog.json'), 'utf8')
		) as { records: Record<string, unknown>[] };
		expect(approvedCatalog.records.find((record) => record.targetId === targetId)).toMatchObject({
			status: 'approved',
			assets: { runtime128: { width: 128 }, recognition96: { width: 96 } }
		});
		expect(await exportSkillIconRuntime({ root, mode: 'check' })).toMatchObject({
			inSync: true,
			orphanPaths: [],
			drift: []
		});
		const approvedRecord = approvedCatalog.records.find((record) => record.targetId === targetId)!;
		const approvedAssets = approvedRecord.assets as {
			runtime128: { contentHash: string };
		};
		approvedAssets.runtime128.contentHash = 'b'.repeat(64);
		const catalogPath = path.join(root, 'assets/wiki/skills/icon-production-v1/catalog.json');
		await writeFile(catalogPath, `${JSON.stringify(approvedCatalog, null, '\t')}\n`);
		const tamperedCatalog = await readFile(catalogPath);
		const descriptorDrift = await exportSkillIconRuntime({ root, mode: 'check' });
		expect(descriptorDrift.inSync).toBe(false);
		expect(descriptorDrift.drift).toContain(`descriptor ${targetId}:runtime128`);
		expect(await readFile(catalogPath)).toEqual(tamperedCatalog);
		await exportSkillIconProduction({ root, mode: 'write' });
		const orphanPath = 'apps/web/static/skill-icons/v1/512/unclaimed-orphan.webp';
		await writeFile(path.join(root, orphanPath), Buffer.from('orphan'));
		const orphanDrift = await exportSkillIconRuntime({ root, mode: 'check' });
		expect(orphanDrift).toMatchObject({ inSync: false, orphanPaths: [orphanPath] });
	}, 60_000);

	it('rejects missing, non-accepted, non-owner, and hash-mismatched review evidence', async () => {
		const item = await fixture('charcoal-forged-stone-v1', 'rejected');
		await expect(
			promoteSkillIconOutput({
				jobId: item.reviewPath,
				reviewPath:
					'assets/wiki/skills/icon-production-v1/review/decisions/references/missing-v1.json',
				root: item.root
			})
		).rejects.toThrow();
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root
			})
		).rejects.toThrow(/accepted/u);
		const reviewFile = path.join(item.root, item.reviewPath);
		const review = JSON.parse(await readFile(reviewFile, 'utf8'));
		await writeFile(
			reviewFile,
			JSON.stringify({ ...review, decision: 'accepted', reviewerRole: 'producer' })
		);
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root
			})
		).rejects.toThrow(/owner|review/iu);
		await writeFile(
			reviewFile,
			JSON.stringify({ ...review, decision: 'accepted', candidateHash: 'b'.repeat(64) })
		);
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root
			})
		).rejects.toThrow(/hash/u);
	});

	it('serializes coordinators with an exclusive lock', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		let release!: () => void;
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		let entered!: () => void;
		const acquired = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const first = promoteSkillIconOutput({
			jobId: 'charcoal-forged-stone-v1',
			reviewPath: item.reviewPath,
			root: item.root,
			testHooks: {
				afterLockAcquired: async () => {
					entered();
					await blocked;
				}
			}
		});
		await acquired;
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root
			})
		).rejects.toThrow(/promotion (?:lock|recovery token)/iu);
		release();
		await expect(first).resolves.toMatchObject({ jobId: 'charcoal-forged-stone-v1' });
	});

	it('does not let token possession recover a paused live writer', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		let release!: () => void;
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		let entered!: () => void;
		const acquired = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const promotion = promoteSkillIconOutput({
			jobId: 'charcoal-forged-stone-v1',
			reviewPath: item.reviewPath,
			root: item.root,
			testHooks: {
				afterLockAcquired: async () => {
					entered();
					await blocked;
				}
			}
		});
		await acquired;
		const token = JSON.parse(
			await readFile(path.join(item.root, SKILL_ICON_PROMOTION_TOKEN_PATH), 'utf8')
		).recoveryToken as string;
		expect(
			JSON.parse(await readFile(path.join(item.root, SKILL_ICON_PROMOTION_LOCK_PATH), 'utf8'))
		).toMatchObject({ pid: process.pid, processIdentity: { bootId: expect.any(String) } });
		await expect(
			recoverSkillIconPromotion({
				root: item.root,
				transactionToken: token,
				isCoordinatorLive: () => true
			})
		).rejects.toThrow(/live coordinator/iu);
		release();
		await expect(promotion).resolves.toMatchObject({ jobId: 'charcoal-forged-stone-v1' });
	});

	it('retains the token when operation failure finds a tampered lock', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const lockPath = path.join(item.root, SKILL_ICON_PROMOTION_LOCK_PATH);
		let originalLock = '';
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root,
				testHooks: {
					afterLockAcquired: async () => {
						originalLock = await readFile(lockPath, 'utf8');
						await writeFile(lockPath, `${originalLock}\n`);
						throw new Error('operation failed after lock tamper');
					}
				}
			})
		).rejects.toThrow(/authority cleanup requires recovery token/iu);
		const tokenPath = path.join(item.root, SKILL_ICON_PROMOTION_TOKEN_PATH);
		const token = JSON.parse(await readFile(tokenPath, 'utf8')).recoveryToken as string;
		await expect(access(lockPath)).resolves.toBeUndefined();
		await expect(access(tokenPath)).resolves.toBeUndefined();
		await writeFile(lockPath, originalLock);
		await recoverSkillIconPromotion({
			root: item.root,
			transactionToken: token,
			isCoordinatorLive: () => false
		});
		await expect(access(lockPath)).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(access(tokenPath)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('rolls back every owned write after an injected commit failure', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const master = path.join(
			item.root,
			'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
		);
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root,
				testHooks: {
					afterOutputWriteBeforeProgress: () => {
						throw new Error('injected failure');
					}
				}
			})
		).rejects.toThrow(/injected failure/u);
		await expect(access(master)).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_JOURNAL_PATH))
		).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_LOCK_PATH))
		).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_TOKEN_PATH))
		).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(
			readdir(path.join(item.root, 'assets/wiki/skills/icon-production-v1/.promotion-staging'))
		).resolves.toEqual([]);
	});

	it('rolls back owned outputs when result evidence changes during the transaction', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root,
				testHooks: {
					beforeMasterWrite: async () => {
						const resultPath = path.join(item.root, item.resultPath);
						await writeFile(resultPath, `${await readFile(resultPath, 'utf8')}\n`);
					}
				}
			})
		).rejects.toThrow(/result evidence changed/iu);
		for (const relativePath of [
			'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png',
			`${SKILL_ICON_PROMOTION_RECEIPT_ROOT}/charcoal-forged-stone-v1.json`
		]) {
			await expect(access(path.join(item.root, relativePath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		}
	});

	it('rechecks latest revision after the write-boundary hook and never promotes a stale candidate', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root,
				testHooks: {
					beforeMasterWrite: async () => {
						await installBackingV2Packet(item.root, 'target-only');
					}
				}
			})
		).rejects.toThrow(/not the unique latest target.*charcoal-forged-stone-v2/iu);
		for (const relativePath of [
			'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png',
			`${SKILL_ICON_PROMOTION_RECEIPT_ROOT}/charcoal-forged-stone-v1.json`
		]) {
			await expect(access(path.join(item.root, relativePath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		}
	});

	it('rechecks latest revision in final evidence validation and rolls back completed writes', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root,
				testHooks: {
					afterMasterWrite: async () => {
						await installBackingV2Packet(item.root, 'target-only');
					}
				}
			})
		).rejects.toThrow(/not the unique latest target.*charcoal-forged-stone-v2/iu);
		for (const relativePath of [
			'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png',
			`${SKILL_ICON_PROMOTION_RECEIPT_ROOT}/charcoal-forged-stone-v1.json`
		]) {
			await expect(access(path.join(item.root, relativePath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		}
	});

	it.each(['target', 'assignment'] as const)(
		'rejects a late same-job valid %s packet mutation and rolls back the master',
		async (authority) => {
			const item = await fixture('charcoal-forged-stone-v1');
			const packetPath = path.join(
				item.root,
				`assets/wiki/skills/icon-production-v1/${authority === 'target' ? 'targets' : 'assignments'}/references/charcoal-forged-stone-v1.json`
			);
			await expect(
				promoteSkillIconOutput({
					jobId: 'charcoal-forged-stone-v1',
					reviewPath: item.reviewPath,
					root: item.root,
					testHooks: {
						afterMasterWrite: async () => {
							const packet = JSON.parse(await readFile(packetPath, 'utf8')) as Record<
								string,
								unknown
							>;
							if (authority === 'target') {
								const references = packet.references as { purpose: string }[];
								references[0]!.purpose = 'Changed but schema-valid geometry purpose.';
							} else packet.assignedAt = '2026-09-02T08:00:01.000Z';
							await writeFile(packetPath, JSON.stringify(packet));
						}
					}
				})
			).rejects.toThrow(new RegExp(`${authority} authority changed`, 'iu'));
			await expect(
				access(
					path.join(
						item.root,
						'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
					)
				)
			).rejects.toMatchObject({ code: 'ENOENT' });
		}
	);

	it('rejects a late parse-valid raw geometry mutation and rolls back the master', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const geometryPath = path.join(
			item.root,
			'assets/wiki/skills/icon-production-v1/geometry.json'
		);
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root,
				testHooks: {
					afterMasterWrite: async () => {
						await writeFile(
							geometryPath,
							Buffer.concat([await readFile(geometryPath), Buffer.from('\n')])
						);
					}
				}
			})
		).rejects.toThrow(/geometry authority changed/iu);
		await expect(
			access(
				path.join(
					item.root,
					'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
				)
			)
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it.each(['target', 'assignment', 'geometry'] as const)(
		'rejects a late same-byte %s inode replacement and rolls back the master',
		async (authority) => {
			const item = await fixture('charcoal-forged-stone-v1');
			const relativePath =
				authority === 'geometry'
					? 'assets/wiki/skills/icon-production-v1/geometry.json'
					: `assets/wiki/skills/icon-production-v1/${authority === 'target' ? 'targets' : 'assignments'}/references/charcoal-forged-stone-v1.json`;
			const authorityPath = path.join(item.root, relativePath);
			await expect(
				promoteSkillIconOutput({
					jobId: 'charcoal-forged-stone-v1',
					reviewPath: item.reviewPath,
					root: item.root,
					testHooks: {
						afterMasterWrite: async () => {
							const replacementPath = `${authorityPath}.replacement`;
							await writeFile(replacementPath, await readFile(authorityPath));
							await rename(replacementPath, authorityPath);
						}
					}
				})
			).rejects.toThrow(new RegExp(`${authority} authority changed`, 'iu'));
			await expect(
				access(
					path.join(
						item.root,
						'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
					)
				)
			).rejects.toMatchObject({ code: 'ENOENT' });
		}
	);

	it('rejects a FIFO review without blocking', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const reviewPath = path.join(item.root, item.reviewPath);
		await unlink(reviewPath);
		execFileSync('/usr/bin/mkfifo', [reviewPath]);
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root
			})
		).rejects.toThrow(/review must be a regular file/iu);
	}, 5_000);

	it('rejects an oversized sparse authority before allocating its declared size', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const reviewPath = path.join(item.root, item.reviewPath);
		const handle = await open(reviewPath, 'r+');
		try {
			await handle.truncate(64 * 1024 * 1024 + 1);
		} finally {
			await handle.close();
		}
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root
			})
		).rejects.toThrow(/review exceeds 67108864 bytes/iu);
	});

	it('rejects an ancestor swap before writing and never writes through the symlink', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const outside = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-promote-outside-'));
		roots.push(outside);
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root,
				testHooks: {
					beforeMasterWrite: async ({ destination }) => {
						const parent = path.dirname(destination);
						await rename(parent, `${parent}-moved`);
						await symlink(outside, parent);
					}
				}
			})
		).rejects.toThrow(/symbolic link|identity|rollback was incomplete/iu);
		expect(await readdir(outside)).toEqual([]);
	});

	it('recovers hash-owned orphan masters from a durable stale journal', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		await expect(
			recoverSkillIconPromotion({
				root: item.root,
				transactionToken: randomUUID()
			})
		).rejects.toThrow(/token/iu);
		await expect(access(state.master)).resolves.toBeUndefined();
		await recoverSkillIconPromotion({
			root: item.root,
			transactionToken: state.transactionToken
		});
		await expect(access(state.master)).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_JOURNAL_PATH))
		).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_LOCK_PATH))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('fails closed on malformed lock state without deleting it', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		const lockPath = path.join(item.root, SKILL_ICON_PROMOTION_LOCK_PATH);
		await writeFile(lockPath, '');
		await expect(
			recoverSkillIconPromotion({ root: item.root, transactionToken: state.transactionToken })
		).rejects.toThrow(/invalid.*lock|fail-closed/iu);
		await expect(readFile(lockPath, 'utf8')).resolves.toBe('');
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_TOKEN_PATH))
		).resolves.toBeUndefined();
	});

	it('persists a private recovery token before lock creation and cleans token-only state explicitly', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		let observedToken = '';
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root,
				testHooks: {
					beforeLockWrite: async ({ tokenPath, recoveryToken }) => {
						observedToken = recoveryToken;
						expect((await lstat(tokenPath)).mode & 0o777).toBe(0o600);
						throw new Error('simulated process death before lock write');
					}
				}
			})
		).rejects.toThrow(/explicit cleanup requires recovery token/iu);
		const tokenPath = path.join(item.root, SKILL_ICON_PROMOTION_TOKEN_PATH);
		await expect(access(tokenPath)).resolves.toBeUndefined();
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_LOCK_PATH))
		).rejects.toMatchObject({ code: 'ENOENT' });
		await recoverSkillIconPromotion({
			root: item.root,
			transactionToken: observedToken,
			isCoordinatorLive: () => false
		});
		await expect(access(tokenPath)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('refuses token-only recovery while a pre-lock coordinator is paused', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		let release!: () => void;
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		let entered!: () => void;
		const paused = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const promotion = promoteSkillIconOutput({
			jobId: 'charcoal-forged-stone-v1',
			reviewPath: item.reviewPath,
			root: item.root,
			testHooks: {
				beforeLockWrite: async () => {
					entered();
					await blocked;
				}
			}
		});
		await paused;
		const tokenPath = path.join(item.root, SKILL_ICON_PROMOTION_TOKEN_PATH);
		const tokenRecord = JSON.parse(await readFile(tokenPath, 'utf8')) as {
			recoveryToken: string;
			pid: number;
			processIdentity: unknown;
		};
		expect(tokenRecord).toMatchObject({
			pid: process.pid,
			processIdentity: { bootId: expect.any(String), startTicks: expect.any(String) }
		});
		await expect(
			recoverSkillIconPromotion({
				root: item.root,
				transactionToken: tokenRecord.recoveryToken,
				isCoordinatorLive: () => true
			})
		).rejects.toThrow(/live coordinator/iu);
		await expect(access(tokenPath)).resolves.toBeUndefined();
		release();
		await expect(promotion).resolves.toMatchObject({ jobId: 'charcoal-forged-stone-v1' });
	});

	it('fails closed on a malformed token-only authority record', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const tokenPath = path.join(item.root, SKILL_ICON_PROMOTION_TOKEN_PATH);
		await writeFile(tokenPath, '{', { mode: 0o600 });
		await expect(
			recoverSkillIconPromotion({ root: item.root, transactionToken: randomUUID() })
		).rejects.toThrow(/invalid promotion recovery token|fail-closed/iu);
		await expect(readFile(tokenPath, 'utf8')).resolves.toBe('{');
	});

	it('retains the durable token when a partial lock cannot be parsed', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		await writeFile(path.join(item.root, SKILL_ICON_PROMOTION_LOCK_PATH), '{');
		await expect(
			recoverSkillIconPromotion({ root: item.root, transactionToken: state.transactionToken })
		).rejects.toThrow(/invalid promotion lock/iu);
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_TOKEN_PATH))
		).resolves.toBeUndefined();
	});

	it('rejects malicious or partial journals before mutating any repository file', async () => {
		for (const mutate of [
			(journal: Record<string, unknown>) => ({
				...journal,
				jobs: [
					{
						jobId: 'charcoal-forged-stone-v1',
						masterPath: 'package.json',
						contentHash: 'a'.repeat(64)
					}
				]
			}),
			(journal: Record<string, unknown>) => ({
				...journal,
				shared: [
					{
						path: 'package.json',
						before: {
							bytesBase64: Buffer.from('owned').toString('base64'),
							contentHash: 'a'.repeat(64)
						},
						afterHash: 'b'.repeat(64),
						parent: { realPath: '/tmp', device: 1, inode: 1 }
					}
				]
			}),
			(journal: Record<string, unknown>) => ({
				...journal,
				jobs: [...(journal.jobs as unknown[]), ...(journal.jobs as unknown[])]
			}),
			(journal: Record<string, unknown>) => ({
				...journal,
				created: [
					{
						...(journal.created as Record<string, unknown>[])[0],
						path: '../victim'
					}
				]
			}),
			() => ({ schemaVersion: 'skill-icon-promotion-transaction-v1' })
		] as const) {
			const item = await fixture('charcoal-forged-stone-v1');
			const state = await recoveryState(item);
			const victimPath = path.join(item.root, 'package.json');
			await writeFile(victimPath, 'victim-must-survive');
			await writeFile(
				path.join(item.root, SKILL_ICON_PROMOTION_JOURNAL_PATH),
				JSON.stringify(mutate(state.journal))
			);
			await expect(
				recoverSkillIconPromotion({
					root: item.root,
					transactionToken: state.transactionToken
				})
			).rejects.toThrow(/invalid.*journal|fail-closed/iu);
			await expect(readFile(victimPath, 'utf8')).resolves.toBe('victim-must-survive');
			await expect(access(state.master)).resolves.toBeUndefined();
		}
	});

	it('rejects a self-consistent but unauthorized shared-state snapshot', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		const sharedPath = path.join(item.root, SKILL_ICON_VISUAL_SPECS_PATH);
		await mkdir(path.dirname(sharedPath), { recursive: true });
		const current = Buffer.from('current-shared-state');
		const malicious = Buffer.from('{"attacker":true}\n');
		await writeFile(sharedPath, current);
		const [parentMetadata, parentRealPath] = await Promise.all([
			lstat(path.dirname(sharedPath)),
			realpath(path.dirname(sharedPath))
		]);
		const crafted = signJournalForTest(
			{
				...state.journal,
				phase: 'shared-writing',
				shared: [
					{
						path: SKILL_ICON_VISUAL_SPECS_PATH,
						before: {
							bytesBase64: malicious.toString('base64'),
							contentHash: createHash('sha256').update(malicious).digest('hex')
						},
						afterHash: createHash('sha256').update(current).digest('hex'),
						parent: {
							realPath: parentRealPath,
							device: parentMetadata.dev,
							inode: parentMetadata.ino
						},
						beforeFile: { device: 1, inode: 1 },
						afterFile: await lstat(sharedPath).then((metadata) => ({
							device: metadata.dev,
							inode: metadata.ino
						}))
					}
				]
			},
			randomUUID()
		);
		await writeFile(
			path.join(item.root, SKILL_ICON_PROMOTION_JOURNAL_PATH),
			JSON.stringify(crafted)
		);
		await expect(
			recoverSkillIconPromotion({
				root: item.root,
				transactionToken: state.transactionToken
			})
		).rejects.toThrow(/authorization/iu);
		await expect(readFile(sharedPath)).resolves.toEqual(current);
		await expect(access(state.master)).resolves.toBeUndefined();
	});

	it('retains recovery state and an outside victim when a recorded parent is swapped', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		const parent = path.dirname(state.master);
		const movedParent = `${parent}-moved`;
		const outside = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-recovery-outside-'));
		roots.push(outside);
		const outsideVictim = path.join(outside, path.basename(state.master));
		await writeFile(outsideVictim, 'outside-victim');
		await expect(
			recoverSkillIconPromotion({
				root: item.root,
				transactionToken: state.transactionToken,
				testHooks: {
					beforeRecoveryMutation: async () => {
						await rename(parent, movedParent);
						await symlink(outside, parent);
					}
				}
			})
		).rejects.toThrow(/identity|symbolic link|cleanup required/iu);
		await expect(readFile(outsideVictim, 'utf8')).resolves.toBe('outside-victim');
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_LOCK_PATH))
		).resolves.toBeUndefined();
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_JOURNAL_PATH))
		).resolves.toBeUndefined();
		await expect(
			access(path.join(movedParent, path.basename(state.master)))
		).resolves.toBeUndefined();
	});

	it('recovers a planned output created before its progress update', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		const journal = signJournalForTest({ ...state.journal, created: [] }, state.transactionToken);
		await writeFile(
			path.join(item.root, SKILL_ICON_PROMOTION_JOURNAL_PATH),
			JSON.stringify(journal)
		);
		await recoverSkillIconPromotion({
			root: item.root,
			transactionToken: state.transactionToken
		});
		await expect(access(state.master)).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_LOCK_PATH))
		).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_JOURNAL_PATH))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('removes partial bytes only when the durable plan binds the exact reserved inode', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		const journal = signJournalForTest({ ...state.journal, created: [] }, state.transactionToken);
		await writeFile(
			path.join(item.root, SKILL_ICON_PROMOTION_JOURNAL_PATH),
			JSON.stringify(journal)
		);
		await writeFile(state.master, Buffer.from('partial'));
		await recoverSkillIconPromotion({
			root: item.root,
			transactionToken: state.transactionToken,
			isCoordinatorLive: () => false
		});
		await expect(access(state.master)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('fails closed when a completed output is tampered on its recorded inode', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		await writeFile(state.master, Buffer.from('tampered'));
		await expect(
			recoverSkillIconPromotion({
				root: item.root,
				transactionToken: state.transactionToken,
				isCoordinatorLive: () => false
			})
		).rejects.toThrow(/completed output hash changed|cleanup required/iu);
		await expect(readFile(state.master)).resolves.toEqual(Buffer.from('tampered'));
	});

	it('does not delete an empty substituted inode from a pre-reservation crash state', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		const journal = signJournalForTest(
			{
				...state.journal,
				planned: state.journal.planned.map((planned) => ({ ...planned, file: null })),
				created: []
			},
			state.transactionToken
		);
		await writeFile(
			path.join(item.root, SKILL_ICON_PROMOTION_JOURNAL_PATH),
			JSON.stringify(journal)
		);
		await rm(state.master);
		await writeFile(state.master, '');
		await expect(
			recoverSkillIconPromotion({
				root: item.root,
				transactionToken: state.transactionToken,
				isCoordinatorLive: () => false
			})
		).rejects.toThrow(/inode|cleanup required/iu);
		await expect(readFile(state.master)).resolves.toEqual(Buffer.alloc(0));
	});

	it('cleans an empty transaction stage left before its inode reservation without exposing a final', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		const journal = signJournalForTest(
			{
				...state.journal,
				planned: state.journal.planned.map((planned) => ({ ...planned, file: null })),
				created: []
			},
			state.transactionToken
		);
		await writeFile(
			path.join(item.root, SKILL_ICON_PROMOTION_JOURNAL_PATH),
			JSON.stringify(journal)
		);
		await rm(state.master);
		const emptyStage = path.join(item.root, state.journal.staging.directoryPath, '0000.stage');
		await writeFile(emptyStage, '');
		await recoverSkillIconPromotion({
			root: item.root,
			transactionToken: state.transactionToken,
			isCoordinatorLive: () => false
		});
		await expect(access(state.master)).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(access(emptyStage)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('rejects a replaced inode even when replacement bytes match', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		const bytes = await readFile(state.master);
		await rename(state.master, `${state.master}.replaced`);
		await writeFile(state.master, bytes);
		await expect(
			recoverSkillIconPromotion({
				root: item.root,
				transactionToken: state.transactionToken,
				isCoordinatorLive: () => false
			})
		).rejects.toThrow(/inode|cleanup required/iu);
		await expect(readFile(state.master)).resolves.toEqual(bytes);
	});

	it('treats a missing planned output as an already-completed rollback step', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		await rm(state.master);
		await recoverSkillIconPromotion({
			root: item.root,
			transactionToken: state.transactionToken
		});
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_TOKEN_PATH))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('refuses token-authorized recovery while the coordinator is live', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		await expect(
			recoverSkillIconPromotion({
				root: item.root,
				transactionToken: state.transactionToken,
				isCoordinatorLive: () => true
			})
		).rejects.toThrow(/live coordinator/iu);
		await expect(access(state.master)).resolves.toBeUndefined();
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_TOKEN_PATH))
		).resolves.toBeUndefined();
	});

	it('retries recovery after one planned output was already deleted', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		const receiptPath = `${SKILL_ICON_PROMOTION_RECEIPT_ROOT}/charcoal-forged-stone-v1.json`;
		const receipt = path.join(item.root, receiptPath);
		const receiptBytes = Buffer.from('{"owned":true}\n');
		await mkdir(path.dirname(receipt), { recursive: true });
		await writeFile(receipt, receiptBytes);
		const [receiptParent, receiptFile, receiptRealPath] = await Promise.all([
			lstat(path.dirname(receipt)),
			lstat(receipt),
			realpath(path.dirname(receipt))
		]);
		const entry = {
			path: receiptPath,
			contentHash: createHash('sha256').update(receiptBytes).digest('hex'),
			parent: {
				realPath: receiptRealPath,
				device: receiptParent.dev,
				inode: receiptParent.ino
			},
			file: { device: receiptFile.dev, inode: receiptFile.ino }
		};
		const journal = signJournalForTest(
			{
				...state.journal,
				planned: [
					...state.journal.planned,
					{
						path: entry.path,
						contentHash: entry.contentHash,
						parent: entry.parent,
						file: entry.file
					}
				],
				created: [...state.journal.created, entry]
			},
			state.transactionToken
		);
		await writeFile(
			path.join(item.root, SKILL_ICON_PROMOTION_JOURNAL_PATH),
			JSON.stringify(journal)
		);
		await expect(
			recoverSkillIconPromotion({
				root: item.root,
				transactionToken: state.transactionToken,
				testHooks: {
					afterRecoveryOutputDelete: () => {
						throw new Error('simulated recovery crash');
					}
				}
			})
		).rejects.toThrow(/simulated recovery crash/u);
		await expect(access(receipt)).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(access(state.master)).resolves.toBeUndefined();
		await recoverSkillIconPromotion({
			root: item.root,
			transactionToken: state.transactionToken
		});
		await expect(access(state.master)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it.each([
		['already-restored shared state', false],
		['shared replacement before its progress update', true]
	] as const)('recovers %s idempotently', async (_label, replacedBeforeProgress) => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		const sharedPath = path.join(item.root, SKILL_ICON_VISUAL_SPECS_PATH);
		await mkdir(path.dirname(sharedPath), { recursive: true });
		const before = Buffer.from('{"state":"before"}\n');
		const after = Buffer.from('{"state":"after"}\n');
		await writeFile(sharedPath, replacedBeforeProgress ? after : before);
		const [parentMetadata, beforeFile, parentRealPath] = await Promise.all([
			lstat(path.dirname(sharedPath)),
			lstat(sharedPath),
			realpath(path.dirname(sharedPath))
		]);
		const journal = signJournalForTest(
			{
				...state.journal,
				phase: 'shared-writing',
				shared: [
					{
						path: SKILL_ICON_VISUAL_SPECS_PATH,
						before: {
							bytesBase64: before.toString('base64'),
							contentHash: createHash('sha256').update(before).digest('hex')
						},
						afterHash: createHash('sha256').update(after).digest('hex'),
						parent: {
							realPath: parentRealPath,
							device: parentMetadata.dev,
							inode: parentMetadata.ino
						},
						beforeFile: { device: beforeFile.dev, inode: beforeFile.ino },
						afterFile: null
					}
				]
			},
			state.transactionToken
		);
		await writeFile(
			path.join(item.root, SKILL_ICON_PROMOTION_JOURNAL_PATH),
			JSON.stringify(journal)
		);
		await recoverSkillIconPromotion({
			root: item.root,
			transactionToken: state.transactionToken
		});
		await expect(readFile(sharedPath)).resolves.toEqual(before);
	});

	it('rejects duplicate logical revisions before writing the first master', async () => {
		const first = await fixture('charcoal-forged-stone-v1');
		const second = await fixture('obsidian-forged-stone-v1', 'rejected');
		const reviewDirectory = path.join(
			first.root,
			'assets/wiki/skills/icon-production-v1/review/decisions/references'
		);
		await writeFile(
			path.join(reviewDirectory, 'obsidian-forged-stone-v1.json'),
			await readFile(path.join(second.root, second.reviewPath))
		);
		for (const relative of [
			second.candidatePath,
			`assets/wiki/skills/icon-production-v1/targets/references/obsidian-forged-stone-v1.json`,
			`assets/wiki/skills/icon-production-v1/assignments/references/obsidian-forged-stone-v1.json`,
			second.resultPath
		]) {
			await mkdir(path.dirname(path.join(first.root, relative)), { recursive: true });
			await writeFile(
				path.join(first.root, relative),
				await readFile(path.join(second.root, relative))
			);
		}
		await expect(
			promoteReviewedSkillIconOutputs({
				reviewDirectory,
				root: first.root
			})
		).rejects.toThrow(/immutable historical identities|duplicate skill-icon logical revision/iu);
		await expect(
			access(
				path.join(
					first.root,
					'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
				)
			)
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it.each(['accepted', 'rejected'] as const)(
		'selects the latest batch review while preserving an older %s review as history',
		async (olderDecision) => {
			const first = await fixture('charcoal-forged-stone-v1', olderDecision);
			const olderReviewBytes = await readFile(path.join(first.root, first.reviewPath));
			const second = await fixture('charcoal-forged-stone-v2');
			await installBackingV2Packet(second.root, 'candidate');
			const reviewDirectory = path.join(
				first.root,
				'assets/wiki/skills/icon-production-v1/review/decisions/references'
			);
			for (const relative of [
				second.reviewPath,
				second.candidatePath,
				'assets/wiki/skills/icon-production-v1/targets/references/charcoal-forged-stone-v2.json',
				'assets/wiki/skills/icon-production-v1/assignments/references/charcoal-forged-stone-v2.json',
				second.resultPath,
				'assets/wiki/skills/icon-production-v1/geometry.json'
			]) {
				await mkdir(path.dirname(path.join(first.root, relative)), { recursive: true });
				await writeFile(
					path.join(first.root, relative),
					await readFile(path.join(second.root, relative))
				);
			}
			const records = await promoteReviewedSkillIconOutputs({
				reviewDirectory,
				root: first.root
			});
			expect(records).toHaveLength(1);
			expect(records[0]?.jobId).toBe('charcoal-forged-stone-v2');
			expect(await readFile(path.join(first.root, first.reviewPath))).toEqual(olderReviewBytes);
			await expect(
				access(
					path.join(
						first.root,
						'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
					)
				)
			).resolves.toBeUndefined();
		}
	);

	it('rejects mixed CLI modes and preserves the documented command grammar', () => {
		expect(() =>
			parsePromotionCliRequest([
				'--review-dir',
				'reviews',
				'--job',
				'job-v1',
				'--review',
				'review.json'
			])
		).toThrow(/cannot mix/iu);
		expect(parsePromotionCliRequest(['--job', 'job-v1', '--review', 'review.json'])).toEqual({
			mode: 'single',
			jobId: 'job-v1',
			reviewPath: 'review.json'
		});
	});
});
