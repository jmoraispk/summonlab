import { describe, expect, it } from 'vitest';

import {
	buildEquipmentVisualProfile,
	createEquipmentSchemaArtifacts,
	serializeEquipmentVisualProfile
} from './equipment-image-profile.js';

describe('Equipment image visual profile', () => {
	it('builds the exact approval-candidate visual decisions', () => {
		const profile = buildEquipmentVisualProfile();

		expect(profile.status).toBe('approval-candidate');
		expect(profile.craftsmanship).toEqual({ grade: 'Standard', rankAdjustment: 0 });
		expect(profile.isolatedPresentation.canvas).toEqual({
			width: 1024,
			height: 1024,
			mediaType: 'image/png',
			safeMarginPercent: 8
		});
		expect(profile.fullSetPresentation.canvas).toEqual({
			width: 1024,
			height: 1536,
			mediaType: 'image/png',
			safeMarginPercent: 8
		});
		expect(profile.fullSetPresentation.subject).toBe('featureless-charcoal-display-form');
		expect(profile.references).toEqual([
			{
				path: 'assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png',
				contentHash: '9c726ad578a6a6d8ed510a7e7117443ce471e553d233b36a8c20afedddd1040d',
				purpose: expect.stringContaining('finish')
			}
		]);
		expect(profile.negativeConstraints).toEqual(
			expect.arrayContaining([
				'no-subject-transfer',
				'no-rarity-rainbow',
				'no-gold-inflation',
				'no-full-object-glow',
				'no-oversized-silhouettes',
				'no-text',
				'no-ui',
				'no-frames',
				'no-logos',
				'no-watermarks'
			])
		);
	});

	it('serializes the profile and all public schemas deterministically', () => {
		expect(serializeEquipmentVisualProfile()).toBe(
			`${JSON.stringify(buildEquipmentVisualProfile(), null, '\t')}\n`
		);

		const artifacts = createEquipmentSchemaArtifacts();
		expect(artifacts.map(({ path }) => path)).toEqual([
			'assets/equipment/experiments/material-equipment-v1/schemas/profile.schema.json',
			'assets/equipment/experiments/material-equipment-v1/schemas/profile-acceptance.schema.json',
			'assets/equipment/experiments/material-equipment-v1/schemas/target.schema.json',
			'assets/equipment/experiments/material-equipment-v1/schemas/assignment.schema.json',
			'assets/equipment/experiments/material-equipment-v1/schemas/result.schema.json',
			'assets/equipment/experiments/material-equipment-v1/schemas/armour-source-review-receipt.schema.json',
			'assets/equipment/experiments/material-equipment-v1/schemas/run-plan.schema.json',
			'assets/equipment/experiments/material-equipment-v1/schemas/run-activation.schema.json',
			'assets/equipment/experiments/material-equipment-v1/schemas/run-event-request.schema.json',
			'assets/equipment/experiments/material-equipment-v1/schemas/run-event.schema.json',
			'assets/equipment/experiments/material-equipment-v1/schemas/run-readiness-report.schema.json',
			'assets/equipment/experiments/material-equipment-v1/schemas/run-report.schema.json'
		]);
		for (const artifact of artifacts) {
			const schema = JSON.parse(artifact.contents) as Record<string, unknown>;
			expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
			expect(schema.$id).toBe(
				`https://summonlab.local/schemas/equipment/${artifact.path.split('/').at(-1)}`
			);
			expect(artifact.contents.endsWith('\n')).toBe(true);
		}
	});
});
