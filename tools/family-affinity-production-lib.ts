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
export const CURRENT_CLASS_SOURCE_ROSTER =
	'docs/wiki/creatures/monsters/visual-index.json' as const;

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
	.regex(/^assets\/enemies\/experiments\/family-affinity-v1\//u)
	.refine((value) => !value.includes('..'), 'Owned paths cannot traverse directories');
const AttemptStatusSchema = z.enum(['planned', 'blocked-on-anchor', 'earth-bridge-provisional']);
const NamespaceSchema = z.enum(['canonical', 'bridge']);

export const FamilyAffinityTargetSchema = z
	.object({
		schemaVersion: z.literal('family-affinity-target-v1'),
		namespace: NamespaceSchema,
		coordinateId: RequiredTextSchema,
		targetId: RequiredTextSchema,
		familyId: IdSchema,
		formId: IdSchema,
		currentClassId: IdSchema.nullable(),
		affinity: z.enum(PRODUCTION_AFFINITIES),
		tier: FormTierSchema,
		primaryArchetype: RequiredTextSchema,
		battlefieldDuty: RequiredTextSchema,
		identityInvariants: z.array(RequiredTextSchema).min(1),
		anatomyInvariants: z.array(RequiredTextSchema).min(1),
		constructionDimensions: z.array(RequiredTextSchema).min(2),
		telegraph: RequiredTextSchema,
		counterplay: RequiredTextSchema,
		forbiddenTreatments: z.array(RequiredTextSchema).min(1),
		sources: z
			.object({
				familyPacketPath: OwnedPathSchema,
				familyPacketSha256: Sha256Schema,
				sourcePage: RequiredTextSchema,
				sourceReferences: z.array(RequiredTextSchema).min(1),
				mappingPath: OwnedPathSchema
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
					normalCandidatePath: OwnedPathSchema,
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
		version: z.number().int().positive(),
		status: AttemptStatusSchema,
		promotionCeiling: z.literal('approved-review'),
		runtimeCatalogMutationForbidden: z.literal(true)
	})
	.strict()
	.superRefine((target, context) => {
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
		if (target.targetId !== `${target.namespace}/${target.coordinateId}/v${target.version}`) {
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
			if (target.status === 'earth-bridge-provisional') {
				context.addIssue({
					code: 'custom',
					message: 'Ordinary Normal anchors cannot use provisional status'
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

export const FamilyAffinityAssignmentSchema = z
	.object({
		schemaVersion: z.literal('family-affinity-assignment-v1'),
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
		if (assignment.assignmentId !== `${assignment.targetId}/assignment`) {
			context.addIssue({ code: 'custom', message: 'Assignment ID must bind its target ID' });
		}
	});

export type FamilyAffinityAssignment = z.infer<typeof FamilyAffinityAssignmentSchema>;

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
	if (target.anchor.kind === 'earth-bridge-provisional' && receipt.decision === 'approved-review') {
		throw new Error(
			'Provisional Earth target cannot reach approved-review before its canonical Normal anchor'
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
					? canonicalAttemptPaths(target.familyId, target.formId, target.affinity, target.version)
							.target
					: bridgeAttemptPaths(target.currentClassId!, target.affinity, target.version).target,
			targetSha256: familyAffinitySha256(target),
			assignmentPath:
				target.namespace === 'canonical'
					? canonicalAttemptPaths(target.familyId, target.formId, target.affinity, target.version)
							.assignment
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
	const familyPacket = FamilyPacketSchema.parse(
		JSON.parse(Buffer.from(input.familyPacketBytes).toString('utf8'))
	);
	const result = FamilyAffinityResultSchema.parse(
		JSON.parse(Buffer.from(input.resultBytes).toString('utf8'))
	);
	const sourceSha256 = familyAffinitySha256(familyPacket);
	const promptSha256 = familyAffinityPromptSha256(target, assignment);
	if (
		result.targetId !== target.targetId ||
		result.targetSha256 !== familyAffinitySha256(target) ||
		result.coordinateId !== target.coordinateId ||
		result.candidateVersion !== target.version ||
		result.candidatePath !== target.ownedPaths.candidate ||
		result.candidateSha256 !== familyAffinityRawSha256(input.candidateBytes) ||
		result.resultPath !== target.ownedPaths.result ||
		result.sourcePath !== target.sources.familyPacketPath ||
		familyPacket.familyId !== target.familyId ||
		sourceSha256 !== target.sources.familyPacketSha256 ||
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
	if (target.anchor.kind === 'earth-bridge-provisional' && receipt.decision === 'approved-review') {
		throw new Error(
			'Provisional Earth target cannot reach approved-review before its canonical Normal anchor'
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

function familyPacketPath(family: FamilyPacket): string {
	return `${FAMILY_AFFINITY_ROOT}/families/${String(family.sourceRaceNumber).padStart(2, '0')}-${family.familyId}.json`;
}

export function canonicalAttemptPaths(
	familyId: string,
	formId: string,
	affinity: (typeof PRODUCTION_AFFINITIES)[number],
	version: number
) {
	return {
		target: `${FAMILY_AFFINITY_ROOT}/targets/${familyId}/${formId}/${affinity}/target-v${version}.json`,
		assignment: `${FAMILY_AFFINITY_ROOT}/assignments/${familyId}/${formId}/${affinity}/assignment-v${version}.json`,
		candidate: `${FAMILY_AFFINITY_ROOT}/candidates/${familyId}/${formId}/${affinity}-v${version}.png`,
		result: `${FAMILY_AFFINITY_ROOT}/results/${familyId}/${formId}/${affinity}-v${version}.json`,
		decision: `${FAMILY_AFFINITY_ROOT}/review/decisions/${familyId}/${formId}/${affinity}/candidate-v${version}-review-v${version}.json`,
		blindReview: `${FAMILY_AFFINITY_ROOT}/review/blind/${familyId}/${formId}/${affinity}/candidate-v${version}-blind-v${version}.json`
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
	normalTarget?: FamilyAffinityTarget
): FamilyAffinityTarget {
	const coordinateId = `${family.familyId}/${form.formId}/${affinity}`;
	const version = 1;
	const paths = canonicalAttemptPaths(family.familyId, form.formId, affinity, version);
	const theme = family.affinityThemes[affinity];
	const status = affinity === 'normal' ? 'planned' : 'blocked-on-anchor';
	const target = {
		schemaVersion: 'family-affinity-target-v1',
		namespace: 'canonical',
		coordinateId,
		targetId: `canonical/${coordinateId}/v${version}`,
		familyId: family.familyId,
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
			familyPacketPath: familyPacketPath(family),
			familyPacketSha256: familyAffinitySha256(family),
			sourcePage: family.sourcePage,
			sourceReferences: form.sourceReferences,
			mappingPath: `${FAMILY_AFFINITY_ROOT}/current-class-mapping.json`
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
							normalTarget!.version
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
	'formId',
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
	const expectedNormal = buildCanonicalTarget(family, form, 'normal');
	const expected =
		target.affinity === 'normal'
			? expectedNormal
			: buildCanonicalTarget(family, form, target.affinity, expectedNormal);
	for (const field of CANONICAL_TARGET_SOURCE_FIELDS) {
		if (stableJson(target[field]) !== stableJson(expected[field])) {
			throw new Error(`Packet-to-target source drift for ${target.coordinateId}: ${field}`);
		}
	}
}

function buildCanonicalFormTargets(family: FamilyPacket, form: FamilyForm): FamilyAffinityTarget[] {
	const normal = buildCanonicalTarget(family, form, 'normal');
	return [
		normal,
		...PRODUCTION_AFFINITIES.filter((affinity) => affinity !== 'normal').map((affinity) =>
			buildCanonicalTarget(family, form, affinity, normal)
		)
	];
}

function buildAssignment(target: FamilyAffinityTarget): FamilyAffinityAssignment {
	return FamilyAffinityAssignmentSchema.parse({
		schemaVersion: 'family-affinity-assignment-v1',
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
			.flatMap((form) => buildCanonicalFormTargets(family, form))
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
			sourcePath: `${FAMILY_AFFINITY_ROOT}/current-class-mapping.json`,
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
			target.version
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
		if (target.anchor.kind !== 'normal-approved-review') {
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
		if (target.status === 'planned') {
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
			target?.anchor.kind === 'earth-bridge-provisional' &&
			receipt.decision === 'approved-review'
		) {
			throw new Error(`Provisional Earth target cannot reach approved-review: ${path}`);
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

function absoluteOwnedPath(repositoryRoot: string, ownedPath: string): string {
	OwnedPathSchema.parse(ownedPath);
	const root = resolve(repositoryRoot);
	const absolute = resolve(root, ownedPath);
	if (absolute !== root && !absolute.startsWith(`${root}${sep}`))
		throw new Error('Owned path escapes repository root');
	return absolute;
}

async function readOwnedFileNoSymlinks(repositoryRoot: string, ownedPath: string): Promise<Buffer> {
	const absolute = absoluteOwnedPath(repositoryRoot, ownedPath);
	const parts = relative(resolve(repositoryRoot), absolute).split(sep).filter(Boolean);
	let cursor = resolve(repositoryRoot);
	for (const [index, part] of parts.entries()) {
		cursor = join(cursor, part);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink())
			throw new Error(`Symlinked owned path is forbidden: ${ownedPath}`);
		if (index < parts.length - 1 && !metadata.isDirectory()) {
			throw new Error(`Owned path parent must be a real directory: ${ownedPath}`);
		}
		if (index === parts.length - 1 && !metadata.isFile()) {
			throw new Error(`Owned path must be a real file: ${ownedPath}`);
		}
	}
	return readFile(absolute);
}

export async function readFamilyAffinityOwnedFile(
	repositoryRoot: string,
	ownedPath: string
): Promise<Buffer> {
	return readOwnedFileNoSymlinks(repositoryRoot, ownedPath);
}

export type AllocateFamilyAffinityRevisionInput = {
	repositoryRoot: string;
	manifestPath: string;
	namespace: 'canonical' | 'bridge';
	coordinateId: string;
	callerRole: string;
	reviewPath: string;
};

async function validateAllocationAnchor(
	repositoryRoot: string,
	manifest: FamilyAffinityManifest,
	target: FamilyAffinityTarget,
	manifestPath: string
): Promise<void> {
	if (target.affinity === 'normal' || target.status !== 'planned') {
		return;
	}
	if (target.anchor.kind !== 'normal-approved-review') {
		throw new Error('Planned elemental allocation requires an exact Normal approved-review anchor');
	}
	const anchor = target.anchor;
	const normalCoordinate = manifest.canonicalMatrix.activeCoordinates.find(
		({ coordinateId }) => coordinateId === `${target.familyId}/${target.formId}/normal`
	);
	if (
		!normalCoordinate ||
		normalCoordinate.activeVersion !== anchor.normalVersion ||
		normalCoordinate.targetPath !== anchor.normalTargetPath ||
		normalCoordinate.targetSha256 !== anchor.normalTargetSha256
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
	const receiptBytes = await readOwnedFileNoSymlinks(repositoryRoot, anchor.reviewReceiptPath);
	const receipt = FamilyAffinityReviewReceiptSchema.parse(
		JSON.parse(receiptBytes.toString('utf8'))
	);
	const candidateBytes = await readOwnedFileNoSymlinks(repositoryRoot, receipt.candidatePath);
	const resultBytes = await readOwnedFileNoSymlinks(repositoryRoot, receipt.resultPath);
	const familyPacketBytes = await readOwnedFileNoSymlinks(
		repositoryRoot,
		normalTarget.sources.familyPacketPath
	);
	const evidence = validateFamilyAffinityCandidateEvidence({
		target: normalTarget,
		assignment: normalAssignment,
		familyPacketBytes,
		candidateBytes,
		resultBytes
	});
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
	const manifest = FamilyAffinityManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
	const target = FamilyAffinityTargetSchema.parse(
		JSON.parse(
			(await readOwnedFileNoSymlinks(input.repositoryRoot, input.targetPath)).toString('utf8')
		)
	);
	await validateAllocationAnchor(input.repositoryRoot, manifest, target, input.manifestPath);
}

async function validateFullActiveCorpusBeforeAllocation(
	repositoryRoot: string,
	manifest: FamilyAffinityManifest,
	manifestPath: string
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
		if (seenTargetIds.has(target.targetId) || seenAssignmentIds.has(assignment.assignmentId)) {
			throw new Error('Active corpus contains an unreferenced or duplicate attempt pair');
		}
		seenTargetIds.add(target.targetId);
		seenAssignmentIds.add(assignment.assignmentId);
		await validateAllocationAnchor(repositoryRoot, manifest, target, manifestPath);
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

async function allocateFamilyAffinityRevisionUnlocked(
	input: AllocateFamilyAffinityRevisionInput,
	manifestAbsolute: string
) {
	const manifestBytes = await readOwnedFileNoSymlinks(input.repositoryRoot, input.manifestPath);
	const manifest = FamilyAffinityManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
	await validateFullActiveCorpusBeforeAllocation(
		input.repositoryRoot,
		manifest,
		input.manifestPath
	);
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
	await validateAllocationAnchor(input.repositoryRoot, manifest, currentTarget, input.manifestPath);
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
	if (receipt.decision !== 'rejected' && receipt.decision !== 'revise') {
		throw new Error('Current attempt must have a rejected or revise review decision');
	}
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
		currentTarget.sources.familyPacketPath
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
		manifestSha256: familyAffinityRawSha256(manifestBytes),
		target: currentTarget,
		targetPath: coordinate.targetPath,
		productionAssignment: currentAssignment,
		productionAssignmentPath: coordinate.assignmentPath,
		result: evidence.result,
		resultSha256: evidence.resultSha256
	});
	if (reviewAssignment.reviewerId !== receipt.reviewerId) {
		throw new Error('Rejected receipt reviewer does not match controller assignment');
	}
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
			manifestSha256: familyAffinityRawSha256(manifestBytes),
			target: currentTarget,
			targetPath: coordinate.targetPath,
			productionAssignment: currentAssignment,
			productionAssignmentPath: coordinate.assignmentPath,
			result: evidence.result,
			resultSha256: evidence.resultSha256
		});
		if (
			blind.decision !== receipt.decision ||
			blind.reviewerId === receipt.reviewerId ||
			blindAssignment.reviewerId !== blind.reviewerId
		) {
			throw new Error('Ordinary and blind revision decisions must agree independently');
		}
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
	const proposedPaths = [nextTargetPath, nextAssignmentPath, ...Object.values(nextOwnedPaths)];
	for (const proposed of proposedPaths) {
		if (await exists(absoluteOwnedPath(input.repositoryRoot, proposed))) {
			throw new Error(`Revision allocation collision: ${proposed}`);
		}
	}
	const targetStatus =
		currentTarget.status === 'earth-bridge-provisional'
			? currentTarget.status
			: currentAssignment.dispatchStatus;
	const nextTarget = FamilyAffinityTargetSchema.parse({
		...currentTarget,
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
		}
	});
	const nextAssignment = buildAssignment(nextTarget);
	const nextTargetAbsolute = absoluteOwnedPath(input.repositoryRoot, nextTargetPath);
	const nextAssignmentAbsolute = absoluteOwnedPath(input.repositoryRoot, nextAssignmentPath);
	await mkdir(dirname(nextTargetAbsolute), { recursive: true });
	await mkdir(dirname(nextAssignmentAbsolute), { recursive: true });
	const created: string[] = [];
	const temporaryManifest = `${manifestAbsolute}.revision-${process.pid}-${Date.now()}`;
	try {
		await writeFile(nextTargetAbsolute, stableFamilyAffinityJson(nextTarget), { flag: 'wx' });
		created.push(nextTargetAbsolute);
		await writeFile(nextAssignmentAbsolute, stableFamilyAffinityJson(nextAssignment), {
			flag: 'wx'
		});
		created.push(nextAssignmentAbsolute);
		coordinate.activeVersion = nextVersion;
		coordinate.targetPath = nextTargetPath;
		coordinate.targetSha256 = familyAffinitySha256(nextTarget);
		coordinate.assignmentPath = nextAssignmentPath;
		coordinate.assignmentSha256 = familyAffinitySha256(nextAssignment);
		coordinate.status = nextTarget.status;
		await writeFile(temporaryManifest, stableFamilyAffinityJson(manifest), { flag: 'wx' });
		await rename(temporaryManifest, manifestAbsolute);
	} catch (error) {
		await unlink(temporaryManifest).catch(() => undefined);
		for (const path of created.reverse()) await unlink(path).catch(() => undefined);
		throw error;
	}
	return {
		targetPath: nextTargetPath,
		assignmentPath: nextAssignmentPath,
		target: nextTarget,
		assignment: nextAssignment
	};
}

export async function allocateFamilyAffinityRevision(input: AllocateFamilyAffinityRevisionInput) {
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
		return await allocateFamilyAffinityRevisionUnlocked(input, manifestAbsolute);
	} finally {
		await unlink(lockPath).catch(() => undefined);
	}
}
