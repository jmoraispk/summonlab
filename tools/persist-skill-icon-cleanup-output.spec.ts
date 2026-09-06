import { createHash, randomUUID } from 'node:crypto';
import {
	copyFile,
	link,
	lstat,
	mkdtemp,
	mkdir,
	readFile,
	rename,
	rm,
	symlink,
	unlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';

import { loadCleanupRevisionPackets } from './skill-icon-quality-cleanup-lib.js';
import {
	parsePersistCleanupRevisionCliRequest,
	persistCleanupRevision,
	type PersistCleanupRevisionTestHooks
} from './persist-skill-icon-cleanup-output.js';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const temporaryRoots: string[] = [];
afterAll(async () =>
	Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })))
);

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

async function seedFile(root: string, repositoryPath: string, mutable = false): Promise<void> {
	const source = path.join(workspaceRoot, repositoryPath);
	const destination = path.join(root, repositoryPath);
	await mkdir(path.dirname(destination), { recursive: true });
	if (mutable) {
		await copyFile(source, destination);
		return;
	}
	await link(source, destination).catch(async (error: NodeJS.ErrnoException) => {
		if (error.code !== 'EXDEV') throw error;
		await copyFile(source, destination);
	});
}

async function replaceBytes(filePath: string, bytes: Buffer): Promise<void> {
	const replacement = `${filePath}.replacement-${randomUUID()}`;
	await writeFile(replacement, bytes);
	await rename(replacement, filePath);
}

async function seedRevisionWorkspace() {
	const root = await mkdtemp(path.join(tmpdir(), 'skill-icon-cleanup-revision-'));
	temporaryRoots.push(root);
	const packets = await loadCleanupRevisionPackets(workspaceRoot);
	const packetArtifact = packets[0]!;
	const cleanupManifestPath =
		'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/manifest.json';
	const cleanupManifest = JSON.parse(
		await readFile(path.join(workspaceRoot, cleanupManifestPath), 'utf8')
	) as {
		readonly authority: Readonly<Record<string, { readonly path: string }>>;
		readonly records: readonly {
			readonly targetId: string;
			readonly sourceCandidate: { readonly path: string };
		}[];
	};
	const massManifestPath = 'assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json';
	const massManifest = JSON.parse(
		await readFile(path.join(workspaceRoot, massManifestPath), 'utf8')
	) as {
		readonly skills: readonly { readonly targetId: string; readonly resultPath: string }[];
	};
	const files = new Set<string>([
		cleanupManifestPath,
		'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/findings.source.json',
		...Object.values(cleanupManifest.authority).map(({ path: authorityPath }) => authorityPath),
		...cleanupManifest.records.map(({ sourceCandidate }) => sourceCandidate.path)
	]);
	for (const { packet } of packets) {
		files.add(packet.currentCandidate.path);
		files.add(packet.currentResult.path);
		for (const binding of Object.values(packet.compositionAuthority)) files.add(binding.path);
		for (const reference of packet.references) files.add(reference.path);
		const skill = massManifest.skills.find(({ targetId }) => targetId === packet.targetId);
		if (!skill) throw new Error(`Missing mass result fixture for ${packet.targetId}`);
		files.add(skill.resultPath);
	}
	for (const repositoryPath of files) {
		await seedFile(root, repositoryPath, repositoryPath === cleanupManifestPath);
	}
	const packetPath = path.join(root, packetArtifact.path);
	await mkdir(path.dirname(packetPath), { recursive: true });
	const packetBytes = jsonBytes(packetArtifact.packet);
	await writeFile(packetPath, packetBytes);
	const sourcePath = path.join(root, 'incoming-provider.png');
	const sourceBytes = await readFile(
		path.join(workspaceRoot, packetArtifact.packet.references[3]!.path)
	);
	await writeFile(sourcePath, sourceBytes);
	const input = {
		root,
		packetPath: packetArtifact.path,
		sourcePath,
		sourceHash: sha256(sourceBytes),
		attemptCount: 1 as const,
		fullSizeOutcome: 'pass' as const,
		fullSizeObservation: 'Full-size subject and named-glyph review passed.',
		display384Outcome: 'pass' as const,
		display384Observation: '384-pixel interface review passed.'
	};
	return {
		root,
		packetArtifact,
		packetPath,
		packetBytes,
		sourcePath,
		sourceBytes,
		input,
		cleanupManifestPath: path.join(root, cleanupManifestPath)
	};
}

async function expectNoRevisionOutputs(
	root: string,
	packet: Awaited<ReturnType<typeof loadCleanupRevisionPackets>>[number]['packet']
): Promise<void> {
	for (const repositoryPath of Object.values(packet.output)) {
		await expect(lstat(path.join(root, repositoryPath))).rejects.toMatchObject({ code: 'ENOENT' });
	}
}

const revisionTargetIds = [
	'martial:blade:blade-dance',
	'martial:blade:hamstring',
	'martial:blade:assassin-s-certainty',
	'martial:blade:severed-thread',
	'martial:blade:hewing-blow',
	'martial:polearm:rend-armour',
	'martial:polearm:berserk-swing',
	'martial:polearm:reaping-arc',
	'martial:polearm:red-harvest',
	'martial:ranged:heartseeker',
	'martial:body:low-kick',
	'martial:body:joint-lock',
	'magical:elemental:warmth',
	'magical:elemental:ashfall',
	'magical:elemental:still-depths',
	'magical:restoration:soothe',
	'magical:enchantment:sustained-weave',
	'craft:forging:ore-sense',
	'craft:forging:weaponsmithing',
	'craft:forging:fuel-craft',
	'craft:forging:tempering',
	'craft:forging:living-metal',
	'craft:cooking:cooking',
	'craft:cooking:preserving',
	'craft:cooking:restorative-broth',
	'craft:cooking:comfort',
	'craft:gathering:taming',
	'craft:gathering:the-earth-provides'
] as const;

describe('cleanup semantic-revision persistence', () => {
	it('builds exactly 28 collision-safe packets from confirmed stray-glyph findings', async () => {
		const packets = await loadCleanupRevisionPackets(workspaceRoot);

		expect(packets.map(({ packet }) => packet.targetId)).toEqual(revisionTargetIds);
		expect(packets).toHaveLength(28);
		const allOutputPaths = packets.flatMap(({ packet }) => Object.values(packet.output));
		expect(new Set(allOutputPaths).size).toBe(28 * 4);
		expect(new Set(packets.map(({ path: packetPath }) => packetPath)).size).toBe(28);

		const bladeDance = packets[0];
		expect(bladeDance).toEqual({
			path: 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/prompts/revisions/martial-blade-blade-dance-v1.json',
			packet: expect.objectContaining({
				schemaVersion: 'skill-icon-quality-cleanup-revision-packet-v1',
				revision: 1,
				targetId: 'martial:blade:blade-dance',
				name: 'Blade Dance',
				rank: 'D',
				motifFamily: 'blade.sword-dance',
				finding: {
					targetId: 'martial:blade:blade-dance',
					kind: 'stray-ui-glyph',
					detail: 'Up/down arrows.',
					requiredAction: 'revise-art'
				},
				cleanupManifest: {
					path: 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/manifest.json',
					contentHash: 'f7f4690d71b0786283c867f46ac5e48c9f48cd19fac9d969396f94a5f986b12b'
				},
				sourceCandidate: {
					path: 'assets/wiki/skills/icon-production-v1/mass-production-v1/icons/martial-blade-blade-dance.png',
					contentHash: '67b7f8ef9bce59a6e748f87119cd17b68062fcc4fb04b11c962b842704871455'
				},
				currentCandidate: {
					path: 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/composites/martial-blade-blade-dance.png',
					contentHash: 'b6792e8e7216f27a186a02455b9e9a8f5000c34f50999564bb66c0810e1711ab'
				},
				compositionAuthority: {
					geometry: {
						path: 'assets/wiki/skills/icon-production-v1/geometry-v2.json',
						contentHash: '6ffaaa99a2e19c7589bcb2f7975268117db199abd45752fd164567cb5042fcab'
					},
					backing: {
						path: 'assets/wiki/skills/icon-production-v1/candidates/references/charcoal-forged-stone-v6.png',
						contentHash: 'b78d55c4121770720714c40d24912b7e36a7b6f2e09af212cc972baa23839f15'
					},
					frame: {
						path: 'assets/wiki/skills/icon-production-v1/candidates/references/rarity-frame-d-v9.png',
						contentHash: 'c2953df1ce91291b47a5479ef9014c209d20aa1e8c3560032ced5f73b7a55f22'
					}
				},
				providerEnvelope: {
					profile: 'skill-icon-provider-envelope-v3',
					mediaType: 'image/png',
					width: 1254,
					height: 1254,
					alphaMode: 'rgb'
				},
				normalizationAuthority: {
					profile: 'skill-icon-cleanup-artwork-resize-mask-v1',
					decoderInput: 'remove-bounded-cabx-and-assign-srgb',
					resize: {
						width: 1024,
						height: 1024,
						fit: 'fill',
						kernel: 'lanczos3',
						fastShrinkOnLoad: false
					},
					mask: 'geometry-v2-protected-central-aperture',
					encoder: {
						format: 'png',
						compressionLevel: 9,
						adaptiveFiltering: false,
						palette: false,
						progressive: false
					},
					sharpVersion: '0.35.3',
					vipsVersion: '8.18.3'
				},
				attempts: { initial: 1, correctiveEdits: 1, maximum: 2 },
				output: {
					providerSourcePath:
						'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/provider-sources/martial-blade-blade-dance-v1.png',
					revisedInteriorPath:
						'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/revisions/martial-blade-blade-dance-v1.png',
					compositePath:
						'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/composites/martial-blade-blade-dance-v1.png',
					resultPath:
						'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/results/revisions/martial-blade-blade-dance-v1.json'
				}
			})
		});
		expect(bladeDance!.packet.references).toEqual([
			{
				path: 'assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png',
				purpose: 'Painted Emblem style authority only; never copy its pixels or rank frame.',
				contentHash: '66af9144bc4cb5d8bb1420c5a07cfe9652c7ccbccf17519da938b21298b929ce'
			},
			{
				path: 'assets/wiki/skills/icon-production-v1/references/geometry-guide-v2.png',
				purpose:
					'Protected central-aperture geometry only; never render guide colors or construction marks.',
				contentHash: '8f1c01435f3e32de07560b154d9e3becba3ca2a38773ca74c3115d66ba28094e'
			},
			{
				path: 'assets/wiki/skills/icon-production-v1/mass-production-v1/reference-sheets/blade-sword-dance.png',
				purpose:
					'Exact blade.sword-dance motif-family ancestry only; never crop or copy a complete icon.',
				contentHash: 'b70fd93aaf86a64c338b005c8e0dc44dade8a90704d92e4016406413d7c3034f'
			},
			{
				path: 'assets/wiki/skills/icon-production-v1/mass-production-v1/provider-sources/martial-blade-blade-dance-v1.png',
				purpose:
					'Original provider source for target identity, subject, palette, lighting, and action continuity only.',
				contentHash: '41a69e5f34b0a3b66c10c3cc7588e0484acc3ecd0d363345fa73da33575d0079'
			},
			{
				path: 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/composites/martial-blade-blade-dance.png',
				purpose:
					'Current deterministic cleanup candidate for target-specific composition continuity only; never reproduce its backing, frame, crest, or rank letter.',
				contentHash: 'b6792e8e7216f27a186a02455b9e9a8f5000c34f50999564bb66c0810e1711ab'
			}
		]);
		expect(bladeDance!.packet.exactPrompt).toBe(`Use case: stylized-concept
Asset type: isolated full-resolution Summonlab skill-icon artwork revision
Primary request: Revise only the painted artwork for Blade Dance in the Martial / Blade taxonomy.
Dominant subject: a clearly visible sword actively performing Blade Dance, with the acting tool never replaced by a free-floating effect
Supporting cue: one restrained secondary cue communicating this effect: Attack speed up, mitigation down while held
Palette: tempered steel, charcoal black, restrained warm sparks
Composition: Centered painted emblem with one dominant silhouette, strong negative space, and a readable action direction. Keep all important detail clear of the frame rim and top rank crest.
Existing exclusions: no skill name, mastery, level, caption, logo, watermark, or UI panel; no extra frame letter or rarity symbol beyond the required integrated crest; no narrative scenery or unrelated props; no effect-only abstraction replacing the concrete acting subject from F through A
Unwanted detached explanatory UI glyph: Up/down arrows.
Preserve the dominant subject, action, palette, lighting, and motif-family ancestry. Remove only the detached explanatory UI glyph named in this packet. Add no replacement badge, arrow, gauge, heart, cross, chevron, corner symbol, text, frame, crest, or rarity letter. Keep the complete subject inside the protected central aperture.
Output exactly one 1254×1254 RGB PNG provider source containing only the revised painted artwork. Do not crop, resize, mask, or preprocess the provider source; the authenticated cleanup pipeline retains its exact bytes, applies the packet-authorized deterministic resize and protected-aperture mask, and supplies the canonical backing and D-rank frame.`);
	}, 30_000);

	it('normalizes a native provider envelope while retaining bytes and publishes all outputs together', async () => {
		const fixture = await seedRevisionWorkspace();
		const nativeMetadata = await sharp(fixture.sourceBytes).metadata();
		expect(nativeMetadata).toMatchObject({
			format: 'png',
			width: 1254,
			height: 1254,
			channels: 3,
			hasAlpha: false
		});
		const manifestBefore = await readFile(fixture.cleanupManifestPath);
		const currentCandidateBefore = await readFile(
			path.join(fixture.root, fixture.packetArtifact.packet.currentCandidate.path)
		);
		const currentResultBefore = await readFile(
			path.join(fixture.root, fixture.packetArtifact.packet.currentResult.path)
		);

		const result = await persistCleanupRevision(fixture.input);

		expect(result).toMatchObject({
			schemaVersion: 'skill-icon-quality-cleanup-revision-result-v1',
			status: 'candidate',
			targetId: 'martial:blade:blade-dance',
			attemptCount: 1,
			attemptCeiling: 2,
			providerSource: {
				path: fixture.packetArtifact.packet.output.providerSourcePath,
				contentHash: fixture.input.sourceHash,
				width: 1254,
				height: 1254,
				alphaMode: 'rgb'
			},
			revisedInterior: {
				path: fixture.packetArtifact.packet.output.revisedInteriorPath,
				width: 1024,
				height: 1024
			},
			normalizationAuthority: fixture.packetArtifact.packet.normalizationAuthority,
			normalization: {
				profile: 'skill-icon-cleanup-artwork-resize-mask-v1',
				sourceContentHash: fixture.input.sourceHash,
				colorSpaceDisposition: 'assigned-srgb',
				geometryContentHash: fixture.packetArtifact.packet.compositionAuthority.geometry.contentHash
			},
			composite: { path: fixture.packetArtifact.packet.output.compositePath },
			resultPath: fixture.packetArtifact.packet.output.resultPath,
			writtenOutputPaths: Object.values(fixture.packetArtifact.packet.output),
			completionContract: {
				sharedFilesRemainUntouched: true,
				selfPromotionForbidden: true
			}
		});
		expect(result.normalization.decoderInputContentHash).toMatch(/^[a-f0-9]{64}$/u);
		expect(result.normalization.containerBox).toMatchObject({
			chunkType: 'caBX',
			bytes: expect.any(Number),
			contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u)
		});
		expect(result.normalization.outputContentHash).toBe(result.revisedInterior.contentHash);
		expect(
			await readFile(
				path.join(fixture.root, fixture.packetArtifact.packet.output.providerSourcePath)
			)
		).toEqual(fixture.sourceBytes);
		const persistedResult = await readFile(
			path.join(fixture.root, fixture.packetArtifact.packet.output.resultPath),
			'utf8'
		);
		expect(persistedResult).not.toContain(fixture.sourcePath);
		expect(persistedResult).not.toContain(fixture.root);
		for (const repositoryPath of Object.values(fixture.packetArtifact.packet.output)) {
			const bytes = await readFile(path.join(fixture.root, repositoryPath));
			expect(bytes.byteLength).toBeGreaterThan(0);
		}
		expect(await readFile(fixture.cleanupManifestPath)).toEqual(manifestBefore);
		expect(
			await readFile(path.join(fixture.root, fixture.packetArtifact.packet.currentCandidate.path))
		).toEqual(currentCandidateBefore);
		expect(
			await readFile(path.join(fixture.root, fixture.packetArtifact.packet.currentResult.path))
		).toEqual(currentResultBefore);
	}, 30_000);

	it('rejects forged bindings, path escape, symlinks, collisions, excess attempts, and drift', async () => {
		const fixture = await seedRevisionWorkspace();
		const mutatePacket = async (
			mutate: (packet: Record<string, unknown>) => void
		): Promise<void> => {
			const packet = JSON.parse(fixture.packetBytes.toString('utf8')) as Record<string, unknown>;
			mutate(packet);
			await replaceBytes(fixture.packetPath, jsonBytes(packet));
		};
		const restorePacket = () => replaceBytes(fixture.packetPath, fixture.packetBytes);

		await mutatePacket((packet) => {
			packet.targetId = 'martial:blade:hamstring';
		});
		await expect(persistCleanupRevision(fixture.input)).rejects.toThrow(
			/packet|target|canonical/iu
		);
		await expectNoRevisionOutputs(fixture.root, fixture.packetArtifact.packet);
		await restorePacket();

		for (const key of ['sourceCandidate', 'currentCandidate'] as const) {
			await mutatePacket((packet) => {
				(packet[key] as Record<string, unknown>).contentHash = '0'.repeat(64);
			});
			await expect(persistCleanupRevision(fixture.input)).rejects.toThrow(
				/packet|hash|canonical/iu
			);
			await expectNoRevisionOutputs(fixture.root, fixture.packetArtifact.packet);
			await restorePacket();
		}

		await mutatePacket((packet) => {
			const references = packet.references as Record<string, unknown>[];
			references[2]!.contentHash = '0'.repeat(64);
		});
		await expect(persistCleanupRevision(fixture.input)).rejects.toThrow(/packet|hash|canonical/iu);
		await restorePacket();

		await mutatePacket((packet) => {
			const references = packet.references as Record<string, unknown>[];
			references[2]!.path = 'assets/wiki/skills/unlisted.png';
		});
		await expect(persistCleanupRevision(fixture.input)).rejects.toThrow(
			/packet|reference|canonical/iu
		);
		await restorePacket();

		await mutatePacket((packet) => {
			const output = packet.output as Record<string, unknown>;
			output.compositePath = '../escaped.png';
		});
		await expect(persistCleanupRevision(fixture.input)).rejects.toThrow(/packet|path|invalid/iu);
		await restorePacket();

		for (const repositoryPath of [
			fixture.packetArtifact.packet.sourceCandidate.path,
			fixture.packetArtifact.packet.currentCandidate.path,
			fixture.packetArtifact.packet.references[2]!.path
		]) {
			const absolutePath = path.join(fixture.root, repositoryPath);
			const original = await readFile(absolutePath);
			await replaceBytes(absolutePath, Buffer.from('stale authority bytes'));
			await expect(persistCleanupRevision(fixture.input)).rejects.toThrow(
				/hash drift|hash changed|binding drift|canonical|invalid/iu
			);
			await replaceBytes(absolutePath, original);
			await expectNoRevisionOutputs(fixture.root, fixture.packetArtifact.packet);
		}

		await expect(
			persistCleanupRevision({ ...fixture.input, attemptCount: 3 as 1 })
		).rejects.toThrow(/attempt|ceiling/iu);

		await unlink(fixture.packetPath);
		await symlink(path.join(workspaceRoot, fixture.packetArtifact.path), fixture.packetPath);
		await expect(persistCleanupRevision(fixture.input)).rejects.toThrow(/symbolic|symlink/iu);
		await unlink(fixture.packetPath);
		await writeFile(fixture.packetPath, fixture.packetBytes);

		const existingOutput = path.join(
			fixture.root,
			fixture.packetArtifact.packet.output.compositePath
		);
		await mkdir(path.dirname(existingOutput), { recursive: true });
		await writeFile(existingOutput, Buffer.from('foreign bytes'));
		await expect(persistCleanupRevision(fixture.input)).rejects.toThrow(
			/exists|replace|destination/iu
		);
		expect(await readFile(existingOutput)).toEqual(Buffer.from('foreign bytes'));
		await unlink(existingOutput);
		await expectNoRevisionOutputs(fixture.root, fixture.packetArtifact.packet);

		const sourceReplacement = Buffer.from('source drift');
		await expect(
			persistCleanupRevision({
				...fixture.input,
				testHooks: {
					afterSourceRead: () => replaceBytes(fixture.sourcePath, sourceReplacement)
				}
			})
		).rejects.toThrow(/source.*changed|source.*hash/iu);
		await replaceBytes(fixture.sourcePath, fixture.sourceBytes);
		await expectNoRevisionOutputs(fixture.root, fixture.packetArtifact.packet);
	}, 120_000);

	it('rolls back owned partial publication when immutable authority changes or publication fails', async () => {
		const fixture = await seedRevisionWorkspace();
		const manifestBytes = await readFile(fixture.cleanupManifestPath);
		await expect(
			persistCleanupRevision({
				...fixture.input,
				testHooks: {
					afterStage: () =>
						replaceBytes(fixture.cleanupManifestPath, Buffer.from('worker manifest edit\n'))
				}
			})
		).rejects.toThrow(/manifest|authority|changed/iu);
		await expectNoRevisionOutputs(fixture.root, fixture.packetArtifact.packet);
		await replaceBytes(fixture.cleanupManifestPath, manifestBytes);

		await expect(
			persistCleanupRevision({
				...fixture.input,
				testHooks: {
					afterPublish: (index) => {
						if (index === 1) throw new Error('injected partial publication failure');
					}
				}
			})
		).rejects.toThrow(/injected partial publication failure/iu);
		await expectNoRevisionOutputs(fixture.root, fixture.packetArtifact.packet);
	}, 60_000);

	it('rejects and rolls back when a named output parent is swapped after publication', async () => {
		// Catches validating only held directory descriptors after an afterPublish rename/symlink swap.
		const fixture = await seedRevisionWorkspace();
		const providerPath = path.join(
			fixture.root,
			fixture.packetArtifact.packet.output.providerSourcePath
		);
		const providerParent = path.dirname(providerPath);
		const movedParent = `${providerParent}.moved`;
		const outside = await mkdtemp(path.join(tmpdir(), 'skill-icon-cleanup-persist-escape-'));
		temporaryRoots.push(outside);
		let swapped = false;

		await expect(
			persistCleanupRevision({
				...fixture.input,
				testHooks: {
					afterPublish: async (index) => {
						if (index !== 0) return;
						await rename(providerParent, movedParent);
						await symlink(outside, providerParent);
						swapped = true;
					}
				}
			})
		).rejects.toThrow(/parent|identity|symbolic|changed/iu);
		expect(swapped).toBe(true);
		await expectNoRevisionOutputs(fixture.root, fixture.packetArtifact.packet);
		await expect(lstat(path.join(movedParent, path.basename(providerPath)))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	}, 60_000);

	it('never unlinks a foreign replacement introduced at the legacy rollback race boundary', async () => {
		// Catches validating a canonical pathname and then unlinking whatever inode later occupies it.
		const fixture = await seedRevisionWorkspace();
		const repositoryPath = fixture.packetArtifact.packet.output.providerSourcePath;
		const providerPath = path.join(fixture.root, repositoryPath);
		const foreign = Buffer.from('foreign replacement must survive rollback\n');
		let replacementInstalled = false;
		const testHooks: PersistCleanupRevisionTestHooks = {
			afterPublish: (index: number) => {
				if (index === 0) throw new Error('trigger rollback after provider publication');
			},
			beforeRollbackDetach: async (checkedPath: string) => {
				if (checkedPath !== repositoryPath) return;
				await unlink(providerPath).catch((error: NodeJS.ErrnoException) => {
					if (error.code !== 'ENOENT') throw error;
				});
				await writeFile(providerPath, foreign);
				replacementInstalled = true;
			}
		};

		await expect(persistCleanupRevision({ ...fixture.input, testHooks })).rejects.toThrow(
			/safe rollback was incomplete|refused unowned/iu
		);
		expect(replacementInstalled).toBe(true);
		expect(await readFile(providerPath)).toEqual(foreign);
		for (const otherPath of Object.values(fixture.packetArtifact.packet.output).slice(1)) {
			await expect(lstat(path.join(fixture.root, otherPath))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		}
	}, 60_000);

	it('accepts exactly the packet, source, source hash, attempt count, and two inspection pairs', () => {
		const hash = 'a'.repeat(64);
		const request = parsePersistCleanupRevisionCliRequest([
			'--packet',
			'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/prompts/revisions/martial-blade-blade-dance-v1.json',
			'--source',
			'/tmp/provider.png',
			'--source-hash',
			hash,
			'--attempt-count',
			'2',
			'--full-size-outcome',
			'pass',
			'--full-size-observation',
			'Full-size subject and named-glyph review passed.',
			'--display-384-outcome',
			'pass',
			'--display-384-observation',
			'384-pixel interface review passed.'
		]);

		expect(request).toEqual({
			packetPath:
				'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/prompts/revisions/martial-blade-blade-dance-v1.json',
			sourcePath: '/tmp/provider.png',
			sourceHash: hash,
			attemptCount: 2,
			fullSizeOutcome: 'pass',
			fullSizeObservation: 'Full-size subject and named-glyph review passed.',
			display384Outcome: 'pass',
			display384Observation: '384-pixel interface review passed.'
		});
		expect(() =>
			parsePersistCleanupRevisionCliRequest([
				'--packet',
				request.packetPath,
				'--source',
				request.sourcePath,
				'--source-hash',
				request.sourceHash,
				'--attempt-count',
				'1',
				'--full-size-outcome',
				'pass',
				'--full-size-observation',
				'Passed.',
				'--display-384-outcome',
				'pass',
				'--display-384-observation',
				'Passed.',
				'--target-id',
				'martial:blade:blade-dance'
			])
		).toThrow(/unknown or incomplete argument.*--target-id/iu);
	});
});
