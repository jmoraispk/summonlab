import { z } from 'zod';

import { SkillIconRepositoryPathSchema } from './skill-icon-production.js';
import { IsoDateTimeSchema, StateHashSchema } from './shared.js';

const QUALITY_CLEANUP_ROOT = 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1';

const SkillIconCleanupTargetIdSchema = z
	.string()
	.regex(
		/^(?:martial|magical|craft):[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/u,
		'Expected a canonical skill target ID'
	)
	.max(200);

const CleanupSlugSchema = '[a-z0-9]+(?:-[a-z0-9]+)*';
const CleanupCompositePathSchema = z
	.string()
	.regex(
		new RegExp(`^${QUALITY_CLEANUP_ROOT}/composites/${CleanupSlugSchema}\\.png$`, 'u'),
		'Expected a versioned cleanup composite path'
	);
const CleanupInteriorPathSchema = z
	.string()
	.regex(
		new RegExp(`^${QUALITY_CLEANUP_ROOT}/interiors/${CleanupSlugSchema}\\.png$`, 'u'),
		'Expected a versioned cleanup interior path'
	);
const CleanupResultPathSchema = z
	.string()
	.regex(
		new RegExp(`^${QUALITY_CLEANUP_ROOT}/results/${CleanupSlugSchema}\\.json$`, 'u'),
		'Expected a versioned cleanup result path'
	);
const CleanupSourceCandidatePathSchema = SkillIconRepositoryPathSchema.refine(
	(path) =>
		new RegExp(
			'^assets/wiki/skills/icon-production-v1/mass-production-v1/icons/' +
				`${CleanupSlugSchema}\\.png$`,
			'u'
		).test(path),
	'Expected a frozen mass-production icon source candidate path'
);

const FixedAuthoritySchema = (path: string, contentHash: string) =>
	z.object({ path: z.literal(path), contentHash: z.literal(contentHash) }).strict();

export const SkillIconCleanupAuthoritySchema = z
	.object({
		massProductionManifest: FixedAuthoritySchema(
			'assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json',
			'7103c8d6c7ac006dcc4c332875ac4b44213d239079219363f9056b78bd3506bf'
		),
		catalog: FixedAuthoritySchema(
			'assets/wiki/skills/icon-production-v1/catalog.json',
			'71add63ae46e6e0b68d807bb5bca6060b101213682fc8e1c9037ad1fe3744aaf'
		),
		motifMap: FixedAuthoritySchema(
			'assets/wiki/skills/icon-production-v1/motif-map.json',
			'd9b82036326ebd35dc8689875c0bab3ae638ed31de64d4b4c8ded5a96428f1c7'
		),
		visualSpecifications: FixedAuthoritySchema(
			'assets/wiki/skills/icon-production-v1/visual-specs.json',
			'08d2b4018644f9d3b5166c41cf71768207fb9ffe821b2d83fde05707037b0514'
		),
		selectedFrameSheet: FixedAuthoritySchema(
			'assets/wiki/skills/icon-production-v1/mass-production-v1/references/approved-seven-frame-sheet.png',
			'4ee72c8ecbdf6fb997d63480a3a1ca14cae4cbc8278fca3db97f9d0d756d0266'
		),
		optionCMaterial: FixedAuthoritySchema(
			'assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png',
			'66af9144bc4cb5d8bb1420c5a07cfe9652c7ccbccf17519da938b21298b929ce'
		),
		geometry: FixedAuthoritySchema(
			'assets/wiki/skills/icon-production-v1/geometry-v2.json',
			'6ffaaa99a2e19c7589bcb2f7975268117db199abd45752fd164567cb5042fcab'
		),
		providerSpaceGuide: FixedAuthoritySchema(
			'assets/wiki/skills/icon-production-v1/references/geometry-guide-v2.png',
			'8f1c01435f3e32de07560b154d9e3becba3ca2a38773ca74c3115d66ba28094e'
		)
	})
	.strict();

export const SkillIconCleanupFindingSchema = z
	.object({
		targetId: SkillIconCleanupTargetIdSchema,
		kind: z.enum(['frame-composition', 'stray-ui-glyph', 'symbolic-owner-review']),
		detail: z.string().trim().min(1),
		requiredAction: z.enum(['recompose', 'revise-art', 'owner-review'])
	})
	.strict()
	.superRefine((finding, context) => {
		const requiredActionByKind = {
			'frame-composition': 'recompose',
			'stray-ui-glyph': 'revise-art',
			'symbolic-owner-review': 'owner-review'
		} as const;
		if (finding.requiredAction !== requiredActionByKind[finding.kind]) {
			context.addIssue({
				code: 'custom',
				path: ['requiredAction'],
				message: 'Finding kind must use its required cleanup action'
			});
		}
	});

const SkillIconCleanupRecordSchema = z
	.object({
		targetId: SkillIconCleanupTargetIdSchema,
		sourceCandidate: z
			.object({ path: CleanupSourceCandidatePathSchema, contentHash: StateHashSchema })
			.strict(),
		rank: z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S']),
		disposition: z.enum(['recompose', 'revise-art', 'owner-review', 'accepted-unchanged']),
		findings: z.array(SkillIconCleanupFindingSchema),
		cleanupCompositePath: CleanupCompositePathSchema,
		resultPath: CleanupResultPathSchema
	})
	.strict()
	.superRefine((record, context) => {
		if (record.findings.some((finding) => finding.targetId !== record.targetId)) {
			context.addIssue({
				code: 'custom',
				path: ['findings'],
				message: 'Cleanup findings must bind the record target'
			});
		}
		if (
			record.sourceCandidate.path === record.cleanupCompositePath ||
			record.sourceCandidate.path === record.resultPath ||
			record.cleanupCompositePath === record.resultPath
		) {
			context.addIssue({
				code: 'custom',
				message: 'Cleanup source and output paths must not collide'
			});
		}
	});

export const SkillIconCleanupManifestSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-quality-cleanup-manifest-v1'),
		authority: SkillIconCleanupAuthoritySchema,
		records: z.array(SkillIconCleanupRecordSchema).length(456)
	})
	.strict()
	.superRefine((manifest, context) => {
		const targetIds = manifest.records.map(({ targetId }) => targetId);
		if (new Set(targetIds).size !== targetIds.length) {
			context.addIssue({ code: 'custom', path: ['records'], message: 'Duplicate target ID' });
		}
		for (const key of ['sourceCandidate', 'cleanupCompositePath', 'resultPath'] as const) {
			const paths = manifest.records.map((record) =>
				key === 'sourceCandidate' ? record.sourceCandidate.path : record[key]
			);
			if (new Set(paths).size !== paths.length) {
				context.addIssue({
					code: 'custom',
					path: ['records'],
					message: `Duplicate cleanup ${key} path`
				});
			}
		}
		const sourcePaths = new Set(
			manifest.records.map(({ sourceCandidate }) => sourceCandidate.path)
		);
		const outputPaths = new Set(
			manifest.records.flatMap(({ cleanupCompositePath, resultPath }) => [
				cleanupCompositePath,
				resultPath
			])
		);
		if (Array.from(sourcePaths).some((path) => outputPaths.has(path))) {
			context.addIssue({
				code: 'custom',
				path: ['records'],
				message: 'Cleanup source and output paths must not collide across records'
			});
		}
	});

const CleanupLayerAuthoritySchema = z
	.object({ path: SkillIconRepositoryPathSchema, contentHash: StateHashSchema })
	.strict();

export const SkillIconCleanupResultSchema = SkillIconCleanupRecordSchema.safeExtend({
	schemaVersion: z.literal('skill-icon-quality-cleanup-result-v1'),
	cleanupInterior: z
		.object({
			path: CleanupInteriorPathSchema,
			contentHash: StateHashSchema,
			removedPixels: z.number().int().nonnegative(),
			removedPixelBounds: z
				.object({
					left: z.number().int().nonnegative(),
					top: z.number().int().nonnegative(),
					width: z.number().int().positive(),
					height: z.number().int().positive()
				})
				.strict()
				.nullable()
		})
		.strict(),
	compositionAuthority: z
		.object({
			geometry: CleanupLayerAuthoritySchema.safeExtend({
				path: z.literal('assets/wiki/skills/icon-production-v1/geometry-v2.json')
			}),
			backing: CleanupLayerAuthoritySchema.safeExtend({
				path: z.literal(
					'assets/wiki/skills/icon-production-v1/candidates/references/charcoal-forged-stone-v6.png'
				)
			}),
			frame: CleanupLayerAuthoritySchema.safeExtend({
				path: z
					.string()
					.regex(
						/^assets\/wiki\/skills\/icon-production-v1\/candidates\/references\/rarity-frame-[fedcbas]-v9\.png$/u
					)
			})
		})
		.strict(),
	cleanupCompositeContentHash: StateHashSchema,
	resultContentHash: StateHashSchema
}).superRefine((result, context) => {
	const slug = result.targetId.replaceAll(':', '-');
	if (result.cleanupInterior.path !== `${QUALITY_CLEANUP_ROOT}/interiors/${slug}.png`) {
		context.addIssue({
			code: 'custom',
			path: ['cleanupInterior', 'path'],
			message: 'Cleanup interior path must bind the result target'
		});
	}
	if (
		(result.cleanupInterior.removedPixels === 0) !==
		(result.cleanupInterior.removedPixelBounds === null)
	) {
		context.addIssue({
			code: 'custom',
			path: ['cleanupInterior', 'removedPixelBounds'],
			message: 'Cleanup removal bounds must exist exactly when visible pixels were removed'
		});
	}
	const expectedFramePath = `assets/wiki/skills/icon-production-v1/candidates/references/rarity-frame-${result.rank.toLowerCase()}-v9.png`;
	if (result.compositionAuthority.frame.path !== expectedFramePath) {
		context.addIssue({
			code: 'custom',
			path: ['compositionAuthority', 'frame', 'path'],
			message: 'Cleanup frame authority must bind the result rank'
		});
	}
});

export const SkillIconCleanupOwnerReviewSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-quality-cleanup-owner-review-v1'),
		reviewId: z.string().trim().min(1).max(200),
		reviewer: z.string().trim().min(1).max(200),
		reviewerRole: z.literal('owner'),
		cleanupManifestPath: z.literal(`${QUALITY_CLEANUP_ROOT}/manifest.json`),
		cleanupManifestContentHash: StateHashSchema,
		decision: z.enum(['accepted', 'rejected']),
		reviewedAt: IsoDateTimeSchema
	})
	.strict();

const SkillIconCleanupSelectedRecordSchema = z
	.object({
		targetId: SkillIconCleanupTargetIdSchema,
		disposition: z.literal('selected'),
		cleanupCompositePath: CleanupCompositePathSchema,
		cleanupCompositeContentHash: StateHashSchema
	})
	.strict();

export const SkillIconCleanupSelectionSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-quality-cleanup-selection-v1'),
		cleanupManifestPath: z.literal(`${QUALITY_CLEANUP_ROOT}/manifest.json`),
		cleanupManifestContentHash: StateHashSchema,
		ownerReviewPath: z.literal(`${QUALITY_CLEANUP_ROOT}/review/owner-review-v1.json`),
		ownerReviewContentHash: StateHashSchema,
		ownerReview: SkillIconCleanupOwnerReviewSchema,
		records: z.array(SkillIconCleanupSelectedRecordSchema).length(456)
	})
	.strict()
	.superRefine((selection, context) => {
		if (selection.ownerReview.decision !== 'accepted') {
			context.addIssue({
				code: 'custom',
				path: ['ownerReview', 'decision'],
				message: 'Selected cleanup records require an accepted owner review'
			});
		}
		if (selection.ownerReview.cleanupManifestPath !== selection.cleanupManifestPath) {
			context.addIssue({
				code: 'custom',
				path: ['ownerReview', 'cleanupManifestPath'],
				message: 'Owner review must bind the selected cleanup manifest path'
			});
		}
		if (selection.ownerReview.cleanupManifestContentHash !== selection.cleanupManifestContentHash) {
			context.addIssue({
				code: 'custom',
				path: ['ownerReview', 'cleanupManifestContentHash'],
				message: 'Owner review must bind the selected cleanup manifest hash'
			});
		}
		const targetIds = selection.records.map(({ targetId }) => targetId);
		if (new Set(targetIds).size !== targetIds.length) {
			context.addIssue({
				code: 'custom',
				path: ['records'],
				message: 'Duplicate selected target ID'
			});
		}
	});

const CleanupRevisionV2BindingSchema = z
	.object({ path: SkillIconRepositoryPathSchema, contentHash: StateHashSchema })
	.strict();

const CleanupRevisionV2ArtifactSchema = z
	.object({
		path: SkillIconRepositoryPathSchema,
		mediaType: z.literal('image/png'),
		width: z.number().int().positive(),
		height: z.number().int().positive(),
		bytes: z.number().int().positive(),
		contentHash: StateHashSchema
	})
	.strict();

const CleanupRevisionV2OutputSchema = z
	.object({
		providerSourcePath: SkillIconRepositoryPathSchema,
		revisedInteriorPath: SkillIconRepositoryPathSchema,
		compositePath: SkillIconRepositoryPathSchema,
		resultPath: SkillIconRepositoryPathSchema
	})
	.strict();

const CleanupRevisionPacketSchemaVersion = z
	.string()
	.regex(/^skill-icon-quality-cleanup-revision-packet-v(?:[2-9]|[1-9][0-9]+)$/u);
const CleanupRevisionResultSchemaVersion = z
	.string()
	.regex(/^skill-icon-quality-cleanup-revision-result-v(?:[2-9]|[1-9][0-9]+)$/u);

function cleanupRevisionOutputPaths(targetId: string, revision: number) {
	const slug = targetId.replaceAll(':', '-');
	return {
		providerSourcePath: `${QUALITY_CLEANUP_ROOT}/provider-sources/${slug}-v${revision}.png`,
		revisedInteriorPath: `${QUALITY_CLEANUP_ROOT}/revisions/${slug}-v${revision}.png`,
		compositePath: `${QUALITY_CLEANUP_ROOT}/composites/${slug}-v${revision}.png`,
		resultPath: `${QUALITY_CLEANUP_ROOT}/results/revisions/${slug}-v${revision}.json`
	};
}

function cleanupRevisionPredecessorPaths(targetId: string, revision: number) {
	const slug = targetId.replaceAll(':', '-');
	if (revision === 2) {
		return {
			packet: `${QUALITY_CLEANUP_ROOT}/prompts/revisions/${slug}-v1.json`,
			result: `${QUALITY_CLEANUP_ROOT}/results/revisions/${slug}-v1.json`
		};
	}
	return {
		packet: `${QUALITY_CLEANUP_ROOT}/prompts/revisions-v${revision - 1}/${slug}-v${revision - 1}.json`,
		result: `${QUALITY_CLEANUP_ROOT}/results/revisions/${slug}-v${revision - 1}.json`
	};
}

const CleanupRevisionV2TransformSchema = z.union([
	z
		.object({
			kind: z.literal('inset-87-of-128-v1'),
			decoderInput: z.literal('remove-bounded-cabx-and-assign-srgb'),
			resize: z
				.object({
					width: z.literal(696),
					height: z.literal(696),
					kernel: z.literal('lanczos3'),
					fastShrinkOnLoad: z.literal(false)
				})
				.strict(),
			placement: z.object({ left: z.literal(164), top: z.literal(192) }).strict(),
			canvas: z.object({ width: z.literal(1024), height: z.literal(1024) }).strict(),
			mask: z.literal('geometry-v2-protected-central-aperture')
		})
		.strict(),
	z
		.object({
			kind: z.string().regex(/^identity-adoption-v[1-9][0-9]*$/u),
			revisedInterior: CleanupRevisionV2BindingSchema,
			composite: CleanupRevisionV2BindingSchema,
			mask: z.string().regex(/^v[1-9][0-9]*-approved-composition-retained-byte-for-byte$/u)
		})
		.strict()
]);

const CleanupRevisionV2PredecessorSchema = z
	.object({
		packet: CleanupRevisionV2BindingSchema,
		result: CleanupRevisionV2BindingSchema,
		completionAudit: CleanupRevisionV2BindingSchema.optional(),
		providerSource: CleanupRevisionV2BindingSchema,
		transactionContentHash: StateHashSchema,
		revisedInterior: CleanupRevisionV2BindingSchema,
		composite: CleanupRevisionV2BindingSchema
	})
	.strict();

const CleanupRevisionV2FindingSchema = z
	.object({
		targetId: SkillIconCleanupTargetIdSchema,
		kind: z.literal('stray-ui-glyph'),
		detail: z.string().trim().min(1),
		requiredAction: z.literal('revise-art')
	})
	.strict();

const CleanupRevisionV2CompositionAuthoritySchema = z
	.object({
		geometry: CleanupRevisionV2BindingSchema,
		backing: CleanupRevisionV2BindingSchema,
		frame: CleanupRevisionV2BindingSchema
	})
	.strict();

const CleanupRevisionV2ProviderEnvelopeSchema = z
	.object({
		profile: z.literal('skill-icon-provider-envelope-v3'),
		mediaType: z.literal('image/png'),
		width: z.literal(1254),
		height: z.literal(1254),
		alphaMode: z.literal('rgb')
	})
	.strict();

export const SkillIconCleanupRevisionV2PacketSchema = z
	.object({
		schemaVersion: CleanupRevisionPacketSchemaVersion,
		revision: z.number().int().min(2),
		targetId: SkillIconCleanupTargetIdSchema,
		name: z.string().trim().min(1),
		domain: z.string().trim().min(1),
		family: z.string().trim().min(1),
		rank: z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S']),
		motifFamily: z.string().trim().min(1),
		finding: CleanupRevisionV2FindingSchema,
		predecessor: CleanupRevisionV2PredecessorSchema,
		sourceMode: z.enum(['deterministic-inset', 'identity-adoption', 'generation-v2']),
		generationTool: z.literal('built-in-imagegen').optional(),
		transform: CleanupRevisionV2TransformSchema,
		exactPrompt: z.string().trim().min(1),
		exactPromptHash: StateHashSchema,
		references: z
			.array(
				z
					.object({
						path: SkillIconRepositoryPathSchema,
						purpose: z.string().trim().min(1),
						contentHash: StateHashSchema
					})
					.strict()
			)
			.length(5),
		compositionAuthority: CleanupRevisionV2CompositionAuthoritySchema,
		providerEnvelope: CleanupRevisionV2ProviderEnvelopeSchema,
		attempts: z
			.object({ initial: z.literal(1), correctiveEdits: z.literal(1), maximum: z.literal(2) })
			.strict(),
		reviewRequirements: z
			.object({
				fullSize: z.object({ width: z.literal(1024), height: z.literal(1024) }).strict(),
				display: z.object({ width: z.literal(384), height: z.literal(384) }).strict(),
				candidateRequiresBothPass: z.literal(true)
			})
			.strict()
			.optional(),
		output: CleanupRevisionV2OutputSchema
	})
	.strict()
	.superRefine((packet, context) => {
		const expectedOutput = cleanupRevisionOutputPaths(packet.targetId, packet.revision);
		const predecessorPaths = cleanupRevisionPredecessorPaths(packet.targetId, packet.revision);
		if (packet.schemaVersion !== `skill-icon-quality-cleanup-revision-packet-v${packet.revision}`) {
			context.addIssue({
				code: 'custom',
				path: ['schemaVersion'],
				message: 'Revision packet schema version must bind its numeric revision'
			});
		}
		if (JSON.stringify(packet.output) !== JSON.stringify(expectedOutput)) {
			context.addIssue({
				code: 'custom',
				path: ['output'],
				message: 'Revision output paths must bind the target and revision'
			});
		}
		if (
			(packet.sourceMode === 'identity-adoption') !==
			packet.transform.kind.startsWith('identity-adoption-v')
		) {
			context.addIssue({
				code: 'custom',
				path: ['transform'],
				message: 'Revision source mode must use its exact transform authority'
			});
		}
		if (
			packet.sourceMode === 'identity-adoption' &&
			packet.transform.kind !== `identity-adoption-v${packet.revision - 1}`
		) {
			context.addIssue({
				code: 'custom',
				path: ['transform', 'kind'],
				message: 'Identity adoption must bind the immediate predecessor revision'
			});
		}
		if (
			packet.sourceMode === 'identity-adoption' &&
			packet.transform.mask !==
				`v${packet.revision - 1}-approved-composition-retained-byte-for-byte`
		) {
			context.addIssue({
				code: 'custom',
				path: ['transform', 'mask'],
				message: 'Identity adoption must bind the immediate predecessor composition authority'
			});
		}
		if (
			packet.sourceMode === 'identity-adoption' &&
			(!('revisedInterior' in packet.transform) ||
				!('composite' in packet.transform) ||
				packet.transform.revisedInterior.path !== packet.predecessor.revisedInterior.path ||
				packet.transform.revisedInterior.contentHash !==
					packet.predecessor.revisedInterior.contentHash ||
				packet.transform.composite.path !== packet.predecessor.composite.path ||
				packet.transform.composite.contentHash !== packet.predecessor.composite.contentHash)
		) {
			context.addIssue({
				code: 'custom',
				path: ['transform'],
				message:
					'Identity adoption must retain the immediate predecessor interior and composite bindings'
			});
		}
		if (
			packet.predecessor.packet.path !== predecessorPaths.packet ||
			packet.predecessor.result.path !== predecessorPaths.result
		) {
			context.addIssue({
				code: 'custom',
				path: ['predecessor'],
				message: 'Revision predecessor must bind this target’s immediate packet and result'
			});
		}
		if (
			packet.revision >= 3 &&
			packet.sourceMode === 'generation-v2' &&
			(packet.predecessor.completionAudit === undefined ||
				packet.generationTool !== 'built-in-imagegen' ||
				packet.reviewRequirements === undefined)
		) {
			context.addIssue({
				code: 'custom',
				path: ['predecessor'],
				message:
					'Generated revision v3+ must bind its predecessor audit, generation tool, and two-scale review contract'
			});
		}
	});

const CleanupRevisionV2InspectionSchema = z
	.object({ outcome: z.enum(['pass', 'fail']), observation: z.string().trim().min(1).max(1000) })
	.strict();

const CleanupRevisionV2PhaseSchema = z
	.object({
		name: z.enum(['source-read', 'normalization', 'composition', 'inspection', 'publication']),
		startedAt: IsoDateTimeSchema,
		finishedAt: IsoDateTimeSchema,
		durationMs: z.number().int().nonnegative()
	})
	.strict()
	.superRefine((phase, context) => {
		if (Date.parse(phase.finishedAt) < Date.parse(phase.startedAt)) {
			context.addIssue({
				code: 'custom',
				path: ['finishedAt'],
				message: 'Execution phase cannot finish before it starts'
			});
		}
	});

const CleanupRevisionV2ExecutionSchema = z
	.object({
		startedAt: IsoDateTimeSchema,
		finishedAt: IsoDateTimeSchema,
		durationMs: z.number().int().nonnegative(),
		phases: z.array(CleanupRevisionV2PhaseSchema).min(1),
		generation: z
			.object({
				attemptCount: z.number().int().min(0).max(2),
				callIdentifiers: z.array(z.string().trim().min(1)).max(2),
				callContentHashes: z.array(StateHashSchema).max(2).optional()
			})
			.strict(),
		normalizationTransactionCount: z.number().int().nonnegative(),
		invocation: z
			.object({
				tool: z.literal('tools/persist-skill-icon-cleanup-v2-output.ts'),
				command: z.literal('persist:skill-icon-cleanup-v2-output'),
				nodeVersion: z.string().trim().min(1),
				sharpVersion: z.string().trim().min(1),
				vipsVersion: z.string().trim().min(1)
			})
			.strict()
	})
	.strict()
	.superRefine((execution, context) => {
		if (Date.parse(execution.finishedAt) < Date.parse(execution.startedAt)) {
			context.addIssue({
				code: 'custom',
				path: ['finishedAt'],
				message: 'V2 execution cannot finish before it starts'
			});
		}
		if (execution.generation.attemptCount !== execution.generation.callIdentifiers.length) {
			context.addIssue({
				code: 'custom',
				path: ['generation'],
				message: 'V2 generation calls require one identifier per actual call'
			});
		}
		if (
			execution.generation.callContentHashes !== undefined &&
			execution.generation.attemptCount !== execution.generation.callContentHashes.length
		) {
			context.addIssue({
				code: 'custom',
				path: ['generation'],
				message: 'V2 generation calls require one content hash per actual call'
			});
		}
	});

export const SkillIconCleanupRevisionV2ResultSchema = z
	.object({
		schemaVersion: CleanupRevisionResultSchemaVersion,
		revision: z.number().int().min(2),
		status: z.enum(['candidate', 'revise', 'failed']),
		targetId: SkillIconCleanupTargetIdSchema,
		name: z.string().trim().min(1),
		rank: z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S']),
		motifFamily: z.string().trim().min(1),
		finding: CleanupRevisionV2FindingSchema,
		revisionPacket: CleanupRevisionV2BindingSchema,
		predecessor: CleanupRevisionV2PredecessorSchema,
		sourceMode: z.enum(['deterministic-inset', 'identity-adoption', 'generation-v2']),
		transform: CleanupRevisionV2TransformSchema,
		providerSource: CleanupRevisionV2ArtifactSchema.safeExtend({
			width: z.literal(1254),
			height: z.literal(1254),
			alphaMode: z.literal('rgb')
		}),
		revisedInterior: CleanupRevisionV2ArtifactSchema.safeExtend({
			width: z.literal(1024),
			height: z.literal(1024)
		}),
		compositionAuthority: CleanupRevisionV2CompositionAuthoritySchema,
		composite: CleanupRevisionV2ArtifactSchema.safeExtend({
			width: z.literal(1024),
			height: z.literal(1024)
		}),
		display384: CleanupRevisionV2ArtifactSchema.omit({ path: true }).safeExtend({
			width: z.literal(384),
			height: z.literal(384)
		}),
		inspection: z
			.object({
				fullSize: CleanupRevisionV2InspectionSchema,
				display384: CleanupRevisionV2InspectionSchema
			})
			.strict(),
		execution: CleanupRevisionV2ExecutionSchema,
		transactionContentHash: StateHashSchema,
		resultPath: SkillIconRepositoryPathSchema,
		writtenOutputPaths: z.array(SkillIconRepositoryPathSchema).length(4),
		completionContract: z
			.object({
				sharedFilesRemainUntouched: z.literal(true),
				selfPromotionForbidden: z.literal(true)
			})
			.strict()
	})
	.strict()
	.superRefine((result, context) => {
		const slug = result.targetId.replaceAll(':', '-');
		const expectedPacketPath = `${QUALITY_CLEANUP_ROOT}/prompts/revisions-v${result.revision}/${slug}-v${result.revision}.json`;
		const expectedOutput = cleanupRevisionOutputPaths(result.targetId, result.revision);
		if (result.schemaVersion !== `skill-icon-quality-cleanup-revision-result-v${result.revision}`) {
			context.addIssue({
				code: 'custom',
				path: ['schemaVersion'],
				message: 'Revision result schema version must bind its numeric revision'
			});
		}
		if (
			result.revisionPacket.path !== expectedPacketPath ||
			result.resultPath !== expectedOutput.resultPath
		) {
			context.addIssue({
				code: 'custom',
				message: 'Revision result paths must bind its target and packet'
			});
		}
		if (
			result.providerSource.path !== expectedOutput.providerSourcePath ||
			result.revisedInterior.path !== expectedOutput.revisedInteriorPath ||
			result.composite.path !== expectedOutput.compositePath ||
			JSON.stringify(result.writtenOutputPaths) !== JSON.stringify(Object.values(expectedOutput))
		) {
			context.addIssue({
				code: 'custom',
				message: 'Revision result outputs must be exact append-only paths'
			});
		}
		if (
			(result.sourceMode === 'identity-adoption') !==
			result.transform.kind.startsWith('identity-adoption-v')
		) {
			context.addIssue({
				code: 'custom',
				message: 'Revision result source mode and transform disagree'
			});
		}
		if (
			result.sourceMode === 'identity-adoption' &&
			result.transform.kind !== `identity-adoption-v${result.revision - 1}`
		) {
			context.addIssue({
				code: 'custom',
				path: ['transform', 'kind'],
				message: 'Identity-adoption result must bind the immediate predecessor revision'
			});
		}
		if (
			result.sourceMode === 'identity-adoption' &&
			(!('revisedInterior' in result.transform) ||
				!('composite' in result.transform) ||
				result.transform.revisedInterior.path !== result.predecessor.revisedInterior.path ||
				result.transform.revisedInterior.contentHash !==
					result.predecessor.revisedInterior.contentHash ||
				result.transform.composite.path !== result.predecessor.composite.path ||
				result.transform.composite.contentHash !== result.predecessor.composite.contentHash)
		) {
			context.addIssue({
				code: 'custom',
				path: ['transform'],
				message:
					'Identity-adoption result must retain the immediate predecessor interior and composite bindings'
			});
		}
		if (
			result.sourceMode !== 'generation-v2' &&
			(result.execution.generation.attemptCount !== 0 ||
				(result.execution.generation.callContentHashes?.length ?? 0) !== 0)
		) {
			context.addIssue({
				code: 'custom',
				path: ['execution', 'generation'],
				message: 'Deterministic V2 lanes cannot claim generation calls'
			});
		}
		if (
			result.sourceMode === 'generation-v2' &&
			(result.execution.generation.attemptCount === 0 ||
				result.execution.generation.callContentHashes === undefined ||
				result.execution.generation.callContentHashes.length === 0)
		) {
			context.addIssue({
				code: 'custom',
				path: ['execution', 'generation'],
				message: 'Generated V2 lanes require actual call identifiers and hashes'
			});
		}
		if (
			result.status === 'candidate' &&
			(result.inspection.fullSize.outcome !== 'pass' ||
				result.inspection.display384.outcome !== 'pass')
		) {
			context.addIssue({
				code: 'custom',
				path: ['inspection'],
				message: 'A V2 candidate requires passing full-size and 384px inspection'
			});
		}
	});

const CleanupRevisionCompletionAuditArtifactsSchema = z
	.object({
		providerSource: CleanupRevisionV2BindingSchema,
		revisedInterior: CleanupRevisionV2BindingSchema,
		composite: CleanupRevisionV2BindingSchema,
		result: CleanupRevisionV2BindingSchema
	})
	.strict();

/**
 * This file is intentionally published only after the four core artifacts.  It
 * attests to the completed core transaction, not to the completion time of its
 * own publication, which would be a circular and unverifiable claim.
 */
export const SkillIconCleanupRevisionCompletionAuditSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-quality-cleanup-revision-completion-audit-v1'),
		revision: z.number().int().min(2),
		targetId: SkillIconCleanupTargetIdSchema,
		revisionPacket: CleanupRevisionV2BindingSchema,
		result: CleanupRevisionV2BindingSchema,
		status: z.enum(['candidate', 'revise', 'failed']),
		corePublication: z
			.object({
				startedAt: IsoDateTimeSchema,
				completedAt: IsoDateTimeSchema,
				durationMs: z.number().int().nonnegative(),
				artifacts: CleanupRevisionCompletionAuditArtifactsSchema
			})
			.strict()
	})
	.strict()
	.superRefine((audit, context) => {
		const expectedPacketPath = `${QUALITY_CLEANUP_ROOT}/prompts/revisions-v${audit.revision}/${audit.targetId.replaceAll(':', '-')}-v${audit.revision}.json`;
		const expectedOutput = cleanupRevisionOutputPaths(audit.targetId, audit.revision);
		if (audit.revisionPacket.path !== expectedPacketPath) {
			context.addIssue({
				code: 'custom',
				path: ['revisionPacket', 'path'],
				message: 'Completion audit must bind its exact revision packet path'
			});
		}
		if (audit.result.path !== expectedOutput.resultPath) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'path'],
				message: 'Completion audit must bind its exact revision result path'
			});
		}
		if (
			audit.corePublication.artifacts.providerSource.path !== expectedOutput.providerSourcePath ||
			audit.corePublication.artifacts.revisedInterior.path !== expectedOutput.revisedInteriorPath ||
			audit.corePublication.artifacts.composite.path !== expectedOutput.compositePath ||
			audit.corePublication.artifacts.result.path !== expectedOutput.resultPath
		) {
			context.addIssue({
				code: 'custom',
				path: ['corePublication', 'artifacts'],
				message: 'Completion audit artifacts must bind exact append-only output paths'
			});
		}
		if (
			Date.parse(audit.corePublication.completedAt) < Date.parse(audit.corePublication.startedAt)
		) {
			context.addIssue({
				code: 'custom',
				path: ['corePublication', 'completedAt'],
				message: 'Core publication cannot complete before it starts'
			});
		}
	});

export type SkillIconCleanupManifest = z.infer<typeof SkillIconCleanupManifestSchema>;
export type SkillIconCleanupFinding = z.infer<typeof SkillIconCleanupFindingSchema>;
export type SkillIconCleanupResult = z.infer<typeof SkillIconCleanupResultSchema>;
export type SkillIconCleanupOwnerReview = z.infer<typeof SkillIconCleanupOwnerReviewSchema>;
export type SkillIconCleanupSelection = z.infer<typeof SkillIconCleanupSelectionSchema>;
export type SkillIconCleanupRevisionV2Packet = z.infer<
	typeof SkillIconCleanupRevisionV2PacketSchema
>;
export type SkillIconCleanupRevisionV2Result = z.infer<
	typeof SkillIconCleanupRevisionV2ResultSchema
>;
export type SkillIconCleanupRevisionCompletionAudit = z.infer<
	typeof SkillIconCleanupRevisionCompletionAuditSchema
>;
