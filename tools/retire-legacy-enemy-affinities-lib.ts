import { posix } from 'node:path';

export const RETIREMENT_RECURSIVE_ROOTS = [
	'assets/enemies/experiments/affinity-workflow-v1',
	'assets/enemies/experiments/affinity-expansion-v1',
	'apps/web/static/wiki-media/monsters',
	'apps/web/src/routes/forge/enemies/affinity-workflow',
	'apps/web/src/routes/forge/enemies/affinity-expansion'
] as const;

export const RETIREMENT_EXACT_DELETION_FILES = [
	'apps/web/src/routes/forge/enemies/affinity-workflow.e2e.ts',
	'apps/web/src/routes/forge/enemies/affinity-expansion.e2e.ts'
] as const;

export const RETIREMENT_EXACT_EDIT_FILES = [
	'apps/web/src/lib/components/wiki/MonsterVisualMatrix.svelte',
	'apps/web/src/routes/wiki/monster-database.e2e.ts',
	'apps/web/src/routes/forge/+page.svelte',
	'apps/web/src/routes/forge/enemies/+page.svelte',
	'apps/web/src/routes/forge/enemies/all/+page.svelte',
	'apps/web/src/routes/forge/enemies/all.e2e.ts',
	'apps/web/src/lib/server/wiki.spec.ts',
	'docs/wiki/art/monster-gallery.md',
	'docs/wiki/systems/visuals.md',
	'docs/wiki/creatures/monster-races/README.md',
	'docs/wiki/creatures/monsters/visual-index.json',
	'package.json',
	'tools/export-wiki-monster-database.ts',
	'tools/wiki-monster-database-lib.ts',
	'tools/wiki-monster-database-lib.spec.ts'
] as const;

export const RETIREMENT_EXACT_FILES = [
	...RETIREMENT_EXACT_EDIT_FILES,
	...RETIREMENT_EXACT_DELETION_FILES
] as const;

const LEGACY_AFFINITIES = new Set(['wood', 'metal']);
const ROUTE_ROOTS = new Set<string>(RETIREMENT_RECURSIVE_ROOTS.slice(3));
const EXPERIMENT_ROOTS = new Set<string>(RETIREMENT_RECURSIVE_ROOTS.slice(0, 2));
const PUBLIC_ROOT = RETIREMENT_RECURSIVE_ROOTS[2];

export type RetirementFile = {
	readonly path: string;
	/** UTF-8 text, or null for binary content. */
	readonly content: string | null;
};

export type RetirementDeletion = {
	readonly path: string;
	readonly kind:
		| 'legacy-json'
		| 'legacy-image'
		| 'public-derivative'
		| 'composite'
		| 'route'
		| 'obsolete-route-test';
};

export type RetirementRewrite = { readonly path: string; readonly content: string };
export type DanglingReference = { readonly path: string; readonly reference: string };

export type RetirementPlan = {
	readonly deletions: readonly RetirementDeletion[];
	readonly rewrites: readonly RetirementRewrite[];
	readonly danglingReferences: readonly DanglingReference[];
	readonly escapedPaths: readonly string[];
};

function normalizeRepositoryPath(path: string): string | null {
	const slashPath = path.replaceAll('\\', '/');
	const normalized = posix.normalize(slashPath);
	if (posix.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../'))
		return null;
	return normalized.replace(/^\.\//u, '');
}

function insideRoot(path: string, root: string): boolean {
	return path === root || path.startsWith(`${root}/`);
}

function recursiveRoot(path: string): string | undefined {
	return RETIREMENT_RECURSIVE_ROOTS.find((root) => insideRoot(path, root));
}

function isAllowlisted(path: string): boolean {
	return recursiveRoot(path) !== undefined || RETIREMENT_EXACT_FILES.includes(path as never);
}

function isDeletionAllowlisted(path: string): boolean {
	return (
		recursiveRoot(path) !== undefined || RETIREMENT_EXACT_DELETION_FILES.includes(path as never)
	);
}

function parseJson(content: string | null): unknown | undefined {
	if (content === null) return undefined;
	try {
		return JSON.parse(content) as unknown;
	} catch {
		return undefined;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function affinityOf(value: unknown): string | undefined {
	if (!isRecord(value) || typeof value.affinity !== 'string') return undefined;
	return value.affinity.toLowerCase();
}

function structuredAffinityFromPath(path: string): string | undefined {
	const stem = posix
		.basename(path)
		.replace(/\.(?:json|png|webp)$/u, '')
		.replace(/-v\d+$/u, '');
	if (LEGACY_AFFINITIES.has(stem)) return stem;
	const match = stem.match(/-(wood|metal)(?:-v\d+)?$/u);
	return match?.[1];
}

function deletionFor(file: RetirementFile, normalized: string): RetirementDeletion | undefined {
	if (RETIREMENT_EXACT_DELETION_FILES.includes(normalized as never)) {
		return { path: normalized, kind: 'obsolete-route-test' };
	}
	const root = recursiveRoot(normalized);
	const parsed = normalized.endsWith('.json') ? parseJson(file.content) : undefined;
	const affinity = affinityOf(parsed) ?? structuredAffinityFromPath(normalized);

	if (!root) {
		if (affinity && LEGACY_AFFINITIES.has(affinity)) {
			return {
				path: normalized,
				kind: normalized.endsWith('.json') ? 'legacy-json' : 'legacy-image'
			};
		}
		return undefined;
	}
	if (ROUTE_ROOTS.has(root)) return { path: normalized, kind: 'route' };
	if (EXPERIMENT_ROOTS.has(root) && /(?:^|\/)contact-sheet\.png$/u.test(normalized)) {
		return { path: normalized, kind: 'composite' };
	}
	if (!affinity || !LEGACY_AFFINITIES.has(affinity)) return undefined;
	if (root === PUBLIC_ROOT) return { path: normalized, kind: 'public-derivative' };
	return { path: normalized, kind: normalized.endsWith('.json') ? 'legacy-json' : 'legacy-image' };
}

function collectOwnedReferences(value: unknown, output: Set<string>, key = ''): void {
	if (typeof value === 'string') {
		if (
			/^(?:targetId|assignmentId|resultId|attemptId)$/u.test(key) ||
			(/(?:Path|File)$/u.test(key) && structuredAffinityFromPath(value) !== undefined)
		) {
			output.add(value);
		}
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) collectOwnedReferences(item, output, key);
		return;
	}
	if (isRecord(value)) {
		for (const [childKey, item] of Object.entries(value)) {
			collectOwnedReferences(item, output, childKey);
		}
	}
}

function hasDeletedReference(value: unknown, references: ReadonlySet<string>): boolean {
	if (!isRecord(value)) return false;
	if (LEGACY_AFFINITIES.has(affinityOf(value) ?? '')) return true;
	return Object.values(value).some((entry) => {
		if (typeof entry === 'string') return references.has(entry);
		return false;
	});
}

function updateCounts(record: Record<string, unknown>): void {
	if (Array.isArray(record.targetPaths) && 'targetCount' in record) {
		record.targetCount = record.targetPaths.length;
	}
	const entries = Array.isArray(record.entries) ? record.entries : undefined;
	if (entries) {
		if ('targetCount' in record) record.targetCount = entries.length;
		if ('candidateCount' in record) {
			record.candidateCount = entries.filter(
				(entry) => isRecord(entry) && entry.status === 'candidate'
			).length;
		}
		if ('reviseCount' in record) {
			record.reviseCount = entries.filter(
				(entry) => isRecord(entry) && entry.status === 'revise'
			).length;
		}
		if ('speciesCount' in record) {
			record.speciesCount = new Set(
				entries.flatMap((entry) =>
					isRecord(entry) && typeof entry.speciesId === 'string' ? [entry.speciesId] : []
				)
			).size;
		}
	}
	if (isRecord(record.counts) && Array.isArray(record.affinities)) {
		const countRecord = record.counts;
		for (const key of Object.keys(countRecord)) {
			if (LEGACY_AFFINITIES.has(key.toLowerCase())) delete countRecord[key];
		}
		if (Array.isArray(record.species)) {
			const speciesCount = record.species.length;
			const affinityCount = record.affinities.length;
			const targetCount = speciesCount * affinityCount;
			if ('species' in countRecord) countRecord.species = speciesCount;
			if ('affinitiesPerSpecies' in countRecord) {
				countRecord.affinitiesPerSpecies = affinityCount;
			}
			if ('targets' in countRecord) countRecord.targets = targetCount;
			if ('assignments' in countRecord) countRecord.assignments = targetCount;
			if ('ownedOutputPaths' in countRecord) countRecord.ownedOutputPaths = targetCount * 2;
			if ('maximumProviderCallsWithOneRetry' in countRecord) {
				countRecord.maximumProviderCallsWithOneRetry = targetCount * 2;
			}
			delete record.baselineGuard;
		}
	}
}

function removeLegacy(
	value: unknown,
	references: ReadonlySet<string>,
	parentKey?: string
): unknown {
	if (Array.isArray(value)) {
		return value.flatMap((item) => {
			if (typeof item === 'string' && references.has(item)) return [];
			if (
				typeof item === 'string' &&
				LEGACY_AFFINITIES.has(item.toLowerCase()) &&
				/(?:affinit|visualstud|sourcevisuallabel)/iu.test(parentKey ?? '')
			) {
				return [];
			}
			if (hasDeletedReference(item, references)) return [];
			return [removeLegacy(item, references, parentKey)];
		});
	}
	if (!isRecord(value)) return value;
	const result: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value)) {
		if (LEGACY_AFFINITIES.has(key.toLowerCase()) && /affinit/iu.test(parentKey ?? key)) continue;
		if (typeof item === 'string' && references.has(item)) continue;
		result[key] = removeLegacy(item, references, key);
	}
	updateCounts(result);
	return result;
}

function containsReference(content: string, reference: string): boolean {
	return reference.length >= 6 && content.includes(reference);
}

export function planLegacyAffinityRetirement(files: readonly RetirementFile[]): RetirementPlan {
	const normalizedFiles = files.map((file) => ({
		file,
		normalized: normalizeRepositoryPath(file.path)
	}));
	const escaped = new Set<string>();
	const deletions: RetirementDeletion[] = [];

	for (const { file, normalized } of normalizedFiles) {
		const candidate = deletionFor(file, normalized ?? file.path);
		if (!candidate) continue;
		if (!normalized || !isDeletionAllowlisted(normalized)) {
			escaped.add(file.path);
			continue;
		}
		deletions.push(candidate);
	}

	const deletionPaths = new Set(deletions.map((entry) => entry.path));
	const references = new Set<string>(deletionPaths);
	for (const { file, normalized } of normalizedFiles) {
		if (!normalized || !deletionPaths.has(normalized)) continue;
		const parsed = parseJson(file.content);
		if (parsed !== undefined) collectOwnedReferences(parsed, references);
	}

	const rewrites: RetirementRewrite[] = [];
	for (const { file, normalized } of normalizedFiles) {
		if (!normalized || deletionPaths.has(normalized) || !isAllowlisted(normalized)) continue;
		if (!normalized.endsWith('.json') || file.content === null) continue;
		const parsed = parseJson(file.content);
		if (parsed === undefined) continue;
		const transformed = removeLegacy(parsed, references);
		if (JSON.stringify(transformed) === JSON.stringify(parsed)) continue;
		const indentation = /\n\t/u.test(file.content) ? '\t' : 2;
		const content = `${JSON.stringify(transformed, null, indentation)}\n`;
		rewrites.push({ path: normalized, content });
	}

	const rewriteByPath = new Map(rewrites.map((entry) => [entry.path, entry.content]));
	const danglingReferences: DanglingReference[] = [];
	for (const { file, normalized } of normalizedFiles) {
		if (!normalized || deletionPaths.has(normalized) || file.content === null) continue;
		const content = rewriteByPath.get(normalized) ?? file.content;
		for (const reference of references) {
			if (containsReference(content, reference)) {
				danglingReferences.push({ path: normalized, reference });
			}
		}
	}

	return {
		deletions: deletions.sort((left, right) => left.path.localeCompare(right.path)),
		rewrites: rewrites.sort((left, right) => left.path.localeCompare(right.path)),
		danglingReferences: danglingReferences.sort(
			(left, right) =>
				left.path.localeCompare(right.path) || left.reference.localeCompare(right.reference)
		),
		escapedPaths: [...escaped].sort()
	};
}
