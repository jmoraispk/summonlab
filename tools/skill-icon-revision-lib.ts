import { type AnySkillIconTarget, type SkillIconRole } from '../packages/contracts/src/index.js';

export interface SkillIconTargetRevision {
	readonly target: AnySkillIconTarget;
	readonly logicalKey: string;
	readonly revision: number;
}

export function skillIconLogicalKey(target: AnySkillIconTarget): string {
	if (target.role === 'rarity-frame') return `rarity-frame:${target.rarity}`;
	if (target.role === 'backing') return 'backing';
	if (target.role === 'calibration-plate') return `calibration:${target.motifFamily}`;
	return `skill-art:${target.skillTargetId}`;
}

export function skillIconRevision(target: AnySkillIconTarget): number {
	if (target.schemaVersion === 'skill-icon-target-v2') return target.revision;
	const match = /-v([1-9][0-9]*)$/u.exec(target.jobId);
	if (!match) throw new Error(`Skill-icon job lacks a positive revision: ${target.jobId}`);
	return Number(match[1]);
}

export function resolveLatestSkillIconTargets(
	targets: readonly AnySkillIconTarget[]
): readonly SkillIconTargetRevision[] {
	const identities = new Set<string>();
	const latest = new Map<string, SkillIconTargetRevision>();
	for (const target of targets) {
		const logicalKey = skillIconLogicalKey(target);
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
