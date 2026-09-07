import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
	SummonableHeroCatalogSchema,
	type SummonableHeroCatalog
} from '../packages/contracts/src/index.js';
import sharp from 'sharp';

const approvedHeroRoot = 'assets/heroes/approved/summonable-roster-v1';
const retainedEnemyPackManifestPath = 'assets/enemies/legacy/affinity-pack-v1/manifest.json';

type HeroVisualRole = 'summon' | 'combat-chibi';

interface ApprovedHeroPaths {
	readonly heroId: string;
	readonly summon: string;
	readonly combatChibi: string;
}

export interface RepositoryAssetValidationSummary {
	readonly approvedHeroCount: number;
	readonly approvedHeroImageCount: number;
	readonly approvedHeroBytes: number;
	readonly retainedEnemyImageCount: number;
	readonly retainedEnemyBytes: number;
	readonly trackedFileCount: number;
}

interface RetainedEnemyPackPathInput {
	readonly candidateRoots: readonly string[];
	readonly selectedPaths: readonly string[];
	readonly trackedPngPaths: readonly string[];
}

interface RetainedEnemyPackManifest {
	readonly schemaVersion: 'retained-enemy-pack-v1';
	readonly packId: 'affinity-legacy-pack-v1';
	readonly state: 'retained-reference';
	readonly sources: readonly {
		readonly experimentId: string;
		readonly catalogPath: string;
		readonly catalogSha256: string;
		readonly candidateRoot: string;
		readonly candidateCount: number;
	}[];
	readonly summary: {
		readonly experimentCount: number;
		readonly candidateCount: number;
		readonly bytes: number;
	};
}

interface RetainedEnemyCatalog {
	readonly experimentId: string;
	readonly entries: readonly {
		readonly candidatePath: string;
		readonly contentHash?: string;
		readonly candidateHash?: string;
		readonly bytes?: number;
	}[];
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export function expectedApprovedHeroVisualPath(heroId: string, role: HeroVisualRole): string {
	return `${approvedHeroRoot}/sources/${heroId}/${role}.png`;
}

export function findRepositoryAssetPathViolations(paths: readonly string[]): string[] {
	const violations: string[] = [];
	for (const path of paths) {
		if (path.startsWith('assets/heroes/experiments/')) {
			violations.push(`Hero experiment output must not be tracked: ${path}`);
		}
		if (path.includes('/__pycache__/') || path.endsWith('.pyc')) {
			violations.push(`Python cache output must not be tracked: ${path}`);
		}
	}
	return violations;
}

export function findApprovedHeroPathViolations(entries: readonly ApprovedHeroPaths[]): string[] {
	const violations: string[] = [];
	const seen = new Set<string>();
	for (const entry of entries) {
		for (const [role, path] of [
			['summon', entry.summon],
			['combat-chibi', entry.combatChibi]
		] as const) {
			if (path !== expectedApprovedHeroVisualPath(entry.heroId, role)) {
				violations.push(`Approved ${role} path is not canonical for ${entry.heroId}: ${path}`);
			}
			if (seen.has(path)) violations.push(`Duplicate approved hero path: ${path}`);
			seen.add(path);
		}
	}
	return violations;
}

function insideRepositoryRoot(path: string, root: string): boolean {
	return path.startsWith(`${root}/`);
}

export function findRetainedEnemyPackPathViolations(input: RetainedEnemyPackPathInput): string[] {
	const violations: string[] = [];
	const selected = new Set<string>();
	const validSelected = new Set<string>();
	for (const path of input.selectedPaths) {
		if (selected.has(path)) {
			violations.push(`Duplicate retained enemy candidate: ${path}`);
			continue;
		}
		selected.add(path);
		if (!input.candidateRoots.some((root) => insideRepositoryRoot(path, root))) {
			violations.push(`Retained enemy candidate is outside declared roots: ${path}`);
			continue;
		}
		validSelected.add(path);
	}
	const tracked = new Set(input.trackedPngPaths);
	for (const path of [...validSelected].sort()) {
		if (!tracked.has(path)) violations.push(`Retained enemy candidate is not tracked: ${path}`);
	}
	for (const path of [...tracked].sort()) {
		if (!validSelected.has(path)) {
			violations.push(`Unselected enemy candidate must not be tracked: ${path}`);
		}
	}
	return violations;
}

function trackedFiles(workspaceRoot: string): string[] {
	return execFileSync('git', ['ls-files', '-z'], {
		cwd: workspaceRoot,
		encoding: 'utf8',
		maxBuffer: 1024 * 1024 * 64
	})
		.split('\0')
		.filter(Boolean);
}

function lfsFilters(workspaceRoot: string, paths: readonly string[]): Map<string, string> {
	const output = execFileSync('git', ['check-attr', '-z', 'filter', '--', ...paths], {
		cwd: workspaceRoot,
		encoding: 'utf8',
		maxBuffer: 1024 * 1024 * 8
	}).split('\0');
	const filters = new Map<string, string>();
	for (let index = 0; index + 2 < output.length; index += 3) {
		filters.set(output[index]!, output[index + 2]!);
	}
	return filters;
}

async function readCatalog(workspaceRoot: string): Promise<SummonableHeroCatalog> {
	return SummonableHeroCatalogSchema.parse(
		JSON.parse(await readFile(resolve(workspaceRoot, approvedHeroRoot, 'catalog.json'), 'utf8'))
	);
}

async function validateRetainedEnemyPack(
	workspaceRoot: string,
	tracked: readonly string[]
): Promise<{ candidateCount: number; bytes: number }> {
	const manifest = JSON.parse(
		await readFile(resolve(workspaceRoot, retainedEnemyPackManifestPath), 'utf8')
	) as RetainedEnemyPackManifest;
	const violations: string[] = [];
	if (
		manifest.schemaVersion !== 'retained-enemy-pack-v1' ||
		manifest.packId !== 'affinity-legacy-pack-v1' ||
		manifest.state !== 'retained-reference'
	) {
		violations.push('Retained enemy pack identity or state is invalid');
	}
	const expectedCounts = new Map([
		['affinity-expansion-v1', 136],
		['affinity-workflow-v1', 39]
	]);
	if (manifest.sources.length !== expectedCounts.size) {
		violations.push(
			`Retained enemy pack must declare ${expectedCounts.size} sources, found ${manifest.sources.length}`
		);
	}

	const selectedPaths: string[] = [];
	const candidateRoots: string[] = [];
	let retainedEnemyBytes = 0;
	for (const source of manifest.sources) {
		candidateRoots.push(source.candidateRoot);
		const expectedCount = expectedCounts.get(source.experimentId);
		if (expectedCount === undefined || source.candidateCount !== expectedCount) {
			violations.push(
				`Retained enemy source count is invalid for ${source.experimentId}: ${source.candidateCount}`
			);
		}
		const catalogBytes = await readFile(resolve(workspaceRoot, source.catalogPath));
		if (sha256(catalogBytes) !== source.catalogSha256) {
			violations.push(`Retained enemy source catalog hash mismatch: ${source.catalogPath}`);
		}
		const catalog = JSON.parse(catalogBytes.toString('utf8')) as RetainedEnemyCatalog;
		if (catalog.experimentId !== source.experimentId) {
			violations.push(`Retained enemy source catalog experiment mismatch: ${source.catalogPath}`);
		}
		if (!Array.isArray(catalog.entries) || catalog.entries.length !== source.candidateCount) {
			violations.push(`Retained enemy source catalog count mismatch: ${source.catalogPath}`);
			continue;
		}
		for (const entry of catalog.entries) {
			selectedPaths.push(entry.candidatePath);
			const expectedHash = entry.contentHash ?? entry.candidateHash;
			if (typeof expectedHash !== 'string') {
				violations.push(`Retained enemy candidate has no catalog hash: ${entry.candidatePath}`);
				continue;
			}
			const bytes = await readFile(resolve(workspaceRoot, entry.candidatePath));
			retainedEnemyBytes += bytes.byteLength;
			if (sha256(bytes) !== expectedHash) {
				violations.push(`Retained enemy candidate hash mismatch: ${entry.candidatePath}`);
			}
			if (entry.bytes !== undefined && entry.bytes !== bytes.byteLength) {
				violations.push(`Retained enemy candidate byte count mismatch: ${entry.candidatePath}`);
			}
		}
	}

	const trackedPngPaths = tracked.filter(
		(path) =>
			path.endsWith('.png') && candidateRoots.some((root) => insideRepositoryRoot(path, root))
	);
	violations.push(
		...findRetainedEnemyPackPathViolations({
			candidateRoots,
			selectedPaths,
			trackedPngPaths
		})
	);
	const filters = lfsFilters(workspaceRoot, selectedPaths);
	for (const path of selectedPaths) {
		if (filters.get(path) !== 'lfs') {
			violations.push(`Retained enemy candidate is not covered by Git LFS: ${path}`);
		}
	}
	if (
		manifest.summary.experimentCount !== 2 ||
		manifest.summary.candidateCount !== 175 ||
		selectedPaths.length !== 175
	) {
		violations.push('Retained enemy pack must contain exactly 175 candidates from two experiments');
	}
	if (manifest.summary.bytes !== retainedEnemyBytes) {
		violations.push(
			`Retained enemy pack byte count mismatch: expected ${manifest.summary.bytes}, found ${retainedEnemyBytes}`
		);
	}
	if (violations.length > 0) throw new Error(violations.join('\n'));
	return { candidateCount: selectedPaths.length, bytes: retainedEnemyBytes };
}

export async function validateRepositoryAssets(
	workspaceRoot: string
): Promise<RepositoryAssetValidationSummary> {
	const tracked = trackedFiles(workspaceRoot);
	const trackedSet = new Set(tracked);
	const catalog = await readCatalog(workspaceRoot);
	const retainedEnemyPack = await validateRetainedEnemyPack(workspaceRoot, tracked);
	const violations = findRepositoryAssetPathViolations(tracked);
	violations.push(
		...findApprovedHeroPathViolations(
			catalog.entries.map((entry) => ({
				heroId: entry.heroId,
				summon: entry.visuals.summon.file,
				combatChibi: entry.visuals.combatChibi.file
			}))
		)
	);

	if (catalog.entries.length !== 200) {
		violations.push(
			`Approved summonable catalog must contain 200 heroes, found ${catalog.entries.length}`
		);
	}
	for (const evidence of catalog.sourceEvidence) {
		if (evidence.file.includes('/experiments/')) {
			violations.push(`Approved catalog evidence must not depend on experiments: ${evidence.file}`);
			continue;
		}
		const bytes = await readFile(resolve(workspaceRoot, evidence.file));
		if (sha256(bytes) !== evidence.contentHash) {
			violations.push(`Approved catalog evidence hash mismatch: ${evidence.file}`);
		}
	}

	const visualRecords = catalog.entries.flatMap((entry) => [
		entry.visuals.summon,
		entry.visuals.combatChibi
	]);
	const filters = lfsFilters(
		workspaceRoot,
		visualRecords.map((record) => record.file)
	);
	let approvedHeroBytes = 0;
	for (const record of visualRecords) {
		if (!trackedSet.has(record.file)) {
			violations.push(`Approved hero image is not tracked: ${record.file}`);
			continue;
		}
		if (filters.get(record.file) !== 'lfs') {
			violations.push(`Approved hero image is not covered by Git LFS: ${record.file}`);
		}
		const absolute = resolve(workspaceRoot, record.file);
		const bytes = await readFile(absolute);
		const [metadata, fileStat] = await Promise.all([sharp(bytes).metadata(), stat(absolute)]);
		approvedHeroBytes += fileStat.size;
		if (sha256(bytes) !== record.contentHash) {
			violations.push(`Approved hero image hash mismatch: ${record.file}`);
		}
		if (fileStat.size !== record.bytes) {
			violations.push(`Approved hero image byte count mismatch: ${record.file}`);
		}
		if (metadata.width !== record.width || metadata.height !== record.height) {
			violations.push(`Approved hero image dimensions mismatch: ${record.file}`);
		}
	}

	if (violations.length > 0) throw new Error(violations.join('\n'));
	return {
		approvedHeroCount: catalog.entries.length,
		approvedHeroImageCount: visualRecords.length,
		approvedHeroBytes,
		retainedEnemyImageCount: retainedEnemyPack.candidateCount,
		retainedEnemyBytes: retainedEnemyPack.bytes,
		trackedFileCount: tracked.length
	};
}
