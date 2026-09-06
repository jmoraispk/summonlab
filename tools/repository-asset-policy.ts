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
	readonly trackedFileCount: number;
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

export async function validateRepositoryAssets(
	workspaceRoot: string
): Promise<RepositoryAssetValidationSummary> {
	const tracked = trackedFiles(workspaceRoot);
	const trackedSet = new Set(tracked);
	const catalog = await readCatalog(workspaceRoot);
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
		trackedFileCount: tracked.length
	};
}
