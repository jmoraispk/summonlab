import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { stableFamilyAffinityJson } from './family-affinity-production-lib.js';

const WAVE_PATH = 'assets/enemies/experiments/family-affinity-v1/waves/earth-bridge-v1.json';
const MAPPING_PATH = 'assets/enemies/experiments/family-affinity-v1/current-class-mapping.json';
const VISUAL_INDEX_PATH = 'docs/wiki/creatures/monsters/visual-index.json';
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

type EarthBridgeWave = {
	schemaVersion?: unknown;
	waveId?: unknown;
	sourceMappingPath?: unknown;
	sourceMappingSha256?: unknown;
	sourceVisualIndexPath?: unknown;
	sourceVisualIndexSha256?: unknown;
	[key: string]: unknown;
};

async function exactRegularPath(repositoryRoot: string, repositoryPath: string): Promise<string> {
	const root = await realpath(path.resolve(repositoryRoot));
	const absolute = path.resolve(root, ...repositoryPath.split('/'));
	if (absolute === root || !absolute.startsWith(`${root}${path.sep}`)) {
		throw new Error(`Historical source path escapes repository: ${repositoryPath}`);
	}
	let cursor = root;
	for (const part of path.relative(root, absolute).split(path.sep).filter(Boolean)) {
		cursor = path.join(cursor, part);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) {
			throw new Error(`Historical source path is symlinked: ${repositoryPath}`);
		}
		if (cursor === absolute && !metadata.isFile()) {
			throw new Error(`Historical source path is not a regular file: ${repositoryPath}`);
		}
	}
	return absolute;
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function assertEarthBridgeWave(value: unknown): asserts value is EarthBridgeWave & {
	sourceMappingSha256: string;
	sourceVisualIndexSha256: string;
} {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Historical Earth bridge wave must be an object');
	}
	const wave = value as EarthBridgeWave;
	if (
		wave.schemaVersion !== 'earth-bridge-wave-v1' ||
		wave.waveId !== 'earth-bridge-v1' ||
		wave.sourceMappingPath !== MAPPING_PATH ||
		wave.sourceVisualIndexPath !== VISUAL_INDEX_PATH
	) {
		throw new Error('Historical Earth bridge wave must retain exact historical source paths');
	}
	if (
		typeof wave.sourceMappingSha256 !== 'string' ||
		!SHA256_PATTERN.test(wave.sourceMappingSha256) ||
		typeof wave.sourceVisualIndexSha256 !== 'string' ||
		!SHA256_PATTERN.test(wave.sourceVisualIndexSha256)
	) {
		throw new Error('Historical Earth bridge wave has invalid source seals');
	}
}

export async function resealHistoricalEarthBridgeSources(input: {
	repositoryRoot: string;
	write: boolean;
}) {
	const waveAbsolute = await exactRegularPath(input.repositoryRoot, WAVE_PATH);
	const waveSource = await readFile(waveAbsolute, 'utf8');
	const wave = JSON.parse(waveSource) as unknown;
	assertEarthBridgeWave(wave);
	const mappingBytes = await readFile(await exactRegularPath(input.repositoryRoot, MAPPING_PATH));
	const sourceMappingSha256 = sha256(mappingBytes);
	const drifted = wave.sourceMappingSha256 !== sourceMappingSha256;
	if (!drifted) {
		return { mode: 'check' as const, sourceMappingSha256 };
	}
	if (!input.write) throw new Error('Historical Earth bridge source seal drifted');

	const resealed = {
		...wave,
		sourceMappingSha256
	};
	await writeFile(waveAbsolute, stableFamilyAffinityJson(resealed), 'utf8');
	return { mode: 'write' as const, sourceMappingSha256 };
}

async function main(): Promise<void> {
	const mode = process.argv[2];
	if (mode !== '--write' && mode !== '--check') {
		throw new Error('usage: reseal-historical-earth-bridge-sources.ts --write|--check');
	}
	const result = await resealHistoricalEarthBridgeSources({
		repositoryRoot: process.cwd(),
		write: mode === '--write'
	});
	process.stdout.write(
		`${result.mode === 'write' ? 'Resealed' : 'Verified'} historical Earth bridge source hashes.\n`
	);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
