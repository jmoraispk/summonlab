import { z } from 'zod';

import {
	EQUIPMENT_V2_PRODUCTION_ID,
	EQUIPMENT_V2_PRODUCTION_ROOT
} from './equipment-material-production-v2.js';

export const EQUIPMENT_V2_VISUAL_PROFILE_PATH =
	`${EQUIPMENT_V2_PRODUCTION_ROOT}/visual-profile/profile.json` as const;
export const EQUIPMENT_V2_VISUAL_PROFILE_SCHEMA_PATH =
	`${EQUIPMENT_V2_PRODUCTION_ROOT}/visual-profile/profile.schema.json` as const;

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const RepositoryPathSchema = z
	.string()
	.min(1)
	.max(500)
	.refine((value) => !value.startsWith('/') && !value.includes('\\'), {
		message: 'Expected a repository-relative POSIX path'
	})
	.refine(
		(value) =>
			value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..'),
		{ message: 'Repository paths cannot contain empty, current, or parent-directory segments' }
	);
const NonEmptyTextSchema = z.string().trim().min(1).max(2_000);
const EquipmentClassSchema = z.enum([
	'sword',
	'dagger',
	'spear',
	'bow',
	'axe',
	'mace',
	'shield',
	'staff',
	'heavy-armour',
	'light-armour',
	'robes'
]);

const FramingSchema = z
	.object({
		compositionTargetPercent: z.literal(8),
		hardMinimumPercent: z.literal(5),
		priority: z.literal('pose-consistency-over-margin-above-hard-minimum')
	})
	.strict()
	.refine(({ compositionTargetPercent, hardMinimumPercent }) => {
		return hardMinimumPercent <= compositionTargetPercent;
	}, 'Hard framing minimum cannot exceed the composition target');

const ReferenceSchema = z
	.object({
		referenceId: z.string().regex(/^[a-z][a-z0-9-]{1,119}$/u),
		path: RepositoryPathSchema,
		contentHash: HashSchema,
		usage: z.enum(['style-only', 'pose-only', 'camera-and-display-only']),
		appliesTo: z
			.object({
				presentationModes: z
					.array(z.enum(['isolated-item', 'complete-armour-set', 'dependent-armour-piece']))
					.min(1)
					.max(3),
				artifactRoles: z
					.array(z.enum(['item', 'set-source']))
					.min(1)
					.max(2)
			})
			.strict(),
		purpose: NonEmptyTextSchema
	})
	.strict();

const EquipmentClassDefaultSchema = z
	.object({
		equipmentClass: EquipmentClassSchema,
		description: NonEmptyTextSchema,
		anchorReferenceId: z.string().regex(/^[a-z][a-z0-9-]{1,119}$/u),
		pose: NonEmptyTextSchema,
		proportionRules: z.array(NonEmptyTextSchema).min(1).max(8)
	})
	.strict();

export const EquipmentVisualProfileV2Schema = z
	.object({
		schemaVersion: z.literal('equipment-visual-profile-v2'),
		profileId: z.literal('equipment-material-visual-profile-v2'),
		productionId: z.literal(EQUIPMENT_V2_PRODUCTION_ID),
		status: z.literal('approval-candidate'),
		runnerCompatibility: z.literal('planning-only-requires-v2-execution-contract'),
		validation: z
			.object({
				jsonSchemaScope: z.literal('structural-only'),
				semanticValidator: z.literal('EquipmentVisualProfileV2Schema.parse'),
				semanticValidationRequiredForAcceptance: z.literal(true)
			})
			.strict(),
		craftsmanship: z
			.object({ grade: z.literal('Standard'), rankAdjustment: z.literal(0) })
			.strict(),
		reviewLanguage: z
			.object({
				candidate: z.literal('Pass'),
				revise: z.literal('Check'),
				failed: z.literal('No image')
			})
			.strict(),
		style: z
			.object({
				medium: NonEmptyTextSchema,
				construction: NonEmptyTextSchema,
				materialResponse: NonEmptyTextSchema,
				lighting: NonEmptyTextSchema,
				background: NonEmptyTextSchema
			})
			.strict(),
		framing: FramingSchema,
		isolatedPresentation: z
			.object({
				mode: z.literal('isolated-item-or-piece'),
				subject: z.literal('one-complete-object-or-required-pair'),
				canvas: z
					.object({
						width: z.literal(1024),
						height: z.literal(1024),
						mediaType: z.literal('image/png')
					})
					.strict(),
				consistencyLock: z.tuple([
					z.literal('camera'),
					z.literal('pivot'),
					z.literal('normalized-scale'),
					z.literal('presentation-angle')
				]),
				commonPose: NonEmptyTextSchema
			})
			.strict(),
		fullSetPresentation: z
			.object({
				mode: z.literal('complete-armour-set'),
				subject: z.literal('empty-self-supporting-armour-set'),
				canvas: z
					.object({
						width: z.literal(1024),
						height: z.literal(1536),
						mediaType: z.literal('image/png')
					})
					.strict(),
				anchorReferenceId: z.literal('coarse-hide-armour-camera'),
				composition: NonEmptyTextSchema,
				interior: z.literal('natural-interior-cavity-shadow-only'),
				requiredComponents: z.tuple([
					z.literal('Head'),
					z.literal('Torso'),
					z.literal('Legs'),
					z.literal('Boots')
				])
			})
			.strict(),
		dependentPiecePresentation: z
			.object({
				mode: z.literal('dependent-armour-piece'),
				subject: z.literal('one-matching-object-or-required-pair'),
				canvas: z
					.object({
						width: z.literal(1024),
						height: z.literal(1024),
						mediaType: z.literal('image/png')
					})
					.strict(),
				composition: NonEmptyTextSchema,
				acceptedFullSetSourceMustBeFirstReference: z.literal(true),
				additionalReferenceIds: z.tuple([z.literal('remy-finish-style')]),
				continuityRequirements: z.array(NonEmptyTextSchema).min(1).max(20)
			})
			.strict(),
		equipmentClassDefaults: z.array(EquipmentClassDefaultSchema).length(11),
		references: z.array(ReferenceSchema).length(10),
		negativeConstraints: z
			.array(z.string().regex(/^[a-z][a-z0-9-]{1,119}$/u))
			.min(1)
			.max(50)
	})
	.strict()
	.superRefine((profile, context) => {
		const classIds = profile.equipmentClassDefaults.map(({ equipmentClass }) => equipmentClass);
		if (new Set(classIds).size !== classIds.length) {
			context.addIssue({
				code: 'custom',
				message: 'Every Equipment class must have one v2 default'
			});
		}
		const referenceIds = profile.references.map(({ referenceId }) => referenceId);
		if (new Set(referenceIds).size !== referenceIds.length) {
			context.addIssue({ code: 'custom', message: 'V2 reference IDs must be unique' });
		}
		const referenceById = new Map(
			profile.references.map((reference) => [reference.referenceId, reference] as const)
		);
		for (const classDefault of profile.equipmentClassDefaults) {
			const reference = referenceById.get(classDefault.anchorReferenceId);
			if (reference === undefined) {
				context.addIssue({
					code: 'custom',
					message: `Missing anchor ${classDefault.anchorReferenceId} for ${classDefault.equipmentClass}`
				});
			} else {
				const armourClass = ['heavy-armour', 'light-armour', 'robes'].includes(
					classDefault.equipmentClass
				);
				const expectedUsage = armourClass ? 'camera-and-display-only' : 'pose-only';
				if (reference.usage !== expectedUsage) {
					context.addIssue({
						code: 'custom',
						message: `${classDefault.equipmentClass} anchor must use ${expectedUsage}`
					});
				}
				const expectedMode = armourClass ? 'complete-armour-set' : 'isolated-item';
				const expectedRole = armourClass ? 'set-source' : 'item';
				if (
					reference.appliesTo.presentationModes.length !== 1 ||
					reference.appliesTo.presentationModes[0] !== expectedMode ||
					reference.appliesTo.artifactRoles.length !== 1 ||
					reference.appliesTo.artifactRoles[0] !== expectedRole
				) {
					context.addIssue({
						code: 'custom',
						message: `${classDefault.equipmentClass} anchor has the wrong presentation scope`
					});
				}
			}
		}
		const fullSetAnchor = referenceById.get(profile.fullSetPresentation.anchorReferenceId);
		if (fullSetAnchor === undefined) {
			context.addIssue({ code: 'custom', message: 'The full-set camera anchor is missing' });
		} else if (fullSetAnchor.usage !== 'camera-and-display-only') {
			context.addIssue({
				code: 'custom',
				message: 'The full-set camera anchor must use camera-and-display-only'
			});
		} else if (
			fullSetAnchor.appliesTo.presentationModes.length !== 1 ||
			fullSetAnchor.appliesTo.presentationModes[0] !== 'complete-armour-set' ||
			fullSetAnchor.appliesTo.artifactRoles.length !== 1 ||
			fullSetAnchor.appliesTo.artifactRoles[0] !== 'set-source'
		) {
			context.addIssue({ code: 'custom', message: 'The full-set camera anchor scope is invalid' });
		}
		const styleReference = referenceById.get('remy-finish-style');
		if (styleReference === undefined || styleReference.usage !== 'style-only') {
			context.addIssue({ code: 'custom', message: 'The v2 style-only reference is missing' });
		} else if (
			!styleReference.appliesTo.presentationModes.includes('dependent-armour-piece') ||
			!styleReference.appliesTo.artifactRoles.includes('item')
		) {
			context.addIssue({
				code: 'custom',
				message: 'The style reference must remain available to dependent Armour pieces'
			});
		}
		const axe = profile.equipmentClassDefaults.find(
			({ equipmentClass }) => equipmentClass === 'axe'
		);
		if (
			axe === undefined ||
			!axe.description.includes('single-bit') ||
			axe.description.includes('double-bit')
		) {
			context.addIssue({
				code: 'custom',
				message: 'The primary v2 Axe must be standard single-bit'
			});
		}
	});

const references = [
	{
		referenceId: 'remy-finish-style',
		path: 'assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png',
		contentHash: '9c726ad578a6a6d8ed510a7e7117443ce471e553d233b36a8c20afedddd1040d',
		usage: 'style-only',
		appliesTo: {
			presentationModes: ['isolated-item', 'complete-armour-set', 'dependent-armour-piece'],
			artifactRoles: ['item', 'set-source']
		},
		purpose:
			'Painterly finish, honest wear, material response, cold key, restrained warm rim, floor, and midnight-charcoal background only; do not transfer Remy or her design.'
	},
	{
		referenceId: 'sword-pose',
		path: 'assets/equipment/experiments/material-equipment-v1/candidates/f/copper/sword-v1.png',
		contentHash: '3e19745a17220da67b227413499fa635cfdecb39b5c3d5ded164094a9d4aa437',
		usage: 'pose-only',
		appliesTo: { presentationModes: ['isolated-item'], artifactRoles: ['item'] },
		purpose:
			'Sword camera, pivot, facing, and right-leaning diagonal only; re-scale to the v2 framing target and do not transfer Copper material, design, or old framing.'
	},
	{
		referenceId: 'dagger-pose',
		path: 'assets/equipment/experiments/material-equipment-v1/candidates/f/copper/dagger-v1.png',
		contentHash: '8771e23891f87323130ce2aecda5dffaa98b7308055ac9c744623d784d93dbfe',
		usage: 'pose-only',
		appliesTo: { presentationModes: ['isolated-item'], artifactRoles: ['item'] },
		purpose:
			'Dagger upright pose, pivot, facing, and diagonal only; re-scale to the v2 framing target and do not transfer Copper material, design, or old framing.'
	},
	{
		referenceId: 'spear-pose',
		path: 'assets/equipment/experiments/material-equipment-v1/candidates/e/iron/spear-v1.png',
		contentHash: '15e1d942b8760bb269a4a70074008a7be2999636c354fb802f15bd962a99f6b6',
		usage: 'pose-only',
		appliesTo: { presentationModes: ['isolated-item'], artifactRoles: ['item'] },
		purpose:
			'Spear camera, facing, long diagonal, pivot, and head-to-shaft proportion only; re-scale to the v2 framing target and do not transfer Iron material, design, or old framing.'
	},
	{
		referenceId: 'bow-pose',
		path: 'assets/equipment/experiments/material-equipment-v1/candidates/f/ash/bow-v1.png',
		contentHash: '79dc8ac9bda5d078773465cddb076bb177292e88db1e608bff19e547974f7eb2',
		usage: 'pose-only',
		appliesTo: { presentationModes: ['isolated-item'], artifactRoles: ['item'] },
		purpose:
			'Bow facing, pivot, cant, and draw profile only; keep stave frame-left and string frame-right, and re-scale to the v2 framing target instead of copying old occupancy.'
	},
	{
		referenceId: 'axe-pose',
		path: 'assets/equipment/experiments/material-equipment-v1/candidates/f/copper/axe-v1.png',
		contentHash: 'c522fbf1b24093b490252d5fa900f1ea452b5c132d1fb129ed790839defa0d6d',
		usage: 'pose-only',
		appliesTo: { presentationModes: ['isolated-item'], artifactRoles: ['item'] },
		purpose:
			'Axe upright-on-end pivot, facing, and slight right diagonal only; re-scale to the v2 framing target and do not transfer Copper material, ornament, or old framing.'
	},
	{
		referenceId: 'mace-pose',
		path: 'assets/equipment/experiments/material-equipment-v1/candidates/e/iron/mace-v1.png',
		contentHash: '286e4dd52cf4205ecdcd9949f6d677ed93eb4fd7b0c33041dc6baec1cb86551d',
		usage: 'pose-only',
		appliesTo: { presentationModes: ['isolated-item'], artifactRoles: ['item'] },
		purpose:
			'Mace upright-on-end pivot, facing, and right diagonal only; lengthen the haft, keep a compact head, and re-scale to the v2 framing target instead of copying proportions or old framing.'
	},
	{
		referenceId: 'shield-pose',
		path: 'assets/equipment/experiments/material-equipment-v1/candidates/f/copper/shield-v1.png',
		contentHash: 'b3c53ca726dacb121c3b75c82957b3c7a5dcdd4dcf272e60d413ebcf2df1b018',
		usage: 'pose-only',
		appliesTo: { presentationModes: ['isolated-item'], artifactRoles: ['item'] },
		purpose:
			'Heater-shield camera, upright pivot, facing, and three-quarter presentation only; re-scale to the v2 framing target instead of copying old occupancy.'
	},
	{
		referenceId: 'staff-pose',
		path: 'assets/equipment/experiments/material-equipment-v1/candidates/c/heartwood/staff-v1.png',
		contentHash: 'ed773449d4adac0b87531c9ed1c5d4f62e3a03518becb3a7e56137be2ca81fab',
		usage: 'pose-only',
		appliesTo: { presentationModes: ['isolated-item'], artifactRoles: ['item'] },
		purpose:
			'Staff upright-on-end pivot, facing, and gentle right lean only; re-scale to the v2 framing target and do not transfer Heartwood material, crown design, or old framing.'
	},
	{
		referenceId: 'coarse-hide-armour-camera',
		path: 'assets/equipment/experiments/material-equipment-v1/candidates/f/coarse-hide/light-armour-full-set-v1.png',
		contentHash: 'b3b973ffa5eec4fb7f0125202b16b845cd271feec5c5d1351ebd55bfb7fef247',
		usage: 'camera-and-display-only',
		appliesTo: { presentationModes: ['complete-armour-set'], artifactRoles: ['set-source'] },
		purpose:
			'Full-set facing, mild three-quarter camera, stance, pivot, and camera height only; re-scale to the v2 framing target. Do not copy its support form, body impression, hood void, interior treatment, material, garment design, or old framing.'
	}
] as const;

export function buildEquipmentVisualProfileV2() {
	return EquipmentVisualProfileV2Schema.parse({
		schemaVersion: 'equipment-visual-profile-v2',
		profileId: 'equipment-material-visual-profile-v2',
		productionId: EQUIPMENT_V2_PRODUCTION_ID,
		status: 'approval-candidate',
		runnerCompatibility: 'planning-only-requires-v2-execution-contract',
		validation: {
			jsonSchemaScope: 'structural-only',
			semanticValidator: 'EquipmentVisualProfileV2Schema.parse',
			semanticValidationRequiredForAcceptance: true
		},
		craftsmanship: { grade: 'Standard', rankAdjustment: 0 },
		reviewLanguage: { candidate: 'Pass', revise: 'Check', failed: 'No image' },
		style: {
			medium: 'premium realistic painterly dark fantasy',
			construction:
				'grounded medieval construction with structurally plausible joins, fastenings, grips, coverage, balance, and weight',
			materialResponse:
				'honest surface wear and material response with one or two physical construction cues; palette alone never establishes material identity; allow at most one bounded supernatural behaviour when the material requires it; secondary materials remain neutral, subordinate, and non-rank-bearing',
			lighting: 'cold key light with a restrained warm rim',
			background: 'midnight-charcoal presentation ground with a restrained floor plane'
		},
		framing: {
			compositionTargetPercent: 8,
			hardMinimumPercent: 5,
			priority: 'pose-consistency-over-margin-above-hard-minimum'
		},
		isolatedPresentation: {
			mode: 'isolated-item-or-piece',
			subject: 'one-complete-object-or-required-pair',
			canvas: { width: 1024, height: 1024, mediaType: 'image/png' },
			consistencyLock: ['camera', 'pivot', 'normalized-scale', 'presentation-angle'],
			commonPose:
				'Use the class anchor for angle, pivot, facing, and camera. Re-scale toward the 8% composition target and never below the 5% hard minimum; establish that corrected occupancy consistently across the class. Present the item upright or on-end; never lie it flat on the floor plane and never mirror the anchor.'
		},
		fullSetPresentation: {
			mode: 'complete-armour-set',
			subject: 'empty-self-supporting-armour-set',
			canvas: { width: 1024, height: 1536, mediaType: 'image/png' },
			anchorReferenceId: 'coarse-hide-armour-camera',
			composition:
				'Full body in a mild three-quarter front view, approximately 15 degrees toward frame-left. Match the anchor facing, stance, pivot, and camera height, then re-scale toward the 8% composition target without crossing the 5% hard minimum. Exactly Head, Torso, Legs, and paired Boots must be readable together.',
			interior: 'natural-interior-cavity-shadow-only',
			requiredComponents: ['Head', 'Torso', 'Legs', 'Boots']
		},
		dependentPiecePresentation: {
			mode: 'dependent-armour-piece',
			subject: 'one-matching-object-or-required-pair',
			canvas: { width: 1024, height: 1024, mediaType: 'image/png' },
			composition:
				'Isolate the exact accepted component without redesign. Legs means the complete lower-body item or required pair; Boots means one matching pair.',
			acceptedFullSetSourceMustBeFirstReference: true,
			additionalReferenceIds: ['remy-finish-style'],
			continuityRequirements: [
				'material',
				'silhouette language',
				'palette',
				'trim',
				'fastenings',
				'wear',
				'ornament',
				'slot boundary'
			]
		},
		equipmentClassDefaults: [
			{
				equipmentClass: 'sword',
				description: 'practical hand-and-a-half straight sword',
				anchorReferenceId: 'sword-pose',
				pose: 'tip planted near lower-left-of-centre, grip upper-right, approximately 20 to 25 degrees right lean',
				proportionRules: [
					'comparable blade-to-frame length at every rank',
					'blade must not read as a short sword'
				]
			},
			{
				equipmentClass: 'dagger',
				description: 'compact single-hand fighting dagger',
				anchorReferenceId: 'dagger-pose',
				pose: 'point low, grip high, upright with a moderate right diagonal',
				proportionRules: ['compact weapon proportions', 'never horizontal or lying on the floor']
			},
			{
				equipmentClass: 'spear',
				description:
					'long two-hand spear with a metal rank-bearing head and subordinate neutral wood shaft',
				anchorReferenceId: 'spear-pose',
				pose: 'butt lower-left, head upper-right, long consistent diagonal',
				proportionRules: [
					'compact practical head',
					'consistent head-to-shaft proportion at every rank'
				]
			},
			{
				equipmentClass: 'bow',
				description: 'practical recurved bow',
				anchorReferenceId: 'bow-pose',
				pose: 'lower limb near lower centre, stave frame-left, string frame-right',
				proportionRules: [
					'same cant, draw profile, and normalized height at every rank',
					'never mirror the anchor'
				]
			},
			{
				equipmentClass: 'axe',
				description: 'standard practical single-bit one-hand bearded axe',
				anchorReferenceId: 'axe-pose',
				pose: 'butt standing near lower-left-of-centre, head upper-right, approximately 10 to 15 degrees right lean',
				proportionRules: [
					'single-bit primary silhouette',
					'double-bit war axe deferred to a later variant'
				]
			},
			{
				equipmentClass: 'mace',
				description: 'practical long-hafted one-hand flanged mace',
				anchorReferenceId: 'mace-pose',
				pose: 'pommel near lower-centre-left, head upper-right, approximately 10 to 20 degrees right lean',
				proportionRules: [
					'total length approximately 70 to 80 percent of Sword',
					'compact head approximately 20 to 25 percent of mace length'
				]
			},
			{
				equipmentClass: 'shield',
				description: 'medium heater shield',
				anchorReferenceId: 'shield-pose',
				pose: 'upright, centred, consistent three-quarter presentation',
				proportionRules: [
					'retain the tapered heater-shield family',
					'no rank-driven shield subtype change'
				]
			},
			{
				equipmentClass: 'staff',
				description: 'full-length wood-led staff with subordinate fittings and no mandatory orb',
				anchorReferenceId: 'staff-pose',
				pose: 'butt lower-left-of-centre, crown upper-right, gentle right lean',
				proportionRules: [
					'leading crown or branch follows the shaft gesture',
					'no separate dominant upright branch'
				]
			},
			{
				equipmentClass: 'heavy-armour',
				description: 'metal-dominant broad articulated protection',
				anchorReferenceId: 'coarse-hide-armour-camera',
				pose: 'match the full-set camera and empty display anchor',
				proportionRules: ['broad protective silhouette', 'exactly four readable components']
			},
			{
				equipmentClass: 'light-armour',
				description: 'hide- or scale-dominant mobile protection',
				anchorReferenceId: 'coarse-hide-armour-camera',
				pose: 'match the full-set camera and empty display anchor',
				proportionRules: ['mobile close-fitting silhouette', 'must not read as Heavy Armour']
			},
			{
				equipmentClass: 'robes',
				description: 'cloth-dominant layered clothing',
				anchorReferenceId: 'coarse-hide-armour-camera',
				pose: 'match the full-set camera and empty display anchor',
				proportionRules: ['soft draped silhouette', 'exactly four readable components']
			}
		],
		references,
		negativeConstraints: [
			'no-subject-transfer',
			'no-published-character-resemblance',
			'no-visible-body',
			'no-visible-mannequin',
			'no-black-void-figure',
			'no-horizontal-floor-pose',
			'no-mirrored-class-pose',
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

export function serializeEquipmentVisualProfileV2(): string {
	return `${JSON.stringify(buildEquipmentVisualProfileV2(), null, '\t')}\n`;
}

export function serializeEquipmentVisualProfileSchemaV2(): string {
	return `${JSON.stringify(
		{
			...z.toJSONSchema(EquipmentVisualProfileV2Schema, { target: 'draft-2020-12' }),
			$id: 'https://summonlab.local/schemas/equipment/profile-v2.schema.json',
			$comment:
				'Structural validation only. Approval also requires EquipmentVisualProfileV2Schema.parse so repository-path, reference-binding, class-completeness, and primary-Axe semantic invariants run.'
		},
		null,
		'\t'
	)}\n`;
}
