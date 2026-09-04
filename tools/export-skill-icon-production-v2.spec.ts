import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import type { SkillIconCatalog } from '../packages/contracts/src/index.js';

import {
	appendMotifLineage,
	buildSuccessorVisualSpecs,
	exportSkillIconProductionV2,
	type SkillIconMotifAppendition,
	type SkillIconVisualOverlayRecord
} from './export-skill-icon-production-v2.js';
import { exportSkillIconProduction } from './export-skill-icon-production.js';
import {
	loadCanonicalSkillRows,
	type SkillIconMotifMap,
	type SkillIconVisualSpecs
} from './skill-icon-production-lib.js';

const appendition: SkillIconMotifAppendition = {
	mapEntryId: 'blade.guard-flow',
	existingTailTargetId: 'martial:blade:mirrored-edge',
	targetId: 'martial:blade:reversal-cut'
};

const visualRecord: SkillIconVisualOverlayRecord = {
	targetId: 'martial:blade:reversal-cut',
	status: 'authored',
	visualSpec: {
		dominantSubject:
			'a clearly visible sword snapping from a parry into a tight reverse diagonal cut',
		supportingCue:
			'one opposing blade and a compact hooked return trail communicating redirected force',
		semanticPalette: [
			'tempered steel',
			'charcoal black',
			'cold white-blue motion',
			'restrained amber impact sparks'
		],
		composition:
			'Centered painted emblem with the reversing sword dominant, a readable hooked action direction, and all important detail clear of the frame rim and top rank crest.',
		exclusions: [
			'no static crossed swords or mirror imagery',
			'no effect-only slash marks replacing the concrete acting sword',
			'no characters, scenery, text, logos, watermarks, UI panels, or extra rarity symbols'
		]
	},
	assets: null,
	review: null
};

describe('skill icon production v2 overlay', () => {
	it('appends one lineage child without revising any frozen v1 record', async () => {
		const [rows, baseMap] = await Promise.all([
			loadCanonicalSkillRows(),
			readFile('assets/wiki/skills/icon-production-v1/motif-map.json', 'utf8').then(
				(source) => JSON.parse(source) as SkillIconMotifMap
			)
		]);

		const successor = appendMotifLineage(baseMap, rows, [appendition]);
		const baseById = new Map(baseMap.records.map((record) => [record.targetId, record]));

		expect(successor.records).toHaveLength(baseMap.records.length + 1);
		expect(successor.records.find((record) => record.targetId === appendition.targetId)).toEqual({
			targetId: appendition.targetId,
			mapEntryId: appendition.mapEntryId,
			motifFamily: appendition.mapEntryId,
			primaryVisualParent: appendition.existingTailTargetId
		});
		for (const [targetId, record] of baseById) {
			expect(successor.records.find((candidate) => candidate.targetId === targetId)).toEqual(
				record
			);
		}
	});

	it('composes visual state from exact v1 records plus the authored addition', async () => {
		const [rows, baseSpecs] = await Promise.all([
			loadCanonicalSkillRows(),
			readFile('assets/wiki/skills/icon-production-v1/visual-specs.json', 'utf8').then(
				(source) => JSON.parse(source) as SkillIconVisualSpecs
			)
		]);

		const successor = buildSuccessorVisualSpecs(baseSpecs, rows, [visualRecord]);
		expect(successor.records).toHaveLength(457);
		expect(successor.records.find((record) => record.targetId === visualRecord.targetId)).toEqual(
			visualRecord
		);
	});

	it('exports a current 457-skill successor while keeping the v1 base frozen', async () => {
		const [report, baseReport] = await Promise.all([
			exportSkillIconProductionV2({ mode: 'check' }),
			exportSkillIconProduction({ mode: 'check' })
		]);
		const baseCatalog = JSON.parse(
			await readFile('assets/wiki/skills/icon-production-v1/catalog.json', 'utf8')
		) as SkillIconCatalog;

		expect(report.inSync).toBe(true);
		expect(report.summary.canonical).toBe(baseCatalog.records.length + 1);
		expect(report.summary.mapped).toBe(457);
		expect(report.baseSkillCount).toBe(456);
		expect(report.addedTargetIds).toEqual(['martial:blade:reversal-cut']);
		expect(baseReport.inSync).toBe(true);
		expect(baseReport.summary.canonical).toBe(456);
	});
});
