import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	AnySkillIconGeometrySchema,
	SkillIconCatalogSchema
} from '../packages/contracts/src/index.js';
import { z } from 'zod';

import { inspectSkillIconAsset } from './validate-skill-icon-assets.js';

export const GUARD_FLOW_ANCESTOR_IDS = [
	'martial:blade:cross-guard',
	'martial:blade:binding-cut',
	'martial:blade:counter-flow',
	'martial:blade:still-water-stance',
	'martial:blade:mirrored-edge'
] as const;

const ROOT = 'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v2';
export const GUARD_FLOW_ANCESTOR_REVIEW_PATH = `${ROOT}/guard-flow-ancestor-review.json`;
export const GUARD_FLOW_ANCESTOR_AUTHORITY_PATH = `${ROOT}/guard-flow-ancestor-authority.json`;
const CATALOG_PATH = 'assets/wiki/skills/icon-production-v2/catalog.json';
const GEOMETRY_PATH = 'assets/wiki/skills/icon-production-v1/geometry.json';
const MASS_MANIFEST_PATH = 'assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const RelativePathSchema = z
	.string()
	.refine((value) => !path.isAbsolute(value) && !value.split('/').includes('..'));
const ReviewSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-mass-ancestor-review-v1'),
		reviewId: z.literal('guard-flow-ancestor-review-v1'),
		reviewer: z.string().trim().min(1),
		reviewerRole: z.literal('owner'),
		decision: z.literal('accepted'),
		reviewedAt: z.string().datetime(),
		rationale: z.string().trim().min(1),
		targets: z
			.array(
				z
					.object({
						targetId: z.string(),
						candidatePath: RelativePathSchema,
						candidateHash: Sha256Schema,
						resultPath: RelativePathSchema,
						resultHash: Sha256Schema,
						findings: z.tuple([z.literal('full-size-pass'), z.literal('recognition-96-pass')])
					})
					.strict()
			)
			.length(GUARD_FLOW_ANCESTOR_IDS.length)
	})
	.strict();

const MassResultSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-mass-result-v1'),
		kind: z.literal('skill'),
		identity: z.string(),
		status: z.literal('candidate'),
		output: z
			.object({
				path: RelativePathSchema,
				mediaType: z.literal('image/png'),
				width: z.literal(1024),
				height: z.literal(1024),
				alphaMode: z.literal('rgba'),
				bytes: z.number().int().positive(),
				contentHash: Sha256Schema
			})
			.strict()
	})
	.passthrough();

const MassManifestSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-mass-production-manifest-v1'),
		completionState: z.literal('complete'),
		skills: z.array(
			z
				.object({
					targetId: z.string(),
					finalImagePath: RelativePathSchema,
					resultPath: RelativePathSchema,
					status: z.literal('candidate'),
					finalImageHash: Sha256Schema,
					resultHash: Sha256Schema
				})
				.passthrough()
		)
	})
	.passthrough();

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

export function validateGuardFlowAncestorOrder(
	targetIds: readonly string[]
): typeof GUARD_FLOW_ANCESTOR_IDS {
	if (JSON.stringify(targetIds) !== JSON.stringify(GUARD_FLOW_ANCESTOR_IDS)) {
		throw new Error('Guard-flow ancestor approvals must use the exact canonical order');
	}
	return GUARD_FLOW_ANCESTOR_IDS;
}

async function writeExact(destination: string, bytes: Buffer): Promise<boolean> {
	const current = await readFile(destination).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (current?.equals(bytes)) return false;
	if (current) throw new Error(`Refusing to replace differing lineage authority ${destination}`);
	await mkdir(path.dirname(destination), { recursive: true });
	const temporary = `${destination}.stage-${process.pid}-${randomUUID()}`;
	try {
		await writeFile(temporary, bytes, { flag: 'wx' });
		await rename(temporary, destination);
	} catch (error) {
		await unlink(temporary).catch(() => undefined);
		throw error;
	}
	return true;
}

export async function approveSkillIconMassAncestorChain(options: {
	readonly root?: string;
	readonly mode: 'check' | 'write';
}): Promise<{
	readonly current: boolean;
	readonly written: readonly string[];
	readonly authorityHash: string;
}> {
	const workspace = path.resolve(options.root ?? process.cwd());
	const [reviewBytes, catalogBytes, geometryBytes, manifestBytes] = await Promise.all([
		readFile(path.join(workspace, GUARD_FLOW_ANCESTOR_REVIEW_PATH)),
		readFile(path.join(workspace, CATALOG_PATH)),
		readFile(path.join(workspace, GEOMETRY_PATH)),
		readFile(path.join(workspace, MASS_MANIFEST_PATH))
	]);
	const review = ReviewSchema.parse(JSON.parse(reviewBytes.toString('utf8')));
	validateGuardFlowAncestorOrder(review.targets.map((target) => target.targetId));
	const catalog = SkillIconCatalogSchema.parse(JSON.parse(catalogBytes.toString('utf8')));
	const geometry = AnySkillIconGeometrySchema.parse(JSON.parse(geometryBytes.toString('utf8')));
	const manifest = MassManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));

	const masters: Array<{
		targetId: string;
		source: { path: string; contentHash: string };
		master: { path: string; contentHash: string };
	}> = [];
	const sourceBytes = new Map<string, Buffer>();
	for (const [index, item] of review.targets.entries()) {
		const expectedParent = index === 0 ? null : GUARD_FLOW_ANCESTOR_IDS[index - 1];
		const catalogRecord = catalog.records.find((record) => record.targetId === item.targetId);
		if (
			!catalogRecord ||
			catalogRecord.primaryVisualParent !== expectedParent ||
			catalogRecord.motifFamily !== 'blade.guard-flow'
		) {
			throw new Error(`Catalog lineage mismatch for ${item.targetId}`);
		}
		const manifestRecord = manifest.skills.find((record) => record.targetId === item.targetId);
		if (
			!manifestRecord ||
			manifestRecord.finalImagePath !== item.candidatePath ||
			manifestRecord.finalImageHash !== item.candidateHash ||
			manifestRecord.resultPath !== item.resultPath ||
			manifestRecord.resultHash !== item.resultHash
		) {
			throw new Error(`Mass manifest binding mismatch for ${item.targetId}`);
		}
		const [candidateBytes, resultBytes] = await Promise.all([
			readFile(path.join(workspace, item.candidatePath)),
			readFile(path.join(workspace, item.resultPath))
		]);
		if (sha256(candidateBytes) !== item.candidateHash || sha256(resultBytes) !== item.resultHash) {
			throw new Error(`Owner review hash mismatch for ${item.targetId}`);
		}
		const result = MassResultSchema.parse(JSON.parse(resultBytes.toString('utf8')));
		if (
			result.identity !== item.targetId ||
			result.output.path !== item.candidatePath ||
			result.output.contentHash !== item.candidateHash ||
			result.output.bytes !== candidateBytes.byteLength
		) {
			throw new Error(`Mass result binding mismatch for ${item.targetId}`);
		}
		const inspection = await inspectSkillIconAsset(candidateBytes, 'skill-art', geometry);
		if (
			inspection.mediaType !== 'image/png' ||
			inspection.width !== 1024 ||
			inspection.height !== 1024 ||
			inspection.alphaMode !== 'rgba' ||
			inspection.contentHash !== item.candidateHash
		) {
			throw new Error(
				`Retained ancestor failed its historical 1024 RGBA envelope for ${item.targetId}`
			);
		}
		const masterPath = `assets/wiki/skills/icon-production-v1/masters/icons/${item.targetId.replaceAll(':', '-')}.png`;
		sourceBytes.set(masterPath, candidateBytes);
		masters.push({
			targetId: item.targetId,
			source: { path: item.candidatePath, contentHash: item.candidateHash },
			master: { path: masterPath, contentHash: item.candidateHash }
		});
	}

	const authority = {
		schemaVersion: 'skill-icon-lineage-authority-v1',
		authorityId: 'guard-flow-ancestors-for-reversal-cut-v1',
		motifFamily: 'blade.guard-flow',
		review: { path: GUARD_FLOW_ANCESTOR_REVIEW_PATH, contentHash: sha256(reviewBytes) },
		massManifest: { path: MASS_MANIFEST_PATH, contentHash: sha256(manifestBytes) },
		catalog: { path: CATALOG_PATH, contentHash: sha256(catalogBytes) },
		masters
	};
	const authorityBytes = jsonBytes(authority);
	const expected = [
		...sourceBytes.entries(),
		[GUARD_FLOW_ANCESTOR_AUTHORITY_PATH, authorityBytes] as const
	];
	const written: string[] = [];
	for (const [relative, bytes] of expected) {
		const destination = path.join(workspace, relative);
		if (options.mode === 'write') {
			if (await writeExact(destination, bytes)) written.push(relative);
		} else {
			const metadata = await lstat(destination).catch((error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') return null;
				throw error;
			});
			if (
				!metadata?.isFile() ||
				metadata.isSymbolicLink() ||
				!(await readFile(destination)).equals(bytes)
			) {
				return { current: false, written, authorityHash: sha256(authorityBytes) };
			}
		}
	}
	return { current: true, written, authorityHash: sha256(authorityBytes) };
}

function parseMode(args: readonly string[]): 'check' | 'write' {
	if (args.length !== 1 || !['--check', '--write'].includes(args[0] ?? ''))
		throw new Error('Usage: tsx tools/approve-skill-icon-mass-ancestor-chain.ts --check|--write');
	return args[0] === '--write' ? 'write' : 'check';
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	approveSkillIconMassAncestorChain({ mode: parseMode(process.argv.slice(2)) })
		.then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}
