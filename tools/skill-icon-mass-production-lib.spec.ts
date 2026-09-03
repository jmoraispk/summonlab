import { readFile } from 'node:fs/promises';

import { SkillIconCatalogSchema } from '../packages/contracts/src/index.js';
import { describe, expect, it } from 'vitest';

import type { SkillIconMotifMap } from './skill-icon-production-lib.js';
import {
	buildMassProductionManifest,
	MASS_PRODUCTION_FRAME_AUTHORITY_HASH
} from './skill-icon-mass-production-lib.js';

describe('skill icon mass-production manifest', () => {
	it('derives one framed sheet per motif family and one independent image per skill', async () => {
		const catalogBytes = await readFile('assets/wiki/skills/icon-production-v1/catalog.json');
		const motifBytes = await readFile('assets/wiki/skills/icon-production-v1/motif-map.json');
		const visualBytes = await readFile('assets/wiki/skills/icon-production-v1/visual-specs.json');
		const built = buildMassProductionManifest({
			catalog: SkillIconCatalogSchema.parse(JSON.parse(catalogBytes.toString('utf8'))),
			motifMap: JSON.parse(motifBytes.toString('utf8')) as SkillIconMotifMap,
			hashes: { catalog: 'a'.repeat(64), motifMap: 'b'.repeat(64), visualSpecs: 'c'.repeat(64) }
		});

		expect(built.manifest.expected).toEqual({
			families: 124,
			skills: 456,
			domains: { Martial: 258, Magical: 124, Craft: 74 }
		});
		expect(built.familyPrompts).toHaveLength(124);
		expect(built.skillPrompts).toHaveLength(456);
		expect(new Set(built.manifest.families.map((entry) => entry.referenceSheetPath)).size).toBe(
			124
		);
		expect(new Set(built.manifest.skills.map((entry) => entry.finalImagePath)).size).toBe(456);
		expect(built.manifest.authorities.frameSheet.contentHash).toBe(
			MASS_PRODUCTION_FRAME_AUTHORITY_HASH
		);
		expect(
			built.familyPrompts.find((packet) => packet.identity === 'body.grappling-control')
				?.exactPrompt
		).toContain('four equal columns and 3 rows');
	});
});
