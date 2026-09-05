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
						/^assets\/wiki\/skills\/icon-production-v1\/candidates\/references\/(?:rarity-frame-f-v5|rarity-frame-[edcbas]-v8)\.png$/u
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
	const frameRevision = result.rank === 'F' ? 5 : 8;
	const expectedFramePath = `assets/wiki/skills/icon-production-v1/candidates/references/rarity-frame-${result.rank.toLowerCase()}-v${frameRevision}.png`;
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

export type SkillIconCleanupManifest = z.infer<typeof SkillIconCleanupManifestSchema>;
export type SkillIconCleanupFinding = z.infer<typeof SkillIconCleanupFindingSchema>;
export type SkillIconCleanupResult = z.infer<typeof SkillIconCleanupResultSchema>;
export type SkillIconCleanupOwnerReview = z.infer<typeof SkillIconCleanupOwnerReviewSchema>;
export type SkillIconCleanupSelection = z.infer<typeof SkillIconCleanupSelectionSchema>;
