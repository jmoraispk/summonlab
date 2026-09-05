import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	SkillIconCatalogSchema,
	SkillIconRaritySchema,
	type SkillIconCatalog
} from '../packages/contracts/src/index.js';

import { loadApprovedSkillIconReferenceAuthority } from './compose-skill-icon-assets.js';
import { exportSkillIconProduction } from './export-skill-icon-production.js';
import { resolveLatestSkillIconTargets } from './skill-icon-revision-lib.js';
import {
	SkillIconReferenceTargetSchema,
	type SkillIconReferenceTarget
} from './skill-icon-reprocess-consumer-lib.js';

export const SKILL_ICON_PILOT_TARGET_IDS = [
	'martial:blade:horizontal-slash',
	'martial:blade:crescent-sweep',
	'martial:blade:wind-slash',
	'martial:blade:rising-moon',
	'martial:blade:ten-thousand-leaves',
	'magical:elemental:fireball',
	'magical:elemental:great-fireball',
	'magical:elemental:charged-fireball',
	'magical:elemental:meteor',
	'magical:elemental:sunfall',
	'craft:forging:ore-sense',
	'craft:forging:simple-smithing',
	'craft:forging:weaponsmithing',
	'craft:forging:armoursmithing',
	'craft:forging:godsmithing'
] as const;

export const REQUIRED_REFERENCE_ASSETS = [
	...(['f', 'e', 'd', 'c', 'b', 'a', 's'] as const).map((rarity) => ({
		id: `rarity-frame-${rarity}-v1`,
		role: 'rarity-frame' as const,
		path: `assets/wiki/skills/icon-production-v1/masters/frames/${rarity}.png`
	})),
	{
		id: 'charcoal-forged-stone-v1',
		role: 'backing' as const,
		path: 'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
	}
] as const;

export type SkillIconReferenceRequirement = {
	readonly id: string;
	readonly role: 'rarity-frame' | 'backing';
	readonly path: string;
	readonly targetDeclared?: boolean;
};

const CANONICAL_REFERENCE_SLOTS = [
	...(['f', 'e', 'd', 'c', 'b', 'a', 's'] as const).map((rarity) => ({
		logicalKey: `rarity-frame:${rarity.toUpperCase()}`,
		role: 'rarity-frame' as const,
		path: `assets/wiki/skills/icon-production-v1/masters/frames/${rarity}.png`
	})),
	{
		logicalKey: 'backing',
		role: 'backing' as const,
		path: 'assets/wiki/skills/icon-production-v1/masters/backing/charcoal-forged-stone.png'
	}
] as const;

function canonicalReferenceRequirements(
	requirements: readonly SkillIconReferenceRequirement[]
): readonly SkillIconReferenceRequirement[] {
	return CANONICAL_REFERENCE_SLOTS.map((slot) => {
		const matches = requirements.filter(
			(requirement) => requirement.role === slot.role && requirement.path === slot.path
		);
		if (matches.length === 1) return matches[0]!;
		return {
			id: `missing-target:${slot.logicalKey}`,
			role: slot.role,
			path: slot.path,
			targetDeclared: false
		};
	});
}

export function referenceRequirementsForTargets(
	targets: readonly SkillIconReferenceTarget[]
): readonly SkillIconReferenceRequirement[] {
	const latestTargets = new Map(
		resolveLatestSkillIconTargets(targets)
			.filter(({ target }) => target.role === 'rarity-frame' || target.role === 'backing')
			.map((revision) => [revision.logicalKey, revision.target] as const)
	);
	return CANONICAL_REFERENCE_SLOTS.map((slot) => {
		const target = latestTargets.get(slot.logicalKey);
		return target
			? { id: target.jobId, role: slot.role, path: slot.path, targetDeclared: true }
			: {
					id: `missing-target:${slot.logicalKey}`,
					role: slot.role,
					path: slot.path,
					targetDeclared: false
				};
	});
}

export async function loadAuthoritativeReferenceAssets(
	root: string,
	requirements: readonly SkillIconReferenceRequirement[]
): Promise<readonly SkillIconReviewedArtifact[]> {
	const settled = await Promise.allSettled(
		requirements
			.filter((requirement) => requirement.targetDeclared !== false)
			.map(async (requirement) => {
				const rarity =
					requirement.role === 'rarity-frame'
						? SkillIconRaritySchema.parse(path.basename(requirement.path, '.png').toUpperCase())
						: null;
				const authority = await loadApprovedSkillIconReferenceAuthority(
					root,
					requirement.path,
					requirement.role,
					rarity
				);
				if (authority.id !== requirement.id) {
					throw new Error(
						`Authoritative reference ${requirement.path} resolved ${authority.id}, expected ${requirement.id}`
					);
				}
				return {
					id: authority.id,
					role: authority.role,
					path: authority.path,
					contentHash: authority.contentHash,
					review: authority.review
				} satisfies SkillIconReviewedArtifact;
			})
	);
	return settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
}

const REQUIRED_PILOT_CALIBRATIONS = [
	{
		id: 'blade.sweeping-cut',
		role: 'calibration-plate' as const,
		path: 'assets/wiki/skills/icon-production-v1/masters/calibration/blade-sweeping-cut.png'
	},
	{
		id: 'elemental.fire-projectile',
		role: 'calibration-plate' as const,
		path: 'assets/wiki/skills/icon-production-v1/masters/calibration/elemental-fire-projectile.png'
	},
	{
		id: 'forging.smithing',
		role: 'calibration-plate' as const,
		path: 'assets/wiki/skills/icon-production-v1/masters/calibration/forging-smithing.png'
	}
] as const;

export type SkillIconReadinessState =
	| 'foundation-incomplete'
	| 'pilot-incomplete'
	| 'eligible-for-owner-activation'
	| 'bulk-active'
	| 'complete';

export interface SkillIconReviewedArtifact {
	readonly id: string;
	readonly role: 'rarity-frame' | 'backing' | 'calibration-plate';
	readonly path: string;
	readonly contentHash: string;
	readonly review: {
		readonly decision: 'accepted' | 'revise' | 'rejected';
		readonly artifactId: string;
		readonly role: 'rarity-frame' | 'backing' | 'calibration-plate';
		readonly path: string;
		readonly contentHash: string;
	};
}

export interface SkillIconReadinessEvidence {
	readonly referenceAssets?: readonly SkillIconReviewedArtifact[];
	readonly calibrationPlates?: readonly SkillIconReviewedArtifact[];
	readonly pilot?: {
		readonly targetIds: readonly string[];
		readonly decision: 'accepted' | 'revise' | 'rejected';
		readonly contentHashes: Readonly<Record<string, string>>;
	};
	readonly bulkActivation?: {
		readonly decision: 'accepted' | 'rejected';
		readonly catalogHash: string;
		readonly reviewedCatalogHash: string;
	};
}

export function withAuthoritativeReferenceEvidence(
	durableEvidence: SkillIconReadinessEvidence,
	referenceAssets: readonly SkillIconReviewedArtifact[]
): SkillIconReadinessEvidence {
	return { ...durableEvidence, referenceAssets };
}

export interface SkillIconCatalogCurrency {
	readonly catalogCurrent: boolean;
}

export interface SkillIconReadinessReport {
	readonly schemaVersion: 'skill-icon-readiness-v1';
	readonly state: SkillIconReadinessState;
	readonly canonical: number;
	readonly mapped: number;
	readonly authored: number;
	readonly candidate: number;
	readonly approved: number;
	readonly remaining: number;
	readonly referencesAccepted: number;
	readonly calibrationsAccepted: number;
	readonly pilotAccepted: boolean;
	readonly bulkActivated: boolean;
	readonly blockers: readonly string[];
}

function acceptedArtifact(artifact: SkillIconReviewedArtifact): boolean {
	return (
		artifact.review.decision === 'accepted' &&
		/^[a-f0-9]{64}$/u.test(artifact.contentHash) &&
		artifact.id === artifact.review.artifactId &&
		artifact.role === artifact.review.role &&
		artifact.path === artifact.review.path &&
		artifact.contentHash === artifact.review.contentHash
	);
}

function acceptedRequiredArtifacts(
	required: readonly {
		readonly id: string;
		readonly role: string;
		readonly path: string;
		readonly targetDeclared?: boolean;
	}[],
	provided: readonly SkillIconReviewedArtifact[]
): number {
	return required.filter(
		(requirement) =>
			requirement.targetDeclared !== false &&
			provided.some(
				(artifact) =>
					artifact.id === requirement.id &&
					artifact.role === requirement.role &&
					artifact.path === requirement.path &&
					acceptedArtifact(artifact)
			)
	).length;
}

export function hashSkillIconCatalog(catalog: SkillIconCatalog): string {
	return createHash('sha256')
		.update(`${JSON.stringify(catalog, null, '\t')}\n`)
		.digest('hex');
}

export function buildSkillIconReadinessReport(
	catalog: SkillIconCatalog,
	evidence: SkillIconReadinessEvidence,
	currency: SkillIconCatalogCurrency,
	requiredReferenceAssets: readonly SkillIconReferenceRequirement[] = REQUIRED_REFERENCE_ASSETS
): SkillIconReadinessReport {
	const lifecycle = { mapped: 0, authored: 0, candidate: 0, approved: 0 };
	for (const record of catalog.records) lifecycle[record.status] += 1;
	const canonicalReferences = canonicalReferenceRequirements(requiredReferenceAssets);
	const referenceTargetsDeclared = canonicalReferences.filter(
		(requirement) => requirement.targetDeclared !== false
	).length;
	const referencesAccepted = acceptedRequiredArtifacts(
		canonicalReferences,
		evidence.referenceAssets ?? []
	);
	const foundationComplete =
		currency.catalogCurrent &&
		referenceTargetsDeclared === CANONICAL_REFERENCE_SLOTS.length &&
		referencesAccepted === CANONICAL_REFERENCE_SLOTS.length;
	const calibrationsAccepted = acceptedRequiredArtifacts(
		REQUIRED_PILOT_CALIBRATIONS,
		evidence.calibrationPlates ?? []
	);

	const recordsById = new Map(catalog.records.map((record) => [record.targetId, record] as const));
	const pilotTargetSetMatches =
		evidence.pilot?.targetIds.length === SKILL_ICON_PILOT_TARGET_IDS.length &&
		SKILL_ICON_PILOT_TARGET_IDS.every((targetId) => evidence.pilot?.targetIds.includes(targetId));
	const pilotHashesMatch = SKILL_ICON_PILOT_TARGET_IDS.every((targetId) => {
		const record = recordsById.get(targetId);
		return (
			record?.status === 'approved' &&
			evidence.pilot?.contentHashes[targetId] === record.assets.approvedMaster.contentHash
		);
	});
	const pilotAccepted =
		calibrationsAccepted === REQUIRED_PILOT_CALIBRATIONS.length &&
		evidence.pilot?.decision === 'accepted' &&
		pilotTargetSetMatches &&
		pilotHashesMatch;
	const expectedCatalogHash = hashSkillIconCatalog(catalog);
	const bulkActivated =
		evidence.bulkActivation?.decision === 'accepted' &&
		evidence.bulkActivation.catalogHash === expectedCatalogHash &&
		evidence.bulkActivation.reviewedCatalogHash === expectedCatalogHash;

	const blockers: string[] = [];
	if (catalog.records.length !== 456) blockers.push(`expected 456 canonical records`);
	if (!currency.catalogCurrent) blockers.push('catalog export is not current');
	if (referenceTargetsDeclared !== CANONICAL_REFERENCE_SLOTS.length)
		blockers.push(
			`declared canonical reference targets ${referenceTargetsDeclared}/${CANONICAL_REFERENCE_SLOTS.length}`
		);
	if (referencesAccepted !== CANONICAL_REFERENCE_SLOTS.length)
		blockers.push(
			`accepted reference assets ${referencesAccepted}/${CANONICAL_REFERENCE_SLOTS.length}`
		);
	if (foundationComplete && calibrationsAccepted !== 3)
		blockers.push(`accepted pilot calibration plates ${calibrationsAccepted}/3`);
	if (foundationComplete && !pilotAccepted)
		blockers.push('pilot owner decision is incomplete or stale');
	if (pilotAccepted && !bulkActivated)
		blockers.push('bulk production requires explicit owner activation');
	if (bulkActivated && lifecycle.approved !== 456)
		blockers.push(`approved skill icons ${lifecycle.approved}/456`);

	let state: SkillIconReadinessState;
	if (!foundationComplete || catalog.records.length !== 456) state = 'foundation-incomplete';
	else if (!pilotAccepted) state = 'pilot-incomplete';
	else if (!bulkActivated) state = 'eligible-for-owner-activation';
	else if (lifecycle.approved === 456) state = 'complete';
	else state = 'bulk-active';

	return {
		schemaVersion: 'skill-icon-readiness-v1',
		state,
		canonical: catalog.records.length,
		...lifecycle,
		remaining: catalog.records.length - lifecycle.approved,
		referencesAccepted,
		calibrationsAccepted,
		pilotAccepted,
		bulkActivated,
		blockers
	};
}

async function main(args: readonly string[]): Promise<void> {
	if (args.length > 1 || (args.length === 1 && args[0] !== '--require-pilot')) {
		throw new Error('Usage: tsx tools/report-skill-icon-readiness.ts [--require-pilot]');
	}
	const catalogPath = path.resolve('assets/wiki/skills/icon-production-v1/catalog.json');
	const evidencePath = path.resolve(
		'assets/wiki/skills/icon-production-v1/review/readiness-evidence.json'
	);
	const catalog = SkillIconCatalogSchema.parse(JSON.parse(await readFile(catalogPath, 'utf8')));
	const targetDirectory = path.resolve('assets/wiki/skills/icon-production-v1/targets/references');
	const referenceTargets = await readdir(targetDirectory)
		.then((names) =>
			Promise.all(
				names
					.filter((name) => name.endsWith('.json'))
					.map((name) =>
						readFile(path.join(targetDirectory, name), 'utf8').then((source) =>
							SkillIconReferenceTargetSchema.parse(JSON.parse(source))
						)
					)
			)
		)
		.catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return [];
			throw error;
		});
	const requiredReferences = referenceRequirementsForTargets(referenceTargets);
	const exportReport = await exportSkillIconProduction({ mode: 'check' });
	const durableEvidence = await readFile(evidencePath, 'utf8')
		.then((source) => JSON.parse(source) as SkillIconReadinessEvidence)
		.catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return {};
			throw error;
		});
	const evidence = withAuthoritativeReferenceEvidence(
		durableEvidence,
		await loadAuthoritativeReferenceAssets(process.cwd(), requiredReferences)
	);
	const report = buildSkillIconReadinessReport(
		catalog,
		evidence,
		{ catalogCurrent: exportReport.inSync },
		requiredReferences
	);
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	if (
		args[0] === '--require-pilot' &&
		!['eligible-for-owner-activation', 'bulk-active', 'complete'].includes(report.state)
	) {
		process.exitCode = 1;
	}
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	main(process.argv.slice(2)).catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
