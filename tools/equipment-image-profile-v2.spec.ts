import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
	EQUIPMENT_V2_VISUAL_PROFILE_PATH,
	EQUIPMENT_V2_VISUAL_PROFILE_SCHEMA_PATH,
	EquipmentVisualProfileV2Schema,
	buildEquipmentVisualProfileV2,
	serializeEquipmentVisualProfileSchemaV2,
	serializeEquipmentVisualProfileV2
} from './equipment-image-profile-v2.js';

describe('Equipment image visual profile v2 planning', () => {
	it('locks the revised framing, armour display, and review language', () => {
		const profile = buildEquipmentVisualProfileV2();

		expect(profile.status).toBe('approval-candidate');
		expect(profile.runnerCompatibility).toBe('planning-only-requires-v2-execution-contract');
		expect(profile.validation).toEqual({
			jsonSchemaScope: 'structural-only',
			semanticValidator: 'EquipmentVisualProfileV2Schema.parse',
			semanticValidationRequiredForAcceptance: true
		});
		expect(profile.craftsmanship).toEqual({ grade: 'Standard', rankAdjustment: 0 });
		expect(profile.reviewLanguage).toEqual({
			candidate: 'Pass',
			revise: 'Check',
			failed: 'No image'
		});
		expect(profile.framing).toEqual({
			compositionTargetPercent: 8,
			hardMinimumPercent: 5,
			priority: 'pose-consistency-over-margin-above-hard-minimum'
		});
		expect(profile.fullSetPresentation).toMatchObject({
			subject: 'empty-self-supporting-armour-set',
			anchorReferenceId: 'coarse-hide-armour-camera',
			interior: 'natural-interior-cavity-shadow-only',
			requiredComponents: ['Head', 'Torso', 'Legs', 'Boots']
		});
		expect(profile.fullSetPresentation.composition).toContain('15 degrees toward frame-left');
		expect(profile.isolatedPresentation.commonPose).toContain(
			'Re-scale toward the 8% composition target and never below the 5% hard minimum'
		);
		expect(profile.isolatedPresentation.commonPose).toContain('upright or on-end');
		expect(profile.dependentPiecePresentation.additionalReferenceIds).toEqual([
			'remy-finish-style'
		]);
		expect(profile.negativeConstraints).toEqual(
			expect.arrayContaining([
				'no-visible-body',
				'no-visible-mannequin',
				'no-black-void-figure',
				'no-horizontal-floor-pose',
				'no-mirrored-class-pose'
			])
		);
		expect(serializeEquipmentVisualProfileV2()).not.toContain('featureless-charcoal-display-form');
	});

	it('binds every Equipment class to one hash-bound comparison reference', () => {
		const profile = buildEquipmentVisualProfileV2();
		const referenceIds = new Set(profile.references.map(({ referenceId }) => referenceId));

		expect(profile.equipmentClassDefaults).toHaveLength(11);
		expect(
			new Set(profile.equipmentClassDefaults.map(({ equipmentClass }) => equipmentClass)).size
		).toBe(11);
		expect(
			profile.equipmentClassDefaults.every(({ anchorReferenceId }) =>
				referenceIds.has(anchorReferenceId)
			)
		).toBe(true);
		const axe = profile.equipmentClassDefaults.find(
			({ equipmentClass }) => equipmentClass === 'axe'
		);
		expect(axe).toMatchObject({
			description: 'standard practical single-bit one-hand bearded axe',
			anchorReferenceId: 'axe-pose'
		});
		expect(axe?.proportionRules).toContain('double-bit war axe deferred to a later variant');
		const armourAnchor = profile.references.find(
			({ referenceId }) => referenceId === 'coarse-hide-armour-camera'
		);
		expect(armourAnchor).toMatchObject({
			usage: 'camera-and-display-only',
			appliesTo: {
				presentationModes: ['complete-armour-set'],
				artifactRoles: ['set-source']
			}
		});
		expect(armourAnchor?.purpose).toContain('Do not copy its support form');
	});

	it('verifies every pose and style reference against its exact repository bytes', () => {
		const profile = buildEquipmentVisualProfileV2();
		for (const reference of profile.references) {
			const actualHash = createHash('sha256').update(readFileSync(reference.path)).digest('hex');
			expect(actualHash, reference.path).toBe(reference.contentHash);
		}
	});

	it('rejects mannequin presentation and a double-bit primary Axe', () => {
		const profile = buildEquipmentVisualProfileV2();
		expect(
			EquipmentVisualProfileV2Schema.safeParse({
				...profile,
				fullSetPresentation: {
					...profile.fullSetPresentation,
					subject: 'featureless-charcoal-display-form'
				}
			}).success
		).toBe(false);
		expect(
			EquipmentVisualProfileV2Schema.safeParse({
				...profile,
				equipmentClassDefaults: profile.equipmentClassDefaults.map((entry) =>
					entry.equipmentClass === 'axe'
						? { ...entry, description: 'standard practical double-bit war axe' }
						: entry
				)
			}).success
		).toBe(false);
		expect(
			EquipmentVisualProfileV2Schema.safeParse({
				...profile,
				references: profile.references.map((reference) =>
					reference.referenceId === 'coarse-hide-armour-camera'
						? {
								...reference,
								appliesTo: {
									presentationModes: ['dependent-armour-piece'],
									artifactRoles: ['item']
								}
							}
						: reference
				)
			}).success
		).toBe(false);
	});

	it('rejects unsafe paths, dangling anchors, and incorrectly scoped anchors', () => {
		const profile = buildEquipmentVisualProfileV2();
		expect(
			EquipmentVisualProfileV2Schema.safeParse({
				...profile,
				references: profile.references.map((reference) =>
					reference.referenceId === 'sword-pose'
						? { ...reference, path: '../outside.png' }
						: reference
				)
			}).success
		).toBe(false);
		expect(
			EquipmentVisualProfileV2Schema.safeParse({
				...profile,
				equipmentClassDefaults: profile.equipmentClassDefaults.map((entry) =>
					entry.equipmentClass === 'sword' ? { ...entry, anchorReferenceId: 'missing-pose' } : entry
				)
			}).success
		).toBe(false);
		expect(
			EquipmentVisualProfileV2Schema.safeParse({
				...profile,
				references: profile.references.map((reference) =>
					reference.referenceId === 'sword-pose' ? { ...reference, usage: 'style-only' } : reference
				)
			}).success
		).toBe(false);
	});

	it('matches the checked-in deterministic profile and schema exactly', () => {
		expect(readFileSync(EQUIPMENT_V2_VISUAL_PROFILE_PATH, 'utf8')).toBe(
			serializeEquipmentVisualProfileV2()
		);
		expect(readFileSync(EQUIPMENT_V2_VISUAL_PROFILE_SCHEMA_PATH, 'utf8')).toBe(
			serializeEquipmentVisualProfileSchemaV2()
		);
		expect(JSON.parse(serializeEquipmentVisualProfileSchemaV2())).toMatchObject({
			$comment: expect.stringContaining('Structural validation only')
		});
	});
});
