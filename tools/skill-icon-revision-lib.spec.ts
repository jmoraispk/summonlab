import { describe, expect, it } from 'vitest';

import {
	SKILL_ICON_NORMALIZATION_GEOMETRY_HASH,
	SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH,
	SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
	type AnySkillIconTarget
} from '../packages/contracts/src/index.js';
import {
	assertSkillIconSupersedingRevision,
	resolveLatestSkillIconTargets
} from './skill-icon-revision-lib.js';
import type { SkillIconReferenceTarget } from './skill-icon-reprocess-consumer-lib.js';
import { validateSkillIconAssets } from './validate-skill-icon-assets.js';

function target(jobId: string, revision?: number): AnySkillIconTarget {
	const base = {
		jobId,
		role: 'backing' as const,
		skillTargetId: null,
		motifFamily: null,
		rarity: null,
		exactPrompt: 'Bound prompt.',
		references: [
			{
				path: 'assets/wiki/skills/icon-production-v1/references/geometry-guide.png',
				purpose: 'Geometry.',
				contentHash: 'a'.repeat(64)
			}
		],
		canvas: { width: 1024 as const, height: 1024 as const, mediaType: 'image/png' as const },
		output: {
			candidatePath: `assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`,
			resultPath: `assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`
		}
	};
	if (revision === undefined) return { ...base, schemaVersion: 'skill-icon-target-v1' };
	return {
		...base,
		schemaVersion: 'skill-icon-target-v2',
		logicalIdentity: 'charcoal-forged-stone',
		revision,
		exactPrompt: 'Opaque #00FF00 matte; no baked checkerboard.',
		normalization: {
			profile: 'skill-icon-green-key-role-mask-v1',
			sourceContract: {
				mediaType: 'image/png',
				width: 1254,
				height: 1254,
				alphaMode: 'rgb',
				matteColor: '#00FF00'
			},
			outputContract: {
				mediaType: 'image/png',
				width: 1024,
				height: 1024,
				alphaMode: 'rgba'
			},
			geometry: {
				path: 'assets/wiki/skills/icon-production-v1/geometry.json',
				contentHash: SKILL_ICON_NORMALIZATION_GEOMETRY_HASH
			}
		}
	};
}

function targetV3(revision = 4): AnySkillIconTarget {
	const jobId = `charcoal-forged-stone-v${revision}`;
	const base = target(jobId, revision) as Extract<
		AnySkillIconTarget,
		{ schemaVersion: 'skill-icon-target-v2' }
	>;
	return {
		...base,
		references: [
			{
				path: SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
				purpose: SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
				contentHash: SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH
			}
		],
		normalization: {
			profile: 'skill-icon-green-key-role-mask-v3',
			sourceContract: {
				mediaType: 'image/png',
				width: 1254,
				height: 1254,
				alphaMode: 'rgb',
				matteColor: '#00FF00'
			},
			outputContract: base.normalization.outputContract,
			geometry: {
				path: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
				contentHash: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH
			}
		}
	};
}

function targetGeometryRoleMask(revision = 6): AnySkillIconTarget {
	const profileV3 = targetV3(revision) as Extract<
		AnySkillIconTarget,
		{ schemaVersion: 'skill-icon-target-v2' }
	>;
	return {
		...profileV3,
		normalization: {
			profile: 'skill-icon-geometry-role-mask-v1',
			sourceContract: {
				mediaType: 'image/png',
				width: 1254,
				height: 1254,
				alphaMode: 'rgb',
				matteColor: '#00FF00'
			},
			outputContract: profileV3.normalization.outputContract,
			geometry: {
				path: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
				contentHash: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH
			}
		}
	};
}

describe('skill-icon revision resolution', () => {
	it('selects one higher reprocess revision and rejects a second reprocess for the identity', () => {
		const ordinary = {
			...targetV3(4),
			jobId: 'rarity-frame-f-v4',
			logicalIdentity: 'rarity-frame-f',
			role: 'rarity-frame',
			rarity: 'F'
		} as AnySkillIconTarget;
		const reprocessed = {
			schemaVersion: 'skill-icon-reprocess-target-v1',
			jobId: 'rarity-frame-f-v5',
			logicalIdentity: 'rarity-frame-f',
			revision: 5,
			role: 'rarity-frame',
			rarity: 'F',
			originAuthority: {
				result: {
					path: 'assets/wiki/skills/icon-production-v1/results/references/rarity-frame-f-v3.json'
				},
				providerSourceHash: '9'.repeat(64)
			}
		} as unknown as SkillIconReferenceTarget;
		expect(resolveLatestSkillIconTargets([ordinary, reprocessed])).toEqual([
			{ target: reprocessed, logicalKey: 'rarity-frame:F', revision: 5 }
		]);
		const second = {
			...reprocessed,
			jobId: 'rarity-frame-f-v6',
			revision: 6
		} as SkillIconReferenceTarget;
		expect(() => resolveLatestSkillIconTargets([ordinary, reprocessed, second])).toThrow(
			/more than one reprocess target/iu
		);
	});
	it('selects an explicit higher v2 revision without falling back to v1', () => {
		const v1 = target('charcoal-forged-stone-v1');
		const v2 = target('charcoal-forged-stone-v2', 2);
		expect(resolveLatestSkillIconTargets([v1, v2])).toEqual([
			{ target: v2, logicalKey: 'backing', revision: 2 }
		]);
	});

	it('selects a higher profile-v3 revision without confusing profile and logical revision', () => {
		const prior = target('charcoal-forged-stone-v3', 3);
		const current = targetV3(4);
		expect(resolveLatestSkillIconTargets([prior, current])).toEqual([
			{ target: current, logicalKey: 'backing', revision: 4 }
		]);
		expect(() => assertSkillIconSupersedingRevision(prior, current)).not.toThrow();
	});

	it('selects a higher geometry-first revision without confusing profile and logical revision', () => {
		const prior = targetV3(5);
		const current = targetGeometryRoleMask(6);
		expect(resolveLatestSkillIconTargets([prior, current])).toEqual([
			{ target: current, logicalKey: 'backing', revision: 6 }
		]);
		expect(() => assertSkillIconSupersedingRevision(prior, current)).not.toThrow();
	});

	it('rejects duplicate logical identity and revision even under different filenames', () => {
		const v2 = target('charcoal-forged-stone-v2', 2);
		expect(() => resolveLatestSkillIconTargets([v2, { ...v2 }])).toThrow(/duplicate/iu);
	});

	it('accepts only a same-role, same-logical-key V2 superseding target at a higher revision', () => {
		const v2 = target('charcoal-forged-stone-v2', 2);
		const v3 = target('charcoal-forged-stone-v3', 3);
		expect(() => assertSkillIconSupersedingRevision(v2, v3)).not.toThrow();
		expect(() => assertSkillIconSupersedingRevision(v2, v2)).toThrow(/strictly higher/iu);
		expect(() =>
			assertSkillIconSupersedingRevision(v2, {
				...v3,
				logicalIdentity: 'different-backing'
			} as AnySkillIconTarget)
		).toThrow(/same role and logical identity/iu);
		expect(() =>
			assertSkillIconSupersedingRevision(v2, {
				...v3,
				role: 'rarity-frame',
				rarity: 'F'
			} as AnySkillIconTarget)
		).toThrow(/same role and logical identity/iu);
		expect(() =>
			assertSkillIconSupersedingRevision(target('charcoal-forged-stone-v1'), v3)
		).toThrow(/only V2 packets/iu);
	});

	it('rejects a V1 reference revision after v1 instead of allowing a protocol downgrade', () => {
		const v1 = target('charcoal-forged-stone-v99') as AnySkillIconTarget;
		const v2 = target('charcoal-forged-stone-v2', 2);
		expect(() => resolveLatestSkillIconTargets([v2, v1])).toThrow(
			/V1 backing target.*not the immutable historical identity.*V2 protocol/iu
		);
	});

	it('rejects forged V1 reference identities even when they retain the v1 suffix', () => {
		const forgedBacking = target('forged-impostor-v1') as AnySkillIconTarget;
		const forgedFrame = {
			...target('rarity-frame-e-v1'),
			role: 'rarity-frame' as const,
			rarity: 'F' as const
		} as AnySkillIconTarget;

		expect(() => resolveLatestSkillIconTargets([forgedBacking])).toThrow(
			/immutable historical identity charcoal-forged-stone-v1/iu
		);
		expect(() => resolveLatestSkillIconTargets([forgedFrame])).toThrow(
			/immutable historical identity rarity-frame-f-v1/iu
		);
	});

	it('accepts the completed F black-matte v9 frame and all other produced shared layers', async () => {
		await expect(validateSkillIconAssets(process.cwd())).resolves.toBeUndefined();
	}, 30_000);
});
