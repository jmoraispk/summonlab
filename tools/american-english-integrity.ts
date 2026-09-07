import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
	type AmericanEnglishIntegrityOwner,
	type IntegrityBindingKind,
	type IntegrityOwnerId,
	type IntegrityProblem,
	type IntegritySerializerId
} from './american-english-integrity-contracts.js';
import { equipmentIntegrityOwner } from './american-english-equipment-successors.js';
import { runtimeAndEngineIntegrityOwner } from './american-english-runtime-successors.js';
import { visualProductionIntegrityOwner } from './american-english-visual-successors.js';
import { replaceRetiredForms } from './american-english-policy.js';

export * from './american-english-integrity-contracts.js';

export interface TrackedTreeEntry {
	readonly path: string;
	readonly bytes: Uint8Array;
	readonly projectedPath?: string;
	readonly projectedBytes?: Uint8Array;
	readonly binary: boolean;
	readonly baselineBytes?: Uint8Array;
	readonly binaryChanged?: boolean;
}

export interface TrackedTreeSnapshot {
	readonly entries: readonly TrackedTreeEntry[];
}

export interface IntegrityBinding {
	readonly path: string;
	readonly jsonPointer: string;
	readonly field: string;
	readonly kind: IntegrityBindingKind;
	readonly ownerId: IntegrityOwnerId;
}

export interface IntegrityOwnerPlan {
	readonly id: IntegrityOwnerId;
	readonly bindingCount: number;
	readonly pathCount: number;
	readonly paths: readonly string[];
	readonly writeCommand: string;
	readonly checkCommand: string;
	readonly successorIntents: readonly {
		readonly sourcePath: string;
		readonly path: string;
		readonly kind: IntegrityBindingKind;
		readonly serializer: IntegritySerializerId;
		readonly projectedValueDigest: string;
		readonly dependencies: readonly { readonly path: string; readonly digest: string }[];
		readonly externalDependencies: readonly {
			readonly jsonPointer: string;
			readonly value: string;
		}[];
		readonly languageMigrationSuccessor: true;
	}[];
}

export interface IntegrityBindingReport {
	readonly bindings: readonly IntegrityBinding[];
	readonly ownerPlans: readonly IntegrityOwnerPlan[];
	readonly problems: readonly IntegrityProblem[];
}

interface MigrationProjection {
	readonly textEdits: readonly { readonly path: string }[];
	readonly pathMoves: readonly { readonly source: string }[];
}

const INTEGRITY_MARKERS = [
	'canonicalHash',
	'checksum',
	'contentHash',
	'manifestHash',
	'promptHash',
	'sha256',
	'sourceHash'
] as const;

function compareCodepoints(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function escapePointerToken(value: string): string {
	return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
	return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

function inferKind(field: string): IntegrityBindingKind {
	if (field === 'raw-file') return 'raw-file';
	if (field === 'generated-output') return 'generated-output';
	if (/prompt/iu.test(field)) return 'utf8-string';
	if (/canonical/iu.test(field)) return 'canonical-json';
	if (/state|event|chain|legalAction/iu.test(field)) return 'event-chain';
	if (/manifest|catalog|roster|inventory/iu.test(field)) return 'generated-output';
	if (/content|source|candidate|image|reference|sha256/iu.test(field)) return 'raw-file';
	return 'path-and-content';
}

function isGeneratedArtifactPath(repositoryPath: string): boolean {
	return (
		/\.(?:html|webp)$/u.test(repositoryPath) ||
		repositoryPath.includes('/review/') ||
		repositoryPath.includes('/reviews/') ||
		repositoryPath.includes('/runtime/') ||
		repositoryPath.startsWith('apps/web/static/')
	);
}

function scanJsonDigests(
	value: unknown,
	repositoryPath: string,
	pointer: string,
	bindings: { readonly path: string; readonly jsonPointer: string; readonly field: string }[]
): void {
	if (Array.isArray(value)) {
		value.forEach((child, index) =>
			scanJsonDigests(child, repositoryPath, `${pointer}/${index}`, bindings)
		);
		return;
	}
	if (value === null || typeof value !== 'object') return;
	for (const [field, child] of Object.entries(value as Record<string, unknown>)) {
		const childPointer = `${pointer}/${escapePointerToken(field)}`;
		if (typeof child === 'string' && /^[0-9a-f]{64}$/u.test(child)) {
			bindings.push({ path: repositoryPath, jsonPointer: childPointer, field });
		}
		scanJsonDigests(child, repositoryPath, childPointer, bindings);
	}
}

export const AMERICAN_ENGLISH_INTEGRITY_OWNERS = [
	equipmentIntegrityOwner,
	visualProductionIntegrityOwner,
	runtimeAndEngineIntegrityOwner
] as const satisfies readonly AmericanEnglishIntegrityOwner[];

function ownerMatchesPath(owner: AmericanEnglishIntegrityOwner, repositoryPath: string): boolean {
	return owner.ownsPath(repositoryPath);
}

function classifyScannedBinding(
	scannedBinding: { readonly path: string; readonly jsonPointer: string; readonly field: string },
	owners: readonly AmericanEnglishIntegrityOwner[],
	bindings: IntegrityBinding[],
	problems: IntegrityProblem[]
): void {
	const pathOwners = owners.filter((owner) => ownerMatchesPath(owner, scannedBinding.path));
	const matchingOwners = pathOwners.filter((owner) =>
		owner.owns(scannedBinding.path, scannedBinding.jsonPointer)
	);
	if (matchingOwners.length === 0) {
		const registeredPath = pathOwners.length > 0;
		problems.push({
			path: scannedBinding.path,
			jsonPointer: scannedBinding.jsonPointer,
			code:
				registeredPath && scannedBinding.jsonPointer !== '' ? 'unknown-digest' : 'unowned-binding',
			message:
				registeredPath && scannedBinding.jsonPointer !== ''
					? `Digest pointer is not registered for ${pathOwners.map(({ id }) => id).join(', ')}`
					: 'No registered integrity owner matches this binding'
		});
		return;
	}
	if (matchingOwners.length > 1) {
		problems.push({
			path: scannedBinding.path,
			jsonPointer: scannedBinding.jsonPointer,
			code: 'ambiguous-owner',
			message: `Multiple integrity owners match: ${matchingOwners.map(({ id }) => id).join(', ')}`
		});
		return;
	}
	const owner = matchingOwners[0]!;
	if (owner.regeneration === null) {
		problems.push({
			path: scannedBinding.path,
			jsonPointer: scannedBinding.jsonPointer,
			code: 'missing-command',
			message: `Integrity owner ${owner.id} has no regeneration command`
		});
		return;
	}
	bindings.push({
		...scannedBinding,
		kind: inferKind(scannedBinding.field),
		ownerId: owner.id
	});
}

function entryValue(entry: TrackedTreeEntry, repositoryPath: string, projected: boolean): unknown {
	const bytes = projected ? (entry.projectedBytes ?? entry.bytes) : entry.bytes;
	if (entry.binary) return bytes;
	const text = Buffer.from(bytes).toString('utf8');
	const valuePath = projected ? (entry.projectedPath ?? repositoryPath) : repositoryPath;
	return valuePath.endsWith('.json') ? JSON.parse(text) : text;
}

function nodeKind(entry: TrackedTreeEntry, repositoryPath: string): IntegrityBindingKind {
	if (entry.binary) return 'raw-file';
	const projectedPath = entry.projectedPath ?? repositoryPath;
	if (isGeneratedArtifactPath(projectedPath)) return 'generated-output';
	return projectedPath.endsWith('.json') ? 'canonical-json' : 'utf8-string';
}

function getJsonPointer(value: unknown, pointer: string): unknown {
	let current = value;
	for (const token of pointer.slice(1).split('/').filter(Boolean)) {
		if (current === null || typeof current !== 'object') return undefined;
		current = (current as Record<string, unknown>)[
			token.replaceAll('~1', '/').replaceAll('~0', '~')
		];
	}
	return current;
}

async function buildOwnerPlan(
	owner: AmericanEnglishIntegrityOwner,
	ownedBindings: readonly IntegrityBinding[],
	problems: IntegrityProblem[],
	entries: ReadonlyMap<string, TrackedTreeEntry>
): Promise<IntegrityOwnerPlan | null> {
	if (ownedBindings.length === 0 || owner.regeneration === null) return null;
	const paths = [...new Set(ownedBindings.map(({ path: repositoryPath }) => repositoryPath))].sort(
		compareCodepoints
	);
	const bindingsByPath = new Map<
		string,
		{ jsonPointer: string; field: string; kind: IntegrityBindingKind }[]
	>();
	for (const { path: repositoryPath, jsonPointer, field, kind } of ownedBindings) {
		const pathBindings = bindingsByPath.get(repositoryPath) ?? [];
		pathBindings.push({ jsonPointer, field, kind });
		bindingsByPath.set(repositoryPath, pathBindings);
	}
	const drafts = paths.flatMap((repositoryPath) => {
		const entry = entries.get(repositoryPath);
		if (entry === undefined) return [];
		const pathBindings = bindingsByPath.get(repositoryPath) ?? [];
		const kind = nodeKind(entry, repositoryPath);
		const serializer = owner.serializerFor(repositoryPath, kind);
		if (serializer === null) {
			problems.push({
				path: repositoryPath,
				jsonPointer: '',
				code: 'unknown-serializer',
				message: `No serializer mapping for ${owner.id} ${kind}`
			});
			return [];
		}
		return [
			{
				sourcePath: repositoryPath,
				path: entry.projectedPath ?? repositoryPath,
				kind,
				serializer,
				value: entryValue(entry, repositoryPath, true),
				currentValue: entryValue(entry, repositoryPath, false),
				pathBindings
			}
		];
	});
	const digestSources = new Map<string, string>();
	for (const draft of drafts) {
		const [current] = await owner.planSuccessors({
			nodes: [
				{
					path: draft.sourcePath,
					kind: draft.kind,
					serializer: draft.serializer,
					value: draft.currentValue,
					dependsOn: []
				}
			]
		});
		if (current !== undefined) digestSources.set(current.digest, draft.sourcePath);
	}
	const projectedBySource = new Map(drafts.map(({ sourcePath, path }) => [sourcePath, path]));
	const nodes = drafts.map((draft) => {
		const dependsOn = new Set<string>();
		const dependencyBindings: { sourcePath: string; jsonPointer: string }[] = [];
		const externalDependencies: { jsonPointer: string; value: string }[] = [];
		for (const binding of draft.pathBindings) {
			if (binding.jsonPointer === '') continue;
			const projectedPointer = replaceRetiredForms(binding.jsonPointer);
			const current = getJsonPointer(draft.currentValue, binding.jsonPointer);
			if (typeof current !== 'string') continue;
			const dependencySource = digestSources.get(current);
			if (dependencySource !== undefined && dependencySource !== draft.sourcePath) {
				const dependencyPath = projectedBySource.get(dependencySource)!;
				dependsOn.add(dependencyPath);
				dependencyBindings.push({ sourcePath: dependencyPath, jsonPointer: projectedPointer });
			} else externalDependencies.push({ jsonPointer: projectedPointer, value: current });
		}
		return {
			path: draft.path,
			sourcePath: draft.sourcePath,
			kind: draft.kind,
			serializer: draft.serializer,
			value: draft.value,
			dependsOn: [...dependsOn].sort(compareCodepoints),
			dependencyBindings,
			externalDependencies
		};
	});
	const successors = await owner.planSuccessors({ nodes });
	problems.push(...(await owner.verify({ nodes, successors })));
	const serializerByPath = new Map(nodes.map(({ path, serializer }) => [path, serializer]));
	const successorIntents = successors.map((successor) => ({
		sourcePath: successor.sourcePath,
		path: successor.path,
		kind: successor.kind,
		serializer: serializerByPath.get(successor.path)!,
		projectedValueDigest: successor.digest,
		dependencies: successor.dependencies,
		externalDependencies: successor.externalDependencies,
		languageMigrationSuccessor: true as const
	}));
	return {
		id: owner.id,
		bindingCount: ownedBindings.length,
		pathCount: paths.length,
		paths,
		...owner.regeneration,
		successorIntents
	};
}

export async function classifyIntegrityBindings(
	before: TrackedTreeSnapshot,
	proposed: MigrationProjection,
	owners: readonly AmericanEnglishIntegrityOwner[] = AMERICAN_ENGLISH_INTEGRITY_OWNERS
): Promise<IntegrityBindingReport> {
	const affectedPaths = [
		...new Set([
			...proposed.textEdits.map(({ path: repositoryPath }) => repositoryPath),
			...proposed.pathMoves.map(({ source }) => source)
		])
	].sort(compareCodepoints);
	const selectedBinaryMoves = new Set(proposed.pathMoves.map(({ source }) => source));
	const entries = new Map(before.entries.map((entry) => [entry.path, entry]));
	const bindings: IntegrityBinding[] = [];
	const problems: IntegrityProblem[] = [];

	for (const repositoryPath of affectedPaths) {
		const entry = entries.get(repositoryPath);
		if (entry === undefined) {
			problems.push({
				path: repositoryPath,
				jsonPointer: '',
				code: 'missing-node',
				message: 'Affected integrity source is absent from the tracked-tree snapshot'
			});
			continue;
		}

		if (entry.binary) {
			if (!selectedBinaryMoves.has(repositoryPath)) continue;
			const rawBinding = { path: repositoryPath, jsonPointer: '', field: 'raw-file' } as const;
			classifyScannedBinding(rawBinding, owners, bindings, problems);
			const isOwned = owners.some((owner) => owner.owns(repositoryPath, ''));
			if (
				isOwned &&
				(entry.binaryChanged === true ||
					(entry.baselineBytes !== undefined && !bytesEqual(entry.bytes, entry.baselineBytes)))
			) {
				problems.push({
					path: repositoryPath,
					jsonPointer: '',
					code: 'changed-binary',
					message: 'A moved source binary differs from its baseline bytes'
				});
			}
			continue;
		}

		const source = Buffer.from(entry.bytes).toString('utf8');
		const scanned: {
			readonly path: string;
			readonly jsonPointer: string;
			readonly field: string;
		}[] = [];
		let parsedJson = false;
		try {
			scanJsonDigests(JSON.parse(source), repositoryPath, '', scanned);
			parsedJson = true;
		} catch {
			// Non-JSON integrity source files are matched by an explicit file contract below.
		}
		for (const scannedBinding of scanned) {
			classifyScannedBinding(scannedBinding, owners, bindings, problems);
		}

		if (scanned.length === 0) {
			const matchingFileOwners = owners.filter((owner) => owner.owns(repositoryPath, ''));
			const hasMarker = INTEGRITY_MARKERS.some((marker) => source.includes(marker));
			if (matchingFileOwners.length > 0) {
				classifyScannedBinding(
					{
						path: repositoryPath,
						jsonPointer: '',
						field: isGeneratedArtifactPath(repositoryPath) ? 'generated-output' : 'path-and-content'
					},
					owners,
					bindings,
					problems
				);
			} else if (!parsedJson && hasMarker) {
				classifyScannedBinding(
					{ path: repositoryPath, jsonPointer: '', field: 'source-integrity-reference' },
					owners,
					bindings,
					problems
				);
			}
		}
	}

	const ownerPlans = (
		await Promise.all(
			owners.map((owner) =>
				buildOwnerPlan(
					owner,
					bindings.filter(({ ownerId }) => ownerId === owner.id),
					problems,
					entries
				)
			)
		)
	)
		.filter((plan): plan is IntegrityOwnerPlan => plan !== null)
		.sort((left, right) => compareCodepoints(left.id, right.id));
	return {
		bindings: bindings.sort(
			(left, right) =>
				compareCodepoints(left.path, right.path) ||
				compareCodepoints(left.jsonPointer, right.jsonPointer)
		),
		ownerPlans,
		problems: problems.sort(
			(left, right) =>
				compareCodepoints(left.path, right.path) ||
				compareCodepoints(left.jsonPointer, right.jsonPointer) ||
				compareCodepoints(left.code, right.code)
		)
	};
}

function splitCommand(command: string): string[][] {
	return command.split(' && ').map((segment) => segment.trim().split(/\s+/u));
}

async function readJsonFile(filePath: string): Promise<Record<string, unknown>> {
	return JSON.parse(await readFile(filePath, 'utf8')) as Record<string, unknown>;
}

export async function validateIntegrityOwnerCommandContracts(
	repositoryRoot: string,
	owners: readonly AmericanEnglishIntegrityOwner[]
): Promise<readonly string[]> {
	const rootPackage = await readJsonFile(path.join(repositoryRoot, 'package.json'));
	const rootScripts = (rootPackage.scripts ?? {}) as Record<string, string>;
	const problems: string[] = [];
	for (const owner of owners) {
		if (owner.regeneration === null) continue;
		for (const command of [owner.regeneration.writeCommand, owner.regeneration.checkCommand]) {
			for (const tokens of splitCommand(command)) {
				if (tokens[0] !== 'pnpm') {
					problems.push(`${owner.id}: command must begin with pnpm: ${tokens.join(' ')}`);
					continue;
				}
				if (tokens[1] === 'tsx') {
					const toolPath = tokens[2];
					if (toolPath === undefined) problems.push(`${owner.id}: tsx command has no tool path`);
					else {
						try {
							await access(path.join(repositoryRoot, toolPath));
						} catch {
							problems.push(`${owner.id}: missing tool ${toolPath}`);
						}
					}
				} else if (tokens[1] === '--filter') {
					const packageName = tokens[2];
					const scriptName = tokens[3];
					let found = false;
					for (const packageDirectory of [
						'engine',
						'characters',
						'content',
						'contracts',
						'evaluation',
						'policies'
					]) {
						try {
							const packageJson = await readJsonFile(
								path.join(repositoryRoot, 'packages', packageDirectory, 'package.json')
							);
							if (
								packageJson.name === packageName &&
								typeof ((packageJson.scripts ?? {}) as Record<string, unknown>)[
									scriptName ?? ''
								] === 'string'
							) {
								found = true;
								break;
							}
						} catch {
							// This known package directory is absent or has no readable manifest.
						}
					}
					if (!found)
						problems.push(`${owner.id}: missing filtered script ${packageName} ${scriptName}`);
				} else {
					const scriptName = tokens[1];
					if (scriptName === undefined || typeof rootScripts[scriptName] !== 'string') {
						problems.push(`${owner.id}: missing package script ${scriptName ?? '<none>'}`);
					}
				}
				if (tokens[1] === 'package:playtest' && !tokens.includes('--acknowledge-private-release')) {
					problems.push(`${owner.id}: package:playtest requires --acknowledge-private-release`);
				}
			}
		}
	}
	return problems.sort(compareCodepoints);
}
