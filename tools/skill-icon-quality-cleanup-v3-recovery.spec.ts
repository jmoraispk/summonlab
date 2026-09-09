import { createHash } from 'node:crypto';
import { copyFile, link, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';

import { SkillIconCleanupRevisionV2PacketSchema } from '../packages/contracts/src/index.js';
import { exportCleanupRevisionV3Packets } from './export-skill-icon-quality-cleanup-v3.js';
import * as revisionProtocol from './skill-icon-quality-cleanup-v2-lib.js';
import { persistCleanupRevisionV2 } from './persist-skill-icon-cleanup-v2-output.js';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const temporaryRoots: string[] = [];

afterAll(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function seedFile(root: string, repositoryPath: string): Promise<void> {
	const source = path.join(workspaceRoot, repositoryPath);
	const destination = path.join(root, repositoryPath);
	await mkdir(path.dirname(destination), { recursive: true });
	await link(source, destination).catch(async (error: NodeJS.ErrnoException) => {
		if (error.code !== 'EXDEV') throw error;
		await copyFile(source, destination);
	});
}

async function seedGenerationPacket() {
	const root = await mkdtemp(path.join(tmpdir(), 'skill-icon-cleanup-v3-generation-'));
	temporaryRoots.push(root);
	const packet = (await revisionProtocol.buildCleanupRevisionV2Packets(workspaceRoot)).find(
		({ packet: candidate }) => candidate.targetId === 'craft:forging:living-metal'
	);
	if (!packet) throw new Error('Expected the Living Metal generation-v2 packet.');
	for (const repositoryPath of [
		packet.packet.predecessor.packet.path,
		packet.packet.predecessor.result.path,
		packet.packet.predecessor.providerSource.path,
		packet.packet.predecessor.revisedInterior.path,
		packet.packet.predecessor.composite.path,
		...Object.values(packet.packet.compositionAuthority).map((binding) => binding.path),
		...packet.packet.references.map((reference) => reference.path)
	]) {
		await seedFile(root, repositoryPath);
	}
	const packetPath = path.join(root, packet.path);
	await mkdir(path.dirname(packetPath), { recursive: true });
	await writeFile(packetPath, revisionProtocol.cleanupRevisionV2JsonBytes(packet.packet));
	const sourceBytes = await readFile(
		path.join(workspaceRoot, packet.packet.predecessor.providerSource.path)
	);
	const sourcePath = path.join(root, 'incoming-native-provider.png');
	await writeFile(sourcePath, sourceBytes);
	return { root, packet, sourceBytes, sourcePath };
}

describe('cleanup semantic-revision v3 recovery', () => {
	it('declares one audited Taming generation-v3 packet whose terminal receipt completes selection', async () => {
		const builder = (
			revisionProtocol as unknown as {
				readonly buildCleanupGenerationRevisionV3Packets?: (root: string) => Promise<
					readonly {
						readonly path: string;
						readonly packet: {
							readonly targetId: string;
							readonly revision: number;
							readonly sourceMode: string;
							readonly generationTool?: string;
							readonly reviewRequirements?: {
								readonly fullSize: { readonly width: number; readonly height: number };
								readonly display: { readonly width: number; readonly height: number };
								readonly candidateRequiresBothPass: boolean;
							};
							readonly predecessor: {
								readonly completionAudit?: {
									readonly path: string;
									readonly contentHash: string;
								};
							};
						};
					}[]
				>;
			}
		).buildCleanupGenerationRevisionV3Packets;
		expect(builder).toBeTypeOf('function');
		const packets = await builder!(workspaceRoot);
		expect(packets).toHaveLength(1);
		expect(packets[0]).toMatchObject({
			path: 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/prompts/revisions-v3/craft-gathering-taming-v3.json',
			packet: {
				targetId: 'craft:gathering:taming',
				revision: 3,
				sourceMode: 'generation-v2',
				generationTool: 'built-in-imagegen',
				reviewRequirements: {
					fullSize: { width: 1024, height: 1024 },
					display: { width: 384, height: 384 },
					candidateRequiresBothPass: true
				},
				predecessor: {
					completionAudit: {
						path: 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/results/completion-audits/craft-gathering-taming-v2.json',
						contentHash: 'c45c6030cf8457362fa3986df1bccced9118d2124ebe0dec03a17deeb21ccf83'
					}
				}
			}
		});
		const withoutAudit = structuredClone(packets[0]!.packet) as {
			predecessor: { completionAudit?: unknown };
		};
		delete withoutAudit.predecessor.completionAudit;
		expect(SkillIconCleanupRevisionV2PacketSchema.safeParse(withoutAudit).success).toBe(false);
		const withoutTool = structuredClone(packets[0]!.packet) as { generationTool?: unknown };
		delete withoutTool.generationTool;
		expect(SkillIconCleanupRevisionV2PacketSchema.safeParse(withoutTool).success).toBe(false);
		const exportReport = await exportCleanupRevisionV3Packets({
			root: workspaceRoot,
			mode: 'check'
		});
		expect(exportReport).toMatchObject({ total: 25, written: [] });
		expect(exportReport.existing).toHaveLength(25);

		const finalization = await revisionProtocol.finalizeCleanupRevisionV2({
			root: workspaceRoot
		});
		expect(finalization.ready).toBe(true);
		expect(finalization.candidateCount).toBe(28);
		expect(finalization.selection.unresolved).toEqual([]);
		expect(finalization.pendingGenerationTargetIds).toEqual([]);
	}, 180_000);

	it('records literal 1024px review cells and a separately versioned 384px caption correction', async () => {
		const reviewRoot = path.join(
			workspaceRoot,
			'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/v3-recovery'
		);
		const report = JSON.parse(
			(await readFile(path.join(reviewRoot, 'deterministic-v3-r2-report.json'))).toString('utf8')
		) as {
			readonly schemaVersion: string;
			readonly supersedes: { readonly display384Path: string };
			readonly inspected: number;
			readonly cellEvidence: {
				readonly cellSize: number;
				readonly pageSize: number;
				readonly cellsPerPage: number;
				readonly pages: readonly { readonly path: string }[];
			};
			readonly display384: { readonly path: string };
			readonly legacyV2Evidence: { readonly actualCellSize: number };
		};
		expect(report).toMatchObject({
			schemaVersion: 'skill-icon-quality-cleanup-v3-recovery-inspection-v2',
			inspected: 24,
			cellEvidence: { cellSize: 1024, pageSize: 2048, cellsPerPage: 4 },
			legacyV2Evidence: { actualCellSize: 512 }
		});
		expect(report.cellEvidence.pages).toHaveLength(6);
		expect(report.display384.path).toMatch(/display-384-v3-r2\.png$/u);
		expect(report.supersedes.display384Path).toMatch(/display-384-v3\.png$/u);
		for (const page of report.cellEvidence.pages) {
			const metadata = await sharp(path.join(workspaceRoot, page.path)).metadata();
			expect(metadata).toMatchObject({ width: 2048, height: 2048 });
		}
		const displayMetadata = await sharp(
			path.join(workspaceRoot, report.display384.path)
		).metadata();
		expect(displayMetadata).toMatchObject({ width: 1536, height: 2644 });
	});

	it('derives exactly the 24 deterministic revision-three packets from authenticated v2 candidates', async () => {
		const builder = (
			revisionProtocol as unknown as {
				readonly buildCleanupRevisionV3Packets?: (
					root: string
				) => Promise<
					readonly { readonly path: string; readonly packet: Record<string, unknown> }[]
				>;
			}
		).buildCleanupRevisionV3Packets;
		expect(builder).toBeTypeOf('function');
		const packets = await builder!(workspaceRoot);
		expect(packets).toHaveLength(24);
		expect(packets.map(({ path: packetPath }) => packetPath)).toEqual(
			[...packets.map(({ path: packetPath }) => packetPath)].sort((left, right) =>
				left.localeCompare(right)
			)
		);
		for (const { path: packetPath, packet } of packets) {
			expect(packet.revision).toBe(3);
			expect(packetPath).toMatch(/\/prompts\/revisions-v3\/.+-v3\.json$/u);
			expect(packet.sourceMode).not.toBe('generation-v2');
		}
	}, 30_000);

	it('accepts a revision-three packet chained to the exact prior revision paths', async () => {
		const v2 = (await revisionProtocol.buildCleanupRevisionV2Packets(workspaceRoot)).find(
			({ packet }) => packet.targetId === 'martial:blade:blade-dance'
		);
		if (!v2) throw new Error('Expected Blade Dance v2 packet.');
		const resultBytes = await readFile(path.join(workspaceRoot, v2.packet.output.resultPath));
		const result = JSON.parse(resultBytes.toString('utf8')) as {
			readonly transactionContentHash: string;
			readonly providerSource: { readonly path: string; readonly contentHash: string };
			readonly revisedInterior: { readonly path: string; readonly contentHash: string };
			readonly composite: { readonly path: string; readonly contentHash: string };
		};
		const slug = v2.packet.targetId.replaceAll(':', '-');
		const packet = {
			...v2.packet,
			schemaVersion: 'skill-icon-quality-cleanup-revision-packet-v3',
			revision: 3,
			predecessor: {
				packet: {
					path: v2.path,
					contentHash: sha256(await readFile(path.join(workspaceRoot, v2.path)))
				},
				result: { path: v2.packet.output.resultPath, contentHash: sha256(resultBytes) },
				providerSource: {
					path: result.providerSource.path,
					contentHash: result.providerSource.contentHash
				},
				transactionContentHash: result.transactionContentHash,
				revisedInterior: {
					path: result.revisedInterior.path,
					contentHash: result.revisedInterior.contentHash
				},
				composite: {
					path: result.composite.path,
					contentHash: result.composite.contentHash
				}
			},
			output: {
				providerSourcePath: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/provider-sources/${slug}-v3.png`,
				revisedInteriorPath: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/revisions/${slug}-v3.png`,
				compositePath: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/composites/${slug}-v3.png`,
				resultPath: `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/results/revisions/${slug}-v3.json`
			}
		};

		expect(SkillIconCleanupRevisionV2PacketSchema.safeParse(packet).success).toBe(true);
	});

	it('rejects a same-rank cross-target identity transform before finalizer authentication', async () => {
		const packets = await revisionProtocol.buildCleanupRevisionV3Packets(workspaceRoot);
		const identity = packets.find(
			({ packet }) => packet.targetId === 'magical:elemental:still-depths'
		);
		if (
			!identity ||
			identity.packet.sourceMode !== 'identity-adoption' ||
			identity.packet.transform.kind !== 'identity-adoption-v2' ||
			!('revisedInterior' in identity.packet.transform) ||
			!('composite' in identity.packet.transform)
		) {
			throw new Error('Expected Still Depths to use V3 identity adoption.');
		}
		const foreign = packets.find(
			({ packet }) =>
				packet.targetId !== identity.packet.targetId && packet.rank === identity.packet.rank
		);
		if (!foreign) throw new Error('Expected a same-rank foreign V3 packet.');
		const substituted = {
			...identity.packet,
			transform: {
				...identity.packet.transform,
				revisedInterior: foreign.packet.predecessor.revisedInterior,
				composite: foreign.packet.predecessor.composite
			}
		};
		const root = await mkdtemp(path.join(tmpdir(), 'skill-icon-cleanup-v3-finalizer-reject-'));
		temporaryRoots.push(root);
		const packetPath = path.join(root, identity.path);
		await mkdir(path.dirname(packetPath), { recursive: true });
		await writeFile(packetPath, revisionProtocol.cleanupRevisionV2JsonBytes(substituted));

		await expect(
			revisionProtocol.authenticateCleanupRevisionReceipt({ root, packetPath: identity.path })
		).rejects.toThrow();
	});

	it('requires a result for a declared higher revision rather than falling back to an older candidate', () => {
		const selector = revisionProtocol.selectHighestCleanupRevisionCandidates as unknown as (input: {
			readonly requiredTargetIds: readonly string[];
			readonly declaredRevisions: readonly {
				readonly targetId: string;
				readonly revision: number;
			}[];
			readonly receipts: readonly {
				readonly targetId: string;
				readonly revision: number;
				readonly status: 'candidate' | 'revise' | 'failed';
				readonly compositePath: string | null;
			}[];
		}) => unknown;

		expect(
			selector({
				requiredTargetIds: ['martial:blade:blade-dance'],
				declaredRevisions: [{ targetId: 'martial:blade:blade-dance', revision: 3 }],
				receipts: [
					{
						targetId: 'martial:blade:blade-dance',
						revision: 2,
						status: 'candidate',
						compositePath: 'blade-dance-v2.png'
					}
				]
			})
		).toEqual({
			selected: [],
			unresolved: [{ targetId: 'martial:blade:blade-dance', revision: 3, status: 'missing' }]
		});
	});

	it('persists a native generation-v2 provider with call hashes and never invents source provenance', async () => {
		const fixture = await seedGenerationPacket();
		const metadata = await sharp(fixture.sourceBytes).metadata();
		expect(metadata).toMatchObject({
			format: 'png',
			width: 1254,
			height: 1254,
			channels: 3,
			hasAlpha: false
		});
		const sourceHash = sha256(fixture.sourceBytes);

		await expect(
			persistCleanupRevisionV2({
				root: fixture.root,
				packetPath: fixture.packet.path,
				fullSizeOutcome: 'pass',
				fullSizeObservation:
					'The complete liquid-metal subject remains safely inside the aperture.',
				display384Outcome: 'pass',
				display384Observation: 'The forged metal subject remains readable at 384 pixels.',
				...({
					sourcePath: fixture.sourcePath,
					sourceHash,
					attemptCount: 1,
					generationCallIdentifiers: ['native-call-living-metal-01'],
					generationCallContentHashes: [sourceHash]
				} as object)
			} as never)
		).resolves.toMatchObject({
			targetId: 'craft:forging:living-metal',
			status: 'candidate',
			providerSource: { contentHash: sourceHash },
			execution: {
				generation: {
					attemptCount: 1,
					callIdentifiers: ['native-call-living-metal-01'],
					callContentHashes: [sourceHash]
				}
			}
		});
	}, 30_000);
});
