import { createHash, createHmac, randomUUID } from 'node:crypto';
import {
	access,
	copyFile,
	mkdir,
	mkdtemp,
	lstat,
	readFile,
	readdir,
	realpath,
	rename,
	rm,
	symlink,
	writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import { CANONICAL_SKILL_SOURCE_PATHS } from './skill-icon-production-lib.js';
import {
	SKILL_ICON_MOTIF_SOURCE_PATH,
	SKILL_ICON_VISUAL_SPECS_PATH,
	exportSkillIconProduction
} from './export-skill-icon-production.js';
import {
	SKILL_ICON_PROMOTION_JOURNAL_PATH,
	SKILL_ICON_PROMOTION_LOCK_PATH,
	SKILL_ICON_PROMOTION_RECEIPT_ROOT,
	parsePromotionCliRequest,
	promoteReviewedSkillIconOutputs,
	promoteSkillIconOutput,
	recoverSkillIconPromotion,
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

async function recoveryState(item: Awaited<ReturnType<typeof fixture>>) {
	const transactionId = randomUUID();
	const transactionToken = randomUUID();
	const masterPath =
		'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png';
	const master = path.join(item.root, masterPath);
	await mkdir(path.dirname(master), { recursive: true });
	const bytes = await readFile(path.join(item.root, item.candidatePath));
	await writeFile(master, bytes);
	const [parentMetadata, fileMetadata, parentRealPath] = await Promise.all([
		lstat(path.dirname(master)),
		lstat(master),
		realpath(path.dirname(master))
	]);
	const lock = {
		schemaVersion: 'skill-icon-promotion-lock-v1',
		transactionId,
		recoveryTokenHash: createHash('sha256').update(transactionToken).digest('hex'),
		pid: 999_999,
		acquiredAt: '2026-09-02T10:00:00.000Z'
	};
	const journal = {
		schemaVersion: 'skill-icon-promotion-transaction-v1',
		transactionId,
		recoveryTokenHash: lock.recoveryTokenHash,
		authorizationTag: '0'.repeat(64),
		phase: 'outputs-writing',
		jobs: [{ jobId: 'charcoal-forged-stone-v1', masterPath, contentHash: item.hash }],
		planned: [{ path: masterPath, contentHash: item.hash }],
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
		shared: []
	};
	Object.assign(journal, signJournalForTest(journal, transactionToken));
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

	it('refuses skill-art promotion until Task 5 supplies deterministic derivative verification', async () => {
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

		await expect(promoteSkillIconOutput({ jobId, reviewPath, root })).rejects.toThrow(
			/deterministic derivative resolver/iu
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
		let resolverSawBoundInputs = false;
		const derivativeResolver: SkillIconDerivativeResolver = async (input) => {
			resolverSawBoundInputs =
				input.candidate.contentHash === candidateHash &&
				input.references.length === 1 &&
				createHash('sha256').update(input.references[0]!.bytes).digest('hex') ===
					input.references[0]!.contentHash;
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
				derivativeResolver,
				testHooks: {
					afterSharedWrite: ({ index }) => {
						if (index === 0) throw new Error('injected shared-state failure');
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
			`apps/web/static/skill-icons/v1/512/${slug}.webp`
		]) {
			await expect(access(path.join(root, relativePath))).rejects.toMatchObject({ code: 'ENOENT' });
		}
		const promoted = await promoteSkillIconOutput({
			jobId,
			reviewPath,
			root,
			derivativeResolver
		});
		expect(resolverSawBoundInputs).toBe(true);
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
	});

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
		).rejects.toThrow(/promotion lock/iu);
		release();
		await expect(first).resolves.toMatchObject({ jobId: 'charcoal-forged-stone-v1' });
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
					afterMasterWrite: () => {
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
		const lockPath = path.join(item.root, SKILL_ICON_PROMOTION_LOCK_PATH);
		await writeFile(lockPath, '');
		await expect(
			recoverSkillIconPromotion({ root: item.root, transactionToken: randomUUID() })
		).rejects.toThrow(/invalid.*lock|fail-closed/iu);
		await expect(readFile(lockPath, 'utf8')).resolves.toBe('');
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

	it('retains recovery state for an untracked partial master instead of guessing ownership', async () => {
		const item = await fixture('charcoal-forged-stone-v1');
		const state = await recoveryState(item);
		const journal = signJournalForTest({ ...state.journal, created: [] }, state.transactionToken);
		await writeFile(
			path.join(item.root, SKILL_ICON_PROMOTION_JOURNAL_PATH),
			JSON.stringify(journal)
		);
		await expect(
			recoverSkillIconPromotion({
				root: item.root,
				transactionToken: state.transactionToken
			})
		).rejects.toThrow(/untracked partial|manual cleanup/iu);
		await expect(access(state.master)).resolves.toBeUndefined();
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_LOCK_PATH))
		).resolves.toBeUndefined();
		await expect(
			access(path.join(item.root, SKILL_ICON_PROMOTION_JOURNAL_PATH))
		).resolves.toBeUndefined();
	});

	it('preflights the whole directory before writing the first master', async () => {
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
		).rejects.toThrow(/accepted/u);
		await expect(
			access(
				path.join(
					first.root,
					'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
				)
			)
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('rejects duplicate batch destinations before writing any master', async () => {
		const first = await fixture('charcoal-forged-stone-v1');
		const second = await fixture('charcoal-forged-stone-v2');
		const reviewDirectory = path.join(
			first.root,
			'assets/wiki/skills/icon-production-v1/review/decisions/references'
		);
		for (const relative of [
			second.reviewPath,
			second.candidatePath,
			'assets/wiki/skills/icon-production-v1/targets/references/charcoal-forged-stone-v2.json',
			'assets/wiki/skills/icon-production-v1/assignments/references/charcoal-forged-stone-v2.json',
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
		).rejects.toThrow(/duplicate master destination/iu);
		await expect(
			access(
				path.join(
					first.root,
					'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
				)
			)
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

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
