import { createHash } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import {
	copyFile,
	link,
	mkdtemp,
	mkdir,
	readdir,
	readFile,
	rm,
	symlink,
	unlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
	SkillIconCleanupManifestSchema,
	SkillIconCleanupResultSchema,
	type SkillIconGeometryV2
} from '../packages/contracts/src/index.js';
import {
	QUALITY_CLEANUP_ROOT,
	buildSkillIconCleanupManifest,
	cleanupSlug,
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

async function sparseRgbaFixture(
	width: number,
	height: number,
	pixels: readonly (readonly [number, number, number, number, number, number])[]
): Promise<Buffer> {
	const data = Buffer.alloc(width * height * 4);
	for (const [x, y, red, green, blue, alpha] of pixels) {
		data.set([red, green, blue, alpha], (y * width + x) * 4);
	}
	return sharp(data, { raw: { width, height, channels: 4 } })
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

const cleanupLayerJobs = [
	['charcoal-forged-stone-v6', 'backing', null],
	['rarity-frame-f-v9', 'rarity-frame', 'F'],
	['rarity-frame-e-v9', 'rarity-frame', 'E'],
	['rarity-frame-d-v9', 'rarity-frame', 'D'],
	['rarity-frame-c-v9', 'rarity-frame', 'C'],
	['rarity-frame-b-v9', 'rarity-frame', 'B'],
	['rarity-frame-a-v9', 'rarity-frame', 'A'],
	['rarity-frame-s-v9', 'rarity-frame', 'S']
] as const;

async function seedReadyFinalizerRoot(root: string): Promise<{
	readonly manifest: ReturnType<typeof SkillIconCleanupManifestSchema.parse>;
	readonly firstInteriorPath: string;
}> {
	const sourceManifest = SkillIconCleanupManifestSchema.parse(
		JSON.parse(
			await readFile(path.join(workspaceRoot, QUALITY_CLEANUP_ROOT, 'manifest.json'), 'utf8')
		) as unknown
	);
	for (const authority of Object.values(sourceManifest.authority)) {
		const destination = path.join(root, authority.path);
		await mkdir(path.dirname(destination), { recursive: true });
		await copyFile(path.join(workspaceRoot, authority.path), destination);
	}
	const source = await sparseRgbaFixture(1024, 1024, [
		[512, 512, 0, 255, 0, 255],
		[150, 512, 0, 255, 0, 255],
		[0, 0, 0, 255, 0, 255]
	]);
	const sourceHash = sha256(source);
	let firstSourcePath: string | null = null;
	for (const record of sourceManifest.records) {
		const destination = path.join(root, record.sourceCandidate.path);
		await mkdir(path.dirname(destination), { recursive: true });
		if (firstSourcePath === null) {
			await writeFile(destination, source);
			firstSourcePath = destination;
		} else {
			await link(firstSourcePath, destination);
		}
	}
	const manifest = SkillIconCleanupManifestSchema.parse({
		...sourceManifest,
		records: sourceManifest.records.map((record) => ({
			...record,
			sourceCandidate: { ...record.sourceCandidate, contentHash: sourceHash }
		}))
	});
	const manifestPath = path.join(root, QUALITY_CLEANUP_ROOT, 'manifest.json');
	await mkdir(path.dirname(manifestPath), { recursive: true });
	await writeFile(manifestPath, Buffer.from(`${JSON.stringify(manifest, null, '\t')}\n`));

	for (const [jobId] of cleanupLayerJobs) {
		for (const repositoryPath of [
			`assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`,
			`assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`
		]) {
			const destination = path.join(root, repositoryPath);
			await mkdir(path.dirname(destination), { recursive: true });
			await copyFile(path.join(workspaceRoot, repositoryPath), destination);
		}
		if (jobId !== 'rarity-frame-f-v9') {
			for (const repositoryPath of [
				`assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`,
				`assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`
			]) {
				const destination = path.join(root, repositoryPath);
				await mkdir(path.dirname(destination), { recursive: true });
				await copyFile(path.join(workspaceRoot, repositoryPath), destination);
			}
		}
	}

	const fJobId = 'rarity-frame-f-v9';
	const fCandidatePath = `assets/wiki/skills/icon-production-v1/candidates/references/${fJobId}.png`;
	const fResultPath = `assets/wiki/skills/icon-production-v1/results/references/${fJobId}.json`;
	const fTarget = JSON.parse(
		await readFile(
			path.join(root, `assets/wiki/skills/icon-production-v1/targets/references/${fJobId}.json`),
			'utf8'
		)
	) as Record<string, unknown>;
	const templateResult = JSON.parse(
		await readFile(
			path.join(
				workspaceRoot,
				'assets/wiki/skills/icon-production-v1/results/references/rarity-frame-e-v9.json'
			),
			'utf8'
		)
	) as Record<string, unknown>;
	const fCandidate = await readFile(
		path.join(
			workspaceRoot,
			'assets/wiki/skills/icon-production-v1/candidates/references/rarity-frame-e-v9.png'
		)
	);
	const fCandidateHash = sha256(fCandidate);
	const fPrompt = fTarget.exactPrompt as string;
	const fOutput = templateResult.output as Record<string, unknown>;
	const fNormalization = templateResult.normalization as Record<string, unknown>;
	const fReferences = fTarget.references as ReadonlyArray<{
		readonly path: string;
		readonly contentHash: string;
	}>;
	const fResult = {
		...templateResult,
		resultId: `result-${fJobId}`,
		jobId: fJobId,
		logicalIdentity: 'rarity-frame-f',
		revision: 9,
		assignmentId: `assignment-${fJobId}`,
		exactPrompt: fPrompt,
		promptHash: sha256(Buffer.from(fPrompt)),
		referenceInputs: fReferences.map(({ path: referencePath, contentHash }) => ({
			path: referencePath,
			contentHash
		})),
		normalization: { ...fNormalization, outputContentHash: fCandidateHash },
		output: {
			...fOutput,
			path: fCandidatePath,
			bytes: fCandidate.byteLength,
			contentHash: fCandidateHash
		},
		resultPath: fResultPath,
		writtenOutputPaths: [fCandidatePath, fResultPath]
	};
	for (const [repositoryPath, bytes] of [
		[fCandidatePath, fCandidate],
		[fResultPath, Buffer.from(`${JSON.stringify(fResult, null, '\t')}\n`)]
	] as const) {
		const destination = path.join(root, repositoryPath);
		await mkdir(path.dirname(destination), { recursive: true });
		await writeFile(destination, bytes);
	}

	const first = manifest.records[0]!;
	return {
		manifest,
		firstInteriorPath: `${QUALITY_CLEANUP_ROOT}/interiors/${cleanupSlug(first.targetId)}.png`
	};
}

async function updateJsonArtifact(
	root: string,
	repositoryPath: string,
	update: (value: Record<string, unknown>) => void
): Promise<void> {
	const absolutePath = path.join(root, repositoryPath);
	const value = JSON.parse(await readFile(absolutePath, 'utf8')) as Record<string, unknown>;
	update(value);
	await writeFile(absolutePath, Buffer.from(`${JSON.stringify(value, null, '\t')}\n`));
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

async function seedExporterRoot(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'skill-icon-cleanup-exporter-'));
	const cleanupManifestPath = `${QUALITY_CLEANUP_ROOT}/manifest.json`;
	const cleanupManifest = SkillIconCleanupManifestSchema.parse(
		JSON.parse(await readFile(path.join(workspaceRoot, cleanupManifestPath), 'utf8')) as unknown
	);
	const massManifest = JSON.parse(
		await readFile(
			path.join(
				workspaceRoot,
				'assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json'
			),
			'utf8'
		)
	) as {
		readonly skills: readonly { readonly targetId: string; readonly resultPath: string }[];
	};
	const packetDirectory = path.join(workspaceRoot, QUALITY_CLEANUP_ROOT, 'prompts/revisions');
	const packetNames = (await readdir(packetDirectory)).filter((name) => name.endsWith('.json'));
	const packets = await Promise.all(
		packetNames.map(async (name) => ({
			path: `${QUALITY_CLEANUP_ROOT}/prompts/revisions/${name}`,
			packet: JSON.parse(await readFile(path.join(packetDirectory, name), 'utf8')) as {
				readonly targetId: string;
				readonly currentCandidate: { readonly path: string };
				readonly currentResult: { readonly path: string };
				readonly compositionAuthority: Readonly<Record<string, { readonly path: string }>>;
				readonly references: readonly { readonly path: string }[];
			}
		}))
	);
	const files = new Set<string>([
		cleanupManifestPath,
		`${QUALITY_CLEANUP_ROOT}/findings.json`,
		`${QUALITY_CLEANUP_ROOT}/findings.source.json`,
		...Object.values(cleanupManifest.authority).map(({ path: authorityPath }) => authorityPath),
		...cleanupManifest.records.map(({ sourceCandidate }) => sourceCandidate.path),
		...packets.map(({ path: packetPath }) => packetPath)
	]);
	for (const { packet } of packets) {
		files.add(packet.currentCandidate.path);
		files.add(packet.currentResult.path);
		for (const binding of Object.values(packet.compositionAuthority)) files.add(binding.path);
		for (const reference of packet.references) files.add(reference.path);
		const massRecord = massManifest.skills.find(({ targetId }) => targetId === packet.targetId);
		if (!massRecord) throw new Error(`Missing mass result fixture for ${packet.targetId}`);
		files.add(massRecord.resultPath);
	}
	for (const repositoryPath of files) {
		const source = path.join(workspaceRoot, repositoryPath);
		const destination = path.join(root, repositoryPath);
		await mkdir(path.dirname(destination), { recursive: true });
		if (repositoryPath === cleanupManifestPath) {
			await copyFile(source, destination);
			continue;
		}
		await link(source, destination).catch(async (error: NodeJS.ErrnoException) => {
			if (error.code !== 'EXDEV') throw error;
			await copyFile(source, destination);
		});
	}
	return root;
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

describe('skill-icon quality-cleanup manifest exporter', { timeout: 60_000 }, () => {
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
		expect(report.revisionPackets).toBe(28);
		expect(report.written).toEqual([]);
		expect(await readdir(path.join(cleanupDirectory, 'prompts/revisions'))).toHaveLength(28);
		expect(afterSnapshot).toEqual(beforeSnapshot);
	});

	it('rejects a consistently skewed 456-record authority input', async () => {
		const input = withSkewedDomain(await loadCleanupManifestInput(workspaceRoot));

		expect(() => buildSkillIconCleanupManifest(input)).toThrow(/actual domain counts/i);
	});

	it('reports output drift in check mode and refuses to replace it in write mode', async () => {
		const root = await seedExporterRoot();
		const manifestPath = path.resolve(root, QUALITY_CLEANUP_ROOT, 'manifest.json');
		const original = await readFile(manifestPath);
		const drift = Buffer.from('intentionally drifted cleanup manifest\n');
		await writeFile(manifestPath, drift);
		try {
			const checked = await exportSkillIconQualityCleanup({ root, mode: 'check' });
			expect(checked.written).toEqual([]);
			expect(checked.drifted).toEqual([
				'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/manifest.json'
			]);
			await expect(exportSkillIconQualityCleanup({ root, mode: 'write' })).rejects.toThrow(
				/refusing to replace drifted cleanup artifact/i
			);
			expect(await readFile(manifestPath)).toEqual(drift);
		} finally {
			await writeFile(manifestPath, original).catch(() => undefined);
			await rm(root, { recursive: true });
		}
	});

	it('reports and preserves a drifted immutable revision packet', async () => {
		const root = await seedExporterRoot();
		const packetPath = path.join(
			root,
			QUALITY_CLEANUP_ROOT,
			'prompts/revisions/martial-blade-blade-dance-v1.json'
		);
		const drift = Buffer.from('{"forged":true}\n');
		await unlink(packetPath);
		await writeFile(packetPath, drift);
		try {
			const checked = await exportSkillIconQualityCleanup({ root, mode: 'check' });
			expect(checked.drifted).toEqual([
				`${QUALITY_CLEANUP_ROOT}/prompts/revisions/martial-blade-blade-dance-v1.json`
			]);
			await expect(exportSkillIconQualityCleanup({ root, mode: 'write' })).rejects.toThrow(
				/refusing to replace drifted cleanup artifact/i
			);
			expect(await readFile(packetPath)).toEqual(drift);
		} finally {
			await rm(root, { recursive: true });
		}
	});

	it('does not clobber synchronized drift that appears after the missing-file check', async () => {
		const root = await seedExporterRoot();
		const cleanupDirectory = path.resolve(root, QUALITY_CLEANUP_ROOT);
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
					root,
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
			await writeFile(manifestPath, original).catch(() => undefined);
			await rm(root, { recursive: true });
		}
	});
});

describe('deterministic protected-aperture composition', { timeout: 60_000 }, () => {
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

	it('rejects stale layer hashes and detects opaque exterior pixels', async () => {
		// Catches accepting stale provenance or treating backing/frame pixels outside geometry as valid.
		const backing = await rgbaFixture(
			[0, 0, 0, 0],
			[
				[0, 0, 255, 0, 0, 255],
				[5, 5, 255, 0, 0, 255]
			]
		);
		const interior = await rgbaFixture([0, 0, 0, 0], [[5, 5, 0, 255, 0, 255]]);
		const frame = await rgbaFixture([0, 0, 0, 0], [[9, 9, 0, 0, 255, 255]]);
		const composite = await composeCleanupIcon({ backing, interior, frame });

		const inspection = await inspectCleanupComposite({
			composite,
			backing,
			interior,
			frame,
			geometry: syntheticGeometry,
			boundLayerHashes: {
				backing: '0'.repeat(64),
				interior: sha256(interior),
				frame: sha256(frame)
			}
		});

		expect(inspection.layerHashesMatch).toBe(false);
		expect(inspection.exteriorTransparent).toBe(false);
		expect(inspection.exactComposite).toBe(false);
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
				'charcoal-forged-stone-v6',
				'rarity-frame-f-v9',
				'rarity-frame-e-v9',
				'rarity-frame-d-v9',
				'rarity-frame-c-v9',
				'rarity-frame-b-v9',
				'rarity-frame-a-v9',
				'rarity-frame-s-v9'
			]);
			expect(report.written).toEqual([]);
			expect(await readdir(manifestDirectory)).toEqual(['manifest.json']);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('rejects unauthenticated shared-layer executions before any finalizer write', async () => {
		// Catches accepting a result/candidate pair without its exact packet, provenance, and bytes.
		const cases = [
			{
				name: 'missing assignment',
				mutate: (root: string) =>
					unlink(
						path.join(
							root,
							'assets/wiki/skills/icon-production-v1/assignments/references/rarity-frame-c-v9.json'
						)
					)
			},
			{
				name: 'malformed result',
				mutate: (root: string) =>
					writeFile(
						path.join(
							root,
							'assets/wiki/skills/icon-production-v1/results/references/rarity-frame-c-v9.json'
						),
						Buffer.from('{}\n')
					)
			},
			{
				name: 'stale reference hash',
				mutate: (root: string) =>
					writeFile(
						path.join(
							root,
							'assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png'
						),
						Buffer.from('stale reference bytes\n')
					)
			},
			{
				name: 'reordered authority inputs',
				mutate: (root: string) =>
					updateJsonArtifact(
						root,
						'assets/wiki/skills/icon-production-v1/targets/references/rarity-frame-c-v9.json',
						(target) => {
							target.references = [...(target.references as unknown[])].reverse();
						}
					)
			},
			{
				name: 'wrong role',
				mutate: (root: string) =>
					updateJsonArtifact(
						root,
						'assets/wiki/skills/icon-production-v1/targets/references/rarity-frame-c-v9.json',
						(target) => {
							target.role = 'backing';
						}
					)
			},
			{
				name: 'wrong rarity',
				mutate: (root: string) =>
					updateJsonArtifact(
						root,
						'assets/wiki/skills/icon-production-v1/targets/references/rarity-frame-c-v9.json',
						(target) => {
							target.rarity = 'D';
						}
					)
			},
			{
				name: 'wrong canonical packet path',
				mutate: async (root: string) => {
					for (const [area, extension] of [
						['targets', 'json'],
						['assignments', 'json'],
						['candidates', 'png'],
						['results', 'json']
					] as const) {
						await copyFile(
							path.join(
								workspaceRoot,
								`assets/wiki/skills/icon-production-v1/${area}/references/rarity-frame-d-v9.${extension}`
							),
							path.join(
								root,
								`assets/wiki/skills/icon-production-v1/${area}/references/rarity-frame-c-v9.${extension}`
							)
						);
					}
				}
			},
			{
				name: 'non-candidate status',
				mutate: (root: string) =>
					updateJsonArtifact(
						root,
						'assets/wiki/skills/icon-production-v1/results/references/rarity-frame-c-v9.json',
						(result) => {
							result.status = 'revise';
							const findings = result.findings as Record<string, unknown>[];
							findings[0]!.outcome = 'concern';
						}
					)
			},
			{
				name: 'candidate byte mismatch',
				mutate: async (root: string) => {
					const candidatePath = path.join(
						root,
						'assets/wiki/skills/icon-production-v1/candidates/references/rarity-frame-c-v9.png'
					);
					await writeFile(
						candidatePath,
						Buffer.concat([await readFile(candidatePath), Buffer.from([0])])
					);
				}
			},
			{
				name: 'normalization output hash mismatch',
				mutate: (root: string) =>
					updateJsonArtifact(
						root,
						'assets/wiki/skills/icon-production-v1/results/references/rarity-frame-c-v9.json',
						(result) => {
							(result.normalization as Record<string, unknown>).outputContentHash = '0'.repeat(64);
						}
					)
			},
			{
				name: 'coherently reordered F authority inputs',
				mutate: async (root: string) => {
					const jobId = 'rarity-frame-f-v9';
					await updateJsonArtifact(
						root,
						`assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`,
						(target) => {
							target.references = [...(target.references as unknown[])].reverse();
						}
					);
					await updateJsonArtifact(
						root,
						`assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`,
						(result) => {
							result.referenceInputs = [...(result.referenceInputs as unknown[])].reverse();
						}
					);
				}
			},
			{
				name: 'wrong profile and producer',
				mutate: async (root: string) => {
					const jobId = 'charcoal-forged-stone-v6';
					await updateJsonArtifact(
						root,
						`assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`,
						(target) => {
							(target.normalization as Record<string, unknown>).profile =
								'skill-icon-geometry-role-mask-v2';
						}
					);
					await updateJsonArtifact(
						root,
						`assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`,
						(assignment) => {
							(assignment.normalization as Record<string, unknown>).profile =
								'skill-icon-geometry-role-mask-v2';
							assignment.skillVersion = 'summonlab-skill-icon-production-v6';
						}
					);
					await updateJsonArtifact(
						root,
						`assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`,
						(result) => {
							(result.normalization as Record<string, unknown>).profile =
								'skill-icon-geometry-role-mask-v2';
						}
					);
				}
			}
		] as const;

		for (const testCase of cases) {
			const root = await mkdtemp(path.join(tmpdir(), 'summonlab-cleanup-binding-'));
			try {
				const fixture = await seedReadyFinalizerRoot(root);
				await testCase.mutate(root);
				await expect(
					finalizeSkillIconQualityCleanup({ root, mode: 'write' }),
					testCase.name
				).rejects.toThrow();
				await expect(readFile(path.join(root, fixture.firstInteriorPath))).rejects.toMatchObject({
					code: 'ENOENT'
				});
			} finally {
				await rm(root, { recursive: true, force: true });
			}
		}
	}, 120_000);

	it('rejects a coherent wrong-reference substitution before any finalizer write', async () => {
		// Catches trusting target/result agreement when both name an allowed but unauthorized authority.
		const root = await mkdtemp(path.join(tmpdir(), 'summonlab-cleanup-reference-substitution-'));
		try {
			const fixture = await seedReadyFinalizerRoot(root);
			const jobId = 'charcoal-forged-stone-v6';
			const wrongReference = fixture.manifest.authority.selectedFrameSheet;
			await updateJsonArtifact(
				root,
				`assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`,
				(target) => {
					const references = target.references as Record<string, unknown>[];
					references[0] = {
						...wrongReference,
						purpose: 'Allowed repository image substituted for the required Option C authority.'
					};
				}
			);
			await updateJsonArtifact(
				root,
				`assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`,
				(result) => {
					const referenceInputs = result.referenceInputs as Record<string, unknown>[];
					referenceInputs[0] = wrongReference;
				}
			);
			for (const repositoryPath of [
				'assets/wiki/skills/icon-production-v1/candidates/references/rarity-frame-s-v9.png',
				'assets/wiki/skills/icon-production-v1/results/references/rarity-frame-s-v9.json'
			]) {
				await unlink(path.join(root, repositoryPath));
			}

			await expect(finalizeSkillIconQualityCleanup({ root, mode: 'write' })).rejects.toThrow(
				/canonical ordered references/i
			);
			await expect(readFile(path.join(root, fixture.firstInteriorPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});

	it('persists interiors and validated loss provenance through write, check, and drift modes', async () => {
		// Catches dropping extracted interiors/evidence or replacing an existing derived artifact.
		const root = await mkdtemp(path.join(tmpdir(), 'summonlab-cleanup-ready-'));
		try {
			const fixture = await seedReadyFinalizerRoot(root);
			const first = fixture.manifest.records[0]!;

			const written = await finalizeSkillIconQualityCleanup({ root, mode: 'write' });
			expect(written.ready).toBe(true);
			expect(written.finalized).toBe(456);
			expect(written.written).toHaveLength(456 * 3);
			expect(written.written).toContain(fixture.firstInteriorPath);

			const interior = await readFile(path.join(root, fixture.firstInteriorPath));
			const interiorData = await rawRgba(interior);
			expect(
				Array.from(interiorData.subarray((512 * 1024 + 512) * 4, (512 * 1024 + 512) * 4 + 4))
			).toEqual([0, 255, 0, 255]);
			expect(
				Array.from(interiorData.subarray((512 * 1024 + 150) * 4, (512 * 1024 + 150) * 4 + 4))
			).toEqual([0, 0, 0, 0]);

			const result = SkillIconCleanupResultSchema.parse(
				JSON.parse(await readFile(path.join(root, first.resultPath), 'utf8')) as unknown
			);
			expect(result.cleanupInterior).toEqual({
				path: fixture.firstInteriorPath,
				contentHash: sha256(interior),
				removedPixels: 2,
				removedPixelBounds: { left: 0, top: 0, width: 151, height: 513 }
			});

			const composite = await rawRgba(await readFile(path.join(root, first.cleanupCompositePath)));
			expect(Array.from(composite.subarray(0, 4))).toEqual([0, 0, 0, 0]);
			expect(Array.from(composite.subarray((1024 * 1024 - 1) * 4))).toEqual([0, 0, 0, 0]);

			const checked = await finalizeSkillIconQualityCleanup({ root, mode: 'check' });
			expect(checked.written).toEqual([]);
			expect(checked.drifted).toEqual([]);

			const second = fixture.manifest.records[1]!;
			const third = fixture.manifest.records[2]!;
			const missingPaths = [
				fixture.firstInteriorPath,
				second.cleanupCompositePath,
				third.resultPath
			];
			for (const missingPath of missingPaths) await unlink(path.join(root, missingPath));
			const missing = await finalizeSkillIconQualityCleanup({ root, mode: 'check' });
			expect(missing.drifted).toEqual(missingPaths);
			const restored = await finalizeSkillIconQualityCleanup({ root, mode: 'write' });
			expect(restored.written).toEqual(missingPaths);

			const drift = Buffer.from('existing derived artifact drift\n');
			await writeFile(path.join(root, first.cleanupCompositePath), drift);
			const drifted = await finalizeSkillIconQualityCleanup({ root, mode: 'check' });
			expect(drifted.drifted).toEqual([first.cleanupCompositePath]);
			await expect(finalizeSkillIconQualityCleanup({ root, mode: 'write' })).rejects.toThrow(
				/refusing to replace drifted cleanup artifact/i
			);
			expect(await readFile(path.join(root, first.cleanupCompositePath))).toEqual(drift);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}, 300_000);

	it('preflights a late source hash failure before publishing the first output', async () => {
		// Catches record-by-record verification that creates early outputs before a late source fails.
		const root = await mkdtemp(path.join(tmpdir(), 'summonlab-cleanup-source-drift-'));
		try {
			const fixture = await seedReadyFinalizerRoot(root);
			const first = fixture.manifest.records[0]!;
			const later = fixture.manifest.records[1]!;
			await unlink(path.join(root, later.sourceCandidate.path));
			await writeFile(
				path.join(root, later.sourceCandidate.path),
				Buffer.from('later source drift\n')
			);

			await expect(finalizeSkillIconQualityCleanup({ root, mode: 'write' })).rejects.toThrow(
				new RegExp(`frozen cleanup source hash drift: ${later.targetId}`, 'i')
			);
			await expect(readFile(path.join(root, first.cleanupCompositePath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
			await expect(readFile(path.join(root, fixture.firstInteriorPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}, 120_000);

	it('preflights a late destination collision before publishing the first output', async () => {
		// Catches create-only collision discovery after earlier records have already been published.
		const root = await mkdtemp(path.join(tmpdir(), 'summonlab-cleanup-output-drift-'));
		try {
			const fixture = await seedReadyFinalizerRoot(root);
			const first = fixture.manifest.records[0]!;
			const later = fixture.manifest.records[1]!;
			const laterResult = path.join(root, later.resultPath);
			await mkdir(path.dirname(laterResult), { recursive: true });
			await writeFile(laterResult, Buffer.from('later destination drift\n'));

			await expect(finalizeSkillIconQualityCleanup({ root, mode: 'write' })).rejects.toThrow(
				/refusing to replace drifted cleanup artifact/i
			);
			await expect(readFile(path.join(root, first.cleanupCompositePath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
			await expect(readFile(path.join(root, fixture.firstInteriorPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}, 180_000);

	it('preflights an escaping destination-parent symlink before publishing any output', async () => {
		// Catches parent resolution being deferred until record-by-record publication.
		const root = await mkdtemp(path.join(tmpdir(), 'summonlab-cleanup-parent-symlink-'));
		const outside = await mkdtemp(path.join(tmpdir(), 'summonlab-cleanup-outside-'));
		try {
			const fixture = await seedReadyFinalizerRoot(root);
			const first = fixture.manifest.records[0]!;
			const resultsDirectory = path.join(root, QUALITY_CLEANUP_ROOT, 'results');
			await symlink(outside, resultsDirectory, 'dir');

			await expect(finalizeSkillIconQualityCleanup({ root, mode: 'write' })).rejects.toThrow(
				/cleanup artifact parent.*symbolic link|outside the repository root/i
			);
			await expect(readFile(path.join(root, fixture.firstInteriorPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
			await expect(readFile(path.join(root, first.cleanupCompositePath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
			expect(await readdir(outside)).toEqual([]);
		} finally {
			await rm(root, { recursive: true, force: true });
			await rm(outside, { recursive: true, force: true });
		}
	}, 120_000);

	it('preflights every frozen authority hash before finalization', async () => {
		// Catches validating geometry alone while another manifest-bound authority has drifted.
		const root = await mkdtemp(path.join(tmpdir(), 'summonlab-cleanup-authority-drift-'));
		try {
			const fixture = await seedReadyFinalizerRoot(root);
			const first = fixture.manifest.records[0]!;
			await writeFile(
				path.join(root, fixture.manifest.authority.visualSpecifications.path),
				Buffer.from('drifted visual specifications\n')
			);
			const later = fixture.manifest.records[1]!;
			await unlink(path.join(root, later.sourceCandidate.path));
			await writeFile(
				path.join(root, later.sourceCandidate.path),
				Buffer.from('later source drift proves authority ordering\n')
			);

			await expect(finalizeSkillIconQualityCleanup({ root, mode: 'write' })).rejects.toThrow(
				/cleanup authority hash drift: visualSpecifications/i
			);
			await expect(readFile(path.join(root, first.cleanupCompositePath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	}, 120_000);
});
