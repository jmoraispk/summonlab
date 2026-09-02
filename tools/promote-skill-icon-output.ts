import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readdir, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';

import {
	SkillIconAssignmentSchema,
	SkillIconExecutionSchema,
	SkillIconRecordSchema,
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
	readonly review: SkillIconReview;
}

interface PromotionOptions {
	readonly jobId: string;
	readonly reviewPath: string;
	readonly root?: string;
}

interface PreparedPromotion {
	readonly record: SkillIconAssetRecord;
	readonly bytes: Buffer;
	readonly destination: string;
	readonly visualState: Record<string, unknown> | null;
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

async function derivedAsset(
	root: string,
	relativePath: string,
	mediaType: 'image/png' | 'image/webp',
	size: number
): Promise<SkillIconAsset> {
	const bytes = await readRepositoryRegular(
		root,
		path.resolve(root, relativePath),
		`Derived asset ${relativePath}`
	);
	const metadata = await sharp(bytes).metadata();
	if (
		metadata.width !== size ||
		metadata.height !== size ||
		metadata.format !== (mediaType === 'image/png' ? 'png' : 'webp') ||
		!metadata.hasAlpha
	)
		throw new Error(
			`Derived asset does not satisfy ${size}×${size} ${mediaType} RGBA contract: ${relativePath}`
		);
	return {
		path: relativePath,
		mediaType,
		width: size,
		height: size,
		bytes: bytes.byteLength,
		alphaMode: 'rgba',
		contentHash: createHash('sha256').update(bytes).digest('hex')
	};
}

async function skillVisualState(
	root: string,
	target: ReturnType<typeof SkillIconTargetSchema.parse>,
	record: SkillIconAssetRecord
): Promise<Record<string, unknown>> {
	if (target.role !== 'skill-art') throw new Error('Internal role mismatch');
	const visualBytes = await readRepositoryRegular(
		root,
		path.resolve(root, SKILL_ICON_VISUAL_SPECS_PATH),
		'Visual specs'
	);
	const visual = JSON.parse(visualBytes.toString('utf8')) as {
		records?: Record<string, unknown>[];
	};
	const current = visual.records?.find((item) => item.targetId === target.skillTargetId);
	if (!current || current.status !== 'candidate')
		throw new Error(`Skill ${target.skillTargetId} must be in candidate state before promotion`);
	const slug = target.skillTargetId.replaceAll(':', '-');
	const approved = {
		...current,
		status: 'approved',
		assets: {
			candidate: record.candidate,
			approvedMaster: record.approvedMaster,
			runtime512: await derivedAsset(
				root,
				`apps/web/static/skill-icons/v1/512/${slug}.webp`,
				'image/webp',
				512
			),
			runtime256: await derivedAsset(
				root,
				`apps/web/static/skill-icons/v1/256/${slug}.webp`,
				'image/webp',
				256
			),
			runtime128: await derivedAsset(
				root,
				`apps/web/static/skill-icons/v1/128/${slug}.webp`,
				'image/webp',
				128
			),
			recognition96: await derivedAsset(
				root,
				`assets/wiki/skills/icon-production-v1/review/recognition/${slug}.png`,
				'image/png',
				96
			)
		},
		review: record.review
	};
	const catalogBytes = await readRepositoryRegular(
		root,
		path.resolve(root, SKILL_ICON_CATALOG_PATH),
		'Skill icon catalog'
	);
	const catalog = JSON.parse(catalogBytes.toString('utf8')) as {
		records?: Record<string, unknown>[];
	};
	const canonical = catalog.records?.find((item) => item.targetId === target.skillTargetId);
	if (!canonical) throw new Error(`Catalog has no skill record ${target.skillTargetId}`);
	SkillIconRecordSchema.parse({ ...canonical, ...approved });
	return approved;
}

async function preparePromotion(
	root: string,
	jobId: string,
	reviewInput: string
): Promise<PreparedPromotion> {
	const reviewLocation = repositoryPath(
		root,
		reviewInput,
		'assets/wiki/skills/icon-production-v1/review/decisions'
	);
	const review = SkillIconReviewSchema.parse(
		JSON.parse(
			(await readRepositoryRegular(root, reviewLocation.absolute, 'Review')).toString('utf8')
		)
	);
	if (review.jobId !== jobId)
		throw new Error(`Review job ID ${review.jobId} does not match requested job ${jobId}`);
	if (review.decision !== 'accepted')
		throw new Error(`Review decision for ${jobId} must be accepted`);
	if (review.reviewerRole !== 'owner' || review.reviewer.trim().length === 0)
		throw new Error(`Accepted review for ${jobId} must name the owner as reviewer`);
	const scope = scopeForRole(review.role);
	const targetPath = `assets/wiki/skills/icon-production-v1/targets/${scope}/${jobId}.json`;
	const assignmentPath = `assets/wiki/skills/icon-production-v1/assignments/${scope}/${jobId}.json`;
	const resultPath = `assets/wiki/skills/icon-production-v1/results/${scope}/${jobId}.json`;
	const [target, assignment, result] = await Promise.all([
		readRepositoryRegular(root, path.resolve(root, targetPath), 'Target').then((bytes) =>
			SkillIconTargetSchema.parse(JSON.parse(bytes.toString('utf8')))
		),
		readRepositoryRegular(root, path.resolve(root, assignmentPath), 'Assignment').then((bytes) =>
			SkillIconAssignmentSchema.parse(JSON.parse(bytes.toString('utf8')))
		),
		readRepositoryRegular(root, path.resolve(root, resultPath), 'Result').then((bytes) =>
			SkillIconResultSchema.parse(JSON.parse(bytes.toString('utf8')))
		)
	]);
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
		review
	};
	return {
		record,
		bytes: candidateBytes,
		destination,
		visualState: target.role === 'skill-art' ? await skillVisualState(root, target, record) : null
	};
}

async function atomicJsonReplace(destination: string, bytes: Buffer): Promise<void> {
	const temporary = `${destination}.stage-${process.pid}-${randomUUID()}.tmp`;
	const handle = await open(temporary, 'wx');
	try {
		await handle.writeFile(bytes);
		await handle.sync();
	} finally {
		await handle.close();
	}
	try {
		await rename(temporary, destination);
	} catch (error) {
		await unlink(temporary).catch(() => undefined);
		throw error;
	}
}

async function commitPromotions(
	root: string,
	prepared: readonly PreparedPromotion[]
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
	let visualChanged = false;
	try {
		for (const item of prepared) {
			await ensureSafeParents(root, item.destination, true);
			const handle = await open(
				item.destination,
				constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
				0o644
			);
			try {
				await handle.writeFile(item.bytes);
				await handle.sync();
			} catch (error) {
				await handle.close().catch(() => undefined);
				await unlink(item.destination).catch(() => undefined);
				throw error;
			}
			await handle.close();
			created.push(item.destination);
		}
		if (nextVisual) {
			await atomicJsonReplace(visualPath, nextVisual);
			visualChanged = true;
		}
		if (originalVisual) await exportSkillIconProduction({ root, mode: 'write' });
		return prepared.map((item) => item.record);
	} catch (error) {
		if (visualChanged && originalVisual)
			await atomicJsonReplace(visualPath, originalVisual).catch(() => undefined);
		if (originalCatalog && (await metadataOrNull(catalogPath)))
			await atomicJsonReplace(catalogPath, originalCatalog).catch(() => undefined);
		if (!originalCatalog) await unlink(catalogPath).catch(() => undefined);
		await Promise.all(created.map((destination) => unlink(destination).catch(() => undefined)));
		throw error;
	}
}

export async function promoteSkillIconOutput(
	options: PromotionOptions
): Promise<SkillIconAssetRecord> {
	const root = path.resolve(options.root ?? process.cwd());
	const prepared = await preparePromotion(root, options.jobId, options.reviewPath);
	return (await commitPromotions(root, [prepared]))[0]!;
}

export async function promoteReviewedSkillIconOutputs(options: {
	readonly reviewDirectory: string;
	readonly root?: string;
}): Promise<readonly SkillIconAssetRecord[]> {
	const root = path.resolve(options.root ?? process.cwd());
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
				path.join(directory.relative, entry.name)
			)
		)
	);
	return commitPromotions(root, prepared);
}

function option(args: readonly string[], name: string): string | undefined {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}

async function runCli(args: readonly string[]): Promise<void> {
	const reviewDirectory = option(args, '--review-dir');
	if (reviewDirectory) {
		const records = await promoteReviewedSkillIconOutputs({ reviewDirectory });
		process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
		return;
	}
	const jobId = option(args, '--job');
	const reviewPath = option(args, '--review');
	if (!jobId || !reviewPath)
		throw new Error('Usage: --review-dir <path> or --job <id> --review <path>');
	process.stdout.write(
		`${JSON.stringify(await promoteSkillIconOutput({ jobId, reviewPath }), null, 2)}\n`
	);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	runCli(process.argv.slice(2)).catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
