import { createHash } from 'node:crypto';
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
	promoteReviewedSkillIconOutputs,
	promoteSkillIconOutput
} from './promote-skill-icon-output.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true }))));

async function fixture(jobId: string, decision: 'accepted' | 'rejected' = 'accepted') {
	const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-promote-'));
	roots.push(root);
	const candidatePath = `assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`;
	const resultPath = `assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`;
	const targetPath = `assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`;
	const assignmentPath = `assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`;
	const reviewPath = `assets/wiki/skills/icon-production-v1/review/decisions/references/${jobId}.json`;
	const bytes = await sharp(
		Buffer.from(
			'<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><polygon points="512,80 904,304 904,720 512,944 120,720 120,304" fill="#333"/></svg>'
		)
	)
		.png()
		.toBuffer();
	const hash = createHash('sha256').update(bytes).digest('hex');
	const target = {
		schemaVersion: 'skill-icon-target-v1',
		jobId,
		role: 'backing',
		skillTargetId: null,
		motifFamily: null,
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
		role: 'backing',
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
			}
		});
		expect(await readFile(path.join(item.root, record.approvedMaster.path))).toEqual(
			await readFile(path.join(item.root, item.candidatePath))
		);
		await expect(access(path.join(item.root, item.resultPath))).resolves.toBeUndefined();
		await expect(
			promoteSkillIconOutput({
				jobId: 'charcoal-forged-stone-v1',
				reviewPath: item.reviewPath,
				root: item.root
			})
		).rejects.toThrow(/exist|collision/iu);
	});

	it('updates only the bound skill visual record and regenerates the catalog', async () => {
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

		await promoteSkillIconOutput({ jobId, reviewPath, root });
		const visualAfter = JSON.parse(
			await readFile(path.join(root, SKILL_ICON_VISUAL_SPECS_PATH), 'utf8')
		) as { records: Record<string, unknown>[] };
		expect(visualAfter.records.find((record) => record.targetId === targetId)).toMatchObject({
			status: 'approved',
			review: { candidateHash, reviewerRole: 'owner' },
			assets: { approvedMaster: { contentHash: candidateHash } }
		});
		expect(
			visualAfter.records.find((record) => record.targetId === untouchedRecord.targetId)
		).toEqual(untouchedRecord);
		const catalogAfter = JSON.parse(
			await readFile(path.join(root, 'assets/wiki/skills/icon-production-v1/catalog.json'), 'utf8')
		) as { records: Record<string, unknown>[] };
		expect(catalogAfter.records.find((record) => record.targetId === targetId)).toMatchObject({
			status: 'approved'
		});
		await expect(access(path.join(root, candidatePath))).resolves.toBeUndefined();
		await expect(access(path.join(root, resultPath))).resolves.toBeUndefined();
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
			promoteReviewedSkillIconOutputs({ reviewDirectory, root: first.root })
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
});
