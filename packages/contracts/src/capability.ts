import { z } from 'zod';

export const CombatAttributeNameSchema = z.enum(['might', 'vitality', 'agility', 'spirit']);

export const CombatAttributesSchema = z
	.object({
		might: z.number().int().min(1).max(100),
		vitality: z.number().int().min(1).max(100),
		agility: z.number().int().min(1).max(100),
		spirit: z.number().int().min(1).max(100)
	})
	.strict();

export const LearningDomainSchema = z.enum([
	'martial',
	'magical',
	'crafting',
	'survival',
	'social'
]);

export const CharacterLearningProfileSchema = z
	.object({
		cognitiveLearningScore: z.number().int().min(0).max(100),
		domainAptitudes: z.record(LearningDomainSchema, z.number().int().min(0).max(100))
	})
	.strict();

export const CharacterCapabilityProfileV1Schema = z
	.object({
		profileVersion: z.literal('character-capability-v1'),
		attributes: CombatAttributesSchema,
		learning: CharacterLearningProfileSchema
	})
	.strict();

export type CharacterCapabilityProfileV1 = z.infer<typeof CharacterCapabilityProfileV1Schema>;
export type CharacterLearningProfile = z.infer<typeof CharacterLearningProfileSchema>;
export type CombatAttributeName = z.infer<typeof CombatAttributeNameSchema>;
export type CombatAttributes = z.infer<typeof CombatAttributesSchema>;
export type LearningDomain = z.infer<typeof LearningDomainSchema>;
