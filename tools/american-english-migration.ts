import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	chmod,
	link,
	lstat,
	mkdir,
	readFile,
	readdir,
	readlink,
	rmdir,
	rm,
	symlink,
	unlink,
	writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	AMERICAN_ENGLISH_RULE_IDS,
	type AmericanEnglishRuleId,
	type AmericanEnglishViolation,
	auditTrackedTree
} from './american-english-policy.js';
import {
	classifyIntegrityBindings,
	type IntegrityOwnerPlan,
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
	readonly previousReceiptHash: string | null;
	readonly inventoryFingerprint: string;
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
	readonly ownerId: 'migration-planner' | IntegrityOwnerPlan['id'];
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

function fingerprintPlanMaterial(
	plan: Omit<AmericanEnglishMigrationPlan, 'inventoryFingerprint'>
): string {
	return sha256(Buffer.from(JSON.stringify(plan), 'utf8'));
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
		migrationProjection
	);
	const unownedIntegrityBindings = [...new Set(integrity.problems.map(({ path }) => path))]
		.sort(compareCodepoints)
		.map((problemPath) => ({
			path: problemPath,
			reasons: integrity.problems
				.filter(({ path: candidatePath }) => candidatePath === problemPath)
				.map(
					({ code, jsonPointer, message }) =>
						`${code}${jsonPointer.length === 0 ? '' : ` ${jsonPointer}`}: ${message}`
				)
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
		integrityOwners: integrity.ownerPlans,
		previousReceiptHash: previousReceipt?.receiptHash ?? null
	};
	return { ...planMaterial, inventoryFingerprint: fingerprintPlanMaterial(planMaterial) };
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

async function readPreviousReceipt(
	receiptPath: string | undefined,
	expectedBaselineCommit: string
): Promise<ValidatedReceipt | null> {
	if (receiptPath === undefined) return null;
	const bytes = await readFile(path.resolve(receiptPath));
	const value: unknown = JSON.parse(bytes.toString('utf8'));
	if (!isRecord(value)) throw new Error('Prior migration receipt must be a JSON object');
	if (value.baselineCommit !== expectedBaselineCommit) {
		throw new Error('Prior migration receipt baseline does not match the requested baseline');
	}
	if (value.policyVersion !== POLICY_VERSION) {
		throw new Error('Prior migration receipt policy version does not match');
	}
	if (!Array.isArray(value.files)) throw new Error('Prior migration receipt files are invalid');
	const successorBlobsByPathHash = new Map<string, string>();
	for (const file of value.files) {
		if (
			!isRecord(file) ||
			!isObjectId(file.sourceBlobId) ||
			!isObjectId(file.successorBlobId) ||
			!['equipment', 'migration-planner', 'runtime-and-engine', 'visual-production'].includes(
				String(file.ownerId)
			) ||
			typeof file.successorPathHash !== 'string' ||
			!/^[0-9a-f]{64}$/u.test(file.successorPathHash) ||
			typeof file.unchangedBinary !== 'boolean' ||
			'successorPath' in file
		) {
			throw new Error('Prior migration receipt contains an invalid file binding');
		}
		if (successorBlobsByPathHash.has(file.successorPathHash)) {
			throw new Error('Prior migration receipt contains a duplicate successor path hash');
		}
		successorBlobsByPathHash.set(file.successorPathHash, file.successorBlobId);
	}
	const receipt = value as unknown as AmericanEnglishMigrationReceipt;
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

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
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
			}`
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
				'Migration failed and its rollback did not complete'
			);
		}
		throw error;
	}
}

interface CliOptions {
	readonly baselineCommit: string;
	readonly format: 'json' | 'text';
	readonly repositoryRoot?: string;
	readonly ruleIds?: readonly AmericanEnglishRuleId[];
	readonly roots?: readonly string[];
	readonly write: boolean;
	readonly receiptPath?: string;
	readonly previousReceiptPath?: string;
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
	let roots: string[] | undefined;
	let receiptPath: string | undefined;
	let previousReceiptPath: string | undefined;
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
			default:
				throw new Error(`Unknown argument: ${argument}`);
		}
	}
	if (baselineCommit === undefined) throw new Error('Missing required --baseline');
	if (write && receiptPath === undefined) throw new Error('--write requires --receipt');
	return {
		baselineCommit,
		format,
		...(repositoryRoot === undefined ? {} : { repositoryRoot }),
		...(ruleIds === undefined ? {} : { ruleIds }),
		...(roots === undefined ? {} : { roots }),
		write,
		...(receiptPath === undefined ? {} : { receiptPath }),
		...(previousReceiptPath === undefined ? {} : { previousReceiptPath })
	};
}

async function main(): Promise<void> {
	const options = parseCli(process.argv.slice(2));
	const plan = await planAmericanEnglishMigration({
		baselineCommit: options.baselineCommit,
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
