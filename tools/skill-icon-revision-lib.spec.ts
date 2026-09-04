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
			...base.normalization,
			profile: 'skill-icon-green-key-role-mask-v3',
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

	it('reports the terminal reference and Reversal Cut failures while accepting F-v5', async () => {
		let message = '';
		try {
			await validateSkillIconAssets(process.cwd());
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		}
		const diagnostics = message.split('\n');
		expect(diagnostics).toEqual([
			'backing latest revision v4 is failed (validation: Initial provider source crossed a role-required transparent region; the sole corrected source inset the backing but covered less than 85% of the aperture after profile-v3 normalization.); create a higher revision',
			'rarity-frame:A latest revision v4 is failed (validation: The corrected provider source remained ineligible because meaningful frame foreground entered a role-required transparent region under normalization profile v3.); create a higher revision',
			'rarity-frame:B latest revision v4 is failed (validation: The corrected provider source exhausted the one permitted edit and deterministic profile-v3 normalization rejected it because the #00FF00 edge matte was not sufficiently clean; no candidate was retained.); create a higher revision',
			'rarity-frame:C latest revision v4 is failed (validation: Corrected provider source exhausted the two-call imagegen ceiling and deterministic profile-v3 normalization still rejected a meaningful alpha component in a role-required transparent region.); create a higher revision',
			'rarity-frame:D latest revision v4 is failed (validation: Both authorized provider attempts were rejected by profile-v3 normalization because meaningful foreground remained in a role-required transparent region; no eligible candidate was produced.); create a higher revision',
			'rarity-frame:E latest revision v4 is failed (validation: Corrected provider source failed profile-v3 role-mask normalization: meaningful alpha component in a role-required transparent region.); create a higher revision',
			'rarity-frame:S latest revision v4 is failed (validation: Initial provider source failed the required transparent-region gate. The one authorized correction preserved the S-frame design but the corrected provider source failed the clean #00FF00 edge-matte gate; no role-valid candidate was retained.); create a higher revision',
			'skill-art:martial:blade:reversal-cut latest revision v1 is failed (validation: Initial and corrective provider rasters were both 1254x1254 RGB PNGs with depicted checkerboard backgrounds instead of the required 1024x1024 RGBA skill-art layer with genuine transparency; the retry ceiling was exhausted without a role-valid candidate.); create a higher revision'
		]);
		expect(diagnostics).toHaveLength(8);
		expect(message).not.toMatch(/missing result inventory entry/iu);
		expect(message).not.toMatch(/rarity-frame:F latest revision v4 is failed/iu);
		expect(message).not.toMatch(/rarity-frame-f-v5: missing result/iu);
		expect(message).not.toMatch(/latest revision v2 is failed/iu);
		expect(message).not.toMatch(/missing candidate/iu);
	});
});
