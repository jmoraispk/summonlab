import path from 'node:path';
import { readFile } from 'node:fs/promises';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
	buildCleanupRevisionV2Packets,
	deriveCleanupRevisionV2,
	finalizeCleanupRevisionV2,
	selectHighestCleanupRevisionCandidates
} from './skill-icon-quality-cleanup-v2-lib.js';
import { exportCleanupRevisionV2Packets } from './export-skill-icon-quality-cleanup-v2.js';
import { prepareSkillIconProviderSourceV3 } from './normalize-skill-icon-provider-source.js';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

describe('cleanup semantic-revision v2 authority', () => {
	it('derives the exact append-only recovery inventory from authenticated v1 evidence', async () => {
		const packets = await buildCleanupRevisionV2Packets(workspaceRoot);

		expect(packets).toHaveLength(28);
		expect(
			packets
				.filter(({ packet }) => packet.sourceMode === 'deterministic-inset')
				.map(({ packet }) => packet.targetId)
		).toHaveLength(21);
		expect(
			packets
				.filter(({ packet }) => packet.sourceMode === 'identity-adoption')
				.map(({ packet }) => packet.targetId)
		).toEqual([
			'magical:elemental:still-depths',
			'magical:elemental:warmth',
			'martial:polearm:red-harvest'
		]);
		expect(
			packets
				.filter(({ packet }) => packet.sourceMode === 'generation-v2')
				.map(({ packet }) => packet.targetId)
		).toEqual([
			'craft:forging:living-metal',
			'craft:forging:ore-sense',
			'craft:gathering:taming',
			'martial:polearm:rend-armor'
		]);
		for (const { path: packetPath, packet } of packets) {
			const slug = packet.targetId.replaceAll(':', '-');
			expect(packetPath).toBe(
				`assets/wiki/skills/icon-production-v1/quality-cleanup-v1/prompts/revisions-v2/${slug}-v2.json`
			);
			expect(packet.revision).toBe(2);
			expect(packet.predecessor.packet.path).toBe(
				`assets/wiki/skills/icon-production-v1/quality-cleanup-v1/prompts/revisions/${slug}-v1.json`
			);
			expect(packet.predecessor.result.path).toBe(
				`assets/wiki/skills/icon-production-v1/quality-cleanup-v1/results/revisions/${slug}-v1.json`
			);
			expect(packet.output.compositePath).toBe(
				`assets/wiki/skills/icon-production-v1/quality-cleanup-v1/composites/${slug}-v2.png`
			);
		}
	}, 30_000);

	it('checks the materialized v2 packet inventory without rewriting any packet', async () => {
		const report = await exportCleanupRevisionV2Packets({ root: workspaceRoot, mode: 'check' });
		expect(report.total).toBe(28);
		expect(report.written).toEqual([]);
		expect(report.existing).toHaveLength(28);
	});

	it('does not fall back to a v1 candidate after a higher v2 receipt is revise or failed', () => {
		const result = selectHighestCleanupRevisionCandidates({
			requiredTargetIds: ['craft:gathering:taming', 'martial:polearm:rend-armor'],
			receipts: [
				{
					targetId: 'craft:gathering:taming',
					revision: 1,
					status: 'candidate',
					compositePath: 'v1-taming.png'
				},
				{
					targetId: 'craft:gathering:taming',
					revision: 2,
					status: 'revise',
					compositePath: 'v2-taming.png'
				},
				{
					targetId: 'martial:polearm:rend-armor',
					revision: 1,
					status: 'candidate',
					compositePath: 'v1-rend.png'
				},
				{
					targetId: 'martial:polearm:rend-armor',
					revision: 2,
					status: 'failed',
					compositePath: null
				}
			]
		});

		expect(result.selected).toEqual([]);
		expect(result.unresolved).toEqual([
			{ targetId: 'craft:gathering:taming', revision: 2, status: 'revise' },
			{ targetId: 'martial:polearm:rend-armor', revision: 2, status: 'failed' }
		]);
	});

	it('leaves a target unresolved when its required highest v2 receipt is absent', () => {
		const result = selectHighestCleanupRevisionCandidates({
			requiredTargetIds: ['craft:gathering:taming'],
			receipts: []
		});
		expect(result.selected).toEqual([]);
		expect(result.unresolved).toEqual([
			{ targetId: 'craft:gathering:taming', revision: 0, status: 'missing' }
		]);
	});

	it('uses the exact 87/128 inset transform before applying the existing aperture mask', async () => {
		const packets = await buildCleanupRevisionV2Packets(workspaceRoot);
		const packet = packets.find(
			({ packet: candidate }) => candidate.targetId === 'martial:blade:blade-dance'
		)?.packet;
		if (!packet || packet.transform.kind !== 'inset-87-of-128-v1') {
			throw new Error('Expected Blade Dance to use the deterministic inset recovery.');
		}

		const derived = await deriveCleanupRevisionV2({ root: workspaceRoot, packet });
		const provider = prepareSkillIconProviderSourceV3(
			await readFile(path.join(workspaceRoot, packet.predecessor.providerSource.path))
		);
		const independentlyResized = await sharp(provider.decoderInput)
			.toColorspace('srgb')
			.removeAlpha()
			.resize(696, 696, { fit: 'fill', kernel: sharp.kernel.lanczos3, fastShrinkOnLoad: false })
			.ensureAlpha()
			.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
			.toBuffer();
		const independentlyPlaced = await sharp({
			create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
		})
			.composite([{ input: independentlyResized, left: 164, top: 192 }])
			.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
			.toBuffer();

		expect(derived.normalizedCanvas).toEqual(independentlyPlaced);
		expect((await sharp(derived.composite).metadata()).width).toBe(1024);
		expect((await sharp(derived.display384).metadata()).width).toBe(384);
	}, 30_000);

	it('copies the three reviewer-passed compositions byte-for-byte through identity adoption', async () => {
		const packets = await buildCleanupRevisionV2Packets(workspaceRoot);
		const packet = packets.find(
			({ packet: candidate }) => candidate.targetId === 'magical:elemental:still-depths'
		)?.packet;
		if (!packet || packet.transform.kind !== 'identity-adoption-v1') {
			throw new Error('Expected Still Depths to use identity adoption.');
		}

		const derived = await deriveCleanupRevisionV2({ root: workspaceRoot, packet });
		expect(derived.revisedInterior).toEqual(
			await readFile(path.join(workspaceRoot, packet.transform.revisedInterior.path))
		);
		expect(derived.composite).toEqual(
			await readFile(path.join(workspaceRoot, packet.transform.composite.path))
		);
	}, 30_000);

	it('rejects a same-rank cross-target substitution in an identity-adoption derivation', async () => {
		const packets = await buildCleanupRevisionV2Packets(workspaceRoot);
		const identity = packets.find(
			({ packet }) => packet.targetId === 'magical:elemental:still-depths'
		)?.packet;
		if (!identity || identity.transform.kind !== 'identity-adoption-v1') {
			throw new Error('Expected Still Depths to use identity adoption.');
		}
		const sameRankForeign = packets.find(
			({ packet }) => packet.targetId !== identity.targetId && packet.rank === identity.rank
		)?.packet;
		if (!sameRankForeign) throw new Error('Expected a same-rank foreign predecessor.');
		const substituted = {
			...identity,
			transform: {
				...identity.transform,
				revisedInterior: sameRankForeign.predecessor.revisedInterior,
				composite: sameRankForeign.predecessor.composite
			}
		};

		await expect(
			deriveCleanupRevisionV2({ root: workspaceRoot, packet: substituted })
		).rejects.toThrow();
	}, 30_000);

	it('selects all audited candidates after the Taming v3 terminal receipt is published', async () => {
		const finalization = await finalizeCleanupRevisionV2({ root: workspaceRoot });
		expect(finalization.ready).toBe(true);
		expect(finalization.candidateCount).toBe(28);
		expect(finalization.receipts).toHaveLength(29);
		expect(
			finalization.receipts.filter(
				(receipt) => receipt.revision === 3 && receipt.status === 'candidate'
			)
		).toHaveLength(25);
		expect(
			finalization.receipts
				.filter((receipt) => receipt.revision === 2)
				.map(({ targetId, status }) => ({ targetId, status }))
		).toEqual([
			{ targetId: 'craft:forging:living-metal', status: 'candidate' },
			{ targetId: 'craft:forging:ore-sense', status: 'candidate' },
			{ targetId: 'craft:gathering:taming', status: 'revise' },
			{ targetId: 'martial:polearm:rend-armor', status: 'candidate' }
		]);
		expect(finalization.selection.selected).toHaveLength(28);
		expect(
			finalization.selection.selected.filter((receipt) => receipt.revision === 3)
		).toHaveLength(25);
		expect(
			finalization.selection.selected
				.filter((receipt) => receipt.revision === 2)
				.map(({ targetId, status }) => ({ targetId, status }))
		).toEqual([
			{ targetId: 'craft:forging:living-metal', status: 'candidate' },
			{ targetId: 'craft:forging:ore-sense', status: 'candidate' },
			{ targetId: 'martial:polearm:rend-armor', status: 'candidate' }
		]);
		expect(finalization.selection.unresolved).toEqual([]);
		expect(finalization.pendingGenerationTargetIds).toEqual([]);
	}, 120_000);
});
