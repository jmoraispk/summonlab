import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	FamilyPacketSchema,
	familyAffinityPromptSha256,
	familyAffinityRawSha256,
	familyAffinityReviewIssuerAttestationSha256,
	familyAffinitySha256
} from './family-affinity-production-lib.js';

const FAMILY_AFFINITY_ROOT = 'assets/enemies/experiments/family-affinity-v1';
const ELEMENTALS_PACKET_PATH = `${FAMILY_AFFINITY_ROOT}/family-replacements/21-elementals.json`;

export interface FamilyAffinitySourceLineageDocument {
	readonly path: string;
	readonly contents: string;
}

export function selectFamilyAffinitySourceLineagePaths(
	paths: readonly string[]
): readonly string[] {
	const prefix = `${FAMILY_AFFINITY_ROOT}/`;
	return paths
		.filter(
			(repositoryPath) =>
				repositoryPath === `${FAMILY_AFFINITY_ROOT}/manifest.json` ||
				(repositoryPath.startsWith(prefix) &&
					repositoryPath.includes('/elementals/') &&
					repositoryPath.endsWith('.json'))
		)
		.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

export function resealFamilyAffinitySourceLineageDocuments(
	source: FamilyAffinitySourceLineageDocument,
	documents: readonly FamilyAffinitySourceLineageDocument[]
): readonly FamilyAffinitySourceLineageDocument[] {
	if (source.path !== ELEMENTALS_PACKET_PATH) {
		throw new Error('Unexpected family-affinity source packet path');
	}
	const packet = FamilyPacketSchema.parse(JSON.parse(source.contents));
	if (packet.familyId !== 'elementals') {
		throw new Error('Family-affinity source packet identity is not elementals');
	}
	const currentDigest = familyAffinitySha256(packet);
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
	const materialized = documents.map((document) => {
		let contents = document.contents;
		for (const staleDigest of staleDigests) {
			contents = contents.replaceAll(staleDigest, currentDigest);
		}
		return { ...document, contents, value: JSON.parse(contents) as unknown, dirty: false };
	});
	const byPath = new Map(materialized.map((document) => [document.path, document]));
	byPath.set(source.path, { ...source, value: packet, dirty: false });

	const digestForReference = (repositoryPath: string, shaKey: string): string | undefined => {
		const document = byPath.get(repositoryPath);
		if (!document) return undefined;
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
				.map((document) => document.value)
				.filter(
					(value): value is Record<string, unknown> =>
						value !== null &&
						typeof value === 'object' &&
						!Array.isArray(value) &&
						(value as Record<string, unknown>).schemaVersion === 'family-affinity-target-v1' &&
						typeof (value as Record<string, unknown>).targetId === 'string'
				)
				.map((value) => [value.targetId as string, value])
		);
		const assignments = new Map(
			materialized
				.map((document) => document.value)
				.filter(
					(value): value is Record<string, unknown> =>
						value !== null &&
						typeof value === 'object' &&
						!Array.isArray(value) &&
						(value as Record<string, unknown>).schemaVersion === 'family-affinity-assignment-v1' &&
						typeof (value as Record<string, unknown>).targetId === 'string'
				)
				.map((value) => [value.targetId as string, value])
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
				const digest = target ? familyAffinitySha256(target) : undefined;
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
		const results = new Map<string, Record<string, unknown>>();
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
			const promptSha256 = familyAffinityPromptSha256(target, assignment);
			if (result.promptSha256 !== promptSha256) {
				result.promptSha256 = promptSha256;
				document.dirty = true;
				changed = true;
			}
			results.set(targetId, result);
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
			if (result) {
				for (const key of ['promptSha256', 'sourceSha256'] as const) {
					if (typeof record[key] === 'string' && record[key] !== result[key]) {
						record[key] = result[key];
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
			const issuerAttestationSha256 = familyAffinityReviewIssuerAttestationSha256({
				issuerId: review.issuerId as string,
				reviewerId: review.reviewerId as string,
				kind: review.reviewKind as 'ordinary' | 'blind',
				manifestPath: review.manifestPath as string,
				manifestSha256: review.manifestSha256 as string,
				target,
				targetPath: review.targetPath as string,
				productionAssignment: assignment,
				productionAssignmentPath: review.productionAssignmentPath as string,
				result: result as never,
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
	const root = path.join(repositoryRoot, ...FAMILY_AFFINITY_ROOT.split('/'));
	const paths = selectFamilyAffinitySourceLineagePaths(await listJsonFiles(root, repositoryRoot));
	const documents = await Promise.all(
		paths.map(async (repositoryPath) => ({
			path: repositoryPath,
			contents: await readFile(path.join(repositoryRoot, ...repositoryPath.split('/')), 'utf8')
		}))
	);
	const source = {
		path: ELEMENTALS_PACKET_PATH,
		contents: await readFile(
			path.join(repositoryRoot, ...ELEMENTALS_PACKET_PATH.split('/')),
			'utf8'
		)
	};
	const changed = resealFamilyAffinitySourceLineageDocuments(source, documents);
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
