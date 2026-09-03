import { type AnySkillIconTarget, type SkillIconRole } from '../packages/contracts/src/index.js';

import type { SkillIconReferenceTarget } from './skill-icon-reprocess-consumer-lib.js';

export interface SkillIconTargetRevision {
	readonly target: SkillIconReferenceTarget;
	readonly logicalKey: string;
	readonly revision: number;
}

export function skillIconLogicalKey(target: SkillIconReferenceTarget): string {
	if (target.role === 'rarity-frame') return `rarity-frame:${target.rarity}`;
	if (target.role === 'backing') return 'backing';
	if (target.role === 'calibration-plate') return `calibration:${target.motifFamily}`;
	return `skill-art:${target.skillTargetId}`;
}

export function skillIconRevision(target: SkillIconReferenceTarget): number {
	if (
		target.schemaVersion === 'skill-icon-target-v2' ||
		target.schemaVersion === 'skill-icon-reprocess-target-v1'
	)
		return target.revision;
	const match = /-v([1-9][0-9]*)$/u.exec(target.jobId);
	if (!match) throw new Error(`Skill-icon job lacks a positive revision: ${target.jobId}`);
	const revision = Number(match[1]);
	const expectedHistoricalJobId =
		target.role === 'rarity-frame'
			? `rarity-frame-${target.rarity.toLowerCase()}-v1`
			: target.role === 'backing'
				? 'charcoal-forged-stone-v1'
				: null;
	if (expectedHistoricalJobId !== null && target.jobId !== expectedHistoricalJobId) {
		throw new Error(
			`V1 ${target.role} target ${target.jobId} is not the immutable historical identity ${expectedHistoricalJobId}; reference revisions after v1 require the V2 protocol`
		);
	}
	return revision;
}

export function assertSkillIconSupersedingRevision(
	retired: AnySkillIconTarget,
	superseding: AnySkillIconTarget
): void {
	if (
		retired.schemaVersion !== 'skill-icon-target-v2' ||
		superseding.schemaVersion !== 'skill-icon-target-v2'
	)
		throw new Error('Only V2 packets may use explicit unattempted supersession evidence');
	if (
		retired.role !== superseding.role ||
		retired.logicalIdentity !== superseding.logicalIdentity ||
		skillIconLogicalKey(retired) !== skillIconLogicalKey(superseding) ||
		skillIconRevision(superseding) <= skillIconRevision(retired)
	)
		throw new Error(
			'Superseding authority must have the same role and logical identity at a strictly higher revision'
		);
}

export function resolveLatestSkillIconTargets(
	targets: readonly SkillIconReferenceTarget[]
): readonly SkillIconTargetRevision[] {
	const identities = new Set<string>();
	const reprocessed = new Set<string>();
	const reprocessedOrigins = new Set<string>();
	const reprocessedSources = new Set<string>();
	const latest = new Map<string, SkillIconTargetRevision>();
	for (const target of targets) {
		const logicalKey = skillIconLogicalKey(target);
		if (target.schemaVersion === 'skill-icon-reprocess-target-v1') {
			if (reprocessed.has(logicalKey))
				throw new Error(
					`Skill-icon logical identity ${logicalKey} has more than one reprocess target`
				);
			reprocessed.add(logicalKey);
			if (reprocessedOrigins.has(target.originAuthority.result.path))
				throw new Error(
					`Skill-icon reprocess origin ${target.originAuthority.result.path} is consumed more than once`
				);
			if (reprocessedSources.has(target.originAuthority.providerSourceHash))
				throw new Error(
					`Skill-icon provider source ${target.originAuthority.providerSourceHash} is reprocessed more than once`
				);
			reprocessedOrigins.add(target.originAuthority.result.path);
			reprocessedSources.add(target.originAuthority.providerSourceHash);
		}
		const revision = skillIconRevision(target);
		const identity = `${logicalKey}\u0000${revision}`;
		if (identities.has(identity))
			throw new Error(`Duplicate skill-icon logical revision ${logicalKey} v${revision}`);
		identities.add(identity);
		const known = latest.get(logicalKey);
		if (!known || revision > known.revision)
			latest.set(logicalKey, { target, logicalKey, revision });
	}
	return [...latest.values()].sort((left, right) =>
		left.logicalKey.localeCompare(right.logicalKey)
	);
}

export function skillIconScopeForRole(role: SkillIconRole): 'references' | 'calibration' | 'icons' {
	if (role === 'skill-art') return 'icons';
	if (role === 'calibration-plate') return 'calibration';
	return 'references';
}
