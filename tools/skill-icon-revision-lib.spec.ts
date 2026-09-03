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

	it('reports only the eight incomplete latest v2 reference revisions after packet issuance', async () => {
		let message = '';
		try {
			await validateSkillIconAssets(process.cwd());
		} catch (error) {
			message = error instanceof Error ? error.message : String(error);
		}
		expect(message.split('\n')).toEqual([
			'references/charcoal-forged-stone-v2: missing result inventory entry',
			'references/rarity-frame-a-v2: missing result inventory entry',
			'references/rarity-frame-b-v2: missing result inventory entry',
			'references/rarity-frame-c-v2: missing result inventory entry',
			'references/rarity-frame-d-v2: missing result inventory entry',
			'references/rarity-frame-e-v2: missing result inventory entry',
			'references/rarity-frame-f-v2: missing result inventory entry',
			'references/rarity-frame-s-v2: missing result inventory entry'
		]);
		expect(message).not.toMatch(/latest revision v1 is failed/iu);
		expect(message).not.toMatch(/missing candidate/iu);
	});
});
