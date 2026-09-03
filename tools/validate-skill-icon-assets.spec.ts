import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
	AnySkillIconAssignmentSchema,
	SkillIconGeometrySchema
} from '../packages/contracts/src/index.js';
import {
	SKILL_ICON_ART_MIN_VISIBLE_FRACTION_OF_SUBJECT_SAFE_AREA,
	SKILL_ICON_FRAME_EDGE_BAND_MINIMUM_COVERAGE,
	SKILL_ICON_FRAME_INNER_APERTURE_SCALE,
	SKILL_ICON_FRAME_MIN_VISIBLE_FRACTION_OF_APERTURE_AREA,
	inspectSkillIconAsset,
	validateSkillIconAssets
} from './validate-skill-icon-assets.js';

const geometrySourcePath = path.resolve('assets/wiki/skills/icon-production-v1/geometry.json');
const geometrySourceBytes = await readFile(geometrySourcePath);
const geometryHash = createHash('sha256').update(geometrySourceBytes).digest('hex');
const geometry = SkillIconGeometrySchema.parse(JSON.parse(geometrySourceBytes.toString('utf8')));

async function svgPng(svg: string): Promise<Buffer> {
	return sharp(Buffer.from(svg)).png().toBuffer();
}

async function rgbaPng(visible: (x: number, y: number) => number): Promise<Buffer> {
	const pixels = Buffer.alloc(1024 * 1024 * 4);
	for (let y = 0; y < 1024; y += 1) {
		for (let x = 0; x < 1024; x += 1) {
			const offset = (y * 1024 + x) * 4;
			pixels[offset] = 80;
			pixels[offset + 1] = 100;
			pixels[offset + 2] = 120;
			pixels[offset + 3] = visible(x + 0.5, y + 0.5);
		}
	}
	return sharp(pixels, { raw: { width: 1024, height: 1024, channels: 4 } })
		.png()
		.toBuffer();
}

function inPolygon(x: number, y: number, points: readonly (readonly [number, number])[]) {
	let inside = false;
	for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
		const [xi, yi] = points[index]!;
		const [xj, yj] = points[previous]!;
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

const testRoots: string[] = [];

afterEach(async () => {
	await Promise.all(testRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function revisionTestRoot(seedHistorical = true): Promise<string> {
	const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-validator-'));
	testRoots.push(root);
	await mkdir(path.join(root, 'assets/wiki/skills/icon-production-v1'), { recursive: true });
	await writeFile(
		path.join(root, 'assets/wiki/skills/icon-production-v1/geometry.json'),
		geometrySourceBytes
	);
	for (const area of ['targets', 'assignments', 'results', 'candidates']) {
		await mkdir(path.join(root, `assets/wiki/skills/icon-production-v1/${area}/references`), {
			recursive: true
		});
	}
	if (seedHistorical) await seedHistoricalReferenceInventory(root);
	return root;
}

const exactPromptV1 =
	'Create one canonical charcoal forged stone backing inside the shared transparent aperture.';
const exactPromptV2 =
	'Create one canonical backing on an opaque #00FF00 matte with no baked checkerboard.';
const referenceInputs = [
	{
		path: 'assets/wiki/skills/icon-production-v1/references/geometry-guide.png',
		purpose: 'Canonical geometry authority.',
		contentHash: 'a'.repeat(64)
	}
];

function outputPaths(jobId: string) {
	return {
		candidatePath: `assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`,
		resultPath: `assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`
	};
}

function targetV1() {
	const jobId = 'charcoal-forged-stone-v1';
	return {
		schemaVersion: 'skill-icon-target-v1' as const,
		jobId,
		role: 'backing',
		skillTargetId: null,
		motifFamily: null,
		rarity: null,
		exactPrompt: exactPromptV1,
		references: referenceInputs,
		canvas: { width: 1024, height: 1024, mediaType: 'image/png' },
		output: outputPaths(jobId)
	};
}

function rarityFrameTargetV1(rarity: 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S') {
	const jobId = `rarity-frame-${rarity.toLowerCase()}-v1`;
	return {
		...targetV1(),
		jobId,
		role: 'rarity-frame' as const,
		rarity,
		output: outputPaths(jobId)
	};
}

function targetV2(revision = 2, rawGeometryHash = geometryHash) {
	const logicalIdentity = 'charcoal-forged-stone';
	const jobId = `${logicalIdentity}-v${revision}`;
	return {
		schemaVersion: 'skill-icon-target-v2' as const,
		jobId,
		logicalIdentity,
		revision,
		role: 'backing',
		skillTargetId: null,
		motifFamily: null,
		rarity: null,
		exactPrompt: exactPromptV2,
		references: referenceInputs,
		canvas: { width: 1024, height: 1024, mediaType: 'image/png' },
		output: outputPaths(jobId),
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
				contentHash: rawGeometryHash
			}
		}
	};
}

function rarityFrameTargetV2(rarity: 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S') {
	const logicalIdentity = `rarity-frame-${rarity.toLowerCase()}`;
	const jobId = `${logicalIdentity}-v2`;
	return {
		...targetV2(),
		jobId,
		logicalIdentity,
		role: 'rarity-frame' as const,
		rarity,
		output: outputPaths(jobId)
	};
}

type TestTarget =
	| ReturnType<typeof targetV1>
	| ReturnType<typeof rarityFrameTargetV1>
	| ReturnType<typeof targetV2>
	| ReturnType<typeof rarityFrameTargetV2>;

function assignment(target: TestTarget) {
	const v2 = target.schemaVersion === 'skill-icon-target-v2';
	return {
		schemaVersion: v2 ? 'skill-icon-assignment-v2' : 'skill-icon-assignment-v1',
		assignmentId: `assignment-${target.jobId}`,
		jobId: target.jobId,
		...(v2
			? {
					logicalIdentity: target.logicalIdentity,
					revision: target.revision,
					normalization: { profile: 'skill-icon-green-key-role-mask-v1' }
				}
			: {}),
		targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${target.jobId}.json`,
		assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${target.jobId}.json`,
		skillVersion: v2 ? 'summonlab-skill-icon-production-v2' : 'summonlab-skill-icon-production-v1',
		assignedAt: '2026-09-02T00:00:00.000Z',
		retryCeiling: 1,
		permittedOutputs: target.output,
		forbiddenSharedPaths: ['assets/wiki/skills/icon-production-v1/catalog.json'],
		completionContract: {
			oneTargetOneImage: true,
			structuredResultRequired: true,
			sharedFilesMustRemainUntouched: true,
			selfPromotionForbidden: true
		}
	};
}

function candidateOutput(jobId: string, bytes: Buffer) {
	return {
		path: outputPaths(jobId).candidatePath,
		mediaType: 'image/png',
		width: 1024,
		height: 1024,
		bytes: bytes.byteLength,
		alphaMode: 'rgba',
		contentHash: createHash('sha256').update(bytes).digest('hex')
	};
}

function candidateResult(target: TestTarget, bytes: Buffer) {
	const v2 = target.schemaVersion === 'skill-icon-target-v2';
	const output = candidateOutput(target.jobId, bytes);
	return {
		schemaVersion: v2 ? 'skill-icon-result-v2' : 'skill-icon-result-v1',
		resultId: `result-${target.jobId}`,
		jobId: target.jobId,
		...(v2
			? {
					logicalIdentity: target.logicalIdentity,
					revision: target.revision,
					normalization: {
						profile: 'skill-icon-green-key-role-mask-v1',
						outcome: 'completed',
						geometryHash,
						providerSource: {
							mediaType: 'image/png',
							width: 1254,
							height: 1254,
							bytes: 1024,
							alphaMode: 'rgb',
							contentHash: 'b'.repeat(64)
						},
						sourceContentHash: 'b'.repeat(64),
						outputContentHash: output.contentHash
					}
				}
			: {}),
		assignmentId: `assignment-${target.jobId}`,
		status: 'candidate',
		exactPrompt: target.exactPrompt,
		promptHash: createHash('sha256').update(target.exactPrompt).digest('hex'),
		referenceInputs: referenceInputs.map(({ path, contentHash }) => ({ path, contentHash })),
		output,
		resultPath: target.output.resultPath,
		findings: [
			{
				evaluator: 'automated',
				category: v2 ? 'deterministic-normalization' : 'exact-source-persistence',
				outcome: 'pass',
				observation: 'Candidate bytes satisfy the automated production contract.'
			},
			{
				evaluator: 'producer',
				category: 'geometry',
				outcome: 'pass',
				observation: 'Candidate composition satisfies the backing role.'
			}
		],
		startedAt: '2026-09-02T00:00:00.000Z',
		completedAt: '2026-09-02T00:00:01.000Z',
		totalWallTimeMs: 1000,
		writtenOutputPaths: [target.output.candidatePath, target.output.resultPath],
		noSharedFilesEdited: true,
		selfPromoted: false
	};
}

function failedResult(target: TestTarget) {
	const v2 = target.schemaVersion === 'skill-icon-target-v2';
	return {
		schemaVersion: v2 ? 'skill-icon-result-v2' : 'skill-icon-result-v1',
		resultId: `result-${target.jobId}`,
		jobId: target.jobId,
		...(v2
			? {
					logicalIdentity: target.logicalIdentity,
					revision: target.revision,
					normalization: {
						profile: 'skill-icon-green-key-role-mask-v1',
						outcome: 'not-run',
						geometryHash,
						providerSource: null,
						sourceContentHash: null,
						outputContentHash: null
					}
				}
			: {}),
		assignmentId: `assignment-${target.jobId}`,
		status: 'failed',
		exactPrompt: target.exactPrompt,
		promptHash: createHash('sha256').update(target.exactPrompt).digest('hex'),
		referenceInputs: referenceInputs.map(({ path, contentHash }) => ({ path, contentHash })),
		output: null,
		resultPath: target.output.resultPath,
		findings: [
			{
				evaluator: 'producer',
				category: 'other',
				outcome: 'fail',
				observation: 'Provider production failed before a candidate was retained.'
			}
		],
		failureReason: { kind: 'provider-failure', message: 'Provider did not return an image.' },
		startedAt: '2026-09-02T00:00:00.000Z',
		completedAt: '2026-09-02T00:00:01.000Z',
		totalWallTimeMs: 1000,
		writtenOutputPaths: [target.output.resultPath],
		noSharedFilesEdited: true,
		selfPromoted: false
	};
}

async function writeExecution(
	root: string,
	target: TestTarget,
	result: ReturnType<typeof candidateResult> | ReturnType<typeof failedResult>,
	candidate?: Buffer
) {
	const base = path.join(root, 'assets/wiki/skills/icon-production-v1');
	await writeFile(
		path.join(base, `targets/references/${target.jobId}.json`),
		JSON.stringify(target)
	);
	await writeFile(
		path.join(base, `assignments/references/${target.jobId}.json`),
		JSON.stringify(assignment(target))
	);
	await writeFile(
		path.join(base, `results/references/${target.jobId}.json`),
		JSON.stringify(result)
	);
	if (candidate) {
		await writeFile(path.join(base, `candidates/references/${target.jobId}.png`), candidate);
	} else if (result.status === 'failed') {
		await rm(path.join(base, `candidates/references/${target.jobId}.png`), { force: true });
	}
}

let validBackingFixturePromise: Promise<Buffer> | undefined;
function validBackingFixture(): Promise<Buffer> {
	const aperture = geometry.aperturePoints.map(([px, py]) => [px * 1024, py * 1024] as const);
	validBackingFixturePromise ??= rgbaPng((x, y) => (inPolygon(x, y, aperture) ? 255 : 0));
	return validBackingFixturePromise;
}

let validFrameFixturePromise: Promise<Buffer> | undefined;
function validFrameFixture(): Promise<Buffer> {
	const outer = geometry.aperturePoints.map(([px, py]) => [px * 1024, py * 1024] as const);
	const inner = outer.map(
		([px, py]) =>
			[
				512 + (px - 512) * SKILL_ICON_FRAME_INNER_APERTURE_SCALE,
				512 + (py - 512) * SKILL_ICON_FRAME_INNER_APERTURE_SCALE
			] as const
	);
	validFrameFixturePromise ??= rgbaPng((x, y) => {
		return inPolygon(x, y, outer) && !inPolygon(x, y, inner) ? 255 : 0;
	});
	return validFrameFixturePromise;
}

async function seedHistoricalReferenceInventory(root: string): Promise<void> {
	const rarities = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
	const [backing, frame] = await Promise.all([validBackingFixture(), validFrameFixture()]);
	const backingTarget = targetV1();
	await Promise.all([
		writeExecution(root, backingTarget, candidateResult(backingTarget, backing), backing),
		...rarities.map((rarity) => {
			const target = rarityFrameTargetV1(rarity);
			return writeExecution(root, target, candidateResult(target, frame), frame);
		})
	]);
}

describe('inspectSkillIconAsset', () => {
	it('accepts centered transparent skill artwork', async () => {
		const validArt = await svgPng(
			'<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><circle cx="512" cy="560" r="220" fill="red"/></svg>'
		);
		expect((await inspectSkillIconAsset(validArt, 'skill-art', geometry)).violations).toEqual([]);
	});

	it('rejects RGB-only, effect overflow, and medallion collisions', async () => {
		const rgbOnly = await sharp({
			create: { width: 1024, height: 1024, channels: 3, background: '#334455' }
		})
			.png()
			.toBuffer();
		expect((await inspectSkillIconAsset(rgbOnly, 'skill-art', geometry)).violations).toContain(
			'skill-art requires a real alpha channel'
		);

		const oversizedEffect = await svgPng(
			'<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><circle cx="512" cy="512" r="370" fill="red"/></svg>'
		);
		expect(
			(await inspectSkillIconAsset(oversizedEffect, 'skill-art', geometry)).violations
		).toContain('visible pixels escape the 72% effect-safe region');

		const medallionCollision = await svgPng(
			'<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><circle cx="512" cy="120" r="20" fill="red"/></svg>'
		);
		expect(
			(await inspectSkillIconAsset(medallionCollision, 'skill-art', geometry)).violations
		).toContain('visible pixels enter the rarity-medallion exclusion');
	});

	it('treats every alpha value above 8 outside the aperture as a violation', async () => {
		const strictBacking = await rgbaPng((x, y) => {
			const aperture = geometry.aperturePoints.map(([px, py]) => [px * 1024, py * 1024] as const);
			if (x === 511.5 && y === 78.5) return 9;
			return inPolygon(x, y, aperture) ? 255 : 0;
		});
		expect((await inspectSkillIconAsset(strictBacking, 'backing', geometry)).violations).toContain(
			'backing pixels must remain inside the aperture'
		);
	});

	it('rejects one-pixel art and token frame marks using geometry-scaled thresholds', async () => {
		expect(SKILL_ICON_ART_MIN_VISIBLE_FRACTION_OF_SUBJECT_SAFE_AREA).toBeGreaterThan(0);
		expect(SKILL_ICON_FRAME_MIN_VISIBLE_FRACTION_OF_APERTURE_AREA).toBeGreaterThan(0);
		expect(SKILL_ICON_FRAME_EDGE_BAND_MINIMUM_COVERAGE).toBeGreaterThan(0);
		const speck = await rgbaPng((x, y) => (x === 511.5 && y === 511.5 ? 255 : 0));
		expect((await inspectSkillIconAsset(speck, 'skill-art', geometry)).violations).toContain(
			'skill-art visible area is below the minimum emblem coverage'
		);

		const edgeMidpoints = geometry.aperturePoints.map(([x, y], index, points) => {
			const [nextX, nextY] = points[(index + 1) % points.length]!;
			return [Math.floor(((x + nextX) * 1024) / 2), Math.floor(((y + nextY) * 1024) / 2)];
		});
		const tokenFrame = await rgbaPng((x, y) =>
			edgeMidpoints.some(([px, py]) => Math.floor(x) === px && Math.floor(y) === py) ? 255 : 0
		);
		const frameViolations = (await inspectSkillIconAsset(tokenFrame, 'rarity-frame', geometry))
			.violations;
		expect(frameViolations).toContain(
			'rarity-frame visible area is below the minimum frame coverage'
		);
		expect(frameViolations).toContain(
			'rarity-frame edge bands require substantial continuous coverage'
		);
	});

	it('requires a transparent frame aperture and all six edge bands', async () => {
		const filledFrameAperture = await svgPng(
			'<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><polygon points="512,80 904,304 904,720 512,944 120,720 120,304" fill="blue"/></svg>'
		);
		expect(
			(await inspectSkillIconAsset(filledFrameAperture, 'rarity-frame', geometry)).violations
		).toContain('rarity-frame aperture must remain transparent');

		const oneEdge = await svgPng(
			'<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><line x1="512" y1="80" x2="904" y2="304" stroke="blue" stroke-width="20"/></svg>'
		);
		expect((await inspectSkillIconAsset(oneEdge, 'rarity-frame', geometry)).violations).toContain(
			'rarity-frame material must intersect all six edge bands'
		);

		const outer = geometry.aperturePoints.map(([x, y]) => [x * 1024, y * 1024] as const);
		const inner = outer.map(
			([x, y]) =>
				[
					512 + (x - 512) * SKILL_ICON_FRAME_INNER_APERTURE_SCALE,
					512 + (y - 512) * SKILL_ICON_FRAME_INNER_APERTURE_SCALE
				] as const
		);
		const completeFrame = await rgbaPng((x, y) =>
			inPolygon(x, y, outer) && !inPolygon(x, y, inner) ? 255 : 0
		);
		expect(
			(await inspectSkillIconAsset(completeFrame, 'rarity-frame', geometry)).violations
		).toEqual([]);
	});

	it('allows the medallion union while rejecting frame pixels outside both authorities', async () => {
		const outer = geometry.aperturePoints.map(([x, y]) => [x * 1024, y * 1024] as const);
		const inner = outer.map(
			([x, y]) =>
				[
					512 + (x - 512) * SKILL_ICON_FRAME_INNER_APERTURE_SCALE,
					512 + (y - 512) * SKILL_ICON_FRAME_INNER_APERTURE_SCALE
				] as const
		);
		const medallion = geometry.rarityMedallionExclusion.map(
			([x, y]) => [x * 1024, y * 1024] as const
		);
		const accepted = await rgbaPng((x, y) =>
			(inPolygon(x, y, outer) && !inPolygon(x, y, inner)) || inPolygon(x, y, medallion) ? 255 : 0
		);
		expect((await inspectSkillIconAsset(accepted, 'rarity-frame', geometry)).violations).toEqual(
			[]
		);
		const outside = await rgbaPng((x, y) => {
			if (x < 10 && y < 10) return 255;
			return (inPolygon(x, y, outer) && !inPolygon(x, y, inner)) || inPolygon(x, y, medallion)
				? 255
				: 0;
		});
		expect((await inspectSkillIconAsset(outside, 'rarity-frame', geometry)).violations).toContain(
			'rarity-frame pixels must remain inside the outer hex or medallion envelope'
		);
	});

	it('checks backing aperture coverage but leaves calibration dimensions to its target', async () => {
		const aperture = geometry.aperturePoints.map(([x, y]) => [x * 1024, y * 1024] as const);
		const backing = await rgbaPng((x, y) => (inPolygon(x, y, aperture) ? 255 : 0));
		expect((await inspectSkillIconAsset(backing, 'backing', geometry)).violations).toEqual([]);

		const calibration = await sharp({
			create: { width: 2048, height: 1024, channels: 3, background: '#334455' }
		})
			.png()
			.toBuffer();
		expect(
			(await inspectSkillIconAsset(calibration, 'calibration-plate', geometry)).violations
		).toEqual([]);
	});
});

describe('validateSkillIconAssets revision authority', () => {
	async function validBacking(): Promise<Buffer> {
		return validBackingFixture();
	}

	it('rejects an empty production inventory that omits the immutable historical tuples', async () => {
		const root = await revisionTestRoot(false);
		const jobIds = [
			'charcoal-forged-stone-v1',
			'rarity-frame-f-v1',
			'rarity-frame-e-v1',
			'rarity-frame-d-v1',
			'rarity-frame-c-v1',
			'rarity-frame-b-v1',
			'rarity-frame-a-v1',
			'rarity-frame-s-v1'
		];
		let message = '';
		try {
			await validateSkillIconAssets(root);
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		}
		expect(message.split('\n')).toEqual(
			jobIds.flatMap((jobId) => [
				`references/${jobId}: missing required historical target inventory entry`,
				`references/${jobId}: missing assignment inventory entry`,
				`references/${jobId}: missing result inventory entry`
			])
		);
	});

	it('rejects deletion of one complete immutable historical tuple', async () => {
		const root = await revisionTestRoot();
		const base = path.join(root, 'assets/wiki/skills/icon-production-v1');
		const jobId = 'rarity-frame-s-v1';
		await Promise.all([
			rm(path.join(base, `targets/references/${jobId}.json`)),
			rm(path.join(base, `assignments/references/${jobId}.json`)),
			rm(path.join(base, `results/references/${jobId}.json`)),
			rm(path.join(base, `candidates/references/${jobId}.png`))
		]);

		let message = '';
		try {
			await validateSkillIconAssets(root);
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		}
		expect(message.split('\n')).toEqual([
			`references/${jobId}: missing required historical target inventory entry`,
			`references/${jobId}: missing assignment inventory entry`,
			`references/${jobId}: missing result inventory entry`
		]);
	});

	it('accepts a complete v2 candidate that supersedes terminal failed v1 evidence', async () => {
		const root = await revisionTestRoot();
		const v1 = targetV1();
		const v2 = targetV2();
		const candidate = await validBacking();
		await writeExecution(root, v1, failedResult(v1));
		await writeExecution(root, v2, candidateResult(v2, candidate), candidate);

		await expect(validateSkillIconAssets(root)).resolves.toBeUndefined();
	});

	it('does not fall back to v1 when the highest v2 revision is failed', async () => {
		const root = await revisionTestRoot();
		const v1 = targetV1();
		const v2 = targetV2();
		const candidate = await validBacking();
		await writeExecution(root, v1, candidateResult(v1, candidate), candidate);
		await writeExecution(root, v2, failedResult(v2));

		await expect(validateSkillIconAssets(root)).rejects.toThrow(
			/backing latest revision v2 is failed/iu
		);
	});

	it('does not fall back to v1 when the highest v2 revision lacks result evidence', async () => {
		const root = await revisionTestRoot();
		const v1 = targetV1();
		const v2 = targetV2();
		const candidate = await validBacking();
		await writeExecution(root, v1, candidateResult(v1, candidate), candidate);
		const base = path.join(root, 'assets/wiki/skills/icon-production-v1');
		await writeFile(path.join(base, `targets/references/${v2.jobId}.json`), JSON.stringify(v2));
		await writeFile(
			path.join(base, `assignments/references/${v2.jobId}.json`),
			JSON.stringify(assignment(v2))
		);

		await expect(validateSkillIconAssets(root)).rejects.toThrow(
			/references\/charcoal-forged-stone-v2: missing result inventory entry/iu
		);
	});

	it('rejects duplicate logical identity and revision in the global target tree', async () => {
		const root = await revisionTestRoot();
		const v2 = targetV2();
		await writeExecution(root, v2, failedResult(v2));
		await writeFile(
			path.join(root, 'assets/wiki/skills/icon-production-v1/targets/references/duplicate-v2.json'),
			JSON.stringify(v2)
		);

		await expect(validateSkillIconAssets(root)).rejects.toThrow(
			/Duplicate skill-icon logical revision backing v2/u
		);
	});

	it('preserves v1-only valid candidate compatibility', async () => {
		const root = await revisionTestRoot();
		const v1 = targetV1();
		const candidate = await validBacking();
		await writeExecution(root, v1, candidateResult(v1, candidate), candidate);

		await expect(validateSkillIconAssets(root)).resolves.toBeUndefined();
	});

	it('binds v2 targets to the current raw geometry source hash', async () => {
		const root = await revisionTestRoot();
		await writeFile(
			path.join(root, 'assets/wiki/skills/icon-production-v1/geometry.json'),
			Buffer.concat([geometrySourceBytes, Buffer.from('\n')])
		);
		const v2 = targetV2();
		await writeExecution(root, v2, failedResult(v2));

		await expect(validateSkillIconAssets(root)).rejects.toThrow(
			/current raw geometry authority hash does not match target/iu
		);
	});

	it.each([
		['assignment', 'assignments/references/orphan-v1.json', JSON.stringify({})],
		['result', 'results/references/orphan-v1.json', JSON.stringify({})],
		['candidate', 'candidates/references/orphan-v1.png', 'candidate bytes']
	] as const)('rejects an orphan %s inventory entry', async (kind, relativePath, contents) => {
		const root = await revisionTestRoot();
		const artifactPath = path.join(root, 'assets/wiki/skills/icon-production-v1', relativePath);
		await writeFile(artifactPath, contents);

		await expect(validateSkillIconAssets(root)).rejects.toThrow(
			new RegExp(`orphan ${kind} has no target`, 'iu')
		);
	});

	it('rejects missing and duplicate cross-scope inventory entries', async () => {
		const root = await revisionTestRoot();
		const target = targetV1();
		const base = path.join(root, 'assets/wiki/skills/icon-production-v1');
		await Promise.all([
			rm(path.join(base, `assignments/references/${target.jobId}.json`)),
			rm(path.join(base, `results/references/${target.jobId}.json`)),
			rm(path.join(base, `candidates/references/${target.jobId}.png`))
		]);
		await writeFile(
			path.join(base, `targets/references/${target.jobId}.json`),
			JSON.stringify(target)
		);
		await mkdir(path.join(base, 'assignments/icons'), { recursive: true });
		await writeFile(
			path.join(base, `assignments/icons/${target.jobId}.json`),
			JSON.stringify(assignment(target))
		);

		let message = '';
		try {
			await validateSkillIconAssets(root);
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		}
		expect(message).toMatch(/missing assignment inventory entry/iu);
		expect(message).toMatch(/missing result inventory entry/iu);
		expect(message).toMatch(/orphan assignment has no target/iu);
	});

	it('reports each missing result inventory entry exactly once', async () => {
		const root = await revisionTestRoot();
		const base = path.join(root, 'assets/wiki/skills/icon-production-v1');
		const rarities = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
		const targets = [targetV2(), ...rarities.map(rarityFrameTargetV2)];
		for (const target of targets) {
			await writeFile(
				path.join(base, `targets/references/${target.jobId}.json`),
				JSON.stringify(target)
			);
			await writeFile(
				path.join(base, `assignments/references/${target.jobId}.json`),
				JSON.stringify(AnySkillIconAssignmentSchema.parse(assignment(target)))
			);
		}

		let message = '';
		try {
			await validateSkillIconAssets(root);
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		}
		expect(message.split('\n')).toEqual(
			targets
				.map((target) => `references/${target.jobId}: missing result inventory entry`)
				.sort((left, right) => left.localeCompare(right))
		);
	});

	it('rejects a candidate retained for result-only failed evidence', async () => {
		const root = await revisionTestRoot();
		const target = targetV1();
		const candidate = await validBacking();
		await writeExecution(root, target, failedResult(target), candidate);

		await expect(validateSkillIconAssets(root)).rejects.toThrow(
			/failed result cannot retain a candidate/iu
		);
	});

	it('rejects symbolic links anywhere in a dependent inventory tree', async () => {
		const root = await revisionTestRoot();
		const base = path.join(root, 'assets/wiki/skills/icon-production-v1');
		await symlink(
			path.join(base, 'geometry.json'),
			path.join(base, 'assignments/references/linked.json')
		);

		await expect(validateSkillIconAssets(root)).rejects.toThrow(
			/Assignment tree cannot contain a symbolic link/iu
		);
	});
});
