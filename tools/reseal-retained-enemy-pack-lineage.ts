import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const RETAINED_ENEMY_PACK_MANIFEST_PATH =
	'assets/enemies/legacy/affinity-pack-v1/manifest.json';
export const RETAINED_FAMILY_AFFINITY_PACK_PATH =
	'assets/enemies/experiments/family-affinity-v1/retained-pack.json';

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export async function resealRetainedEnemyPackLineage(options: {
	readonly root?: string;
	readonly mode: 'write' | 'check';
}): Promise<{ readonly sources: number; readonly resealed: number }> {
	const root = path.resolve(options.root ?? process.cwd());
	const manifestPath = path.join(root, ...RETAINED_ENEMY_PACK_MANIFEST_PATH.split('/'));
	const source = await readFile(manifestPath, 'utf8');
	const manifest = JSON.parse(source) as {
		readonly sources?: readonly {
			readonly catalogPath?: unknown;
			readonly catalogSha256?: unknown;
		}[];
	};
	if (!Array.isArray(manifest.sources)) throw new Error('Retained enemy pack sources are invalid');
	const replacements: { readonly current: string; readonly next: string }[] = [];
	for (const record of manifest.sources) {
		if (typeof record.catalogPath !== 'string' || typeof record.catalogSha256 !== 'string') {
			throw new Error('Retained enemy pack catalog binding is invalid');
		}
		const digest = sha256(await readFile(path.join(root, ...record.catalogPath.split('/'))));
		if (record.catalogSha256 !== digest) {
			replacements.push({ current: record.catalogSha256, next: digest });
		}
	}
	if (replacements.length > 0 && options.mode === 'check') {
		throw new Error('Retained enemy pack catalog lineage is stale');
	}
	if (replacements.length > 0) {
		const expected = replacements.reduce(
			(contents, replacement) => contents.replaceAll(replacement.current, replacement.next),
			source
		);
		await writeFile(manifestPath, expected, 'utf8');
	}
	const retainedPackPath = path.join(root, ...RETAINED_FAMILY_AFFINITY_PACK_PATH.split('/'));
	const retainedPackSource = await readFile(retainedPackPath, 'utf8');
	const retainedPack = JSON.parse(retainedPackSource) as {
		readonly sourceManifest?: { readonly path?: unknown; readonly sha256?: unknown };
	};
	if (
		typeof retainedPack.sourceManifest?.path !== 'string' ||
		typeof retainedPack.sourceManifest.sha256 !== 'string'
	) {
		throw new Error('Retained family-affinity source manifest binding is invalid');
	}
	const sourceManifestHash = sha256(
		await readFile(path.join(root, ...retainedPack.sourceManifest.path.split('/')))
	);
	const familyAffinityStale = retainedPack.sourceManifest.sha256 !== sourceManifestHash;
	if (familyAffinityStale && options.mode === 'check') {
		throw new Error('Retained family-affinity source manifest lineage is stale');
	}
	if (familyAffinityStale) {
		await writeFile(
			retainedPackPath,
			retainedPackSource.replaceAll(retainedPack.sourceManifest.sha256, sourceManifestHash),
			'utf8'
		);
	}
	return {
		sources: manifest.sources.length,
		resealed: replacements.length + Number(familyAffinityStale)
	};
}

function parseMode(args: readonly string[]): 'write' | 'check' {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	if (normalized.length !== 1 || !['--write', '--check'].includes(normalized[0] ?? '')) {
		throw new Error('Expected exactly --write or --check');
	}
	return normalized[0] === '--write' ? 'write' : 'check';
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	resealRetainedEnemyPackLineage({ mode: parseMode(process.argv.slice(2)) })
		.then((report) => process.stdout.write(`${JSON.stringify(report)}\n`))
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}
