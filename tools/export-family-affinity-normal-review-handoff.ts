import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';

type ExportMode = 'write' | 'check';
type Tier = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
type ActiveCoordinate = { familyId: string; formId: string; affinity: string; targetPath: string };
type NormalReviewItem = {
	familyId: string;
	formId: string;
	tier: Tier;
	coordinateId: string;
	targetPath: string;
	candidatePath: string;
	candidateSha256: string;
	candidate: Buffer;
};

const ROOT = 'assets/enemies/experiments/family-affinity-v1';
const OUTPUT_ROOT = 'docs/evidence/enemy-normal-anchor-review-v1';
const TIERS = ['T1', 'T2', 'T3', 'T4', 'T5'] as const;
const WAVES = [
	{ id: 'a1', families: ['goblins', 'orcs', 'giants', 'trolls', 'dragons'] },
	{ id: 'a2', families: ['skeletons', 'rotwalkers', 'wraiths', 'vampires', 'mummies'] },
	{ id: 'a3', families: ['demons', 'celestials', 'harpies', 'minotaurs', 'nagas'] },
	{ id: 'a4', families: ['lizardfolk', 'insectoids', 'arachnids', 'slimes', 'golems'] },
	{ id: 'a5', families: ['elementals', 'treants', 'fungalfolk', 'deep-ones', 'werebeasts'] },
	{ id: 'a6', families: ['gargoyles', 'djinn', 'fae', 'void-horrors', 'doppelgangers'] }
] as const;

function ownedAbsolute(repositoryRoot: string, ownedPath: string): string {
	const root = resolve(repositoryRoot);
	const absolute = resolve(root, ownedPath);
	if (!absolute.startsWith(`${root}${sep}`))
		throw new Error(`Path escapes repository: ${ownedPath}`);
	return absolute;
}

async function requiredRealFile(repositoryRoot: string, ownedPath: string): Promise<Buffer> {
	const absolute = ownedAbsolute(repositoryRoot, ownedPath);
	const metadata = await lstat(absolute);
	if (metadata.isSymbolicLink() || !metadata.isFile()) {
		throw new Error(`Required handoff source must be a real file: ${ownedPath}`);
	}
	return readFile(absolute);
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function xml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

async function loadNormalItems(repositoryRoot: string): Promise<NormalReviewItem[]> {
	const manifest = JSON.parse(
		(await requiredRealFile(repositoryRoot, `${ROOT}/manifest.json`)).toString('utf8')
	) as { canonicalMatrix: { activeCoordinates: ActiveCoordinate[] } };
	const coordinates = manifest.canonicalMatrix.activeCoordinates.filter(
		(coordinate) => coordinate.affinity === 'normal'
	);
	if (coordinates.length !== 150) {
		throw new Error(`Expected 150 active Normal coordinates, found ${coordinates.length}`);
	}
	const items = await Promise.all(
		coordinates.map(async (coordinate): Promise<NormalReviewItem> => {
			const target = JSON.parse(
				(await requiredRealFile(repositoryRoot, coordinate.targetPath)).toString('utf8')
			) as { coordinateId: string; tier: Tier; ownedPaths: { candidate: string } };
			const candidate = await requiredRealFile(repositoryRoot, target.ownedPaths.candidate);
			return {
				familyId: coordinate.familyId,
				formId: coordinate.formId,
				tier: target.tier,
				coordinateId: target.coordinateId,
				targetPath: coordinate.targetPath,
				candidatePath: target.ownedPaths.candidate,
				candidateSha256: sha256(candidate),
				candidate
			};
		})
	);
	for (const wave of WAVES) {
		for (const familyId of wave.families) {
			const familyItems = items.filter((item) => item.familyId === familyId);
			if (familyItems.length !== 5) {
				throw new Error(
					`Expected five Normal candidates for ${familyId}, found ${familyItems.length}`
				);
			}
			for (const tier of TIERS) {
				if (!familyItems.some((item) => item.tier === tier)) {
					throw new Error(`Missing ${familyId}/${tier}/normal review candidate`);
				}
			}
		}
	}
	return items;
}

async function renderLabeledWave(
	waveId: string,
	families: readonly string[],
	items: NormalReviewItem[]
): Promise<Buffer> {
	const headerHeight = 92;
	const rowLabelWidth = 220;
	const cellWidth = 336;
	const cellHeight = 208;
	const width = rowLabelWidth + cellWidth * 5;
	const height = headerHeight + cellHeight * 5;
	const composites: Array<{ input: Buffer; left: number; top: number }> = [];
	const labels: string[] = [];
	for (const [row, familyId] of families.entries()) {
		labels.push(
			`<text x="20" y="${headerHeight + row * cellHeight + cellHeight / 2}" dominant-baseline="middle" fill="#dce5ed" font-size="21" font-weight="700" font-family="sans-serif">${xml(familyId.toUpperCase())}</text>`
		);
		for (const [column, tier] of TIERS.entries()) {
			const item = items.find(
				(candidate) => candidate.familyId === familyId && candidate.tier === tier
			);
			if (!item) throw new Error(`Missing labeled wave item ${waveId}/${familyId}/${tier}`);
			const x = rowLabelWidth + column * cellWidth;
			const y = headerHeight + row * cellHeight;
			composites.push({
				input: await sharp(item.candidate)
					.rotate()
					.resize({
						width: cellWidth - 16,
						height: cellHeight - 48,
						fit: 'contain',
						background: '#080b10'
					})
					.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
					.toBuffer(),
				left: x + 8,
				top: y + 6
			});
			labels.push(
				`<g><rect x="${x + 4}" y="${y + 4}" width="${cellWidth - 8}" height="${cellHeight - 8}" rx="8" fill="none" stroke="#4f5e70" stroke-width="2"/><text x="${x + 12}" y="${y + cellHeight - 29}" fill="#70b7c4" font-size="15" font-weight="700" font-family="sans-serif">${tier}</text><text x="${x + 48}" y="${y + cellHeight - 29}" fill="#aebbc7" font-size="13" font-family="sans-serif">${xml(item.formId)}</text></g>`
			);
		}
	}
	const overlay = Buffer.from(
		`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="20" y="34" fill="#70b7c4" font-size="18" font-weight="700" font-family="sans-serif">WAVE ${waveId.toUpperCase()} · NORMAL ANCHOR REVIEW</text><text x="20" y="62" fill="#aebbc7" font-size="14" font-family="sans-serif">Review family identity, T1–T5 escalation, combat readability, anatomy, composition, and finish.</text>${labels.join('')}</svg>`
	);
	return sharp({ create: { width, height, channels: 3, background: '#070a0f' } })
		.composite([...composites, { input: overlay, left: 0, top: 0 }])
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

async function renderBlindWave(
	waveId: string,
	items: Array<NormalReviewItem & { token: string }>
): Promise<Buffer> {
	const headerHeight = 104;
	const cellWidth = 360;
	const cellHeight = 350;
	const width = cellWidth * 5;
	const height = headerHeight + cellHeight * 2;
	const composites: Array<{ input: Buffer; left: number; top: number }> = [];
	const labels: string[] = [];
	for (const [index, item] of items.entries()) {
		const column = index % 5;
		const row = Math.floor(index / 5);
		const x = column * cellWidth;
		const y = headerHeight + row * cellHeight;
		composites.push({
			input: await sharp(item.candidate)
				.rotate()
				.resize({
					width: cellWidth - 18,
					height: cellHeight - 48,
					fit: 'contain',
					background: '#080b10'
				})
				.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
				.toBuffer(),
			left: x + 9,
			top: y + 6
		});
		labels.push(
			`<g><rect x="${x + 4}" y="${y + 4}" width="${cellWidth - 8}" height="${cellHeight - 8}" rx="8" fill="none" stroke="#4f5e70" stroke-width="2"/><text x="${x + cellWidth / 2}" y="${y + cellHeight - 17}" text-anchor="middle" fill="#dce5ed" font-size="15" font-weight="700" font-family="monospace">${item.token}</text></g>`
		);
	}
	const overlay = Buffer.from(
		`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="20" y="34" fill="#70b7c4" font-size="18" font-weight="700" font-family="sans-serif">WAVE ${waveId.toUpperCase()} · BLIND SPECIALIST/SOVEREIGN REVIEW</text><text x="20" y="62" fill="#aebbc7" font-size="14" font-family="sans-serif">Record each opaque token's perceived role, tier, identity confidence, anatomy, framing, and verdict before opening the controller map.</text><text x="20" y="84" fill="#d49b68" font-size="13" font-weight="700" font-family="sans-serif">Semantic family, form, and tier labels are intentionally hidden.</text>${labels.join('')}</svg>`
	);
	return sharp({ create: { width, height, channels: 3, background: '#070a0f' } })
		.composite([...composites, { input: overlay, left: 0, top: 0 }])
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

function buildIndex(): Buffer {
	const sections = WAVES.map(
		(wave) =>
			`## Wave ${wave.id.toUpperCase()}\n\nFamilies: ${wave.families.join(', ')}.\n\n### Independent blind T3/T5 review\n\nReview this image and record verdicts by opaque token before consulting the controller map.\n\n![Wave ${wave.id.toUpperCase()} blind review](./wave-${wave.id}-blind.png)\n\n### Owner family-progression review\n\n![Wave ${wave.id.toUpperCase()} labeled Normal review](./wave-${wave.id}-normal.png)\n\nController-only reconciliation map: [wave-${wave.id}-blind-map.json](./wave-${wave.id}-blind-map.json).`
	).join('\n\n');
	return Buffer.from(
		`# Enemy Normal-anchor review handoff\n\nThese are candidate-only review artifacts for the 150 canonical Normal anchors. They do not approve or promote any image.\n\nReview order matters:\n\n1. The independent blind reviewer opens each blind sheet first and records a verdict for every opaque token without consulting its map.\n2. The owner reviews each labeled sheet for family continuity, T1–T5 escalation, combat readability, anatomy, composition, and finish.\n3. The controller reconciles token verdicts through the map and records immutable receipts through the assigned reviewer identities.\n4. Only mutually approved Normal anchors may activate their Fire, Earth, Wind, and Water assignments.\n\n${sections}\n`
	);
}

async function currentBytes(repositoryRoot: string, ownedPath: string): Promise<Buffer | null> {
	try {
		return await requiredRealFile(repositoryRoot, ownedPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}

async function writeAtomic(
	repositoryRoot: string,
	ownedPath: string,
	bytes: Buffer
): Promise<void> {
	const absolute = ownedAbsolute(repositoryRoot, ownedPath);
	await mkdir(dirname(absolute), { recursive: true });
	const temporary = `${absolute}.controller-${process.pid}.tmp`;
	await writeFile(temporary, bytes, { flag: 'wx' });
	await rename(temporary, absolute);
}

export async function exportNormalReviewHandoff(
	repositoryRoot = process.cwd(),
	mode: ExportMode = 'check'
): Promise<{ artifactCount: 19; writtenCount: number; digest: string; inSync: boolean }> {
	const items = await loadNormalItems(repositoryRoot);
	const artifacts: Array<{ path: string; bytes: Buffer }> = [
		{ path: `${OUTPUT_ROOT}/index.md`, bytes: buildIndex() }
	];
	for (const wave of WAVES) {
		const familySet = new Set<string>(wave.families);
		const waveItems = items.filter((item) => familySet.has(item.familyId));
		const blindItems = waveItems
			.filter((item) => item.tier === 'T3' || item.tier === 'T5')
			.sort((left, right) =>
				sha256(Buffer.from(`${wave.id}:${left.coordinateId}`)).localeCompare(
					sha256(Buffer.from(`${wave.id}:${right.coordinateId}`))
				)
			)
			.map((item, index) => ({
				...item,
				token: `${wave.id.toUpperCase()}-${String(index + 1).padStart(2, '0')}`
			}));
		if (waveItems.length !== 25 || blindItems.length !== 10) {
			throw new Error(`Wave ${wave.id} review cardinality is invalid`);
		}
		artifacts.push(
			{
				path: `${OUTPUT_ROOT}/wave-${wave.id}-normal.png`,
				bytes: await renderLabeledWave(wave.id, wave.families, waveItems)
			},
			{
				path: `${OUTPUT_ROOT}/wave-${wave.id}-blind.png`,
				bytes: await renderBlindWave(wave.id, blindItems)
			},
			{
				path: `${OUTPUT_ROOT}/wave-${wave.id}-blind-map.json`,
				bytes: Buffer.from(
					`${JSON.stringify(
						{
							schemaVersion: 'family-affinity-normal-blind-map-v1',
							waveId: wave.id,
							warning:
								'Controller reconciliation only. Blind reviewers record token verdicts before opening this map.',
							entries: blindItems.map(
								({ token, coordinateId, targetPath, candidatePath, candidateSha256 }) => ({
									token,
									coordinateId,
									targetPath,
									candidatePath,
									candidateSha256
								})
							)
						},
						null,
						2
					)}\n`
				)
			}
		);
	}
	if (artifacts.length !== 19)
		throw new Error(`Expected 19 handoff artifacts, found ${artifacts.length}`);
	let writtenCount = 0;
	for (const artifact of artifacts) {
		const current = await currentBytes(repositoryRoot, artifact.path);
		if (current?.equals(artifact.bytes)) continue;
		if (mode === 'check') throw new Error(`Normal review handoff is stale: ${artifact.path}`);
		await writeAtomic(repositoryRoot, artifact.path, artifact.bytes);
		writtenCount += 1;
	}
	const digest = createHash('sha256')
		.update(artifacts.map((artifact) => `${artifact.path}\0${sha256(artifact.bytes)}`).join('\n'))
		.digest('hex');
	return {
		artifactCount: 19,
		writtenCount,
		digest,
		inSync: mode === 'check' || writtenCount === 0
	};
}

async function main(): Promise<void> {
	const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
	if (unknownArguments.length > 0)
		throw new Error(`Unknown arguments: ${unknownArguments.join(' ')}`);
	const mode: ExportMode = process.argv.includes('--check') ? 'check' : 'write';
	const report = await exportNormalReviewHandoff(process.cwd(), mode);
	console.log(
		`family-affinity-normal-review mode=${mode} artifacts=${report.artifactCount} written=${report.writtenCount} digest=${report.digest}`
	);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : error);
		process.exitCode = 1;
	});
}
