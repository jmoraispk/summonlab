import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const AFFINITY_WIKI_PROVENANCE_PATH =
	'assets/enemies/wiki/affinities/reference/provenance.json';

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export async function resealAffinityWikiProvenance(options: {
	readonly root?: string;
	readonly mode: 'write' | 'check';
}): Promise<{ readonly promotions: number; readonly resealed: number }> {
	const root = path.resolve(options.root ?? process.cwd());
	const provenancePath = path.join(root, ...AFFINITY_WIKI_PROVENANCE_PATH.split('/'));
	const source = await readFile(provenancePath, 'utf8');
	const provenance = JSON.parse(source) as {
		readonly promotions?: readonly { readonly output?: unknown; readonly sha256?: unknown }[];
	};
	if (!Array.isArray(provenance.promotions)) {
		throw new Error('Affinity wiki promotions are invalid');
	}
	const replacements: {
		readonly output: string;
		readonly current: string;
		readonly next: string;
	}[] = [];
	for (const promotion of provenance.promotions) {
		if (typeof promotion.output !== 'string' || typeof promotion.sha256 !== 'string') {
			throw new Error('Affinity wiki promotion binding is invalid');
		}
		const digest = sha256(await readFile(path.join(root, ...promotion.output.split('/'))));
		if (promotion.sha256 !== digest) {
			replacements.push({ output: promotion.output, current: promotion.sha256, next: digest });
		}
	}
	if (replacements.length > 0 && options.mode === 'check') {
		throw new Error('Affinity wiki promotion lineage is stale');
	}
	if (replacements.length > 0) {
		const expected = replacements.reduce((contents, replacement) => {
			const pattern = new RegExp(
				`("output"\\s*:\\s*"${escapeRegExp(replacement.output)}"[\\s\\S]*?"sha256"\\s*:\\s*")${escapeRegExp(replacement.current)}(")`,
				'u'
			);
			if (!pattern.test(contents)) {
				throw new Error(`Affinity wiki promotion ${replacement.output} cannot be resealed safely`);
			}
			return contents.replace(pattern, `$1${replacement.next}$2`);
		}, source);
		await writeFile(provenancePath, expected, 'utf8');
	}
	return { promotions: provenance.promotions.length, resealed: replacements.length };
}

function parseMode(args: readonly string[]): 'write' | 'check' {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	if (normalized.length !== 1 || !['--write', '--check'].includes(normalized[0] ?? '')) {
		throw new Error('Expected exactly --write or --check');
	}
	return normalized[0] === '--write' ? 'write' : 'check';
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	resealAffinityWikiProvenance({ mode: parseMode(process.argv.slice(2)) })
		.then((report) => process.stdout.write(`${JSON.stringify(report)}\n`))
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}
