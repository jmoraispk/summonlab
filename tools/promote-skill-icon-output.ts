import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readdir, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	SkillIconAssignmentSchema,
	SkillIconExecutionSchema,
	SkillIconResultSchema,
	SkillIconReviewSchema,
	SkillIconTargetSchema,
	type SkillIconAsset,
	type SkillIconReview,
	type SkillIconRole
} from '../packages/contracts/src/index.js';
import {
	SKILL_ICON_CATALOG_PATH,
	SKILL_ICON_VISUAL_SPECS_PATH,
	exportSkillIconProduction
} from './export-skill-icon-production.js';
import { loadSkillIconGeometry } from './export-skill-icon-geometry.js';
import { inspectSkillIconAsset } from './validate-skill-icon-assets.js';

export interface SkillIconAssetRecord {
	readonly jobId: string;
	readonly role: SkillIconRole;
	readonly skillTargetId: string | null;
	readonly candidate: SkillIconAsset;
	readonly approvedMaster: SkillIconAsset;
	readonly resultPath: string;
	readonly resultContentHash: string;
	readonly reviewContentHash: string;
	readonly review: SkillIconReview;
}

export const SKILL_ICON_PROMOTION_LOCK_PATH =
	'assets/wiki/skills/icon-production-v1/.promotion.lock' as const;
export const SKILL_ICON_PROMOTION_JOURNAL_PATH =
	'assets/wiki/skills/icon-production-v1/.promotion-transaction.json' as const;

export interface PromotionTestHooks {
	readonly afterLockAcquired?: () => void | Promise<void>;
	readonly beforeMasterWrite?: (input: {
		readonly index: number;
		readonly destination: string;
	}) => void | Promise<void>;
	readonly afterMasterWrite?: (input: {
		readonly index: number;
		readonly destination: string;
	}) => void | Promise<void>;
	readonly beforeSharedWrite?: () => void | Promise<void>;
}

export interface PromotionOptions {
	readonly jobId: string;
	readonly reviewPath: string;
	readonly root?: string;
	readonly trustedOwner: string;
	readonly trustedProducer: string;
	readonly testHooks?: PromotionTestHooks;
}

interface PreparedPromotion {
	readonly record: SkillIconAssetRecord;
	readonly bytes: Buffer;
	readonly destination: string;
	readonly visualState: Record<string, unknown> | null;
}

interface PromotionJournal {
	readonly schemaVersion: 'skill-icon-promotion-transaction-v1';
	readonly transactionId: string;
	readonly phase: 'prepared' | 'masters-writing' | 'shared-writing';
	readonly masters: readonly { readonly path: string; readonly contentHash: string }[];
	readonly createdMasterPaths: readonly string[];
	readonly originalVisual: string | null;
	readonly originalCatalog: string | null;
}

function inside(parent: string, child: string): boolean {
	const relative = path.relative(parent, child);
	return (
		relative === '' ||
		(!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
	);
}

async function metadataOrNull(filePath: string) {
	return lstat(filePath).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
}

function repositoryPath(
	root: string,
	input: string,
	allowedRoot: string
): { relative: string; absolute: string } {
	const absolute = path.isAbsolute(input) ? path.resolve(input) : path.resolve(root, input);
	const authority = path.resolve(root, allowedRoot);
	if (!inside(authority, absolute) || absolute === authority)
		throw new Error(`Path escaped ${allowedRoot}: ${input}`);
	return { relative: path.relative(root, absolute).split(path.sep).join('/'), absolute };
}

async function readRegular(filePath: string, description: string): Promise<Buffer> {
	const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ELOOP') throw new Error(`${description} cannot be a symbolic link`);
			throw error;
		}
	);
	try {
		if (!(await handle.stat()).isFile()) throw new Error(`${description} must be a regular file`);
		return await handle.readFile();
	} finally {
		await handle.close();
	}
}

async function assertSafeExistingPath(
	root: string,
	filePath: string,
	description: string
): Promise<void> {
	const rootMetadata = await lstat(root);
	if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory())
		throw new Error('Workspace root must be a real directory');
	if (!inside(root, filePath) || filePath === root)
		throw new Error(`${description} escaped workspace root`);
	const realRoot = await realpath(root);
	let cursor = root;
	const segments = path.relative(root, filePath).split(path.sep);
	for (const [index, segment] of segments.entries()) {
		cursor = path.join(cursor, segment);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink())
			throw new Error(`${description} path cannot contain a symbolic link: ${cursor}`);
		if (index < segments.length - 1 && !metadata.isDirectory())
			throw new Error(`${description} ancestor is not a directory: ${cursor}`);
	}
	if (!inside(realRoot, await realpath(path.dirname(filePath))))
		throw new Error(`${description} parent escaped real workspace root`);
}

async function readRepositoryRegular(
	root: string,
	filePath: string,
	description: string
): Promise<Buffer> {
	await assertSafeExistingPath(root, filePath, description);
	return readRegular(filePath, description);
}

async function ensureSafeParents(
	root: string,
	destination: string,
	create: boolean
): Promise<void> {
	const rootMetadata = await lstat(root);
	if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory())
		throw new Error('Workspace root must be a real directory');
	const realRoot = await realpath(root);
	const relativeParent = path.relative(root, path.dirname(destination));
	if (!inside(root, destination) || destination === root)
		throw new Error('Master destination escaped workspace root');
	let cursor = root;
	for (const segment of relativeParent.split(path.sep).filter(Boolean)) {
		cursor = path.join(cursor, segment);
		let metadata = await metadataOrNull(cursor);
		if (!metadata) {
			if (!create) break;
			await mkdir(cursor).catch((error: NodeJS.ErrnoException) => {
				if (error.code !== 'EEXIST') throw error;
			});
			metadata = await lstat(cursor);
		}
		if (metadata.isSymbolicLink())
			throw new Error(`Master parent cannot be a symbolic link: ${cursor}`);
		if (!metadata.isDirectory()) throw new Error(`Master parent is not a directory: ${cursor}`);
		if (!inside(realRoot, await realpath(cursor)))
			throw new Error(`Master parent escaped real workspace root: ${cursor}`);
	}
}

async function syncDirectory(directory: string): Promise<void> {
	const handle = await open(
		directory,
		constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
	);
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

function scopeForRole(role: SkillIconRole): 'references' | 'calibration' | 'icons' {
	return role === 'skill-art'
		? 'icons'
		: role === 'calibration-plate'
			? 'calibration'
			: 'references';
}

function masterPathFor(target: ReturnType<typeof SkillIconTargetSchema.parse>): string {
	if (target.role === 'rarity-frame')
		return `assets/wiki/skills/icon-production-v1/masters/frames/${target.rarity.toLowerCase()}.png`;
	if (target.role === 'backing')
		return `assets/wiki/skills/icon-production-v1/masters/backing/${target.jobId.replace(/-v\d+$/u, '')}.png`;
	if (target.role === 'calibration-plate')
		return `assets/wiki/skills/icon-production-v1/masters/calibration/${target.motifFamily.replaceAll('.', '-')}.png`;
	return `assets/wiki/skills/icon-production-v1/masters/icons/${target.skillTargetId.replaceAll(':', '-')}.png`;
}

async function assertSkillCandidateProvenance(
	root: string,
	target: ReturnType<typeof SkillIconTargetSchema.parse>,
	resultHash: string,
	record: SkillIconAssetRecord
): Promise<never> {
	if (target.role !== 'skill-art') throw new Error('Internal role mismatch');
	const visualBytes = await readRepositoryRegular(
		root,
		path.resolve(root, SKILL_ICON_VISUAL_SPECS_PATH),
		'Visual specs'
	);
	const visual = JSON.parse(visualBytes.toString('utf8')) as {
		records?: Record<string, unknown>[];
	};
	const current = visual.records?.find((item) => item.targetId === target.skillTargetId) as
		| {
				status?: unknown;
				producerResult?: { jobId?: unknown; path?: unknown; contentHash?: unknown };
				assets?: { candidate?: { path?: unknown; contentHash?: unknown } };
		  }
		| undefined;
	if (!current || current.status !== 'candidate')
		throw new Error(`Skill ${target.skillTargetId} must be in candidate state before promotion`);
	if (
		current.producerResult?.jobId !== record.jobId ||
		current.producerResult.path !== record.resultPath ||
		current.producerResult.contentHash !== resultHash
	)
		throw new Error(`Candidate visual record result evidence hash does not match ${record.jobId}`);
	if (
		current.assets?.candidate?.path !== record.candidate.path ||
		current.assets.candidate.contentHash !== record.candidate.contentHash
	)
		throw new Error(`Candidate visual record asset evidence does not match ${record.jobId}`);
	throw new Error(
		'Skill-art promotion requires the deterministic derivative builder/verifier supplied by Task 5'
	);
}

async function preparePromotion(
	root: string,
	jobId: string,
	reviewInput: string,
	trustedOwner: string,
	trustedProducer: string
): Promise<PreparedPromotion> {
	if (!trustedOwner?.trim()) throw new Error('Coordinator must supply the trusted owner identity');
	if (!trustedProducer?.trim())
		throw new Error('Coordinator must supply the trusted producer identity');
	if (trustedOwner === trustedProducer)
		throw new Error('Trusted owner identity must be distinct from the producer identity');
	const reviewLocation = repositoryPath(
		root,
		reviewInput,
		'assets/wiki/skills/icon-production-v1/review/decisions'
	);
	const reviewBytes = await readRepositoryRegular(root, reviewLocation.absolute, 'Review');
	const review = SkillIconReviewSchema.parse(JSON.parse(reviewBytes.toString('utf8')));
	if (review.jobId !== jobId)
		throw new Error(`Review job ID ${review.jobId} does not match requested job ${jobId}`);
	if (review.decision !== 'accepted')
		throw new Error(`Review decision for ${jobId} must be accepted`);
	if (review.reviewerRole !== 'owner' || review.reviewer.trim().length === 0)
		throw new Error(`Accepted review for ${jobId} must name the owner as reviewer`);
	if (!trustedOwner.trim() || review.reviewer !== trustedOwner)
		throw new Error(`Review for ${jobId} does not match the coordinator-supplied trusted owner`);
	const scope = scopeForRole(review.role);
	const targetPath = `assets/wiki/skills/icon-production-v1/targets/${scope}/${jobId}.json`;
	const assignmentPath = `assets/wiki/skills/icon-production-v1/assignments/${scope}/${jobId}.json`;
	const resultPath = `assets/wiki/skills/icon-production-v1/results/${scope}/${jobId}.json`;
	const [target, assignment, resultBytes] = await Promise.all([
		readRepositoryRegular(root, path.resolve(root, targetPath), 'Target').then((bytes) =>
			SkillIconTargetSchema.parse(JSON.parse(bytes.toString('utf8')))
		),
		readRepositoryRegular(root, path.resolve(root, assignmentPath), 'Assignment').then((bytes) =>
			SkillIconAssignmentSchema.parse(JSON.parse(bytes.toString('utf8')))
		),
		readRepositoryRegular(root, path.resolve(root, resultPath), 'Result')
	]);
	const result = SkillIconResultSchema.parse(JSON.parse(resultBytes.toString('utf8')));
	SkillIconExecutionSchema.parse({
		schemaVersion: 'skill-icon-execution-v1',
		target,
		assignment,
		result
	});
	if (target.role !== review.role || target.skillTargetId !== review.skillTargetId)
		throw new Error('Review role/skill identity does not match target');
	if (result.status !== 'candidate' || !result.output)
		throw new Error(`Result for ${jobId} is not a promotable candidate`);
	if (result.selfPromoted !== false)
		throw new Error(`Producer result for ${jobId} must state selfPromoted false`);
	const candidateBytes = await readRepositoryRegular(
		root,
		path.resolve(root, review.candidatePath),
		'Candidate'
	);
	const hash = createHash('sha256').update(candidateBytes).digest('hex');
	if (hash !== review.candidateHash || hash !== result.output.contentHash)
		throw new Error(`Candidate hash mismatch for ${jobId}`);
	if (candidateBytes.byteLength !== result.output.bytes)
		throw new Error(`Candidate byte count mismatch for ${jobId}`);
	await assertSafeExistingPath(
		root,
		path.resolve(root, 'assets/wiki/skills/icon-production-v1/geometry.json'),
		'Geometry'
	);
	const geometry = await loadSkillIconGeometry(root);
	const inspection = await inspectSkillIconAsset(candidateBytes, target.role, geometry);
	if (
		inspection.width !== target.canvas.width ||
		inspection.height !== target.canvas.height ||
		inspection.violations.length > 0
	)
		throw new Error(
			`Candidate validation failed for ${jobId}: ${inspection.violations.join('; ')}`
		);
	const masterPath = masterPathFor(target);
	const destination = path.resolve(root, masterPath);
	if (!inside(path.resolve(root, 'assets/wiki/skills/icon-production-v1/masters'), destination))
		throw new Error('Master destination escaped master authority root');
	await ensureSafeParents(root, destination, false);
	if (await metadataOrNull(destination))
		throw new Error(`Master destination already exists (collision): ${masterPath}`);
	const candidate: SkillIconAsset = {
		path: review.candidatePath,
		mediaType: 'image/png',
		width: inspection.width,
		height: inspection.height,
		bytes: candidateBytes.byteLength,
		alphaMode: inspection.alphaMode,
		contentHash: hash
	};
	const approvedMaster: SkillIconAsset = { ...candidate, path: masterPath };
	const record: SkillIconAssetRecord = {
		jobId,
		role: target.role,
		skillTargetId: target.skillTargetId,
		candidate,
		approvedMaster,
		resultPath,
		resultContentHash: createHash('sha256').update(resultBytes).digest('hex'),
		reviewContentHash: createHash('sha256').update(reviewBytes).digest('hex'),
		review
	};
	if (target.role === 'skill-art') {
		await assertSkillCandidateProvenance(root, target, record.resultContentHash, record);
	}
	return {
		record,
		bytes: candidateBytes,
		destination,
		visualState: null
	};
}

async function atomicJsonReplace(root: string, destination: string, bytes: Buffer): Promise<void> {
	await ensureSafeParents(root, destination, false);
	const before = await metadataOrNull(destination);
	if (before?.isSymbolicLink() || (before && !before.isFile()))
		throw new Error(`Shared JSON destination identity is unsafe: ${destination}`);
	const temporary = `${destination}.stage-${process.pid}-${randomUUID()}.tmp`;
	const handle = await open(temporary, 'wx');
	try {
		await handle.writeFile(bytes);
		await handle.sync();
	} finally {
		await handle.close();
	}
	try {
		await ensureSafeParents(root, destination, false);
		const immediatelyBefore = await metadataOrNull(destination);
		if (immediatelyBefore?.isSymbolicLink() || (immediatelyBefore && !immediatelyBefore.isFile()))
			throw new Error(`Shared JSON destination identity changed before rename: ${destination}`);
		await rename(temporary, destination);
		await syncDirectory(path.dirname(destination));
		await ensureSafeParents(root, destination, false);
		const committed = await readRepositoryRegular(root, destination, 'Committed shared JSON');
		if (!committed.equals(bytes))
			throw new Error(`Shared JSON destination identity changed during rename: ${destination}`);
	} catch (error) {
		let cleanupError: unknown;
		try {
			await unlink(temporary);
		} catch (candidateCleanupError) {
			if ((candidateCleanupError as NodeJS.ErrnoException).code !== 'ENOENT') {
				cleanupError = candidateCleanupError;
			}
		}

		if (cleanupError) {
			throw new AggregateError(
				[error, cleanupError],
				`Atomic JSON replacement failed and temporary cleanup was incomplete: ${destination}`,
				{ cause: error }
			);
		}
		throw error;
	}
}

function journalBytes(journal: PromotionJournal): Buffer {
	return Buffer.from(`${JSON.stringify(journal, null, '\t')}\n`);
}

async function writeJournal(
	root: string,
	journal: PromotionJournal,
	exclusive: boolean
): Promise<void> {
	const destination = path.resolve(root, SKILL_ICON_PROMOTION_JOURNAL_PATH);
	await ensureSafeParents(root, destination, true);
	if (exclusive) {
		const handle = await open(
			destination,
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
			0o600
		);
		try {
			await handle.writeFile(journalBytes(journal));
			await handle.sync();
		} finally {
			await handle.close();
		}
		await syncDirectory(path.dirname(destination));
		return;
	}
	await atomicJsonReplace(root, destination, journalBytes(journal));
}

async function rollbackJournal(root: string, journal: PromotionJournal): Promise<void> {
	const failures: unknown[] = [];
	// Every destination was proven absent before the durable journal was written. Recover all
	// hash-matching planned destinations so a crash between the master write and journal update
	// cannot leave an untracked orphan.
	for (const { path: masterPath } of [...journal.masters].reverse()) {
		try {
			const master = path.resolve(root, masterPath);
			const bytes = await readRepositoryRegular(root, master, `Rollback master ${masterPath}`);
			const expected = journal.masters.find((item) => item.path === masterPath)?.contentHash;
			if (!expected || createHash('sha256').update(bytes).digest('hex') !== expected)
				throw new Error(
					`Refusing to remove changed promotion master during recovery: ${masterPath}`
				);
			await unlink(master);
			await syncDirectory(path.dirname(master));
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') failures.push(error);
		}
	}
	if (journal.phase === 'shared-writing') {
		for (const [relativePath, encoded] of [
			[SKILL_ICON_VISUAL_SPECS_PATH, journal.originalVisual],
			[SKILL_ICON_CATALOG_PATH, journal.originalCatalog]
		] as const) {
			try {
				const destination = path.resolve(root, relativePath);
				if (encoded === null) {
					const current = await metadataOrNull(destination);
					if (!current) continue;
					await ensureSafeParents(root, destination, false);
					if (current.isSymbolicLink() || !current.isFile())
						throw new Error(`Refusing to remove unsafe generated shared JSON: ${relativePath}`);
					await unlink(destination);
					await syncDirectory(path.dirname(destination));
					continue;
				}
				await atomicJsonReplace(root, destination, Buffer.from(encoded, 'base64'));
			} catch (error) {
				failures.push(error);
			}
		}
	}
	if (failures.length > 0) throw new AggregateError(failures, 'Promotion rollback/recovery failed');
}

export async function recoverSkillIconPromotion(options: {
	readonly root?: string;
	readonly force?: boolean;
}): Promise<void> {
	const root = path.resolve(options.root ?? process.cwd());
	const lockPath = path.resolve(root, SKILL_ICON_PROMOTION_LOCK_PATH);
	const journalPath = path.resolve(root, SKILL_ICON_PROMOTION_JOURNAL_PATH);
	const lockMetadata = await metadataOrNull(lockPath);
	// `force` permits stale-journal recovery, never takeover of a live coordinator.
	if (lockMetadata) {
		const lock = JSON.parse(
			(await readRepositoryRegular(root, lockPath, 'Coordinator lock')).toString('utf8')
		) as { pid?: number };
		if (typeof lock.pid === 'number') {
			try {
				process.kill(lock.pid, 0);
				throw new Error(`Active skill-icon coordinator lock held by PID ${lock.pid}`);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
			}
		}
	}
	const journalMetadata = await metadataOrNull(journalPath);
	if (journalMetadata) {
		const journal = JSON.parse(
			(await readRepositoryRegular(root, journalPath, 'Promotion journal')).toString('utf8')
		) as PromotionJournal;
		if (journal.schemaVersion !== 'skill-icon-promotion-transaction-v1')
			throw new Error('Unknown promotion journal schema');
		await rollbackJournal(root, journal);
		await unlink(journalPath);
		await syncDirectory(path.dirname(journalPath));
	}
	if (lockMetadata) {
		await unlink(lockPath);
		await syncDirectory(path.dirname(lockPath));
	}
}

async function withCoordinatorLock<T>(
	root: string,
	testHooks: PromotionTestHooks | undefined,
	operation: () => Promise<T>
): Promise<T> {
	const lockPath = path.resolve(root, SKILL_ICON_PROMOTION_LOCK_PATH);
	const journalPath = path.resolve(root, SKILL_ICON_PROMOTION_JOURNAL_PATH);
	await ensureSafeParents(root, lockPath, true);
	if (!(await metadataOrNull(lockPath)) && (await metadataOrNull(journalPath))) {
		await recoverSkillIconPromotion({ root, force: true });
	}
	let handle: Awaited<ReturnType<typeof open>>;
	try {
		handle = await open(
			lockPath,
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
			0o600
		);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
			const lock = JSON.parse(
				(await readRepositoryRegular(root, lockPath, 'Coordinator lock')).toString('utf8')
			) as { pid?: number };
			if (typeof lock.pid === 'number') {
				let alive = true;
				try {
					process.kill(lock.pid, 0);
				} catch (pidError) {
					if ((pidError as NodeJS.ErrnoException).code === 'ESRCH') alive = false;
					else throw pidError;
				}
				if (alive)
					throw new Error(`Skill-icon coordinator lock is already held by PID ${lock.pid}`, {
						cause: error
					});
			}
			await recoverSkillIconPromotion({ root, force: true });
			return withCoordinatorLock(root, testHooks, operation);
		}
		throw error;
	}
	try {
		await handle.writeFile(
			`${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`
		);
		await handle.sync();
	} finally {
		await handle.close();
	}
	await syncDirectory(path.dirname(lockPath));
	let result: T | undefined;
	let operationError: unknown;
	try {
		await testHooks?.afterLockAcquired?.();
		result = await operation();
	} catch (error) {
		operationError = error;
	}
	let releaseError: unknown;
	try {
		await unlink(lockPath);
		await syncDirectory(path.dirname(lockPath));
	} catch (error) {
		releaseError = error;
	}
	if (operationError && releaseError)
		throw new AggregateError(
			[operationError, releaseError],
			'Promotion and coordinator lock release failed',
			{ cause: operationError }
		);
	if (operationError) throw operationError;
	if (releaseError) throw releaseError;
	return result as T;
}

async function commitPromotions(
	root: string,
	prepared: readonly PreparedPromotion[],
	testHooks?: PromotionTestHooks
): Promise<readonly SkillIconAssetRecord[]> {
	const destinations = new Set<string>();
	const jobs = new Set<string>();
	for (const item of prepared) {
		if (jobs.has(item.record.jobId))
			throw new Error(`Duplicate promotion job ${item.record.jobId}`);
		if (destinations.has(item.destination))
			throw new Error(`Duplicate master destination ${item.record.approvedMaster.path}`);
		jobs.add(item.record.jobId);
		destinations.add(item.destination);
		if (await metadataOrNull(item.destination))
			throw new Error(
				`Master destination already exists (collision): ${item.record.approvedMaster.path}`
			);
	}

	const visualPath = path.resolve(root, SKILL_ICON_VISUAL_SPECS_PATH);
	const originalVisual = (await metadataOrNull(visualPath))
		? await readRepositoryRegular(root, visualPath, 'Visual specs')
		: null;
	const catalogPath = path.resolve(root, SKILL_ICON_CATALOG_PATH);
	const originalCatalog = (await metadataOrNull(catalogPath))
		? await readRepositoryRegular(root, catalogPath, 'Skill icon catalog')
		: null;
	if (originalVisual && !(await exportSkillIconProduction({ root, mode: 'check' })).inSync) {
		throw new Error('Skill icon catalog must be current before promotion');
	}
	let nextVisual: Buffer | null = null;
	if (prepared.some((item) => item.visualState)) {
		if (!originalVisual) throw new Error('Skill promotion requires visual specs');
		const visual = JSON.parse(originalVisual.toString('utf8')) as {
			schemaVersion: string;
			records: Record<string, unknown>[];
		};
		const replacements = new Map(
			prepared.flatMap((item) =>
				item.visualState ? [[item.record.skillTargetId, item.visualState] as const] : []
			)
		);
		visual.records = visual.records.map(
			(item) => replacements.get(item.targetId as string) ?? item
		);
		nextVisual = Buffer.from(`${JSON.stringify(visual, null, '\t')}\n`);
	}

	const created: string[] = [];
	let journal: PromotionJournal = {
		schemaVersion: 'skill-icon-promotion-transaction-v1',
		transactionId: randomUUID(),
		phase: 'prepared',
		masters: prepared.map((item) => ({
			path: item.record.approvedMaster.path,
			contentHash: item.record.approvedMaster.contentHash
		})),
		createdMasterPaths: [],
		originalVisual: originalVisual?.toString('base64') ?? null,
		originalCatalog: originalCatalog?.toString('base64') ?? null
	};
	await writeJournal(root, journal, true);
	try {
		for (const [index, item] of prepared.entries()) {
			await ensureSafeParents(root, item.destination, true);
			await testHooks?.beforeMasterWrite?.({ index, destination: item.destination });
			await ensureSafeParents(root, item.destination, false);
			const handle = await open(
				item.destination,
				constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
				0o644
			);
			try {
				await handle.writeFile(item.bytes);
				await handle.sync();
			} catch (error) {
				const cleanupFailures: unknown[] = [];
				try {
					await handle.close();
				} catch (cleanupError) {
					cleanupFailures.push(cleanupError);
				}
				try {
					await unlink(item.destination);
				} catch (cleanupError) {
					if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT')
						cleanupFailures.push(cleanupError);
				}
				if (cleanupFailures.length > 0)
					throw new AggregateError(
						[error, ...cleanupFailures],
						'Master write failed and immediate cleanup was incomplete',
						{ cause: error }
					);
				throw error;
			}
			await handle.close();
			created.push(item.destination);
			await syncDirectory(path.dirname(item.destination));
			await ensureSafeParents(root, item.destination, false);
			const committedBytes = await readRepositoryRegular(
				root,
				item.destination,
				`Promoted master ${item.record.approvedMaster.path}`
			);
			if (
				createHash('sha256').update(committedBytes).digest('hex') !==
				item.record.approvedMaster.contentHash
			)
				throw new Error(`Promoted master identity changed during write: ${item.destination}`);
			journal = {
				...journal,
				phase: 'masters-writing',
				createdMasterPaths: created.map((destination) =>
					path.relative(root, destination).split(path.sep).join('/')
				)
			};
			await writeJournal(root, journal, false);
			await testHooks?.afterMasterWrite?.({ index, destination: item.destination });
		}
		if (nextVisual) {
			await testHooks?.beforeSharedWrite?.();
			journal = { ...journal, phase: 'shared-writing' };
			await writeJournal(root, journal, false);
			await atomicJsonReplace(root, visualPath, nextVisual);
		}
		if (originalVisual) await exportSkillIconProduction({ root, mode: 'write' });
		await unlink(path.resolve(root, SKILL_ICON_PROMOTION_JOURNAL_PATH));
		await syncDirectory(path.resolve(root, 'assets/wiki/skills/icon-production-v1'));
		return prepared.map((item) => item.record);
	} catch (error) {
		const rollbackFailures: unknown[] = [];
		try {
			await rollbackJournal(root, journal);
		} catch (rollbackError) {
			rollbackFailures.push(rollbackError);
		}
		if (rollbackFailures.length > 0)
			throw new AggregateError(
				[error, ...rollbackFailures],
				'Promotion failed and rollback was incomplete',
				{ cause: error }
			);
		try {
			await unlink(path.resolve(root, SKILL_ICON_PROMOTION_JOURNAL_PATH));
			await syncDirectory(path.resolve(root, 'assets/wiki/skills/icon-production-v1'));
		} catch (journalError) {
			if ((journalError as NodeJS.ErrnoException).code !== 'ENOENT')
				rollbackFailures.push(journalError);
		}
		if (rollbackFailures.length > 0)
			throw new AggregateError(rollbackFailures, 'Promotion journal cleanup failed', {
				cause: error
			});
		throw error;
	}
}

export async function promoteSkillIconOutput(
	options: PromotionOptions
): Promise<SkillIconAssetRecord> {
	const root = path.resolve(options.root ?? process.cwd());
	return withCoordinatorLock(root, options.testHooks, async () => {
		const prepared = await preparePromotion(
			root,
			options.jobId,
			options.reviewPath,
			options.trustedOwner,
			options.trustedProducer
		);
		return (await commitPromotions(root, [prepared], options.testHooks))[0]!;
	});
}

export async function promoteReviewedSkillIconOutputs(options: {
	readonly reviewDirectory: string;
	readonly root?: string;
	readonly trustedOwner: string;
	readonly trustedProducer: string;
	readonly testHooks?: PromotionTestHooks;
}): Promise<readonly SkillIconAssetRecord[]> {
	const root = path.resolve(options.root ?? process.cwd());
	return withCoordinatorLock(root, options.testHooks, async () => {
		const directory = repositoryPath(
			root,
			options.reviewDirectory,
			'assets/wiki/skills/icon-production-v1/review/decisions'
		);
		await assertSafeExistingPath(root, directory.absolute, 'Review directory');
		const metadata = await lstat(directory.absolute);
		if (metadata.isSymbolicLink() || !metadata.isDirectory())
			throw new Error('Review directory must be a real directory');
		const entries = (await readdir(directory.absolute, { withFileTypes: true }))
			.filter((entry) => entry.name.endsWith('.json'))
			.sort((left, right) => left.name.localeCompare(right.name));
		if (entries.length === 0) throw new Error('Review directory contains no review records');
		if (entries.some((entry) => !entry.isFile() || entry.isSymbolicLink()))
			throw new Error('Review directory may contain only regular JSON review files');
		const prepared = await Promise.all(
			entries.map((entry) =>
				preparePromotion(
					root,
					entry.name.replace(/\.json$/u, ''),
					path.join(directory.relative, entry.name),
					options.trustedOwner,
					options.trustedProducer
				)
			)
		);
		return commitPromotions(root, prepared, options.testHooks);
	});
}

function option(args: readonly string[], name: string): string | undefined {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}

export type PromotionCliRequest =
	| {
			readonly mode: 'directory';
			readonly reviewDirectory: string;
			readonly trustedOwner: string;
			readonly trustedProducer: string;
	  }
	| {
			readonly mode: 'single';
			readonly jobId: string;
			readonly reviewPath: string;
			readonly trustedOwner: string;
			readonly trustedProducer: string;
	  };

export function parsePromotionCliRequest(args: readonly string[]): PromotionCliRequest {
	const allowed = new Set(['--review-dir', '--job', '--review', '--owner', '--producer']);
	const seen = new Set<string>();
	for (let index = 0; index < args.length; index += 2) {
		const flag = args[index];
		if (!flag || !allowed.has(flag) || !args[index + 1])
			throw new Error(`Unknown or incomplete argument: ${flag ?? '<missing>'}`);
		if (seen.has(flag)) throw new Error(`Duplicate argument: ${flag}`);
		seen.add(flag);
	}
	const reviewDirectory = option(args, '--review-dir');
	const jobId = option(args, '--job');
	const reviewPath = option(args, '--review');
	const trustedOwner = option(args, '--owner');
	const trustedProducer = option(args, '--producer');
	if (!trustedOwner) throw new Error('Missing --owner trusted coordinator identity');
	if (!trustedProducer) throw new Error('Missing --producer trusted coordinator identity');
	if (trustedOwner === trustedProducer)
		throw new Error('Trusted owner identity must be distinct from the producer identity');
	if (reviewDirectory && (jobId || reviewPath))
		throw new Error('Cannot mix --review-dir with --job or --review');
	if (reviewDirectory) return { mode: 'directory', reviewDirectory, trustedOwner, trustedProducer };
	if (!jobId || !reviewPath)
		throw new Error(
			'Usage: --review-dir <path> --owner <identity> --producer <identity> or --job <id> --review <path> --owner <identity> --producer <identity>'
		);
	return { mode: 'single', jobId, reviewPath, trustedOwner, trustedProducer };
}

async function runCli(args: readonly string[]): Promise<void> {
	const request = parsePromotionCliRequest(args);
	if (request.mode === 'directory') {
		const records = await promoteReviewedSkillIconOutputs({
			reviewDirectory: request.reviewDirectory,
			trustedOwner: request.trustedOwner,
			trustedProducer: request.trustedProducer
		});
		process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
		return;
	}
	process.stdout.write(
		`${JSON.stringify(
			await promoteSkillIconOutput({
				jobId: request.jobId,
				reviewPath: request.reviewPath,
				trustedOwner: request.trustedOwner,
				trustedProducer: request.trustedProducer
			}),
			null,
			2
		)}\n`
	);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	runCli(process.argv.slice(2)).catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
