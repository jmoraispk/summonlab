import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, mkdir, open, readFile, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';

import {
	SkillIconCatalogSchema,
	SkillIconCleanupAuthoritySchema,
	SkillIconCleanupFindingSchema,
	SkillIconCleanupManifestSchema,
	SkillIconGeometryV2Schema,
	type SkillIconCatalog,
	type SkillIconCleanupFinding,
	type SkillIconCleanupManifest,
	type SkillIconGeometryV2
} from '../packages/contracts/src/index.js';
import type { MassProductionManifest } from './skill-icon-mass-production-lib.js';
import type { SkillIconMotifMap, SkillIconVisualSpecs } from './skill-icon-production-lib.js';

export const QUALITY_CLEANUP_ROOT =
	'assets/wiki/skills/icon-production-v1/quality-cleanup-v1' as const;

const MASS_PRODUCTION_ROOT = 'assets/wiki/skills/icon-production-v1/mass-production-v1' as const;
const FINDINGS_SOURCE_PATH = `${QUALITY_CLEANUP_ROOT}/findings.source.json` as const;
const MANIFEST_PATH = `${QUALITY_CLEANUP_ROOT}/manifest.json` as const;
const FINDINGS_PATH = `${QUALITY_CLEANUP_ROOT}/findings.json` as const;

const AUTHORITY_PATHS = {
	massProductionManifest: `${MASS_PRODUCTION_ROOT}/manifest.json`,
	catalog: 'assets/wiki/skills/icon-production-v1/catalog.json',
	motifMap: 'assets/wiki/skills/icon-production-v1/motif-map.json',
	visualSpecifications: 'assets/wiki/skills/icon-production-v1/visual-specs.json',
	selectedFrameSheet: `${MASS_PRODUCTION_ROOT}/references/approved-seven-frame-sheet.png`,
	optionCMaterial: 'assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png',
	geometry: 'assets/wiki/skills/icon-production-v1/geometry-v2.json',
	providerSpaceGuide: 'assets/wiki/skills/icon-production-v1/references/geometry-guide-v2.png'
} as const;

type CleanupAuthority = SkillIconCleanupManifest['authority'];

export interface CleanupManifestInput {
	readonly authority: CleanupAuthority;
	readonly catalog: SkillIconCatalog;
	readonly massProductionManifest: MassProductionManifest;
	readonly motifMap: SkillIconMotifMap;
	readonly visualSpecifications: SkillIconVisualSpecs;
	readonly geometry: SkillIconGeometryV2;
	readonly findings: readonly SkillIconCleanupFinding[];
	readonly sourceHashesByTargetId: ReadonlyMap<string, string>;
}

export interface CleanupExportReport {
	readonly mode: 'write' | 'check';
	readonly counts: Readonly<{ total: number; Martial: number; Magical: number; Craft: number }>;
	readonly written: readonly string[];
	readonly drifted: readonly string[];
}

export function cleanupSlug(targetId: string): string {
	return targetId.replaceAll(':', '-');
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

function isInside(root: string, candidate: string): boolean {
	const relative = path.relative(root, candidate);
	return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..');
}

async function regularBytes(root: string, repositoryPath: string): Promise<Buffer> {
	const rootRealPath = await realpath(root);
	const absolutePath = path.resolve(root, repositoryPath);
	if (!isInside(rootRealPath, absolutePath)) {
		throw new Error(`Authority path resolves outside the repository root: ${repositoryPath}`);
	}
	const metadata = await lstat(absolutePath);
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Refusing symbolic-link or non-regular authority file: ${repositoryPath}`);
	}
	const resolvedPath = await realpath(absolutePath);
	if (!isInside(rootRealPath, resolvedPath)) {
		throw new Error(`Authority path resolves outside the repository root: ${repositoryPath}`);
	}
	return readFile(absolutePath);
}

async function loadAuthority(root: string): Promise<{
	readonly authority: CleanupAuthority;
	readonly bytes: Readonly<Record<keyof typeof AUTHORITY_PATHS, Buffer>>;
}> {
	const entries = await Promise.all(
		Object.entries(AUTHORITY_PATHS).map(async ([key, repositoryPath]) => [
			key,
			await regularBytes(root, repositoryPath)
		])
	);
	const bytes = Object.fromEntries(entries) as Readonly<
		Record<keyof typeof AUTHORITY_PATHS, Buffer>
	>;
	const authority = SkillIconCleanupAuthoritySchema.parse(
		Object.fromEntries(
			Object.entries(AUTHORITY_PATHS).map(([key, repositoryPath]) => [
				key,
				{ path: repositoryPath, contentHash: sha256(bytes[key as keyof typeof AUTHORITY_PATHS]) }
			])
		)
	);
	return { authority, bytes };
}

function parseFindings(bytes: Buffer): readonly SkillIconCleanupFinding[] {
	const parsed = JSON.parse(bytes.toString('utf8')) as unknown;
	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		(parsed as { schemaVersion?: unknown }).schemaVersion !==
			'skill-icon-quality-cleanup-findings-source-v1' ||
		!Array.isArray((parsed as { findings?: unknown }).findings)
	) {
		throw new Error('Invalid cleanup findings source');
	}
	return (parsed as { findings: unknown[] }).findings.map((finding) =>
		SkillIconCleanupFindingSchema.parse(finding)
	);
}

function assertExactTargetCoverage(
	expected: readonly string[],
	actual: readonly string[],
	label: string
): void {
	if (
		expected.length !== actual.length ||
		new Set(actual).size !== actual.length ||
		expected.some((targetId) => !actual.includes(targetId))
	) {
		throw new Error(`${label} does not have exact canonical target coverage`);
	}
}

export async function loadCleanupManifestInput(
	root = process.cwd()
): Promise<CleanupManifestInput> {
	const repositoryRoot = path.resolve(root);
	const [{ authority, bytes }, findingsBytes] = await Promise.all([
		loadAuthority(repositoryRoot),
		regularBytes(repositoryRoot, FINDINGS_SOURCE_PATH)
	]);
	const catalog = SkillIconCatalogSchema.parse(
		JSON.parse(bytes.catalog.toString('utf8')) as unknown
	);
	const massProductionManifest = JSON.parse(
		bytes.massProductionManifest.toString('utf8')
	) as MassProductionManifest;
	const motifMap = JSON.parse(bytes.motifMap.toString('utf8')) as SkillIconMotifMap;
	const visualSpecifications = JSON.parse(
		bytes.visualSpecifications.toString('utf8')
	) as SkillIconVisualSpecs;
	const geometry = SkillIconGeometryV2Schema.parse(
		JSON.parse(bytes.geometry.toString('utf8')) as unknown
	);
	const findings = parseFindings(findingsBytes);
	const sourceHashesByTargetId = new Map<string, string>();

	for (const skill of massProductionManifest.skills) {
		const sourcePath = `${MASS_PRODUCTION_ROOT}/icons/${cleanupSlug(skill.targetId)}.png`;
		if (skill.finalImagePath !== sourcePath) {
			throw new Error(`Mass-production source path is not canonical: ${skill.targetId}`);
		}
		if (!skill.finalImageHash) throw new Error(`Missing frozen source hash: ${skill.targetId}`);
		const contentHash = sha256(await regularBytes(repositoryRoot, sourcePath));
		if (contentHash !== skill.finalImageHash) {
			throw new Error(`Frozen mass-production source hash drift: ${skill.targetId}`);
		}
		sourceHashesByTargetId.set(skill.targetId, contentHash);
	}

	return {
		authority,
		catalog,
		massProductionManifest,
		motifMap,
		visualSpecifications,
		geometry,
		findings,
		sourceHashesByTargetId
	};
}

function dispositionFor(
	findings: readonly SkillIconCleanupFinding[]
): SkillIconCleanupManifest['records'][number]['disposition'] {
	if (findings.some((finding) => finding.requiredAction === 'recompose')) return 'recompose';
	if (findings.some((finding) => finding.requiredAction === 'revise-art')) return 'revise-art';
	if (findings.some((finding) => finding.requiredAction === 'owner-review')) return 'owner-review';
	return 'accepted-unchanged';
}

export function buildSkillIconCleanupManifest(
	input: CleanupManifestInput
): SkillIconCleanupManifest {
	const catalog = SkillIconCatalogSchema.parse(input.catalog);
	const geometry = SkillIconGeometryV2Schema.parse(input.geometry);
	void geometry;
	const authority = SkillIconCleanupAuthoritySchema.parse(input.authority);
	const catalogTargetIds = catalog.records.map((record) => record.targetId);
	const massTargetIds = input.massProductionManifest.skills.map((record) => record.targetId);
	assertExactTargetCoverage(catalogTargetIds, massTargetIds, 'Mass-production manifest');
	assertExactTargetCoverage(
		catalogTargetIds,
		input.motifMap.records.map((record) => record.targetId),
		'Motif map'
	);
	assertExactTargetCoverage(
		catalogTargetIds,
		input.visualSpecifications.records.map((record) => record.targetId),
		'Visual specifications'
	);
	if (
		input.massProductionManifest.expected.skills !== 456 ||
		input.massProductionManifest.expected.domains.Martial !== 258 ||
		input.massProductionManifest.expected.domains.Magical !== 124 ||
		input.massProductionManifest.expected.domains.Craft !== 74
	) {
		throw new Error('Mass-production manifest does not declare the frozen 456-skill inventory');
	}
	const catalogByTargetId = new Map(catalog.records.map((record) => [record.targetId, record]));
	const massByTargetId = new Map(
		input.massProductionManifest.skills.map((record) => [record.targetId, record])
	);
	const findingsByTargetId = new Map<string, SkillIconCleanupFinding[]>();
	for (const finding of input.findings) {
		const parsedFinding = SkillIconCleanupFindingSchema.parse(finding);
		if (!catalogByTargetId.has(parsedFinding.targetId)) {
			throw new Error(`Cleanup finding references an unknown target: ${parsedFinding.targetId}`);
		}
		const attached = findingsByTargetId.get(parsedFinding.targetId) ?? [];
		attached.push(parsedFinding);
		findingsByTargetId.set(parsedFinding.targetId, attached);
	}

	const records = catalog.records.map((catalogRecord) => {
		const massRecord = massByTargetId.get(catalogRecord.targetId);
		if (!massRecord || massRecord.rarity !== catalogRecord.rarity) {
			throw new Error(`Mass-production rank drift: ${catalogRecord.targetId}`);
		}
		const sourcePath = `${MASS_PRODUCTION_ROOT}/icons/${cleanupSlug(catalogRecord.targetId)}.png`;
		if (massRecord.finalImagePath !== sourcePath || !massRecord.finalImageHash) {
			throw new Error(`Mass-production source is not frozen: ${catalogRecord.targetId}`);
		}
		const sourceHash = input.sourceHashesByTargetId.get(catalogRecord.targetId);
		if (!sourceHash || sourceHash !== massRecord.finalImageHash) {
			throw new Error(
				`Cleanup source hash does not match mass production: ${catalogRecord.targetId}`
			);
		}
		const findings = findingsByTargetId.get(catalogRecord.targetId) ?? [];
		const slug = cleanupSlug(catalogRecord.targetId);
		return {
			targetId: catalogRecord.targetId,
			sourceCandidate: { path: sourcePath, contentHash: sourceHash },
			rank: catalogRecord.rarity,
			disposition: dispositionFor(findings),
			findings,
			cleanupCompositePath: `${QUALITY_CLEANUP_ROOT}/composites/${slug}.png`,
			resultPath: `${QUALITY_CLEANUP_ROOT}/results/${slug}.json`
		};
	});
	const counts = records.reduce(
		(counts, record) => {
			const domain = record.targetId.split(':', 1)[0];
			if (domain === 'martial') counts.Martial += 1;
			else if (domain === 'magical') counts.Magical += 1;
			else if (domain === 'craft') counts.Craft += 1;
			return counts;
		},
		{ total: records.length, Martial: 0, Magical: 0, Craft: 0 }
	);
	if (
		counts.total !== 456 ||
		counts.Martial !== 258 ||
		counts.Magical !== 124 ||
		counts.Craft !== 74
	) {
		throw new Error('Cleanup manifest actual domain counts do not match the frozen inventory');
	}
	return SkillIconCleanupManifestSchema.parse({
		schemaVersion: 'skill-icon-quality-cleanup-manifest-v1',
		authority,
		records
	});
}

async function currentBytes(root: string, repositoryPath: string): Promise<Buffer | null> {
	const absolutePath = path.resolve(root, repositoryPath);
	const metadata = await lstat(absolutePath).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (!metadata) return null;
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Refusing symbolic-link or non-regular cleanup artifact: ${repositoryPath}`);
	}
	return readFile(absolutePath);
}

async function writeMissingAtomic(
	root: string,
	repositoryPath: string,
	bytes: Buffer
): Promise<boolean> {
	const destination = path.resolve(root, repositoryPath);
	const rootRealPath = await realpath(root);
	if (!isInside(rootRealPath, destination)) {
		throw new Error(
			`Cleanup artifact path resolves outside the repository root: ${repositoryPath}`
		);
	}
	const current = await currentBytes(root, repositoryPath);
	if (current?.equals(bytes)) return false;
	if (current) throw new Error(`Refusing to replace drifted cleanup artifact: ${repositoryPath}`);
	await mkdir(path.dirname(destination), { recursive: true });
	const resolvedDirectory = await realpath(path.dirname(destination));
	if (!isInside(rootRealPath, resolvedDirectory)) {
		throw new Error(
			`Cleanup artifact parent resolves outside the repository root: ${repositoryPath}`
		);
	}
	const stage = `${destination}.stage-${process.pid}-${randomUUID()}`;
	let handle: Awaited<ReturnType<typeof open>> | null = null;
	try {
		handle = await open(stage, 'wx');
		await handle.writeFile(bytes);
		await handle.sync();
		await handle.close();
		handle = null;
		let published = false;
		try {
			await link(stage, destination);
			published = true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
			const concurrent = await currentBytes(root, repositoryPath);
			if (!concurrent?.equals(bytes)) {
				throw new Error(`Refusing to replace drifted cleanup artifact: ${repositoryPath}`, {
					cause: error
				});
			}
		}
		const current = await currentBytes(root, repositoryPath);
		if (!current?.equals(bytes)) {
			throw new Error(`Refusing to replace drifted cleanup artifact: ${repositoryPath}`);
		}
		await unlink(stage);
		return published;
	} catch (error) {
		await handle?.close().catch(() => undefined);
		await unlink(stage).catch(() => undefined);
		throw error;
	}
}

export async function exportSkillIconQualityCleanup(options: {
	readonly root?: string;
	readonly mode: 'write' | 'check';
}): Promise<CleanupExportReport> {
	const root = path.resolve(options.root ?? process.cwd());
	const input = await loadCleanupManifestInput(root);
	const manifest = buildSkillIconCleanupManifest(input);
	const outputs = [
		{ path: MANIFEST_PATH, bytes: jsonBytes(manifest) },
		{
			path: FINDINGS_PATH,
			bytes: jsonBytes({
				schemaVersion: 'skill-icon-quality-cleanup-findings-source-v1',
				findings: input.findings
			})
		}
	];
	const drifted: string[] = [];
	const written: string[] = [];
	for (const output of outputs) {
		const current = await currentBytes(root, output.path);
		if (current?.equals(output.bytes)) continue;
		if (options.mode === 'check') {
			drifted.push(output.path);
			continue;
		}
		if (await writeMissingAtomic(root, output.path, output.bytes)) written.push(output.path);
	}
	const counts = manifest.records.reduce(
		(counts, record) => {
			const domain = record.targetId.split(':', 1)[0];
			if (domain === 'martial') counts.Martial += 1;
			else if (domain === 'magical') counts.Magical += 1;
			else if (domain === 'craft') counts.Craft += 1;
			return counts;
		},
		{ total: manifest.records.length, Martial: 0, Magical: 0, Craft: 0 }
	);
	return { mode: options.mode, counts, written, drifted };
}
