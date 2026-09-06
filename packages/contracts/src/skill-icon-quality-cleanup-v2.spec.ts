import { describe, expect, it } from 'vitest';

import {
	SkillIconCleanupRevisionCompletionAuditSchema,
	SkillIconCleanupRevisionV2PacketSchema,
	SkillIconCleanupRevisionV2ResultSchema
} from './index.js';

const hash = 'a'.repeat(64);
const root = 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1';
const targetId = 'martial:blade:blade-dance';
const slug = targetId.replaceAll(':', '-');

function binding(path: string) {
	return { path, contentHash: hash };
}

function validPacket() {
	return {
		schemaVersion: 'skill-icon-quality-cleanup-revision-packet-v2' as const,
		revision: 2 as const,
		targetId,
		name: 'Blade Dance',
		domain: 'Martial',
		family: 'Blade',
		rank: 'D' as const,
		motifFamily: 'blade.sword-dance',
		finding: {
			targetId,
			kind: 'stray-ui-glyph' as const,
			detail: 'Up/down arrows.',
			requiredAction: 'revise-art' as const
		},
		predecessor: {
			packet: binding(`${root}/prompts/revisions/${slug}-v1.json`),
			result: binding(`${root}/results/revisions/${slug}-v1.json`),
			providerSource: binding(`${root}/provider-sources/${slug}-v1.png`),
			transactionContentHash: hash,
			revisedInterior: binding(`${root}/revisions/${slug}-v1.png`),
			composite: binding(`${root}/composites/${slug}-v1.png`)
		},
		sourceMode: 'deterministic-inset' as const,
		transform: {
			kind: 'inset-87-of-128-v1' as const,
			decoderInput: 'remove-bounded-cabx-and-assign-srgb' as const,
			resize: {
				width: 696 as const,
				height: 696 as const,
				kernel: 'lanczos3' as const,
				fastShrinkOnLoad: false as const
			},
			placement: { left: 164 as const, top: 192 as const },
			canvas: { width: 1024 as const, height: 1024 as const },
			mask: 'geometry-v2-protected-central-aperture' as const
		},
		exactPrompt: 'Exact bounded v2 prompt.',
		exactPromptHash: hash,
		references: Array.from({ length: 5 }, (_, index) => ({
			path: `assets/wiki/skills/icon-production-v1/references/reference-${index}.png`,
			purpose: `Reference ${index}`,
			contentHash: hash
		})),
		compositionAuthority: {
			geometry: binding('assets/wiki/skills/icon-production-v1/geometry-v2.json'),
			backing: binding(
				'assets/wiki/skills/icon-production-v1/candidates/references/charcoal-forged-stone-v6.png'
			),
			frame: binding(
				'assets/wiki/skills/icon-production-v1/candidates/references/rarity-frame-d-v9.png'
			)
		},
		providerEnvelope: {
			profile: 'skill-icon-provider-envelope-v3' as const,
			mediaType: 'image/png' as const,
			width: 1254 as const,
			height: 1254 as const,
			alphaMode: 'rgb' as const
		},
		attempts: { initial: 1 as const, correctiveEdits: 1 as const, maximum: 2 as const },
		output: {
			providerSourcePath: `${root}/provider-sources/${slug}-v2.png`,
			revisedInteriorPath: `${root}/revisions/${slug}-v2.png`,
			compositePath: `${root}/composites/${slug}-v2.png`,
			resultPath: `${root}/results/revisions/${slug}-v2.json`
		}
	};
}

function artifact(path: string) {
	return {
		path,
		mediaType: 'image/png' as const,
		width: 1024,
		height: 1024,
		bytes: 1024,
		contentHash: hash
	};
}

function validResult() {
	const packet = validPacket();
	return {
		schemaVersion: 'skill-icon-quality-cleanup-revision-result-v2' as const,
		revision: 2 as const,
		status: 'candidate' as const,
		targetId: packet.targetId,
		name: packet.name,
		rank: packet.rank,
		motifFamily: packet.motifFamily,
		finding: packet.finding,
		revisionPacket: binding(`${root}/prompts/revisions-v2/${slug}-v2.json`),
		predecessor: packet.predecessor,
		sourceMode: packet.sourceMode,
		transform: packet.transform,
		providerSource: {
			...artifact(packet.output.providerSourcePath),
			width: 1254,
			height: 1254,
			alphaMode: 'rgb' as const
		},
		revisedInterior: artifact(packet.output.revisedInteriorPath),
		compositionAuthority: packet.compositionAuthority,
		composite: artifact(packet.output.compositePath),
		display384: {
			mediaType: 'image/png' as const,
			width: 384,
			height: 384,
			bytes: 384,
			contentHash: hash
		},
		inspection: {
			fullSize: {
				outcome: 'pass' as const,
				observation: 'Complete subject remains within the aperture.'
			},
			display384: {
				outcome: 'pass' as const,
				observation: 'Subject remains readable at 384 pixels.'
			}
		},
		execution: {
			startedAt: '2026-09-06T00:00:00.000Z',
			finishedAt: '2026-09-06T00:00:01.000Z',
			durationMs: 1000,
			phases: [
				{
					name: 'source-read' as const,
					startedAt: '2026-09-06T00:00:00.000Z',
					finishedAt: '2026-09-06T00:00:00.100Z',
					durationMs: 100
				},
				{
					name: 'normalization' as const,
					startedAt: '2026-09-06T00:00:00.100Z',
					finishedAt: '2026-09-06T00:00:00.700Z',
					durationMs: 600
				},
				{
					name: 'publication' as const,
					startedAt: '2026-09-06T00:00:00.700Z',
					finishedAt: '2026-09-06T00:00:01.000Z',
					durationMs: 300
				}
			],
			generation: { attemptCount: 0, callIdentifiers: [] },
			normalizationTransactionCount: 1,
			invocation: {
				tool: 'tools/persist-skill-icon-cleanup-v2-output.ts',
				command: 'persist:skill-icon-cleanup-v2-output',
				nodeVersion: 'v24.0.0',
				sharpVersion: '0.35.3',
				vipsVersion: '8.18.3'
			}
		},
		transactionContentHash: hash,
		resultPath: packet.output.resultPath,
		writtenOutputPaths: Object.values(packet.output),
		completionContract: {
			sharedFilesRemainUntouched: true as const,
			selfPromotionForbidden: true as const
		}
	};
}

function validPacketAtRevision(revision: number) {
	const packet = validPacket();
	const version = `v${revision}`;
	const predecessorVersion = `v${revision - 1}`;
	return {
		...packet,
		schemaVersion: `skill-icon-quality-cleanup-revision-packet-${version}`,
		revision,
		predecessor: {
			...packet.predecessor,
			packet: binding(
				`${root}/prompts/revisions-${predecessorVersion}/${slug}-${predecessorVersion}.json`
			),
			result: binding(`${root}/results/revisions/${slug}-${predecessorVersion}.json`),
			providerSource: binding(`${root}/provider-sources/${slug}-${predecessorVersion}.png`),
			revisedInterior: binding(`${root}/revisions/${slug}-${predecessorVersion}.png`),
			composite: binding(`${root}/composites/${slug}-${predecessorVersion}.png`)
		},
		output: {
			providerSourcePath: `${root}/provider-sources/${slug}-${version}.png`,
			revisedInteriorPath: `${root}/revisions/${slug}-${version}.png`,
			compositePath: `${root}/composites/${slug}-${version}.png`,
			resultPath: `${root}/results/revisions/${slug}-${version}.json`
		}
	};
}

describe('skill-icon quality-cleanup v2 contracts', () => {
	it('requires append-only v2 paths and a complete recovery transform', () => {
		expect(SkillIconCleanupRevisionV2PacketSchema.safeParse(validPacket()).success).toBe(true);
		expect(
			SkillIconCleanupRevisionV2PacketSchema.safeParse({
				...validPacket(),
				output: { ...validPacket().output, compositePath: `${root}/composites/${slug}-v1.png` }
			}).success
		).toBe(false);
		expect(
			SkillIconCleanupRevisionV2PacketSchema.safeParse({
				...validPacket(),
				transform: { ...validPacket().transform, placement: { left: 163, top: 192 } }
			}).success
		).toBe(false);
	});

	it('accepts arbitrary integer v2+ revisions only when schema, outputs, and immediate predecessor paths agree', () => {
		const v3 = validPacketAtRevision(3);
		const v17 = validPacketAtRevision(17);
		expect(SkillIconCleanupRevisionV2PacketSchema.safeParse(v3).success).toBe(true);
		expect(SkillIconCleanupRevisionV2PacketSchema.safeParse(v17).success).toBe(true);
		expect(
			SkillIconCleanupRevisionV2PacketSchema.safeParse({
				...v17,
				schemaVersion: 'skill-icon-quality-cleanup-revision-packet-v16'
			}).success
		).toBe(false);
		expect(
			SkillIconCleanupRevisionV2PacketSchema.safeParse({
				...v3,
				predecessor: {
					...v3.predecessor,
					packet: binding(`${root}/prompts/revisions-v1/${slug}-v1.json`)
				}
			}).success
		).toBe(false);
	});

	it('requires a post-core-publication audit with exact revision-bound core paths', () => {
		const audit = {
			schemaVersion: 'skill-icon-quality-cleanup-revision-completion-audit-v1' as const,
			revision: 3,
			targetId,
			revisionPacket: binding(`${root}/prompts/revisions-v3/${slug}-v3.json`),
			result: binding(`${root}/results/revisions/${slug}-v3.json`),
			status: 'candidate' as const,
			corePublication: {
				startedAt: '2026-09-06T00:00:01.000Z',
				completedAt: '2026-09-06T00:00:02.000Z',
				durationMs: 1000,
				artifacts: {
					providerSource: binding(`${root}/provider-sources/${slug}-v3.png`),
					revisedInterior: binding(`${root}/revisions/${slug}-v3.png`),
					composite: binding(`${root}/composites/${slug}-v3.png`),
					result: binding(`${root}/results/revisions/${slug}-v3.json`)
				}
			}
		};
		expect(SkillIconCleanupRevisionCompletionAuditSchema.safeParse(audit).success).toBe(true);
		expect(
			SkillIconCleanupRevisionCompletionAuditSchema.safeParse({
				...audit,
				corePublication: {
					...audit.corePublication,
					artifacts: {
						...audit.corePublication.artifacts,
						composite: binding(`${root}/composites/${slug}-v2.png`)
					}
				}
			}).success
		).toBe(false);
	});

	it('requires truthful deterministic execution accounting and candidate inspection passes', () => {
		expect(SkillIconCleanupRevisionV2ResultSchema.safeParse(validResult()).success).toBe(true);
		expect(
			SkillIconCleanupRevisionV2ResultSchema.safeParse({
				...validResult(),
				execution: {
					...validResult().execution,
					generation: { attemptCount: 1, callIdentifiers: ['invented-v1-call'] }
				}
			}).success
		).toBe(false);
		expect(
			SkillIconCleanupRevisionV2ResultSchema.safeParse({
				...validResult(),
				inspection: {
					...validResult().inspection,
					display384: { outcome: 'fail', observation: 'Clipped at 384 pixels.' }
				}
			}).success
		).toBe(false);
	});
});
