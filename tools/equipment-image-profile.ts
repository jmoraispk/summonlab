import { z } from 'zod';

import {
	EQUIPMENT_PRODUCTION_ROOT,
	EquipmentArmourSourceReviewReceiptSchema,
	EquipmentImageAssignmentSchema,
	EquipmentImageResultSchema,
	EquipmentImageTargetSchema,
	EquipmentRunActivationSchema,
	EquipmentRunEventRequestSchema,
	EquipmentRunEventSchema,
	EquipmentRunPlanSchema,
	EquipmentRunReadinessReportSchema,
	EquipmentRunReportSchema,
	EquipmentVisualProfileAcceptanceSchema,
	EquipmentVisualProfileSchema,
	type EquipmentVisualProfile
} from './equipment-image-production-contract.js';

export const EQUIPMENT_VISUAL_PROFILE_PATH =
	`${EQUIPMENT_PRODUCTION_ROOT}/visual-profile/profile.json` as const;

const JSON_SCHEMA_ID_ROOT = 'https://summonlab.local/schemas/equipment' as const;
const SCHEMA_DIRECTORY = `${EQUIPMENT_PRODUCTION_ROOT}/schemas` as const;

const schemaDefinitions = [
	['profile.schema.json', EquipmentVisualProfileSchema],
	['profile-acceptance.schema.json', EquipmentVisualProfileAcceptanceSchema],
	['target.schema.json', EquipmentImageTargetSchema],
	['assignment.schema.json', EquipmentImageAssignmentSchema],
	['result.schema.json', EquipmentImageResultSchema],
	['armour-source-review-receipt.schema.json', EquipmentArmourSourceReviewReceiptSchema],
	['run-plan.schema.json', EquipmentRunPlanSchema],
	['run-activation.schema.json', EquipmentRunActivationSchema],
	['run-event-request.schema.json', EquipmentRunEventRequestSchema],
	['run-event.schema.json', EquipmentRunEventSchema],
	['run-readiness-report.schema.json', EquipmentRunReadinessReportSchema],
	['run-report.schema.json', EquipmentRunReportSchema]
] as const;

export function buildEquipmentVisualProfile(): EquipmentVisualProfile {
	return EquipmentVisualProfileSchema.parse({
		schemaVersion: 'equipment-visual-profile-v1',
		profileId: 'equipment-material-visual-profile-v1',
		status: 'approval-candidate',
		craftsmanship: {
			grade: 'Standard',
			rankAdjustment: 0
		},
		style: {
			medium: 'premium realistic painterly dark fantasy',
			construction:
				'grounded medieval construction with structurally plausible joins, fastenings, grips, and weight',
			materialResponse:
				'honest surface wear and material response with narrow controlled highlights and restrained local magic',
			lighting: 'cold key light with a restrained warm rim',
			background: 'midnight-charcoal presentation ground with a restrained floor plane'
		},
		isolatedPresentation: {
			mode: 'isolated-item-or-piece',
			subject: 'one-complete-object-or-required-pair',
			composition:
				'neutral three-quarter view with the complete object or required pair entirely inside the safe margin',
			canvas: {
				width: 1024,
				height: 1024,
				mediaType: 'image/png',
				safeMarginPercent: 8
			}
		},
		fullSetPresentation: {
			mode: 'complete-armour-set',
			subject: 'featureless-charcoal-display-form',
			composition:
				'full body visible with exactly Head, Torso, Legs, and Boots readable together inside the safe margin',
			canvas: {
				width: 1024,
				height: 1536,
				mediaType: 'image/png',
				safeMarginPercent: 8
			}
		},
		dependentPiecePresentation: {
			mode: 'dependent-armour-piece',
			subject: 'one-matching-object-or-required-pair',
			composition:
				'isolated matching object or required pair derived from the accepted complete-set reference',
			canvas: {
				width: 1024,
				height: 1024,
				mediaType: 'image/png',
				safeMarginPercent: 8
			},
			continuityRequirements: [
				'material',
				'silhouette-language',
				'palette',
				'trim',
				'fastenings',
				'wear',
				'ornament',
				'slot-boundary'
			]
		},
		equipmentClassDefaults: [
			{ equipmentClass: 'sword', description: 'practical hand-and-a-half straight sword' },
			{ equipmentClass: 'dagger', description: 'compact single-hand fighting dagger' },
			{
				equipmentClass: 'spear',
				description:
					'long two-hand spear with a dominant rank-bearing metal head and subordinate neutral seasoned-wood shaft'
			},
			{ equipmentClass: 'bow', description: 'practical recurved bow' },
			{ equipmentClass: 'axe', description: 'practical one-hand bearded axe' },
			{ equipmentClass: 'mace', description: 'practical one-hand flanged mace' },
			{ equipmentClass: 'shield', description: 'medium heater shield' },
			{
				equipmentClass: 'staff',
				description: 'full-length, wood-led staff with subordinate fittings and no mandatory orb'
			},
			{
				equipmentClass: 'heavy-armour',
				description: 'metal-dominant articulated protection'
			},
			{
				equipmentClass: 'light-armour',
				description: 'hide- or scale-dominant mobile protection'
			},
			{ equipmentClass: 'robes', description: 'cloth-dominant layered clothing' }
		],
		references: [
			{
				path: 'assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png',
				contentHash: '9c726ad578a6a6d8ed510a7e7117443ce471e553d233b36a8c20afedddd1040d',
				purpose:
					'Use only for painterly finish, honest wear, material response, cold key with restrained warm rim, floor, and midnight-charcoal background. Do not transfer Remy, her body, clothing, hammer, or design.'
			}
		],
		negativeConstraints: [
			'no-subject-transfer',
			'no-published-character-resemblance',
			'no-rarity-rainbow',
			'no-gold-inflation',
			'no-full-object-glow',
			'no-oversized-silhouettes',
			'no-ornament-as-material-identity',
			'no-extra-gear',
			'no-text',
			'no-labels',
			'no-ui',
			'no-borders',
			'no-frames',
			'no-logos',
			'no-watermarks'
		]
	});
}

function serializeJson(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

export function serializeEquipmentVisualProfile(): string {
	return serializeJson(buildEquipmentVisualProfile());
}

export function createEquipmentSchemaArtifacts() {
	return schemaDefinitions.map(([filename, schema]) => {
		const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' });
		return {
			path: `${SCHEMA_DIRECTORY}/${filename}`,
			contents: serializeJson({
				...jsonSchema,
				$id: `${JSON_SCHEMA_ID_ROOT}/${filename}`
			})
		};
	});
}
