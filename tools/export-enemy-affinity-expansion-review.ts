import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
const generatedAt = '2026-08-30T23:30:00.000Z';

function versioned(pathname: string, version: (typeof versions)[number]): string {
	return pathname.replace(/-v1(?=\.[^.]+$)/u, `-${version}`);
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
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
const expectedTargetCount = manifest.species.reduce(
	(total, species) => total + species.targetPaths.length,
	0
);
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
		allTargetsRetained: entries.length === expectedTargetCount,
		allTargetsCandidates: candidateCount === entries.length && reviseCount === 0,
		remainingReviseCount: reviseCount,
		contentHashesVerified: true,
		catalogTargetCount: entries.length
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
const catalogBytes = Buffer.from(`${JSON.stringify(catalog, null, '\t')}\n`);
const record = `# Affinity expansion generation record\n\n- Experiment: \`${manifest.experimentId}\`\n- Completed: ${generatedAt}\n- Species: ${manifest.species.length}\n- Canonical targets: ${entries.length}\n- Producer candidates: ${candidateCount}\n- Remaining revisions: ${reviseCount}\n- Catalog SHA-256: \`${sha256(catalogBytes)}\`\n- Human review: pending\n\nEach catalog entry resolves the newest valid candidate in v3 → v2 → v1 order, verifies its retained-image hash, and preserves the exact result receipt. No image is promoted to runtime or approved by this record. Reproducible contact sheets are generated on demand and are not retained as source authority.\n`;
const artifacts: Array<{ pathname: string; bytes: Buffer }> = [
	{
		pathname: `${reviewRoot}/catalog.json`,
		bytes: catalogBytes
	},
	{
		pathname: `${reviewRoot}/evaluation.json`,
		bytes: Buffer.from(`${JSON.stringify(evaluation, null, '\t')}\n`)
	},
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
	`${JSON.stringify({ mode: write ? 'write' : 'check', speciesCount: manifest.species.length, targetCount: entries.length, candidateCount, reviseCount, catalogSha256: sha256(catalogBytes), artifacts: artifacts.map(({ pathname }) => pathname), inSync: write || inSync }, null, 2)}\n`
);
