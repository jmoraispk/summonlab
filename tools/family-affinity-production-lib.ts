import { z } from 'zod';

import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

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
export const FAUNA_FAMILY_ROOT = 'assets/enemies/experiments/fauna-family-v1' as const;
export const FAMILY_PRODUCTION_EXPERIMENT_IDS = ['family-affinity-v1', 'fauna-family-v1'] as const;
export type FamilyProductionExperimentId = (typeof FAMILY_PRODUCTION_EXPERIMENT_IDS)[number];
export const FAMILY_AFFINITY_ACTIVE_SOURCES_PATH =
	`${FAMILY_AFFINITY_ROOT}/active-sources.json` as const;
export const FAMILY_AFFINITY_LEGACY_MAPPING_PATH =
	`${FAMILY_AFFINITY_ROOT}/current-class-mapping.json` as const;
export const CURRENT_CLASS_SOURCE_ROSTER =
	'docs/wiki/creatures/monsters/visual-index.json' as const;

const FormTierSchema = z.enum(FORM_TIERS);
const CurrentClassDispositionSchema = z.enum(CURRENT_CLASS_DISPOSITIONS);
const IdSchema = z.string().regex(/^[a-z][a-z0-9-]*$/u, 'IDs must be lowercase slugs');
const RequiredTextSchema = z.string().trim().min(1, 'Expected non-empty text');
const FamilyProductionSourcePathSchema = z
	.string()
	.regex(/^assets\/enemies\/experiments\/(?:family-affinity-v1|fauna-family-v1)\//u)
	.refine((value) => !value.includes('..'), 'Active source paths cannot traverse directories');
const ActiveSourcePathSchema = z
	.string()
	.regex(/^assets\/enemies\/experiments\/family-affinity-v1\//u)
	.refine((value) => !value.includes('..'), 'Active source paths cannot traverse directories');

const AffinityThemeSchema = z
	.object({
		constructionDimensions: z.array(RequiredTextSchema).min(2),
		counterplaySignal: RequiredTextSchema,
		forbidden: z.array(RequiredTextSchema).min(1)
	})
	.strict();

const AffinityThemeMapSchema = z
	.object({
		normal: AffinityThemeSchema,
		fire: AffinityThemeSchema,
		earth: AffinityThemeSchema,
		wind: AffinityThemeSchema,
		water: AffinityThemeSchema
	})
	.strict();

const CandidateReuseByAffinitySchema = z
	.object({
		normal: z.boolean(),
		fire: z.boolean(),
		earth: z.boolean(),
		wind: z.boolean(),
		water: z.boolean()
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
		packetPath: FamilyProductionSourcePathSchema.optional(),
		familyId: IdSchema,
		displayName: RequiredTextSchema,
		sourceRaceNumber: z.number().int().positive(),
		sourcePage: RequiredTextSchema,
		classificationNotes: RequiredTextSchema,
		visualConstants: z.array(RequiredTextSchema).min(1),
		escalationAxis: RequiredTextSchema,
		floorSlot: z.number().int().positive().nullable(),
		affinityThemes: AffinityThemeMapSchema,
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
		candidateReuseByAffinity: CandidateReuseByAffinitySchema
	})
	.strict()
	.superRefine((entry, context) => {
		if (entry.candidateReuseByAffinity.earth) {
			context.addIssue({ code: 'custom', message: 'Earth candidate reuse must be false' });
		}

		if (
			entry.disposition === 'retire' &&
			Object.values(entry.candidateReuseByAffinity).some(Boolean)
		) {
			context.addIssue({ code: 'custom', message: 'Retire candidate reuse must be false' });
		}

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
				message: `${entry.disposition} entries require canonical IDs to be null`
			});
		}
	});

export const CurrentClassMappingFileSchema = z
	.object({
		schemaVersion: z.literal('current-class-mapping-v1'),
		mappingPath: ActiveSourcePathSchema.optional(),
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

export const FamilyAffinityActiveSourcesSchema = z
	.object({
		schemaVersion: z.literal('family-affinity-active-sources-v1'),
		mappingPath: ActiveSourcePathSchema,
		familyPacketPaths: z.array(ActiveSourcePathSchema).length(30)
	})
	.strict()
	.superRefine((registry, context) => {
		if (new Set(registry.familyPacketPaths).size !== registry.familyPacketPaths.length) {
			context.addIssue({ code: 'custom', message: 'Active family packet paths must be unique' });
		}
	});

export type FamilyAffinityActiveSources = z.infer<typeof FamilyAffinityActiveSourcesSchema>;

export type CurrentClassVisualSource = {
	id: string;
	familyName: string;
	variants: Array<{
		affinity: string;
		candidatePath?: string | null;
		contentHash?: string | null;
	}>;
};

export type CurrentClassMappingAudit = {
	dispositionCounts: Record<(typeof CURRENT_CLASS_DISPOSITIONS)[number], number>;
	retainedBridgeCount: number;
	bridgeOnlyCount: number;
	canonicalPrimaryCount: number;
	uniqueCanonicalClaims: number;
	candidateReuseCounts: Record<(typeof PRODUCTION_AFFINITIES)[number], number>;
	retainedBridgeCurrentClassIds: string[];
	bridgeOnlyCurrentClassIds: string[];
	canonicalPrimaryCurrentClassIds: string[];
};

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u, 'Expected lowercase SHA-256');
const OwnedPathSchema = z
	.string()
	.regex(/^assets\/enemies\/experiments\/(?:family-affinity-v1|fauna-family-v1)\//u)
	.refine((value) => !value.includes('..'), 'Owned paths cannot traverse directories');
const LegacyNormalCandidatePathSchema = z
	.string()
	.regex(
		/^assets\/enemies\/experiments\/(?:affinity-workflow-v1|affinity-expansion-v1)\/candidates\/[a-z][a-z0-9-]*\/normal-v[1-9][0-9]*\.png$/u,
		'Expected an exact retained legacy Normal candidate path'
	);
const AttemptStatusSchema = z.enum([
	'planned',
	'planned-provisional-anchor',
	'blocked-on-anchor',
	'earth-bridge-provisional'
]);
const NamespaceSchema = z.enum(['canonical', 'bridge']);
const FamilyProductionExperimentIdSchema = z.enum(FAMILY_PRODUCTION_EXPERIMENT_IDS);

export function familyProductionRoot(experimentId: FamilyProductionExperimentId): string {
	return experimentId === 'fauna-family-v1' ? FAUNA_FAMILY_ROOT : FAMILY_AFFINITY_ROOT;
}

export function familyProductionTargetExperimentId(target: {
	experimentId?: FamilyProductionExperimentId | undefined;
}): FamilyProductionExperimentId {
	return target.experimentId ?? 'family-affinity-v1';
}

const FamilyAffinityRevisionSemanticOverridesShape = {
	playerFacingName: RequiredTextSchema.optional(),
	primaryArchetype: RequiredTextSchema.optional(),
	battlefieldDuty: RequiredTextSchema.optional(),
	identityInvariants: z.array(RequiredTextSchema).min(1).optional(),
	anatomyInvariants: z.array(RequiredTextSchema).min(1).optional(),
	constructionDimensions: z.array(RequiredTextSchema).min(2).optional(),
	telegraph: RequiredTextSchema.optional(),
	counterplay: RequiredTextSchema.optional(),
	forbiddenTreatments: z.array(RequiredTextSchema).min(1).optional(),
	acceptanceCriteria: z.array(RequiredTextSchema).min(8).optional()
} as const;

const FamilyAffinityRevisionSemanticOverridesSchema = z
	.object(FamilyAffinityRevisionSemanticOverridesShape)
	.strict()
	.refine((overrides) => Object.keys(overrides).length > 0, {
		message: 'Semantic correction requires at least one whitelisted override'
	});

const FamilyAffinityRevisionCorrectionShape = {
	schemaVersion: z.literal('family-affinity-revision-correction-v1'),
	rationale: RequiredTextSchema,
	overrides: FamilyAffinityRevisionSemanticOverridesSchema
} as const;

export const FamilyAffinityRevisionCorrectionSchema = z
	.object(FamilyAffinityRevisionCorrectionShape)
	.strict();

export type FamilyAffinityRevisionCorrection = z.infer<
	typeof FamilyAffinityRevisionCorrectionSchema
>;

const AppliedFamilyAffinityRevisionCorrectionEventShape = {
	...FamilyAffinityRevisionCorrectionShape,
	appliedVersion: z.number().int().positive(),
	precedingTargetId: RequiredTextSchema,
	precedingTargetSha256: Sha256Schema
} as const;

const AppliedFamilyAffinityRevisionCorrectionSchema = z
	.object({
		...AppliedFamilyAffinityRevisionCorrectionEventShape,
		correctionSha256: Sha256Schema
	})
	.strict()
	.superRefine((correction, context) => {
		const { correctionSha256, ...event } = correction;
		if (correctionSha256 !== familyAffinitySha256(event)) {
			context.addIssue({
				code: 'custom',
				message: 'Semantic correction event hash is stale or forged'
			});
		}
	});

export const BridgeIdentityPacketSchema = z
	.object({
		schemaVersion: z.literal('bridge-identity-packet-v1'),
		currentClassId: IdSchema,
		bridgeFamilyId: IdSchema,
		bridgeFormId: IdSchema,
		sourceFamilyLabel: RequiredTextSchema,
		disposition: z.enum(['secondary-archetype', 'fauna']),
		sourceRoster: z.literal(CURRENT_CLASS_SOURCE_ROSTER),
		sourcePage: z.literal('docs/wiki/creatures/monsters/README.md'),
		mappingRationale: RequiredTextSchema,
		sourceNormalTarget: z
			.object({
				path: z
					.string()
					.regex(
						/^assets\/enemies\/experiments\/(?:affinity-workflow-v1|affinity-expansion-v1)\/targets\/[a-z][a-z0-9-]*\/normal(?:-v[1-9][0-9]*)?\.json$/u
					),
				sha256: Sha256Schema
			})
			.strict(),
		normalReference: z
			.object({
				candidatePath: LegacyNormalCandidatePathSchema,
				candidateSha256: Sha256Schema,
				referenceStatus: z.literal('earth-bridge-provisional'),
				legacyResultStatus: z.enum(['candidate', 'revise', 'failed']),
				approvalEvidence: z.literal(false)
			})
			.strict(),
		inferredTier: z
			.object({
				tier: FormTierSchema,
				evidenceField: z.literal('threat.canonicalGrade'),
				evidencePath: RequiredTextSchema,
				evidenceSha256: Sha256Schema
			})
			.strict()
			.nullable(),
		primaryArchetype: RequiredTextSchema,
		battlefieldDuty: RequiredTextSchema,
		identityInvariants: z.array(RequiredTextSchema).min(1),
		anatomyInvariants: z.array(RequiredTextSchema).min(1),
		telegraph: RequiredTextSchema,
		counterplay: RequiredTextSchema,
		signalSupport: z.enum(['source-exact', 'derived-approved']),
		signalEvidence: z
			.array(
				z
					.object({
						path: RequiredTextSchema,
						locator: RequiredTextSchema,
						sha256: Sha256Schema
					})
					.strict()
			)
			.min(1),
		controllerApprovalReference: z
			.literal('root-approved-task10-derived-bridge-signals-2026-09-02')
			.nullable(),
		framing: RequiredTextSchema,
		sourceReferences: z
			.array(
				z
					.object({
						path: RequiredTextSchema,
						purpose: RequiredTextSchema,
						contentHash: Sha256Schema
					})
					.strict()
			)
			.min(1),
		earthTheme: z
			.object({
				constructionDimensions: z.array(RequiredTextSchema).min(2),
				counterplaySignal: RequiredTextSchema,
				forbidden: z.array(RequiredTextSchema).min(1)
			})
			.strict(),
		presentationContract: z
			.object({
				framing: z.literal('full-body-readable'),
				background: z.literal('cinematic-neutral-environment'),
				featuredSubjects: z.literal(1),
				textAllowed: z.literal(false),
				watermarkAllowed: z.literal(false)
			})
			.strict(),
		status: z.enum(['bridge-only', 'blocked-on-identity-decision']),
		identityDecisionRequired: RequiredTextSchema.nullable(),
		runtimeCatalogMutationForbidden: z.literal(true)
	})
	.strict()
	.superRefine((packet, context) => {
		if (
			packet.bridgeFamilyId !==
			`bridge-${packet.sourceFamilyLabel
				.toLowerCase()
				.replace(/[^a-z0-9]+/gu, '-')
				.replace(/^-|-$/gu, '')}`
		) {
			context.addIssue({
				code: 'custom',
				message: 'Bridge family ID must derive from source family label'
			});
		}
		if (packet.bridgeFormId !== packet.currentClassId) {
			context.addIssue({ code: 'custom', message: 'Bridge form ID must equal current class ID' });
		}
		if (
			(packet.status === 'blocked-on-identity-decision') !==
			(packet.identityDecisionRequired !== null)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Blocked bridge packets require an identity decision'
			});
		}
		if (
			(packet.signalSupport === 'derived-approved') !==
			(packet.controllerApprovalReference !== null)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Derived bridge signals require the controller approval reference'
			});
		}
	});

export type BridgeIdentityPacket = z.infer<typeof BridgeIdentityPacketSchema>;

const CanonicalFamilySourceSchema = z
	.object({
		packetKind: z.literal('canonical-family').optional(),
		familyPacketPath: OwnedPathSchema,
		familyPacketSha256: Sha256Schema,
		sourcePage: RequiredTextSchema,
		sourceReferences: z.array(RequiredTextSchema).min(1),
		mappingPath: OwnedPathSchema
	})
	.strict();

const BridgeIdentitySourceSchema = z
	.object({
		packetKind: z.literal('bridge-identity'),
		familyPacketPath: OwnedPathSchema,
		familyPacketSha256: Sha256Schema,
		sourcePage: RequiredTextSchema,
		sourceReferences: z.array(RequiredTextSchema).min(1),
		mappingPath: OwnedPathSchema
	})
	.strict();

export const FamilyAffinityTargetSchema = z
	.object({
		schemaVersion: z.literal('family-affinity-target-v1'),
		experimentId: FamilyProductionExperimentIdSchema.optional(),
		namespace: NamespaceSchema,
		coordinateId: RequiredTextSchema,
		targetId: RequiredTextSchema,
		familyId: IdSchema,
		familyDisplayName: RequiredTextSchema.optional(),
		formId: IdSchema,
		formDisplayName: RequiredTextSchema.optional(),
		currentClassId: IdSchema.nullable(),
		playerFacingName: RequiredTextSchema.optional(),
		canonicalCoordinateId: RequiredTextSchema.optional(),
		affinity: z.enum(PRODUCTION_AFFINITIES),
		tier: z.union([FormTierSchema, z.literal('bridge-only')]),
		primaryArchetype: RequiredTextSchema,
		battlefieldDuty: RequiredTextSchema,
		identityInvariants: z.array(RequiredTextSchema).min(1),
		anatomyInvariants: z.array(RequiredTextSchema).min(1),
		constructionDimensions: z.array(RequiredTextSchema).min(2),
		telegraph: RequiredTextSchema,
		counterplay: RequiredTextSchema,
		forbiddenTreatments: z.array(RequiredTextSchema).min(1),
		sources: z.union([CanonicalFamilySourceSchema, BridgeIdentitySourceSchema]),
		presentationContract: z
			.object({
				framing: z.literal('full-body-readable'),
				background: z.literal('cinematic-neutral-environment'),
				featuredSubjects: z.literal(1),
				textAllowed: z.literal(false),
				watermarkAllowed: z.literal(false)
			})
			.strict(),
		acceptanceCriteria: z.array(RequiredTextSchema).min(8),
		ownedPaths: z
			.object({
				candidate: OwnedPathSchema,
				result: OwnedPathSchema,
				decision: OwnedPathSchema,
				blindReview: OwnedPathSchema
			})
			.strict(),
		anchor: z.discriminatedUnion('kind', [
			z.object({ kind: z.literal('normal-self') }).strict(),
			z
				.object({
					kind: z.literal('normal-verified-candidate'),
					normalCoordinateId: RequiredTextSchema,
					normalVersion: z.number().int().positive(),
					normalTargetPath: OwnedPathSchema,
					normalTargetSha256: Sha256Schema,
					normalCandidatePath: OwnedPathSchema,
					normalCandidateSha256: Sha256Schema,
					normalResultPath: OwnedPathSchema,
					normalResultSha256: Sha256Schema,
					sourcePacketPath: OwnedPathSchema,
					sourcePacketSha256: Sha256Schema,
					humanReviewPending: z.literal(true),
					runtimeCatalogMutationForbidden: z.literal(true)
				})
				.strict(),
			z
				.object({
					kind: z.literal('normal-approved-review'),
					normalCoordinateId: RequiredTextSchema,
					normalVersion: z.number().int().positive(),
					normalTargetPath: OwnedPathSchema,
					normalTargetSha256: Sha256Schema,
					reviewReceiptPath: OwnedPathSchema,
					reviewReceiptSha256: Sha256Schema.nullable(),
					normalCandidatePath: OwnedPathSchema.nullable(),
					normalCandidateSha256: Sha256Schema.nullable(),
					normalResultPath: OwnedPathSchema.nullable(),
					normalResultSha256: Sha256Schema.nullable()
				})
				.strict(),
			z
				.object({
					kind: z.literal('earth-bridge-provisional'),
					normalCandidatePath: z.union([OwnedPathSchema, LegacyNormalCandidatePathSchema]),
					normalCandidateSha256: Sha256Schema
				})
				.strict()
		]),
		precedingAttempt: z
			.object({
				targetId: RequiredTextSchema,
				targetSha256: Sha256Schema,
				candidatePath: OwnedPathSchema,
				candidateSha256: Sha256Schema,
				resultPath: OwnedPathSchema,
				resultSha256: Sha256Schema,
				reviewPath: OwnedPathSchema,
				reviewSha256: Sha256Schema
			})
			.strict()
			.nullable(),
		semanticCorrection: AppliedFamilyAffinityRevisionCorrectionSchema.optional(),
		version: z.number().int().positive(),
		status: AttemptStatusSchema,
		promotionCeiling: z.literal('approved-review'),
		runtimeCatalogMutationForbidden: z.literal(true)
	})
	.strict()
	.superRefine((target, context) => {
		const experimentId = familyProductionTargetExperimentId(target);
		const experimentRoot = `${familyProductionRoot(experimentId)}/`;
		const anchorPaths =
			target.anchor.kind === 'normal-verified-candidate'
				? [
						target.anchor.normalTargetPath,
						target.anchor.normalCandidatePath,
						target.anchor.normalResultPath,
						target.anchor.sourcePacketPath
					]
				: target.anchor.kind === 'normal-approved-review'
					? [
							target.anchor.normalTargetPath,
							target.anchor.reviewReceiptPath,
							target.anchor.normalCandidatePath,
							target.anchor.normalResultPath
						]
					: [];
		const precedingPaths =
			target.precedingAttempt === null
				? []
				: [
						target.precedingAttempt.candidatePath,
						target.precedingAttempt.resultPath,
						target.precedingAttempt.reviewPath
					];
		const experimentPaths = [
			target.sources.familyPacketPath,
			target.sources.mappingPath,
			...Object.values(target.ownedPaths),
			...anchorPaths,
			...precedingPaths
		];
		if (experimentPaths.some((path) => path !== null && !path.startsWith(experimentRoot))) {
			context.addIssue({
				code: 'custom',
				message: `Target paths must stay under the ${experimentId} root`
			});
		}
		if (experimentId === 'fauna-family-v1' && target.namespace !== 'canonical') {
			context.addIssue({
				code: 'custom',
				message: 'Fauna family production supports canonical targets only'
			});
		}
		if (
			experimentId === 'fauna-family-v1' &&
			(target.familyDisplayName === undefined || target.formDisplayName === undefined)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Fauna targets require family and form display identities'
			});
		}
		const correction = target.semanticCorrection;
		if (
			target.playerFacingName !== undefined &&
			(correction === undefined ||
				correction.overrides.playerFacingName !== target.playerFacingName)
		) {
			context.addIssue({
				code: 'custom',
				message:
					'Player-facing name requires an equal, explicit override in its hash-bound semantic correction'
			});
		}
		if (correction !== undefined) {
			if (target.namespace !== 'bridge') {
				context.addIssue({
					code: 'custom',
					message: 'Semantic corrections are restricted to bridge revision targets'
				});
			}
			if (target.version < correction.appliedVersion) {
				context.addIssue({
					code: 'custom',
					message: 'Semantic correction cannot postdate its target version'
				});
			}
			const expectedPrecedingTargetId = `${target.namespace}/${target.coordinateId}/v${correction.appliedVersion - 1}`;
			if (
				correction.appliedVersion <= 1 ||
				correction.precedingTargetId !== expectedPrecedingTargetId
			) {
				context.addIssue({
					code: 'custom',
					message: 'Semantic correction must bind the immediately preceding target identity'
				});
			}
			if (
				target.version === correction.appliedVersion &&
				(target.precedingAttempt === null ||
					target.precedingAttempt.targetId !== correction.precedingTargetId ||
					target.precedingAttempt.targetSha256 !== correction.precedingTargetSha256)
			) {
				context.addIssue({
					code: 'custom',
					message: 'Semantic correction predecessor must match immutable attempt provenance'
				});
			}
			for (const [field, value] of Object.entries(correction.overrides)) {
				if (stableJson(target[field as keyof typeof target]) !== stableJson(value)) {
					context.addIssue({
						code: 'custom',
						message: `Semantic correction override was not applied to target field: ${field}`
					});
				}
			}
		}
		if (target.namespace === 'canonical') {
			if (target.canonicalCoordinateId !== undefined) {
				context.addIssue({
					code: 'custom',
					message: 'Canonical targets cannot carry canonicalCoordinateId'
				});
			}
			if (target.tier === 'bridge-only') {
				context.addIssue({ code: 'custom', message: 'Canonical targets require a form tier' });
			}
			if (target.sources.packetKind === 'bridge-identity') {
				context.addIssue({
					code: 'custom',
					message: 'Canonical targets require canonical family sources'
				});
			}
		} else if (target.canonicalCoordinateId !== undefined) {
			if (
				target.canonicalCoordinateId !== `${target.familyId}/${target.formId}/earth` ||
				target.affinity !== 'earth' ||
				target.sources.packetKind === 'bridge-identity' ||
				target.tier === 'bridge-only'
			) {
				context.addIssue({
					code: 'custom',
					message: 'Mapped-primary bridge targets require an exact canonical Earth reference'
				});
			}
		} else {
			if (target.tier !== 'bridge-only' || target.sources.packetKind !== 'bridge-identity') {
				context.addIssue({
					code: 'custom',
					message: 'Bridge-only targets require bridge identity sources and no family tier'
				});
			}
		}
		const expectedCoordinate =
			target.namespace === 'canonical'
				? `${target.familyId}/${target.formId}/${target.affinity}`
				: `${target.currentClassId}/${target.familyId}/${target.formId}/${target.affinity}`;
		if (target.coordinateId !== expectedCoordinate) {
			context.addIssue({
				code: 'custom',
				message: 'Target coordinate fields do not match coordinateId'
			});
		}
		const expectedTargetId =
			experimentId === 'family-affinity-v1'
				? `${target.namespace}/${target.coordinateId}/v${target.version}`
				: `${experimentId}/${target.namespace}/${target.coordinateId}/v${target.version}`;
		if (target.targetId !== expectedTargetId) {
			context.addIssue({
				code: 'custom',
				message: 'Target ID must bind namespace, coordinate, and version'
			});
		}
		if (target.namespace === 'canonical' && target.currentClassId !== null) {
			context.addIssue({
				code: 'custom',
				message: 'Canonical targets cannot carry currentClassId'
			});
		}
		if (target.namespace === 'bridge' && target.currentClassId === null) {
			context.addIssue({ code: 'custom', message: 'Bridge targets require currentClassId' });
		}
		if (target.namespace === 'bridge' && target.currentClassId !== null) {
			const paths = bridgeAttemptPaths(target.currentClassId, target.affinity, target.version);
			if (
				target.ownedPaths.candidate !== paths.candidate ||
				target.ownedPaths.result !== paths.result ||
				target.ownedPaths.decision !== paths.decision ||
				target.ownedPaths.blindReview !== paths.blindReview
			) {
				context.addIssue({ code: 'custom', message: 'Bridge target owned paths must be exact' });
			}
		}
		if (target.namespace === 'canonical') {
			const paths = canonicalAttemptPaths(
				target.familyId,
				target.formId,
				target.affinity,
				target.version,
				experimentId
			);
			if (
				target.ownedPaths.candidate !== paths.candidate ||
				target.ownedPaths.result !== paths.result ||
				target.ownedPaths.decision !== paths.decision ||
				target.ownedPaths.blindReview !== paths.blindReview
			) {
				context.addIssue({
					code: 'custom',
					message: 'Canonical target outputs do not match exact owned paths'
				});
			}
		}
		if (target.affinity === 'normal' && target.anchor.kind !== 'normal-self') {
			context.addIssue({
				code: 'custom',
				message: 'Normal targets must be their own identity anchor'
			});
		}
		if (target.affinity === 'normal' && target.status !== 'planned') {
			context.addIssue({ code: 'custom', message: 'Normal targets must use planned status' });
		}
		if (target.affinity !== 'normal' && target.anchor.kind === 'normal-self') {
			context.addIssue({ code: 'custom', message: 'Elemental targets require a Normal anchor' });
		}
		if (target.anchor.kind === 'normal-approved-review') {
			if (target.anchor.normalCoordinateId !== `${target.familyId}/${target.formId}/normal`) {
				context.addIssue({
					code: 'custom',
					message: 'Elemental anchor must use the same family and form Normal coordinate'
				});
			}
			const evidence = [
				target.anchor.reviewReceiptSha256,
				target.anchor.normalCandidatePath,
				target.anchor.normalCandidateSha256,
				target.anchor.normalResultPath,
				target.anchor.normalResultSha256
			];
			if (target.status === 'planned' && !evidence.every((value) => value !== null)) {
				context.addIssue({
					code: 'custom',
					message: 'Planned elemental targets require complete Normal approval evidence'
				});
			}
			if (target.status === 'blocked-on-anchor' && !evidence.every((value) => value === null)) {
				context.addIssue({
					code: 'custom',
					message: 'Blocked elemental targets cannot carry approval evidence'
				});
			}
			if (
				target.status === 'earth-bridge-provisional' ||
				target.status === 'planned-provisional-anchor'
			) {
				context.addIssue({
					code: 'custom',
					message: 'Approved Normal anchors cannot use provisional status'
				});
			}
		}
		if (target.anchor.kind === 'normal-verified-candidate') {
			if (
				target.namespace !== 'canonical' ||
				target.affinity === 'normal' ||
				target.anchor.normalCoordinateId !== `${target.familyId}/${target.formId}/normal`
			) {
				context.addIssue({
					code: 'custom',
					message:
						'Verified-candidate anchors require a canonical affinity target and same-form Normal coordinate'
				});
			}
			if (target.status !== 'planned-provisional-anchor') {
				context.addIssue({
					code: 'custom',
					message: 'Verified-candidate anchors require planned-provisional-anchor status'
				});
			}
		}
		if (target.anchor.kind === 'earth-bridge-provisional') {
			if (target.namespace !== 'bridge' || target.affinity !== 'earth') {
				context.addIssue({
					code: 'custom',
					message: 'Earth bridge provisional is only valid for bridge Earth targets'
				});
			}
			if (target.status !== 'earth-bridge-provisional') {
				context.addIssue({
					code: 'custom',
					message: 'Earth bridge provisional targets require provisional status'
				});
			}
		}
	});

export type FamilyAffinityTarget = z.infer<typeof FamilyAffinityTargetSchema>;

export function familyAffinitySourcePacketBinding(targetInput: unknown): {
	path: string;
	sha256: string;
	kind: 'canonical-family' | 'bridge-identity';
} {
	const target = FamilyAffinityTargetSchema.parse(targetInput);
	return target.sources.packetKind !== 'bridge-identity'
		? {
				path: target.sources.familyPacketPath,
				sha256: target.sources.familyPacketSha256,
				kind: 'canonical-family'
			}
		: {
				path: target.sources.familyPacketPath,
				sha256: target.sources.familyPacketSha256,
				kind: 'bridge-identity'
			};
}

export function validateFamilyAffinitySourcePacket(
	targetInput: unknown,
	packetBytes: Uint8Array
): FamilyPacket | BridgeIdentityPacket {
	const target = FamilyAffinityTargetSchema.parse(targetInput);
	const binding = familyAffinitySourcePacketBinding(target);
	const parsed = JSON.parse(Buffer.from(packetBytes).toString('utf8')) as unknown;
	const packet =
		binding.kind === 'canonical-family'
			? FamilyPacketSchema.parse(parsed)
			: BridgeIdentityPacketSchema.parse(parsed);
	if (familyAffinitySha256(packet) !== binding.sha256) {
		throw new Error('Source packet hash drifted from the dispatch target');
	}
	if (binding.kind === 'canonical-family') {
		if (!('familyId' in packet) || packet.familyId !== target.familyId) {
			throw new Error('Canonical family packet identity drifted from the dispatch target');
		}
		return packet;
	}
	const corrected = target.semanticCorrection?.overrides;
	const sourceFieldIsUnchanged = (
		field: keyof typeof FamilyAffinityRevisionSemanticOverridesShape
	) => corrected === undefined || !(field in corrected);
	if (
		!('currentClassId' in packet) ||
		target.namespace !== 'bridge' ||
		packet.currentClassId !== target.currentClassId ||
		packet.bridgeFamilyId !== target.familyId ||
		packet.bridgeFormId !== target.formId ||
		target.tier !== 'bridge-only' ||
		(sourceFieldIsUnchanged('identityInvariants') &&
			packet.identityInvariants.join('\0') !== target.identityInvariants.join('\0')) ||
		(sourceFieldIsUnchanged('anatomyInvariants') &&
			packet.anatomyInvariants.join('\0') !== target.anatomyInvariants.join('\0')) ||
		(sourceFieldIsUnchanged('primaryArchetype') &&
			packet.primaryArchetype !== target.primaryArchetype) ||
		(sourceFieldIsUnchanged('battlefieldDuty') &&
			packet.battlefieldDuty !== target.battlefieldDuty) ||
		(sourceFieldIsUnchanged('telegraph') && packet.telegraph !== target.telegraph) ||
		(sourceFieldIsUnchanged('counterplay') && !target.counterplay.includes(packet.counterplay)) ||
		(sourceFieldIsUnchanged('constructionDimensions') &&
			packet.earthTheme.constructionDimensions.join('\0') !==
				target.constructionDimensions.join('\0'))
	) {
		throw new Error('Bridge identity packet drifted from the dispatch target');
	}
	return packet;
}

export const FamilyAffinityAssignmentSchema = z
	.object({
		schemaVersion: z.literal('family-affinity-assignment-v1'),
		experimentId: FamilyProductionExperimentIdSchema.optional(),
		assignmentId: RequiredTextSchema,
		targetId: RequiredTextSchema,
		targetSha256: Sha256Schema,
		coordinateId: RequiredTextSchema,
		namespace: NamespaceSchema,
		version: z.number().int().positive(),
		producerRole: z.literal('image-producer'),
		allowedOutputs: z.object({ candidate: OwnedPathSchema, result: OwnedPathSchema }).strict(),
		retryCeiling: z.union([z.literal(0), z.literal(1)]),
		dispatchStatus: AttemptStatusSchema,
		selfPromotionForbidden: z.literal(true),
		runtimeCatalogMutationForbidden: z.literal(true)
	})
	.strict()
	.superRefine((assignment, context) => {
		const experimentId = assignment.experimentId ?? 'family-affinity-v1';
		const experimentRoot = `${familyProductionRoot(experimentId)}/`;
		if (
			!assignment.allowedOutputs.candidate.startsWith(experimentRoot) ||
			!assignment.allowedOutputs.result.startsWith(experimentRoot)
		) {
			context.addIssue({
				code: 'custom',
				message: `Assignment outputs must stay under the ${experimentId} root`
			});
		}
		if (assignment.assignmentId !== `${assignment.targetId}/assignment`) {
			context.addIssue({ code: 'custom', message: 'Assignment ID must bind its target ID' });
		}
	});

export type FamilyAffinityAssignment = z.infer<typeof FamilyAffinityAssignmentSchema>;

export const FAMILY_AFFINITY_PRODUCTION_SKILL_VERSION = 'summonlab-image-production-v3' as const;
export const FAMILY_AFFINITY_PRODUCTION_PROFILE = 'image-production-family-target-v1' as const;
export const FAUNA_FAMILY_PRODUCTION_PROFILE = 'image-production-fauna-family-target-v1' as const;
export const FAMILY_AFFINITY_SKILL_CONTRACT_PATH =
	'skills/summonlab-image-production/references/contract-v3.json' as const;

function familyProductionPathTemplatesSchema(root: string) {
	return z
		.object({
			canonicalTarget: z.literal(
				`${root}/targets/{familyId}/{formId}/{affinity}/target-v{version}.json`
			),
			canonicalAssignment: z.literal(
				`${root}/assignments/{familyId}/{formId}/{affinity}/assignment-v{version}.json`
			),
			canonicalCandidate: z.literal(
				`${root}/candidates/{familyId}/{formId}/{affinity}-v{version}.png`
			),
			canonicalResult: z.literal(`${root}/results/{familyId}/{formId}/{affinity}-v{version}.json`),
			bridgeTarget: z.literal(
				`${root}/bridge/targets/{currentClassId}/{affinity}/target-v{version}.json`
			),
			bridgeAssignment: z.literal(
				`${root}/bridge/assignments/{currentClassId}/{affinity}/assignment-v{version}.json`
			),
			bridgeCandidate: z.literal(
				`${root}/bridge/candidates/{currentClassId}/{affinity}-v{version}.png`
			),
			bridgeResult: z.literal(`${root}/bridge/results/{currentClassId}/{affinity}-v{version}.json`)
		})
		.strict();
}

const FamilyAffinityPathTemplatesSchema = familyProductionPathTemplatesSchema(FAMILY_AFFINITY_ROOT);
const FaunaFamilyPathTemplatesSchema = familyProductionPathTemplatesSchema(FAUNA_FAMILY_ROOT);

const FamilyAffinityCompatibilityOwnershipSchema = z
	.object({
		producerRoleAllowlist: z.tuple([z.literal('image-producer')]),
		retryCeiling: z.tuple([z.literal(0), z.literal(1)]),
		exclusiveCandidateCreate: z.literal(true),
		immutableSingleCreateResult: z.literal(true),
		overwriteForbidden: z.literal(true),
		targetAssignmentCrossHashRequired: z.literal(true),
		familyPacketHashRequired: z.literal(true),
		candidateRawHashRequired: z.literal(true),
		promptMaterialHashRequired: z.literal(true),
		runtimeMutationForbidden: z.literal(true)
	})
	.strict();

const FamilyAffinityForbiddenWriteClassesSchema = z.tuple([
	z.literal('review'),
	z.literal('catalog'),
	z.literal('contact-sheet'),
	z.literal('wiki'),
	z.literal('runtime'),
	z.literal('manifest')
]);

const FamilyAffinitySealedLauncherSchema = z
	.object({
		node: z
			.object({
				path: z.literal('/home/joao/.nvm/versions/node/v24.14.1/bin/node'),
				sha256: Sha256Schema
			})
			.strict(),
		bundle: z
			.object({
				path: z.literal('scripts/family_dispatch_gate.mjs'),
				sha256: Sha256Schema
			})
			.strict(),
		sources: z.tuple([
			z
				.object({
					path: z.literal('tools/check-family-affinity-production-dispatch.ts'),
					sha256: Sha256Schema
				})
				.strict(),
			z
				.object({
					path: z.literal('tools/family-affinity-production-lib.ts'),
					sha256: Sha256Schema
				})
				.strict(),
			z.object({ path: z.literal('package.json'), sha256: Sha256Schema }).strict(),
			z.object({ path: z.literal('pnpm-lock.yaml'), sha256: Sha256Schema }).strict()
		]),
		environment: z
			.object({
				LANG: z.literal('C.UTF-8'),
				LC_ALL: z.literal('C.UTF-8'),
				TZ: z.literal('UTC')
			})
			.strict()
	})
	.strict();

const LegacyFamilyAffinityProductionCompatibilitySchema = z
	.object({
		schemaVersion: z.literal('family-affinity-production-compatibility-v1'),
		skillVersion: z.literal(FAMILY_AFFINITY_PRODUCTION_SKILL_VERSION),
		profile: z.literal(FAMILY_AFFINITY_PRODUCTION_PROFILE),
		targetSchema: z.literal('family-affinity-target-v1'),
		assignmentSchema: z.literal('family-affinity-assignment-v1'),
		resultSchema: z.literal('family-affinity-result-v1'),
		promptMaterialSchema: z.literal('family-affinity-prompt-material-v1'),
		sourcePacketSchemas: z.tuple([
			z.literal('family-packet-v1'),
			z.literal('bridge-identity-packet-v1')
		]),
		experimentId: z.literal('family-affinity-v1'),
		affinities: z.tuple([
			z.literal('normal'),
			z.literal('fire'),
			z.literal('earth'),
			z.literal('wind'),
			z.literal('water')
		]),
		namespaces: z.tuple([z.literal('canonical'), z.literal('bridge')]),
		dispatchStatuses: z.tuple([
			z.literal('planned'),
			z.literal('planned-provisional-anchor'),
			z.literal('earth-bridge-provisional')
		]),
		anchorKinds: z.tuple([
			z.literal('normal-self'),
			z.literal('normal-approved-review'),
			z.literal('normal-verified-candidate'),
			z.literal('earth-bridge-provisional')
		]),
		requiredBindings: z.tuple([
			z.literal('target-assignment-cross-hash'),
			z.literal('namespace-source-packet-canonical-json-hash'),
			z.literal('bridge-normal-reference-raw-bytes-hash'),
			z.literal('canonical-normal-target-candidate-result-source-hash'),
			z.literal('candidate-raw-bytes-hash'),
			z.literal('prompt-material-raw-bytes-hash'),
			z.literal('source-path'),
			z.literal('result-path')
		]),
		pathTemplates: FamilyAffinityPathTemplatesSchema,
		ownership: FamilyAffinityCompatibilityOwnershipSchema,
		forbiddenWriteClasses: FamilyAffinityForbiddenWriteClassesSchema,
		skillContractPath: z.literal(FAMILY_AFFINITY_SKILL_CONTRACT_PATH),
		skillContractSha256: Sha256Schema,
		approvedSkillRoot: RequiredTextSchema,
		executionSurface: z
			.object({
				framing: z.literal('length-prefixed-sha256-v1'),
				files: z
					.array(z.object({ path: RequiredTextSchema, sha256: Sha256Schema }).strict())
					.length(14),
				bundleSha256: Sha256Schema
			})
			.strict(),
		repositoryDispatch: z
			.object({
				path: z.literal('tools/check-family-affinity-production-dispatch.ts'),
				sha256: Sha256Schema
			})
			.strict(),
		sealedLauncher: FamilyAffinitySealedLauncherSchema,
		bridgeExtension: z
			.object({
				schemaVersion: z.literal('earth-bridge-production-extension-v1'),
				wavePath: z.literal(`${FAMILY_AFFINITY_ROOT}/waves/earth-bridge-v1.json`),
				reviewedAt: z.string().regex(/^2026-09-02T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u),
				approvalReference: z.literal('root-approved-task10-bridge-production-extension-2026-09-02')
			})
			.strict(),
		provisionalAnchorExtension: z
			.object({
				schemaVersion: z.literal('normal-verified-candidate-extension-v1'),
				planPath: z.literal(
					'docs/superpowers/plans/2026-09-03-monster-image-single-checkpoint-goal-harness.md'
				),
				reviewedAt: z.string().regex(/^2026-09-03T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u),
				approvalReference: z.literal(
					'user-confirmed-single-checkpoint-monster-generation-2026-09-03'
				),
				candidateOnly: z.literal(true),
				humanReviewPending: z.literal(true),
				runtimeCatalogMutationForbidden: z.literal(true)
			})
			.strict(),
		reviewedAt: z
			.string()
			.regex(
				/^2026-09-02T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u,
				'Approval must be reviewed on 2026-09-02'
			),
		approvalReference: z.literal('user-confirmed-summonlab-image-production-v3-2026-09-02')
	})
	.strict();

const FaunaFamilyProductionCompatibilitySchema = z
	.object({
		schemaVersion: z.literal('family-affinity-production-compatibility-v1'),
		skillVersion: z.literal(FAMILY_AFFINITY_PRODUCTION_SKILL_VERSION),
		profile: z.literal(FAUNA_FAMILY_PRODUCTION_PROFILE),
		targetSchema: z.literal('family-affinity-target-v1'),
		assignmentSchema: z.literal('family-affinity-assignment-v1'),
		resultSchema: z.literal('family-affinity-result-v1'),
		promptMaterialSchema: z.literal('family-affinity-prompt-material-v1'),
		sourcePacketSchemas: z.tuple([z.literal('family-packet-v1')]),
		experimentId: z.literal('fauna-family-v1'),
		affinities: z.tuple([
			z.literal('normal'),
			z.literal('fire'),
			z.literal('earth'),
			z.literal('wind'),
			z.literal('water')
		]),
		namespaces: z.tuple([z.literal('canonical')]),
		dispatchStatuses: z.tuple([z.literal('planned'), z.literal('planned-provisional-anchor')]),
		anchorKinds: z.tuple([
			z.literal('normal-self'),
			z.literal('normal-approved-review'),
			z.literal('normal-verified-candidate')
		]),
		requiredBindings: z.tuple([
			z.literal('target-assignment-cross-hash'),
			z.literal('namespace-source-packet-canonical-json-hash'),
			z.literal('canonical-normal-target-candidate-result-source-hash'),
			z.literal('candidate-raw-bytes-hash'),
			z.literal('prompt-material-raw-bytes-hash'),
			z.literal('source-path'),
			z.literal('result-path')
		]),
		pathTemplates: FaunaFamilyPathTemplatesSchema,
		ownership: FamilyAffinityCompatibilityOwnershipSchema,
		forbiddenWriteClasses: FamilyAffinityForbiddenWriteClassesSchema,
		skillContractPath: z.literal(FAMILY_AFFINITY_SKILL_CONTRACT_PATH),
		skillContractSha256: Sha256Schema,
		approvedSkillRoot: RequiredTextSchema,
		executionSurface: z
			.object({
				framing: z.literal('length-prefixed-sha256-v1'),
				files: z
					.array(z.object({ path: RequiredTextSchema, sha256: Sha256Schema }).strict())
					.length(14),
				bundleSha256: Sha256Schema
			})
			.strict(),
		repositoryDispatch: z
			.object({
				path: z.literal('tools/check-family-affinity-production-dispatch.ts'),
				sha256: Sha256Schema
			})
			.strict(),
		sealedLauncher: FamilyAffinitySealedLauncherSchema,
		reviewedAt: z.string().regex(/^2026-09-04T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u),
		approvalReference: z.literal('owner-approved-fauna-family-production-2026-09-04')
	})
	.strict();

export const FamilyAffinityProductionCompatibilitySchema = z.discriminatedUnion('profile', [
	LegacyFamilyAffinityProductionCompatibilitySchema,
	FaunaFamilyProductionCompatibilitySchema
]);

export type FamilyAffinityProductionCompatibility = z.infer<
	typeof FamilyAffinityProductionCompatibilitySchema
>;

const FamilyAffinitySkillContractSchema = z
	.object({
		schemaVersion: z.literal('summonlab-image-production-contract-v3'),
		skillVersion: z.literal(FAMILY_AFFINITY_PRODUCTION_SKILL_VERSION),
		executionSurface: z
			.object({
				framing: z.literal('length-prefixed-sha256-v1'),
				files: z.tuple([
					z.literal('references/contract-v3.json'),
					z.literal('SKILL.md'),
					z.literal('references/affinity-grammar.md'),
					z.literal('references/result-schema.md'),
					z.literal('references/review-rubric.md'),
					z.literal('references/species-grammar.md'),
					z.literal('references/target-schema.md'),
					z.literal('scripts/anchored_io.py'),
					z.literal('scripts/family_dispatch_gate.mjs'),
					z.literal('scripts/persist_family_candidate.py'),
					z.literal('scripts/render_prompt.py'),
					z.literal('scripts/validate_target.py'),
					z.literal('scripts/verify_result.py'),
					z.literal('scripts/write_family_result.py')
				]),
				expectedNonContractSha256: z.record(z.string(), Sha256Schema)
			})
			.strict(),
		repositoryDispatch: z
			.object({
				path: z.literal('tools/check-family-affinity-production-dispatch.ts'),
				sha256: Sha256Schema
			})
			.strict(),
		sealedLauncher: FamilyAffinitySealedLauncherSchema,
		profiles: z
			.object({
				'image-production-family-target-v1': z
					.object({
						repositoryTargetSchema: z.literal('family-affinity-target-v1'),
						assignmentSchema: z.literal('family-affinity-assignment-v1'),
						resultSchema: z.literal('family-affinity-result-v1'),
						promptMaterialSchema: z.literal('family-affinity-prompt-material-v1'),
						sourcePacketSchemas: z.tuple([
							z.literal('family-packet-v1'),
							z.literal('bridge-identity-packet-v1')
						]),
						experimentId: z.literal('family-affinity-v1'),
						affinities: z.tuple([
							z.literal('normal'),
							z.literal('fire'),
							z.literal('earth'),
							z.literal('wind'),
							z.literal('water')
						]),
						namespaces: z.tuple([z.literal('canonical'), z.literal('bridge')]),
						dispatchStatuses: z.tuple([
							z.literal('planned'),
							z.literal('planned-provisional-anchor'),
							z.literal('earth-bridge-provisional')
						]),
						anchorKinds: z.tuple([
							z.literal('normal-self'),
							z.literal('normal-approved-review'),
							z.literal('normal-verified-candidate'),
							z.literal('earth-bridge-provisional')
						]),
						pathTemplates: FamilyAffinityPathTemplatesSchema,
						producerRoleAllowlist: z.tuple([z.literal('image-producer')]),
						retryCeiling: z.tuple([z.literal(0), z.literal(1)]),
						ownership: z
							.object({
								exclusiveCandidateCreate: z.literal(true),
								immutableSingleCreateResult: z.literal(true),
								overwriteForbidden: z.literal(true)
							})
							.strict(),
						requiredBindings: z.tuple([
							z.literal('target-assignment-cross-hash'),
							z.literal('namespace-source-packet-canonical-json-hash'),
							z.literal('bridge-normal-reference-raw-bytes-hash'),
							z.literal('canonical-normal-target-candidate-result-source-hash'),
							z.literal('candidate-raw-bytes-hash'),
							z.literal('prompt-material-raw-bytes-hash'),
							z.literal('source-path'),
							z.literal('result-path')
						]),
						forbiddenWriteClasses: FamilyAffinityForbiddenWriteClassesSchema,
						promotionCeiling: z.literal('candidate-only')
					})
					.strict(),
				'image-production-fauna-family-target-v1': z
					.object({
						repositoryTargetSchema: z.literal('family-affinity-target-v1'),
						assignmentSchema: z.literal('family-affinity-assignment-v1'),
						resultSchema: z.literal('family-affinity-result-v1'),
						promptMaterialSchema: z.literal('family-affinity-prompt-material-v1'),
						sourcePacketSchemas: z.tuple([z.literal('family-packet-v1')]),
						experimentId: z.literal('fauna-family-v1'),
						affinities: z.tuple([
							z.literal('normal'),
							z.literal('fire'),
							z.literal('earth'),
							z.literal('wind'),
							z.literal('water')
						]),
						namespaces: z.tuple([z.literal('canonical')]),
						dispatchStatuses: z.tuple([
							z.literal('planned'),
							z.literal('planned-provisional-anchor')
						]),
						anchorKinds: z.tuple([
							z.literal('normal-self'),
							z.literal('normal-approved-review'),
							z.literal('normal-verified-candidate')
						]),
						pathTemplates: FaunaFamilyPathTemplatesSchema,
						producerRoleAllowlist: z.tuple([z.literal('image-producer')]),
						retryCeiling: z.tuple([z.literal(0), z.literal(1)]),
						ownership: z
							.object({
								exclusiveCandidateCreate: z.literal(true),
								immutableSingleCreateResult: z.literal(true),
								overwriteForbidden: z.literal(true)
							})
							.strict(),
						requiredBindings: z.tuple([
							z.literal('target-assignment-cross-hash'),
							z.literal('namespace-source-packet-canonical-json-hash'),
							z.literal('canonical-normal-target-candidate-result-source-hash'),
							z.literal('candidate-raw-bytes-hash'),
							z.literal('prompt-material-raw-bytes-hash'),
							z.literal('source-path'),
							z.literal('result-path')
						]),
						forbiddenWriteClasses: FamilyAffinityForbiddenWriteClassesSchema,
						promotionCeiling: z.literal('candidate-only')
					})
					.strict(),
				'legacy-affinity-v1-v2': z
					.object({
						targetSchemas: z.tuple([
							z.literal('image-production-target-v1'),
							z.literal('image-production-target-v2')
						]),
						assignmentSchema: z.literal('image-production-assignment-v1'),
						resultSchema: z.literal('image-production-result-v1'),
						affinities: z.tuple([
							z.literal('normal'),
							z.literal('wood'),
							z.literal('fire'),
							z.literal('metal'),
							z.literal('water'),
							z.literal('wind')
						]),
						experimentRoots: z.tuple([
							z.literal('affinity-workflow-v1'),
							z.literal('affinity-expansion-v1')
						])
					})
					.strict()
			})
			.strict()
	})
	.strict();

export function validateFamilyAffinityProductionCompatibility(
	input: unknown,
	installedContractBytes: Uint8Array
): FamilyAffinityProductionCompatibility {
	if (input === undefined || input === null) {
		throw new Error('Family affinity production compatibility receipt is absent');
	}
	const compatibility = FamilyAffinityProductionCompatibilitySchema.parse(input);
	if (familyAffinityRawSha256(installedContractBytes) !== compatibility.skillContractSha256) {
		throw new Error('Installed image-production skill contract hash drifted from approval');
	}
	let contractInput: unknown;
	try {
		contractInput = JSON.parse(Buffer.from(installedContractBytes).toString('utf8'));
	} catch (error) {
		throw new Error(`Installed image-production skill contract is not JSON: ${String(error)}`);
	}
	const contract = FamilyAffinitySkillContractSchema.parse(contractInput);
	const profile = contract.profiles[compatibility.profile];
	if (
		stableJson(contract.repositoryDispatch) !== stableJson(compatibility.repositoryDispatch) ||
		stableJson(contract.sealedLauncher) !== stableJson(compatibility.sealedLauncher) ||
		profile.repositoryTargetSchema !== compatibility.targetSchema ||
		profile.assignmentSchema !== compatibility.assignmentSchema ||
		profile.resultSchema !== compatibility.resultSchema ||
		profile.promptMaterialSchema !== compatibility.promptMaterialSchema ||
		stableJson(profile.sourcePacketSchemas) !== stableJson(compatibility.sourcePacketSchemas) ||
		profile.experimentId !== compatibility.experimentId ||
		stableJson(profile.affinities) !== stableJson(compatibility.affinities) ||
		stableJson(profile.namespaces) !== stableJson(compatibility.namespaces) ||
		stableJson(profile.dispatchStatuses) !== stableJson(compatibility.dispatchStatuses) ||
		stableJson(profile.anchorKinds) !== stableJson(compatibility.anchorKinds) ||
		stableJson(profile.requiredBindings) !== stableJson(compatibility.requiredBindings) ||
		stableJson(profile.pathTemplates) !== stableJson(compatibility.pathTemplates) ||
		stableJson(profile.producerRoleAllowlist) !==
			stableJson(compatibility.ownership.producerRoleAllowlist) ||
		stableJson(profile.retryCeiling) !== stableJson(compatibility.ownership.retryCeiling) ||
		stableJson(profile.forbiddenWriteClasses) !== stableJson(compatibility.forbiddenWriteClasses) ||
		profile.ownership.exclusiveCandidateCreate !==
			compatibility.ownership.exclusiveCandidateCreate ||
		profile.ownership.immutableSingleCreateResult !==
			compatibility.ownership.immutableSingleCreateResult ||
		profile.ownership.overwriteForbidden !== compatibility.ownership.overwriteForbidden ||
		profile.promotionCeiling !== 'candidate-only'
	) {
		throw new Error('Installed image-production skill family profile drifted from approval');
	}
	return compatibility;
}

export function preflightFamilyAffinityProductionDispatch(input: {
	compatibility: unknown;
	installedContractBytes: Uint8Array;
	target: unknown;
	assignment: unknown;
	targetPath: string;
	assignmentPath: string;
	familyPacketBytes: Uint8Array;
	renderedPromptBytes: Uint8Array;
}): {
	dispatchable: true;
	profile: typeof FAMILY_AFFINITY_PRODUCTION_PROFILE | typeof FAUNA_FAMILY_PRODUCTION_PROFILE;
	targetId: string;
	affinity: (typeof PRODUCTION_AFFINITIES)[number];
	status: z.infer<typeof AttemptStatusSchema>;
	promotionCeiling: 'candidate-only';
} {
	const compatibility = validateFamilyAffinityProductionCompatibility(
		input.compatibility,
		input.installedContractBytes
	);
	const target = FamilyAffinityTargetSchema.parse(input.target);
	const assignment = FamilyAffinityAssignmentSchema.parse(input.assignment);
	if (familyProductionTargetExperimentId(target) !== compatibility.experimentId) {
		throw new Error('Dispatch target experiment does not match its compatibility profile');
	}
	const paths =
		target.namespace === 'canonical'
			? canonicalAttemptPaths(
					target.familyId,
					target.formId,
					target.affinity,
					target.version,
					familyProductionTargetExperimentId(target)
				)
			: bridgeAttemptPaths(target.currentClassId!, target.affinity, target.version);
	if (input.targetPath !== paths.target || input.assignmentPath !== paths.assignment) {
		throw new Error('Dispatch input paths do not match exact versioned ownership templates');
	}
	validateFamilyAffinityAttemptCrossBinding(
		{
			namespace: target.namespace,
			coordinateId: target.coordinateId,
			familyId: target.familyId,
			formId: target.formId,
			currentClassId: target.currentClassId,
			affinity: target.affinity,
			activeVersion: target.version,
			targetPath: paths.target,
			targetSha256: familyAffinitySha256(target),
			assignmentPath: paths.assignment,
			assignmentSha256: familyAffinitySha256(assignment),
			status: target.status
		},
		target,
		assignment
	);
	if (
		target.status !== 'planned' &&
		target.status !== 'planned-provisional-anchor' &&
		target.status !== 'earth-bridge-provisional'
	) {
		throw new Error(`Target status is not dispatchable: ${target.status} (${target.targetId})`);
	}
	validateFamilyAffinitySourcePacket(target, input.familyPacketBytes);
	if (
		familyAffinityRawSha256(input.renderedPromptBytes) !==
		familyAffinityPromptSha256(target, assignment)
	) {
		throw new Error('Rendered family prompt bytes drifted from the repository prompt material');
	}
	return {
		dispatchable: true,
		profile: compatibility.profile,
		targetId: target.targetId,
		affinity: target.affinity,
		status: target.status,
		promotionCeiling: 'candidate-only'
	};
}

const ManifestCoordinateSchema = z
	.object({
		namespace: NamespaceSchema,
		coordinateId: RequiredTextSchema,
		familyId: IdSchema,
		formId: IdSchema,
		currentClassId: IdSchema.nullable(),
		affinity: z.enum(PRODUCTION_AFFINITIES),
		activeVersion: z.number().int().positive(),
		targetPath: OwnedPathSchema,
		targetSha256: Sha256Schema,
		assignmentPath: OwnedPathSchema,
		assignmentSha256: Sha256Schema,
		status: AttemptStatusSchema
	})
	.strict();

export const FamilyAffinityManifestSchema = z
	.object({
		schemaVersion: z.literal('family-affinity-manifest-v1'),
		experimentId: z.literal('family-affinity-v1'),
		canonicalMatrix: z
			.object({
				familyCount: z.literal(30),
				formCount: z.literal(150),
				affinities: z.tuple([
					z.literal('normal'),
					z.literal('fire'),
					z.literal('earth'),
					z.literal('wind'),
					z.literal('water')
				]),
				targetCount: z.literal(750),
				assignmentCount: z.literal(750),
				activeCoordinates: z.array(ManifestCoordinateSchema)
			})
			.strict(),
		bridge: z
			.object({
				targetCount: z.number().int().nonnegative(),
				assignmentCount: z.number().int().nonnegative(),
				activeCoordinates: z.array(ManifestCoordinateSchema)
			})
			.strict(),
		mappingReservations: z
			.object({
				sourcePath: OwnedPathSchema,
				retainedCurrentClassCount: z.number().int().nonnegative(),
				canonicalPrimaryCount: z.number().int().nonnegative(),
				bridgeOnlyCount: z.number().int().nonnegative(),
				secondaryArchetypeIds: z.array(IdSchema),
				faunaIds: z.array(IdSchema)
			})
			.strict(),
		ownership: z
			.object({
				controllerRole: z.literal('integration-controller'),
				producerSelfPromotionForbidden: z.literal(true),
				runtimeCatalogMutationForbidden: z.literal(true)
			})
			.strict()
	})
	.strict()
	.superRefine((manifest, context) => {
		if (!manifest.mappingReservations.sourcePath.startsWith(`${FAMILY_AFFINITY_ROOT}/`)) {
			context.addIssue({
				code: 'custom',
				message: 'Family-affinity manifest source path must stay under its experiment root'
			});
		}
		if (manifest.canonicalMatrix.activeCoordinates.length !== 750) {
			context.addIssue({
				code: 'custom',
				message: 'Canonical manifest requires exactly 750 active coordinates'
			});
		}
		if (
			manifest.bridge.targetCount !== manifest.bridge.activeCoordinates.length ||
			manifest.bridge.assignmentCount !== manifest.bridge.activeCoordinates.length
		) {
			context.addIssue({
				code: 'custom',
				message: 'Bridge counts must equal active bridge coordinate coverage'
			});
		}
		for (const [label, coordinates] of [
			['canonical', manifest.canonicalMatrix.activeCoordinates],
			['bridge', manifest.bridge.activeCoordinates]
		] as const) {
			for (const field of ['coordinateId', 'targetPath', 'assignmentPath'] as const) {
				const values = coordinates.map((coordinate) => coordinate[field]);
				if (new Set(values).size !== values.length) {
					context.addIssue({
						code: 'custom',
						message: `Duplicate active ${label} ${field === 'coordinateId' ? 'coordinate' : field}`
					});
				}
			}
			if (coordinates.some((coordinate) => coordinate.namespace !== label)) {
				context.addIssue({
					code: 'custom',
					message: `${label} active coordinates must use the ${label} namespace`
				});
			}
		}
		const allActiveCoordinates = [
			...manifest.canonicalMatrix.activeCoordinates,
			...manifest.bridge.activeCoordinates
		];
		if (
			allActiveCoordinates.some(
				(coordinate) =>
					!coordinate.targetPath.startsWith(`${FAMILY_AFFINITY_ROOT}/`) ||
					!coordinate.assignmentPath.startsWith(`${FAMILY_AFFINITY_ROOT}/`)
			)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Family-affinity coordinates must stay under their experiment root'
			});
		}
		for (const field of [
			'coordinateId',
			'targetPath',
			'assignmentPath',
			'targetSha256',
			'assignmentSha256'
		] as const) {
			const values = allActiveCoordinates.map((coordinate) => coordinate[field]);
			if (new Set(values).size !== values.length) {
				context.addIssue({
					code: 'custom',
					message: `Global duplicate active ${field} across canonical and bridge namespaces`
				});
			}
		}
		const bridgeCurrentTargets = manifest.bridge.activeCoordinates.map(
			({ currentClassId, affinity }) => `${currentClassId}/${affinity}`
		);
		if (new Set(bridgeCurrentTargets).size !== bridgeCurrentTargets.length) {
			context.addIssue({
				code: 'custom',
				message: 'Duplicate active bridge current-class affinity target'
			});
		}
	});

export type FamilyAffinityManifest = z.infer<typeof FamilyAffinityManifestSchema>;

export const FaunaFamilyManifestSchema = z
	.object({
		schemaVersion: z.literal('fauna-family-production-manifest-v1'),
		experimentId: z.literal('fauna-family-v1'),
		status: z.enum(['production-materialized', 'candidate-matrix-complete']),
		scope: z
			.object({
				existingFamilyAction: z.literal('retain-without-regeneration'),
				existingFamilyProgram: z.literal(`${FAMILY_AFFINITY_ROOT}/manifest.json`),
				existingFamilyCount: z.literal(30),
				existingFormCount: z.literal(150),
				existingCoordinateCount: z.literal(750),
				newFamilyIds: z.array(IdSchema).length(8),
				affinities: z.tuple([
					z.literal('normal'),
					z.literal('fire'),
					z.literal('earth'),
					z.literal('wind'),
					z.literal('water')
				]),
				newFamilyCount: z.literal(8),
				newFormCount: z.literal(40),
				newCoordinateCount: z.literal(200)
			})
			.strict(),
		canonicalMatrix: z
			.object({
				familyCount: z.literal(8),
				formCount: z.literal(40),
				affinities: z.tuple([
					z.literal('normal'),
					z.literal('fire'),
					z.literal('earth'),
					z.literal('wind'),
					z.literal('water')
				]),
				targetCount: z.literal(200),
				assignmentCount: z.literal(200),
				activeCoordinates: z.array(ManifestCoordinateSchema).length(200)
			})
			.strict(),
		production: z
			.object({
				targetMaterializationStatus: z.literal('materialized'),
				targetCount: z.literal(200),
				assignmentCount: z.literal(200),
				candidateCount: z.union([z.literal(0), z.literal(200)]),
				resultCount: z.literal(200).optional(),
				provenanceRecordCount: z.literal(200).optional(),
				unresolvedProviderFailureCount: z.literal(0).optional(),
				approvedCount: z.literal(0),
				runtimeCount: z.literal(0),
				inventoryPath: z.literal(`${FAUNA_FAMILY_ROOT}/inventory.json`).optional(),
				evidenceInventoryPath: z.literal('docs/evidence/fauna-family-v1/inventory.json').optional(),
				reviewGalleryPath: z.literal('docs/evidence/fauna-family-v1/index.html').optional(),
				reviewCheckpoint: z.literal('after-new-fauna-candidate-matrix-is-complete'),
				runtimeCatalogMutationForbidden: z.literal(true)
			})
			.strict(),
		legacyClassMigrations: z.array(z.record(z.string(), z.unknown())),
		ownership: z
			.object({
				domain: z.literal('enemies-visuals'),
				controllerRole: z.literal('integration-controller'),
				candidatesAreNotApproved: z.literal(true),
				approvedAssetsAreNotRuntime: z.literal(true),
				producerSelfPromotionForbidden: z.literal(true),
				runtimeCatalogMutationForbidden: z.literal(true)
			})
			.strict()
	})
	.strict()
	.superRefine((manifest, context) => {
		const coordinates = manifest.canonicalMatrix.activeCoordinates;
		for (const field of ['coordinateId', 'targetPath', 'assignmentPath'] as const) {
			const values = coordinates.map((coordinate) => coordinate[field]);
			if (new Set(values).size !== 200) {
				context.addIssue({
					code: 'custom',
					message: `Fauna manifest ${field} values must be unique`
				});
			}
		}
		if (
			coordinates.some(
				(coordinate) =>
					coordinate.namespace !== 'canonical' ||
					!coordinate.targetPath.startsWith(`${FAUNA_FAMILY_ROOT}/targets/`) ||
					!coordinate.assignmentPath.startsWith(`${FAUNA_FAMILY_ROOT}/assignments/`)
			)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Fauna coordinates must use canonical fauna paths'
			});
		}
		const finalFields = [
			manifest.production.resultCount,
			manifest.production.provenanceRecordCount,
			manifest.production.unresolvedProviderFailureCount,
			manifest.production.inventoryPath,
			manifest.production.evidenceInventoryPath,
			manifest.production.reviewGalleryPath
		];
		if (
			manifest.status === 'candidate-matrix-complete' &&
			(manifest.production.candidateCount !== 200 ||
				finalFields.some((value) => value === undefined))
		) {
			context.addIssue({
				code: 'custom',
				message: 'Complete fauna handoff requires the full candidate inventory and evidence paths'
			});
		}
		if (
			manifest.status === 'production-materialized' &&
			(manifest.production.candidateCount !== 0 || finalFields.some((value) => value !== undefined))
		) {
			context.addIssue({
				code: 'custom',
				message: 'Materialized fauna production cannot claim final candidate handoff evidence'
			});
		}
	});

export type FaunaFamilyManifest = z.infer<typeof FaunaFamilyManifestSchema>;

export type FamilyAffinityProductionBundle = {
	manifest: FamilyAffinityManifest;
	targets: FamilyAffinityTarget[];
	assignments: FamilyAffinityAssignment[];
	artifacts: Array<{ path: string; value: unknown }>;
};

const ReviewDecisionSchema = z.enum(['approved-review', 'rejected', 'revise']);
const ReviewRubricDimensionSchema = z
	.object({ verdict: z.enum(['pass', 'fail']), notes: RequiredTextSchema })
	.strict();
const ReviewRubricSchema = z
	.object({
		identity: ReviewRubricDimensionSchema,
		tier: ReviewRubricDimensionSchema,
		archetype: ReviewRubricDimensionSchema,
		anatomy: ReviewRubricDimensionSchema,
		affinity: ReviewRubricDimensionSchema,
		counterplay: ReviewRubricDimensionSchema,
		framing: ReviewRubricDimensionSchema,
		finish: ReviewRubricDimensionSchema
	})
	.strict();

export const FamilyAffinityResultSchema = z
	.object({
		schemaVersion: z.literal('family-affinity-result-v1'),
		targetId: RequiredTextSchema,
		targetSha256: Sha256Schema,
		coordinateId: RequiredTextSchema,
		candidateVersion: z.number().int().positive(),
		producerId: RequiredTextSchema,
		candidatePath: OwnedPathSchema,
		candidateSha256: Sha256Schema,
		resultPath: OwnedPathSchema,
		sourcePath: OwnedPathSchema,
		sourceSha256: Sha256Schema,
		promptSha256: Sha256Schema,
		state: z.literal('candidate-only'),
		runtimeCatalogMutationForbidden: z.literal(true)
	})
	.strict();

const CommonReviewReceiptShape = {
	targetId: RequiredTextSchema,
	targetSha256: Sha256Schema,
	coordinateId: RequiredTextSchema,
	candidateVersion: z.number().int().positive(),
	decisionVersion: z.number().int().positive(),
	reviewerId: RequiredTextSchema,
	producerIdentitySha256: Sha256Schema,
	candidatePath: OwnedPathSchema,
	candidateSha256: Sha256Schema,
	resultPath: OwnedPathSchema,
	resultSha256: Sha256Schema,
	sourcePath: OwnedPathSchema,
	sourceSha256: Sha256Schema,
	promptSha256: Sha256Schema,
	decision: ReviewDecisionSchema,
	rubric: ReviewRubricSchema,
	runtimeCatalogMutationForbidden: z.literal(true)
} as const;

export const FamilyAffinityReviewReceiptSchema = z
	.object({
		schemaVersion: z.literal('family-affinity-review-decision-v1'),
		receiptType: z.literal('ordinary'),
		producerId: RequiredTextSchema,
		...CommonReviewReceiptShape
	})
	.strict()
	.superRefine((receipt, context) => {
		if (receipt.reviewerId === receipt.producerId) {
			context.addIssue({ code: 'custom', message: 'Producer self-approval is forbidden' });
		}
		if (
			receipt.decision === 'approved-review' &&
			Object.values(receipt.rubric).some(({ verdict }) => verdict !== 'pass')
		) {
			context.addIssue({
				code: 'custom',
				message: 'Approved-review requires every rubric dimension to pass'
			});
		}
	});

export const FamilyAffinityBlindReviewReceiptSchema = z
	.object({
		schemaVersion: z.literal('family-affinity-blind-review-v1'),
		receiptType: z.literal('blind'),
		...CommonReviewReceiptShape,
		blindToProducerIdentity: z.literal(true),
		blindToOrdinaryDecision: z.literal(true)
	})
	.strict()
	.superRefine((receipt, context) => {
		if (
			receipt.decision === 'approved-review' &&
			Object.values(receipt.rubric).some(({ verdict }) => verdict !== 'pass')
		) {
			context.addIssue({
				code: 'custom',
				message: 'Approved-review requires every rubric dimension to pass'
			});
		}
	});

export const FamilyAffinityReviewAssignmentSchema = z
	.object({
		schemaVersion: z.literal('family-affinity-review-assignment-v1'),
		issuerRole: z.literal('controller'),
		issuerId: RequiredTextSchema,
		issuerAttestationSha256: Sha256Schema,
		reviewKind: z.enum(['ordinary', 'blind']),
		assignmentId: RequiredTextSchema,
		reviewerId: RequiredTextSchema,
		producerId: RequiredTextSchema.nullable(),
		producerIdentitySha256: Sha256Schema,
		manifestPath: OwnedPathSchema,
		manifestSha256: Sha256Schema,
		targetId: RequiredTextSchema,
		targetPath: OwnedPathSchema,
		targetSha256: Sha256Schema,
		productionAssignmentPath: OwnedPathSchema,
		productionAssignmentSha256: Sha256Schema,
		coordinateId: RequiredTextSchema,
		candidateVersion: z.number().int().positive(),
		decisionVersion: z.number().int().positive(),
		candidatePath: OwnedPathSchema,
		candidateSha256: Sha256Schema,
		resultPath: OwnedPathSchema,
		resultSha256: Sha256Schema,
		sourcePath: OwnedPathSchema,
		sourceSha256: Sha256Schema,
		promptSha256: Sha256Schema,
		permittedReceiptPath: OwnedPathSchema,
		exclusiveCreateRequired: z.literal(true),
		runtimeCatalogMutationForbidden: z.literal(true)
	})
	.strict()
	.superRefine((assignment, context) => {
		if (
			assignment.issuerId === assignment.reviewerId ||
			(assignment.producerId !== null && assignment.issuerId === assignment.producerId)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Controller issuer identity must be separate from producer and reviewer identities'
			});
		}
		if (
			assignment.assignmentId !==
			`${assignment.targetId}/${assignment.reviewKind}-review-v${assignment.decisionVersion}/assignment`
		) {
			context.addIssue({
				code: 'custom',
				message: 'Review assignment ID must bind target, review kind, and decision version'
			});
		}
		if (assignment.reviewKind === 'ordinary' && assignment.producerId === null) {
			context.addIssue({ code: 'custom', message: 'Ordinary assignment requires producer ID' });
		}
		if (assignment.reviewKind === 'blind' && assignment.producerId !== null) {
			context.addIssue({ code: 'custom', message: 'Blind assignment must conceal producer ID' });
		}
	});

export type FamilyAffinityResult = z.infer<typeof FamilyAffinityResultSchema>;
export type FamilyAffinityReviewReceipt = z.infer<typeof FamilyAffinityReviewReceiptSchema>;
export type FamilyAffinityBlindReviewReceipt = z.infer<
	typeof FamilyAffinityBlindReviewReceiptSchema
>;
export type FamilyAffinityReviewAssignment = z.infer<typeof FamilyAffinityReviewAssignmentSchema>;

export function validateFamilyAffinityReviewPromotion(
	targetInput: unknown,
	receiptInput: unknown
): void {
	const target = FamilyAffinityTargetSchema.parse(targetInput);
	const receipt = FamilyAffinityReviewReceiptSchema.parse(receiptInput);
	if (
		receipt.targetId !== target.targetId ||
		receipt.targetSha256 !== familyAffinitySha256(target)
	) {
		throw new Error('Review receipt target or hash is stale or mismatched');
	}
	if (
		(target.anchor.kind === 'earth-bridge-provisional' ||
			target.anchor.kind === 'normal-verified-candidate') &&
		receipt.decision === 'approved-review'
	) {
		throw new Error(
			target.anchor.kind === 'earth-bridge-provisional'
				? 'Provisional Earth target cannot reach approved-review before its canonical Normal anchor'
				: 'Provisional target cannot reach approved-review before its Normal anchor is approved'
		);
	}
}

function stableJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
		.join(',')}}`;
}

export function familyAffinitySha256(value: unknown): string {
	return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function familyAffinityRawSha256(bytes: Uint8Array | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}

export function familyAffinityProducerIdentitySha256(producerId: string): string {
	return familyAffinityRawSha256(`family-affinity-producer-v1\0${producerId}`);
}

export function familyAffinityReviewIssuerAttestationSha256(input: {
	issuerId: string;
	reviewerId: string;
	kind: 'ordinary' | 'blind';
	manifestPath: string;
	manifestSha256: string;
	target: unknown;
	targetPath: string;
	productionAssignment: unknown;
	productionAssignmentPath: string;
	result: FamilyAffinityResult;
	resultSha256: string;
	decisionVersion: number;
	permittedReceiptPath: string;
}): string {
	const target = FamilyAffinityTargetSchema.parse(input.target);
	const productionAssignment = FamilyAffinityAssignmentSchema.parse(input.productionAssignment);
	return familyAffinitySha256({
		schemaVersion: 'family-affinity-review-controller-attestation-v1',
		issuerRole: 'controller',
		issuerId: input.issuerId,
		reviewerId: input.reviewerId,
		reviewKind: input.kind,
		manifestPath: input.manifestPath,
		manifestSha256: input.manifestSha256,
		targetId: target.targetId,
		targetPath: input.targetPath,
		targetSha256: familyAffinitySha256(target),
		productionAssignmentPath: input.productionAssignmentPath,
		productionAssignmentSha256: familyAffinitySha256(productionAssignment),
		coordinateId: target.coordinateId,
		candidateVersion: target.version,
		decisionVersion: input.decisionVersion,
		candidatePath: input.result.candidatePath,
		candidateSha256: input.result.candidateSha256,
		resultPath: input.result.resultPath,
		resultSha256: input.resultSha256,
		sourcePath: input.result.sourcePath,
		sourceSha256: input.result.sourceSha256,
		promptSha256: input.result.promptSha256,
		permittedReceiptPath: input.permittedReceiptPath
	});
}

export function familyAffinityPromptSha256(targetInput: unknown, assignmentInput: unknown): string {
	const target = FamilyAffinityTargetSchema.parse(targetInput);
	const assignment = FamilyAffinityAssignmentSchema.parse(assignmentInput);
	validateFamilyAffinityAttemptCrossBinding(
		{
			namespace: target.namespace,
			coordinateId: target.coordinateId,
			familyId: target.familyId,
			formId: target.formId,
			currentClassId: target.currentClassId,
			affinity: target.affinity,
			activeVersion: target.version,
			targetPath:
				target.namespace === 'canonical'
					? canonicalAttemptPaths(
							target.familyId,
							target.formId,
							target.affinity,
							target.version,
							familyProductionTargetExperimentId(target)
						).target
					: bridgeAttemptPaths(target.currentClassId!, target.affinity, target.version).target,
			targetSha256: familyAffinitySha256(target),
			assignmentPath:
				target.namespace === 'canonical'
					? canonicalAttemptPaths(
							target.familyId,
							target.formId,
							target.affinity,
							target.version,
							familyProductionTargetExperimentId(target)
						).assignment
					: bridgeAttemptPaths(target.currentClassId!, target.affinity, target.version).assignment,
			assignmentSha256: familyAffinitySha256(assignment),
			status: target.status
		},
		target,
		assignment
	);
	return familyAffinitySha256({
		schemaVersion: 'family-affinity-prompt-material-v1',
		target,
		assignment
	});
}

export function validateFamilyAffinityCandidateEvidence(input: {
	target: unknown;
	assignment: unknown;
	familyPacketBytes: Uint8Array;
	candidateBytes: Uint8Array;
	resultBytes: Uint8Array;
}): {
	target: FamilyAffinityTarget;
	assignment: FamilyAffinityAssignment;
	result: FamilyAffinityResult;
	resultSha256: string;
} {
	const target = FamilyAffinityTargetSchema.parse(input.target);
	const assignment = FamilyAffinityAssignmentSchema.parse(input.assignment);
	const sourcePacket = validateFamilyAffinitySourcePacket(target, input.familyPacketBytes);
	const result = FamilyAffinityResultSchema.parse(
		JSON.parse(Buffer.from(input.resultBytes).toString('utf8'))
	);
	const sourceBinding = familyAffinitySourcePacketBinding(target);
	const sourceSha256 = familyAffinitySha256(sourcePacket);
	const promptSha256 = familyAffinityPromptSha256(target, assignment);
	if (
		result.targetId !== target.targetId ||
		result.targetSha256 !== familyAffinitySha256(target) ||
		result.coordinateId !== target.coordinateId ||
		result.candidateVersion !== target.version ||
		result.candidatePath !== target.ownedPaths.candidate ||
		result.candidateSha256 !== familyAffinityRawSha256(input.candidateBytes) ||
		result.resultPath !== target.ownedPaths.result ||
		result.sourcePath !== sourceBinding.path ||
		sourceSha256 !== sourceBinding.sha256 ||
		result.sourceSha256 !== sourceSha256 ||
		result.promptSha256 !== promptSha256 ||
		result.producerId.trim().length === 0
	) {
		throw new Error('Candidate result evidence is stale, forged, or cross-bound');
	}
	return {
		target,
		assignment,
		result,
		resultSha256: familyAffinityRawSha256(input.resultBytes)
	};
}

export function validateFamilyAffinityReceiptEvidence(input: {
	target: unknown;
	result: FamilyAffinityResult;
	resultSha256: string;
	receipt: unknown;
	kind: 'ordinary' | 'blind';
}): FamilyAffinityReviewReceipt | FamilyAffinityBlindReviewReceipt {
	const target = FamilyAffinityTargetSchema.parse(input.target);
	const receipt =
		input.kind === 'ordinary'
			? FamilyAffinityReviewReceiptSchema.parse(input.receipt)
			: FamilyAffinityBlindReviewReceiptSchema.parse(input.receipt);
	if (
		receipt.receiptType !== input.kind ||
		receipt.targetId !== target.targetId ||
		receipt.targetSha256 !== familyAffinitySha256(target) ||
		receipt.coordinateId !== target.coordinateId ||
		receipt.candidateVersion !== target.version ||
		receipt.producerIdentitySha256 !==
			familyAffinityProducerIdentitySha256(input.result.producerId) ||
		(receipt.receiptType === 'ordinary' && receipt.producerId !== input.result.producerId) ||
		receipt.reviewerId === input.result.producerId ||
		receipt.candidatePath !== input.result.candidatePath ||
		receipt.candidateSha256 !== input.result.candidateSha256 ||
		receipt.resultPath !== input.result.resultPath ||
		receipt.resultSha256 !== input.resultSha256 ||
		receipt.sourcePath !== input.result.sourcePath ||
		receipt.sourceSha256 !== input.result.sourceSha256 ||
		receipt.promptSha256 !== input.result.promptSha256
	) {
		throw new Error('Review receipt evidence is stale, forged, or cross-bound');
	}
	if (
		(target.anchor.kind === 'earth-bridge-provisional' ||
			target.anchor.kind === 'normal-verified-candidate') &&
		receipt.decision === 'approved-review'
	) {
		throw new Error(
			target.anchor.kind === 'earth-bridge-provisional'
				? 'Provisional Earth target cannot reach approved-review before its canonical Normal anchor'
				: 'Provisional target cannot reach approved-review before its Normal anchor is approved'
		);
	}
	return receipt;
}

export function validateFamilyAffinityReviewAssignmentEvidence(input: {
	reviewAssignment: unknown;
	reviewAssignmentPath: string;
	kind: 'ordinary' | 'blind';
	manifestPath: string;
	manifestSha256?: string;
	target: unknown;
	targetPath: string;
	productionAssignment: unknown;
	productionAssignmentPath: string;
	result: FamilyAffinityResult;
	resultSha256: string;
}): FamilyAffinityReviewAssignment {
	const target = FamilyAffinityTargetSchema.parse(input.target);
	const productionAssignment = FamilyAffinityAssignmentSchema.parse(input.productionAssignment);
	const assignment = FamilyAffinityReviewAssignmentSchema.parse(input.reviewAssignment);
	const permittedReceiptPath =
		input.kind === 'ordinary' ? target.ownedPaths.decision : target.ownedPaths.blindReview;
	const expectedIssuerAttestationSha256 = familyAffinityReviewIssuerAttestationSha256({
		issuerId: assignment.issuerId,
		reviewerId: assignment.reviewerId,
		kind: input.kind,
		manifestPath: assignment.manifestPath,
		manifestSha256: assignment.manifestSha256,
		target,
		targetPath: input.targetPath,
		productionAssignment,
		productionAssignmentPath: input.productionAssignmentPath,
		result: input.result,
		resultSha256: input.resultSha256,
		decisionVersion: assignment.decisionVersion,
		permittedReceiptPath
	});
	if (
		assignment.issuerRole !== 'controller' ||
		assignment.issuerAttestationSha256 !== expectedIssuerAttestationSha256 ||
		assignment.reviewKind !== input.kind ||
		input.reviewAssignmentPath !==
			familyAffinityReviewAssignmentPath(input.kind, target, assignment.decisionVersion) ||
		assignment.manifestPath !== input.manifestPath ||
		(input.manifestSha256 !== undefined && assignment.manifestSha256 !== input.manifestSha256) ||
		assignment.targetId !== target.targetId ||
		assignment.targetPath !== input.targetPath ||
		assignment.targetSha256 !== familyAffinitySha256(target) ||
		assignment.productionAssignmentPath !== input.productionAssignmentPath ||
		assignment.productionAssignmentSha256 !== familyAffinitySha256(productionAssignment) ||
		assignment.coordinateId !== target.coordinateId ||
		assignment.candidateVersion !== target.version ||
		assignment.decisionVersion !== target.version ||
		assignment.issuerId === input.result.producerId ||
		assignment.reviewerId === input.result.producerId ||
		assignment.producerIdentitySha256 !==
			familyAffinityProducerIdentitySha256(input.result.producerId) ||
		(input.kind === 'ordinary'
			? assignment.producerId !== input.result.producerId
			: assignment.producerId !== null) ||
		assignment.candidatePath !== input.result.candidatePath ||
		assignment.candidateSha256 !== input.result.candidateSha256 ||
		assignment.resultPath !== input.result.resultPath ||
		assignment.resultSha256 !== input.resultSha256 ||
		assignment.sourcePath !== input.result.sourcePath ||
		assignment.sourceSha256 !== input.result.sourceSha256 ||
		assignment.promptSha256 !== input.result.promptSha256 ||
		assignment.permittedReceiptPath !== permittedReceiptPath ||
		(input.kind === 'blind' && target.tier !== 'T3' && target.tier !== 'T5')
	) {
		throw new Error('Review assignment is stale, forged, unauthorized, or cross-bound');
	}
	return assignment;
}

export function stableFamilyAffinityJson(value: unknown): string {
	return `${stableJson(value)}\n`;
}

function requireExactOrderedIds(mappingIds: string[], visualIndexIds: string[]): void {
	const hasExactSet =
		mappingIds.length === visualIndexIds.length &&
		new Set(mappingIds).size === mappingIds.length &&
		mappingIds.every((id) => visualIndexIds.includes(id));
	if (!hasExactSet) {
		throw new Error('Current class mapping IDs must exactly match the visual index IDs');
	}
	if (mappingIds.some((id, index) => id !== visualIndexIds[index])) {
		throw new Error('Current class mapping entries must preserve visual index order');
	}
}

export function auditCurrentClassMapping(
	mappingInput: unknown,
	visualIndexClasses: CurrentClassVisualSource[],
	familyPackets: FamilyPacket[]
): CurrentClassMappingAudit {
	const mapping = CurrentClassMappingFileSchema.parse(mappingInput);
	const mappingIds = mapping.entries.map(({ currentClassId }) => currentClassId);
	const visualIndexIds = visualIndexClasses.map(({ id }) => id);
	requireExactOrderedIds(mappingIds, visualIndexIds);

	if (new Set(visualIndexIds).size !== visualIndexIds.length) {
		throw new Error('Visual index current class IDs must be unique');
	}

	const sourceClassesById = new Map(visualIndexClasses.map((entry) => [entry.id, entry]));
	const canonicalPairs = new Set(
		familyPackets.flatMap((family) =>
			family.forms.map((form) => `${family.familyId}/${form.formId}`)
		)
	);
	const claimedCanonicalPairs = new Set<string>();
	const dispositionCounts = Object.fromEntries(
		CURRENT_CLASS_DISPOSITIONS.map((disposition) => [disposition, 0])
	) as CurrentClassMappingAudit['dispositionCounts'];
	const candidateReuseCounts = Object.fromEntries(
		PRODUCTION_AFFINITIES.map((affinity) => [affinity, 0])
	) as CurrentClassMappingAudit['candidateReuseCounts'];

	for (const entry of mapping.entries) {
		const sourceClass = sourceClassesById.get(entry.currentClassId)!;
		if (entry.sourceRoster !== CURRENT_CLASS_SOURCE_ROSTER) {
			throw new Error(
				`${entry.currentClassId} sourceRoster must be ${CURRENT_CLASS_SOURCE_ROSTER}`
			);
		}
		if (entry.sourceFamilyLabel !== sourceClass.familyName) {
			throw new Error(`${entry.currentClassId} sourceFamilyLabel must match the visual index`);
		}
		const requestedReuseAffinity = PRODUCTION_AFFINITIES.find(
			(affinity) => entry.candidateReuseByAffinity[affinity]
		);
		if (requestedReuseAffinity) {
			throw new Error(
				`${entry.currentClassId} ${requestedReuseAffinity} candidate reuse is unavailable until source/canonical-bound structured review evidence exists`
			);
		}

		dispositionCounts[entry.disposition] += 1;
		if (entry.disposition === 'map' || entry.disposition === 'rename-map') {
			const canonicalPair = `${entry.canonicalFamilyId}/${entry.canonicalFormId}`;
			if (!canonicalPairs.has(canonicalPair)) {
				throw new Error(
					`${entry.currentClassId} canonical family/form pair does not exist: ${canonicalPair}`
				);
			}
			if (claimedCanonicalPairs.has(canonicalPair)) {
				throw new Error(`Canonical primary form is claimed more than once: ${canonicalPair}`);
			}
			claimedCanonicalPairs.add(canonicalPair);
		}
	}

	const canonicalPrimaryCount = dispositionCounts.map + dispositionCounts['rename-map'];
	const bridgeOnlyCount = dispositionCounts['secondary-archetype'] + dispositionCounts.fauna;
	const retainedBridgeCurrentClassIds = mapping.entries
		.filter(({ disposition }) => disposition !== 'retire')
		.map(({ currentClassId }) => currentClassId);
	const bridgeOnlyCurrentClassIds = mapping.entries
		.filter(({ disposition }) => disposition === 'secondary-archetype' || disposition === 'fauna')
		.map(({ currentClassId }) => currentClassId);
	const canonicalPrimaryCurrentClassIds = mapping.entries
		.filter(({ disposition }) => disposition === 'map' || disposition === 'rename-map')
		.map(({ currentClassId }) => currentClassId);

	return {
		dispositionCounts,
		retainedBridgeCount: retainedBridgeCurrentClassIds.length,
		bridgeOnlyCount,
		canonicalPrimaryCount,
		uniqueCanonicalClaims: claimedCanonicalPairs.size,
		candidateReuseCounts,
		retainedBridgeCurrentClassIds,
		bridgeOnlyCurrentClassIds,
		canonicalPrimaryCurrentClassIds
	};
}

export function familyPacketPath(family: FamilyPacket): string {
	return (
		family.packetPath ??
		`${FAMILY_AFFINITY_ROOT}/families/${String(family.sourceRaceNumber).padStart(2, '0')}-${family.familyId}.json`
	);
}

export function currentClassMappingPath(mapping: CurrentClassMappingFile): string {
	return mapping.mappingPath ?? FAMILY_AFFINITY_LEGACY_MAPPING_PATH;
}

export function canonicalAttemptPaths(
	familyId: string,
	formId: string,
	affinity: (typeof PRODUCTION_AFFINITIES)[number],
	version: number,
	experimentId: FamilyProductionExperimentId = 'family-affinity-v1'
) {
	const root = familyProductionRoot(experimentId);
	return {
		target: `${root}/targets/${familyId}/${formId}/${affinity}/target-v${version}.json`,
		assignment: `${root}/assignments/${familyId}/${formId}/${affinity}/assignment-v${version}.json`,
		candidate: `${root}/candidates/${familyId}/${formId}/${affinity}-v${version}.png`,
		result: `${root}/results/${familyId}/${formId}/${affinity}-v${version}.json`,
		decision: `${root}/review/decisions/${familyId}/${formId}/${affinity}/candidate-v${version}-review-v${version}.json`,
		blindReview: `${root}/review/blind/${familyId}/${formId}/${affinity}/candidate-v${version}-blind-v${version}.json`
	};
}

export function bridgeAttemptPaths(
	currentClassId: string,
	affinity: (typeof PRODUCTION_AFFINITIES)[number],
	version: number
) {
	IdSchema.parse(currentClassId);
	if (!Number.isInteger(version) || version < 1)
		throw new Error('Bridge attempt version must be positive');
	const bridgeRoot = `${FAMILY_AFFINITY_ROOT}/bridge`;
	return {
		target: `${bridgeRoot}/targets/${currentClassId}/${affinity}/target-v${version}.json`,
		assignment: `${bridgeRoot}/assignments/${currentClassId}/${affinity}/assignment-v${version}.json`,
		candidate: `${bridgeRoot}/candidates/${currentClassId}/${affinity}-v${version}.png`,
		result: `${bridgeRoot}/results/${currentClassId}/${affinity}-v${version}.json`,
		decision: `${FAMILY_AFFINITY_ROOT}/review/bridge/decisions/${currentClassId}/${affinity}/candidate-v${version}-review-v${version}.json`,
		blindReview: `${FAMILY_AFFINITY_ROOT}/review/bridge/blind/${currentClassId}/${affinity}/candidate-v${version}-blind-v${version}.json`
	};
}

export function familyAffinityReviewAssignmentPath(
	kind: 'ordinary' | 'blind',
	target: FamilyAffinityTarget,
	decisionVersion: number
): string {
	if (!Number.isInteger(decisionVersion) || decisionVersion < 1) {
		throw new Error('Review decision version must be positive');
	}
	const bucket = kind === 'ordinary' ? 'decisions' : 'blind';
	if (target.namespace === 'bridge') {
		return `${FAMILY_AFFINITY_ROOT}/review/bridge/assignments/${bucket}/${target.currentClassId}/${target.affinity}/candidate-v${target.version}-${kind}-v${decisionVersion}-assignment.json`;
	}
	return `${FAMILY_AFFINITY_ROOT}/review/assignments/${bucket}/${target.familyId}/${target.formId}/${target.affinity}/candidate-v${target.version}-${kind}-v${decisionVersion}-assignment.json`;
}

function formTelegraph(form: FamilyForm): string {
	return form.telegraph ?? form.signatureMechanic ?? form.teachingGoal;
}

function formCounterplay(form: FamilyForm): string {
	return form.counterplay ?? form.teachingGoal;
}

function buildCanonicalTarget(
	family: FamilyPacket,
	form: FamilyForm,
	affinity: (typeof PRODUCTION_AFFINITIES)[number],
	normalTarget?: FamilyAffinityTarget,
	mappingPath: string = FAMILY_AFFINITY_LEGACY_MAPPING_PATH,
	experimentId: FamilyProductionExperimentId = 'family-affinity-v1',
	sourcePacketPath: string = familyPacketPath(family)
): FamilyAffinityTarget {
	const coordinateId = `${family.familyId}/${form.formId}/${affinity}`;
	const version = 1;
	const paths = canonicalAttemptPaths(
		family.familyId,
		form.formId,
		affinity,
		version,
		experimentId
	);
	const theme = family.affinityThemes[affinity];
	const status = affinity === 'normal' ? 'planned' : 'blocked-on-anchor';
	const target = {
		schemaVersion: 'family-affinity-target-v1',
		...(experimentId === 'fauna-family-v1' ? { experimentId } : {}),
		namespace: 'canonical',
		coordinateId,
		targetId:
			experimentId === 'family-affinity-v1'
				? `canonical/${coordinateId}/v${version}`
				: `${experimentId}/canonical/${coordinateId}/v${version}`,
		familyId: family.familyId,
		...(experimentId === 'fauna-family-v1'
			? { familyDisplayName: family.displayName, formDisplayName: form.displayName }
			: {}),
		formId: form.formId,
		currentClassId: null,
		affinity,
		tier: form.tier,
		primaryArchetype: form.primaryArchetype,
		battlefieldDuty: form.battlefieldDuty,
		identityInvariants: family.visualConstants,
		anatomyInvariants: [
			form.visualDelta,
			`Signature mechanic: ${form.signatureMechanic ?? form.teachingGoal}`
		],
		constructionDimensions: theme.constructionDimensions,
		telegraph: formTelegraph(form),
		counterplay: `${formCounterplay(form)} Affinity signal: ${theme.counterplaySignal}`,
		forbiddenTreatments: theme.forbidden,
		sources: {
			familyPacketPath: sourcePacketPath,
			familyPacketSha256: familyAffinitySha256(family),
			sourcePage: family.sourcePage,
			sourceReferences: form.sourceReferences,
			mappingPath
		},
		presentationContract: {
			framing: 'full-body-readable',
			background: 'cinematic-neutral-environment',
			featuredSubjects: 1,
			textAllowed: false,
			watermarkAllowed: false
		},
		acceptanceCriteria: [
			`Recognizably belongs to the ${family.displayName} family and preserves every identity invariant.`,
			`Reads specifically as ${form.displayName}, ${form.tier}, rather than another family form.`,
			`Communicates the ${form.primaryArchetype} archetype and its battlefield duty.`,
			'Preserves coherent load-bearing anatomy, complete limbs, and believable ground contact.',
			`Uses at least two ${affinity} construction dimensions without a palette-only or glow-only treatment.`,
			'Keeps the attack telegraph and counterplay signal visible at gameplay scale.',
			'Frames one complete featured subject with no crop, labels, UI text, or watermark.',
			'Output remains a candidate until independent approved-review evidence exists; it is never a runtime asset.'
		],
		ownedPaths: {
			candidate: paths.candidate,
			result: paths.result,
			decision: paths.decision,
			blindReview: paths.blindReview
		},
		anchor:
			affinity === 'normal'
				? { kind: 'normal-self' as const }
				: {
						kind: 'normal-approved-review' as const,
						normalCoordinateId: `${family.familyId}/${form.formId}/normal`,
						normalVersion: normalTarget!.version,
						normalTargetPath: canonicalAttemptPaths(
							family.familyId,
							form.formId,
							'normal',
							normalTarget!.version,
							experimentId
						).target,
						normalTargetSha256: familyAffinitySha256(normalTarget!),
						reviewReceiptPath: normalTarget!.ownedPaths.decision,
						reviewReceiptSha256: null,
						normalCandidatePath: null,
						normalCandidateSha256: null,
						normalResultPath: null,
						normalResultSha256: null
					},
		precedingAttempt: null,
		version,
		status,
		promotionCeiling: 'approved-review',
		runtimeCatalogMutationForbidden: true
	};
	return FamilyAffinityTargetSchema.parse(target);
}

const CANONICAL_TARGET_SOURCE_FIELDS = [
	'familyId',
	'familyDisplayName',
	'formId',
	'formDisplayName',
	'currentClassId',
	'affinity',
	'tier',
	'primaryArchetype',
	'battlefieldDuty',
	'identityInvariants',
	'anatomyInvariants',
	'constructionDimensions',
	'telegraph',
	'counterplay',
	'forbiddenTreatments',
	'sources',
	'presentationContract',
	'acceptanceCriteria',
	'promotionCeiling',
	'runtimeCatalogMutationForbidden'
] as const;

/**
 * Proves that an active canonical attempt still expresses its packet's authored mechanics.
 * Revision-only evidence, version, and owned paths deliberately remain outside this comparison.
 */
export function validateCanonicalTargetSourceBinding(
	targetInput: unknown,
	familyInput: unknown,
	formInput: unknown
): void {
	const target = FamilyAffinityTargetSchema.parse(targetInput);
	const family = FamilyPacketSchema.parse(familyInput);
	const form = FamilyFormSchema.parse(formInput);
	if (target.namespace !== 'canonical') {
		throw new Error('Packet-to-target source binding applies only to canonical targets');
	}
	if (family.familyId !== target.familyId || form.formId !== target.formId) {
		throw new Error(`Packet-to-target source identity drift: ${target.coordinateId}`);
	}
	const expectedNormal = buildCanonicalTarget(
		family,
		form,
		'normal',
		undefined,
		target.sources.mappingPath,
		familyProductionTargetExperimentId(target),
		target.sources.familyPacketPath
	);
	const expected =
		target.affinity === 'normal'
			? expectedNormal
			: buildCanonicalTarget(
					family,
					form,
					target.affinity,
					expectedNormal,
					target.sources.mappingPath,
					familyProductionTargetExperimentId(target),
					target.sources.familyPacketPath
				);
	for (const field of CANONICAL_TARGET_SOURCE_FIELDS) {
		if (stableJson(target[field]) !== stableJson(expected[field])) {
			throw new Error(`Packet-to-target source drift for ${target.coordinateId}: ${field}`);
		}
	}
}

function buildCanonicalFormTargets(
	family: FamilyPacket,
	form: FamilyForm,
	mappingPath: string,
	experimentId: FamilyProductionExperimentId = 'family-affinity-v1',
	sourcePacketPath: string = familyPacketPath(family)
): FamilyAffinityTarget[] {
	const normal = buildCanonicalTarget(
		family,
		form,
		'normal',
		undefined,
		mappingPath,
		experimentId,
		sourcePacketPath
	);
	return [
		normal,
		...PRODUCTION_AFFINITIES.filter((affinity) => affinity !== 'normal').map((affinity) =>
			buildCanonicalTarget(
				family,
				form,
				affinity,
				normal,
				mappingPath,
				experimentId,
				sourcePacketPath
			)
		)
	];
}

function buildAssignment(target: FamilyAffinityTarget): FamilyAffinityAssignment {
	return FamilyAffinityAssignmentSchema.parse({
		schemaVersion: 'family-affinity-assignment-v1',
		...(target.experimentId === undefined ? {} : { experimentId: target.experimentId }),
		assignmentId: `${target.targetId}/assignment`,
		targetId: target.targetId,
		targetSha256: familyAffinitySha256(target),
		coordinateId: target.coordinateId,
		namespace: target.namespace,
		version: target.version,
		producerRole: 'image-producer',
		allowedOutputs: {
			candidate: target.ownedPaths.candidate,
			result: target.ownedPaths.result
		},
		retryCeiling: 1,
		dispatchStatus: target.status,
		selfPromotionForbidden: true,
		runtimeCatalogMutationForbidden: true
	});
}

export function buildFamilyAffinityProductionBundle(
	familyInputs: unknown[],
	mappingInput: unknown
): FamilyAffinityProductionBundle {
	const families = familyInputs.map((input) => FamilyPacketSchema.parse(input));
	const mapping = CurrentClassMappingFileSchema.parse(mappingInput);
	const mappingPath = currentClassMappingPath(mapping);
	if (families.length !== 30) throw new Error('Canonical matrix requires exactly 30 families');
	if (new Set(families.map(({ familyId }) => familyId)).size !== 30) {
		throw new Error('Canonical matrix requires 30 unique family IDs');
	}
	if (new Set(families.map(({ sourceRaceNumber }) => sourceRaceNumber)).size !== 30) {
		throw new Error('Canonical family source race numbers must be unique');
	}
	const sortedFamilies = [...families].sort(
		(a, b) => a.sourceRaceNumber - b.sourceRaceNumber || a.familyId.localeCompare(b.familyId)
	);
	const targets = sortedFamilies.flatMap((family) =>
		[...family.forms]
			.sort((a, b) => FORM_TIERS.indexOf(a.tier) - FORM_TIERS.indexOf(b.tier))
			.flatMap((form) =>
				buildCanonicalFormTargets(
					family,
					form,
					family.packetPath === undefined ? FAMILY_AFFINITY_LEGACY_MAPPING_PATH : mappingPath
				)
			)
	);
	const assignments = targets.map(buildAssignment);
	const targetPathById = new Map(
		targets.map((target) => [
			target.targetId,
			canonicalAttemptPaths(target.familyId, target.formId, target.affinity, target.version).target
		])
	);
	const assignmentPathById = new Map(
		assignments.map((assignment) => [
			assignment.assignmentId,
			canonicalAttemptPaths(
				targets.find(({ targetId }) => targetId === assignment.targetId)!.familyId,
				targets.find(({ targetId }) => targetId === assignment.targetId)!.formId,
				targets.find(({ targetId }) => targetId === assignment.targetId)!.affinity,
				assignment.version
			).assignment
		])
	);
	const assignmentByTargetId = new Map(
		assignments.map((assignment) => [assignment.targetId, assignment])
	);
	const activeCoordinates = targets.map((target) => {
		const assignment = assignmentByTargetId.get(target.targetId)!;
		return {
			namespace: 'canonical' as const,
			coordinateId: target.coordinateId,
			familyId: target.familyId,
			formId: target.formId,
			currentClassId: null,
			affinity: target.affinity,
			activeVersion: target.version,
			targetPath: targetPathById.get(target.targetId)!,
			targetSha256: assignment.targetSha256,
			assignmentPath: assignmentPathById.get(assignment.assignmentId)!,
			assignmentSha256: familyAffinitySha256(assignment),
			status: target.status
		};
	});
	const secondaryArchetypeIds = mapping.entries
		.filter(({ disposition }) => disposition === 'secondary-archetype')
		.map(({ currentClassId }) => currentClassId);
	const faunaIds = mapping.entries
		.filter(({ disposition }) => disposition === 'fauna')
		.map(({ currentClassId }) => currentClassId);
	const manifest = FamilyAffinityManifestSchema.parse({
		schemaVersion: 'family-affinity-manifest-v1',
		experimentId: 'family-affinity-v1',
		canonicalMatrix: {
			familyCount: 30,
			formCount: 150,
			affinities: PRODUCTION_AFFINITIES,
			targetCount: 750,
			assignmentCount: 750,
			activeCoordinates
		},
		bridge: { targetCount: 0, assignmentCount: 0, activeCoordinates: [] },
		mappingReservations: {
			sourcePath: mappingPath,
			retainedCurrentClassCount: mapping.entries.filter(
				({ disposition }) => disposition !== 'retire'
			).length,
			canonicalPrimaryCount: mapping.entries.filter(
				({ disposition }) => disposition === 'map' || disposition === 'rename-map'
			).length,
			bridgeOnlyCount: secondaryArchetypeIds.length + faunaIds.length,
			secondaryArchetypeIds,
			faunaIds
		},
		ownership: {
			controllerRole: 'integration-controller',
			producerSelfPromotionForbidden: true,
			runtimeCatalogMutationForbidden: true
		}
	});
	const artifacts: Array<{ path: string; value: unknown }> = [
		{ path: `${FAMILY_AFFINITY_ROOT}/manifest.json`, value: manifest },
		...targets.map((target) => ({ path: targetPathById.get(target.targetId)!, value: target })),
		...assignments.map((assignment) => ({
			path: assignmentPathById.get(assignment.assignmentId)!,
			value: assignment
		}))
	];
	const bundle = { manifest, targets, assignments, artifacts };
	validateFamilyAffinityProductionBundle(bundle);
	return bundle;
}

export type FaunaFamilyProductionBundle = {
	manifest: FaunaFamilyManifest;
	targets: FamilyAffinityTarget[];
	assignments: FamilyAffinityAssignment[];
	artifacts: Array<{ path: string; value: unknown }>;
};

export function buildFaunaFamilyProductionBundle(
	familyInputs: unknown[],
	designManifestInput: unknown,
	activeSourcesPath: string = `${FAUNA_FAMILY_ROOT}/active-sources.json`
): FaunaFamilyProductionBundle {
	const families = familyInputs.map((input) => FamilyPacketSchema.parse(input));
	if (families.length !== 8 || new Set(families.map(({ familyId }) => familyId)).size !== 8) {
		throw new Error('Fauna matrix requires exactly eight unique families');
	}
	const sortedFamilies = [...families].sort(
		(left, right) => left.sourceRaceNumber - right.sourceRaceNumber
	);
	if (sortedFamilies.some((family, index) => family.sourceRaceNumber !== index + 31)) {
		throw new Error('Fauna families must preserve source race order 31 through 38');
	}
	const design = z
		.object({
			schemaVersion: z.literal('fauna-family-design-manifest-v1'),
			experimentId: z.literal('fauna-family-v1'),
			status: z.literal('design-complete-production-not-started'),
			scope: z.unknown(),
			production: z.unknown(),
			legacyClassMigrations: z.array(z.record(z.string(), z.unknown())),
			ownership: z.unknown()
		})
		.strict()
		.parse(designManifestInput);
	const packetPathByFamilyId = new Map(
		sortedFamilies.map((family) => [
			family.familyId,
			`${FAUNA_FAMILY_ROOT}/families/${String(family.sourceRaceNumber - 30).padStart(2, '0')}-${family.familyId}.json`
		])
	);
	const targets = sortedFamilies.flatMap((family) =>
		[...family.forms]
			.sort((left, right) => FORM_TIERS.indexOf(left.tier) - FORM_TIERS.indexOf(right.tier))
			.flatMap((form) =>
				buildCanonicalFormTargets(
					family,
					form,
					activeSourcesPath,
					'fauna-family-v1',
					packetPathByFamilyId.get(family.familyId)!
				)
			)
	);
	const assignments = targets.map(buildAssignment);
	const assignmentByTargetId = new Map(
		assignments.map((assignment) => [assignment.targetId, assignment])
	);
	const activeCoordinates = targets.map((target) => {
		const assignment = assignmentByTargetId.get(target.targetId)!;
		const paths = canonicalAttemptPaths(
			target.familyId,
			target.formId,
			target.affinity,
			target.version,
			'fauna-family-v1'
		);
		return {
			namespace: 'canonical' as const,
			coordinateId: target.coordinateId,
			familyId: target.familyId,
			formId: target.formId,
			currentClassId: null,
			affinity: target.affinity,
			activeVersion: target.version,
			targetPath: paths.target,
			targetSha256: familyAffinitySha256(target),
			assignmentPath: paths.assignment,
			assignmentSha256: familyAffinitySha256(assignment),
			status: target.status
		};
	});
	const designRecord = design as {
		scope: unknown;
		legacyClassMigrations: Array<Record<string, unknown>>;
	};
	const manifest = FaunaFamilyManifestSchema.parse({
		schemaVersion: 'fauna-family-production-manifest-v1',
		experimentId: 'fauna-family-v1',
		status: 'production-materialized',
		scope: designRecord.scope,
		canonicalMatrix: {
			familyCount: 8,
			formCount: 40,
			affinities: PRODUCTION_AFFINITIES,
			targetCount: 200,
			assignmentCount: 200,
			activeCoordinates
		},
		production: {
			targetMaterializationStatus: 'materialized',
			targetCount: 200,
			assignmentCount: 200,
			candidateCount: 0,
			approvedCount: 0,
			runtimeCount: 0,
			reviewCheckpoint: 'after-new-fauna-candidate-matrix-is-complete',
			runtimeCatalogMutationForbidden: true
		},
		legacyClassMigrations: designRecord.legacyClassMigrations,
		ownership: {
			domain: 'enemies-visuals',
			controllerRole: 'integration-controller',
			candidatesAreNotApproved: true,
			approvedAssetsAreNotRuntime: true,
			producerSelfPromotionForbidden: true,
			runtimeCatalogMutationForbidden: true
		}
	});
	const artifacts: Array<{ path: string; value: unknown }> = [
		{ path: `${FAUNA_FAMILY_ROOT}/manifest.json`, value: manifest },
		...activeCoordinates.flatMap((coordinate, index) => [
			{ path: coordinate.targetPath, value: targets[index]! },
			{ path: coordinate.assignmentPath, value: assignments[index]! }
		])
	];
	const bundle = { manifest, targets, assignments, artifacts };
	validateFaunaFamilyProductionBundle(bundle, families);
	return bundle;
}

export function validateFaunaFamilyProductionBundle(
	bundleInput: FaunaFamilyProductionBundle,
	familyInputs: unknown[]
): void {
	const manifest = FaunaFamilyManifestSchema.parse(bundleInput.manifest);
	const families = familyInputs.map((input) => FamilyPacketSchema.parse(input));
	const familyById = new Map(families.map((family) => [family.familyId, family]));
	const targets = bundleInput.targets.map((target) => FamilyAffinityTargetSchema.parse(target));
	const assignments = bundleInput.assignments.map((assignment) =>
		FamilyAffinityAssignmentSchema.parse(assignment)
	);
	if (targets.length !== 200 || assignments.length !== 200) {
		throw new Error('Fauna bundle requires exactly 200 target and assignment pairs');
	}
	const targetByCoordinate = new Map(targets.map((target) => [target.coordinateId, target]));
	const assignmentByCoordinate = new Map(
		assignments.map((assignment) => [assignment.coordinateId, assignment])
	);
	if (targetByCoordinate.size !== 200 || assignmentByCoordinate.size !== 200) {
		throw new Error('Fauna target and assignment coordinates must be unique');
	}
	for (const coordinate of manifest.canonicalMatrix.activeCoordinates) {
		const target = targetByCoordinate.get(coordinate.coordinateId);
		const assignment = assignmentByCoordinate.get(coordinate.coordinateId);
		if (!target || !assignment)
			throw new Error(`Incomplete fauna pair: ${coordinate.coordinateId}`);
		validateFamilyAffinityAttemptCrossBinding(coordinate, target, assignment);
		const family = familyById.get(target.familyId);
		const form = family?.forms.find(({ formId }) => formId === target.formId);
		if (!family || !form) throw new Error(`Unknown fauna source: ${coordinate.coordinateId}`);
		validateCanonicalTargetSourceBinding(target, family, form);
	}
	const ownedOutputs = targets.flatMap((target) => [
		target.ownedPaths.candidate,
		target.ownedPaths.result
	]);
	if (new Set(ownedOutputs).size !== 400) {
		throw new Error('Fauna candidate and result ownership paths must be exclusive');
	}
	for (const family of families) {
		const familyTargets = targets.filter((target) => target.familyId === family.familyId);
		if (familyTargets.length !== 25) throw new Error('Each fauna family requires 25 targets');
		for (const form of family.forms) {
			const affinities = familyTargets
				.filter((target) => target.formId === form.formId)
				.map((target) => target.affinity);
			if (stableJson(affinities) !== stableJson(PRODUCTION_AFFINITIES)) {
				throw new Error(`Fauna affinity order drifted: ${family.familyId}/${form.formId}`);
			}
		}
	}
}

type ManifestCoordinate = FamilyAffinityManifest['canonicalMatrix']['activeCoordinates'][number];

export function validateFamilyAffinityAttemptCrossBinding(
	coordinateInput: unknown,
	targetInput: unknown,
	assignmentInput: unknown
): void {
	const coordinate = ManifestCoordinateSchema.parse(coordinateInput);
	const target = FamilyAffinityTargetSchema.parse(targetInput);
	const assignment = FamilyAffinityAssignmentSchema.parse(assignmentInput);
	const targetSha256 = familyAffinitySha256(target);
	const assignmentSha256 = familyAffinitySha256(assignment);
	const sameIdentity =
		coordinate.namespace === target.namespace &&
		coordinate.coordinateId === target.coordinateId &&
		coordinate.currentClassId === target.currentClassId &&
		coordinate.familyId === target.familyId &&
		coordinate.formId === target.formId &&
		coordinate.affinity === target.affinity &&
		coordinate.activeVersion === target.version &&
		coordinate.status === target.status;
	if (!sameIdentity)
		throw new Error(`Manifest coordinate cross-binding mismatch: ${coordinate.coordinateId}`);
	if (
		coordinate.targetSha256 !== targetSha256 ||
		coordinate.assignmentSha256 !== assignmentSha256
	) {
		throw new Error(`Manifest attempt hash cross-binding mismatch: ${coordinate.coordinateId}`);
	}
	if (
		familyProductionTargetExperimentId(target) !==
			(assignment.experimentId ?? 'family-affinity-v1') ||
		assignment.targetId !== target.targetId ||
		assignment.targetSha256 !== targetSha256 ||
		assignment.namespace !== target.namespace ||
		assignment.coordinateId !== target.coordinateId ||
		assignment.version !== target.version ||
		assignment.dispatchStatus !== target.status ||
		assignment.allowedOutputs.candidate !== target.ownedPaths.candidate ||
		assignment.allowedOutputs.result !== target.ownedPaths.result
	) {
		throw new Error(`Assignment cross-binding mismatch: ${assignment.assignmentId}`);
	}
	if (target.namespace === 'canonical') {
		const paths = canonicalAttemptPaths(
			target.familyId,
			target.formId,
			target.affinity,
			target.version,
			familyProductionTargetExperimentId(target)
		);
		if (
			coordinate.targetPath !== paths.target ||
			coordinate.assignmentPath !== paths.assignment ||
			target.ownedPaths.candidate !== paths.candidate ||
			target.ownedPaths.result !== paths.result ||
			target.ownedPaths.decision !== paths.decision ||
			target.ownedPaths.blindReview !== paths.blindReview
		) {
			throw new Error(`Canonical attempt path cross-binding mismatch: ${coordinate.coordinateId}`);
		}
		return;
	}
	const paths = bridgeAttemptPaths(target.currentClassId!, target.affinity, target.version);
	if (
		coordinate.targetPath !== paths.target ||
		coordinate.assignmentPath !== paths.assignment ||
		target.ownedPaths.candidate !== paths.candidate ||
		target.ownedPaths.result !== paths.result ||
		target.ownedPaths.decision !== paths.decision ||
		target.ownedPaths.blindReview !== paths.blindReview
	) {
		throw new Error(`Exact bridge attempt path cross-binding mismatch: ${coordinate.coordinateId}`);
	}
}

export function validateFamilyAffinityProductionBundle(
	bundleInput: FamilyAffinityProductionBundle,
	reviewReceipts: Readonly<Record<string, { receipt: unknown; bytes: Uint8Array }>> = {}
) {
	const manifest = FamilyAffinityManifestSchema.parse(bundleInput.manifest);
	const targets = bundleInput.targets.map((target) => FamilyAffinityTargetSchema.parse(target));
	const assignments = bundleInput.assignments.map((assignment) =>
		FamilyAffinityAssignmentSchema.parse(assignment)
	);
	if (targets.length !== 750)
		throw new Error(`Canonical target count must be 750, received ${targets.length}`);
	if (assignments.length !== 750) {
		throw new Error(`Canonical assignment count must be 750, received ${assignments.length}`);
	}
	if (manifest.canonicalMatrix.activeCoordinates.length !== 750) {
		throw new Error('Manifest must contain exactly 750 active canonical coordinates');
	}
	if (manifest.bridge.targetCount !== manifest.bridge.activeCoordinates.length) {
		throw new Error('Bridge target count must equal its separate active coordinate count');
	}
	if (manifest.bridge.assignmentCount !== manifest.bridge.activeCoordinates.length) {
		throw new Error('Bridge assignment count must equal its separate active coordinate count');
	}
	const coordinateIds = targets.map(({ coordinateId }) => coordinateId);
	if (new Set(coordinateIds).size !== 750)
		throw new Error('Canonical target coordinates must be unique');
	const assignmentCoordinates = assignments.map(({ coordinateId }) => coordinateId);
	if (new Set(assignmentCoordinates).size !== 750) {
		throw new Error('Canonical assignment coordinates must be unique');
	}
	const manifestCoordinateIds = manifest.canonicalMatrix.activeCoordinates.map(
		({ coordinateId }) => coordinateId
	);
	const targetCoordinateSet = new Set(coordinateIds);
	const assignmentCoordinateSet = new Set(assignmentCoordinates);
	if (
		manifestCoordinateIds.some(
			(coordinateId) =>
				!targetCoordinateSet.has(coordinateId) || !assignmentCoordinateSet.has(coordinateId)
		) ||
		coordinateIds.some((coordinateId) => !manifestCoordinateIds.includes(coordinateId)) ||
		assignmentCoordinates.some((coordinateId) => !manifestCoordinateIds.includes(coordinateId))
	) {
		throw new Error(
			'Canonical manifest, target, and assignment coordinates require exact set equality and reverse coverage'
		);
	}
	const targetsById = new Map(targets.map((target) => [target.targetId, target]));
	const targetsByCoordinate = new Map(targets.map((target) => [target.coordinateId, target]));
	const assignmentsByTargetId = new Map(
		assignments.map((assignment) => [assignment.targetId, assignment])
	);
	for (const coordinate of manifest.canonicalMatrix.activeCoordinates) {
		const target = targetsByCoordinate.get(coordinate.coordinateId);
		const assignment = target ? assignmentsByTargetId.get(target.targetId) : undefined;
		if (!target || !assignment) {
			throw new Error(
				`Manifest active coordinate has no complete attempt pair: ${coordinate.coordinateId}`
			);
		}
		validateFamilyAffinityAttemptCrossBinding(coordinate, target, assignment);
	}
	for (const assignment of assignments) {
		const target = targetsById.get(assignment.targetId);
		if (
			!target ||
			target.coordinateId !== assignment.coordinateId ||
			target.version !== assignment.version
		) {
			throw new Error(
				`Assignment does not bind the correct target coordinate: ${assignment.assignmentId}`
			);
		}
		if (assignment.targetSha256 !== familyAffinitySha256(target)) {
			throw new Error(`Assignment target hash mismatch: ${assignment.assignmentId}`);
		}
		if (
			assignment.allowedOutputs.candidate !== target.ownedPaths.candidate ||
			assignment.allowedOutputs.result !== target.ownedPaths.result
		) {
			throw new Error(
				`Assignment outputs do not match target ownership: ${assignment.assignmentId}`
			);
		}
		if (assignment.dispatchStatus !== target.status) {
			throw new Error(
				`Assignment dispatch status does not match target: ${assignment.assignmentId}`
			);
		}
	}
	const ownedOutputPaths = targets.flatMap(({ ownedPaths }) => [
		ownedPaths.candidate,
		ownedPaths.result
	]);
	if (new Set(ownedOutputPaths).size !== 1500)
		throw new Error('Candidate and result paths must be unique');
	const allAttemptPaths = bundleInput.artifacts
		.map(({ path }) => path)
		.concat(targets.flatMap(({ ownedPaths }) => Object.values(ownedPaths)));
	if (new Set(allAttemptPaths).size !== allAttemptPaths.length) {
		throw new Error('Generated and owned paths must not collide');
	}
	if (
		allAttemptPaths.some((path) =>
			/affinity-workflow-v1|enemy-affinity-expansion|\/bridge\//iu.test(path)
		)
	) {
		throw new Error(
			'Canonical paths must not overlap legacy, current bridge, or bridge namespaces'
		);
	}
	const byFamily = new Map<string, FamilyAffinityTarget[]>();
	for (const target of targets) {
		byFamily.set(target.familyId, [...(byFamily.get(target.familyId) ?? []), target]);
		if (target.affinity === 'normal') {
			if (target.status !== 'planned') throw new Error('Normal targets must begin planned');
			continue;
		}
		if (
			target.anchor.kind !== 'normal-approved-review' &&
			target.anchor.kind !== 'normal-verified-candidate'
		) {
			throw new Error(
				`Canonical elemental target requires an exact Normal anchor: ${target.targetId}`
			);
		}
		const anchor = target.anchor;
		const normalTarget = targets.find(
			(candidate) => candidate.coordinateId === anchor.normalCoordinateId
		);
		const normalManifestCoordinate = manifest.canonicalMatrix.activeCoordinates.find(
			(candidate) => candidate.coordinateId === anchor.normalCoordinateId
		);
		if (target.status === 'planned' || target.status === 'planned-provisional-anchor') {
			if (
				!normalTarget ||
				!normalManifestCoordinate ||
				normalTarget.familyId !== target.familyId ||
				normalTarget.formId !== target.formId ||
				normalTarget.affinity !== 'normal' ||
				normalTarget.version !== anchor.normalVersion ||
				normalManifestCoordinate.activeVersion !== anchor.normalVersion ||
				normalManifestCoordinate.targetPath !== anchor.normalTargetPath ||
				normalManifestCoordinate.targetSha256 !== anchor.normalTargetSha256 ||
				familyAffinitySha256(normalTarget) !== anchor.normalTargetSha256
			) {
				throw new Error(
					`Elemental target has a stale, foreign, or manifest-unbound Normal anchor: ${target.targetId}`
				);
			}
			if (anchor.kind === 'normal-verified-candidate') {
				const source = familyAffinitySourcePacketBinding(normalTarget);
				if (
					target.status !== 'planned-provisional-anchor' ||
					anchor.normalCandidatePath !== normalTarget.ownedPaths.candidate ||
					anchor.normalResultPath !== normalTarget.ownedPaths.result ||
					anchor.sourcePacketPath !== source.path ||
					anchor.sourcePacketSha256 !== source.sha256
				) {
					throw new Error(
						`Stale or mismatched Normal verified-candidate anchor: ${target.targetId}`
					);
				}
				continue;
			}
			if (anchor.reviewReceiptSha256 === null) {
				throw new Error(
					`Elemental target cannot be unblocked without a Normal approved-review receipt: ${target.targetId}`
				);
			}
			const receiptEvidence = reviewReceipts[anchor.reviewReceiptPath];
			if (!receiptEvidence)
				throw new Error(`Missing Normal approved-review receipt: ${anchor.reviewReceiptPath}`);
			const receipt = FamilyAffinityReviewReceiptSchema.parse(receiptEvidence.receipt);
			if (
				receipt.decision !== 'approved-review' ||
				familyAffinityRawSha256(receiptEvidence.bytes) !== anchor.reviewReceiptSha256 ||
				receipt.targetId !== normalTarget.targetId ||
				receipt.targetSha256 !== familyAffinitySha256(normalTarget) ||
				normalManifestCoordinate.targetSha256 !== receipt.targetSha256 ||
				anchor.reviewReceiptPath !== normalTarget.ownedPaths.decision ||
				receipt.candidatePath !== normalTarget.ownedPaths.candidate ||
				receipt.candidatePath !== anchor.normalCandidatePath ||
				receipt.candidateSha256 !== anchor.normalCandidateSha256 ||
				receipt.resultPath !== normalTarget.ownedPaths.result ||
				receipt.resultPath !== anchor.normalResultPath ||
				receipt.resultSha256 !== anchor.normalResultSha256
			) {
				throw new Error(`Stale or mismatched Normal approved-review receipt: ${target.targetId}`);
			}
		} else if (target.status !== 'blocked-on-anchor') {
			throw new Error(`Canonical elemental target has illegal initial status: ${target.targetId}`);
		}
	}
	if (byFamily.size !== 30 || [...byFamily.values()].some((entries) => entries.length !== 25)) {
		throw new Error('Canonical matrix requires exactly 25 targets per family');
	}
	for (const entries of byFamily.values()) {
		const byForm = new Map<string, FamilyAffinityTarget[]>();
		for (const target of entries)
			byForm.set(target.formId, [...(byForm.get(target.formId) ?? []), target]);
		if (byForm.size !== 5) throw new Error('Each family requires exactly five forms');
		for (const formEntries of byForm.values()) {
			const affinities = formEntries.map(({ affinity }) => affinity);
			if (
				affinities.length !== 5 ||
				PRODUCTION_AFFINITIES.some((affinity) => !affinities.includes(affinity))
			) {
				throw new Error('Each form requires exactly Normal, Fire, Earth, Wind, and Water');
			}
		}
	}
	for (const [path, receiptEvidence] of Object.entries(reviewReceipts)) {
		const receipt = FamilyAffinityReviewReceiptSchema.parse(receiptEvidence.receipt);
		const target = targetsById.get(receipt.targetId);
		if (
			(target?.anchor.kind === 'earth-bridge-provisional' ||
				target?.anchor.kind === 'normal-verified-candidate') &&
			receipt.decision === 'approved-review'
		) {
			throw new Error(`Provisional target cannot reach approved-review: ${path}`);
		}
	}
	return {
		canonicalTargetCount: targets.length,
		canonicalAssignmentCount: assignments.length,
		ownedOutputPathCount: ownedOutputPaths.length,
		normalTargetCount: targets.filter(({ affinity }) => affinity === 'normal').length,
		elementalTargetCount: targets.filter(({ affinity }) => affinity !== 'normal').length,
		bridgeTargetCount: manifest.bridge.targetCount
	};
}

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

async function pathEntryExistsNoFollow(path: string): Promise<boolean> {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if (
			(error as NodeJS.ErrnoException).code === 'ENOENT' ||
			(error as NodeJS.ErrnoException).code === 'ENOTDIR'
		) {
			return false;
		}
		throw error;
	}
}

function absoluteOwnedPath(repositoryRoot: string, ownedPath: string): string {
	OwnedPathSchema.parse(ownedPath);
	return absoluteRepositoryPath(repositoryRoot, ownedPath);
}

function absoluteRepositoryPath(repositoryRoot: string, repositoryPath: string): string {
	if (!repositoryPath || repositoryPath.startsWith('/') || repositoryPath.includes('..')) {
		throw new Error('Repository path must be a contained relative path');
	}
	const root = resolve(repositoryRoot);
	const absolute = resolve(root, repositoryPath);
	if (absolute !== root && !absolute.startsWith(`${root}${sep}`))
		throw new Error('Repository path escapes repository root');
	return absolute;
}

async function readRepositoryFileNoSymlinks(
	repositoryRoot: string,
	repositoryPath: string
): Promise<Buffer> {
	const absolute = absoluteRepositoryPath(repositoryRoot, repositoryPath);
	const parts = relative(resolve(repositoryRoot), absolute).split(sep).filter(Boolean);
	let cursor = resolve(repositoryRoot);
	for (const [index, part] of parts.entries()) {
		cursor = join(cursor, part);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink())
			throw new Error(`Symlinked repository path is forbidden: ${repositoryPath}`);
		if (index < parts.length - 1 && !metadata.isDirectory()) {
			throw new Error(`Repository path parent must be a real directory: ${repositoryPath}`);
		}
		if (index === parts.length - 1 && !metadata.isFile()) {
			throw new Error(`Repository path must be a real file: ${repositoryPath}`);
		}
	}
	return readFile(absolute);
}

async function readOwnedFileNoSymlinks(repositoryRoot: string, ownedPath: string): Promise<Buffer> {
	absoluteOwnedPath(repositoryRoot, ownedPath);
	return readRepositoryFileNoSymlinks(repositoryRoot, ownedPath);
}

export async function readFamilyAffinityOwnedFile(
	repositoryRoot: string,
	ownedPath: string
): Promise<Buffer> {
	return readOwnedFileNoSymlinks(repositoryRoot, ownedPath);
}

export async function loadFamilyAffinityActiveSources(repositoryRoot: string): Promise<{
	registry: FamilyAffinityActiveSources;
	families: FamilyPacket[];
	mapping: CurrentClassMappingFile;
}> {
	const registry = FamilyAffinityActiveSourcesSchema.parse(
		JSON.parse(
			(await readOwnedFileNoSymlinks(repositoryRoot, FAMILY_AFFINITY_ACTIVE_SOURCES_PATH)).toString(
				'utf8'
			)
		)
	);
	const families = await Promise.all(
		registry.familyPacketPaths.map(async (path) => {
			const family = FamilyPacketSchema.parse(
				JSON.parse((await readOwnedFileNoSymlinks(repositoryRoot, path)).toString('utf8'))
			);
			if (familyPacketPath(family) !== path) {
				throw new Error(`Active family packet path is not self-bound: ${path}`);
			}
			return family;
		})
	);
	if (new Set(families.map(({ familyId }) => familyId)).size !== 30) {
		throw new Error('Active family registry requires 30 unique family IDs');
	}
	if (new Set(families.map(({ sourceRaceNumber }) => sourceRaceNumber)).size !== 30) {
		throw new Error('Active family registry requires 30 unique source race numbers');
	}
	const ordered = [...families].sort(
		(left, right) => left.sourceRaceNumber - right.sourceRaceNumber
	);
	if (families.some((family, index) => family !== ordered[index])) {
		throw new Error('Active family registry must preserve source race order');
	}
	const mapping = CurrentClassMappingFileSchema.parse(
		JSON.parse(
			(await readOwnedFileNoSymlinks(repositoryRoot, registry.mappingPath)).toString('utf8')
		)
	);
	if (currentClassMappingPath(mapping) !== registry.mappingPath) {
		throw new Error('Active current-class mapping path is not self-bound');
	}
	return { registry, families, mapping };
}

export type AllocateFamilyAffinityRevisionInput = {
	repositoryRoot: string;
	manifestPath: string;
	namespace: 'canonical' | 'bridge';
	coordinateId: string;
	callerRole: string;
	reviewPath: string;
	semanticCorrection?: FamilyAffinityRevisionCorrection;
};

export type FamilyAffinityRevisionBatchEntry = Pick<
	AllocateFamilyAffinityRevisionInput,
	'namespace' | 'coordinateId' | 'reviewPath' | 'semanticCorrection'
>;

export type AllocateFamilyAffinityRevisionBatchInput = Pick<
	AllocateFamilyAffinityRevisionInput,
	'repositoryRoot' | 'manifestPath' | 'callerRole'
> & {
	entries: readonly FamilyAffinityRevisionBatchEntry[];
};

async function validateAllocationAnchor(
	repositoryRoot: string,
	manifest: Pick<FamilyAffinityManifest | FaunaFamilyManifest, 'canonicalMatrix'>,
	target: FamilyAffinityTarget,
	manifestPath: string,
	_manifestSha256: string
): Promise<void> {
	if (
		target.affinity === 'normal' ||
		(target.status !== 'planned' && target.status !== 'planned-provisional-anchor')
	) {
		return;
	}
	if (
		target.anchor.kind !== 'normal-approved-review' &&
		target.anchor.kind !== 'normal-verified-candidate'
	) {
		throw new Error('Planned elemental allocation requires an exact Normal evidence anchor');
	}
	const anchor = target.anchor;
	const normalCoordinate = manifest.canonicalMatrix.activeCoordinates.find(
		({ coordinateId }) => coordinateId === `${target.familyId}/${target.formId}/normal`
	);
	if (
		!normalCoordinate ||
		normalCoordinate.status !== 'planned' ||
		normalCoordinate.activeVersion !== anchor.normalVersion ||
		normalCoordinate.targetPath !== anchor.normalTargetPath ||
		normalCoordinate.targetSha256 !== anchor.normalTargetSha256 ||
		normalCoordinate.assignmentPath !==
			canonicalAttemptPaths(
				target.familyId,
				target.formId,
				'normal',
				anchor.normalVersion,
				familyProductionTargetExperimentId(target)
			).assignment
	) {
		throw new Error('Planned elemental allocation has a stale or manifest-unbound Normal anchor');
	}
	const normalTarget = FamilyAffinityTargetSchema.parse(
		JSON.parse(
			(await readOwnedFileNoSymlinks(repositoryRoot, normalCoordinate.targetPath)).toString('utf8')
		)
	);
	const normalAssignment = FamilyAffinityAssignmentSchema.parse(
		JSON.parse(
			(await readOwnedFileNoSymlinks(repositoryRoot, normalCoordinate.assignmentPath)).toString(
				'utf8'
			)
		)
	);
	validateFamilyAffinityAttemptCrossBinding(normalCoordinate, normalTarget, normalAssignment);
	const source = familyAffinitySourcePacketBinding(normalTarget);
	const candidateBytes = await readOwnedFileNoSymlinks(
		repositoryRoot,
		normalTarget.ownedPaths.candidate
	);
	const resultBytes = await readOwnedFileNoSymlinks(repositoryRoot, normalTarget.ownedPaths.result);
	const familyPacketBytes = await readOwnedFileNoSymlinks(repositoryRoot, source.path);
	const evidence = validateFamilyAffinityCandidateEvidence({
		target: normalTarget,
		assignment: normalAssignment,
		familyPacketBytes,
		candidateBytes,
		resultBytes
	});
	if (anchor.kind === 'normal-verified-candidate') {
		if (
			target.status !== 'planned-provisional-anchor' ||
			normalTarget.coordinateId !== anchor.normalCoordinateId ||
			normalTarget.familyId !== target.familyId ||
			normalTarget.formId !== target.formId ||
			normalTarget.affinity !== 'normal' ||
			familyAffinitySha256(normalTarget) !== anchor.normalTargetSha256 ||
			anchor.normalCandidatePath !== normalTarget.ownedPaths.candidate ||
			anchor.normalCandidateSha256 !== evidence.result.candidateSha256 ||
			anchor.normalResultPath !== normalTarget.ownedPaths.result ||
			anchor.normalResultSha256 !== evidence.resultSha256 ||
			anchor.sourcePacketPath !== source.path ||
			anchor.sourcePacketSha256 !== source.sha256 ||
			familyAffinityRawSha256(candidateBytes) !== anchor.normalCandidateSha256 ||
			familyAffinityRawSha256(resultBytes) !== anchor.normalResultSha256
		) {
			throw new Error(
				'Provisional elemental allocation Normal evidence is stale, foreign, or mismatched'
			);
		}
		return;
	}
	if (target.status !== 'planned') {
		throw new Error('Approved Normal anchors require planned status');
	}
	const receiptBytes = await readOwnedFileNoSymlinks(repositoryRoot, anchor.reviewReceiptPath);
	const receipt = FamilyAffinityReviewReceiptSchema.parse(
		JSON.parse(receiptBytes.toString('utf8'))
	);
	if (
		receipt.candidatePath !== normalTarget.ownedPaths.candidate ||
		receipt.resultPath !== normalTarget.ownedPaths.result
	) {
		throw new Error('Normal approval receipt points outside the active Normal attempt');
	}
	validateFamilyAffinityReceiptEvidence({
		target: normalTarget,
		result: evidence.result,
		resultSha256: evidence.resultSha256,
		receipt,
		kind: 'ordinary'
	});
	const ordinaryReviewAssignmentPath = familyAffinityReviewAssignmentPath(
		'ordinary',
		normalTarget,
		receipt.decisionVersion
	);
	const ordinaryReviewAssignment = FamilyAffinityReviewAssignmentSchema.parse(
		JSON.parse(
			(await readOwnedFileNoSymlinks(repositoryRoot, ordinaryReviewAssignmentPath)).toString('utf8')
		)
	);
	validateFamilyAffinityReviewAssignmentEvidence({
		reviewAssignment: ordinaryReviewAssignment,
		reviewAssignmentPath: ordinaryReviewAssignmentPath,
		kind: 'ordinary',
		manifestPath,
		// Anchor activation validates this assignment against the exact pre-activation
		// manifest. After the manifest atomically advances, its immutable attestation
		// remains self-bound to that historical digest rather than the new digest.
		target: normalTarget,
		targetPath: normalCoordinate.targetPath,
		productionAssignment: normalAssignment,
		productionAssignmentPath: normalCoordinate.assignmentPath,
		result: evidence.result,
		resultSha256: evidence.resultSha256
	});
	if (ordinaryReviewAssignment.reviewerId !== receipt.reviewerId) {
		throw new Error('Normal approval reviewer does not match controller assignment');
	}
	if (normalTarget.tier === 'T3' || normalTarget.tier === 'T5') {
		const blindBytes = await readOwnedFileNoSymlinks(
			repositoryRoot,
			normalTarget.ownedPaths.blindReview
		);
		const blind = validateFamilyAffinityReceiptEvidence({
			target: normalTarget,
			result: evidence.result,
			resultSha256: evidence.resultSha256,
			receipt: JSON.parse(blindBytes.toString('utf8')),
			kind: 'blind'
		}) as FamilyAffinityBlindReviewReceipt;
		const blindAssignmentPath = familyAffinityReviewAssignmentPath(
			'blind',
			normalTarget,
			blind.decisionVersion
		);
		const blindAssignment = FamilyAffinityReviewAssignmentSchema.parse(
			JSON.parse(
				(await readOwnedFileNoSymlinks(repositoryRoot, blindAssignmentPath)).toString('utf8')
			)
		);
		validateFamilyAffinityReviewAssignmentEvidence({
			reviewAssignment: blindAssignment,
			reviewAssignmentPath: blindAssignmentPath,
			kind: 'blind',
			manifestPath,
			target: normalTarget,
			targetPath: normalCoordinate.targetPath,
			productionAssignment: normalAssignment,
			productionAssignmentPath: normalCoordinate.assignmentPath,
			result: evidence.result,
			resultSha256: evidence.resultSha256
		});
		if (
			blind.decision !== 'approved-review' ||
			blind.reviewerId === receipt.reviewerId ||
			blindAssignment.reviewerId !== blind.reviewerId
		) {
			throw new Error('Normal T3/T5 anchor lacks independent agreeing blind approval');
		}
	}
	if (
		normalTarget.coordinateId !== anchor.normalCoordinateId ||
		normalTarget.familyId !== target.familyId ||
		normalTarget.formId !== target.formId ||
		normalTarget.affinity !== 'normal' ||
		familyAffinitySha256(normalTarget) !== anchor.normalTargetSha256 ||
		anchor.reviewReceiptPath !== normalTarget.ownedPaths.decision ||
		familyAffinityRawSha256(receiptBytes) !== anchor.reviewReceiptSha256 ||
		receipt.decision !== 'approved-review' ||
		receipt.targetId !== normalTarget.targetId ||
		receipt.targetSha256 !== anchor.normalTargetSha256 ||
		receipt.candidatePath !== normalTarget.ownedPaths.candidate ||
		receipt.candidatePath !== anchor.normalCandidatePath ||
		receipt.candidateSha256 !== anchor.normalCandidateSha256 ||
		receipt.resultPath !== normalTarget.ownedPaths.result ||
		receipt.resultPath !== anchor.normalResultPath ||
		receipt.resultSha256 !== anchor.normalResultSha256 ||
		familyAffinityRawSha256(candidateBytes) !== receipt.candidateSha256 ||
		familyAffinityRawSha256(resultBytes) !== receipt.resultSha256
	) {
		throw new Error(
			'Planned elemental allocation Normal evidence is stale, foreign, or mismatched'
		);
	}
}

export async function validateFamilyAffinityNormalAnchorEvidence(input: {
	repositoryRoot: string;
	manifestPath: string;
	targetPath: string;
}): Promise<void> {
	const manifestBytes = await readOwnedFileNoSymlinks(input.repositoryRoot, input.manifestPath);
	const target = FamilyAffinityTargetSchema.parse(
		JSON.parse(
			(await readOwnedFileNoSymlinks(input.repositoryRoot, input.targetPath)).toString('utf8')
		)
	);
	const manifest =
		familyProductionTargetExperimentId(target) === 'fauna-family-v1'
			? FaunaFamilyManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')))
			: FamilyAffinityManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
	if (target.anchor.kind === 'earth-bridge-provisional') {
		const normalBytes = await readRepositoryFileNoSymlinks(
			input.repositoryRoot,
			target.anchor.normalCandidatePath
		);
		if (familyAffinityRawSha256(normalBytes) !== target.anchor.normalCandidateSha256) {
			throw new Error(`Earth bridge Normal reference hash drifted: ${target.targetId}`);
		}
		if (
			target.canonicalCoordinateId !== undefined &&
			!manifest.canonicalMatrix.activeCoordinates.some(
				({ coordinateId, affinity }) =>
					coordinateId === target.canonicalCoordinateId && affinity === 'earth'
			)
		) {
			throw new Error(`Mapped-primary canonical coordinate is not active: ${target.targetId}`);
		}
		return;
	}
	await validateAllocationAnchor(
		input.repositoryRoot,
		manifest,
		target,
		input.manifestPath,
		familyAffinityRawSha256(manifestBytes)
	);
}

async function validateFullActiveCorpusBeforeAllocation(
	repositoryRoot: string,
	manifest: FamilyAffinityManifest,
	manifestPath: string,
	manifestSha256: string
): Promise<void> {
	const seenTargetIds = new Set<string>();
	const seenAssignmentIds = new Set<string>();
	for (const coordinate of [
		...manifest.canonicalMatrix.activeCoordinates,
		...manifest.bridge.activeCoordinates
	]) {
		const target = FamilyAffinityTargetSchema.parse(
			JSON.parse(
				(await readOwnedFileNoSymlinks(repositoryRoot, coordinate.targetPath)).toString('utf8')
			)
		);
		const assignment = FamilyAffinityAssignmentSchema.parse(
			JSON.parse(
				(await readOwnedFileNoSymlinks(repositoryRoot, coordinate.assignmentPath)).toString('utf8')
			)
		);
		validateFamilyAffinityAttemptCrossBinding(coordinate, target, assignment);
		await validateFamilyAffinitySemanticCorrectionLineage(repositoryRoot, target);
		if (seenTargetIds.has(target.targetId) || seenAssignmentIds.has(assignment.assignmentId)) {
			throw new Error('Active corpus contains an unreferenced or duplicate attempt pair');
		}
		seenTargetIds.add(target.targetId);
		seenAssignmentIds.add(assignment.assignmentId);
		await validateAllocationAnchor(repositoryRoot, manifest, target, manifestPath, manifestSha256);
		if (
			target.anchor.kind === 'earth-bridge-provisional' &&
			(await exists(absoluteOwnedPath(repositoryRoot, target.ownedPaths.decision)))
		) {
			const receipt = FamilyAffinityReviewReceiptSchema.parse(
				JSON.parse(
					(await readOwnedFileNoSymlinks(repositoryRoot, target.ownedPaths.decision)).toString(
						'utf8'
					)
				)
			);
			validateFamilyAffinityReviewPromotion(target, receipt);
		}
	}
}

async function validateFamilyAffinitySemanticCorrectionLineage(
	repositoryRoot: string,
	activeTarget: FamilyAffinityTarget
): Promise<void> {
	const correction = activeTarget.semanticCorrection;
	if (correction === undefined) return;
	let cursor = activeTarget;
	while (cursor.version > correction.appliedVersion) {
		if (cursor.precedingAttempt === null) {
			throw new Error('Semantic correction lineage is missing an immutable preceding attempt');
		}
		const previousVersion = cursor.version - 1;
		const previousPath = bridgeAttemptPaths(
			cursor.currentClassId!,
			cursor.affinity,
			previousVersion
		).target;
		const previous = FamilyAffinityTargetSchema.parse(
			JSON.parse((await readOwnedFileNoSymlinks(repositoryRoot, previousPath)).toString('utf8'))
		);
		if (
			previous.targetId !== cursor.precedingAttempt.targetId ||
			familyAffinitySha256(previous) !== cursor.precedingAttempt.targetSha256 ||
			previous.coordinateId !== activeTarget.coordinateId ||
			stableJson(previous.semanticCorrection) !== stableJson(correction)
		) {
			throw new Error('Semantic correction lineage is stale, forged, or was not preserved');
		}
		cursor = previous;
	}
	if (
		cursor.version !== correction.appliedVersion ||
		stableJson(cursor.semanticCorrection) !== stableJson(correction)
	) {
		throw new Error('Semantic correction event target is missing or mismatched');
	}
	if (cursor.precedingAttempt === null) {
		throw new Error('Semantic correction application target is missing predecessor provenance');
	}
	const predecessorVersion = correction.appliedVersion - 1;
	const predecessorPath = bridgeAttemptPaths(
		cursor.currentClassId!,
		cursor.affinity,
		predecessorVersion
	).target;
	let predecessor: FamilyAffinityTarget;
	try {
		predecessor = FamilyAffinityTargetSchema.parse(
			JSON.parse((await readOwnedFileNoSymlinks(repositoryRoot, predecessorPath)).toString('utf8'))
		);
	} catch {
		throw new Error('Semantic correction on-disk predecessor is missing or invalid');
	}
	const predecessorSha256 = familyAffinitySha256(predecessor);
	if (
		predecessor.namespace !== cursor.namespace ||
		predecessor.coordinateId !== cursor.coordinateId ||
		predecessor.familyId !== cursor.familyId ||
		predecessor.formId !== cursor.formId ||
		predecessor.currentClassId !== cursor.currentClassId ||
		predecessor.affinity !== cursor.affinity ||
		predecessor.version !== predecessorVersion ||
		predecessor.targetId !== correction.precedingTargetId ||
		predecessor.targetId !== cursor.precedingAttempt.targetId ||
		predecessorSha256 !== correction.precedingTargetSha256 ||
		predecessorSha256 !== cursor.precedingAttempt.targetSha256
	) {
		throw new Error('Semantic correction on-disk predecessor identity or hash is mismatched');
	}
	if (predecessor.semanticCorrection !== undefined) {
		throw new Error('Semantic correction predecessor cannot carry a pre-existing correction');
	}
}

async function prepareFamilyAffinityRevision(
	input: Pick<AllocateFamilyAffinityRevisionInput, 'repositoryRoot' | 'manifestPath'> &
		FamilyAffinityRevisionBatchEntry,
	manifest: FamilyAffinityManifest,
	manifestSha256: string
) {
	const collection = input.namespace === 'canonical' ? manifest.canonicalMatrix : manifest.bridge;
	const coordinate = collection.activeCoordinates.find(
		({ coordinateId }) => coordinateId === input.coordinateId
	);
	if (!coordinate || coordinate.namespace !== input.namespace)
		throw new Error('Wrong or unknown manifest coordinate');
	const currentTarget = FamilyAffinityTargetSchema.parse(
		JSON.parse(
			(await readOwnedFileNoSymlinks(input.repositoryRoot, coordinate.targetPath)).toString('utf8')
		)
	);
	const currentAssignment = FamilyAffinityAssignmentSchema.parse(
		JSON.parse(
			(await readOwnedFileNoSymlinks(input.repositoryRoot, coordinate.assignmentPath)).toString(
				'utf8'
			)
		)
	);
	validateFamilyAffinityAttemptCrossBinding(coordinate, currentTarget, currentAssignment);
	await validateAllocationAnchor(
		input.repositoryRoot,
		manifest,
		currentTarget,
		input.manifestPath,
		manifestSha256
	);
	if (
		currentTarget.coordinateId !== coordinate.coordinateId ||
		currentTarget.version !== coordinate.activeVersion ||
		currentAssignment.targetId !== currentTarget.targetId ||
		currentAssignment.targetSha256 !== familyAffinitySha256(currentTarget) ||
		coordinate.targetSha256 !== currentAssignment.targetSha256
	) {
		throw new Error('Current target, assignment, coordinate, or hash is stale or mismatched');
	}
	if (input.reviewPath !== currentTarget.ownedPaths.decision)
		throw new Error('Review path does not match current target ownership');
	const receiptBytes = await readOwnedFileNoSymlinks(input.repositoryRoot, input.reviewPath);
	const receipt = FamilyAffinityReviewReceiptSchema.parse(
		JSON.parse(receiptBytes.toString('utf8'))
	);
	const resultBytes = await readOwnedFileNoSymlinks(
		input.repositoryRoot,
		currentTarget.ownedPaths.result
	);
	const candidateBytes = await readOwnedFileNoSymlinks(
		input.repositoryRoot,
		currentTarget.ownedPaths.candidate
	);
	const familyPacketBytes = await readOwnedFileNoSymlinks(
		input.repositoryRoot,
		familyAffinitySourcePacketBinding(currentTarget).path
	);
	const evidence = validateFamilyAffinityCandidateEvidence({
		target: currentTarget,
		assignment: currentAssignment,
		familyPacketBytes,
		candidateBytes,
		resultBytes
	});
	validateFamilyAffinityReceiptEvidence({
		target: currentTarget,
		result: evidence.result,
		resultSha256: evidence.resultSha256,
		receipt,
		kind: 'ordinary'
	});
	const reviewAssignmentPath = familyAffinityReviewAssignmentPath(
		'ordinary',
		currentTarget,
		receipt.decisionVersion
	);
	const reviewAssignment = FamilyAffinityReviewAssignmentSchema.parse(
		JSON.parse(
			(await readOwnedFileNoSymlinks(input.repositoryRoot, reviewAssignmentPath)).toString('utf8')
		)
	);
	validateFamilyAffinityReviewAssignmentEvidence({
		reviewAssignment,
		reviewAssignmentPath,
		kind: 'ordinary',
		manifestPath: input.manifestPath,
		// Revision allocation may follow unrelated coordinate activations. The immutable
		// assignment remains self-attested to its issuance snapshot; all attempt-local
		// target, assignment, result, source, prompt, reviewer, and path bindings remain exact.
		target: currentTarget,
		targetPath: coordinate.targetPath,
		productionAssignment: currentAssignment,
		productionAssignmentPath: coordinate.assignmentPath,
		result: evidence.result,
		resultSha256: evidence.resultSha256
	});
	if (reviewAssignment.reviewerId !== receipt.reviewerId) {
		throw new Error('Ordinary receipt reviewer does not match controller assignment');
	}
	let revisionRequired = receipt.decision === 'rejected' || receipt.decision === 'revise';
	if (currentTarget.tier === 'T3' || currentTarget.tier === 'T5') {
		const blindBytes = await readOwnedFileNoSymlinks(
			input.repositoryRoot,
			currentTarget.ownedPaths.blindReview
		);
		const blind = validateFamilyAffinityReceiptEvidence({
			target: currentTarget,
			result: evidence.result,
			resultSha256: evidence.resultSha256,
			receipt: JSON.parse(blindBytes.toString('utf8')),
			kind: 'blind'
		}) as FamilyAffinityBlindReviewReceipt;
		const blindAssignmentPath = familyAffinityReviewAssignmentPath(
			'blind',
			currentTarget,
			blind.decisionVersion
		);
		const blindAssignment = FamilyAffinityReviewAssignmentSchema.parse(
			JSON.parse(
				(await readOwnedFileNoSymlinks(input.repositoryRoot, blindAssignmentPath)).toString('utf8')
			)
		);
		validateFamilyAffinityReviewAssignmentEvidence({
			reviewAssignment: blindAssignment,
			reviewAssignmentPath: blindAssignmentPath,
			kind: 'blind',
			manifestPath: input.manifestPath,
			target: currentTarget,
			targetPath: coordinate.targetPath,
			productionAssignment: currentAssignment,
			productionAssignmentPath: coordinate.assignmentPath,
			result: evidence.result,
			resultSha256: evidence.resultSha256
		});
		if (
			blind.reviewerId === receipt.reviewerId ||
			blindAssignment.reviewerId !== blind.reviewerId
		) {
			throw new Error('Ordinary and blind revision evidence must be independently assigned');
		}
		revisionRequired ||= blind.decision !== receipt.decision;
	}
	if (!revisionRequired) {
		throw new Error(
			'Current attempt must have a rejected or revise decision, or an independently assigned T3/T5 review conflict'
		);
	}
	const nextVersion = currentTarget.version + 1;
	const nextPaths =
		currentTarget.namespace === 'canonical'
			? canonicalAttemptPaths(
					currentTarget.familyId,
					currentTarget.formId,
					currentTarget.affinity,
					nextVersion
				)
			: bridgeAttemptPaths(currentTarget.currentClassId!, currentTarget.affinity, nextVersion);
	const nextOwnedPaths = {
		candidate: nextPaths.candidate,
		result: nextPaths.result,
		decision: nextPaths.decision,
		blindReview: nextPaths.blindReview
	};
	const nextTargetPath = nextPaths.target;
	const nextAssignmentPath = nextPaths.assignment;
	const targetStatus =
		currentTarget.status === 'earth-bridge-provisional'
			? currentTarget.status
			: currentAssignment.dispatchStatus;
	if (input.semanticCorrection !== undefined && currentTarget.semanticCorrection !== undefined) {
		throw new Error('A target with an existing semantic correction cannot be corrected again');
	}
	const requestedCorrection =
		input.semanticCorrection === undefined
			? undefined
			: FamilyAffinityRevisionCorrectionSchema.parse(input.semanticCorrection);
	if (requestedCorrection !== undefined && currentTarget.namespace !== 'bridge') {
		throw new Error('Semantic corrections are restricted to bridge revision targets');
	}
	const semanticOverrides = requestedCorrection?.overrides ?? {};
	const appliedCorrectionEvent =
		requestedCorrection === undefined
			? undefined
			: {
					...requestedCorrection,
					appliedVersion: nextVersion,
					precedingTargetId: currentTarget.targetId,
					precedingTargetSha256: familyAffinitySha256(currentTarget)
				};
	const nextTarget = FamilyAffinityTargetSchema.parse({
		...currentTarget,
		...semanticOverrides,
		targetId: `${currentTarget.namespace}/${currentTarget.coordinateId}/v${nextVersion}`,
		version: nextVersion,
		status: targetStatus,
		ownedPaths: nextOwnedPaths,
		precedingAttempt: {
			targetId: currentTarget.targetId,
			targetSha256: familyAffinitySha256(currentTarget),
			candidatePath: currentTarget.ownedPaths.candidate,
			candidateSha256: evidence.result.candidateSha256,
			resultPath: currentTarget.ownedPaths.result,
			resultSha256: receipt.resultSha256,
			reviewPath: input.reviewPath,
			reviewSha256: familyAffinityRawSha256(receiptBytes)
		},
		...(appliedCorrectionEvent === undefined
			? {}
			: {
					semanticCorrection: {
						...appliedCorrectionEvent,
						correctionSha256: familyAffinitySha256(appliedCorrectionEvent)
					}
				})
	});
	const nextAssignment = buildAssignment(nextTarget);
	return {
		namespace: input.namespace,
		coordinateId: input.coordinateId,
		targetPath: nextTargetPath,
		assignmentPath: nextAssignmentPath,
		target: nextTarget,
		assignment: nextAssignment,
		proposedPaths: [nextTargetPath, nextAssignmentPath, ...Object.values(nextOwnedPaths)]
	};
}

async function assertRealRepositoryParent(repositoryRoot: string, repositoryPath: string) {
	const absolute = absoluteOwnedPath(repositoryRoot, repositoryPath);
	const parent = dirname(absolute);
	const metadata = await lstat(parent);
	if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
		throw new Error(`Revision allocation parent must be a real directory: ${repositoryPath}`);
	}
}

async function allocateFamilyAffinityRevisionBatchUnlocked(
	input: AllocateFamilyAffinityRevisionBatchInput,
	manifestAbsolute: string
) {
	if (input.entries.length === 0) {
		throw new Error('Revision allocation batch requires at least one entry');
	}
	if (new Set(input.entries.map(({ namespace }) => namespace)).size !== 1) {
		throw new Error('Revision allocation batch cannot mix canonical and bridge namespaces');
	}
	const entryKeys = input.entries.map(
		({ namespace, coordinateId }) => `${namespace}\0${coordinateId}`
	);
	if (new Set(entryKeys).size !== entryKeys.length) {
		throw new Error('Revision allocation batch contains a duplicate namespace and coordinate');
	}
	const reviewPaths = input.entries.map(({ reviewPath }) => reviewPath);
	if (new Set(reviewPaths).size !== reviewPaths.length) {
		throw new Error('Revision allocation batch contains a duplicate review path');
	}

	const manifestBytes = await readOwnedFileNoSymlinks(input.repositoryRoot, input.manifestPath);
	const manifestSha256 = familyAffinityRawSha256(manifestBytes);
	const manifest = FamilyAffinityManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
	await validateFullActiveCorpusBeforeAllocation(
		input.repositoryRoot,
		manifest,
		input.manifestPath,
		manifestSha256
	);

	const allocations = [];
	for (const entry of input.entries) {
		allocations.push(
			await prepareFamilyAffinityRevision(
				{
					repositoryRoot: input.repositoryRoot,
					manifestPath: input.manifestPath,
					...entry
				},
				manifest,
				manifestSha256
			)
		);
	}

	const proposedPaths = allocations.flatMap(({ proposedPaths }) => proposedPaths);
	if (new Set(proposedPaths).size !== proposedPaths.length) {
		throw new Error('Revision allocation batch contains overlapping output paths');
	}
	for (const proposed of proposedPaths) {
		if (await pathEntryExistsNoFollow(absoluteOwnedPath(input.repositoryRoot, proposed))) {
			throw new Error(`Revision allocation collision: ${proposed}`);
		}
	}
	for (const allocation of allocations) {
		await assertRealRepositoryParent(input.repositoryRoot, allocation.targetPath);
		await assertRealRepositoryParent(input.repositoryRoot, allocation.assignmentPath);
	}

	const nextManifest = structuredClone(manifest);
	for (const allocation of allocations) {
		const collection =
			allocation.namespace === 'canonical' ? nextManifest.canonicalMatrix : nextManifest.bridge;
		const coordinate = collection.activeCoordinates.find(
			({ coordinateId }) => coordinateId === allocation.coordinateId
		)!;
		coordinate.activeVersion = allocation.target.version;
		coordinate.targetPath = allocation.targetPath;
		coordinate.targetSha256 = familyAffinitySha256(allocation.target);
		coordinate.assignmentPath = allocation.assignmentPath;
		coordinate.assignmentSha256 = familyAffinitySha256(allocation.assignment);
		coordinate.status = allocation.target.status;
	}
	FamilyAffinityManifestSchema.parse(nextManifest);

	const unchangedManifestBytes = await readOwnedFileNoSymlinks(
		input.repositoryRoot,
		input.manifestPath
	);
	if (!unchangedManifestBytes.equals(manifestBytes)) {
		throw new Error('Revision allocation manifest changed after batch validation');
	}

	const created: string[] = [];
	const temporaryManifest = `${manifestAbsolute}.revision-allocation.tmp`;
	let temporaryManifestCreated = false;
	try {
		for (const allocation of allocations) {
			const nextTargetAbsolute = absoluteOwnedPath(input.repositoryRoot, allocation.targetPath);
			const nextAssignmentAbsolute = absoluteOwnedPath(
				input.repositoryRoot,
				allocation.assignmentPath
			);
			await writeFile(nextTargetAbsolute, stableFamilyAffinityJson(allocation.target), {
				flag: 'wx'
			});
			created.push(nextTargetAbsolute);
			await writeFile(nextAssignmentAbsolute, stableFamilyAffinityJson(allocation.assignment), {
				flag: 'wx'
			});
			created.push(nextAssignmentAbsolute);
		}
		const finalManifestBytes = await readOwnedFileNoSymlinks(
			input.repositoryRoot,
			input.manifestPath
		);
		if (!finalManifestBytes.equals(manifestBytes)) {
			throw new Error('Revision allocation manifest changed before atomic commit');
		}
		await writeFile(temporaryManifest, stableFamilyAffinityJson(nextManifest), { flag: 'wx' });
		temporaryManifestCreated = true;
		await rename(temporaryManifest, manifestAbsolute);
		temporaryManifestCreated = false;
	} catch (error) {
		if (temporaryManifestCreated) await unlink(temporaryManifest).catch(() => undefined);
		for (const createdPath of created.reverse()) await unlink(createdPath).catch(() => undefined);
		throw error;
	}

	return allocations.map(({ proposedPaths: _proposedPaths, ...allocation }) => allocation);
}

export async function allocateFamilyAffinityRevisionBatch(
	input: AllocateFamilyAffinityRevisionBatchInput
) {
	if (input.callerRole !== 'integration-controller') {
		throw new Error(
			'Only the integration-controller may allocate revisions; producers and reviewers are forbidden'
		);
	}
	const manifestAbsolute = absoluteOwnedPath(input.repositoryRoot, input.manifestPath);
	const lockPath = `${manifestAbsolute}.revision-allocation.lock`;
	try {
		await writeFile(lockPath, `${process.pid}\n`, { flag: 'wx' });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
			throw new Error(
				'Revision allocation is already in progress under the exclusive controller lock'
			);
		}
		throw error;
	}
	try {
		return await allocateFamilyAffinityRevisionBatchUnlocked(input, manifestAbsolute);
	} finally {
		await unlink(lockPath).catch(() => undefined);
	}
}

export async function allocateFamilyAffinityRevision(input: AllocateFamilyAffinityRevisionInput) {
	const [allocation] = await allocateFamilyAffinityRevisionBatch({
		repositoryRoot: input.repositoryRoot,
		manifestPath: input.manifestPath,
		callerRole: input.callerRole,
		entries: [
			{
				namespace: input.namespace,
				coordinateId: input.coordinateId,
				reviewPath: input.reviewPath,
				...(input.semanticCorrection === undefined
					? {}
					: { semanticCorrection: input.semanticCorrection })
			}
		]
	});
	return allocation!;
}
