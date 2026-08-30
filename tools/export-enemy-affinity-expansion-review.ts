import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

const workspaceRoot = process.cwd();
const experimentRoot = 'assets/enemies/experiments/affinity-expansion-v1';
const reviewRoot = `${experimentRoot}/review`;
const write = process.argv.includes('--write');
const check = process.argv.includes('--check');

if (write === check) throw new Error('Choose exactly one of --write or --check.');

interface Manifest {
	experimentId: string;
	species: Array<{
		speciesId: string;
		priority: number;
		targetPaths: string[];
	}>;
}

interface Target {
	targetId: string;
	speciesId: string;
	affinity: string;
	output: { candidatePath: string; resultPath: string };
}

interface Result {
	status: 'candidate' | 'revise' | 'failed';
	selectedAttemptId: string | null;
	attempts: Array<{
		attemptId: string;
		output: null | {
			path: string;
			contentHash: string;
			width: number;
			height: number;
			mediaType: string;
			bytes: number;
		};
	}>;
}

interface CatalogEntry {
	targetId: string;
	speciesId: string;
	affinity: string;
	priority: number;
	status: 'candidate' | 'revise';
	selectedVersion: 'v3' | 'v2' | 'v1';
	resultPath: string;
	candidatePath: string;
	contentHash: string;
	width: number;
	height: number;
	mediaType: string;
	bytes: number;
}

const versions = ['v3', 'v2', 'v1'] as const;
const affinityOrder = ['normal', 'wood', 'fire', 'metal', 'water', 'wind'] as const;
const generatedAt = '2026-08-30T23:30:00.000Z';

function versioned(pathname: string, version: (typeof versions)[number]): string {
	return pathname.replace(/-v1(?=\.[^.]+$)/u, `-${version}`);
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

async function readJson<T>(pathname: string): Promise<T> {
	return JSON.parse(await readFile(path.resolve(workspaceRoot, pathname), 'utf8')) as T;
}

async function resolveEntry(
	target: Target,
	priority: number
): Promise<{ entry: CatalogEntry; image: Buffer }> {
	const loaded: Array<{ version: (typeof versions)[number]; resultPath: string; result: Result }> =
		[];
	for (const version of versions) {
		const resultPath = versioned(target.output.resultPath, version);
		try {
			loaded.push({ version, resultPath, result: await readJson<Result>(resultPath) });
		} catch {
			// An absent correction version is expected for targets that passed v1.
		}
	}
	const ordered = [
		...loaded.filter(({ result }) => result.status === 'candidate'),
		...loaded.filter(({ result }) => result.status === 'revise')
	];
	for (const item of ordered) {
		const expectedPath = versioned(target.output.candidatePath, item.version);
		const attempt =
			item.result.status === 'candidate'
				? item.result.attempts.find(({ attemptId }) => attemptId === item.result.selectedAttemptId)
				: [...item.result.attempts].reverse().find(({ output }) => output?.path === expectedPath);
		if (!attempt?.output || attempt.output.path !== expectedPath) continue;
		const image = await readFile(path.resolve(workspaceRoot, attempt.output.path));
		if (sha256(image) !== attempt.output.contentHash)
			throw new Error(`Hash mismatch for ${attempt.output.path}.`);
		return {
			entry: {
				targetId: target.targetId,
				speciesId: target.speciesId,
				affinity: target.affinity,
				priority,
				status: item.result.status as 'candidate' | 'revise',
				selectedVersion: item.version,
				resultPath: item.resultPath,
				candidatePath: attempt.output.path,
				contentHash: attempt.output.contentHash,
				width: attempt.output.width,
				height: attempt.output.height,
				mediaType: attempt.output.mediaType,
				bytes: attempt.output.bytes
			},
			image
		};
	}
	throw new Error(`No usable retained result for ${target.targetId}.`);
}

async function renderContactSheet(
	resolved: Array<{ entry: CatalogEntry; image: Buffer }>,
	speciesIds: string[]
): Promise<Buffer> {
	const width = 1536;
	const headerHeight = 92;
	const rowHeight = 176;
	const cellWidth = width / affinityOrder.length;
	const height = headerHeight + speciesIds.length * rowHeight;
	const byCoordinate = new Map(
		resolved.map((item) => [`${item.entry.speciesId}/${item.entry.affinity}`, item] as const)
	);
	const composites = await Promise.all(
		speciesIds.flatMap((speciesId, row) =>
			affinityOrder.map(async (affinity, column) => {
				const item = byCoordinate.get(`${speciesId}/${affinity}`);
				if (!item) throw new Error(`Missing contact-sheet cell ${speciesId}/${affinity}.`);
				return {
					input: await sharp(item.image)
						.rotate()
						.resize({
							width: cellWidth - 8,
							height: rowHeight - 28,
							fit: 'contain',
							background: '#06080c'
						})
						.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
						.toBuffer(),
					left: column * cellWidth + 4,
					top: headerHeight + row * rowHeight + 4
				};
			})
		)
	);
	const columnLabels = affinityOrder
		.map(
			(affinity, column) =>
				`<text x="${column * cellWidth + cellWidth / 2}" y="70" text-anchor="middle" fill="#7ed6e5" font-size="15" font-weight="700" font-family="sans-serif" letter-spacing="2">${affinity.toUpperCase()}</text>`
		)
		.join('');
	const rowLabels = speciesIds
		.map(
			(speciesId, row) =>
				`<g><rect x="4" y="${headerHeight + row * rowHeight + rowHeight - 26}" width="248" height="22" fill="#07090ddd"/><text x="12" y="${headerHeight + row * rowHeight + rowHeight - 10}" fill="#f4efe5" font-size="12" font-family="sans-serif">${escapeXml(speciesId.replaceAll('-', ' '))}</text></g>`
		)
		.join('');
	const overlay = Buffer.from(
		`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="20" y="30" fill="#f4efe5" font-size="18" font-weight="700" font-family="sans-serif">SUMMONLAB · 34-SPECIES AFFINITY EXPANSION</text><text x="20" y="51" fill="#f4efe599" font-size="12" font-family="sans-serif">204 producer candidates · human approval pending</text>${columnLabels}${rowLabels}</svg>`
	);
	return sharp({ create: { width, height, channels: 3, background: '#06080c' } })
		.composite([...composites, { input: overlay, left: 0, top: 0 }])
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

const manifest = await readJson<Manifest>(`${experimentRoot}/manifest.json`);
const resolved: Array<{ entry: CatalogEntry; image: Buffer }> = [];
for (const species of manifest.species) {
	for (const targetPath of species.targetPaths) {
		resolved.push(await resolveEntry(await readJson<Target>(targetPath), species.priority));
	}
}

const entries = resolved.map(({ entry }) => entry);
const candidateCount = entries.filter(({ status }) => status === 'candidate').length;
const reviseCount = entries.filter(({ status }) => status === 'revise').length;
const catalog = {
	schemaVersion: 'enemy-affinity-expansion-catalog-v1',
	experimentId: manifest.experimentId,
	generatedAt,
	status: 'producer-candidates',
	speciesCount: manifest.species.length,
	targetCount: entries.length,
	candidateCount,
	reviseCount,
	entries
};
const evaluation = {
	schemaVersion: 'enemy-affinity-expansion-evaluation-v1',
	experimentId: manifest.experimentId,
	generatedAt,
	decision: candidateCount === entries.length ? 'producer-complete' : 'producer-revision-required',
	producerChecks: {
		allTargetsRetained: entries.length === 204,
		allTargetsCandidates: candidateCount === 204,
		remainingReviseCount: reviseCount,
		contentHashesVerified: true,
		contactSheetTargetCount: entries.length
	},
	humanReview: {
		status: 'pending',
		scope: [
			'blind species recognition',
			'blind affinity recognition',
			'style cohesion',
			'gameplay readability'
		],
		note: 'Producer candidate status does not promote or approve runtime art.'
	}
};
const contactSheet = await renderContactSheet(
	resolved,
	manifest.species.map(({ speciesId }) => speciesId)
);
const record = `# Affinity expansion generation record\n\n- Experiment: \`${manifest.experimentId}\`\n- Completed: ${generatedAt}\n- Species: ${manifest.species.length}\n- Canonical targets: ${entries.length}\n- Producer candidates: ${candidateCount}\n- Remaining revisions: ${reviseCount}\n- Contact sheet SHA-256: \`${sha256(contactSheet)}\`\n- Human review: pending\n\nEach catalog entry resolves the newest valid candidate in v3 → v2 → v1 order, verifies its retained-image hash, and preserves the exact result receipt. No image is promoted to runtime or approved by this record.\n`;
const artifacts: Array<{ pathname: string; bytes: Buffer }> = [
	{
		pathname: `${reviewRoot}/catalog.json`,
		bytes: Buffer.from(`${JSON.stringify(catalog, null, '\t')}\n`)
	},
	{
		pathname: `${reviewRoot}/evaluation.json`,
		bytes: Buffer.from(`${JSON.stringify(evaluation, null, '\t')}\n`)
	},
	{ pathname: `${reviewRoot}/contact-sheet.png`, bytes: contactSheet },
	{ pathname: `${experimentRoot}/generation-record.md`, bytes: Buffer.from(record) }
];

let inSync = true;
for (const artifact of artifacts) {
	const destination = path.resolve(workspaceRoot, artifact.pathname);
	const current = await readFile(destination).catch(() => null);
	const matches = current?.equals(artifact.bytes) ?? false;
	inSync &&= matches;
	if (write && !matches) {
		await mkdir(path.dirname(destination), { recursive: true });
		await writeFile(destination, artifact.bytes);
	}
}

if (check && !inSync) throw new Error('Affinity expansion review artifacts are missing or stale.');

process.stdout.write(
	`${JSON.stringify({ mode: write ? 'write' : 'check', speciesCount: manifest.species.length, targetCount: entries.length, candidateCount, reviseCount, contactSheetSha256: sha256(contactSheet), artifacts: artifacts.map(({ pathname }) => pathname), inSync: write || inSync }, null, 2)}\n`
);
