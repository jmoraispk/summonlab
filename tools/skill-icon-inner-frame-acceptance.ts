import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';

import {
	SkillIconInnerFrameAcceptanceSchema,
	type SkillIconInnerFrameAcceptance
} from '../packages/contracts/src/skill-icon-inner-frame-acceptance.js';

export const ACTIVE_SKILL_ICON_INNER_FRAME_OVERLAY_PATH =
	'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/accepted-overlays/inner-frame-v1/manifest.json';
export const INNER_FRAME_ACCEPTANCE_DECISION = {
	decision: 'accepted',
	reviewerRole: 'owner',
	acceptedOn: '2026-09-06'
} as const;

const ROOT = 'assets/wiki/skills/icon-production-v1' as const;
const CLEANUP_ROOT = `${ROOT}/quality-cleanup-v1` as const;
const V10_PATH = `${CLEANUP_ROOT}/review/v10-inner-frame-audit/report.json` as const;
const V12_PATH = `${CLEANUP_ROOT}/review/v12-inner-frame-regeneration-scale/report.json` as const;
const CLEANUP_MANIFEST_PATH = `${CLEANUP_ROOT}/manifest.json` as const;
const ACCEPTED_ROOT = path.posix.dirname(ACTIVE_SKILL_ICON_INNER_FRAME_OVERLAY_PATH);
const APPROVED_TARGET_IDS = [
	'martial:blade:piercing-thrust',
	'martial:polearm:keep-away',
	'martial:polearm:piercing-line',
	'martial:polearm:wall-of-points',
	'martial:polearm:serpent-s-tongue',
	'martial:polearm:heaven-piercer',
	'martial:polearm:thousand-li-thrust',
	'martial:polearm:rend-armour',
	'martial:ranged:fletching',
	'martial:ranged:power-draw',
	'martial:ranged:piercing-shot',
	'martial:ranged:sky-piercer',
	'martial:body:sidestep',
	'martial:body:called-shot',
	'martial:body:the-road-has-no-end',
	'magical:elemental:torrent',
	'magical:elemental:the-deep',
	'magical:elemental:where-all-rivers-end',
	'magical:elemental:spike-field',
	'magical:enchantment:component-craft',
	'magical:mind:memory-edit',
	'craft:knowledge:languages',
	'craft:knowledge:research'
] as const;
const BORDERLINE_TARGET_IDS = [
	'martial:blade:one-blade-one-world',
	'martial:blade:blade-throw',
	'martial:ranged:archery',
	'martial:ranged:quick-loose',
	'martial:ranged:world-s-edge-shot'
] as const;

type Mode = 'write' | 'check';
type Binding = { readonly path: string; readonly contentHash: string };

export interface ValidatedSkillIconInnerFrameAcceptance {
	readonly repositoryRoot: string;
	readonly scope: {
		readonly catalogSkills: 456;
		readonly acceptedOverrides: 23;
		readonly unchanged: 433;
		readonly borderlineUntouched: 5;
	};
	readonly records: readonly {
		readonly targetId: string;
		readonly baseline: Binding;
		readonly candidate: Binding;
		readonly accepted: Binding;
	}[];
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

function absolutePath(repositoryRoot: string, repositoryPath: string): string {
	const absolute = path.resolve(repositoryRoot, repositoryPath);
	const relative = path.relative(repositoryRoot, absolute);
	if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
		throw new Error(`Acceptance path escapes repository: ${repositoryPath}`);
	return absolute;
}

async function regularBytes(repositoryRoot: string, repositoryPath: string): Promise<Buffer> {
	const absolute = absolutePath(repositoryRoot, repositoryPath);
	const metadata = await lstat(absolute);
	if (!metadata.isFile() || metadata.isSymbolicLink())
		throw new Error(`Acceptance input is not a regular file: ${repositoryPath}`);
	return readFile(absolute);
}

async function existingRegularBytes(
	repositoryRoot: string,
	repositoryPath: string
): Promise<Buffer | null> {
	try {
		return await regularBytes(repositoryRoot, repositoryPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}

function parseJson(bytes: Buffer, label: string): unknown {
	try {
		return JSON.parse(bytes.toString('utf8'));
	} catch {
		throw new Error(`Invalid JSON acceptance authority: ${label}`);
	}
}

function assertHash(bytes: Buffer, binding: Binding, label: string): void {
	if (sha256(bytes) !== binding.contentHash)
		throw new Error(`${label} hash drift: ${binding.path}`);
}

function record(value: unknown, label: string): Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`Invalid ${label} record`);
	return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(`Invalid ${label} array`);
	return value;
}

function string(value: unknown, label: string): string {
	if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid ${label}`);
	return value;
}

function boolean(value: unknown, label: string): boolean {
	if (typeof value !== 'boolean') throw new Error(`Invalid ${label}`);
	return value;
}

function equalJson(actual: unknown, expected: unknown, label: string): void {
	if (JSON.stringify(actual) !== JSON.stringify(expected))
		throw new Error(`Acceptance ${label} drift`);
}

async function assertBoundFile(
	repositoryRoot: string,
	binding: Binding,
	label: string
): Promise<void> {
	assertHash(await regularBytes(repositoryRoot, binding.path), binding, label);
}

async function deriveAcceptance(repositoryRoot: string): Promise<SkillIconInnerFrameAcceptance> {
	const [v10Bytes, v11Bytes, v12Bytes, cleanupManifestBytes] = await Promise.all([
		regularBytes(repositoryRoot, V10_PATH),
		regularBytes(repositoryRoot, `${CLEANUP_ROOT}/review/v11-inner-frame-regeneration/report.json`),
		regularBytes(repositoryRoot, V12_PATH),
		regularBytes(repositoryRoot, CLEANUP_MANIFEST_PATH)
	]);
	const v10 = record(parseJson(v10Bytes, 'V10 report'), 'V10 report');
	const v11 = record(parseJson(v11Bytes, 'V11 report'), 'V11 report');
	const v12 = record(parseJson(v12Bytes, 'V12 report'), 'V12 report');
	const cleanupManifest = record(
		parseJson(cleanupManifestBytes, 'cleanup manifest'),
		'cleanup manifest'
	);
	if (
		v10.schemaVersion !== 'skill-icon-inner-frame-audit-review-v1' ||
		v10.status !== 'diagnostic-review-only-no-icons-modified'
	)
		throw new Error('Unexpected V10 inner-frame audit authority');
	equalJson(
		v10.scope,
		{ catalogSkills: 456, clear: 23, borderline: 5, totalCandidates: 28 },
		'V10 scope'
	);
	const v10Inputs = record(v10.inputs, 'V10 inputs');
	const v10Geometry = record(v10Inputs.geometry, 'V10 geometry authority') as Binding;
	if (v10Geometry.path !== `${ROOT}/geometry-v2.json`)
		throw new Error('Unexpected V10 geometry path');
	await assertBoundFile(repositoryRoot, v10Geometry, 'V10 geometry');
	const v10Records = array(v10.records, 'V10 records').map((value) => record(value, 'V10'));
	if (v10Records.length !== 28) throw new Error('V10 acceptance inventory must contain 28 records');
	const clear = v10Records.filter((entry) => entry.classification === 'clear');
	const borderline = v10Records.filter((entry) => entry.classification === 'borderline');
	if (
		clear.length !== 23 ||
		borderline.length !== 5 ||
		clear.length + borderline.length !== v10Records.length
	)
		throw new Error(
			'V10 acceptance classifications must contain exactly 23 clear and 5 borderline records'
		);
	if (
		JSON.stringify(clear.map((entry) => entry.targetId)) !== JSON.stringify(APPROVED_TARGET_IDS) ||
		JSON.stringify(borderline.map((entry) => entry.targetId)) !==
			JSON.stringify(BORDERLINE_TARGET_IDS)
	)
		throw new Error('V10 acceptance target-set drift');
	const v10ByTarget = new Map<string, { path: string; contentHash: string }>();
	for (const entry of v10Records) {
		const targetId = string(entry.targetId, 'V10 target ID');
		if (v10ByTarget.has(targetId)) throw new Error(`Duplicate V10 target ID: ${targetId}`);
		const binding = {
			path: string(entry.currentPath, 'V10 current path'),
			contentHash: string(entry.currentHash, 'V10 current hash')
		};
		if (binding.path !== `${CLEANUP_ROOT}/composites/${targetId.replaceAll(':', '-')}.png`)
			throw new Error(`Unexpected V10 baseline path for ${targetId}`);
		await assertBoundFile(repositoryRoot, binding, 'V10 baseline composite');
		v10ByTarget.set(targetId, binding);
	}

	if (
		v12.schemaVersion !== 'skill-icon-inner-frame-regeneration-review-v2' ||
		v12.status !== 'owner-approved-less-zoom-review-not-promoted' ||
		v12.decision !== 'center-accepted-frameless-art-at-90-percent-scale'
	)
		throw new Error('Unexpected V12 inner-frame review authority');
	equalJson(v12.scope, { regenerated: 23, borderlineUntouched: 5 }, 'V12 scope');
	const assembly = record(v12.assembly, 'V12 assembly');
	equalJson(
		assembly,
		{
			artworkTreatment: 'generated-frameless-source-centered-before-aperture-mask',
			artworkScale: 0.9,
			preparedSource: { width: 922, height: 922, left: 51, top: 51 },
			backing: assembly.backing,
			frameIsFinalLayer: true,
			compositionProfile: 'frame-opening-v3'
		},
		'V12 assembly gates'
	);
	const backing = record(assembly.backing, 'V12 backing authority') as Binding;
	if (backing.path !== `${ROOT}/candidates/references/charcoal-forged-stone-v6.png`)
		throw new Error('Unexpected V12 backing path');
	await assertBoundFile(repositoryRoot, backing, 'V12 backing');
	const v12Inputs = record(v12.inputs, 'V12 inputs');
	const v12Geometry = record(v12Inputs.geometry, 'V12 geometry authority') as Binding;
	const priorReview = record(v12Inputs.priorReview, 'V12 prior review authority') as Binding;
	if (
		v12Geometry.path !== v10Geometry.path ||
		priorReview.path !== `${CLEANUP_ROOT}/review/v11-inner-frame-regeneration/report.json`
	)
		throw new Error('Unexpected V12 input authority path');
	await Promise.all([
		assertBoundFile(repositoryRoot, v12Geometry, 'V12 geometry'),
		Promise.resolve(assertHash(v11Bytes, priorReview, 'V12 prior review'))
	]);
	if (
		v11.schemaVersion !== 'skill-icon-inner-frame-regeneration-review-v1' ||
		v11.status !== 'owner-approved-regeneration-review-not-promoted'
	)
		throw new Error('Unexpected V11 inner-frame review authority');
	const v11ByTarget = new Map<
		string,
		{
			readonly comparisonBaseline: Binding;
			readonly source: Binding;
			readonly reference: Binding;
			readonly frame: Binding;
		}
	>();
	for (const value of array(v11.records, 'V11 records')) {
		const entry = record(value, 'V11');
		const targetId = string(entry.targetId, 'V11 target ID');
		if (v11ByTarget.has(targetId)) throw new Error(`Duplicate V11 target ID: ${targetId}`);
		const source = record(entry.source, 'V11 source');
		v11ByTarget.set(targetId, {
			comparisonBaseline: {
				path: string(entry.candidatePath, 'V11 candidate path'),
				contentHash: string(entry.candidateHash, 'V11 candidate hash')
			},
			source: {
				path: string(entry.sourcePath, 'V11 source path'),
				contentHash: string(source.contentHash, 'V11 source hash')
			},
			reference: {
				path: string(entry.referencePath, 'V11 reference path'),
				contentHash: string(entry.referenceHash, 'V11 reference hash')
			},
			frame: {
				path: string(entry.framePath, 'V11 frame path'),
				contentHash: string(entry.frameHash, 'V11 frame hash')
			}
		});
	}
	const sequence = record(v12.sequence, 'V12 sequence');
	if (sequence.mode !== 'sequential') throw new Error('Unexpected V12 sequence mode');
	const executionOrder = array(sequence.executionOrder, 'V12 execution order').map((entry) =>
		record(entry, 'V12 execution')
	);
	const v12Records = array(v12.records, 'V12 records').map((entry) => record(entry, 'V12'));
	if (v12Records.length !== 23 || executionOrder.length !== 23)
		throw new Error('V12 acceptance inventory must contain 23 records');
	const cleanupRecords = array(cleanupManifest.records, 'cleanup manifest records').map((entry) =>
		record(entry, 'cleanup manifest')
	);
	if (
		cleanupManifest.schemaVersion !== 'skill-icon-quality-cleanup-manifest-v1' ||
		cleanupRecords.length !== 456
	)
		throw new Error('Cleanup manifest must contain exactly 456 records');
	const cleanupByTarget = new Map<string, string>();
	for (const entry of cleanupRecords) {
		const targetId = string(entry.targetId, 'cleanup target ID');
		if (cleanupByTarget.has(targetId)) throw new Error(`Duplicate cleanup target ID: ${targetId}`);
		const compositePath = string(entry.cleanupCompositePath, 'cleanup composite path');
		if (compositePath !== `${CLEANUP_ROOT}/composites/${targetId.replaceAll(':', '-')}.png`)
			throw new Error(`Unexpected cleanup composite path for ${targetId}`);
		cleanupByTarget.set(targetId, compositePath);
	}

	const records: SkillIconInnerFrameAcceptance['records'] = [];
	for (const [index, entry] of v12Records.entries()) {
		const targetId = string(entry.targetId, 'V12 target ID');
		const order = executionOrder[index];
		if (!order || order.step !== index + 1 || order.targetId !== targetId)
			throw new Error(`V12 sequence drift for ${targetId}`);
		const baseline = v10ByTarget.get(targetId);
		if (!baseline || !clear.some((clearRecord) => clearRecord.targetId === targetId))
			throw new Error(`V12 target is not a clear V10 acceptance: ${targetId}`);
		if (cleanupByTarget.get(targetId) !== baseline.path)
			throw new Error(`Cleanup manifest baseline binding drift for ${targetId}`);
		const v12Baseline = {
			path: string(entry.currentPath, 'V12 current path'),
			contentHash: string(entry.currentHash, 'V12 current hash')
		};
		if (v12Baseline.path !== baseline.path || v12Baseline.contentHash !== baseline.contentHash)
			throw new Error(`V12 baseline binding drift for ${targetId}`);
		const v11Record = v11ByTarget.get(targetId);
		if (!v11Record) throw new Error(`Missing V11 record for ${targetId}`);
		const frame = {
			path: string(entry.framePath, 'V12 frame path'),
			contentHash: string(entry.frameHash, 'V12 frame hash')
		};
		if (frame.path !== v11Record.frame.path || frame.contentHash !== v11Record.frame.contentHash)
			throw new Error(`V12 frame binding drift for ${targetId}`);
		await assertBoundFile(repositoryRoot, frame, 'V12 frame');
		const comparisonBaseline = {
			path: string(entry.comparisonBaselinePath, 'V12 comparison baseline path'),
			contentHash: string(entry.comparisonBaselineHash, 'V12 comparison baseline hash')
		};
		if (
			comparisonBaseline.path !== v11Record.comparisonBaseline.path ||
			comparisonBaseline.contentHash !== v11Record.comparisonBaseline.contentHash
		)
			throw new Error(`V12 comparison baseline binding drift for ${targetId}`);
		await assertBoundFile(repositoryRoot, comparisonBaseline, 'V12 comparison baseline');
		const sourceBinding = record(entry.sourceBinding, 'V12 source binding');
		const source = record(entry.source, 'V12 source');
		if (
			source.width !== 1254 ||
			source.height !== 1254 ||
			source.alphaMode !== 'rgb' ||
			sourceBinding.matches !== true
		)
			throw new Error(`V12 source envelope drift for ${targetId}`);
		const sourceRaster = {
			path: string(entry.sourcePath, 'V12 source path'),
			contentHash: string(source.contentHash, 'V12 source hash')
		};
		const v11SourceBinding = {
			path: string(sourceBinding.v11Path, 'V12 V11 source path'),
			contentHash: string(sourceBinding.v11ContentHash, 'V12 V11 source hash')
		};
		if (
			sourceRaster.path !== v11Record.source.path ||
			sourceRaster.contentHash !== v11Record.source.contentHash ||
			v11SourceBinding.path !== v11Record.source.path ||
			v11SourceBinding.contentHash !== v11Record.source.contentHash
		)
			throw new Error(`V12 source binding drift for ${targetId}`);
		await assertBoundFile(repositoryRoot, sourceRaster, 'V12 source');
		const reference = {
			path: string(entry.referencePath, 'V12 reference path'),
			contentHash: string(entry.referenceHash, 'V12 reference hash')
		};
		if (
			reference.path !== v11Record.reference.path ||
			reference.contentHash !== v11Record.reference.contentHash
		)
			throw new Error(`V12 reference binding drift for ${targetId}`);
		await assertBoundFile(repositoryRoot, reference, 'V12 reference');
		const candidate = {
			path: string(entry.candidatePath, 'V12 candidate path'),
			contentHash: string(entry.candidateHash, 'V12 candidate hash')
		};
		if (
			candidate.path !==
			`${CLEANUP_ROOT}/review/v12-inner-frame-regeneration-scale/candidates/${targetId.replaceAll(':', '-')}.png`
		)
			throw new Error(`Unexpected V12 candidate path for ${targetId}`);
		await assertBoundFile(repositoryRoot, candidate, 'V12 candidate');
		const coverage = record(entry.apertureCoverage, 'V12 aperture coverage');
		if (coverage.expectedPixels !== coverage.coveredPixels || coverage.complete !== true)
			throw new Error(`Incomplete V12 aperture coverage for ${targetId}`);
		const inspection = record(entry.inspection, 'V12 inspection');
		if (
			!boolean(inspection.layerHashesMatch, 'V12 layer hash gate') ||
			!boolean(inspection.exactComposite, 'V12 exact composite gate') ||
			!boolean(inspection.protectedBandMatches, 'V12 protected-band gate') ||
			!boolean(inspection.exteriorTransparent, 'V12 transparent exterior gate') ||
			array(inspection.backingOnlyComponents, 'V12 backing-only components').length !== 0
		)
			throw new Error(`V12 inspection gate failed for ${targetId}`);
		records.push({
			targetId,
			baseline,
			candidate,
			accepted: {
				path: `${ACCEPTED_ROOT}/composites/${targetId.replaceAll(':', '-')}.png`,
				contentHash: candidate.contentHash
			}
		});
	}
	if (new Set(records.map((entry) => entry.targetId)).size !== 23)
		throw new Error('Duplicate V12 acceptance target ID');
	if (
		JSON.stringify(records.map((entry) => entry.targetId)) !== JSON.stringify(APPROVED_TARGET_IDS)
	)
		throw new Error('V12 acceptance target-set drift');
	if (clear.some((entry) => !records.some((record) => record.targetId === entry.targetId)))
		throw new Error('V10 clear target missing from V12 acceptance');
	if (borderline.some((entry) => records.some((record) => record.targetId === entry.targetId)))
		throw new Error('V10 borderline target must remain on baseline');
	const expected = {
		schemaVersion: 'skill-icon-inner-frame-acceptance-v1' as const,
		decision: INNER_FRAME_ACCEPTANCE_DECISION,
		scope: {
			catalogSkills: 456,
			acceptedOverrides: 23,
			unchanged: 433,
			borderlineUntouched: 5
		} as const,
		authority: {
			v10Audit: { path: V10_PATH, contentHash: sha256(v10Bytes) },
			v12Review: { path: V12_PATH, contentHash: sha256(v12Bytes) },
			cleanupManifest: { path: CLEANUP_MANIFEST_PATH, contentHash: sha256(cleanupManifestBytes) }
		},
		records
	};
	return SkillIconInnerFrameAcceptanceSchema.parse(expected);
}

async function writeAtomicCreateOnly(destination: string, bytes: Buffer): Promise<void> {
	await mkdir(path.dirname(destination), { recursive: true });
	const stage = `${destination}.stage-${process.pid}-${randomUUID()}`;
	let handle: Awaited<ReturnType<typeof open>> | null = null;
	try {
		handle = await open(stage, 'wx');
		await handle.writeFile(bytes);
		await handle.sync();
		await handle.close();
		handle = null;
		await link(stage, destination);
		await unlink(stage);
	} catch (error) {
		await handle?.close().catch(() => undefined);
		await unlink(stage).catch(() => undefined);
		throw error;
	}
}

async function syncCreateOnly(
	repositoryRoot: string,
	repositoryPath: string,
	bytes: Buffer,
	mode: Mode
): Promise<void> {
	const existing = await existingRegularBytes(repositoryRoot, repositoryPath);
	if (existing?.equals(bytes)) return;
	if (existing !== null)
		throw new Error(`Refusing acceptance publication drift: ${repositoryPath}`);
	if (mode === 'check') throw new Error(`Missing acceptance publication: ${repositoryPath}`);
	await writeAtomicCreateOnly(absolutePath(repositoryRoot, repositoryPath), bytes);
}

function runtimeAcceptance(
	repositoryRoot: string,
	acceptance: SkillIconInnerFrameAcceptance
): ValidatedSkillIconInnerFrameAcceptance {
	return {
		repositoryRoot,
		scope: acceptance.scope,
		records: acceptance.records.map((record) => ({
			...record,
			baseline: { ...record.baseline, path: absolutePath(repositoryRoot, record.baseline.path) },
			candidate: { ...record.candidate, path: absolutePath(repositoryRoot, record.candidate.path) },
			accepted: { ...record.accepted, path: absolutePath(repositoryRoot, record.accepted.path) }
		}))
	};
}

export async function syncSkillIconInnerFrameAcceptance(options: {
	readonly repositoryRoot: string;
	readonly mode: Mode;
}): Promise<void> {
	const repositoryRoot = path.resolve(options.repositoryRoot);
	const acceptance = await deriveAcceptance(repositoryRoot);
	const outputs = [
		...acceptance.records.map(async (record) => ({
			path: record.accepted.path,
			bytes: await regularBytes(repositoryRoot, record.candidate.path)
		})),
		Promise.resolve({
			path: ACTIVE_SKILL_ICON_INNER_FRAME_OVERLAY_PATH,
			bytes: jsonBytes(acceptance)
		})
	];
	const resolvedOutputs = await Promise.all(outputs);
	const existing = await Promise.all(
		resolvedOutputs.map(async (output) => ({
			output,
			bytes: await existingRegularBytes(repositoryRoot, output.path)
		}))
	);
	for (const { output, bytes } of existing) {
		if (bytes?.equals(output.bytes)) continue;
		if (bytes !== null) throw new Error(`Refusing acceptance publication drift: ${output.path}`);
		if (options.mode === 'check') throw new Error(`Missing acceptance publication: ${output.path}`);
	}
	if (options.mode === 'write')
		for (const { output, bytes } of existing)
			if (bytes === null)
				await syncCreateOnly(repositoryRoot, output.path, output.bytes, options.mode);
}

export async function loadSkillIconInnerFrameAcceptance(options: {
	readonly repositoryRoot: string;
}): Promise<ValidatedSkillIconInnerFrameAcceptance> {
	const repositoryRoot = path.resolve(options.repositoryRoot);
	const derived = await deriveAcceptance(repositoryRoot);
	const manifestBytes = await regularBytes(
		repositoryRoot,
		ACTIVE_SKILL_ICON_INNER_FRAME_OVERLAY_PATH
	);
	if (!manifestBytes.equals(jsonBytes(derived))) throw new Error('Accepted overlay manifest drift');
	for (const record of derived.records) {
		const [candidate, accepted] = await Promise.all([
			regularBytes(repositoryRoot, record.candidate.path),
			regularBytes(repositoryRoot, record.accepted.path)
		]);
		assertHash(accepted, record.accepted, 'Accepted composite');
		if (!candidate.equals(accepted))
			throw new Error(`Accepted composite differs from V12 candidate: ${record.targetId}`);
	}
	return runtimeAcceptance(repositoryRoot, derived);
}

export function resolveAcceptedSkillIconComposite(options: {
	readonly targetId: string;
	readonly baselinePath: string;
	readonly baselineHash: string;
	readonly acceptance: ValidatedSkillIconInnerFrameAcceptance;
}): {
	readonly path: string;
	readonly contentHash: string;
	readonly source: 'baseline' | 'inner-frame-v1';
} {
	const accepted = options.acceptance.records.find(
		(record) => record.targetId === options.targetId
	);
	if (!accepted)
		return { path: options.baselinePath, contentHash: options.baselineHash, source: 'baseline' };
	const callerPath = absolutePath(options.acceptance.repositoryRoot, options.baselinePath);
	if (
		callerPath !== accepted.baseline.path ||
		options.baselineHash !== accepted.baseline.contentHash
	)
		throw new Error(`Acceptance baseline binding mismatch for ${options.targetId}`);
	return {
		path: accepted.accepted.path,
		contentHash: accepted.accepted.contentHash,
		source: 'inner-frame-v1'
	};
}
