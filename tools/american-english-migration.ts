import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	chmod,
	link,
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	readlink,
	rename,
	rmdir,
	rm,
	symlink,
	unlink,
	writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

import {
	AMERICAN_ENGLISH_RULE_IDS,
	type AmericanEnglishRuleId,
	type AmericanEnglishViolation,
	auditTrackedTree
} from './american-english-policy.js';
import {
	AMERICAN_ENGLISH_INTEGRITY_OWNERS,
	classifyIntegrityBindings,
	digestTrackedIntegrityValue,
	type IntegrityBindingKind,
	type IntegrityOwnerPlan,
	type IntegrityOwnerId,
	type IntegritySerializerId,
	type TrackedTreeSnapshot
} from './american-english-integrity.js';

export interface IntegrityBindingProblem {
	readonly path: string;
	readonly reasons: readonly string[];
}

export interface AmericanEnglishPathMove {
	readonly source: string;
	readonly destination: string;
	readonly sourceBlobId: string;
	readonly binary: boolean;
}

export interface AmericanEnglishMigrationPlan {
	readonly baselineCommit: string;
	readonly headCommit: string;
	readonly ruleIds: readonly AmericanEnglishRuleId[];
	readonly roots: readonly string[];
	readonly textEdits: readonly { readonly path: string; readonly violationCount: number }[];
	readonly pathMoves: readonly AmericanEnglishPathMove[];
	readonly collisions: readonly {
		readonly destination: string;
		readonly sources: readonly string[];
	}[];
	readonly unownedIntegrityBindings: readonly IntegrityBindingProblem[];
	readonly integrityOwners: readonly IntegrityOwnerPlan[];
	readonly directSuccessors: readonly AmericanEnglishExpectedDirectSuccessor[];
	readonly expectedOwnerSuccessors: readonly AmericanEnglishExpectedOwnerSuccessor[];
	readonly authenticatedHeadPreimages: readonly AmericanEnglishAuthenticatedHeadPreimage[];
	readonly previousReceiptHash: string | null;
	readonly inventoryFingerprint: string;
}

export interface AmericanEnglishExpectedDirectSuccessor {
	readonly sourcePathHash: string;
	readonly successorPathHash: string;
	readonly sourceBlobId: string;
	readonly successorBlobId: string;
	readonly binary: boolean;
	readonly ownerId: 'migration-planner' | IntegrityOwnerId;
}

export interface AmericanEnglishExpectedOwnerSuccessor {
	readonly ownerId: IntegrityOwnerId;
	readonly sourcePathHash: string;
	readonly successorPathHash: string;
	readonly sourceBlobId: string;
	readonly mode: string;
	readonly kind: IntegrityBindingKind;
	readonly serializer: IntegritySerializerId;
	readonly currentValueDigest: string;
	readonly projectedValueDigest: string;
	readonly currentRawDigest: string;
	readonly projectedRawDigest: string;
	readonly dependencies: readonly {
		readonly successorPathHash: string;
		readonly digest: string;
		readonly digestKind?: 'raw-bytes';
	}[];
	readonly externalBindingsDigest: string;
}

export interface AmericanEnglishAuthenticatedHeadPreimage {
	readonly successorPathHash: string;
	readonly blobId: string;
	readonly mode: string;
	readonly binary: boolean;
}

export interface PlanAmericanEnglishMigrationOptions {
	readonly repositoryRoot?: string;
	readonly baselineCommit: string;
	readonly ruleIds?: readonly AmericanEnglishRuleId[];
	readonly roots?: readonly string[];
	readonly previousReceiptPath?: string;
}

export interface AmericanEnglishMigrationReceiptFile {
	readonly sourceBlobId: string;
	readonly successorPathHash: string;
	readonly successorBlobId: string;
	readonly unchangedBinary: boolean;
	readonly ownerId: 'migration-planner' | 'authenticated-plan-head' | IntegrityOwnerPlan['id'];
}

export interface AmericanEnglishMigrationReceipt {
	readonly baselineCommit: string;
	readonly policyVersion: 1;
	readonly ruleCounts: Readonly<Record<AmericanEnglishRuleId, number>>;
	readonly ownerCounts: Readonly<Record<string, number>>;
	readonly files: readonly AmericanEnglishMigrationReceiptFile[];
}

export interface ApplyAmericanEnglishMigrationOptions {
	readonly repositoryRoot?: string;
	readonly receiptPath: string;
	readonly previousReceiptPath?: string;
	/** Test-only fault injection after a completed repository operation. */
	readonly failAfterOperation?: number;
}

export interface MaterializeAuthenticatedOwnerSuccessorsOptions {
	readonly repositoryRoot?: string;
}

export interface FinalizeAmericanEnglishMigrationReceiptOptions {
	readonly repositoryRoot?: string;
	readonly expectedMigrationCommit: string;
	readonly planPath: string;
	readonly expectedPlanHash: string;
	readonly initialReceiptPath: string;
	readonly expectedInitialReceiptHash: string;
	readonly previousReceiptPath?: string;
	readonly receiptPath: string;
}

const authenticatedOwnerBytesByPlan = new WeakMap<
	AmericanEnglishMigrationPlan,
	ReadonlyMap<string, Uint8Array>
>();

function stripPrivateOwnerBytes(owner: IntegrityOwnerPlan): IntegrityOwnerPlan {
	return {
		...owner,
		successorIntents: owner.successorIntents.map(
			({ projectedBytes: _projectedBytes, ...intent }) => intent
		)
	};
}

interface GitResult {
	readonly stdout: Buffer;
	readonly stderr: Buffer;
	readonly exitCode: number;
}

interface FileSnapshot {
	readonly source: string;
	readonly destination: string;
	readonly bytes: Buffer;
	readonly kind: 'file' | 'symlink';
	readonly mode: number;
}

interface PlannedFile {
	readonly source: string;
	readonly destination: string;
	readonly sourceBlobId: string;
	readonly binary: boolean;
}

interface ValidatedReceipt {
	readonly receipt: AmericanEnglishMigrationReceipt;
	readonly successorBlobsByPathHash: ReadonlyMap<string, string>;
	readonly receiptHash: string;
}

const POLICY_VERSION = 1 as const;
function compareCodepoints(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function hashRepositoryPath(repositoryPath: string): string {
	return sha256(Buffer.from(repositoryPath, 'utf8'));
}

async function gitBlobId(repositoryRoot: string, bytes: Uint8Array): Promise<string> {
	return (await runGit(repositoryRoot, ['hash-object', '--stdin'], Buffer.from(bytes)))
		.toString('utf8')
		.trim();
}

function fingerprintPlanMaterial(
	plan: Omit<AmericanEnglishMigrationPlan, 'inventoryFingerprint'>
): string {
	return sha256(Buffer.from(JSON.stringify(plan), 'utf8'));
}

async function materializeAuthenticatedOwnerIntents(options: {
	readonly repositoryRoot: string;
	readonly headCommit: string;
	readonly owners: readonly (typeof AMERICAN_ENGLISH_INTEGRITY_OWNERS)[number][];
	readonly index: ReadonlyMap<string, { readonly blobId: string }>;
	readonly textEdits: readonly { readonly path: string }[];
	readonly pathMoves: readonly { readonly source: string; readonly destination: string }[];
	readonly projectedBytes: ReadonlyMap<string, Uint8Array>;
}): Promise<ReadonlyMap<string, Uint8Array>> {
	const owners = options.owners.filter(
		(owner) =>
			owner.intentMaterialization !== undefined &&
			owner.intentMaterialization.paths.every((repositoryPath) => options.index.has(repositoryPath))
	);
	if (owners.length === 0) return new Map();
	const temporaryParent = await mkdtemp(path.join(tmpdir(), 'american-english-intents-'));
	const worktree = path.join(temporaryParent, 'worktree');
	try {
		await runGit(options.repositoryRoot, [
			'-c',
			'filter.lfs.smudge=',
			'-c',
			'filter.lfs.required=false',
			'worktree',
			'add',
			'--detach',
			worktree,
			options.headCommit
		]);
		for (const { source, destination } of options.pathMoves) {
			const absoluteDestination = path.join(worktree, ...destination.split('/'));
			await mkdir(path.dirname(absoluteDestination), { recursive: true });
			await rename(path.join(worktree, ...source.split('/')), absoluteDestination);
		}
		const destinationBySource = new Map(
			options.pathMoves.map(({ source, destination }) => [source, destination])
		);
		for (const { path: source } of options.textEdits) {
			const bytes = options.projectedBytes.get(source);
			if (bytes === undefined)
				throw new Error('Projected text bytes are absent during intent planning');
			const destination = destinationBySource.get(source) ?? source;
			await writeFile(path.join(worktree, ...destination.split('/')), bytes);
		}
		await runProcess(worktree, [
			'pnpm',
			'install',
			'--offline',
			'--frozen-lockfile',
			'--ignore-scripts'
		]);
		for (const owner of owners) {
			for (const command of owner.intentMaterialization!.commands) {
				await runProcess(worktree, command);
			}
		}
		const materialized = new Map<string, Uint8Array>();
		for (const owner of owners) {
			for (const repositoryPath of owner.intentMaterialization!.paths) {
				materialized.set(
					repositoryPath,
					await readFile(path.join(worktree, ...repositoryPath.split('/')))
				);
			}
		}
		return materialized;
	} finally {
		await runGit(options.repositoryRoot, ['worktree', 'remove', '--force', worktree]).catch(
			() => {}
		);
		await rm(temporaryParent, { recursive: true, force: true });
	}
}

function runGitResult(
	repositoryRoot: string,
	arguments_: readonly string[],
	input?: Buffer
): Promise<GitResult> {
	return new Promise((resolve, reject) => {
		const child = spawn('git', arguments_, {
			cwd: repositoryRoot,
			stdio: ['pipe', 'pipe', 'pipe']
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
		child.on('error', reject);
		child.on('close', (exitCode) => {
			resolve({
				stdout: Buffer.concat(stdout),
				stderr: Buffer.concat(stderr),
				exitCode: exitCode ?? 1
			});
		});
		child.stdin.end(input);
	});
}

async function runGit(
	repositoryRoot: string,
	arguments_: readonly string[],
	input?: Buffer
): Promise<Buffer> {
	const result = await runGitResult(repositoryRoot, arguments_, input);
	if (result.exitCode !== 0) {
		throw new Error(
			result.stderr.toString('utf8').trim() ||
				`Git ${arguments_[0] ?? 'command'} exited ${result.exitCode}`
		);
	}
	return result.stdout;
}

async function runProcess(repositoryRoot: string, command: readonly string[]): Promise<void> {
	const [executable, ...arguments_] = command;
	if (executable === undefined) throw new Error('Owner intent materialization command is empty');
	await new Promise<void>((resolve, reject) => {
		const child = spawn(executable, arguments_, {
			cwd: repositoryRoot,
			stdio: ['ignore', 'ignore', 'pipe']
		});
		const stderr: Buffer[] = [];
		child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
		child.on('error', reject);
		child.on('close', (exitCode) => {
			if (exitCode === 0) resolve();
			else
				reject(
					new Error(
						Buffer.concat(stderr).toString('utf8').trim() ||
							`Owner intent materialization exited ${exitCode ?? 1}`
					)
				);
		});
	});
}

function splitNul(buffer: Buffer): string[] {
	const values = buffer.toString('utf8').split('\0');
	if (values.at(-1) === '') values.pop();
	return values;
}

function normalizeRepositoryPath(value: string): string {
	const normalized = value.replaceAll('\\', '/').replace(/^\.\//u, '').replace(/\/$/u, '');
	if (
		normalized.length === 0 ||
		path.posix.isAbsolute(normalized) ||
		normalized.split('/').includes('..')
	) {
		throw new Error(`Invalid repository path filter: ${value}`);
	}
	return normalized;
}

function isUnderRoot(repositoryPath: string, roots: readonly string[]): boolean {
	return (
		roots.length === 0 ||
		roots.some((root) => repositoryPath === root || repositoryPath.startsWith(`${root}/`))
	);
}

function groupViolationsByPath(
	violations: readonly AmericanEnglishViolation[],
	kind: AmericanEnglishViolation['kind']
): ReadonlyMap<string, readonly AmericanEnglishViolation[]> {
	const grouped = new Map<string, AmericanEnglishViolation[]>();
	for (const violation of violations) {
		if (violation.kind !== kind) continue;
		const existing = grouped.get(violation.path) ?? [];
		existing.push(violation);
		grouped.set(violation.path, existing);
	}
	return grouped;
}

function replacePathViolations(
	repositoryPath: string,
	violations: readonly AmericanEnglishViolation[]
): string {
	const replacements = new Map<string, string>();
	for (const violation of violations) replacements.set(violation.found, violation.recommended);
	let result = repositoryPath;
	for (const [found, recommended] of [...replacements.entries()].sort(
		([left], [right]) => right.length - left.length || compareCodepoints(left, right)
	)) {
		result = result.replaceAll(found, recommended);
	}
	return result;
}

async function listTrackedPaths(repositoryRoot: string): Promise<string[]> {
	return splitNul(await runGit(repositoryRoot, ['ls-files', '-z'])).sort(compareCodepoints);
}

async function findCaseFoldedOccupants(
	repositoryRoot: string,
	repositoryPath: string
): Promise<string[]> {
	let candidates: { readonly absolutePath: string; readonly repositoryPath: string }[] = [
		{ absolutePath: repositoryRoot, repositoryPath: '' }
	];
	for (const component of repositoryPath.split('/')) {
		const foldedComponent = component.normalize('NFC').toLowerCase();
		const next: typeof candidates = [];
		for (const candidate of candidates) {
			let entries;
			try {
				entries = await readdir(candidate.absolutePath, { withFileTypes: true });
			} catch (error) {
				const code = (error as NodeJS.ErrnoException).code;
				if (code === 'ENOENT' || code === 'ENOTDIR') continue;
				throw error;
			}
			for (const entry of entries) {
				if (entry.name.normalize('NFC').toLowerCase() !== foldedComponent) continue;
				next.push({
					absolutePath: path.join(candidate.absolutePath, entry.name),
					repositoryPath:
						candidate.repositoryPath.length === 0
							? entry.name
							: `${candidate.repositoryPath}/${entry.name}`
				});
			}
		}
		candidates = next;
		if (candidates.length === 0) break;
	}
	return candidates.map((candidate) => candidate.repositoryPath).sort(compareCodepoints);
}

async function collectUntrackedDestinationOccupants(
	repositoryRoot: string,
	trackedPaths: readonly string[],
	pathViolations: ReadonlyMap<string, readonly AmericanEnglishViolation[]>
): Promise<string[]> {
	const tracked = new Set(trackedPaths);
	const occupants = new Set<string>();
	for (const source of trackedPaths) {
		const destination = replacePathViolations(source, pathViolations.get(source) ?? []);
		if (destination === source) continue;
		for (const occupant of await findCaseFoldedOccupants(repositoryRoot, destination)) {
			if (!tracked.has(occupant)) occupants.add(occupant);
		}
	}
	return [...occupants].sort(compareCodepoints);
}

function collectCollisions(
	trackedPaths: readonly string[],
	untrackedPaths: readonly string[],
	pathViolations: ReadonlyMap<string, readonly AmericanEnglishViolation[]>
): AmericanEnglishMigrationPlan['collisions'] {
	const projected = [
		...trackedPaths.map((source) => ({
			source,
			destination: replacePathViolations(source, pathViolations.get(source) ?? [])
		})),
		...untrackedPaths.map((source) => ({ source, destination: source }))
	];
	const byFoldedDestination = new Map<
		string,
		{ readonly source: string; readonly destination: string }[]
	>();
	for (const entry of projected) {
		const folded = entry.destination.normalize('NFC').toLowerCase();
		const existing = byFoldedDestination.get(folded) ?? [];
		existing.push(entry);
		byFoldedDestination.set(folded, existing);
	}
	return [...byFoldedDestination.values()]
		.filter((entries) => new Set(entries.map(({ source }) => source)).size > 1)
		.map((entries) => ({
			destination: entries.map(({ destination }) => destination).sort(compareCodepoints)[0]!,
			sources: [...new Set(entries.map(({ source }) => source))].sort(compareCodepoints)
		}))
		.sort(
			(left, right) =>
				compareCodepoints(left.destination, right.destination) ||
				compareCodepoints(left.sources.join('\0'), right.sources.join('\0'))
		);
}

async function trackedBinaryMap(
	repositoryRoot: string,
	trackedPaths: readonly string[]
): Promise<ReadonlyMap<string, boolean>> {
	const attributes = splitNul(
		await runGit(
			repositoryRoot,
			['check-attr', '-z', '--stdin', 'text'],
			Buffer.from(`${trackedPaths.join('\0')}\0`)
		)
	);
	if (attributes.length !== trackedPaths.length * 3) {
		throw new Error('Unexpected output from git check-attr');
	}
	const textAttribute = new Map<string, string>();
	for (let index = 0; index < attributes.length; index += 3) {
		textAttribute.set(attributes[index]!, attributes[index + 2]!);
	}
	const result = new Map<string, boolean>();
	for (const repositoryPath of trackedPaths) {
		const absolutePath = path.join(repositoryRoot, ...repositoryPath.split('/'));
		const status = await lstat(absolutePath);
		if (!status.isSymbolicLink() && !status.isFile()) {
			result.set(repositoryPath, true);
			continue;
		}
		const bytes = status.isSymbolicLink()
			? Buffer.from(await readlink(absolutePath))
			: await readFile(absolutePath);
		const attribute = textAttribute.get(repositoryPath);
		result.set(
			repositoryPath,
			attribute === 'unset' || (attribute !== 'set' && bytes.subarray(0, 8_000).includes(0))
		);
	}
	return result;
}

async function baselineBlobMap(
	repositoryRoot: string,
	baselineCommit: string
): Promise<ReadonlyMap<string, string>> {
	const fields = splitNul(
		await runGit(repositoryRoot, ['ls-tree', '-rz', '--full-tree', baselineCommit])
	);
	const blobs = new Map<string, string>();
	for (const field of fields) {
		const tab = field.indexOf('\t');
		if (tab === -1) continue;
		const metadata = field.slice(0, tab).split(' ');
		const repositoryPath = field.slice(tab + 1);
		const blobId = metadata[2];
		if (metadata[1] === 'blob' && blobId !== undefined) blobs.set(repositoryPath, blobId);
	}
	return blobs;
}

async function collectIntegritySnapshot(
	repositoryRoot: string,
	affectedPaths: readonly string[],
	binary: ReadonlyMap<string, boolean>,
	expectedBinaryBlobs: ReadonlyMap<string, string>,
	index: ReadonlyMap<string, { readonly mode: string; readonly blobId: string }>,
	projectedPaths: ReadonlyMap<string, string>,
	projectedBytes: ReadonlyMap<string, Uint8Array>
): Promise<TrackedTreeSnapshot> {
	const entries: TrackedTreeSnapshot['entries'][number][] = [];
	for (const repositoryPath of affectedPaths) {
		const absolutePath = path.join(repositoryRoot, ...repositoryPath.split('/'));
		const status = await lstat(absolutePath);
		const bytes = status.isSymbolicLink()
			? Buffer.from(await readlink(absolutePath))
			: await readFile(absolutePath);
		const isBinary = binary.get(repositoryPath) ?? false;
		const expectedBinaryBlob = expectedBinaryBlobs.get(repositoryPath);
		entries.push({
			path: repositoryPath,
			bytes,
			projectedPath: projectedPaths.get(repositoryPath) ?? repositoryPath,
			projectedBytes: projectedBytes.get(repositoryPath) ?? bytes,
			binary: isBinary,
			...(isBinary && expectedBinaryBlob !== undefined
				? { binaryChanged: index.get(repositoryPath)?.blobId !== expectedBinaryBlob }
				: {})
		});
	}
	return { entries };
}

async function trackedPathsReferencing(
	repositoryRoot: string,
	patterns: readonly string[]
): Promise<readonly string[]> {
	const matches = new Set<string>();
	for (let index = 0; index < patterns.length; index += 100) {
		const batch = patterns.slice(index, index + 100);
		if (batch.length === 0) continue;
		const result = await runGitResult(repositoryRoot, [
			'grep',
			'-I',
			'-l',
			'-z',
			'-F',
			...batch.flatMap((pattern) => ['-e', pattern]),
			'--'
		]);
		if (result.exitCode !== 0 && result.exitCode !== 1) {
			throw new Error(result.stderr.toString('utf8').trim() || 'Git grep failed');
		}
		for (const repositoryPath of splitNul(result.stdout)) matches.add(repositoryPath);
	}
	return [...matches].sort(compareCodepoints);
}

export async function planAmericanEnglishMigration(
	options: PlanAmericanEnglishMigrationOptions
): Promise<AmericanEnglishMigrationPlan> {
	const repositoryRoot = path.resolve(options.repositoryRoot ?? process.cwd());
	const baselineCommit = (
		await runGit(repositoryRoot, ['rev-parse', '--verify', `${options.baselineCommit}^{commit}`])
	)
		.toString('utf8')
		.trim();
	const headCommit = (await runGit(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}']))
		.toString('utf8')
		.trim();
	const previousReceipt = await readPreviousReceipt(options.previousReceiptPath, baselineCommit);
	const requestedRuleIds = options.ruleIds ?? AMERICAN_ENGLISH_RULE_IDS;
	const knownRuleIds = new Set<AmericanEnglishRuleId>(AMERICAN_ENGLISH_RULE_IDS);
	for (const ruleId of requestedRuleIds) {
		if (!knownRuleIds.has(ruleId)) throw new Error(`Unknown American English rule: ${ruleId}`);
	}
	const ruleIds = [...new Set(requestedRuleIds)].sort(compareCodepoints);
	const selectedRuleIds = new Set(ruleIds);
	const roots = [...new Set((options.roots ?? []).map(normalizeRepositoryPath))].sort(
		compareCodepoints
	);
	const trackedPaths = await listTrackedPaths(repositoryRoot);
	const violations = await auditTrackedTree(repositoryRoot);
	const pathViolations = groupViolationsByPath(violations, 'path');
	const contentViolations = groupViolationsByPath(violations, 'content');
	const untrackedDestinationOccupants = await collectUntrackedDestinationOccupants(
		repositoryRoot,
		trackedPaths,
		pathViolations
	);
	const collisions = collectCollisions(trackedPaths, untrackedDestinationOccupants, pathViolations);
	const blobs = await baselineBlobMap(repositoryRoot, baselineCommit);
	const binary = await trackedBinaryMap(repositoryRoot, trackedPaths);
	const index = await currentIndexEntries(repositoryRoot);
	const resolveSourceBlob = (source: string): string => {
		const receiptBlob = previousReceipt?.successorBlobsByPathHash.get(hashRepositoryPath(source));
		if (receiptBlob !== undefined && index.get(source)?.blobId !== receiptBlob) {
			throw new Error(`Prior receipt successor blob does not match the tracked source: ${source}`);
		}
		const sourceBlobId = receiptBlob ?? blobs.get(source);
		if (sourceBlobId === undefined) {
			throw new Error(
				`Tracked migration source is absent from baseline and prior receipt: ${source}`
			);
		}
		return sourceBlobId;
	};

	const pathMoves: AmericanEnglishPathMove[] = [];
	for (const source of trackedPaths) {
		if (!isUnderRoot(source, roots)) continue;
		const selected = (pathViolations.get(source) ?? []).filter(({ ruleId }) =>
			selectedRuleIds.has(ruleId)
		);
		if (selected.length === 0) continue;
		const destination = replacePathViolations(source, selected);
		if (destination === source) continue;
		const sourceBlobId = resolveSourceBlob(source);
		pathMoves.push({ source, destination, sourceBlobId, binary: binary.get(source) ?? false });
	}

	const textEdits = [...contentViolations.entries()]
		.filter(([repositoryPath]) => isUnderRoot(repositoryPath, roots))
		.map(([repositoryPath, values]) => ({
			path: repositoryPath,
			violationCount: values.filter(({ ruleId }) => selectedRuleIds.has(ruleId)).length
		}))
		.filter(({ violationCount }) => violationCount > 0)
		.sort((left, right) => compareCodepoints(left.path, right.path));
	for (const { path: source } of textEdits) resolveSourceBlob(source);
	const affectedPaths = [
		...new Set([
			...textEdits.map(({ path: repositoryPath }) => repositoryPath),
			...pathMoves.map(({ source }) => source)
		])
	].sort(compareCodepoints);
	const migrationProjection = {
		textEdits,
		pathMoves: pathMoves.sort((left, right) => compareCodepoints(left.source, right.source))
	};
	const projectedPaths = new Map(
		migrationProjection.pathMoves.map(({ source, destination }) => [source, destination])
	);
	const projectedBytes = new Map<string, Uint8Array>();
	for (const { path: repositoryPath } of textEdits) {
		const absolutePath = path.join(repositoryRoot, ...repositoryPath.split('/'));
		const status = await lstat(absolutePath);
		const source = status.isSymbolicLink()
			? await readlink(absolutePath)
			: (await readFile(absolutePath)).toString('utf8');
		const selected = (contentViolations.get(repositoryPath) ?? []).filter(({ ruleId }) =>
			selectedRuleIds.has(ruleId)
		);
		projectedBytes.set(repositoryPath, Buffer.from(applyContentViolations(source, selected)));
	}
	const integrity = await classifyIntegrityBindings(
		await collectIntegritySnapshot(
			repositoryRoot,
			affectedPaths,
			binary,
			new Map(pathMoves.map(({ source, sourceBlobId }) => [source, sourceBlobId])),
			index,
			projectedPaths,
			projectedBytes
		),
		migrationProjection,
		AMERICAN_ENGLISH_INTEGRITY_OWNERS,
		ruleIds
	);
	const selectedOwnerIds = new Set(integrity.ownerPlans.map(({ id }) => id));
	const selectedOwners = AMERICAN_ENGLISH_INTEGRITY_OWNERS.filter(({ id }) =>
		selectedOwnerIds.has(id)
	);
	const materializedOwnerBytes = await materializeAuthenticatedOwnerIntents({
		repositoryRoot,
		headCommit,
		owners: selectedOwners,
		index,
		textEdits,
		pathMoves: migrationProjection.pathMoves,
		projectedBytes
	});
	const closureProjectedBytes = new Map(projectedBytes);
	for (const [repositoryPath, bytes] of materializedOwnerBytes) {
		closureProjectedBytes.set(repositoryPath, bytes);
	}
	const closurePathSet = new Set([
		...integrity.ownerPlans.flatMap(({ paths: ownerPaths }) => ownerPaths),
		...materializedOwnerBytes.keys()
	]);
	const searchedReferences = new Set<string>();
	let closureIntegrity = integrity;
	while (closurePathSet.size > 0) {
		const closurePaths = [...closurePathSet].sort(compareCodepoints);
		closureIntegrity = await classifyIntegrityBindings(
			await collectIntegritySnapshot(
				repositoryRoot,
				closurePaths,
				binary,
				new Map(pathMoves.map(({ source, sourceBlobId }) => [source, sourceBlobId])),
				index,
				projectedPaths,
				closureProjectedBytes
			),
			{
				textEdits: closurePaths
					.filter((repositoryPath) => !(binary.get(repositoryPath) ?? false))
					.map((repositoryPath) => ({ path: repositoryPath })),
				pathMoves: closurePaths
					.filter((repositoryPath) => binary.get(repositoryPath) ?? false)
					.map((source) => ({ source }))
			},
			selectedOwners,
			ruleIds
		);
		const references = [
			...closureIntegrity.ownerPlans.flatMap(({ successorIntents }) =>
				successorIntents.flatMap(({ currentValueDigest, currentRawDigest }) => [
					currentValueDigest,
					currentRawDigest
				])
			),
			...migrationProjection.pathMoves.flatMap(({ source, destination }) => [source, destination])
		].filter((reference) => {
			if (searchedReferences.has(reference)) return false;
			searchedReferences.add(reference);
			return true;
		});
		if (references.length === 0) break;
		const referencedPaths = await trackedPathsReferencing(repositoryRoot, references);
		let added = false;
		for (const repositoryPath of referencedPaths) {
			const matchingOwner = selectedOwners.find((owner) => owner.ownsPath(repositoryPath));
			if (
				closurePathSet.has(repositoryPath) ||
				matchingOwner === undefined ||
				!matchingOwner.regeneratesPath(repositoryPath)
			) {
				continue;
			}
			closurePathSet.add(repositoryPath);
			added = true;
		}
		if (!added) break;
	}
	const allIntegrityProblems = [...integrity.problems, ...closureIntegrity.problems].filter(
		(problem, index, all) =>
			all.findIndex(
				(candidate) =>
					candidate.path === problem.path &&
					candidate.jsonPointer === problem.jsonPointer &&
					candidate.code === problem.code &&
					candidate.message === problem.message
			) === index
	);
	const unownedIntegrityBindings = [...new Set(allIntegrityProblems.map(({ path }) => path))]
		.sort(compareCodepoints)
		.map((problemPath) => ({
			path: problemPath,
			reasons: allIntegrityProblems
				.filter(({ path: candidatePath }) => candidatePath === problemPath)
				.map(
					({ code, jsonPointer, message }) =>
						`${code}${jsonPointer.length === 0 ? '' : ` ${jsonPointer}`}: ${message}`
				)
		}));
	const directOwnerByPath = new Map(
		integrity.ownerPlans.flatMap((owner) =>
			owner.paths.map((repositoryPath) => [repositoryPath, owner.id] as const)
		)
	);
	const directSuccessors = await Promise.all(
		affectedPaths.map(async (source) => {
			const destination = projectedPaths.get(source) ?? source;
			let successorBytes = projectedBytes.get(source);
			if (successorBytes === undefined) {
				const absolutePath = path.join(repositoryRoot, ...source.split('/'));
				const status = await lstat(absolutePath);
				successorBytes = status.isSymbolicLink()
					? Buffer.from(await readlink(absolutePath))
					: await readFile(absolutePath);
			}
			return {
				sourcePathHash: hashRepositoryPath(source),
				successorPathHash: hashRepositoryPath(destination),
				sourceBlobId: resolveSourceBlob(source),
				successorBlobId: await gitBlobId(repositoryRoot, successorBytes),
				binary: binary.get(source) ?? false,
				ownerId: directOwnerByPath.get(source) ?? ('migration-planner' as const)
			};
		})
	);
	const closureIntents = closureIntegrity.ownerPlans.flatMap((owner) =>
		owner.successorIntents.map((intent) => ({ ...intent, ownerId: owner.id }))
	);
	const projectedTextBySource = new Map<string, string>();
	for (const intent of closureIntents.filter(({ serializer }) => serializer === 'utf8-string')) {
		const projected = closureProjectedBytes.get(intent.sourcePath);
		projectedTextBySource.set(
			intent.sourcePath,
			projected === undefined
				? (await readFile(path.join(repositoryRoot, ...intent.sourcePath.split('/')))).toString(
						'utf8'
					)
				: Buffer.from(projected).toString('utf8')
		);
	}
	for (let iteration = 0; iteration <= closureIntents.length; iteration += 1) {
		let changed = false;
		const sourcesByCurrentDigest = new Map<string, typeof closureIntents>();
		for (const intent of closureIntents) {
			const sources = sourcesByCurrentDigest.get(intent.currentValueDigest) ?? [];
			sources.push(intent);
			sourcesByCurrentDigest.set(intent.currentValueDigest, sources);
		}
		for (const intent of closureIntents.filter(({ serializer }) => serializer === 'utf8-string')) {
			let text = projectedTextBySource.get(intent.sourcePath)!;
			const dependencies = new Map(
				intent.dependencies.map((dependency) => [dependency.path, dependency])
			);
			for (const [currentDigest, sources] of sourcesByCurrentDigest) {
				if (sources.length !== 1) continue;
				const source = sources[0]!;
				if (
					source.sourcePath === intent.sourcePath ||
					source.projectedValueDigest === currentDigest ||
					!text.includes(currentDigest)
				) {
					continue;
				}
				text = text.replaceAll(currentDigest, source.projectedValueDigest);
				dependencies.set(source.path, {
					path: source.path,
					digest: source.projectedValueDigest
				});
			}
			for (const { source, destination } of migrationProjection.pathMoves) {
				if (text.includes(source)) text = text.replaceAll(source, destination);
			}
			const owner = selectedOwners.find(({ id }) => id === intent.ownerId)!;
			const projectedValueDigest = owner.digest('utf8-string', text);
			if (
				projectedValueDigest !== intent.projectedValueDigest ||
				JSON.stringify([...dependencies.values()]) !== JSON.stringify(intent.dependencies)
			) {
				intent.projectedValueDigest = projectedValueDigest;
				intent.projectedRawDigest = projectedValueDigest;
				intent.projectedBytes = Buffer.from(text, 'utf8');
				intent.dependencies = [...dependencies.values()].sort((left, right) =>
					compareCodepoints(left.path, right.path)
				);
				changed = true;
			}
		}
		if (!changed) break;
		if (iteration === closureIntents.length) {
			throw new Error('UTF-8 integrity dependency closure did not converge');
		}
	}
	const changedClosureIntents = closureIntents.filter(
		(intent) =>
			intent.sourcePath !== intent.path || intent.currentValueDigest !== intent.projectedValueDigest
	);
	const expectedOwnerSuccessors = closureIntegrity.ownerPlans
		.flatMap((owner) =>
			changedClosureIntents
				.filter((intent) => intent.ownerId === owner.id)
				.map((intent) => {
					const source = index.get(intent.sourcePath);
					if (source === undefined) {
						throw new Error(
							`Integrity closure source is absent from plan HEAD: ${intent.sourcePath}`
						);
					}
					const externalBindings = intent.externalDependencies.map(
						({ jsonPointer, value, candidatePaths }) => ({
							jsonPointerHash: hashRepositoryPath(jsonPointer),
							value,
							candidatePathHashes:
								candidatePaths?.map(hashRepositoryPath).sort(compareCodepoints) ?? []
						})
					);
					return {
						ownerId: owner.id,
						sourcePathHash: hashRepositoryPath(intent.sourcePath),
						successorPathHash: hashRepositoryPath(intent.path),
						sourceBlobId: source.blobId,
						mode: source.mode,
						kind: intent.kind,
						serializer: intent.serializer,
						currentValueDigest: intent.currentValueDigest,
						projectedValueDigest: intent.projectedValueDigest,
						currentRawDigest: intent.currentRawDigest,
						projectedRawDigest: intent.projectedRawDigest,
						dependencies: intent.dependencies.map(
							({ path: dependencyPath, digest, digestKind }) => ({
								successorPathHash: hashRepositoryPath(dependencyPath),
								digest,
								...(digestKind === undefined ? {} : { digestKind })
							})
						),
						externalBindingsDigest: sha256(Buffer.from(JSON.stringify(externalBindings), 'utf8'))
					};
				})
		)
		.sort((left, right) => compareCodepoints(left.successorPathHash, right.successorPathHash));
	const futureRulePaths = new Set(
		violations
			.filter(({ ruleId }) => !selectedRuleIds.has(ruleId))
			.map(({ path: repositoryPath }) => repositoryPath)
	);
	const authenticatedHeadPreimages = [...futureRulePaths]
		.filter((repositoryPath) => {
			const current = index.get(repositoryPath);
			return current !== undefined && blobs.get(repositoryPath) !== current.blobId;
		})
		.sort(compareCodepoints)
		.map((repositoryPath) => ({
			successorPathHash: hashRepositoryPath(repositoryPath),
			blobId: index.get(repositoryPath)!.blobId,
			mode: index.get(repositoryPath)!.mode,
			binary: binary.get(repositoryPath) ?? false
		}));

	const planMaterial: Omit<AmericanEnglishMigrationPlan, 'inventoryFingerprint'> = {
		baselineCommit,
		headCommit,
		ruleIds,
		roots,
		textEdits,
		pathMoves: migrationProjection.pathMoves,
		collisions,
		unownedIntegrityBindings,
		integrityOwners: integrity.ownerPlans.map(stripPrivateOwnerBytes),
		directSuccessors: directSuccessors.sort((left, right) =>
			compareCodepoints(left.successorPathHash, right.successorPathHash)
		),
		expectedOwnerSuccessors,
		authenticatedHeadPreimages,
		previousReceiptHash: previousReceipt?.receiptHash ?? null
	};
	const plan = { ...planMaterial, inventoryFingerprint: fingerprintPlanMaterial(planMaterial) };
	const ownerBytes = new Map<string, Uint8Array>();
	for (const intent of changedClosureIntents) {
		if (intent.projectedBytes === undefined) {
			throw new Error('Authenticated owner successor bytes are absent from the plan-time closure');
		}
		ownerBytes.set(intent.path, intent.projectedBytes);
	}
	authenticatedOwnerBytesByPlan.set(plan, ownerBytes);
	return plan;
}

function violationOffset(source: string, violation: AmericanEnglishViolation): number {
	if (violation.line === null || violation.column === null) {
		throw new Error(`Content violation lacks a position: ${violation.path}`);
	}
	let offset = 0;
	for (let line = 1; line < violation.line; line += 1) {
		const newline = source.indexOf('\n', offset);
		if (newline === -1) throw new Error(`Invalid content position: ${violation.path}`);
		offset = newline + 1;
	}
	return offset + violation.column - 1;
}

function applyContentViolations(
	source: string,
	violations: readonly AmericanEnglishViolation[]
): string {
	const edits = violations
		.map((violation) => ({ violation, offset: violationOffset(source, violation) }))
		.sort((left, right) => right.offset - left.offset);
	let result = source;
	for (const { violation, offset } of edits) {
		if (source.slice(offset, offset + violation.found.length) !== violation.found) {
			throw new Error(`Content changed after planning: ${violation.path}`);
		}
		result = `${result.slice(0, offset)}${violation.recommended}${result.slice(
			offset + violation.found.length
		)}`;
	}
	return result;
}

async function readSnapshot(
	repositoryRoot: string,
	source: string,
	destination: string
): Promise<FileSnapshot> {
	const absolutePath = path.join(repositoryRoot, ...source.split('/'));
	const status = await lstat(absolutePath);
	return {
		source,
		destination,
		bytes: status.isSymbolicLink()
			? Buffer.from(await readlink(absolutePath))
			: await readFile(absolutePath),
		kind: status.isSymbolicLink() ? 'symlink' : 'file',
		mode: status.mode
	};
}

async function removeLeaf(absolutePath: string): Promise<void> {
	try {
		const status = await lstat(absolutePath);
		if (status.isDirectory() && !status.isSymbolicLink()) return;
		await unlink(absolutePath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
}

async function restoreSnapshots(
	repositoryRoot: string,
	snapshots: readonly FileSnapshot[]
): Promise<void> {
	const leaves = [
		...new Set(snapshots.flatMap(({ source, destination }) => [source, destination]))
	].sort(
		(left, right) =>
			right.split('/').length - left.split('/').length || compareCodepoints(left, right)
	);
	for (const repositoryPath of leaves) {
		await removeLeaf(path.join(repositoryRoot, ...repositoryPath.split('/')));
	}
	for (const snapshot of snapshots) {
		const absolutePath = path.join(repositoryRoot, ...snapshot.source.split('/'));
		await mkdir(path.dirname(absolutePath), { recursive: true });
		if (snapshot.kind === 'symlink') await symlink(snapshot.bytes.toString('utf8'), absolutePath);
		else {
			await writeFile(absolutePath, snapshot.bytes);
			await chmod(absolutePath, snapshot.mode);
		}
	}
	await runGit(repositoryRoot, ['reset', '--quiet', 'HEAD', '--', '.']);
	const parents = [
		...new Set(
			leaves.flatMap((repositoryPath) => {
				const values: string[] = [];
				let current = path.posix.dirname(repositoryPath);
				while (current !== '.') {
					values.push(current);
					current = path.posix.dirname(current);
				}
				return values;
			})
		)
	].sort(
		(left, right) =>
			right.split('/').length - left.split('/').length || compareCodepoints(left, right)
	);
	for (const repositoryPath of parents) {
		try {
			await rmdir(path.join(repositoryRoot, ...repositoryPath.split('/')));
		} catch (error) {
			const code = (error as NodeJS.ErrnoException).code;
			if (code !== 'ENOENT' && code !== 'ENOTEMPTY') throw error;
		}
	}
}

function orderMoves(pathMoves: readonly AmericanEnglishPathMove[]): AmericanEnglishPathMove[] {
	const remaining = [...pathMoves];
	const ordered: AmericanEnglishPathMove[] = [];
	while (remaining.length > 0) {
		const sources = new Set(remaining.map(({ source }) => source));
		const candidates = remaining
			.filter(({ destination }) => !sources.has(destination))
			.sort(
				(left, right) =>
					right.source.split('/').length - left.source.split('/').length ||
					compareCodepoints(left.source, right.source)
			);
		if (candidates.length === 0) throw new Error('Path move dependency cycle');
		const next = candidates[0]!;
		ordered.push(next);
		remaining.splice(remaining.indexOf(next), 1);
	}
	return ordered;
}

function parseIndexEntries(buffer: Buffer): ReadonlyMap<string, { mode: string; blobId: string }> {
	const entries = new Map<string, { mode: string; blobId: string }>();
	for (const field of splitNul(buffer)) {
		const tab = field.indexOf('\t');
		if (tab === -1) continue;
		const metadata = field.slice(0, tab).split(' ');
		const repositoryPath = field.slice(tab + 1);
		const mode = metadata[0];
		const blobId = metadata[1];
		if (mode !== undefined && blobId !== undefined) entries.set(repositoryPath, { mode, blobId });
	}
	return entries;
}

async function currentIndexEntries(
	repositoryRoot: string
): Promise<ReadonlyMap<string, { mode: string; blobId: string }>> {
	return parseIndexEntries(await runGit(repositoryRoot, ['ls-files', '-sz']));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isObjectId(value: unknown): value is string {
	return typeof value === 'string' && /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u.test(value);
}

const RECEIPT_OWNER_IDS = [
	'authenticated-plan-head',
	'equipment',
	'migration-planner',
	'runtime-and-engine',
	'visual-production'
] as const;

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
	return (
		Object.keys(value).sort(compareCodepoints).join('\0') ===
		[...keys].sort(compareCodepoints).join('\0')
	);
}

function validateReceiptValue(
	value: unknown,
	expectedBaselineCommit?: string
): AmericanEnglishMigrationReceipt {
	if (
		!isRecord(value) ||
		!hasExactKeys(value, ['baselineCommit', 'policyVersion', 'ruleCounts', 'ownerCounts', 'files'])
	) {
		throw new Error('Migration receipt must be a hash-only JSON object with the exact schema');
	}
	if (!isObjectId(value.baselineCommit)) {
		throw new Error('Migration receipt baseline commit is invalid');
	}
	if (expectedBaselineCommit !== undefined && value.baselineCommit !== expectedBaselineCommit) {
		throw new Error('Prior migration receipt baseline does not match the requested baseline');
	}
	if (value.policyVersion !== POLICY_VERSION) {
		throw new Error('Prior migration receipt policy version does not match');
	}
	const ruleCounts = value.ruleCounts;
	if (
		!isRecord(ruleCounts) ||
		!hasExactKeys(ruleCounts, AMERICAN_ENGLISH_RULE_IDS) ||
		AMERICAN_ENGLISH_RULE_IDS.some(
			(ruleId) => !Number.isSafeInteger(ruleCounts[ruleId]) || Number(ruleCounts[ruleId]) < 0
		)
	) {
		throw new Error('Migration receipt rule counts are invalid');
	}
	if (
		!isRecord(value.ownerCounts) ||
		Object.entries(value.ownerCounts).some(
			([ownerId, count]) =>
				!RECEIPT_OWNER_IDS.includes(ownerId as (typeof RECEIPT_OWNER_IDS)[number]) ||
				!Number.isSafeInteger(count) ||
				Number(count) < 0
		)
	) {
		throw new Error('Migration receipt owner counts are invalid');
	}
	if (!Array.isArray(value.files)) throw new Error('Prior migration receipt files are invalid');
	const successorPathHashes = new Set<string>();
	const countedOwners = new Map<string, number>();
	for (const file of value.files) {
		if (
			!isRecord(file) ||
			!hasExactKeys(file, [
				'sourceBlobId',
				'successorPathHash',
				'successorBlobId',
				'unchangedBinary',
				'ownerId'
			]) ||
			!isObjectId(file.sourceBlobId) ||
			!isObjectId(file.successorBlobId) ||
			!RECEIPT_OWNER_IDS.includes(file.ownerId as (typeof RECEIPT_OWNER_IDS)[number]) ||
			typeof file.successorPathHash !== 'string' ||
			!/^[0-9a-f]{64}$/u.test(file.successorPathHash) ||
			typeof file.unchangedBinary !== 'boolean'
		) {
			throw new Error('Prior migration receipt contains an invalid file binding');
		}
		if (successorPathHashes.has(file.successorPathHash)) {
			throw new Error('Prior migration receipt contains a duplicate successor path hash');
		}
		const ownerId = file.ownerId as (typeof RECEIPT_OWNER_IDS)[number];
		successorPathHashes.add(file.successorPathHash);
		countedOwners.set(ownerId, (countedOwners.get(ownerId) ?? 0) + 1);
	}
	const expectedOwnerCounts = Object.fromEntries(
		[...countedOwners.entries()].sort(([left], [right]) => compareCodepoints(left, right))
	);
	const actualOwnerCounts = Object.fromEntries(
		Object.entries(value.ownerCounts).sort(([left], [right]) => compareCodepoints(left, right))
	);
	if (JSON.stringify(actualOwnerCounts) !== JSON.stringify(expectedOwnerCounts)) {
		throw new Error('Migration receipt owner counts do not match its file bindings');
	}
	return value as unknown as AmericanEnglishMigrationReceipt;
}

async function readPreviousReceipt(
	receiptPath: string | undefined,
	expectedBaselineCommit: string
): Promise<ValidatedReceipt | null> {
	if (receiptPath === undefined) return null;
	const bytes = await readFile(path.resolve(receiptPath));
	const value: unknown = JSON.parse(bytes.toString('utf8'));
	const receipt = validateReceiptValue(value, expectedBaselineCommit);
	const successorBlobsByPathHash = new Map<string, string>();
	for (const file of receipt.files) {
		successorBlobsByPathHash.set(file.successorPathHash, file.successorBlobId);
	}
	return {
		receipt,
		successorBlobsByPathHash,
		receiptHash: sha256(Buffer.from(JSON.stringify(receipt), 'utf8'))
	};
}

async function writeReceipt(
	receiptPath: string,
	receipt: AmericanEnglishMigrationReceipt
): Promise<void> {
	const absolutePath = path.resolve(receiptPath);
	await mkdir(path.dirname(absolutePath), { recursive: true });
	const temporaryPath = `${absolutePath}.tmp-${process.pid}-${Date.now()}`;
	await writeFile(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
	try {
		await link(temporaryPath, absolutePath);
		await unlink(temporaryPath);
	} catch (error) {
		await rm(temporaryPath, { force: true });
		throw error;
	}
}

async function commitTreeEntries(
	repositoryRoot: string,
	commit: string
): Promise<ReadonlyMap<string, { readonly mode: string; readonly blobId: string }>> {
	const entries = new Map<string, { readonly mode: string; readonly blobId: string }>();
	for (const field of splitNul(
		await runGit(repositoryRoot, ['ls-tree', '-rz', '--full-tree', commit])
	)) {
		const tab = field.indexOf('\t');
		if (tab === -1) continue;
		const metadata = field.slice(0, tab).split(' ');
		const repositoryPath = field.slice(tab + 1);
		const mode = metadata[0];
		const type = metadata[1];
		const blobId = metadata[2];
		if (mode !== undefined && type === 'blob' && blobId !== undefined) {
			entries.set(repositoryPath, { mode, blobId });
		}
	}
	return entries;
}

async function assertBlobObjectsExist(
	repositoryRoot: string,
	objectIds: readonly string[]
): Promise<void> {
	const unique = [...new Set(objectIds)].sort(compareCodepoints);
	if (unique.length === 0) return;
	const result = await runGitResult(
		repositoryRoot,
		['cat-file', '--batch-check=%(objectname) %(objecttype)'],
		Buffer.from(`${unique.join('\n')}\n`)
	);
	if (result.exitCode !== 0) throw new Error('Unable to verify migration receipt blob objects');
	const lines = result.stdout.toString('utf8').trim().split('\n');
	if (
		lines.length !== unique.length ||
		lines.some((line, index) => line !== `${unique[index]} blob`)
	) {
		throw new Error('Migration receipt references an unknown or non-blob object');
	}
}

async function readTrackedBytes(repositoryRoot: string, repositoryPath: string): Promise<Buffer> {
	const absolutePath = path.join(repositoryRoot, ...repositoryPath.split('/'));
	const status = await lstat(absolutePath);
	return status.isSymbolicLink()
		? Buffer.from(await readlink(absolutePath), 'utf8')
		: readFile(absolutePath);
}

function ownerCountsForReceiptFiles(
	files: readonly AmericanEnglishMigrationReceiptFile[]
): Readonly<Record<string, number>> {
	const counts = new Map<string, number>();
	for (const { ownerId } of files) counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1);
	return Object.fromEntries(
		[...counts.entries()].sort(([left], [right]) => compareCodepoints(left, right))
	);
}

function validatePlanValue(value: unknown): AmericanEnglishMigrationPlan {
	const keys = [
		'authenticatedHeadPreimages',
		'baselineCommit',
		'collisions',
		'directSuccessors',
		'expectedOwnerSuccessors',
		'headCommit',
		'integrityOwners',
		'inventoryFingerprint',
		'pathMoves',
		'previousReceiptHash',
		'roots',
		'ruleIds',
		'textEdits',
		'unownedIntegrityBindings'
	] as const;
	if (!isRecord(value) || !hasExactKeys(value, keys)) {
		throw new Error('Migration plan artifact has an invalid schema');
	}
	const { inventoryFingerprint, ...material } = value;
	if (
		typeof inventoryFingerprint !== 'string' ||
		!/^[0-9a-f]{64}$/u.test(inventoryFingerprint) ||
		fingerprintPlanMaterial(
			material as Omit<AmericanEnglishMigrationPlan, 'inventoryFingerprint'>
		) !== inventoryFingerprint ||
		!isObjectId(value.baselineCommit) ||
		!isObjectId(value.headCommit) ||
		!Array.isArray(value.ruleIds) ||
		value.ruleIds.some(
			(ruleId) =>
				typeof ruleId !== 'string' ||
				!AMERICAN_ENGLISH_RULE_IDS.includes(ruleId as AmericanEnglishRuleId)
		) ||
		!Array.isArray(value.roots) ||
		!Array.isArray(value.textEdits) ||
		!Array.isArray(value.pathMoves) ||
		!Array.isArray(value.collisions) ||
		!Array.isArray(value.unownedIntegrityBindings) ||
		!Array.isArray(value.integrityOwners) ||
		!Array.isArray(value.directSuccessors) ||
		!Array.isArray(value.expectedOwnerSuccessors) ||
		!Array.isArray(value.authenticatedHeadPreimages) ||
		(value.previousReceiptHash !== null &&
			(typeof value.previousReceiptHash !== 'string' ||
				!/^[0-9a-f]{64}$/u.test(value.previousReceiptHash)))
	) {
		throw new Error('Migration plan artifact fingerprint or material is invalid');
	}
	const hash = (candidate: unknown) =>
		typeof candidate === 'string' && /^[0-9a-f]{64}$/u.test(candidate);
	const directKeys = [
		'binary',
		'ownerId',
		'sourceBlobId',
		'sourcePathHash',
		'successorBlobId',
		'successorPathHash'
	] as const;
	for (const direct of value.directSuccessors) {
		if (
			!isRecord(direct) ||
			!hasExactKeys(direct, directKeys) ||
			!hash(direct.sourcePathHash) ||
			!hash(direct.successorPathHash) ||
			!isObjectId(direct.sourceBlobId) ||
			!isObjectId(direct.successorBlobId) ||
			typeof direct.binary !== 'boolean' ||
			!RECEIPT_OWNER_IDS.includes(direct.ownerId as (typeof RECEIPT_OWNER_IDS)[number]) ||
			direct.ownerId === 'authenticated-plan-head'
		) {
			throw new Error('Migration plan has an invalid direct successor intent');
		}
	}
	const ownerKeys = [
		'currentRawDigest',
		'currentValueDigest',
		'dependencies',
		'externalBindingsDigest',
		'kind',
		'mode',
		'ownerId',
		'projectedValueDigest',
		'projectedRawDigest',
		'serializer',
		'sourceBlobId',
		'sourcePathHash',
		'successorPathHash'
	] as const;
	for (const successor of value.expectedOwnerSuccessors) {
		if (
			!isRecord(successor) ||
			!hasExactKeys(successor, ownerKeys) ||
			!hash(successor.sourcePathHash) ||
			!hash(successor.successorPathHash) ||
			!hash(successor.currentValueDigest) ||
			!hash(successor.projectedValueDigest) ||
			!hash(successor.currentRawDigest) ||
			!hash(successor.projectedRawDigest) ||
			!hash(successor.externalBindingsDigest) ||
			!isObjectId(successor.sourceBlobId) ||
			typeof successor.mode !== 'string' ||
			!Array.isArray(successor.dependencies) ||
			!AMERICAN_ENGLISH_INTEGRITY_OWNERS.some(({ id }) => id === successor.ownerId)
		) {
			throw new Error('Migration plan has an invalid owner successor intent');
		}
		for (const dependency of successor.dependencies) {
			if (
				!isRecord(dependency) ||
				(!hasExactKeys(dependency, ['successorPathHash', 'digest']) &&
					!hasExactKeys(dependency, ['successorPathHash', 'digest', 'digestKind'])) ||
				!hash(dependency.successorPathHash) ||
				!hash(dependency.digest) ||
				('digestKind' in dependency && dependency.digestKind !== 'raw-bytes')
			) {
				throw new Error('Migration plan has an invalid owner dependency intent');
			}
		}
	}
	for (const preimage of value.authenticatedHeadPreimages) {
		if (
			!isRecord(preimage) ||
			!hasExactKeys(preimage, ['successorPathHash', 'blobId', 'mode', 'binary']) ||
			!hash(preimage.successorPathHash) ||
			!isObjectId(preimage.blobId) ||
			typeof preimage.mode !== 'string' ||
			typeof preimage.binary !== 'boolean'
		) {
			throw new Error('Migration plan has an invalid authenticated HEAD preimage');
		}
	}
	for (const entries of [
		value.directSuccessors,
		value.expectedOwnerSuccessors,
		value.authenticatedHeadPreimages
	]) {
		const hashes = entries.map(
			(entry) => (entry as { successorPathHash: string }).successorPathHash
		);
		if (new Set(hashes).size !== hashes.length) {
			throw new Error('Migration plan contains duplicate successor path hashes');
		}
	}
	return value as unknown as AmericanEnglishMigrationPlan;
}

function pathsByHash(
	entries: ReadonlyMap<string, { readonly mode: string; readonly blobId: string }>
): ReadonlyMap<string, string> {
	const result = new Map<string, string>();
	for (const repositoryPath of entries.keys()) {
		const hashed = hashRepositoryPath(repositoryPath);
		if (result.has(hashed)) throw new Error('Tracked paths contain a duplicate path hash');
		result.set(hashed, repositoryPath);
	}
	return result;
}

export async function finalizeAmericanEnglishMigrationReceipt(
	options: FinalizeAmericanEnglishMigrationReceiptOptions
): Promise<AmericanEnglishMigrationReceipt> {
	if ('migrationBaseCommit' in options) {
		throw new Error('Caller-supplied migration boundary/base is not accepted');
	}
	const repositoryRoot = path.resolve(options.repositoryRoot ?? process.cwd());
	const receiptPath = path.resolve(options.receiptPath);
	const receiptRelative = path.relative(repositoryRoot, receiptPath);
	if (
		receiptRelative === '' ||
		(!receiptRelative.startsWith('..') && !path.isAbsolute(receiptRelative))
	) {
		throw new Error('Finalized migration receipt must be written outside the repository');
	}
	try {
		await lstat(receiptPath);
		throw new Error(`Migration receipt already exists: ${receiptPath}`);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}

	const planBytes = await readFile(path.resolve(options.planPath));
	if (
		!/^[0-9a-f]{64}$/u.test(options.expectedPlanHash) ||
		sha256(planBytes) !== options.expectedPlanHash
	) {
		throw new Error('Migration plan file hash does not match the expected SHA-256');
	}
	const plan = validatePlanValue(JSON.parse(planBytes.toString('utf8')));
	const initialBytes = await readFile(path.resolve(options.initialReceiptPath));
	if (
		!/^[0-9a-f]{64}$/u.test(options.expectedInitialReceiptHash) ||
		sha256(initialBytes) !== options.expectedInitialReceiptHash
	) {
		throw new Error('Initial receipt file hash does not match the expected SHA-256');
	}
	const initialReceipt = validateReceiptValue(
		JSON.parse(initialBytes.toString('utf8')),
		plan.baselineCommit
	);
	let previousReceipt: AmericanEnglishMigrationReceipt | null = null;
	if (plan.previousReceiptHash === null) {
		if (options.previousReceiptPath !== undefined) {
			throw new Error('Authenticated plan does not use a previous receipt');
		}
	} else {
		if (options.previousReceiptPath === undefined) {
			throw new Error('Authenticated plan requires its previous receipt');
		}
		const previousBytes = await readFile(path.resolve(options.previousReceiptPath));
		if (sha256(previousBytes) !== plan.previousReceiptHash) {
			throw new Error('Previous receipt does not match the authenticated plan');
		}
		previousReceipt = validateReceiptValue(
			JSON.parse(previousBytes.toString('utf8')),
			plan.baselineCommit
		);
	}

	const expectedMigrationCommit = (
		await runGit(repositoryRoot, [
			'rev-parse',
			'--verify',
			`${options.expectedMigrationCommit}^{commit}`
		])
	)
		.toString('utf8')
		.trim();
	const headCommit = (await runGit(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}']))
		.toString('utf8')
		.trim();
	if (headCommit !== expectedMigrationCommit) {
		throw new Error('Expected migration commit does not match repository HEAD');
	}
	const firstParent = (
		await runGit(repositoryRoot, ['rev-parse', '--verify', `${expectedMigrationCommit}^1`])
	)
		.toString('utf8')
		.trim();
	if (firstParent !== plan.headCommit) {
		throw new Error('Authenticated plan HEAD is not the direct first-parent migration boundary');
	}
	const status = await runGit(repositoryRoot, [
		'status',
		'--porcelain=v1',
		'-z',
		'--untracked-files=all'
	]);
	if (status.length > 0) {
		throw new Error('Receipt finalization requires a clean working tree and index');
	}
	const baselineAncestor = await runGitResult(repositoryRoot, [
		'merge-base',
		'--is-ancestor',
		plan.baselineCommit,
		plan.headCommit
	]);
	if (baselineAncestor.exitCode !== 0) {
		throw new Error('Migration receipt baseline is not an ancestor of the authenticated plan HEAD');
	}

	const [baseEntries, currentEntries] = await Promise.all([
		commitTreeEntries(repositoryRoot, plan.headCommit),
		currentIndexEntries(repositoryRoot)
	]);
	const basePathsByHash = pathsByHash(baseEntries);
	const currentPathsByHash = pathsByHash(currentEntries);
	const ownerBySuccessorHash = new Map(
		plan.expectedOwnerSuccessors.map((successor) => [successor.successorPathHash, successor])
	);

	const expectedInitial = new Map<string, AmericanEnglishMigrationReceiptFile>(
		previousReceipt?.files.map((file) => [file.successorPathHash, file]) ?? []
	);
	for (const direct of plan.directSuccessors) {
		const sourcePath = basePathsByHash.get(direct.sourcePathHash);
		if (sourcePath === undefined || baseEntries.get(sourcePath)?.blobId !== direct.sourceBlobId) {
			throw new Error('Direct successor source lacks authenticated plan-HEAD provenance');
		}
		expectedInitial.delete(direct.sourcePathHash);
		expectedInitial.set(direct.successorPathHash, {
			sourceBlobId: direct.sourceBlobId,
			successorPathHash: direct.successorPathHash,
			successorBlobId: direct.successorBlobId,
			unchangedBinary: direct.binary && direct.sourceBlobId === direct.successorBlobId,
			ownerId: direct.ownerId
		});
	}
	if (
		JSON.stringify(
			[...initialReceipt.files].sort((left, right) =>
				compareCodepoints(left.successorPathHash, right.successorPathHash)
			)
		) !==
		JSON.stringify(
			[...expectedInitial.values()].sort((left, right) =>
				compareCodepoints(left.successorPathHash, right.successorPathHash)
			)
		)
	) {
		throw new Error('Initial receipt does not match the authenticated plan direct successors');
	}

	const expectedChangedHashes = new Set([
		...plan.directSuccessors.map(({ successorPathHash }) => successorPathHash),
		...plan.expectedOwnerSuccessors.map(({ successorPathHash }) => successorPathHash)
	]);
	const actualChangedHashes = new Set(
		[...currentEntries.entries()]
			.filter(([repositoryPath, current]) => {
				const base = baseEntries.get(repositoryPath);
				return base === undefined || base.blobId !== current.blobId || base.mode !== current.mode;
			})
			.map(([repositoryPath]) => hashRepositoryPath(repositoryPath))
	);
	if (
		JSON.stringify([...actualChangedHashes].sort(compareCodepoints)) !==
		JSON.stringify([...expectedChangedHashes].sort(compareCodepoints))
	) {
		throw new Error(
			'Unplanned or unowned post-apply delta does not exactly match authenticated successor intents'
		);
	}
	const expectedDeletedHashes = plan.directSuccessors
		.filter(({ sourcePathHash, successorPathHash }) => sourcePathHash !== successorPathHash)
		.map(({ sourcePathHash }) => sourcePathHash)
		.sort(compareCodepoints);
	const actualDeletedHashes = [...baseEntries.keys()]
		.filter((repositoryPath) => !currentEntries.has(repositoryPath))
		.map(hashRepositoryPath)
		.sort(compareCodepoints);
	if (JSON.stringify(expectedDeletedHashes) !== JSON.stringify(actualDeletedHashes)) {
		throw new Error('Migration commit deletions do not match authenticated path-move intents');
	}

	for (const successor of plan.expectedOwnerSuccessors) {
		const sourcePath = basePathsByHash.get(successor.sourcePathHash);
		const currentPath = currentPathsByHash.get(successor.successorPathHash);
		if (
			sourcePath === undefined ||
			baseEntries.get(sourcePath)?.blobId !== successor.sourceBlobId ||
			currentPath === undefined
		) {
			throw new Error('Expected owner successor lacks authenticated source or current path');
		}
		const current = currentEntries.get(currentPath)!;
		if (current.mode !== successor.mode) {
			throw new Error('Expected owner successor changed its authenticated file mode');
		}
		if (successor.serializer === 'raw-file' && current.blobId !== successor.sourceBlobId) {
			throw new Error('Binary successor drifted from its authenticated source bytes');
		}
		const currentBytes = await readTrackedBytes(repositoryRoot, currentPath);
		const actualDigest = digestTrackedIntegrityValue({
			ownerId: successor.ownerId,
			path: currentPath,
			bytes: currentBytes,
			kind: successor.kind,
			serializer: successor.serializer
		});
		if (actualDigest !== successor.projectedValueDigest) {
			throw new Error(
				'Current owner bytes do not match the authenticated expected successor intent'
			);
		}
		for (const dependency of successor.dependencies) {
			const changedDependency = ownerBySuccessorHash.get(dependency.successorPathHash);
			if (
				changedDependency !== undefined &&
				(dependency.digestKind === 'raw-bytes'
					? changedDependency.projectedRawDigest
					: changedDependency.projectedValueDigest) !== dependency.digest
			) {
				throw new Error('Authenticated owner dependency edge has an inconsistent digest');
			}
		}
		if (sha256(Buffer.from(currentBytes)) !== successor.projectedRawDigest) {
			throw new Error('Current owner bytes do not exactly match authenticated successor bytes');
		}
	}

	const finalized = new Map<string, AmericanEnglishMigrationReceiptFile>();
	for (const initial of initialReceipt.files) {
		const currentPath = currentPathsByHash.get(initial.successorPathHash);
		if (currentPath === undefined) {
			throw new Error('Initial receipt successor is absent from the migration commit');
		}
		const currentBlobId = currentEntries.get(currentPath)!.blobId;
		const expectedOwner = ownerBySuccessorHash.get(initial.successorPathHash);
		if (expectedOwner === undefined && currentBlobId !== initial.successorBlobId) {
			throw new Error(
				initial.ownerId === 'migration-planner'
					? 'Migration-planner-owned successor drifted after authenticated apply'
					: 'Non-owner receipt successor drifted after authenticated apply'
			);
		}
		if (initial.unchangedBinary && currentBlobId !== initial.sourceBlobId) {
			throw new Error('Binary successor drifted after the initial migration receipt');
		}
		finalized.set(initial.successorPathHash, {
			...initial,
			successorBlobId: currentBlobId
		});
	}
	for (const successor of plan.expectedOwnerSuccessors) {
		if (finalized.has(successor.successorPathHash)) continue;
		const currentPath = currentPathsByHash.get(successor.successorPathHash)!;
		const currentBlobId = currentEntries.get(currentPath)!.blobId;
		finalized.set(successor.successorPathHash, {
			sourceBlobId: successor.sourceBlobId,
			successorPathHash: successor.successorPathHash,
			successorBlobId: currentBlobId,
			unchangedBinary:
				successor.serializer === 'raw-file' && successor.sourceBlobId === currentBlobId,
			ownerId: successor.ownerId
		});
	}
	for (const preimage of plan.authenticatedHeadPreimages) {
		if (finalized.has(preimage.successorPathHash)) continue;
		const basePath = basePathsByHash.get(preimage.successorPathHash);
		const currentPath = currentPathsByHash.get(preimage.successorPathHash);
		if (
			basePath === undefined ||
			currentPath === undefined ||
			baseEntries.get(basePath)?.blobId !== preimage.blobId ||
			baseEntries.get(basePath)?.mode !== preimage.mode ||
			currentEntries.get(currentPath)?.blobId !== preimage.blobId ||
			currentEntries.get(currentPath)?.mode !== preimage.mode
		) {
			throw new Error('Authenticated plan-HEAD preimage does not match the migration commit');
		}
		finalized.set(preimage.successorPathHash, {
			sourceBlobId: preimage.blobId,
			successorPathHash: preimage.successorPathHash,
			successorBlobId: preimage.blobId,
			unchangedBinary: preimage.binary,
			ownerId: 'authenticated-plan-head'
		});
	}

	const files = [...finalized.values()].sort((left, right) =>
		compareCodepoints(left.successorPathHash, right.successorPathHash)
	);
	await assertBlobObjectsExist(
		repositoryRoot,
		files.flatMap(({ sourceBlobId, successorBlobId }) => [sourceBlobId, successorBlobId])
	);
	const receipt: AmericanEnglishMigrationReceipt = {
		baselineCommit: initialReceipt.baselineCommit,
		policyVersion: POLICY_VERSION,
		ruleCounts: initialReceipt.ruleCounts,
		ownerCounts: ownerCountsForReceiptFiles(files),
		files
	};
	validateReceiptValue(receipt, plan.baselineCommit);
	await writeReceipt(receiptPath, receipt);
	return receipt;
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export async function materializeAuthenticatedOwnerSuccessors(
	plan: AmericanEnglishMigrationPlan,
	options: MaterializeAuthenticatedOwnerSuccessorsOptions = {}
): Promise<void> {
	const repositoryRoot = path.resolve(options.repositoryRoot ?? process.cwd());
	const ownerBytes = authenticatedOwnerBytesForApply(plan);
	if (ownerBytes.size === 0) return;
	const expectedByPathHash = new Map(
		plan.expectedOwnerSuccessors.map((successor) => [successor.successorPathHash, successor])
	);
	const currentIndex = await currentIndexEntries(repositoryRoot);
	const currentPathsByHash = pathsByHash(currentIndex);
	const directByPathHash = new Map(
		plan.directSuccessors.map((successor) => [successor.successorPathHash, successor])
	);
	const writes: { readonly path: string; readonly bytes: Uint8Array }[] = [];
	for (const [repositoryPath, bytes] of ownerBytes) {
		const pathHash = hashRepositoryPath(repositoryPath);
		const expected = expectedByPathHash.get(pathHash);
		if (expected === undefined || currentPathsByHash.get(pathHash) !== repositoryPath) {
			throw new Error('Private owner materialization contains an unauthenticated path');
		}
		const current = currentIndex.get(repositoryPath)!;
		const direct = directByPathHash.get(pathHash);
		const expectedCurrentBlob = direct?.successorBlobId ?? expected.sourceBlobId;
		if (current.blobId !== expectedCurrentBlob) {
			throw new Error('Owner materialization preimage drifted after authenticated direct apply');
		}
		const actualDigest = digestTrackedIntegrityValue({
			ownerId: expected.ownerId,
			path: repositoryPath,
			bytes,
			kind: expected.kind,
			serializer: expected.serializer
		});
		if (actualDigest !== expected.projectedValueDigest) {
			throw new Error('Private owner bytes do not match their authenticated plan intent');
		}
		writes.push({ path: repositoryPath, bytes });
	}
	for (const write of writes.sort((left, right) => compareCodepoints(left.path, right.path))) {
		await writeFile(path.join(repositoryRoot, ...write.path.split('/')), write.bytes);
	}
	if (writes.length > 0) {
		await runGit(repositoryRoot, [
			'add',
			'--',
			...writes.map(({ path: repositoryPath }) => repositoryPath)
		]);
	}
}

function authenticatedOwnerBytesForApply(
	plan: AmericanEnglishMigrationPlan
): ReadonlyMap<string, Uint8Array> {
	if (plan.expectedOwnerSuccessors.length === 0) return new Map();
	const ownerBytes = authenticatedOwnerBytesByPlan.get(plan);
	if (ownerBytes === undefined) {
		throw new Error(
			'Owner migration requires private materialization from the original in-process plan'
		);
	}
	const expectedByPathHash = new Map(
		plan.expectedOwnerSuccessors.map((successor) => [successor.successorPathHash, successor])
	);
	if (
		expectedByPathHash.size !== plan.expectedOwnerSuccessors.length ||
		ownerBytes.size !== expectedByPathHash.size
	) {
		throw new Error('Private owner materialization does not cover every authenticated successor');
	}
	const materializedPathHashes = new Set<string>();
	for (const [repositoryPath, bytes] of ownerBytes) {
		const pathHash = hashRepositoryPath(repositoryPath);
		const expected = expectedByPathHash.get(pathHash);
		if (expected === undefined || materializedPathHashes.has(pathHash)) {
			throw new Error('Private owner materialization contains an unauthenticated path');
		}
		materializedPathHashes.add(pathHash);
		const valueDigest = digestTrackedIntegrityValue({
			ownerId: expected.ownerId,
			path: repositoryPath,
			bytes,
			kind: expected.kind,
			serializer: expected.serializer
		});
		if (
			valueDigest !== expected.projectedValueDigest ||
			sha256(Buffer.from(bytes)) !== expected.projectedRawDigest
		) {
			throw new Error('Private owner bytes do not exactly match their authenticated plan intent');
		}
	}
	return ownerBytes;
}

export async function applyAmericanEnglishMigration(
	plan: AmericanEnglishMigrationPlan,
	options: ApplyAmericanEnglishMigrationOptions
): Promise<AmericanEnglishMigrationReceipt> {
	const repositoryRoot = path.resolve(options.repositoryRoot ?? process.cwd());
	const receiptPath = path.resolve(options.receiptPath);
	const receiptRelative = path.relative(repositoryRoot, receiptPath);
	if (
		receiptRelative === '' ||
		(!receiptRelative.startsWith('..') && !path.isAbsolute(receiptRelative))
	) {
		throw new Error('Intermediate migration receipt must be written outside the repository');
	}
	try {
		await lstat(receiptPath);
		throw new Error(`Migration receipt already exists: ${receiptPath}`);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	if (plan.collisions.length > 0) throw new Error('Migration plan contains path collisions');
	if (plan.unownedIntegrityBindings.length > 0) {
		throw new Error('Migration plan contains unowned integrity bindings');
	}
	const ownerBytes = authenticatedOwnerBytesForApply(plan);
	const status = await runGit(repositoryRoot, [
		'status',
		'--porcelain=v1',
		'-z',
		'--untracked-files=all'
	]);
	if (status.length > 0) throw new Error('Migration application requires a clean working tree');
	const ancestor = await runGitResult(repositoryRoot, [
		'merge-base',
		'--is-ancestor',
		plan.baselineCommit,
		'HEAD'
	]);
	if (ancestor.exitCode !== 0) throw new Error('Migration baseline is not an ancestor of HEAD');
	const { inventoryFingerprint: embeddedFingerprint, ...embeddedMaterial } = plan;
	if (fingerprintPlanMaterial(embeddedMaterial) !== embeddedFingerprint) {
		throw new Error('Migration plan material does not match its inventory fingerprint');
	}
	let freshPlan: AmericanEnglishMigrationPlan;
	try {
		freshPlan = await planAmericanEnglishMigration({
			repositoryRoot,
			baselineCommit: plan.baselineCommit,
			ruleIds: plan.ruleIds,
			roots: plan.roots,
			...(options.previousReceiptPath === undefined
				? {}
				: { previousReceiptPath: options.previousReceiptPath })
		});
	} catch (error) {
		throw new Error(
			`Migration preflight changed since planning: ${
				error instanceof Error ? error.message : String(error)
			}`,
			{ cause: error }
		);
	}
	if (freshPlan.inventoryFingerprint !== plan.inventoryFingerprint) {
		throw new Error('Migration preflight changed since planning');
	}

	const moveBySource = new Map(plan.pathMoves.map((move) => [move.source, move]));
	const affectedSources = [
		...new Set([
			...plan.pathMoves.map(({ source }) => source),
			...plan.textEdits.map(({ path: repositoryPath }) => repositoryPath)
		])
	].sort(compareCodepoints);
	const baselineBlobs = await baselineBlobMap(repositoryRoot, plan.baselineCommit);
	const indexBefore = await currentIndexEntries(repositoryRoot);
	const previousReceipt = await readPreviousReceipt(
		options.previousReceiptPath,
		plan.baselineCommit
	);
	for (const source of affectedSources) {
		const current = indexBefore.get(source)?.blobId;
		const previous = previousReceipt?.successorBlobsByPathHash.get(hashRepositoryPath(source));
		const expected = new Set(
			[previous, moveBySource.get(source)?.sourceBlobId, baselineBlobs.get(source)].filter(
				(value): value is string => value !== undefined
			)
		);
		if (expected.size === 0) {
			throw new Error(`Migration source is absent from baseline and prior receipt: ${source}`);
		}
		if (current === undefined || !expected.has(current)) {
			throw new Error(
				`Migration source blob does not match its baseline or earlier receipt: ${source}`
			);
		}
	}
	const currentViolations = await auditTrackedTree(repositoryRoot);

	const gitDirectoryValue = (await runGit(repositoryRoot, ['rev-parse', '--git-dir']))
		.toString('utf8')
		.trim();
	const gitDirectory = path.resolve(repositoryRoot, gitDirectoryValue);
	const journalPath = path.join(gitDirectory, 'american-english-migration');
	try {
		await lstat(journalPath);
		throw new Error(`Migration journal already exists: ${journalPath}`);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}

	const snapshots: FileSnapshot[] = [];
	for (const source of affectedSources) {
		snapshots.push(
			await readSnapshot(repositoryRoot, source, moveBySource.get(source)?.destination ?? source)
		);
	}
	const snapshottedPaths = new Set(
		snapshots.flatMap(({ source, destination }) => [source, destination])
	);
	for (const repositoryPath of ownerBytes.keys()) {
		if (snapshottedPaths.has(repositoryPath)) continue;
		snapshots.push(await readSnapshot(repositoryRoot, repositoryPath, repositoryPath));
		snapshottedPaths.add(repositoryPath);
	}
	await mkdir(path.join(journalPath, 'preimages'), { recursive: true });
	await Promise.all(
		snapshots.map(async (snapshot, index) => {
			await writeFile(path.join(journalPath, 'preimages', `${index}.bin`), snapshot.bytes);
		})
	);
	await writeFile(
		path.join(journalPath, 'journal.json'),
		`${JSON.stringify(
			snapshots.map(({ source, destination, kind, mode, bytes }, index) => ({
				source,
				destination,
				kind,
				mode,
				preimage: `preimages/${index}.bin`,
				sha256: sha256(bytes)
			})),
			null,
			2
		)}\n`
	);

	let repositoryChangesStarted = false;
	let operationCount = 0;
	const injectFailure = (): void => {
		if (options.failAfterOperation !== undefined && operationCount === options.failAfterOperation) {
			throw new Error(`Injected migration failure after operation ${operationCount}`);
		}
	};
	try {
		for (const move of orderMoves(plan.pathMoves)) {
			const destination = path.join(repositoryRoot, ...move.destination.split('/'));
			await mkdir(path.dirname(destination), { recursive: true });
			await runGit(repositoryRoot, ['mv', '--', move.source, move.destination]);
			repositoryChangesStarted = true;
			operationCount += 1;
			injectFailure();
		}

		const selectedRuleIds = new Set(plan.ruleIds);
		const plannedTextPaths = new Set(
			plan.textEdits.map(({ path: repositoryPath }) => repositoryPath)
		);
		const contentBySource = groupViolationsByPath(
			currentViolations.filter(
				(violation) =>
					violation.kind === 'content' &&
					plannedTextPaths.has(violation.path) &&
					selectedRuleIds.has(violation.ruleId)
			),
			'content'
		);
		for (const edit of plan.textEdits) {
			const destination = moveBySource.get(edit.path)?.destination ?? edit.path;
			const absolutePath = path.join(repositoryRoot, ...destination.split('/'));
			const snapshot = snapshots.find(({ source }) => source === edit.path)!;
			const source = snapshot.bytes.toString('utf8');
			const violations = contentBySource.get(edit.path) ?? [];
			if (violations.length !== edit.violationCount) {
				throw new Error(`Content violation count changed after planning: ${edit.path}`);
			}
			const successor = applyContentViolations(source, violations);
			if (snapshot.kind === 'symlink') {
				await unlink(absolutePath);
				await symlink(successor, absolutePath);
			} else {
				await writeFile(absolutePath, Buffer.from(successor, 'utf8'));
			}
			repositoryChangesStarted = true;
			operationCount += 1;
			injectFailure();
		}

		const stagingPaths = [...new Set(snapshots.map(({ destination }) => destination))];
		await runGit(repositoryRoot, ['add', '-A', '--', ...stagingPaths]);
		const indexAfter = await currentIndexEntries(repositoryRoot);
		const pathViolations = groupViolationsByPath(currentViolations, 'path');
		const ruleCounts = Object.fromEntries(
			AMERICAN_ENGLISH_RULE_IDS.map((ruleId) => [
				ruleId,
				previousReceipt?.receipt.ruleCounts[ruleId] ?? 0
			])
		) as Record<AmericanEnglishRuleId, number>;
		for (const move of plan.pathMoves) {
			for (const violation of pathViolations.get(move.source) ?? []) {
				if (selectedRuleIds.has(violation.ruleId)) ruleCounts[violation.ruleId] += 1;
			}
		}
		for (const values of contentBySource.values()) {
			for (const violation of values) ruleCounts[violation.ruleId] += 1;
		}
		const plannedFiles: PlannedFile[] = affectedSources.map((source) => ({
			source,
			destination: moveBySource.get(source)?.destination ?? source,
			sourceBlobId:
				moveBySource.get(source)?.sourceBlobId ??
				previousReceipt?.successorBlobsByPathHash.get(hashRepositoryPath(source)) ??
				baselineBlobs.get(source)!,
			binary: moveBySource.get(source)?.binary ?? false
		}));
		const successorFiles = new Map<string, AmericanEnglishMigrationReceiptFile>(
			previousReceipt?.receipt.files.map((file) => [file.successorPathHash, file]) ?? []
		);
		const ownerByPath = new Map(
			plan.integrityOwners.flatMap((owner) => owner.paths.map((path) => [path, owner.id] as const))
		);
		for (const { source, destination, sourceBlobId, binary } of plannedFiles) {
			const successorBlobId = indexAfter.get(destination)?.blobId;
			if (successorBlobId === undefined) {
				throw new Error(`Missing staged migration successor: ${destination}`);
			}
			successorFiles.delete(hashRepositoryPath(source));
			const successorPathHash = hashRepositoryPath(destination);
			successorFiles.set(successorPathHash, {
				sourceBlobId,
				successorPathHash,
				successorBlobId,
				unchangedBinary: binary && indexBefore.get(source)?.blobId === successorBlobId,
				ownerId: ownerByPath.get(source) ?? 'migration-planner'
			});
		}
		const ownerCountsById = [...successorFiles.values()].reduce((counts, { ownerId }) => {
			counts.set(ownerId, (counts.get(ownerId) ?? 0) + 1);
			return counts;
		}, new Map<string, number>());
		const ownerCounts = Object.fromEntries(
			[...ownerCountsById.entries()].sort(([left], [right]) => compareCodepoints(left, right))
		);
		const receipt: AmericanEnglishMigrationReceipt = {
			baselineCommit: plan.baselineCommit,
			policyVersion: POLICY_VERSION,
			ruleCounts,
			ownerCounts,
			files: [...successorFiles.values()].sort((left, right) =>
				compareCodepoints(left.successorPathHash, right.successorPathHash)
			)
		};
		await materializeAuthenticatedOwnerSuccessors(plan, { repositoryRoot });
		await writeReceipt(receiptPath, receipt);
		await rm(journalPath, { recursive: true, force: true });
		return receipt;
	} catch (error) {
		try {
			if (repositoryChangesStarted) await restoreSnapshots(repositoryRoot, snapshots);
			await rm(journalPath, { recursive: true, force: true });
		} catch (rollbackError) {
			throw new AggregateError(
				[error, rollbackError],
				'Migration failed and its rollback did not complete',
				{ cause: rollbackError }
			);
		}
		throw error;
	}
}

interface CliOptions {
	readonly baselineCommit?: string;
	readonly format: 'json' | 'text';
	readonly repositoryRoot?: string;
	readonly ruleIds?: readonly AmericanEnglishRuleId[];
	readonly roots?: readonly string[];
	readonly write: boolean;
	readonly receiptPath?: string;
	readonly previousReceiptPath?: string;
	readonly finalizeReceiptPath?: string;
	readonly planPath?: string;
	readonly expectedPlanHash?: string;
	readonly expectedMigrationCommit?: string;
	readonly expectedInitialReceiptHash?: string;
}

function parseList(value: string): string[] {
	return value
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}

function parseCli(arguments_: readonly string[]): CliOptions {
	let baselineCommit: string | undefined;
	let format: CliOptions['format'] = 'text';
	let repositoryRoot: string | undefined;
	let ruleIds: AmericanEnglishRuleId[] | undefined;
	let excludedRuleIds: AmericanEnglishRuleId[] | undefined;
	let roots: string[] | undefined;
	let receiptPath: string | undefined;
	let previousReceiptPath: string | undefined;
	let finalizeReceiptPath: string | undefined;
	let planPath: string | undefined;
	let expectedPlanHash: string | undefined;
	let expectedMigrationCommit: string | undefined;
	let expectedInitialReceiptHash: string | undefined;
	let write = false;
	for (let index = 0; index < arguments_.length; index += 1) {
		const argument = arguments_[index]!;
		const next = (): string => {
			const value = arguments_[++index];
			if (value === undefined) throw new Error(`Missing value for ${argument}`);
			return value;
		};
		switch (argument) {
			case '--':
				break;
			case '--baseline':
				baselineCommit = next();
				break;
			case '--format': {
				const value = next();
				if (value !== 'json' && value !== 'text') throw new Error(`Unknown format: ${value}`);
				format = value;
				break;
			}
			case '--repository-root':
				repositoryRoot = next();
				break;
			case '--rules':
				ruleIds = parseList(next()) as AmericanEnglishRuleId[];
				break;
			case '--exclude-rules':
				excludedRuleIds = parseList(next()) as AmericanEnglishRuleId[];
				break;
			case '--roots':
				roots = parseList(next());
				break;
			case '--write':
				write = true;
				break;
			case '--receipt':
				receiptPath = next();
				break;
			case '--previous-receipt':
				previousReceiptPath = next();
				break;
			case '--finalize-receipt':
				finalizeReceiptPath = next();
				break;
			case '--plan':
				planPath = next();
				break;
			case '--plan-sha256':
				expectedPlanHash = next();
				break;
			case '--expected-migration-commit':
				expectedMigrationCommit = next();
				break;
			case '--initial-receipt-sha256':
				expectedInitialReceiptHash = next();
				break;
			default:
				throw new Error(`Unknown argument: ${argument}`);
		}
	}
	if (finalizeReceiptPath !== undefined) {
		if (
			write ||
			baselineCommit !== undefined ||
			ruleIds !== undefined ||
			excludedRuleIds !== undefined
		) {
			throw new Error('Receipt finalization cannot be combined with planning or --write options');
		}
		if (
			receiptPath === undefined ||
			planPath === undefined ||
			expectedPlanHash === undefined ||
			expectedMigrationCommit === undefined ||
			expectedInitialReceiptHash === undefined
		) {
			throw new Error(
				'--finalize-receipt requires --initial-receipt-sha256, --plan, --plan-sha256, --expected-migration-commit, and --receipt'
			);
		}
	} else if (baselineCommit === undefined) throw new Error('Missing required --baseline');
	if (ruleIds !== undefined && excludedRuleIds !== undefined) {
		throw new Error('Cannot combine --rules with --exclude-rules');
	}
	if (excludedRuleIds !== undefined) {
		const knownRuleIds = new Set<AmericanEnglishRuleId>(AMERICAN_ENGLISH_RULE_IDS);
		for (const ruleId of excludedRuleIds) {
			if (!knownRuleIds.has(ruleId)) throw new Error(`Unknown American English rule: ${ruleId}`);
		}
		const excluded = new Set(excludedRuleIds);
		ruleIds = AMERICAN_ENGLISH_RULE_IDS.filter((ruleId) => !excluded.has(ruleId));
	}
	if (write && receiptPath === undefined) throw new Error('--write requires --receipt');
	return {
		...(baselineCommit === undefined ? {} : { baselineCommit }),
		format,
		...(repositoryRoot === undefined ? {} : { repositoryRoot }),
		...(ruleIds === undefined ? {} : { ruleIds }),
		...(roots === undefined ? {} : { roots }),
		write,
		...(receiptPath === undefined ? {} : { receiptPath }),
		...(previousReceiptPath === undefined ? {} : { previousReceiptPath }),
		...(finalizeReceiptPath === undefined ? {} : { finalizeReceiptPath }),
		...(planPath === undefined ? {} : { planPath }),
		...(expectedPlanHash === undefined ? {} : { expectedPlanHash }),
		...(expectedMigrationCommit === undefined ? {} : { expectedMigrationCommit }),
		...(expectedInitialReceiptHash === undefined ? {} : { expectedInitialReceiptHash })
	};
}

async function main(): Promise<void> {
	const options = parseCli(process.argv.slice(2));
	if (options.finalizeReceiptPath !== undefined) {
		const receipt = await finalizeAmericanEnglishMigrationReceipt({
			initialReceiptPath: options.finalizeReceiptPath,
			planPath: options.planPath!,
			expectedPlanHash: options.expectedPlanHash!,
			expectedMigrationCommit: options.expectedMigrationCommit!,
			expectedInitialReceiptHash: options.expectedInitialReceiptHash!,
			receiptPath: options.receiptPath!,
			...(options.previousReceiptPath === undefined
				? {}
				: { previousReceiptPath: options.previousReceiptPath }),
			...(options.repositoryRoot === undefined ? {} : { repositoryRoot: options.repositoryRoot })
		});
		if (options.format === 'json') process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
		else process.stdout.write(`Finalized ${receipt.files.length} migration receipt bindings.\n`);
		return;
	}
	const plan = await planAmericanEnglishMigration({
		baselineCommit: options.baselineCommit!,
		...(options.repositoryRoot === undefined ? {} : { repositoryRoot: options.repositoryRoot }),
		...(options.ruleIds === undefined ? {} : { ruleIds: options.ruleIds }),
		...(options.roots === undefined ? {} : { roots: options.roots }),
		...(options.previousReceiptPath === undefined
			? {}
			: { previousReceiptPath: options.previousReceiptPath })
	});
	const output = options.write
		? await applyAmericanEnglishMigration(plan, {
				receiptPath: options.receiptPath!,
				...(options.repositoryRoot === undefined ? {} : { repositoryRoot: options.repositoryRoot }),
				...(options.previousReceiptPath === undefined
					? {}
					: { previousReceiptPath: options.previousReceiptPath })
			})
		: plan;
	if (options.format === 'json') process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
	else if ('collisions' in output) {
		process.stdout.write(
			`Planned ${output.textEdits.length} text edits and ${output.pathMoves.length} path moves; ` +
				`${output.collisions.length} collisions and ${output.unownedIntegrityBindings.length} unowned integrity bindings.\n`
		);
	} else {
		process.stdout.write(`Applied ${output.files.length} file migrations.\n`);
	}
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 2;
	});
}
