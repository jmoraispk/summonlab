import { z } from 'zod';

export const PRODUCTION_AFFINITIES = ['normal', 'fire', 'earth', 'wind', 'water'] as const;
export const FORM_TIERS = ['T1', 'T2', 'T3', 'T4', 'T5'] as const;
export const CURRENT_CLASS_DISPOSITIONS = [
	'map',
	'rename-map',
	'secondary-archetype',
	'fauna',
	'retire'
] as const;
export const FAMILY_AFFINITY_ROOT = 'assets/enemies/experiments/family-affinity-v1' as const;

const ProductionAffinitySchema = z.enum(PRODUCTION_AFFINITIES);
const FormTierSchema = z.enum(FORM_TIERS);
const CurrentClassDispositionSchema = z.enum(CURRENT_CLASS_DISPOSITIONS);
const IdSchema = z.string().regex(/^[a-z][a-z0-9-]*$/u, 'IDs must be lowercase slugs');
const RequiredTextSchema = z.string().trim().min(1, 'Expected non-empty text');

const AffinityThemeSchema = z
	.object({
		constructionDimensions: z.array(RequiredTextSchema).min(2),
		counterplaySignal: RequiredTextSchema,
		forbidden: z.array(RequiredTextSchema).min(1)
	})
	.strict();

export const FamilyFormSchema = z
	.object({
		tier: FormTierSchema,
		formId: IdSchema,
		displayName: RequiredTextSchema,
		primaryArchetype: RequiredTextSchema,
		battlefieldDuty: RequiredTextSchema,
		teachingGoal: RequiredTextSchema,
		signatureMechanic: RequiredTextSchema.nullable(),
		telegraph: RequiredTextSchema.nullable(),
		counterplay: RequiredTextSchema.nullable(),
		visualDelta: RequiredTextSchema,
		lowerFormInteraction: RequiredTextSchema.nullable(),
		sourceReferences: z.array(RequiredTextSchema).min(1)
	})
	.strict()
	.superRefine((form, context) => {
		if (form.tier === 'T3') {
			if (form.signatureMechanic === null) {
				context.addIssue({
					code: 'custom',
					message: 'T3 requires a signature mechanic'
				});
			}
			if (form.telegraph === null) {
				context.addIssue({ code: 'custom', message: 'T3 requires a telegraph' });
			}
			if (form.counterplay === null) {
				context.addIssue({ code: 'custom', message: 'T3 requires counterplay' });
			}
		}

		if (form.tier === 'T5') {
			if (form.signatureMechanic === null) {
				context.addIssue({ code: 'custom', message: 'T5 requires a boss mechanic' });
			}
			if (form.lowerFormInteraction === null) {
				context.addIssue({
					code: 'custom',
					message: 'T5 requires lower-form interaction'
				});
			}
		}
	});

export const FamilyPacketSchema = z
	.object({
		schemaVersion: z.literal('family-packet-v1'),
		familyId: IdSchema,
		displayName: RequiredTextSchema,
		sourceRaceNumber: z.number().int().positive(),
		sourcePage: RequiredTextSchema,
		classificationNotes: RequiredTextSchema,
		visualConstants: z.array(RequiredTextSchema).min(1),
		escalationAxis: RequiredTextSchema,
		floorSlot: z.number().int().positive().nullable(),
		affinityThemes: z.record(ProductionAffinitySchema, AffinityThemeSchema),
		forms: z.array(FamilyFormSchema).length(5, 'Family packets must contain exactly five forms')
	})
	.strict()
	.superRefine((family, context) => {
		const tiers = family.forms.map((form) => form.tier);
		if (new Set(tiers).size !== tiers.length) {
			context.addIssue({ code: 'custom', message: 'Form tiers must be unique within a family' });
		}

		const formIds = family.forms.map((form) => form.formId);
		if (new Set(formIds).size !== formIds.length) {
			context.addIssue({ code: 'custom', message: 'Form IDs must be unique within a family' });
		}
	});

export type FamilyForm = z.infer<typeof FamilyFormSchema>;
export type FamilyPacket = z.infer<typeof FamilyPacketSchema>;

export const CurrentClassMappingEntrySchema = z
	.object({
		currentClassId: IdSchema,
		sourceRoster: RequiredTextSchema,
		sourceFamilyLabel: RequiredTextSchema,
		disposition: CurrentClassDispositionSchema,
		canonicalFamilyId: IdSchema.nullable(),
		canonicalFormId: IdSchema.nullable(),
		rationale: RequiredTextSchema,
		candidateReuseByAffinity: z.record(ProductionAffinitySchema, z.boolean())
	})
	.strict()
	.superRefine((entry, context) => {
		const hasCanonicalIds = entry.canonicalFamilyId !== null && entry.canonicalFormId !== null;
		if (entry.disposition === 'map' || entry.disposition === 'rename-map') {
			if (!hasCanonicalIds) {
				context.addIssue({
					code: 'custom',
					message: `${entry.disposition} entries require canonical family and form IDs`
				});
			}
			return;
		}

		if (entry.canonicalFamilyId !== null || entry.canonicalFormId !== null) {
			context.addIssue({
				code: 'custom',
				message: `${entry.disposition} entries require canonical IDs must be null`
			});
		}
	});

export const CurrentClassMappingFileSchema = z
	.object({
		schemaVersion: z.literal('current-class-mapping-v1'),
		entries: z
			.array(CurrentClassMappingEntrySchema)
			.length(40, 'Current-class mapping files must contain exactly 40 current classes')
	})
	.strict()
	.superRefine((mappingFile, context) => {
		const currentClassIds = mappingFile.entries.map((entry) => entry.currentClassId);
		if (new Set(currentClassIds).size !== currentClassIds.length) {
			context.addIssue({ code: 'custom', message: 'Current class IDs must be unique' });
		}
	});

export type CurrentClassMappingEntry = z.infer<typeof CurrentClassMappingEntrySchema>;
export type CurrentClassMappingFile = z.infer<typeof CurrentClassMappingFileSchema>;
