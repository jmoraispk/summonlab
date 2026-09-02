import { lstat, readFile, readdir, realpath, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	planLegacyAffinityRetirement,
	RETIREMENT_EXACT_DELETION_FILES,
	RETIREMENT_EXACT_EDIT_FILES,
	RETIREMENT_RECURSIVE_ROOTS,
	type RetirementFile,
	type RetirementPlan
} from './retire-legacy-enemy-affinities-lib.js';

export type RetirementMode = 'check' | 'write';

export type RunRetirementOptions = {
	readonly repositoryRoot: string;
	readonly mode: RetirementMode;
	readonly log?: (message: string) => void;
};

export type RunRetirementResult = {
	readonly plan: RetirementPlan;
	readonly deletionCounts: ReadonlyMap<string, number>;
};

function toRepositoryPath(repositoryRoot: string, path: string): string {
	return relative(repositoryRoot, path).split(sep).join('/');
}

function isInside(path: string, root: string): boolean {
	return path === root || path.startsWith(`${root}${sep}`);
}

function recursiveRootFor(path: string): string | undefined {
	return RETIREMENT_RECURSIVE_ROOTS.find((root) => path === root || path.startsWith(`${root}/`));
}

async function optionalLstat(path: string) {
	try {
		return await lstat(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
		throw error;
	}
}

async function assertNoSymlinkAncestors(repositoryRoot: string, path: string): Promise<void> {
	const repositoryAbsolute = resolve(repositoryRoot);
	const targetAbsolute = resolve(path);
	const targetRelative = relative(repositoryAbsolute, targetAbsolute);
	if (targetRelative === '..' || targetRelative.startsWith(`..${sep}`)) {
		throw new Error(`Exact retirement path escapes repository: ${targetAbsolute}`);
	}
	let current = repositoryAbsolute;
	for (const part of targetRelative.split(sep).filter(Boolean)) {
		current = resolve(current, part);
		const stat = await optionalLstat(current);
		if (!stat) return;
		if (stat.isSymbolicLink()) {
			throw new Error(
				`Symlinked ancestor in retirement scope: ${toRepositoryPath(repositoryAbsolute, current)}`
			);
		}
	}
}

function assertResolvedInside(resolvedPath: string, resolvedRoot: string, label: string): void {
	if (!isInside(resolvedPath, resolvedRoot)) {
		throw new Error(`${label} resolves outside authorized root: ${resolvedPath}`);
	}
}

function isTextFile(path: string): boolean {
	return ['.json', '.md', '.ts', '.svelte'].some((extension) => path.endsWith(extension));
}

async function readBoundedFile(
	repositoryRoot: string,
	path: string,
	resolvedAuthorizedRoot: string
): Promise<RetirementFile> {
	await assertNoSymlinkAncestors(repositoryRoot, path);
	const stat = await lstat(path);
	if (stat.isSymbolicLink()) throw new Error(`Refusing symlink in retirement scope: ${path}`);
	const resolvedPath = await realpath(path);
	assertResolvedInside(resolvedPath, resolvedAuthorizedRoot, 'Retirement file');
	const content = isTextFile(path) ? await readFile(path, 'utf8') : null;
	return { path: toRepositoryPath(repositoryRoot, path), content };
}

async function collectRecursiveRoot(
	repositoryRoot: string,
	repositoryRealRoot: string,
	root: string
): Promise<RetirementFile[]> {
	const absoluteRoot = resolve(repositoryRoot, root);
	const rootStat = await optionalLstat(absoluteRoot);
	if (!rootStat) return [];
	if (rootStat.isSymbolicLink()) throw new Error(`Recursive root is a symlink: ${root}`);
	await assertNoSymlinkAncestors(repositoryRoot, absoluteRoot);
	if (!rootStat.isDirectory())
		throw new Error(`Recursive retirement root is not a directory: ${root}`);
	const resolvedRoot = await realpath(absoluteRoot);
	assertResolvedInside(resolvedRoot, repositoryRealRoot, 'Recursive retirement root');

	const files: RetirementFile[] = [];
	async function visit(directory: string): Promise<void> {
		await assertNoSymlinkAncestors(repositoryRoot, directory);
		const resolvedDirectory = await realpath(directory);
		assertResolvedInside(resolvedDirectory, resolvedRoot, 'Traversed retirement directory');
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const path = resolve(directory, entry.name);
			if (entry.isSymbolicLink()) {
				throw new Error(
					`Refusing symlink in retirement traversal: ${toRepositoryPath(repositoryRoot, path)}`
				);
			}
			if (entry.isDirectory()) await visit(path);
			else if (entry.isFile())
				files.push(await readBoundedFile(repositoryRoot, path, resolvedRoot));
		}
	}
	await visit(absoluteRoot);
	return files;
}

async function collectExactFile(
	repositoryRoot: string,
	repositoryRealRoot: string,
	path: string
): Promise<RetirementFile[]> {
	const absolutePath = resolve(repositoryRoot, path);
	await assertNoSymlinkAncestors(repositoryRoot, absolutePath);
	const stat = await optionalLstat(absolutePath);
	if (!stat) return [];
	if (stat.isSymbolicLink()) throw new Error(`Refusing symlink exact retirement path: ${path}`);
	const resolvedPath = await realpath(absolutePath);
	assertResolvedInside(resolvedPath, repositoryRealRoot, 'Exact retirement file');
	if (resolvedPath !== absolutePath) {
		throw new Error(`Exact retirement file does not resolve to its authorized path: ${path}`);
	}
	return [await readBoundedFile(repositoryRoot, absolutePath, resolvedPath)];
}

async function collectRetirementFiles(
	repositoryRoot: string,
	repositoryRealRoot: string
): Promise<RetirementFile[]> {
	const groups: RetirementFile[][] = [];
	for (const root of RETIREMENT_RECURSIVE_ROOTS) {
		groups.push(await collectRecursiveRoot(repositoryRoot, repositoryRealRoot, root));
	}
	for (const path of [...RETIREMENT_EXACT_EDIT_FILES, ...RETIREMENT_EXACT_DELETION_FILES]) {
		groups.push(await collectExactFile(repositoryRoot, repositoryRealRoot, path));
	}
	return groups.flat();
}

async function validateOwnedExistingPath(
	repositoryRoot: string,
	repositoryRealRoot: string,
	repositoryPath: string
): Promise<void> {
	const absolutePath = resolve(repositoryRoot, repositoryPath);
	await assertNoSymlinkAncestors(repositoryRoot, absolutePath);
	const resolvedPath = await realpath(absolutePath);
	const root = recursiveRootFor(repositoryPath);
	if (root) {
		const absoluteRoot = resolve(repositoryRoot, root);
		const rootStat = await lstat(absoluteRoot);
		if (rootStat.isSymbolicLink()) throw new Error(`Recursive root is a symlink: ${root}`);
		const resolvedRoot = await realpath(absoluteRoot);
		assertResolvedInside(resolvedRoot, repositoryRealRoot, 'Recursive retirement root');
		assertResolvedInside(resolvedPath, resolvedRoot, 'Planned retirement path');
		return;
	}
	const exactAllowed =
		RETIREMENT_EXACT_EDIT_FILES.includes(repositoryPath as never) ||
		RETIREMENT_EXACT_DELETION_FILES.includes(repositoryPath as never);
	if (!exactAllowed || resolvedPath !== absolutePath) {
		throw new Error(`Planned exact path is not authorized: ${repositoryPath}`);
	}
}

async function removeEmptyRouteRoots(
	repositoryRoot: string,
	repositoryRealRoot: string
): Promise<void> {
	async function removeEmptyTree(directory: string, resolvedRoot: string): Promise<void> {
		await assertNoSymlinkAncestors(repositoryRoot, directory);
		const resolvedDirectory = await realpath(directory);
		assertResolvedInside(resolvedDirectory, resolvedRoot, 'Route retirement directory');
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const path = resolve(directory, entry.name);
			if (entry.isSymbolicLink()) {
				throw new Error(
					`Refusing symlink in route retirement tree: ${toRepositoryPath(repositoryRoot, path)}`
				);
			}
			if (entry.isDirectory()) await removeEmptyTree(path, resolvedRoot);
			else {
				throw new Error(
					`Refusing unplanned file in route retirement tree: ${toRepositoryPath(repositoryRoot, path)}`
				);
			}
		}
		await rmdir(directory);
	}

	for (const routeRoot of RETIREMENT_RECURSIVE_ROOTS.slice(3)) {
		const absoluteRoot = resolve(repositoryRoot, routeRoot);
		await assertNoSymlinkAncestors(repositoryRoot, absoluteRoot);
		const stat = await optionalLstat(absoluteRoot);
		if (!stat) continue;
		if (stat.isSymbolicLink()) throw new Error(`Recursive root is a symlink: ${routeRoot}`);
		const resolvedRoot = await realpath(absoluteRoot);
		assertResolvedInside(resolvedRoot, repositoryRealRoot, 'Route retirement root');
		await removeEmptyTree(absoluteRoot, resolvedRoot);
	}
}

function assertSafePlan(plan: RetirementPlan): void {
	if (plan.escapedPaths.length > 0) {
		throw new Error(`Retirement scope escaped allowlists:\n${plan.escapedPaths.join('\n')}`);
	}
	if (plan.danglingReferences.length > 0) {
		throw new Error(
			`Retirement would leave dangling active references:\n${plan.danglingReferences
				.map((entry) => `${entry.path}: ${entry.reference}`)
				.join('\n')}`
		);
	}
}

function reportPlan(
	plan: RetirementPlan,
	log: (message: string) => void
): ReadonlyMap<string, number> {
	const counts = new Map<string, number>();
	for (const deletion of plan.deletions) {
		counts.set(deletion.kind, (counts.get(deletion.kind) ?? 0) + 1);
	}
	log(`Retirement preview: ${plan.deletions.length} deletions, ${plan.rewrites.length} rewrites.`);
	for (const [kind, count] of [...counts].sort()) log(`  ${kind}: ${count}`);
	for (const deletion of plan.deletions) log(`DELETE ${deletion.kind} ${deletion.path}`);
	for (const rewrite of plan.rewrites) log(`REWRITE aggregate-json ${rewrite.path}`);
	return counts;
}

export async function runLegacyAffinityRetirement(
	options: RunRetirementOptions
): Promise<RunRetirementResult> {
	const repositoryRoot = resolve(options.repositoryRoot);
	const repositoryRealRoot = await realpath(repositoryRoot);
	const files = await collectRetirementFiles(repositoryRoot, repositoryRealRoot);
	const plan = planLegacyAffinityRetirement(files);
	assertSafePlan(plan);
	const log = options.log ?? console.log;
	const deletionCounts = reportPlan(plan, log);

	if (options.mode === 'write') {
		for (const deletion of plan.deletions) {
			await validateOwnedExistingPath(repositoryRoot, repositoryRealRoot, deletion.path);
			await unlink(resolve(repositoryRoot, deletion.path));
		}
		for (const rewrite of plan.rewrites) {
			await validateOwnedExistingPath(repositoryRoot, repositoryRealRoot, rewrite.path);
			await writeFile(resolve(repositoryRoot, rewrite.path), rewrite.content);
		}
		await removeEmptyRouteRoots(repositoryRoot, repositoryRealRoot);
		log('Legacy enemy affinity retirement applied. Git history is the sole recovery path.');
	}
	return { plan, deletionCounts };
}

async function main(): Promise<void> {
	const write = process.argv.includes('--write');
	const check = process.argv.includes('--check');
	if (write === check) throw new Error('Pass exactly one of --check or --write');
	const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
	await runLegacyAffinityRetirement({ repositoryRoot, mode: write ? 'write' : 'check' });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
