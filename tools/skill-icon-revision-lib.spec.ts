import { describe, expect, it } from 'vitest';

import {
	SKILL_ICON_NORMALIZATION_GEOMETRY_HASH,
	type AnySkillIconTarget
} from '../packages/contracts/src/index.js';
import { resolveLatestSkillIconTargets } from './skill-icon-revision-lib.js';
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

describe('skill-icon revision resolution', () => {
	it('selects an explicit higher v2 revision without falling back to v1', () => {
		const v1 = target('charcoal-forged-stone-v1');
		const v2 = target('charcoal-forged-stone-v2', 2);
		expect(resolveLatestSkillIconTargets([v1, v2])).toEqual([
			{ target: v2, logicalKey: 'backing', revision: 2 }
		]);
	});

	it('rejects duplicate logical identity and revision even under different filenames', () => {
		const v2 = target('charcoal-forged-stone-v2', 2);
		expect(() => resolveLatestSkillIconTargets([v2, { ...v2 }])).toThrow(/duplicate/iu);
	});

	it('treats current historical failed v1 evidence as valid evidence, not a missing candidate', async () => {
		let message = '';
		try {
			await validateSkillIconAssets(process.cwd());
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		}
		expect(message).toMatch(/latest revision v1 is failed/iu);
		expect(message).not.toMatch(/missing candidate/iu);
	});
});
