import { z } from 'zod';

export const STORY_WORKSHOP_BRIEF_VERSION = 'story-workshop-brief-v1' as const;
export const STORY_ARC_PROPOSAL_VERSION = 'story-arc-proposal-v1' as const;
export const STORY_WORKSHOP_MODEL_OUTPUT_VERSION = 'story-workshop-model-output-v1' as const;
export const STORY_WORKSHOP_PROMPT_VERSION = 'story-workshop-prompt-v1' as const;

const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const SemanticVersionSchema = z.string().regex(/^[1-9][0-9]*\.[0-9]+\.[0-9]+$/u);

export const StoryWorkshopNarrativeJobSchema = z.enum([
	'setup',
	'complication',
	'division',
	'consequence',
	'payoff'
]);

export const StoryWorkshopObjectiveKindSchema = z.enum([
	'eliminate-target',
	'survive-duration',
	'protect-entity',
	'recover-item',
	'reach-exit',
	'discover-truth',
	'solve-condition'
]);

export const STORY_WORKSHOP_FLOOR_RHYTHM = [
	'setup',
	'complication',
	'division',
	'consequence',
	'payoff'
] as const;

export const StoryWorkshopForbiddenChangesSchema = z.tuple([
	z.literal('world-laws'),
	z.literal('primary-objective-bypass'),
	z.literal('arena-truth'),
	z.literal('reward-budget'),
	z.literal('required-anchors'),
	z.literal('knowledge-without-holder'),
	z.literal('death-reversal')
]);

export const StoryWorkshopBriefSchema = z
	.object({
		schemaVersion: z.literal(STORY_WORKSHOP_BRIEF_VERSION),
		briefId: SlugSchema,
		briefVersion: SemanticVersionSchema,
		targetBand: z
			.object({
				band: z.number().int().min(1).max(20),
				firstFloor: z.number().int().min(1).max(100),
				lastFloor: z.number().int().min(1).max(100)
			})
			.strict(),
		worldBible: z
			.object({
				laws: z
					.array(
						z
							.object({
								lawId: SlugSchema,
								statement: z.string().trim().min(12).max(360),
								authority: z.enum(['engine', 'content', 'knowledge', 'aftermath', 'extraction'])
							})
							.strict()
					)
					.min(5)
					.max(12),
				openingFacts: z.array(z.string().trim().min(12).max(360)).min(3).max(10),
				unresolvedGoalIds: z.array(SlugSchema).min(1).max(10)
			})
			.strict(),
		mechanicCatalog: z
			.array(
				z
					.object({
						mechanicId: SlugSchema,
						summary: z.string().trim().min(12).max(280),
						productionStatus: z.enum(['available', 'prototype'])
					})
					.strict()
			)
			.min(5)
			.max(20),
		enemyFamily: z
			.object({
				familyId: SlugSchema,
				displayName: z.string().trim().min(2).max(80),
				theme: z.string().trim().min(12).max(280),
				dutyCatalog: z
					.array(
						z
							.object({
								dutyId: SlugSchema,
								summary: z.string().trim().min(12).max(240)
							})
							.strict()
					)
					.min(3)
					.max(12)
			})
			.strict(),
		emotionalQuestion: z.string().trim().min(24).max(360),
		desiredSettlementConsequence: z.string().trim().min(12).max(360),
		rewardBudgetPoints: z.number().int().positive().max(5_000),
		productionConstraints: z
			.object({
				maxNewNamedLocations: z.number().int().min(0).max(12),
				maxNewEnemyPolicies: z.number().int().min(0).max(12),
				permittedObjectiveKinds: z.array(StoryWorkshopObjectiveKindSchema).min(3).max(7),
				floorRhythm: z.tuple([
					z.literal('setup'),
					z.literal('complication'),
					z.literal('division'),
					z.literal('consequence'),
					z.literal('payoff')
				])
			})
			.strict(),
		forbiddenChanges: StoryWorkshopForbiddenChangesSchema
	})
	.strict()
	.superRefine((brief, context) => {
		if (brief.targetBand.lastFloor - brief.targetBand.firstFloor !== 4) {
			context.addIssue({
				code: 'custom',
				path: ['targetBand'],
				message: 'A story workshop brief must cover exactly five consecutive floors'
			});
		}
		if (brief.targetBand.firstFloor !== (brief.targetBand.band - 1) * 5 + 1) {
			context.addIssue({
				code: 'custom',
				path: ['targetBand'],
				message: 'Target floors must match the numbered five-floor band'
			});
		}
		for (const [path, values] of [
			[['worldBible', 'laws'], brief.worldBible.laws.map((law) => law.lawId)],
			[['worldBible', 'unresolvedGoalIds'], brief.worldBible.unresolvedGoalIds],
			[['mechanicCatalog'], brief.mechanicCatalog.map((mechanic) => mechanic.mechanicId)],
			[['enemyFamily', 'dutyCatalog'], brief.enemyFamily.dutyCatalog.map((duty) => duty.dutyId)],
			[
				['productionConstraints', 'permittedObjectiveKinds'],
				brief.productionConstraints.permittedObjectiveKinds
			]
		] as const) {
			if (new Set(values).size !== values.length) {
				context.addIssue({
					code: 'custom',
					path: [...path],
					message: 'Catalog IDs must be unique'
				});
			}
		}
	});

export const StoryArcFloorProposalSchema = z
	.object({
		floor: z.number().int().min(1).max(100),
		floorInBand: z.number().int().min(1).max(5),
		narrativeJob: StoryWorkshopNarrativeJobSchema,
		title: z.string().trim().min(2).max(120),
		narrativeTurn: z.string().trim().min(12).max(360),
		mechanicalJob: z.string().trim().min(12).max(360),
		primaryObjectiveKind: StoryWorkshopObjectiveKindSchema,
		mechanicIds: z.array(SlugSchema).min(1).max(5),
		enemyDutyIds: z.array(SlugSchema).min(1).max(5),
		requiredAnchor: z
			.object({
				anchorId: SlugSchema,
				immutableFact: z.string().trim().min(12).max(360)
			})
			.strict(),
		optionalBeat: z.string().trim().min(12).max(360),
		carryForwardConsequence: z.string().trim().min(12).max(360)
	})
	.strict();

export const StoryArcProposalSchema = z
	.object({
		schemaVersion: z.literal(STORY_ARC_PROPOSAL_VERSION),
		proposalId: SlugSchema,
		proposalVersion: SemanticVersionSchema,
		supersedesProposalId: SlugSchema.nullable(),
		briefId: SlugSchema,
		title: z.string().trim().min(2).max(120),
		thesis: z.string().trim().min(24).max(360),
		logline: z.string().trim().min(24).max(360),
		worldLawIds: z.array(SlugSchema).min(3).max(12),
		emotionalProgression: z.array(z.string().trim().min(8).max(180)).length(5),
		floors: z.array(StoryArcFloorProposalSchema).length(5),
		finaleConstraints: z.array(z.string().trim().min(12).max(280)).length(3),
		settlementConsequence: z.string().trim().min(12).max(360),
		rewardBudgetPoints: z.number().int().positive().max(5_000),
		newNamedLocations: z.array(SlugSchema).max(12),
		newEnemyPolicyIds: z.array(SlugSchema).max(12),
		productionRisks: z.array(z.string().trim().min(12).max(280)).min(2).max(5),
		openQuestions: z.array(z.string().trim().min(12).max(280)).min(2).max(5)
	})
	.strict();

export const StoryWorkshopModelOutputSchema = z
	.object({
		schemaVersion: z.literal(STORY_WORKSHOP_MODEL_OUTPUT_VERSION),
		candidates: z.array(StoryArcProposalSchema).min(2).max(3)
	})
	.strict();

export type StoryWorkshopBrief = z.infer<typeof StoryWorkshopBriefSchema>;
export type StoryArcProposal = z.infer<typeof StoryArcProposalSchema>;
export type StoryWorkshopModelOutput = z.infer<typeof StoryWorkshopModelOutputSchema>;
