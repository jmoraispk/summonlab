import { createHash } from 'node:crypto';
import {
	access,
	copyFile,
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
	composeSkillHex,
	exportSkillIconRuntime,
	exportSkillRuntimeSet,
	formatSkillReviewLabel,
	parseSkillIconRuntimeCli,
	renderSkillContactSheet,
	renderSkillReviewCard,
	runSkillIconRuntimeCli,
	SKILL_ICON_PILOT_CONTACT_SHEET_PATH,
	SKILL_ICON_PILOT_TARGET_IDS,
	SKILL_ICON_REFERENCE_CONTACT_SHEET_PATH
} from './compose-skill-icon-assets.js';
import {
	SKILL_ICON_MOTIF_MAP_PATH,
	SKILL_ICON_MOTIF_SOURCE_PATH,
	SKILL_ICON_VISUAL_SPECS_PATH,
	exportSkillIconProduction
} from './export-skill-icon-production.js';
import { CANONICAL_SKILL_SOURCE_PATHS } from './skill-icon-production-lib.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true }))));

async function pngLayer(
	color: readonly [number, number, number],
	visible: (x: number, y: number) => boolean
): Promise<Buffer> {
	const pixels = Buffer.alloc(1024 * 1024 * 4);
	for (let y = 0; y < 1024; y += 1) {
		for (let x = 0; x < 1024; x += 1) {
			const offset = (y * 1024 + x) * 4;
			pixels[offset] = color[0];
			pixels[offset + 1] = color[1];
			pixels[offset + 2] = color[2];
			pixels[offset + 3] = visible(x, y) ? 255 : 0;
		}
	}
	return sharp(pixels, { raw: { width: 1024, height: 1024, channels: 4 } })
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

async function layerFixture() {
	const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-compose-'));
	roots.push(root);
	const backingPath = path.join(root, 'backing.png');
	const artPath = path.join(root, 'art.png');
	const framePath = path.join(root, 'frame.png');
	const backing = await pngLayer([255, 0, 0], (x, y) => x >= 100 || y >= 100);
	const art = await pngLayer([0, 255, 0], (x, y) => x >= 400 && x < 624 && y >= 400 && y < 624);
	const frame = await pngLayer([0, 0, 255], (x) => x < 96);
	await Promise.all([
		writeFile(backingPath, backing),
		writeFile(artPath, art),
		writeFile(framePath, frame)
	]);
	return { root, backingPath, artPath, framePath, backing, art, frame };
}

const aperturePoints = [
	[512, 80],
	[904, 304],
	[904, 720],
	[512, 944],
	[120, 720],
	[120, 304]
] as const;

function inPolygon(x: number, y: number, points: readonly (readonly [number, number])[]): boolean {
	let inside = false;
	for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
		const [xi, yi] = points[index]!;
		const [xj, yj] = points[previous]!;
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

async function validBacking(color: readonly [number, number, number]): Promise<Buffer> {
	return pngLayer(color, (x, y) => inPolygon(x + 0.5, y + 0.5, aperturePoints));
}

async function validFrame(color: readonly [number, number, number]): Promise<Buffer> {
	const inner = aperturePoints.map(
		([x, y]) => [512 + (x - 512) * 0.86, 512 + (y - 512) * 0.86] as const
	);
	return pngLayer(
		color,
		(x, y) => inPolygon(x + 0.5, y + 0.5, aperturePoints) && !inPolygon(x + 0.5, y + 0.5, inner)
	);
}

async function validArt(color: string): Promise<Buffer> {
	return sharp(
		Buffer.from(
			`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><circle cx="512" cy="560" r="220" fill="${color}"/></svg>`
		)
	)
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

interface CandidatePacket {
	readonly jobId: string;
	readonly role: 'backing' | 'rarity-frame' | 'skill-art';
	readonly rarity: 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | null;
	readonly targetId: string | null;
	readonly candidatePath: string;
	readonly resultPath: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly bytes: Buffer;
	readonly contentHash: string;
	readonly resultBytes: Buffer;
}

async function installCandidatePacket(
	root: string,
	input: {
		readonly jobId: string;
		readonly role: CandidatePacket['role'];
		readonly bytes: Buffer;
		readonly rarity?: Exclude<CandidatePacket['rarity'], null>;
		readonly targetId?: string;
	}
): Promise<CandidatePacket> {
	const scope = input.role === 'skill-art' ? 'icons' : 'references';
	const candidatePath = `assets/wiki/skills/icon-production-v1/candidates/${scope}/${input.jobId}.png`;
	const resultPath = `assets/wiki/skills/icon-production-v1/results/${scope}/${input.jobId}.json`;
	const targetPath = `assets/wiki/skills/icon-production-v1/targets/${scope}/${input.jobId}.json`;
	const assignmentPath = `assets/wiki/skills/icon-production-v1/assignments/${scope}/${input.jobId}.json`;
	const contentHash = createHash('sha256').update(input.bytes).digest('hex');
	const exactPrompt = `Paint ${input.jobId}.`;
	const target = {
		schemaVersion: 'skill-icon-target-v1',
		jobId: input.jobId,
		role: input.role,
		skillTargetId: input.targetId ?? null,
		motifFamily: null,
		rarity: input.rarity ?? null,
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
		assignmentId: `assignment-${input.jobId}`,
		jobId: input.jobId,
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
		resultId: `result-${input.jobId}`,
		jobId: input.jobId,
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
			bytes: input.bytes.byteLength,
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
	for (const [relativePath, value] of [
		[candidatePath, input.bytes],
		[targetPath, JSON.stringify(target)],
		[assignmentPath, JSON.stringify(assignment)],
		[resultPath, resultBytes]
	] as const) {
		await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
		await writeFile(path.join(root, relativePath), value);
	}
	return {
		jobId: input.jobId,
		role: input.role,
		rarity: input.rarity ?? null,
		targetId: input.targetId ?? null,
		candidatePath,
		resultPath,
		targetPath,
		assignmentPath,
		bytes: input.bytes,
		contentHash,
		resultBytes
	};
}

async function installAcceptedReference(
	root: string,
	packet: CandidatePacket,
	masterPath: string
): Promise<void> {
	const reviewPath = `assets/wiki/skills/icon-production-v1/review/decisions/references/${packet.jobId}.json`;
	const review = {
		schemaVersion: 'skill-icon-review-v1',
		reviewId: `review-${packet.jobId}`,
		jobId: packet.jobId,
		role: packet.role,
		skillTargetId: null,
		candidatePath: packet.candidatePath,
		candidateHash: packet.contentHash,
		reviewer: 'Skills visual owner',
		reviewerRole: 'owner',
		decision: 'accepted',
		rationale: 'Accepted authority.',
		findings: [{ criterion: 'geometry', outcome: 'pass', observation: 'Valid.' }],
		reviewedAt: '2026-09-02T10:00:00.000Z'
	};
	const reviewBytes = Buffer.from(JSON.stringify(review));
	const receiptPath = `assets/wiki/skills/icon-production-v1/promotion-receipts/${packet.jobId}.json`;
	const receipt = {
		schemaVersion: 'skill-icon-promotion-receipt-v1',
		transactionId: '11111111-1111-4111-8111-111111111111',
		jobId: packet.jobId,
		role: packet.role,
		ownerReviewer: review.reviewer,
		review: {
			path: reviewPath,
			contentHash: createHash('sha256').update(reviewBytes).digest('hex')
		},
		result: {
			path: packet.resultPath,
			contentHash: createHash('sha256').update(packet.resultBytes).digest('hex')
		},
		candidate: { path: packet.candidatePath, contentHash: packet.contentHash },
		master: { path: masterPath, contentHash: packet.contentHash }
	};
	for (const [relativePath, value] of [
		[masterPath, packet.bytes],
		[reviewPath, reviewBytes],
		[receiptPath, JSON.stringify(receipt)]
	] as const) {
		await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
		await writeFile(path.join(root, relativePath), value);
	}
}

async function productionFixtureRoot(): Promise<string> {
	const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-production-'));
	roots.push(root);
	for (const relativePath of [
		...CANONICAL_SKILL_SOURCE_PATHS,
		SKILL_ICON_MOTIF_SOURCE_PATH,
		SKILL_ICON_MOTIF_MAP_PATH,
		SKILL_ICON_VISUAL_SPECS_PATH,
		'assets/wiki/skills/icon-production-v1/geometry.json',
		'assets/wiki/skills/icon-production-v1/catalog.json'
	]) {
		await mkdir(path.dirname(path.join(root, relativePath)), { recursive: true });
		await copyFile(path.resolve(relativePath), path.join(root, relativePath));
	}
	return root;
}

async function installReferencePackets(root: string, accepted: boolean): Promise<void> {
	const backingPacket = await installCandidatePacket(root, {
		jobId: 'charcoal-forged-stone-v1',
		role: 'backing',
		bytes: await validBacking([45, 48, 55])
	});
	if (accepted) {
		await installAcceptedReference(
			root,
			backingPacket,
			'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
		);
	}
	const frame = await validFrame([40, 90, 210]);
	for (const rarity of ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const) {
		const packet = await installCandidatePacket(root, {
			jobId: `rarity-frame-${rarity.toLowerCase()}-v1`,
			role: 'rarity-frame',
			rarity,
			bytes: frame
		});
		if (accepted) {
			await installAcceptedReference(
				root,
				packet,
				`assets/wiki/skills/icon-production-v1/masters/frames/${rarity.toLowerCase()}.png`
			);
		}
	}
}

async function installPilotCandidates(
	root: string,
	revisions: ReadonlyMap<string, number> = new Map()
): Promise<void> {
	const visualPath = path.join(root, SKILL_ICON_VISUAL_SPECS_PATH);
	const visual = JSON.parse(await readFile(visualPath, 'utf8')) as {
		schemaVersion: string;
		records: Record<string, unknown>[];
	};
	const arts = new Map<number, Buffer>([
		[1, await validArt('#ef4444')],
		[2, await validArt('#3b82f6')]
	]);
	const replacements = new Map<string, Record<string, unknown>>();
	for (const targetId of SKILL_ICON_PILOT_TARGET_IDS) {
		const slug = targetId.replaceAll(':', '-');
		const revision = revisions.get(targetId) ?? 1;
		const art = arts.get(revision) ?? (await validArt('#a855f7'));
		const packet = await installCandidatePacket(root, {
			jobId: `${slug}-v${revision}`,
			role: 'skill-art',
			targetId,
			bytes: art
		});
		const result = JSON.parse(packet.resultBytes.toString('utf8')) as {
			output: Record<string, unknown>;
			findings: readonly Record<string, unknown>[];
		};
		replacements.set(targetId, {
			status: 'candidate',
			visualSpec: {
				dominantSubject: 'One painted emblem',
				supportingCue: null,
				semanticPalette: ['ember red'],
				composition: 'Centered emblem',
				exclusions: ['No text']
			},
			producerResult: {
				jobId: packet.jobId,
				status: 'candidate',
				path: packet.resultPath,
				contentHash: createHash('sha256').update(packet.resultBytes).digest('hex'),
				findings: result.findings
			},
			assets: { candidate: result.output },
			review: null
		});
	}
	visual.records = visual.records.map((record) => {
		const targetId = record.targetId as string;
		return replacements.has(targetId) ? { ...record, ...replacements.get(targetId)! } : record;
	});
	await writeFile(visualPath, `${JSON.stringify(visual, null, '\t')}\n`);
	await exportSkillIconProduction({ root, mode: 'write' });
}

async function pixelAt(image: Buffer, x: number, y: number): Promise<number[]> {
	const { data, info } = await sharp(image)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const offset = (y * info.width + x) * info.channels;
	return [...data.subarray(offset, offset + 4)];
}

describe('composeSkillHex', () => {
	it('composites backing, art, then frame in that exact order', async () => {
		const item = await layerFixture();
		const composite = await composeSkillHex(item);

		expect(await pixelAt(composite, 700, 512)).toEqual([255, 0, 0, 255]);
		expect(await pixelAt(composite, 512, 512)).toEqual([0, 255, 0, 255]);
		expect(await pixelAt(composite, 48, 512)).toEqual([0, 0, 255, 255]);
	});
});

describe('exportSkillRuntimeSet', () => {
	it('fails closed instead of opening a standalone derivative-write race', async () => {
		const root = await productionFixtureRoot();
		await installReferencePackets(root, true);
		const artPath =
			'assets/wiki/skills/icon-production-v1/masters/icons/martial-blade-swordsmanship.png';
		const art = await validArt('#22c55e');
		await mkdir(path.dirname(path.join(root, artPath)), { recursive: true });
		await writeFile(path.join(root, artPath), art);
		const before = await readFile(path.join(root, artPath));
		await expect(
			exportSkillRuntimeSet(
				{
					targetId: 'martial:blade:swordsmanship',
					rarity: 'F',
					assets: { approvedMaster: { path: artPath } }
				},
				root
			)
		).rejects.toThrow(/standalone derivative writes are disabled|coordinator transaction/iu);
		expect(await readFile(path.join(root, artPath))).toEqual(before);
		await expect(
			access(path.join(root, 'apps/web/static/skill-icons/v1/512/martial-blade-swordsmanship.webp'))
		).rejects.toMatchObject({ code: 'ENOENT' });
	}, 30_000);

	it('rejects a swapped derivative ancestor without writing through it', async () => {
		const root = await productionFixtureRoot();
		await installReferencePackets(root, true);
		const artPath =
			'assets/wiki/skills/icon-production-v1/masters/icons/martial-blade-swordsmanship.png';
		await mkdir(path.dirname(path.join(root, artPath)), { recursive: true });
		await writeFile(path.join(root, artPath), await validArt('#22c55e'));
		const outside = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-outside-'));
		roots.push(outside);
		const runtimeRoot = path.join(root, 'apps/web/static/skill-icons/v1');
		await mkdir(runtimeRoot, { recursive: true });
		await symlink(outside, path.join(runtimeRoot, '512'));
		await expect(
			exportSkillRuntimeSet(
				{
					targetId: 'martial:blade:swordsmanship',
					rarity: 'F',
					assets: { approvedMaster: { path: artPath } }
				},
				root
			)
		).rejects.toThrow(/symbolic link/iu);
		expect(await readdir(outside)).toEqual([]);
	}, 30_000);
});

describe('review evidence rendering', () => {
	it('formats exact mastery/level text and renders it below the hex raster', async () => {
		const item = await layerFixture();
		const composite = await sharp(await composeSkillHex(item))
			.resize(512, 512)
			.png()
			.toBuffer();
		expect(formatSkillReviewLabel('Intermediate', 7)).toBe('INTERMEDIATE · LV 7');
		const card = await renderSkillReviewCard({
			composite,
			name: 'Swordsmanship <script>alert(1)</script>',
			mastery: 'Intermediate',
			level: 7,
			rarity: 'F'
		});
		const metadata = await sharp(card).metadata();
		expect(metadata.width).toBe(640);
		expect(metadata.height).toBeGreaterThan(512);
		const raster = await sharp(card)
			.extract({ left: 64, top: 0, width: 512, height: 512 })
			.png()
			.toBuffer();
		expect(await sharp(raster).raw().toBuffer()).toEqual(await sharp(composite).raw().toBuffer());
	});

	it('rejects non-integer or out-of-range levels', async () => {
		const composite = await sharp({
			create: { width: 512, height: 512, channels: 4, background: '#00000000' }
		})
			.png()
			.toBuffer();
		for (const level of [0, 11, 1.5]) {
			await expect(
				renderSkillReviewCard({
					composite,
					name: 'Swordsmanship',
					mastery: 'Intermediate',
					level,
					rarity: 'F'
				})
			).rejects.toThrow(/level/iu);
		}
	});

	it('fits escaped contract-length and multiline names inside defined horizontal margins', async () => {
		const composite = await sharp({
			create: { width: 512, height: 512, channels: 4, background: '#00000000' }
		})
			.png()
			.toBuffer();
		const card = await renderSkillReviewCard({
			composite,
			name: `${'W'.repeat(70)} <&"'>\n${'W'.repeat(82)}`,
			mastery: 'Intermediate',
			level: 7,
			rarity: 'F'
		});
		const baseline = await renderSkillReviewCard({
			composite,
			name: 'Swordsmanship',
			mastery: 'Intermediate',
			level: 7,
			rarity: 'F'
		});
		const [{ data, info }, baselineData] = await Promise.all([
			sharp(card)
				.extract({ left: 0, top: 512, width: 640, height: 160 })
				.ensureAlpha()
				.raw()
				.toBuffer({ resolveWithObject: true }),
			sharp(baseline)
				.extract({ left: 0, top: 512, width: 640, height: 160 })
				.ensureAlpha()
				.raw()
				.toBuffer()
		]);
		for (let y = 0; y < 104; y += 1) {
			for (const x of [
				...Array.from({ length: 64 }, (_, index) => index),
				...Array.from({ length: 64 }, (_, index) => 576 + index)
			]) {
				const offset = (y * info.width + x) * info.channels;
				expect([...data.subarray(offset, offset + 4)]).toEqual([
					...baselineData.subarray(offset, offset + 4)
				]);
			}
		}
		const widths = await Promise.all(
			[
				'W'.repeat(33),
				'W'.repeat(34),
				`${'W'.repeat(40)} ${'i'.repeat(80)}`,
				'unbroken'.repeat(20)
			].map((name) =>
				renderSkillReviewCard({
					composite,
					name,
					mastery: 'Intermediate',
					level: 7,
					rarity: 'F'
				})
			)
		);
		expect(
			new Set(widths.map((bytes) => createHash('sha256').update(bytes).digest('hex'))).size
		).toBe(4);
		expect(
			await renderSkillReviewCard({
				composite,
				name: 'Swordsmanship',
				mastery: 'Intermediate',
				level: 7,
				rarity: 'F'
			})
		).toEqual(baseline);
		const normalNamePixels: { x: number; y: number }[] = [];
		for (let y = 0; y < 104; y += 1) {
			for (let x = 0; x < info.width; x += 1) {
				const offset = (y * info.width + x) * info.channels;
				if (baselineData[offset]! > 100) normalNamePixels.push({ x, y });
			}
		}
		const normalWidth =
			Math.max(...normalNamePixels.map(({ x }) => x)) -
			Math.min(...normalNamePixels.map(({ x }) => x)) +
			1;
		const normalHeight =
			Math.max(...normalNamePixels.map(({ y }) => y)) -
			Math.min(...normalNamePixels.map(({ y }) => y)) +
			1;
		expect(normalWidth).toBeGreaterThan(200);
		expect(normalHeight).toBeGreaterThan(20);
	}, 30_000);

	it('renders deterministic contact sheets from cards', async () => {
		const composite = await sharp({
			create: { width: 512, height: 512, channels: 4, background: '#334155ff' }
		})
			.png()
			.toBuffer();
		const card = await renderSkillReviewCard({
			composite,
			name: 'Swordsmanship',
			mastery: 'Intermediate',
			level: 7,
			rarity: 'F'
		});
		const first = await renderSkillContactSheet([card, card]);
		const second = await renderSkillContactSheet([card, card]);
		expect(first).toEqual(second);
		expect(await sharp(first).metadata()).toMatchObject({ format: 'png', hasAlpha: true });
	}, 30_000);
});

describe('skill icon runtime CLI grammar', () => {
	it('accepts one standalone separator and rejects duplicates, unknowns, and mixed modes', () => {
		expect(parseSkillIconRuntimeCli(['--write', '--', '--scope', 'pilot'])).toEqual({
			mode: 'write',
			scope: 'pilot'
		});
		expect(parseSkillIconRuntimeCli(['--', '--check', '--scope', 'references'])).toEqual({
			mode: 'check',
			scope: 'references'
		});
		for (const args of [
			['--write', '--check'],
			['--write', '--', '--', '--scope', 'pilot'],
			['--write', '--scope', 'pilot', '--scope', 'all'],
			['--write', '--unknown']
		]) {
			expect(() => parseSkillIconRuntimeCli(args)).toThrow();
		}
	});
});

describe('scoped contact-sheet export', () => {
	it('writes and checks the eight pre-promotion reference candidates at equal scale', async () => {
		const root = await productionFixtureRoot();
		await installReferencePackets(root, false);
		const before = await exportSkillIconRuntime({ root, mode: 'check', scope: 'references' });
		expect(before).toMatchObject({ inSync: false, written: false });
		await expect(
			access(path.join(root, SKILL_ICON_REFERENCE_CONTACT_SHEET_PATH))
		).rejects.toMatchObject({ code: 'ENOENT' });
		const written = await runSkillIconRuntimeCli(['--write', '--', '--scope', 'references'], {
			root
		});
		expect(written).toMatchObject({
			inSync: true,
			written: true,
			contactSheet: {
				path: SKILL_ICON_REFERENCE_CONTACT_SHEET_PATH,
				current: true,
				itemCount: 8
			}
		});
		const sheet = await readFile(path.join(root, SKILL_ICON_REFERENCE_CONTACT_SHEET_PATH));
		expect(await sharp(sheet).metadata()).toMatchObject({
			format: 'png',
			width: 1560,
			height: 872,
			hasAlpha: true
		});
		for (let index = 0; index < 8; index += 1) {
			const x = 24 + (index % 4) * 384 + 180;
			const y = 24 + Math.floor(index / 4) * 424 + 360;
			expect((await pixelAt(sheet, x, y))[3]).toBeGreaterThan(0);
		}
		const checked = await exportSkillIconRuntime({ root, mode: 'check', scope: 'references' });
		expect(checked).toMatchObject({ inSync: true, written: false });
	}, 30_000);

	it('selects the highest complete reference revisions and preserves older review evidence', async () => {
		const root = await productionFixtureRoot();
		await installReferencePackets(root, false);
		await exportSkillIconRuntime({ root, mode: 'write', scope: 'references' });
		const firstBytes = await readFile(path.join(root, SKILL_ICON_REFERENCE_CONTACT_SHEET_PATH));
		const rejectedPath =
			'assets/wiki/skills/icon-production-v1/review/decisions/references/charcoal-forged-stone-v1.json';
		await mkdir(path.dirname(path.join(root, rejectedPath)), { recursive: true });
		await writeFile(path.join(root, rejectedPath), 'rejected-v1-evidence');
		await installCandidatePacket(root, {
			jobId: 'charcoal-forged-stone-v2',
			role: 'backing',
			bytes: await validBacking([65, 68, 75])
		});
		const second = await exportSkillIconRuntime({ root, mode: 'write', scope: 'references' });
		expect(second.contactSheet?.path).toBe(
			'assets/wiki/skills/icon-production-v1/review/reference-assets-v2.png'
		);
		expect(await readFile(path.join(root, SKILL_ICON_REFERENCE_CONTACT_SHEET_PATH))).toEqual(
			firstBytes
		);
		expect(await readFile(path.join(root, rejectedPath), 'utf8')).toBe('rejected-v1-evidence');
		await installCandidatePacket(root, {
			jobId: 'rarity-frame-e-v2',
			role: 'rarity-frame',
			rarity: 'E',
			bytes: await validFrame([120, 145, 245])
		});
		const pendingThird = await exportSkillIconRuntime({
			root,
			mode: 'check',
			scope: 'references'
		});
		expect(pendingThird.contactSheet?.path).toBe(
			'assets/wiki/skills/icon-production-v1/review/reference-assets-v3.png'
		);
		expect(pendingThird.inSync).toBe(false);
		const third = await exportSkillIconRuntime({ root, mode: 'write', scope: 'references' });
		expect(third.contactSheet?.path).toBe(
			'assets/wiki/skills/icon-production-v1/review/reference-assets-v3.png'
		);
		const unchanged = await exportSkillIconRuntime({ root, mode: 'write', scope: 'references' });
		expect(unchanged).toMatchObject({ written: false, inSync: true });
		expect(unchanged.contactSheet?.path).toBe(third.contactSheet?.path);
		const checked = await exportSkillIconRuntime({ root, mode: 'check', scope: 'references' });
		expect(checked).toMatchObject({ inSync: true, orphanPaths: [], drift: [] });
	}, 30_000);

	it('allocates after the highest historical sheet gap and rejects malformed review collisions', async () => {
		const root = await productionFixtureRoot();
		await installReferencePackets(root, false);
		const review = path.join(root, 'assets/wiki/skills/icon-production-v1/review');
		await mkdir(review, { recursive: true });
		await writeFile(path.join(review, 'reference-assets-v4.png'), await validArt('#0f172a'));
		const gap = await exportSkillIconRuntime({ root, mode: 'check', scope: 'references' });
		expect(gap.contactSheet?.path).toBe(
			'assets/wiki/skills/icon-production-v1/review/reference-assets-v5.png'
		);
		await writeFile(path.join(review, 'reference-assets-v05.png'), 'collision');
		await expect(
			exportSkillIconRuntime({ root, mode: 'check', scope: 'references' })
		).rejects.toThrow(/malformed|colliding.*reference-assets/iu);
		await rm(path.join(review, 'reference-assets-v05.png'));
		await symlink('reference-assets-v4.png', path.join(review, 'reference-assets-v6.png'));
		await expect(
			exportSkillIconRuntime({ root, mode: 'check', scope: 'references' })
		).rejects.toThrow(/malformed|colliding.*reference-assets/iu);
	}, 30_000);

	it('rejects incomplete and duplicate highest reference revisions without falling back', async () => {
		const root = await productionFixtureRoot();
		await installReferencePackets(root, false);
		const incomplete = await installCandidatePacket(root, {
			jobId: 'rarity-frame-f-v2',
			role: 'rarity-frame',
			rarity: 'F',
			bytes: await validFrame([80, 100, 220])
		});
		await rm(path.join(root, incomplete.assignmentPath));
		await expect(
			exportSkillIconRuntime({ root, mode: 'check', scope: 'references' })
		).rejects.toThrow(/rarity-frame-f-v2.*assignment|assignment.*rarity-frame-f-v2/iu);
		await writeFile(
			path.join(root, incomplete.assignmentPath),
			await readFile(
				path.join(
					root,
					'assets/wiki/skills/icon-production-v1/assignments/references/rarity-frame-f-v1.json'
				)
			)
		);
		await expect(
			exportSkillIconRuntime({ root, mode: 'check', scope: 'references' })
		).rejects.toThrow(/execution|assignment|job/iu);
		await installCandidatePacket(root, {
			jobId: 'rarity-frame-f-v2',
			role: 'rarity-frame',
			rarity: 'F',
			bytes: incomplete.bytes
		});
		await installCandidatePacket(root, {
			jobId: 'alternate-frame-f-v2',
			role: 'rarity-frame',
			rarity: 'F',
			bytes: await validFrame([100, 120, 240])
		});
		await expect(
			exportSkillIconRuntime({ root, mode: 'check', scope: 'references' })
		).rejects.toThrow(/duplicate.*rarity-frame:F.*v2/iu);
	}, 30_000);

	it('reports every missing reference role instead of treating an empty scope as current', async () => {
		const root = await productionFixtureRoot();
		await expect(
			exportSkillIconRuntime({ root, mode: 'check', scope: 'references' })
		).rejects.toThrow(/rarity-frame:F.*rarity-frame:S.*backing/iu);
	});

	it('renders the exact fifteen pre-approval pilot candidates into review cards', async () => {
		const root = await productionFixtureRoot();
		await installReferencePackets(root, true);
		await installPilotCandidates(root);
		const written = await exportSkillIconRuntime({ root, mode: 'write', scope: 'pilot' });
		expect(written).toMatchObject({
			inSync: true,
			written: true,
			contactSheet: {
				path: SKILL_ICON_PILOT_CONTACT_SHEET_PATH,
				current: true,
				itemCount: 15
			}
		});
		const sheet = await readFile(path.join(root, SKILL_ICON_PILOT_CONTACT_SHEET_PATH));
		expect(await sharp(sheet).metadata()).toMatchObject({
			format: 'png',
			width: 2680,
			height: 2808,
			hasAlpha: true
		});
		for (let index = 0; index < 15; index += 1) {
			const x = 24 + (index % 4) * 664 + 320;
			const y = 24 + Math.floor(index / 4) * 696 + 280;
			expect((await pixelAt(sheet, x, y))[3]).toBeGreaterThan(0);
		}
	}, 90_000);

	it('rejects structurally valid but stale canonical pilot metadata', async () => {
		const root = await productionFixtureRoot();
		await installReferencePackets(root, true);
		await installPilotCandidates(root);
		const catalogPath = path.join(root, 'assets/wiki/skills/icon-production-v1/catalog.json');
		const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as {
			records: { targetId: string; name: string; rarity: string }[];
		};
		const record = catalog.records.find(
			(item) => item.targetId === SKILL_ICON_PILOT_TARGET_IDS[0]
		)!;
		record.name = 'Wrong Canonical Name';
		record.rarity = record.rarity === 'F' ? 'E' : 'F';
		await writeFile(catalogPath, `${JSON.stringify(catalog, null, '\t')}\n`);
		await expect(exportSkillIconRuntime({ root, mode: 'check', scope: 'pilot' })).rejects.toThrow(
			/catalog.*stale|canonical.*catalog|not current/iu
		);
	}, 90_000);

	it('rejects incomplete and duplicate highest pilot target revisions without fallback', async () => {
		const root = await productionFixtureRoot();
		await installReferencePackets(root, true);
		await installPilotCandidates(root);
		const targetId = SKILL_ICON_PILOT_TARGET_IDS[0];
		const packet = await installCandidatePacket(root, {
			jobId: `${targetId.replaceAll(':', '-')}-v2`,
			role: 'skill-art',
			targetId,
			bytes: await validArt('#fb7185')
		});
		await rm(path.join(root, packet.assignmentPath));
		await expect(exportSkillIconRuntime({ root, mode: 'check', scope: 'pilot' })).rejects.toThrow(
			/v2.*assignment|assignment.*v2/iu
		);
		await installCandidatePacket(root, {
			jobId: packet.jobId,
			role: 'skill-art',
			targetId,
			bytes: packet.bytes
		});
		await installCandidatePacket(root, {
			jobId: 'alternate-horizontal-slash-v2',
			role: 'skill-art',
			targetId,
			bytes: packet.bytes
		});
		await expect(exportSkillIconRuntime({ root, mode: 'check', scope: 'pilot' })).rejects.toThrow(
			/duplicate.*horizontal-slash.*v2/iu
		);
	}, 90_000);

	it('advances pilot sheet revisions while preserving rejected and older evidence', async () => {
		const root = await productionFixtureRoot();
		await installReferencePackets(root, true);
		await installPilotCandidates(root);
		await exportSkillIconRuntime({ root, mode: 'write', scope: 'pilot' });
		const firstBytes = await readFile(path.join(root, SKILL_ICON_PILOT_CONTACT_SHEET_PATH));
		const revisedTarget = SKILL_ICON_PILOT_TARGET_IDS[0];
		const v1Review = `assets/wiki/skills/icon-production-v1/review/decisions/icons/${revisedTarget.replaceAll(':', '-')}-v1.json`;
		await mkdir(path.dirname(path.join(root, v1Review)), { recursive: true });
		await writeFile(path.join(root, v1Review), 'rejected-pilot-v1');
		await installPilotCandidates(root, new Map([[revisedTarget, 2]]));
		const second = await exportSkillIconRuntime({ root, mode: 'write', scope: 'pilot' });
		expect(second.contactSheet?.path).toBe(
			'assets/wiki/skills/icon-production-v1/review/pilot-icons-v2.png'
		);
		expect(await readFile(path.join(root, SKILL_ICON_PILOT_CONTACT_SHEET_PATH))).toEqual(
			firstBytes
		);
		expect(await readFile(path.join(root, v1Review), 'utf8')).toBe('rejected-pilot-v1');
		const secondRevisedTarget = SKILL_ICON_PILOT_TARGET_IDS[1];
		await installPilotCandidates(
			root,
			new Map([
				[revisedTarget, 2],
				[secondRevisedTarget, 2]
			])
		);
		const third = await exportSkillIconRuntime({ root, mode: 'write', scope: 'pilot' });
		expect(third.contactSheet?.path).toBe(
			'assets/wiki/skills/icon-production-v1/review/pilot-icons-v3.png'
		);
		const unchanged = await exportSkillIconRuntime({ root, mode: 'write', scope: 'pilot' });
		expect(unchanged).toMatchObject({ written: false, inSync: true });
		expect(unchanged.contactSheet?.path).toBe(third.contactSheet?.path);
		const checked = await exportSkillIconRuntime({ root, mode: 'check', scope: 'pilot' });
		expect(checked).toMatchObject({ inSync: true, orphanPaths: [], drift: [] });
	}, 120_000);

	it('binds final publication to the opened review directory across a transient swap', async () => {
		const root = await productionFixtureRoot();
		await installReferencePackets(root, false);
		const outside = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-contact-transient-'));
		roots.push(outside);
		await writeFile(path.join(outside, 'victim'), 'untouched');
		const review = path.join(root, 'assets/wiki/skills/icon-production-v1/review');
		const retained = `${review}.retained`;
		const written = await exportSkillIconRuntime({
			root,
			mode: 'write',
			scope: 'references',
			testHooks: {
				beforeContactSheetFinalLink: async () => {
					await rename(review, retained);
					await symlink(outside, review);
				},
				afterContactSheetFinalLink: async () => {
					await rm(review);
					await rename(retained, review);
				}
			}
		});
		expect(written).toMatchObject({ written: true, inSync: true });
		expect(await readFile(path.join(outside, 'victim'), 'utf8')).toBe('untouched');
		expect(await readdir(outside)).toEqual(['victim']);
		await access(path.join(root, SKILL_ICON_REFERENCE_CONTACT_SHEET_PATH));
	}, 30_000);

	it('serializes concurrent writers so identical evidence owns one revision', async () => {
		const root = await productionFixtureRoot();
		await installReferencePackets(root, false);
		const reports = await Promise.all([
			exportSkillIconRuntime({ root, mode: 'write', scope: 'references' }),
			exportSkillIconRuntime({ root, mode: 'write', scope: 'references' })
		]);
		expect(reports.map(({ written }) => written).sort()).toEqual([false, true]);
		expect(new Set(reports.map(({ contactSheet }) => contactSheet?.path))).toEqual(
			new Set([SKILL_ICON_REFERENCE_CONTACT_SHEET_PATH])
		);
	}, 30_000);

	it('fails closed on contact-sheet ancestor replacement without writing outside authority', async () => {
		const root = await productionFixtureRoot();
		await installReferencePackets(root, false);
		const outside = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-contact-outside-'));
		roots.push(outside);
		const review = path.join(root, 'assets/wiki/skills/icon-production-v1/review');
		const retained = `${review}.retained`;
		await expect(
			exportSkillIconRuntime({
				root,
				mode: 'write',
				scope: 'references',
				testHooks: {
					beforeContactSheetPublish: async () => {
						await rename(review, retained);
						await symlink(outside, review);
					}
				}
			})
		).rejects.toThrow(/parent.*changed|symbolic link|unsafe/iu);
		expect(await readdir(outside)).toEqual([]);
		expect(
			(await readdir(path.join(root, 'assets/wiki/skills/icon-production-v1'))).filter((name) =>
				name.includes('contact-sheet-staging')
			)
		).toEqual([]);
	}, 30_000);
});
