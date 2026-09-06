import { z } from 'zod';

import { CombatAttributeNameSchema, LearningDomainSchema } from './capability.js';
import { EntityIdSchema } from './shared.js';

export const CombatRulesVersionSchema = z.literal('combat-rules-v1');
export const AttributeModifierStackingRuleSchema = z.enum([
	'additive-flat',
	'additive-basis-points'
]);

export const AttributeModifierScopeSchema = z.enum([
	'physical-damage',
	'magical-damage',
	'maximum-health',
	'health-regeneration',
	'maximum-mana',
	'mana-regeneration',
	'equipment-load',
	'readiness',
	'movement',
	'evasion'
]);

export const AttributeModifierSourceReceiptSchema = z
	.object({
		receiptId: EntityIdSchema,
		sourceKind: z.enum([
			'equipment',
			'enchantment',
			'food',
			'condition',
			'status',
			'skill',
			'physiology'
		]),
		sourceId: z.string().min(1).max(120)
	})
	.strict();

export const AttributeModifierDurationSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('action') }).strict(),
	z.object({ kind: z.literal('while-source-active') }).strict(),
	z
		.object({ kind: z.literal('until-tick'), expiresAtTick: z.number().int().nonnegative() })
		.strict()
]);

export const AttributeModifierSchema = z
	.object({
		modifierId: EntityIdSchema,
		attribute: CombatAttributeNameSchema,
		scope: AttributeModifierScopeSchema,
		stackingRule: AttributeModifierStackingRuleSchema,
		value: z.number().int().min(-10_000).max(10_000),
		cap: z.number().int().nonnegative().max(10_000),
		duration: AttributeModifierDurationSchema,
		source: AttributeModifierSourceReceiptSchema,
		rulesVersion: CombatRulesVersionSchema
	})
	.strict()
	.superRefine((modifier, context) => {
		if (Math.abs(modifier.value) > modifier.cap) {
			context.addIssue({
				code: 'custom',
				path: ['value'],
				message: 'Attribute modifier value cannot exceed its authored cap'
			});
		}
	});

export const PermanentAttributeReceiptSchema = z
	.object({
		receiptId: EntityIdSchema,
		sourceKind: z.enum(['level-allocation', 'permanent-training', 'migration']),
		sourceId: z.string().min(1).max(120),
		attribute: CombatAttributeNameSchema,
		points: z.number().int().positive().max(100),
		rulesVersion: CombatRulesVersionSchema
	})
	.strict();

export const ResistanceTagSchema = z.enum([
	'cut',
	'pierce',
	'impact',
	'burn',
	'frost',
	'shock',
	'arcane'
]);

export const DamageTagSchema = z.enum(['physical', 'magical', ...ResistanceTagSchema.options]);

export const DamageChannelSchema = z.enum(['physical', 'magical']);

export const ResistanceGrantReceiptSchema = z
	.object({
		grantId: EntityIdSchema,
		tag: ResistanceTagSchema,
		basisPoints: z.number().int().nonnegative().max(10_000),
		stackingRule: z.literal('additive'),
		capBasisPoints: z.number().int().nonnegative().max(10_000),
		source: AttributeModifierSourceReceiptSchema,
		rulesVersion: CombatRulesVersionSchema
	})
	.strict()
	.superRefine((grant, context) => {
		if (grant.basisPoints > grant.capBasisPoints) {
			context.addIssue({
				code: 'custom',
				path: ['basisPoints'],
				message: 'Resistance grant cannot exceed its authored cap'
			});
		}
	});

export const RegenerationContextSchema = z
	.object({
		mode: z.enum(['combat', 'safe-rest']),
		downed: z.boolean(),
		ticksSinceDamage: z.number().int().nonnegative().nullable(),
		injuryRepair: z.boolean()
	})
	.strict();

export const LearningEvidenceSchema = z
	.object({
		evidenceId: EntityIdSchema,
		domain: LearningDomainSchema,
		basePractice: z.number().int().nonnegative(),
		comprehensionHeavy: z.boolean()
	})
	.strict();

const LearningFactorSchema = z.number().int().min(0).max(20_000);

export const LearningContextSchema = z
	.object({
		teachingQualityBasisPoints: LearningFactorSchema,
		facilityQualityBasisPoints: LearningFactorSchema,
		motivationBasisPoints: LearningFactorSchema,
		conditionBasisPoints: LearningFactorSchema,
		varietyBasisPoints: LearningFactorSchema,
		repetitionDecayBasisPoints: LearningFactorSchema.max(10_000)
	})
	.strict();

export const LearningGainReceiptSchema = z
	.object({
		evidenceId: EntityIdSchema,
		domain: LearningEvidenceSchema.shape.domain,
		basePractice: z.number().int().nonnegative(),
		comprehensionHeavy: z.boolean(),
		cognitiveFactorBasisPoints: z.number().int().positive(),
		domainAptitudeFactorBasisPoints: z.number().int().positive(),
		context: LearningContextSchema,
		gainedPractice: z.number().int().nonnegative(),
		rulesVersion: CombatRulesVersionSchema
	})
	.strict();

const BasisPointsSchema = z.number().int().min(0).max(10_000);

export const CombatRulesV1Schema = z
	.object({
		rulesVersion: CombatRulesVersionSchema,
		attributes: z
			.object({
				intrinsicMinimum: z.number().int().positive(),
				intrinsicMaximum: z.number().int().positive(),
				effectiveMinimum: z.number().int().nonnegative(),
				effectiveMaximum: z.number().int().positive(),
				modifierStackingOrder: z
					.tuple([AttributeModifierStackingRuleSchema, AttributeModifierStackingRuleSchema])
					.refine((order) => new Set(order).size === order.length, {
						message: 'Modifier stacking order must contain each rule exactly once'
					})
			})
			.strict(),
		damage: z
			.object({
				physicalBasisPointsPerMight: z.number().int().nonnegative().max(10_000),
				magicalBasisPointsPerSpirit: z.number().int().nonnegative().max(10_000)
			})
			.strict(),
		health: z
			.object({
				baseMaximum: z.number().int().positive(),
				perVitality: z.number().int().nonnegative(),
				safeRestRegenerationBase: z.number().int().nonnegative(),
				safeRestRegenerationVitalityDivisor: z.number().int().positive(),
				combatRegenerationDelayTicks: z.number().int().nonnegative(),
				combatRecoveryBasisPoints: BasisPointsSchema
			})
			.strict(),
		mana: z
			.object({
				baseMaximum: z.number().int().positive(),
				perSpirit: z.number().int().nonnegative(),
				regenerationBase: z.number().int().nonnegative(),
				regenerationSpiritBonus: z.number().int().nonnegative(),
				regenerationSaturationConstant: z.number().int().positive(),
				combatRecoveryBasisPoints: BasisPointsSchema
			})
			.strict(),
		armour: z.object({ curveConstant: z.number().int().positive() }).strict(),
		resistance: z.object({ capBasisPoints: BasisPointsSchema }).strict(),
		learning: z
			.object({
				cognitiveMinimumBasisPoints: z.number().int().min(9_000).max(11_000),
				cognitiveMaximumBasisPoints: z.number().int().min(9_000).max(11_000),
				domainMinimumBasisPoints: z.number().int().positive().max(20_000),
				domainMaximumBasisPoints: z.number().int().positive().max(20_000)
			})
			.strict(),
		affinity: z.object({ contributionNudgeCapBasisPoints: BasisPointsSchema.max(1_000) }).strict()
	})
	.strict()
	.superRefine((rules, context) => {
		const { attributes, learning } = rules;
		if (attributes.intrinsicMinimum > attributes.intrinsicMaximum) {
			context.addIssue({ code: 'custom', path: ['attributes'], message: 'Invalid intrinsic band' });
		}
		if (
			attributes.effectiveMinimum > attributes.intrinsicMinimum ||
			attributes.effectiveMaximum < attributes.intrinsicMaximum
		) {
			context.addIssue({
				code: 'custom',
				path: ['attributes'],
				message: 'Effective attribute band must contain the intrinsic band'
			});
		}
		if (learning.cognitiveMinimumBasisPoints > learning.cognitiveMaximumBasisPoints) {
			context.addIssue({
				code: 'custom',
				path: ['learning'],
				message: 'Invalid cognitive factor band'
			});
		}
		if (learning.domainMinimumBasisPoints > learning.domainMaximumBasisPoints) {
			context.addIssue({
				code: 'custom',
				path: ['learning'],
				message: 'Invalid domain aptitude band'
			});
		}
	});

export type AttributeModifier = z.infer<typeof AttributeModifierSchema>;
export type AttributeModifierScope = z.infer<typeof AttributeModifierScopeSchema>;
type DeepReadonly<T> = T extends readonly unknown[]
	? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
	: T extends object
		? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
		: T;
export type CombatRulesV1 = DeepReadonly<z.infer<typeof CombatRulesV1Schema>>;
export type DamageChannel = z.infer<typeof DamageChannelSchema>;
export type DamageTag = z.infer<typeof DamageTagSchema>;
export type LearningContext = z.infer<typeof LearningContextSchema>;
export type LearningEvidence = z.infer<typeof LearningEvidenceSchema>;
export type LearningGainReceipt = z.infer<typeof LearningGainReceiptSchema>;
export type PermanentAttributeReceipt = z.infer<typeof PermanentAttributeReceiptSchema>;
export type RegenerationContext = z.infer<typeof RegenerationContextSchema>;
export type ResistanceGrantReceipt = z.infer<typeof ResistanceGrantReceiptSchema>;
export type ResistanceTag = z.infer<typeof ResistanceTagSchema>;
