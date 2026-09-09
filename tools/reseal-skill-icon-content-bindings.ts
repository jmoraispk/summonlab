import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	CleanupRevisionV2PacketSchema,
	computeCleanupRevisionTransactionContentHash
} from './skill-icon-quality-cleanup-v2-lib.js';

const root = process.cwd();
const v1 = 'assets/wiki/skills/icon-production-v1';
const v2 = 'assets/wiki/skills/icon-production-v2';
const run = `${v2}/runs`;
const massProductionManifestPath = `${v1}/mass-production-v1/manifest.json`;
const bindingsByPath = new Map<string, ReadonlySet<string>>([
	[
		`${v1}/mass-production-v1/manifest.json`,
		new Set([`${v1}/motif-map.json`, `${v1}/visual-specs.json`])
	],
	[
		`${v1}/quality-cleanup-v1/manifest.json`,
		new Set([
			`${v1}/mass-production-v1/manifest.json`,
			`${v1}/catalog.json`,
			`${v1}/motif-map.json`,
			`${v1}/visual-specs.json`
		])
	],
	[
		`${v2}/overlay.json`,
		new Set([`${v1}/catalog.json`, `${v1}/motif-map.json`, `${v1}/visual-specs.json`])
	],
	[
		`${run}/reversal-cut-v1/manifest.json`,
		new Set([`${v2}/catalog.json`, `${v2}/motif-map.json`, `${v2}/visual-specs.json`])
	],
	[`${run}/reversal-cut-v2/completion.json`, new Set([`${run}/reversal-cut-v2/manifest.json`])],
	[`${run}/reversal-cut-v2/guard-flow-ancestor-authority.json`, new Set([`${v2}/catalog.json`])],
	[
		`${run}/reversal-cut-v2/individual-attempt-v1.json`,
		new Set([`${v2}/catalog.json`, `${run}/reversal-cut-v2/guard-flow-ancestor-authority.json`])
	],
	[
		`${run}/reversal-cut-v2/manifest.json`,
		new Set([`${v2}/catalog.json`, `${v2}/motif-map.json`, `${v2}/visual-specs.json`])
	],
	[`${run}/reversal-cut-v3/activation.json`, new Set([`${run}/reversal-cut-v3/owner-review.json`])],
	[
		`${run}/reversal-cut-v3/owner-review.json`,
		new Set([
			`${run}/reversal-cut-v2/individual-attempt-v1.json`,
			`${v2}/catalog.json`,
			`${run}/reversal-cut-v2/guard-flow-ancestor-authority.json`
		])
	],
	[
		`${run}/reversal-cut-v4/correction.json`,
		new Set([
			`${run}/reversal-cut-v4/owner-frame-feedback.json`,
			`${run}/reversal-cut-v3/activation.json`,
			`${v1}/mass-production-v1/manifest.json`
		])
	],
	[
		`${run}/reversal-cut-v4/owner-frame-feedback.json`,
		new Set([`${run}/reversal-cut-v3/activation.json`])
	],
	[`${run}/reversal-cut-v7/activation.json`, new Set([`${run}/reversal-cut-v3/activation.json`])]
]);
const bindingPaths = [...bindingsByPath.keys()];

function sha256(bytes: Uint8Array | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function resealMassProductionLineage(): Promise<void> {
	const manifestFile = path.join(root, ...massProductionManifestPath.split('/'));
	let manifestSource = await readFile(manifestFile, 'utf8');
	const manifest = JSON.parse(manifestSource) as {
		readonly families: readonly MassProductionRecord[];
		readonly skills: readonly MassProductionRecord[];
	};

	for (const record of [...manifest.families, ...manifest.skills]) {
		const promptSource = await readFile(path.join(root, ...record.promptPath.split('/')), 'utf8');
		const prompt = JSON.parse(promptSource) as { readonly exactPrompt?: unknown };
		if (typeof prompt.exactPrompt !== 'string') {
			throw new Error(`Skill-icon prompt has no exactPrompt: ${record.promptPath}`);
		}

		const resultFile = path.join(root, ...record.resultPath.split('/'));
		let resultSource = await readFile(resultFile, 'utf8');
		const result = JSON.parse(resultSource) as { readonly promptHash?: unknown };
		if (typeof result.promptHash !== 'string') {
			throw new Error(`Skill-icon result has no promptHash: ${record.resultPath}`);
		}
		const promptHash = sha256(prompt.exactPrompt);
		if (result.promptHash !== promptHash) {
			resultSource = resultSource.replaceAll(result.promptHash, promptHash);
			await writeFile(resultFile, resultSource, 'utf8');
		}

		const resultHash = sha256(resultSource);
		if (typeof record.resultHash !== 'string') {
			throw new Error(`Skill-icon manifest record has no resultHash: ${record.resultPath}`);
		}
		if (record.resultHash !== resultHash) {
			manifestSource = manifestSource.replaceAll(record.resultHash, resultHash);
		}
	}

	await writeFile(manifestFile, manifestSource, 'utf8');
}

interface MassProductionRecord {
	readonly promptPath: string;
	readonly resultPath: string;
	readonly resultHash?: string;
}

async function resealCleanupRevisionLineage(): Promise<void> {
	const revisionRoots = [
		`${v1}/quality-cleanup-v1/prompts/revisions`,
		`${v1}/quality-cleanup-v1/prompts/revisions-v2`,
		`${v1}/quality-cleanup-v1/prompts/revisions-v3`,
		`${v1}/quality-cleanup-v1/results/revisions`,
		`${v1}/quality-cleanup-v1/results/completion-audits`
	];
	const revisionPaths = (
		await Promise.all(
			revisionRoots.map(async (repositoryRoot) =>
				(await readdir(path.join(root, ...repositoryRoot.split('/'))))
					.filter((name) => name.endsWith('.json'))
					.map((name) => `${repositoryRoot}/${name}`)
			)
		)
	).flat();

	for (let iteration = 0; iteration < revisionPaths.length; iteration += 1) {
		let changed = false;
		for (const repositoryPath of revisionPaths) {
			const filePath = path.join(root, ...repositoryPath.split('/'));
			const source = await readFile(filePath, 'utf8');
			const value = JSON.parse(source) as unknown;
			const replacements: { readonly current: string; readonly next: string }[] = [];
			visit(value, (record) => {
				if (typeof record.exactPrompt === 'string' && typeof record.exactPromptHash === 'string') {
					const digest = sha256(record.exactPrompt);
					if (record.exactPromptHash !== digest) {
						replacements.push({ current: record.exactPromptHash, next: digest });
						record.exactPromptHash = digest;
					}
				}
			});
			const bindings: { readonly record: Record<string, unknown>; readonly bytes: Buffer }[] = [];
			await Promise.all(
				(() => {
					const pending: Promise<void>[] = [];
					visit(value, (record) => {
						if (
							typeof record.path !== 'string' ||
							typeof record.contentHash !== 'string' ||
							!record.path.startsWith('assets/wiki/skills/')
						)
							return;
						pending.push(
							readFile(path.join(root, ...record.path.split('/'))).then((bytes) => {
								bindings.push({ record, bytes });
							})
						);
					});
					return pending;
				})()
			);
			for (const binding of bindings) {
				const digest = sha256(binding.bytes);
				if (binding.record.contentHash !== digest) {
					replacements.push({ current: String(binding.record.contentHash), next: digest });
					binding.record.contentHash = digest;
				}
			}
			if (
				typeof value === 'object' &&
				value !== null &&
				'predecessor' in value &&
				typeof value.predecessor === 'object' &&
				value.predecessor !== null &&
				'result' in value.predecessor &&
				typeof value.predecessor.result === 'object' &&
				value.predecessor.result !== null &&
				'path' in value.predecessor.result &&
				typeof value.predecessor.result.path === 'string' &&
				'transactionContentHash' in value.predecessor &&
				typeof value.predecessor.transactionContentHash === 'string'
			) {
				const predecessor = JSON.parse(
					await readFile(path.join(root, ...value.predecessor.result.path.split('/')), 'utf8')
				) as { readonly transactionContentHash?: unknown };
				if (
					typeof predecessor.transactionContentHash === 'string' &&
					value.predecessor.transactionContentHash !== predecessor.transactionContentHash
				) {
					replacements.push({
						current: value.predecessor.transactionContentHash,
						next: predecessor.transactionContentHash
					});
					value.predecessor.transactionContentHash = predecessor.transactionContentHash;
				}
			}
			if (
				typeof value === 'object' &&
				value !== null &&
				'revisionPacket' in value &&
				typeof value.revisionPacket === 'object' &&
				value.revisionPacket !== null &&
				'path' in value.revisionPacket &&
				typeof value.revisionPacket.path === 'string' &&
				'transactionContentHash' in value &&
				typeof value.transactionContentHash === 'string'
			) {
				const packetBytes = await readFile(
					path.join(root, ...value.revisionPacket.path.split('/'))
				);
				const packet = JSON.parse(packetBytes.toString('utf8')) as Record<string, unknown>;
				const transactionContentHash =
					'revision' in value && typeof value.revision === 'number' && value.revision >= 2
						? computeCleanupRevisionTransactionContentHash({
								packetContentHash: sha256(packetBytes),
								predecessor: CleanupRevisionV2PacketSchema.parse(packet).predecessor,
								sourceMode: CleanupRevisionV2PacketSchema.parse(packet).sourceMode,
								transform: CleanupRevisionV2PacketSchema.parse(packet).transform,
								providerSourceContentHash: String(
									(value.providerSource as Record<string, unknown>).contentHash
								),
								revisedInteriorContentHash: String(
									(value.revisedInterior as Record<string, unknown>).contentHash
								),
								compositionAuthority:
									CleanupRevisionV2PacketSchema.parse(packet).compositionAuthority,
								compositeContentHash: String(
									(value.composite as Record<string, unknown>).contentHash
								),
								display384ContentHash: String(
									(value.display384 as Record<string, unknown>).contentHash
								),
								inspection: value.inspection,
								execution: value.execution,
								output: CleanupRevisionV2PacketSchema.parse(packet).output
							})
						: sha256(
								Buffer.from(
									`${JSON.stringify(
										{
											packet: sha256(packetBytes),
											providerSource: (value.providerSource as Record<string, unknown>).contentHash,
											normalization: value.normalization,
											revisedInterior: (value.revisedInterior as Record<string, unknown>)
												.contentHash,
											compositionAuthority: value.compositionAuthority,
											composite: (value.composite as Record<string, unknown>).contentHash,
											display384: (value.display384 as Record<string, unknown>).contentHash,
											inspection: value.inspection,
											attemptCount: value.attemptCount,
											output: packet.output
										},
										null,
										'\t'
									)}\n`
								)
							);
				if (value.transactionContentHash !== transactionContentHash) {
					replacements.push({
						current: value.transactionContentHash,
						next: transactionContentHash
					});
					value.transactionContentHash = transactionContentHash;
				}
			}
			const expected = replacements.reduce(
				(contents, replacement) => contents.replaceAll(replacement.current, replacement.next),
				source
			);
			if (expected !== source) {
				await writeFile(filePath, expected, 'utf8');
				changed = true;
			}
		}
		if (!changed) return;
	}
	throw new Error('Skill-icon cleanup revision lineage reseal did not converge');
}

function visit(value: unknown, update: (record: Record<string, unknown>) => void): void {
	if (Array.isArray(value)) {
		for (const child of value) visit(child, update);
		return;
	}
	if (value === null || typeof value !== 'object') return;
	const record = value as Record<string, unknown>;
	update(record);
	for (const child of Object.values(record)) visit(child, update);
}

await resealMassProductionLineage();
await resealCleanupRevisionLineage();

for (let iteration = 0; iteration < bindingPaths.length; iteration += 1) {
	let changed = false;
	for (const repositoryPath of bindingPaths) {
		const filePath = path.join(root, ...repositoryPath.split('/'));
		const source = await readFile(filePath, 'utf8');
		const value = JSON.parse(source) as unknown;
		const replacements: { readonly current: string; readonly next: string }[] = [];
		visit(value, (record) => {
			if (
				typeof record.path !== 'string' ||
				typeof record.contentHash !== 'string' ||
				!bindingsByPath.get(repositoryPath)!.has(record.path)
			)
				return;
			const targetPath = path.join(root, ...record.path.split('/'));
			const target = readFile(targetPath).catch(() => null);
			(record as Record<string, unknown>).__pendingHash = target;
		});
		const pending: Promise<void>[] = [];
		visit(value, (record) => {
			const target = record.__pendingHash;
			if (!(target instanceof Promise)) return;
			delete record.__pendingHash;
			pending.push(
				target.then((bytes) => {
					if (bytes === null) return;
					const digest = createHash('sha256').update(bytes).digest('hex');
					if (record.contentHash !== digest) {
						replacements.push({ current: String(record.contentHash), next: digest });
						record.contentHash = digest;
						changed = true;
					}
				})
			);
		});
		await Promise.all(pending);
		const expected = replacements.reduce(
			(contents, replacement) => contents.replaceAll(replacement.current, replacement.next),
			source
		);
		if (expected !== source) await writeFile(filePath, expected, 'utf8');
	}
	if (!changed) break;
	if (iteration === bindingPaths.length - 1) {
		throw new Error('Skill-icon content binding reseal did not converge');
	}
}
