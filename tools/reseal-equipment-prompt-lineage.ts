import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EQUIPMENT_V3_ROOT = 'assets/equipment/experiments/material-equipment-v3';

export interface EquipmentPromptLineageDocument {
	readonly path: string;
	readonly contents: string;
}

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function visit(value: unknown, visitor: (record: Record<string, unknown>) => void): void {
	if (value === null || typeof value !== 'object') return;
	if (Array.isArray(value)) {
		for (const child of value) visit(child, visitor);
		return;
	}
	const record = value as Record<string, unknown>;
	visitor(record);
	for (const child of Object.values(record)) visit(child, visitor);
}

export function resealEquipmentPromptLineageDocuments(
	documents: readonly EquipmentPromptLineageDocument[]
): readonly EquipmentPromptLineageDocument[] {
	const parsed = documents.map((document) => ({
		...document,
		value: JSON.parse(document.contents) as unknown
	}));
	const replacements = new Map<string, string>();
	for (const document of parsed) {
		visit(document.value, (record) => {
			if (typeof record.prompt !== 'string' || typeof record.promptSha256 !== 'string') return;
			const projected = sha256(record.prompt);
			if (projected === record.promptSha256) return;
			const existing = replacements.get(record.promptSha256);
			if (existing !== undefined && existing !== projected) {
				throw new Error('Ambiguous equipment prompt digest successor');
			}
			replacements.set(record.promptSha256, projected);
		});
	}
	if (replacements.size === 0) return [];

	const changed: EquipmentPromptLineageDocument[] = [];
	for (const document of parsed) {
		let modified = false;
		visit(document.value, (record) => {
			if (typeof record.promptSha256 !== 'string') return;
			const replacement = replacements.get(record.promptSha256);
			if (replacement === undefined || replacement === record.promptSha256) return;
			record.promptSha256 = replacement;
			modified = true;
		});
		if (!modified) continue;
		changed.push({
			path: document.path,
			contents: `${JSON.stringify(document.value, null, '\t')}\n`
		});
	}
	return changed;
}

export function selectEquipmentPromptLineagePaths(paths: readonly string[]): readonly string[] {
	const prefix = `${EQUIPMENT_V3_ROOT}/`;
	return paths
		.filter((repositoryPath) => {
			if (!repositoryPath.startsWith(prefix) || !repositoryPath.endsWith('.json')) return false;
			const relative = repositoryPath.slice(prefix.length);
			return (
				relative.startsWith('assignments/') ||
				relative.startsWith('results/') ||
				/^revisions\/.+\/(?:assignment|result)\.json$/u.test(relative) ||
				/^direction\/class-progressions\/(?:revisions\/)?[^/]+\.(?:assignment|result)\.json$/u.test(
					relative
				)
			);
		})
		.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

async function listJsonFiles(directory: string, repositoryRoot: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const paths = await Promise.all(
		entries.map(async (entry) => {
			const absolute = path.join(directory, entry.name);
			if (entry.isDirectory()) return listJsonFiles(absolute, repositoryRoot);
			if (!entry.isFile() || !entry.name.endsWith('.json')) return [];
			return [path.relative(repositoryRoot, absolute).replaceAll(path.sep, '/')];
		})
	);
	return paths.flat();
}

async function main(): Promise<void> {
	const repositoryRoot = process.cwd();
	const paths = selectEquipmentPromptLineagePaths(
		await listJsonFiles(path.join(repositoryRoot, ...EQUIPMENT_V3_ROOT.split('/')), repositoryRoot)
	);
	const documents = await Promise.all(
		paths.map(async (repositoryPath) => ({
			path: repositoryPath,
			contents: await readFile(path.join(repositoryRoot, ...repositoryPath.split('/')), 'utf8')
		}))
	);
	const changed = resealEquipmentPromptLineageDocuments(documents);
	await Promise.all(
		changed.map((document) =>
			writeFile(path.join(repositoryRoot, ...document.path.split('/')), document.contents, 'utf8')
		)
	);
	process.stdout.write(
		`${JSON.stringify({ scanned: documents.length, resealed: changed.length })}\n`
	);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
