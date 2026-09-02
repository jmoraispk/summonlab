import { lstat, readFile, readdir, realpath, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	planLegacyAffinityRetirement,
	RETIREMENT_EXACT_FILES,
	RETIREMENT_RECURSIVE_ROOTS,
	type RetirementFile
} from './retire-legacy-enemy-affinities-lib.js';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRealRoot = await realpath(repositoryRoot);

function repositoryPath(path: string): string {
	return relative(repositoryRoot, path).split(sep).join('/');
}

function assertInsideRepository(path: string): void {
	const normalizedRoot = `${repositoryRealRoot}${sep}`;
	if (path !== repositoryRealRoot && !path.startsWith(normalizedRoot)) {
		throw new Error(`Resolved path escapes repository: ${path}`);
	}
}

async function readRetirementFile(path: string): Promise<RetirementFile> {
	const stat = await lstat(path);
	if (stat.isSymbolicLink()) throw new Error(`Refusing symlink in retirement scope: ${path}`);
	const resolved = await realpath(path);
	assertInsideRepository(resolved);
	const extension = path.slice(path.lastIndexOf('.')).toLowerCase();
	const content = ['.json', '.md', '.ts', '.svelte'].includes(extension)
		? await readFile(path, 'utf8')
		: null;
	return { path: repositoryPath(path), content };
}

async function collectTree(root: string): Promise<RetirementFile[]> {
	const absoluteRoot = resolve(repositoryRoot, root);
	let resolvedRoot: string;
	try {
		resolvedRoot = await realpath(absoluteRoot);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	}
	assertInsideRepository(resolvedRoot);
	const files: RetirementFile[] = [];
	async function visit(directory: string): Promise<void> {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const path = resolve(directory, entry.name);
			if (entry.isSymbolicLink()) throw new Error(`Refusing symlink in retirement scope: ${path}`);
			if (entry.isDirectory()) await visit(path);
			else if (entry.isFile()) files.push(await readRetirementFile(path));
		}
	}
	await visit(absoluteRoot);
	return files;
}

const files = (
	await Promise.all([
		...RETIREMENT_RECURSIVE_ROOTS.map((root) => collectTree(root)),
		...RETIREMENT_EXACT_FILES.map(async (path) => {
			try {
				return [await readRetirementFile(resolve(repositoryRoot, path))];
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
				throw error;
			}
		})
	])
).flat();

const plan = planLegacyAffinityRetirement(files);
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

const counts = new Map<string, number>();
for (const deletion of plan.deletions) {
	counts.set(deletion.kind, (counts.get(deletion.kind) ?? 0) + 1);
}
console.log(
	`Retirement preview: ${plan.deletions.length} deletions, ${plan.rewrites.length} rewrites.`
);
for (const [kind, count] of [...counts].sort()) console.log(`  ${kind}: ${count}`);
for (const deletion of plan.deletions) console.log(`DELETE ${deletion.kind} ${deletion.path}`);
for (const rewrite of plan.rewrites) console.log(`REWRITE aggregate-json ${rewrite.path}`);

const write = process.argv.includes('--write');
const check = process.argv.includes('--check');
if (write === check) throw new Error('Pass exactly one of --check or --write');

if (write) {
	for (const deletion of plan.deletions) await unlink(resolve(repositoryRoot, deletion.path));
	for (const rewrite of plan.rewrites) {
		await writeFile(resolve(repositoryRoot, rewrite.path), rewrite.content);
	}
	for (const routeRoot of RETIREMENT_RECURSIVE_ROOTS.slice(3)) {
		await rm(resolve(repositoryRoot, routeRoot), { recursive: true, force: true });
	}
	console.log('Legacy enemy affinity retirement applied. Git history is the sole recovery path.');
}
