import { createHash } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
	SkillIconCleanupManifestSchema,
	type SkillIconGeometryV2
} from '../packages/contracts/src/index.js';
import {
	QUALITY_CLEANUP_ROOT,
	buildSkillIconCleanupManifest,
	composeCleanupIcon,
	exportSkillIconQualityCleanup,
	extractLegacyInterior,
	finalizeSkillIconQualityCleanup,
	inspectCleanupComposite,
	loadCleanupManifestInput,
	type CleanupManifestInput
} from './skill-icon-quality-cleanup-lib.js';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

const syntheticGeometry: SkillIconGeometryV2 = {
	schemaVersion: 'skill-icon-geometry-v2',
	canvas: { width: 10, height: 10 },
	center: { x: 5, y: 5 },
	aperturePoints: [
		[0.5, 0],
		[0.9, 0.2],
		[0.9, 0.8],
		[0.5, 1],
		[0.1, 0.8],
		[0.1, 0.2]
	],
	outerEnvelopePoints: [
		[0.5, 0],
		[0.9, 0.2],
		[0.9, 0.8],
		[0.5, 1],
		[0.1, 0.8],
		[0.1, 0.2]
	],
	innerApertureScale: 0.78,
	subjectSafePercent: 64,
	effectSafePercent: 72,
	rarityMedallionExclusion: [
		[0.4, 0],
		[0.6, 0],
		[0.6, 0.3],
		[0.4, 0.3]
	],
	runtimeSizes: [512, 256, 128],
	recognitionSize: 96
};

async function rgbaFixture(
	background: readonly [number, number, number, number],
	pixels: readonly (readonly [number, number, number, number, number, number])[]
): Promise<Buffer> {
	const data = Buffer.alloc(10 * 10 * 4);
	for (let index = 0; index < 100; index += 1) data.set(background, index * 4);
	for (const [x, y, red, green, blue, alpha] of pixels) {
		data.set([red, green, blue, alpha], (y * 10 + x) * 4);
	}
	return sharp(data, { raw: { width: 10, height: 10, channels: 4 } })
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

async function rawRgba(bytes: Buffer): Promise<Buffer> {
	return (await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data;
}

function pixel(data: Buffer, x: number, y: number): readonly number[] {
	const offset = (y * 10 + x) * 4;
	return Array.from(data.subarray(offset, offset + 4));
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function snapshot(directory: string): Promise<readonly [string, string][]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: [string, string][] = [];
	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await snapshot(entryPath)));
		else files.push([path.relative(workspaceRoot, entryPath), sha256(await readFile(entryPath))]);
	}
	return files.sort(([left], [right]) => left.localeCompare(right));
}

function retarget(targetId: string, from: string, to: string): string {
	return targetId === from ? to : targetId;
}

function withSkewedDomain(input: CleanupManifestInput): CleanupManifestInput {
	const from = 'martial:blade:swordsmanship';
	const to = 'magical:blade:swordsmanship';
	const sourceHashesByTargetId = new Map(input.sourceHashesByTargetId);
	const sourceHash = sourceHashesByTargetId.get(from);
	if (!sourceHash) throw new Error('Expected the martial swordsmanship source hash.');
	sourceHashesByTargetId.delete(from);
	sourceHashesByTargetId.set(to, sourceHash);
	return {
		...input,
		catalog: {
			...input.catalog,
			records: input.catalog.records.map((record) => ({
				...record,
				targetId: retarget(record.targetId, from, to),
				domain: record.targetId === from ? 'Magical' : record.domain,
				primaryVisualParent: record.primaryVisualParent
					? retarget(record.primaryVisualParent, from, to)
					: null
			}))
		},
		massProductionManifest: {
			...input.massProductionManifest,
			skills: input.massProductionManifest.skills.map((record) => ({
				...record,
				targetId: retarget(record.targetId, from, to),
				domain: record.targetId === from ? 'Magical' : record.domain,
				finalImagePath:
					record.targetId === from
						? 'assets/wiki/skills/icon-production-v1/mass-production-v1/icons/magical-blade-swordsmanship.png'
						: record.finalImagePath,
				primaryVisualParent: record.primaryVisualParent
					? retarget(record.primaryVisualParent, from, to)
					: null
			}))
		},
		motifMap: {
			...input.motifMap,
			entries: input.motifMap.entries.map((entry) => ({
				...entry,
				memberTargetIds: entry.memberTargetIds.map((targetId) => retarget(targetId, from, to))
			})),
			records: input.motifMap.records.map((record) => ({
				...record,
				targetId: retarget(record.targetId, from, to),
				primaryVisualParent: record.primaryVisualParent
					? retarget(record.primaryVisualParent, from, to)
					: null
			}))
		},
		visualSpecifications: {
			...input.visualSpecifications,
			records: input.visualSpecifications.records.map((record) => ({
				...record,
				targetId: retarget(record.targetId, from, to)
			}))
		},
		sourceHashesByTargetId
	};
}

interface RaceWriter {
	readonly child: ChildProcess;
	readonly destinationWritten: Promise<void>;
}

async function startRaceWriter(
	directory: string,
	destination: string,
	bytes: Buffer
): Promise<RaceWriter> {
	const writer = spawn(
		process.execPath,
		[
			'-e',
			[
				"const fs = require('node:fs');",
				'const [directory, destination, encoded] = process.argv.slice(1);',
				'const watch = fs.watch(directory, () => {',
				"  if (!fs.readdirSync(directory).some((name) => name.includes('.stage-'))) return;",
				"  fs.writeFileSync(destination, Buffer.from(encoded, 'base64'));",
				'  watch.close();',
				"  process.stdout.write('written\\n', () => process.exit(0));",
				'});',
				"process.stdout.write('ready\\n');"
			].join('\n'),
			directory,
			destination,
			bytes.toString('base64')
		],
		{ stdio: ['ignore', 'pipe', 'inherit'] }
	);
	let output = '';
	let ready = false;
	let resolveReady: (() => void) | undefined;
	let resolveDestinationWritten: (() => void) | undefined;
	const destinationWritten = new Promise<void>((resolve) => {
		resolveDestinationWritten = resolve;
	});
	writer.stdout!.on('data', (chunk: Buffer) => {
		output += chunk.toString('utf8');
		if (!ready && output.includes('ready\n')) {
			ready = true;
			resolveReady?.();
		}
		if (output.includes('written\n')) resolveDestinationWritten?.();
	});
	await new Promise<void>((resolve) => {
		if (ready) resolve();
		else resolveReady = resolve;
	});
	return { child: writer, destinationWritten };
}

async function waitForExit(child: ChildProcess): Promise<void> {
	if (child.exitCode !== null) return;
	await once(child, 'exit');
}

describe('skill-icon quality-cleanup manifest exporter', () => {
	it('freezes every canonical mass-production source with attached findings', async () => {
		const input = await loadCleanupManifestInput(workspaceRoot);
		const manifest = SkillIconCleanupManifestSchema.parse(buildSkillIconCleanupManifest(input));

		expect(manifest.records).toHaveLength(456);
		expect(
			manifest.records.reduce<Record<string, number>>((counts, record) => {
				const domain = record.targetId.split(':', 1)[0] ?? '';
				const name = domain[0]!.toUpperCase() + domain.slice(1);
				counts[name] = (counts[name] ?? 0) + 1;
				return counts;
			}, {})
		).toEqual({ Martial: 258, Magical: 124, Craft: 74 });
		expect(new Set(manifest.records.map((record) => record.sourceCandidate.path)).size).toBe(456);
		expect(
			manifest.records.find((record) => record.targetId === 'martial:blade:one-blade-one-world')
		).toMatchObject({
			disposition: 'recompose',
			findings: [
				{
					kind: 'frame-composition',
					requiredAction: 'recompose'
				}
			]
		});
		expect(
			manifest.records.find((record) => record.targetId === 'martial:blade:blade-dance')
		).toMatchObject({
			disposition: 'revise-art',
			findings: [
				{
					kind: 'stray-ui-glyph',
					requiredAction: 'revise-art'
				}
			]
		});
		expect(
			manifest.records.find((record) => record.targetId === 'martial:blade:swordsmanship')
		).toMatchObject({ disposition: 'accepted-unchanged', findings: [] });

		for (const record of manifest.records) {
			const source = await readFile(path.resolve(workspaceRoot, record.sourceCandidate.path));
			expect(record.sourceCandidate.contentHash).toBe(sha256(source));
		}
	});

	it('reports a current inventory without writing during check mode', async () => {
		await exportSkillIconQualityCleanup({ root: workspaceRoot, mode: 'write' });
		const cleanupDirectory = path.resolve(workspaceRoot, QUALITY_CLEANUP_ROOT);
		const beforeSnapshot = await snapshot(cleanupDirectory);

		const report = await exportSkillIconQualityCleanup({ root: workspaceRoot, mode: 'check' });

		const afterSnapshot = await snapshot(cleanupDirectory);
		expect(report.counts).toEqual({ total: 456, Martial: 258, Magical: 124, Craft: 74 });
		expect(report.written).toEqual([]);
		expect(afterSnapshot).toEqual(beforeSnapshot);
	});

	it('rejects a consistently skewed 456-record authority input', async () => {
		const input = withSkewedDomain(await loadCleanupManifestInput(workspaceRoot));

		expect(() => buildSkillIconCleanupManifest(input)).toThrow(/actual domain counts/i);
	});

	it('reports output drift in check mode and refuses to replace it in write mode', async () => {
		const manifestPath = path.resolve(workspaceRoot, QUALITY_CLEANUP_ROOT, 'manifest.json');
		const original = await readFile(manifestPath);
		const drift = Buffer.from('intentionally drifted cleanup manifest\n');
		await writeFile(manifestPath, drift);
		try {
			const checked = await exportSkillIconQualityCleanup({ root: workspaceRoot, mode: 'check' });
			expect(checked.written).toEqual([]);
			expect(checked.drifted).toEqual([
				'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/manifest.json'
			]);
			await expect(
				exportSkillIconQualityCleanup({ root: workspaceRoot, mode: 'write' })
			).rejects.toThrow(/refusing to replace drifted cleanup artifact/i);
			expect(await readFile(manifestPath)).toEqual(drift);
		} finally {
			await writeFile(manifestPath, original);
		}
	});

	it('does not clobber synchronized drift that appears after the missing-file check', async () => {
		const cleanupDirectory = path.resolve(workspaceRoot, QUALITY_CLEANUP_ROOT);
		const manifestPath = path.join(cleanupDirectory, 'manifest.json');
		const original = await readFile(manifestPath);
		const drift = Buffer.from('concurrent cleanup manifest drift\n');
		await unlink(manifestPath);
		let writer: RaceWriter | null = null;
		let publicationReleased = false;
		try {
			writer = await startRaceWriter(cleanupDirectory, manifestPath, drift);
			await expect(
				exportSkillIconQualityCleanup({
					root: workspaceRoot,
					mode: 'write',
					testHooks: {
						beforePublish: async (repositoryPath: string) => {
							expect(repositoryPath).toBe(
								'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/manifest.json'
							);
							await writer!.destinationWritten;
							publicationReleased = true;
						}
					}
				})
			).rejects.toThrow(/refusing to replace drifted cleanup artifact/i);
			expect(publicationReleased).toBe(true);
			await waitForExit(writer.child);
			expect(await readFile(manifestPath)).toEqual(drift);
		} finally {
			if (writer?.child.exitCode === null) {
				writer.child.kill();
				await waitForExit(writer.child);
			}
			await writeFile(manifestPath, original);
		}
	});
});

describe('deterministic protected-aperture composition', () => {
	it('clears the frame band, medallion, and exterior using geometry-v2 pixels', async () => {
		// Catches using the broad aperture, omitting the medallion subtraction, or retaining exterior alpha.
		const source = await rgbaFixture(
			[0, 0, 0, 0],
			[
				[5, 5, 0, 255, 0, 255],
				[1, 5, 0, 255, 0, 255],
				[5, 2, 0, 255, 0, 255],
				[0, 5, 0, 255, 0, 255]
			]
		);

		const result = await extractLegacyInterior(source, syntheticGeometry);
		const data = await rawRgba(result.bytes);

		expect(pixel(data, 5, 5)).toEqual([0, 255, 0, 255]);
		expect(pixel(data, 1, 5)).toEqual([0, 0, 0, 0]);
		expect(pixel(data, 5, 2)).toEqual([0, 0, 0, 0]);
		expect(pixel(data, 0, 5)).toEqual([0, 0, 0, 0]);
		expect(result.removedPixels).toBe(3);
		expect(result.removedPixelBounds).toEqual({ left: 0, top: 2, width: 6, height: 4 });
	});

	it('keeps same-rank protected pixels byte-identical across different interiors', async () => {
		// Catches wrong layer order or interior leakage into the protected frame/medallion band.
		const backing = await rgbaFixture(
			[0, 0, 0, 0],
			[
				[5, 5, 255, 0, 0, 255],
				[1, 5, 255, 0, 0, 255],
				[5, 2, 255, 0, 0, 255]
			]
		);
		const frame = await rgbaFixture(
			[0, 0, 0, 0],
			[
				[1, 5, 0, 0, 255, 128],
				[5, 2, 0, 0, 255, 128]
			]
		);
		const first = await extractLegacyInterior(
			await rgbaFixture(
				[0, 0, 0, 0],
				[
					[5, 5, 0, 255, 0, 255],
					[1, 5, 0, 255, 0, 255],
					[5, 2, 0, 255, 0, 255]
				]
			),
			syntheticGeometry
		);
		const second = await extractLegacyInterior(
			await rgbaFixture(
				[0, 0, 0, 0],
				[
					[5, 5, 255, 255, 0, 255],
					[1, 5, 255, 255, 0, 255],
					[5, 2, 255, 255, 0, 255]
				]
			),
			syntheticGeometry
		);

		const firstComposite = await composeCleanupIcon({
			backing,
			interior: first.bytes,
			frame
		});
		const secondComposite = await composeCleanupIcon({
			backing,
			interior: second.bytes,
			frame
		});
		const firstData = await rawRgba(firstComposite);
		const secondData = await rawRgba(secondComposite);
		const firstProtected = Buffer.from(firstData);
		const secondProtected = Buffer.from(secondData);
		firstProtected.fill(0, (5 * 10 + 5) * 4, (5 * 10 + 5) * 4 + 4);
		secondProtected.fill(0, (5 * 10 + 5) * 4, (5 * 10 + 5) * 4 + 4);

		expect(pixel(firstData, 5, 5)).toEqual([0, 255, 0, 255]);
		expect(pixel(secondData, 5, 5)).toEqual([255, 255, 0, 255]);
		expect(firstProtected).toEqual(secondProtected);
		expect(pixel(firstData, 1, 5)).toEqual([126, 0, 128, 255]);
		expect(pixel(firstData, 5, 2)).toEqual([126, 0, 128, 255]);
		expect(pixel(firstData, 0, 5)).toEqual([0, 0, 0, 0]);
		expect(pixel(firstData, 1, 5)).toEqual(pixel(secondData, 1, 5));
		expect(pixel(firstData, 5, 2)).toEqual(pixel(secondData, 5, 2));
		expect(pixel(firstData, 0, 5)).toEqual(pixel(secondData, 0, 5));
	});

	it('recomputes exact bytes and reports only opaque near-white structures', async () => {
		// Catches inspections that trust declared hashes or mistake transparent checker pixels for white art.
		const backing = await rgbaFixture([0, 0, 0, 0], [[5, 5, 255, 0, 0, 255]]);
		const interior = await rgbaFixture([0, 0, 0, 0], [[5, 5, 0, 255, 0, 255]]);
		const frame = await rgbaFixture([0, 0, 0, 0], [[1, 5, 0, 0, 255, 128]]);
		const composite = await composeCleanupIcon({ backing, interior, frame });
		const boundLayerHashes = {
			backing: sha256(backing),
			interior: sha256(interior),
			frame: sha256(frame)
		};

		const clean = await inspectCleanupComposite({
			composite,
			backing,
			interior,
			frame,
			geometry: syntheticGeometry,
			boundLayerHashes
		});
		expect(clean).toMatchObject({
			layerHashesMatch: true,
			exactComposite: true,
			protectedBandMatches: true,
			nearWhiteComponents: [],
			warnings: []
		});

		const transparentChecker = await rawRgba(composite);
		transparentChecker.set([250, 250, 250, 0], 0);
		const transparentCheckerPng = await sharp(transparentChecker, {
			raw: { width: 10, height: 10, channels: 4 }
		})
			.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
			.toBuffer();
		const transparentInspection = await inspectCleanupComposite({
			composite: transparentCheckerPng,
			backing,
			interior,
			frame,
			geometry: syntheticGeometry,
			boundLayerHashes
		});
		expect(transparentInspection.nearWhiteComponents).toEqual([]);

		const opaqueWhite = await rawRgba(composite);
		opaqueWhite.set([250, 251, 252, 255], (5 * 10 + 5) * 4);
		opaqueWhite.set([249, 250, 251, 255], (5 * 10 + 6) * 4);
		const opaqueWhitePng = await sharp(opaqueWhite, {
			raw: { width: 10, height: 10, channels: 4 }
		})
			.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
			.toBuffer();
		const contaminated = await inspectCleanupComposite({
			composite: opaqueWhitePng,
			backing,
			interior,
			frame,
			geometry: syntheticGeometry,
			boundLayerHashes
		});
		expect(contaminated.exactComposite).toBe(false);
		expect(contaminated.nearWhiteComponents).toEqual([
			{ pixels: 2, bounds: { left: 5, top: 5, width: 2, height: 1 } }
		]);
		expect(contaminated.warnings).toHaveLength(1);
	});

	it('reports missing canonical layers without writing partial finalization output', async () => {
		// Catches a finalizer that begins mutating composites before all eight shared layers exist.
		const root = await mkdtemp(path.join(tmpdir(), 'summonlab-cleanup-finalizer-'));
		try {
			const manifestDirectory = path.join(root, QUALITY_CLEANUP_ROOT);
			await mkdir(manifestDirectory, { recursive: true });
			await writeFile(
				path.join(manifestDirectory, 'manifest.json'),
				await readFile(path.join(workspaceRoot, QUALITY_CLEANUP_ROOT, 'manifest.json'))
			);

			const report = await finalizeSkillIconQualityCleanup({ root, mode: 'write' });

			expect(report.ready).toBe(false);
			expect(report.pendingLayerJobIds).toEqual([
				'charcoal-forged-stone-v5',
				'rarity-frame-f-v5',
				'rarity-frame-e-v5',
				'rarity-frame-d-v5',
				'rarity-frame-c-v5',
				'rarity-frame-b-v5',
				'rarity-frame-a-v5',
				'rarity-frame-s-v5'
			]);
			expect(report.written).toEqual([]);
			expect(await readdir(manifestDirectory)).toEqual(['manifest.json']);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
