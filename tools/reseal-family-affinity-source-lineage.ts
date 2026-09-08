import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	BridgeIdentityPacketSchema,
	FamilyPacketSchema,
	familyAffinityPromptSha256,
	familyAffinityRawSha256,
	familyAffinityReviewIssuerAttestationSha256,
	familyAffinitySha256
} from './family-affinity-production-lib.js';

const FAMILY_AFFINITY_ROOTS = [
	'assets/enemies/experiments/family-affinity-v1',
	'assets/enemies/experiments/fauna-family-v1'
] as const;
const FAMILY_PACKET_PATH_PATTERN = new RegExp(
	'^assets/enemies/experiments/(?:family-affinity-v1/(?:families|family-replacements|bridge/identities)|fauna-family-v1/families)/[^/]+\\.json$',
	'u'
);

function sourcePacketDigest(source: FamilyAffinitySourceLineageDocument): string {
	const parsed = JSON.parse(source.contents) as unknown;
	const packet = source.path.includes('/bridge/identities/')
		? BridgeIdentityPacketSchema.parse(parsed)
		: FamilyPacketSchema.parse(parsed);
	return familyAffinitySha256(packet);
}

export interface FamilyAffinitySourceLineageDocument {
	readonly path: string;
	readonly contents: string;
}

export function selectFamilyAffinitySourceLineagePaths(
	paths: readonly string[]
): readonly string[] {
	return paths
		.filter(
			(repositoryPath) =>
				FAMILY_AFFINITY_ROOTS.some((root) => repositoryPath.startsWith(`${root}/`)) &&
				repositoryPath.endsWith('.json') &&
				!FAMILY_AFFINITY_ROOTS.some((root) => repositoryPath.startsWith(`${root}/migrations/`))
		)
		.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

export function resealFamilyAffinitySourceLineageDocuments(
	source: FamilyAffinitySourceLineageDocument,
	documents: readonly FamilyAffinitySourceLineageDocument[]
): readonly FamilyAffinitySourceLineageDocument[] {
	if (!FAMILY_PACKET_PATH_PATTERN.test(source.path)) {
		throw new Error('Unexpected family-affinity source packet path');
	}
	const currentDigest = sourcePacketDigest(source);
	const staleDigests = new Set<string>();
	for (const document of documents) {
		const value = JSON.parse(document.contents) as unknown;
		if (value === null || typeof value !== 'object' || Array.isArray(value)) continue;
		const sources = (value as Record<string, unknown>).sources;
		if (sources === null || typeof sources !== 'object' || Array.isArray(sources)) continue;
		const binding = sources as Record<string, unknown>;
		if (binding.familyPacketPath !== source.path) continue;
		if (
			typeof binding.familyPacketSha256 !== 'string' ||
			!/^[0-9a-f]{64}$/u.test(binding.familyPacketSha256)
		) {
			throw new Error(`Invalid family-affinity source digest binding: ${document.path}`);
		}
		if (binding.familyPacketSha256 !== currentDigest) {
			staleDigests.add(binding.familyPacketSha256);
		}
	}
	if (staleDigests.size === 0) return [];
	const materialized = documents.map((document) => {
		let contents = document.contents;
		for (const staleDigest of staleDigests) {
			contents = contents.replaceAll(staleDigest, currentDigest);
		}
		return {
			...document,
			contents,
			value: JSON.parse(contents) as unknown,
			dirty: contents !== document.contents
		};
	});
	const byPath = new Map(materialized.map((document) => [document.path, document]));
	byPath.set(source.path, {
		...source,
		value: JSON.parse(source.contents) as unknown,
		dirty: true
	});

	const digestForReference = (repositoryPath: string, shaKey: string): string | undefined => {
		const document = byPath.get(repositoryPath);
		if (!document?.dirty) return undefined;
		if (/(?:result|review|receipt|manifest)sha256$/iu.test(shaKey)) {
			return familyAffinityRawSha256(
				document.dirty ? `${JSON.stringify(document.value)}\n` : document.contents
			);
		}
		return familyAffinitySha256(document.value);
	};
	const updatePathBindings = (value: unknown): boolean => {
		if (value === null || typeof value !== 'object') return false;
		let changed = false;
		if (Array.isArray(value)) {
			for (const child of value) changed = updatePathBindings(child) || changed;
			return changed;
		}
		const record = value as Record<string, unknown>;
		for (const [key, repositoryPath] of Object.entries(record)) {
			if (!key.endsWith('Path') || typeof repositoryPath !== 'string') continue;
			const shaKey = `${key.slice(0, -4)}Sha256`;
			if (typeof record[shaKey] !== 'string') continue;
			const digest = digestForReference(repositoryPath, shaKey);
			if (digest !== undefined && record[shaKey] !== digest) {
				record[shaKey] = digest;
				changed = true;
			}
		}
		for (const child of Object.values(record)) changed = updatePathBindings(child) || changed;
		return changed;
	};

	for (let iteration = 0; iteration < materialized.length * 4 + 4; iteration += 1) {
		let changed = false;
		for (const document of materialized) {
			if (updatePathBindings(document.value)) {
				document.dirty = true;
				changed = true;
			}
		}
		const targets = new Map(
			materialized
				.map((document) => ({ document, value: document.value }))
				.filter(
					(
						entry
					): entry is {
						document: (typeof materialized)[number];
						value: Record<string, unknown>;
					} =>
						entry.value !== null &&
						typeof entry.value === 'object' &&
						!Array.isArray(entry.value) &&
						(entry.value as Record<string, unknown>).schemaVersion ===
							'family-affinity-target-v1' &&
						typeof (entry.value as Record<string, unknown>).targetId === 'string'
				)
				.map((entry) => [entry.value.targetId as string, entry])
		);
		const assignments = new Map(
			materialized
				.map((document) => ({ document, value: document.value }))
				.filter(
					(
						entry
					): entry is {
						document: (typeof materialized)[number];
						value: Record<string, unknown>;
					} =>
						entry.value !== null &&
						typeof entry.value === 'object' &&
						!Array.isArray(entry.value) &&
						(entry.value as Record<string, unknown>).schemaVersion ===
							'family-affinity-assignment-v1' &&
						typeof (entry.value as Record<string, unknown>).targetId === 'string'
				)
				.map((entry) => [entry.value.targetId as string, entry])
		);
		const updateTargetBindings = (value: unknown): boolean => {
			if (value === null || typeof value !== 'object') return false;
			let bindingChanged = false;
			if (Array.isArray(value)) {
				for (const child of value) bindingChanged = updateTargetBindings(child) || bindingChanged;
				return bindingChanged;
			}
			const record = value as Record<string, unknown>;
			if (typeof record.targetId === 'string' && typeof record.targetSha256 === 'string') {
				const target = targets.get(record.targetId);
				const digest = target?.document.dirty ? familyAffinitySha256(target.value) : undefined;
				if (digest !== undefined && record.targetSha256 !== digest) {
					record.targetSha256 = digest;
					bindingChanged = true;
				}
			}
			for (const child of Object.values(record)) {
				bindingChanged = updateTargetBindings(child) || bindingChanged;
			}
			return bindingChanged;
		};
		for (const document of materialized) {
			if (updateTargetBindings(document.value)) {
				document.dirty = true;
				changed = true;
			}
		}
		if (changed) continue;
		for (const document of materialized) {
			const value = document.value;
			if (
				value === null ||
				typeof value !== 'object' ||
				Array.isArray(value) ||
				(value as Record<string, unknown>).schemaVersion !== 'family-affinity-generation-failure-v1'
			)
				continue;
			const failure = value as Record<string, unknown>;
			const targetId = failure.targetId;
			const target = typeof targetId === 'string' ? targets.get(targetId) : undefined;
			const assignment = typeof targetId === 'string' ? assignments.get(targetId) : undefined;
			if (
				!target ||
				!assignment ||
				(!target.document.dirty && !assignment.document.dirty) ||
				!Array.isArray(failure.producerRuns)
			)
				continue;
			const promptSha256 = familyAffinityPromptSha256(target.value, assignment.value);
			for (const runValue of failure.producerRuns) {
				if (runValue === null || typeof runValue !== 'object' || Array.isArray(runValue)) {
					continue;
				}
				const run = runValue as Record<string, unknown>;
				if (run.canonicalPromptSha256 !== promptSha256) {
					run.canonicalPromptSha256 = promptSha256;
					document.dirty = true;
					changed = true;
				}
				if (!Array.isArray(run.calls)) continue;
				for (const callValue of run.calls) {
					if (callValue === null || typeof callValue !== 'object' || Array.isArray(callValue)) {
						continue;
					}
					const call = callValue as Record<string, unknown>;
					if (call.promptSha256 !== promptSha256) {
						call.promptSha256 = promptSha256;
						document.dirty = true;
						changed = true;
					}
				}
			}
		}
		const results = new Map<
			string,
			{ document: (typeof materialized)[number]; value: Record<string, unknown> }
		>();
		for (const document of materialized) {
			const value = document.value;
			if (
				value === null ||
				typeof value !== 'object' ||
				Array.isArray(value) ||
				(value as Record<string, unknown>).schemaVersion !== 'family-affinity-result-v1' ||
				typeof (value as Record<string, unknown>).targetId !== 'string'
			)
				continue;
			const result = value as Record<string, unknown>;
			const targetId = result.targetId as string;
			const target = targets.get(targetId);
			const assignment = assignments.get(targetId);
			if (!target || !assignment) continue;
			if (target.document.dirty || assignment.document.dirty) {
				const promptSha256 = familyAffinityPromptSha256(target.value, assignment.value);
				if (result.promptSha256 !== promptSha256) {
					result.promptSha256 = promptSha256;
					document.dirty = true;
					changed = true;
				}
			}
			results.set(targetId, { document, value: result });
		}
		const updateResultBindings = (value: unknown): boolean => {
			if (value === null || typeof value !== 'object') return false;
			let bindingChanged = false;
			if (Array.isArray(value)) {
				for (const child of value) bindingChanged = updateResultBindings(child) || bindingChanged;
				return bindingChanged;
			}
			const record = value as Record<string, unknown>;
			const result = typeof record.targetId === 'string' ? results.get(record.targetId) : undefined;
			if (result?.document.dirty) {
				for (const key of ['promptSha256', 'sourceSha256'] as const) {
					if (typeof record[key] === 'string' && record[key] !== result.value[key]) {
						record[key] = result.value[key];
						bindingChanged = true;
					}
				}
			}
			for (const child of Object.values(record)) {
				bindingChanged = updateResultBindings(child) || bindingChanged;
			}
			return bindingChanged;
		};
		for (const document of materialized) {
			if (updateResultBindings(document.value)) {
				document.dirty = true;
				changed = true;
			}
		}
		for (const document of materialized) {
			const value = document.value;
			if (
				value === null ||
				typeof value !== 'object' ||
				Array.isArray(value) ||
				(value as Record<string, unknown>).schemaVersion !== 'family-affinity-review-assignment-v1'
			)
				continue;
			const review = value as Record<string, unknown>;
			const targetId = review.targetId;
			const target = typeof targetId === 'string' ? targets.get(targetId) : undefined;
			const assignment = typeof targetId === 'string' ? assignments.get(targetId) : undefined;
			const result = typeof targetId === 'string' ? results.get(targetId) : undefined;
			const resultDocument =
				typeof review.resultPath === 'string' ? byPath.get(review.resultPath) : undefined;
			if (!target || !assignment || !result || !resultDocument) continue;
			if (
				!document.dirty &&
				!target.document.dirty &&
				!assignment.document.dirty &&
				!result.document.dirty
			) {
				continue;
			}
			const issuerAttestationSha256 = familyAffinityReviewIssuerAttestationSha256({
				issuerId: review.issuerId as string,
				reviewerId: review.reviewerId as string,
				kind: review.reviewKind as 'ordinary' | 'blind',
				manifestPath: review.manifestPath as string,
				manifestSha256: review.manifestSha256 as string,
				target: target.value,
				targetPath: review.targetPath as string,
				productionAssignment: assignment.value,
				productionAssignmentPath: review.productionAssignmentPath as string,
				result: result.value as never,
				resultSha256: familyAffinityRawSha256(
					resultDocument.dirty
						? `${JSON.stringify(resultDocument.value)}\n`
						: resultDocument.contents
				),
				decisionVersion: review.decisionVersion as number,
				permittedReceiptPath: review.permittedReceiptPath as string
			});
			if (review.issuerAttestationSha256 !== issuerAttestationSha256) {
				review.issuerAttestationSha256 = issuerAttestationSha256;
				document.dirty = true;
				changed = true;
			}
		}
		if (!changed) break;
		if (iteration === materialized.length * 4 + 3) {
			throw new Error('Family-affinity source lineage failed to converge');
		}
	}

	return materialized.flatMap((document) => {
		const contents = document.dirty ? `${JSON.stringify(document.value)}\n` : document.contents;
		return contents === document.contents &&
			contents === documents.find(({ path }) => path === document.path)?.contents
			? []
			: [{ path: document.path, contents }];
	});
}

export function resealFamilyAffinitySourceLineagesDocuments(
	sources: readonly FamilyAffinitySourceLineageDocument[],
	documents: readonly FamilyAffinitySourceLineageDocument[]
): readonly FamilyAffinitySourceLineageDocument[] {
	const sourceByPath = new Map<string, FamilyAffinitySourceLineageDocument>();
	for (const source of sources) {
		if (sourceByPath.has(source.path)) {
			throw new Error(`Duplicate family-affinity source packet: ${source.path}`);
		}
		sourceByPath.set(source.path, source);
	}
	const successorDigestByStaleDigest = new Map<string, string>();
	for (const document of documents) {
		const value = JSON.parse(document.contents) as unknown;
		if (value === null || typeof value !== 'object' || Array.isArray(value)) continue;
		const sourcesValue = (value as Record<string, unknown>).sources;
		if (sourcesValue === null || typeof sourcesValue !== 'object' || Array.isArray(sourcesValue)) {
			continue;
		}
		const binding = sourcesValue as Record<string, unknown>;
		if (
			typeof binding.familyPacketPath !== 'string' ||
			typeof binding.familyPacketSha256 !== 'string'
		) {
			continue;
		}
		const source = sourceByPath.get(binding.familyPacketPath);
		if (!source) continue;
		const successorDigest = sourcePacketDigest(source);
		if (binding.familyPacketSha256 === successorDigest) continue;
		const existing = successorDigestByStaleDigest.get(binding.familyPacketSha256);
		if (existing !== undefined && existing !== successorDigest) {
			throw new Error('Ambiguous family-affinity source digest successor');
		}
		successorDigestByStaleDigest.set(binding.familyPacketSha256, successorDigest);
	}

	const originalByPath = new Map(documents.map((document) => [document.path, document.contents]));
	const currentByPath = new Map(documents.map((document) => [document.path, document]));
	for (const source of [...sourceByPath.values()].sort((left, right) =>
		left.path < right.path ? -1 : left.path > right.path ? 1 : 0
	)) {
		for (const changed of resealFamilyAffinitySourceLineageDocuments(source, [
			...currentByPath.values()
		])) {
			currentByPath.set(changed.path, changed);
		}
	}
	return documents.flatMap((document) => {
		const current = currentByPath.get(document.path)!;
		return current.contents === originalByPath.get(document.path) ? [] : [current];
	});
}

function collectFamilyPacketPaths(value: unknown, output: Set<string>): void {
	if (value === null || typeof value !== 'object') return;
	if (Array.isArray(value)) {
		for (const child of value) collectFamilyPacketPaths(child, output);
		return;
	}
	for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
		if (key === 'familyPacketPath' && typeof child === 'string') output.add(child);
		else collectFamilyPacketPaths(child, output);
	}
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
	const paths = selectFamilyAffinitySourceLineagePaths(
		(
			await Promise.all(
				FAMILY_AFFINITY_ROOTS.map((root) =>
					listJsonFiles(path.join(repositoryRoot, ...root.split('/')), repositoryRoot)
				)
			)
		).flat()
	);
	const documents = await Promise.all(
		paths.map(async (repositoryPath) => ({
			path: repositoryPath,
			contents: await readFile(path.join(repositoryRoot, ...repositoryPath.split('/')), 'utf8')
		}))
	);
	const packetPaths = new Set<string>();
	for (const document of documents) {
		collectFamilyPacketPaths(JSON.parse(document.contents) as unknown, packetPaths);
	}
	const documentByPath = new Map(documents.map((document) => [document.path, document]));
	const sources = [...packetPaths].sort().map((packetPath) => {
		const source = documentByPath.get(packetPath);
		if (!source) throw new Error(`Missing family-affinity source packet: ${packetPath}`);
		return source;
	});
	const changed = resealFamilyAffinitySourceLineagesDocuments(sources, documents);
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
