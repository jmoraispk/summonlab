import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import { buildEquipmentVisualProfile } from './equipment-image-profile.js';
import {
	buildEquipmentProfileAcceptance,
	buildRootEquipmentPackets,
	canonicalJsonSha256,
	renderEquipmentPrompt
} from './equipment-image-packets.js';
import {
	buildEquipmentMaterialAllocationPlan,
	buildEquipmentMaterialProductionManifest
} from './equipment-material-production-lib.js';
import {
	persistEquipmentImageResult,
	verifyEquipmentImageResult
} from './equipment-image-result.js';
import { runEquipmentImageProductionCli } from './equipment-image-production.js';

const ROOT = 'assets/equipment/experiments/material-equipment-v1';
const PROFILE_PATH = `${ROOT}/visual-profile/profile.json`;
const ACCEPTANCE_PATH = `${ROOT}/visual-profile/acceptance.json`;
const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

function hash(bytes: string | Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function writeRepositoryFile(
	workspaceRoot: string,
	repositoryPath: string,
	bytes: string | Uint8Array
): Promise<void> {
	const absolute = path.join(workspaceRoot, ...repositoryPath.split('/'));
	await mkdir(path.dirname(absolute), { recursive: true });
	await writeFile(absolute, bytes);
}

function jsonBytes(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

function resultForPacket(
	packet: ReturnType<typeof buildRootEquipmentPackets>[number],
	candidateBytes: Buffer
) {
	const candidateSha256 = hash(candidateBytes);
	return {
		schemaVersion: 'equipment-image-result-v1' as const,
		resultId: `result-${packet.target.targetId}`,
		targetId: packet.target.targetId,
		assignmentId: packet.assignment.assignmentId,
		status: 'candidate' as const,
		promptSha256: hash(renderEquipmentPrompt(packet.target)),
		referenceInputs: packet.target.references.map(({ path: referencePath, contentHash }) => ({
			path: referencePath,
			contentHash
		})),
		attempts: [
			{
				attemptId: `attempt-${packet.target.targetId}`,
				attemptNumber: 1 as const,
				sourceOutputId: `imagegen-output-${packet.target.targetId}`,
				requestStartedAt: '2026-09-01T23:06:00.000Z',
				generationCompletedAt: '2026-09-01T23:07:00.000Z',
				inspectionCompletedAt: '2026-09-01T23:08:00.000Z'
			}
		],
		findings: packet.target.acceptanceCriteria.map(({ criterionId }) => ({
			criterionId,
			outcome: 'pass' as const,
			observation: `Inspected ${criterionId}.`
		})),
		candidate: {
			path: packet.target.output.candidatePath,
			mediaType: 'image/png' as const,
			width: packet.target.presentation.canvas.width,
			height: packet.target.presentation.canvas.height,
			bytes: candidateBytes.byteLength,
			sha256: candidateSha256
		},
		candidateSha256,
		startedAt: '2026-09-01T23:05:59.000Z',
		completedAt: '2026-09-01T23:08:01.000Z',
		writtenOutputPaths: [packet.target.output.candidatePath, packet.target.output.resultPath],
		noSharedFilesEdited: true as const,
		selfPromoted: false as const
	};
}

async function fixture() {
	const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'equipment-image-result-'));
	temporaryDirectories.push(workspaceRoot);
	const referenceBytes = Buffer.from('equipment-style-reference-fixture');
	const profile = {
		...buildEquipmentVisualProfile(),
		references: [
			{
				path: 'fixtures/references/style.png',
				contentHash: hash(referenceBytes),
				purpose: 'Use only for the declared Equipment style purpose.'
			}
		]
	};
	const acceptance = buildEquipmentProfileAcceptance({
		profile,
		profilePath: PROFILE_PATH,
		reviewer: 'owner',
		acceptedAt: '2026-09-01T23:00:00.000Z',
		acknowledgedProfileSha256: canonicalJsonSha256(profile)
	});
	const packet = buildRootEquipmentPackets({
		manifest: buildEquipmentMaterialProductionManifest(),
		allocation: buildEquipmentMaterialAllocationPlan(),
		profile,
		acceptance,
		assignedAt: '2026-09-01T23:05:00.000Z'
	})[0]!;
	const candidateBytes = await sharp({
		create: {
			width: packet.target.presentation.canvas.width,
			height: packet.target.presentation.canvas.height,
			channels: 4,
			background: { r: 44, g: 30, b: 22, alpha: 1 }
		}
	})
		.png()
		.toBuffer();
	const result = resultForPacket(packet, candidateBytes);

	await Promise.all([
		writeRepositoryFile(workspaceRoot, PROFILE_PATH, jsonBytes(profile)),
		writeRepositoryFile(workspaceRoot, ACCEPTANCE_PATH, jsonBytes(acceptance)),
		writeRepositoryFile(workspaceRoot, packet.targetPath, jsonBytes(packet.target)),
		writeRepositoryFile(workspaceRoot, packet.assignmentPath, jsonBytes(packet.assignment)),
		writeRepositoryFile(workspaceRoot, packet.target.references[0]!.path, referenceBytes),
		writeRepositoryFile(workspaceRoot, packet.target.output.candidatePath, candidateBytes)
	]);

	return {
		workspaceRoot,
		targetPath: packet.targetPath,
		assignmentPath: packet.assignmentPath,
		resultPath: packet.target.output.resultPath,
		packet,
		profile,
		acceptance,
		candidateBytes,
		candidateSha256: result.candidateSha256,
		result
	};
}

async function verify(
	input: Omit<Awaited<ReturnType<typeof fixture>>, 'result'> & { readonly result: unknown }
) {
	return verifyEquipmentImageResult({
		workspaceRoot: input.workspaceRoot,
		targetPath: input.targetPath,
		assignmentPath: input.assignmentPath,
		result: input.result
	});
}

describe('Equipment image worker result verification', () => {
	it('accepts a candidate bound to the exact prompt, references, PNG receipt, findings, and ownership', async () => {
		const valid = await fixture();
		await expect(verify(valid)).resolves.toMatchObject({
			status: 'candidate',
			candidateSha256: valid.candidateSha256,
			ownedPaths: [valid.packet.target.output.candidatePath, valid.resultPath]
		});
	});

	it('rejects each mismatched identity and assignment output binding', async () => {
		const valid = await fixture();
		for (const result of [
			{ ...valid.result, targetId: 'material-equipment-v1-copper-dagger-v1' },
			{ ...valid.result, assignmentId: 'assignment-material-equipment-v1-copper-dagger-v1' }
		]) {
			await expect(verify({ ...valid, result })).rejects.toThrow(/ID|identity/iu);
		}

		const wrongAssignment = {
			...valid.packet.assignment,
			permittedOutputs: {
				...valid.packet.assignment.permittedOutputs,
				resultPath: `${ROOT}/results/f/copper/dagger-v1.json`
			}
		};
		await writeRepositoryFile(
			valid.workspaceRoot,
			valid.assignmentPath,
			jsonBytes(wrongAssignment)
		);
		await expect(verify(valid)).rejects.toThrow('outputs');
	});

	it('rejects a prompt digest not re-rendered from the exact target', async () => {
		const valid = await fixture();
		await expect(
			verify({ ...valid, result: { ...valid.result, promptSha256: '0'.repeat(64) } })
		).rejects.toThrow('prompt');
	});

	it('rejects missing, unordered, changed, or byte-mismatched reference provenance', async () => {
		const valid = await fixture();
		const secondReference = {
			path: 'fixtures/references/detail.png',
			contentHash: hash('detail-reference'),
			purpose: 'Use only for detail.'
		};
		const profile = {
			...valid.profile,
			references: [...valid.profile.references, secondReference]
		};
		const acceptance = buildEquipmentProfileAcceptance({
			profile,
			profilePath: PROFILE_PATH,
			reviewer: 'owner',
			acceptedAt: valid.acceptance.acceptedAt,
			acknowledgedProfileSha256: canonicalJsonSha256(profile)
		});
		const packet = buildRootEquipmentPackets({
			manifest: buildEquipmentMaterialProductionManifest(),
			allocation: buildEquipmentMaterialAllocationPlan(),
			profile,
			acceptance,
			assignedAt: valid.packet.assignment.assignedAt
		})[0]!;
		const referenceInputs = packet.target.references.map(
			({ path: referencePath, contentHash }) => ({
				path: referencePath,
				contentHash
			})
		);
		const result = {
			...valid.result,
			promptSha256: hash(renderEquipmentPrompt(packet.target)),
			referenceInputs
		};
		await Promise.all([
			writeRepositoryFile(valid.workspaceRoot, PROFILE_PATH, jsonBytes(profile)),
			writeRepositoryFile(valid.workspaceRoot, ACCEPTANCE_PATH, jsonBytes(acceptance)),
			writeRepositoryFile(valid.workspaceRoot, valid.targetPath, jsonBytes(packet.target)),
			writeRepositoryFile(valid.workspaceRoot, secondReference.path, 'detail-reference')
		]);

		await expect(verify({ ...valid, result })).resolves.toMatchObject({ status: 'candidate' });
		await expect(
			verify({ ...valid, result: { ...result, referenceInputs: referenceInputs.slice(0, 1) } })
		).rejects.toThrow('reference');
		await expect(
			verify({ ...valid, result: { ...result, referenceInputs: [...referenceInputs].reverse() } })
		).rejects.toThrow('reference');
		await expect(
			verify({
				...valid,
				result: {
					...result,
					referenceInputs: [
						{ ...referenceInputs[0]!, contentHash: '0'.repeat(64) },
						...referenceInputs.slice(1)
					]
				}
			})
		).rejects.toThrow('reference');
		await writeRepositoryFile(
			valid.workspaceRoot,
			packet.target.references[0]!.path,
			'changed-reference-bytes'
		);
		await expect(verify({ ...valid, result })).rejects.toThrow('reference');
	});

	it('rejects extra attempts and invalid attempt or result timestamp ordering', async () => {
		const valid = await fixture();
		await expect(
			verify({
				...valid,
				result: { ...valid.result, attempts: [...valid.result.attempts, valid.result.attempts[0]!] }
			})
		).rejects.toThrow(/attempt|length/iu);
		await expect(
			verify({
				...valid,
				result: {
					...valid.result,
					attempts: [
						{
							...valid.result.attempts[0]!,
							generationCompletedAt: '2026-09-01T23:05:59.000Z'
						}
					]
				}
			})
		).rejects.toThrow('timestamp');
		await expect(
			verify({
				...valid,
				result: { ...valid.result, completedAt: '2026-09-01T23:05:59.000Z' }
			})
		).rejects.toThrow('timestamp');
	});

	it('rejects wrong candidate dimensions, byte count, digest, or persistence path', async () => {
		const valid = await fixture();
		for (const candidate of [
			{ ...valid.result.candidate!, width: 1025 },
			{ ...valid.result.candidate!, bytes: valid.candidateBytes.byteLength + 1 },
			{ ...valid.result.candidate!, sha256: '0'.repeat(64) },
			{ ...valid.result.candidate!, path: `${ROOT}/candidates/f/copper/dagger-v1.png` }
		]) {
			await expect(
				verify({
					...valid,
					result: {
						...valid.result,
						candidate,
						candidateSha256: candidate.sha256
					}
				})
			).rejects.toThrow(/candidate|canvas|output|PNG|receipt/iu);
		}
	});

	it('requires exactly one finding per criterion and all required criteria to pass for candidate status', async () => {
		const valid = await fixture();
		await expect(
			verify({
				...valid,
				result: { ...valid.result, findings: [...valid.result.findings].reverse() }
			})
		).resolves.toMatchObject({ status: 'candidate' });
		await expect(
			verify({ ...valid, result: { ...valid.result, findings: valid.result.findings.slice(1) } })
		).rejects.toThrow('finding');
		await expect(
			verify({
				...valid,
				result: {
					...valid.result,
					findings: valid.result.findings.map((finding, index) =>
						index === 0 ? { ...finding, outcome: 'concern' as const } : finding
					)
				}
			})
		).rejects.toThrow(/criterion|pass/iu);
		await expect(
			verify({
				...valid,
				result: {
					...valid.result,
					findings: [...valid.result.findings, valid.result.findings[0]!]
				}
			})
		).rejects.toThrow('finding');
	});

	it('rejects forbidden ownership and self-promotion claims', async () => {
		const valid = await fixture();
		await expect(
			verify({
				...valid,
				result: { ...valid.result, writtenOutputPaths: ['assets/enemies/bad.png'] }
			})
		).rejects.toThrow('ownership');
		await expect(
			verify({ ...valid, result: { ...valid.result, selfPromoted: true } })
		).rejects.toThrow(/selfPromoted|false/iu);
	});

	it('accepts revise evidence with a candidate and failed evidence without one', async () => {
		const valid = await fixture();
		const revise = {
			...valid.result,
			status: 'revise' as const,
			findings: valid.result.findings.map((finding, index) =>
				index === 0 ? { ...finding, outcome: 'concern' as const } : finding
			)
		};
		await expect(verify({ ...valid, result: revise })).resolves.toMatchObject({
			status: 'revise',
			candidateSha256: valid.candidateSha256
		});

		const failed = {
			...valid.result,
			status: 'failed' as const,
			candidate: null,
			candidateSha256: null,
			attempts: [{ ...valid.result.attempts[0]!, sourceOutputId: null }],
			findings: valid.result.findings.map((finding) => ({
				...finding,
				outcome: 'not-applicable' as const,
				observation: 'Generation failed before this criterion could be inspected.'
			})),
			writtenOutputPaths: [valid.resultPath]
		};
		await rm(
			path.join(valid.workspaceRoot, ...valid.packet.target.output.candidatePath.split('/'))
		);
		await expect(verify({ ...valid, result: failed })).resolves.toMatchObject({
			status: 'failed',
			candidateSha256: null,
			ownedPaths: [valid.resultPath]
		});
	});

	it('refuses a symbolic link at every repository-file read boundary', async () => {
		for (const role of [
			'profile',
			'acceptance',
			'target',
			'assignment',
			'reference',
			'candidate'
		] as const) {
			const valid = await fixture();
			const paths = {
				profile: PROFILE_PATH,
				acceptance: ACCEPTANCE_PATH,
				target: valid.targetPath,
				assignment: valid.assignmentPath,
				reference: valid.packet.target.references[0]!.path,
				candidate: valid.packet.target.output.candidatePath
			};
			const absolute = path.join(valid.workspaceRoot, ...paths[role].split('/'));
			const real = `${absolute}.real`;
			await writeFile(real, await readFile(absolute));
			await rm(absolute);
			await symlink(real, absolute);
			await expect(verify(valid), role).rejects.toThrow(/symbolic|symlink/iu);
		}
	});
});

describe('Equipment image result persistence and CLI', () => {
	it('concurrently persists distinct owned results when their shared result ancestors are absent', async () => {
		const valid = await fixture();
		const secondPacket = buildRootEquipmentPackets({
			manifest: buildEquipmentMaterialProductionManifest(),
			allocation: buildEquipmentMaterialAllocationPlan(),
			profile: valid.profile,
			acceptance: valid.acceptance,
			assignedAt: valid.packet.assignment.assignedAt
		})[1]!;
		const secondCandidateBytes = await sharp({
			create: {
				width: secondPacket.target.presentation.canvas.width,
				height: secondPacket.target.presentation.canvas.height,
				channels: 4,
				background: { r: 35, g: 24, b: 18, alpha: 1 }
			}
		})
			.png()
			.toBuffer();
		const secondResult = resultForPacket(secondPacket, secondCandidateBytes);
		await Promise.all([
			writeRepositoryFile(
				valid.workspaceRoot,
				secondPacket.targetPath,
				jsonBytes(secondPacket.target)
			),
			writeRepositoryFile(
				valid.workspaceRoot,
				secondPacket.assignmentPath,
				jsonBytes(secondPacket.assignment)
			),
			writeRepositoryFile(
				valid.workspaceRoot,
				secondPacket.target.output.candidatePath,
				secondCandidateBytes
			)
		]);
		await expect(
			lstat(path.join(valid.workspaceRoot, ...`${ROOT}/results`.split('/')))
		).rejects.toMatchObject({ code: 'ENOENT' });

		const persisted = await Promise.all([
			persistEquipmentImageResult({
				workspaceRoot: valid.workspaceRoot,
				targetPath: valid.targetPath,
				assignmentPath: valid.assignmentPath,
				result: valid.result
			}),
			persistEquipmentImageResult({
				workspaceRoot: valid.workspaceRoot,
				targetPath: secondPacket.targetPath,
				assignmentPath: secondPacket.assignmentPath,
				result: secondResult
			})
		]);

		expect(persisted.map(({ status }) => status)).toEqual(['candidate', 'candidate']);
		expect(new Set(persisted.map(({ ownedPaths }) => ownedPaths.at(-1))).size).toBe(2);
		expect(persisted[0]!.ownedPaths).toEqual([
			valid.packet.target.output.candidatePath,
			valid.packet.target.output.resultPath
		]);
		expect(persisted[1]!.ownedPaths).toEqual([
			secondPacket.target.output.candidatePath,
			secondPacket.target.output.resultPath
		]);
	});

	it('fully verifies before exclusive create, then re-reads and verifies exact persisted bytes', async () => {
		const valid = await fixture();
		const persisted = await persistEquipmentImageResult({
			workspaceRoot: valid.workspaceRoot,
			targetPath: valid.targetPath,
			assignmentPath: valid.assignmentPath,
			result: valid.result
		});
		expect(persisted).toMatchObject({
			status: 'candidate',
			candidateSha256: valid.candidateSha256,
			ownedPaths: [valid.packet.target.output.candidatePath, valid.resultPath]
		});
		expect(
			await readFile(path.join(valid.workspaceRoot, ...valid.resultPath.split('/')), 'utf8')
		).toBe(jsonBytes(valid.result));

		await expect(
			persistEquipmentImageResult({
				workspaceRoot: valid.workspaceRoot,
				targetPath: valid.targetPath,
				assignmentPath: valid.assignmentPath,
				result: valid.result
			})
		).rejects.toThrow(/existing|collision|exclusive/iu);
	});

	it('does not create a result for invalid evidence or a supplied packet-path mismatch', async () => {
		const valid = await fixture();
		await expect(
			persistEquipmentImageResult({
				workspaceRoot: valid.workspaceRoot,
				targetPath: valid.targetPath,
				assignmentPath: valid.assignmentPath,
				result: { ...valid.result, promptSha256: '0'.repeat(64) }
			})
		).rejects.toThrow('prompt');
		await expect(
			readFile(path.join(valid.workspaceRoot, ...valid.resultPath.split('/')))
		).rejects.toMatchObject({ code: 'ENOENT' });

		const wrongTargetPath = `${ROOT}/targets/f/copper/dagger-v1.json`;
		await writeRepositoryFile(valid.workspaceRoot, wrongTargetPath, jsonBytes(valid.packet.target));
		await expect(
			persistEquipmentImageResult({
				workspaceRoot: valid.workspaceRoot,
				targetPath: wrongTargetPath,
				assignmentPath: valid.assignmentPath,
				result: valid.result
			})
		).rejects.toThrow(/packet path|target path/iu);
	});

	it('persists failed no-candidate evidence as only the assignment-owned result', async () => {
		const valid = await fixture();
		const failed = {
			...valid.result,
			status: 'failed' as const,
			candidate: null,
			candidateSha256: null,
			attempts: [{ ...valid.result.attempts[0]!, sourceOutputId: null }],
			findings: valid.result.findings.map((finding) => ({
				...finding,
				outcome: 'not-applicable' as const,
				observation: 'Generation failed before inspection.'
			})),
			writtenOutputPaths: [valid.resultPath]
		};
		await rm(
			path.join(valid.workspaceRoot, ...valid.packet.target.output.candidatePath.split('/'))
		);
		await expect(
			persistEquipmentImageResult({
				workspaceRoot: valid.workspaceRoot,
				targetPath: valid.targetPath,
				assignmentPath: valid.assignmentPath,
				result: failed
			})
		).resolves.toMatchObject({ status: 'failed', ownedPaths: [valid.resultPath] });
	});

	it('persist-result accepts exactly one stdin JSON value and verify-result reads it back', async () => {
		const valid = await fixture();
		for (const stdin of [
			'',
			'  ',
			`${JSON.stringify(valid.result)}\n${JSON.stringify(valid.result)}`
		]) {
			await expect(
				runEquipmentImageProductionCli({
					args: [
						'persist-result',
						'--target',
						valid.targetPath,
						'--assignment',
						valid.assignmentPath
					],
					workspaceRoot: valid.workspaceRoot,
					stdin
				})
			).rejects.toThrow(/stdin|JSON value/iu);
		}

		await expect(
			runEquipmentImageProductionCli({
				args: [
					'persist-result',
					'--target',
					valid.targetPath,
					'--assignment',
					valid.assignmentPath
				],
				workspaceRoot: valid.workspaceRoot,
				stdin: JSON.stringify(valid.result)
			})
		).resolves.toMatchObject({ command: 'persist-result', status: 'candidate' });
		await expect(
			runEquipmentImageProductionCli({
				args: [
					'verify-result',
					'--target',
					valid.targetPath,
					'--assignment',
					valid.assignmentPath,
					'--result',
					valid.resultPath
				],
				workspaceRoot: valid.workspaceRoot
			})
		).resolves.toMatchObject({ command: 'verify-result', status: 'candidate' });
	});

	it('verify-result refuses a symlinked result file', async () => {
		const valid = await fixture();
		await writeRepositoryFile(valid.workspaceRoot, valid.resultPath, jsonBytes(valid.result));
		const resultAbsolute = path.join(valid.workspaceRoot, ...valid.resultPath.split('/'));
		const real = `${resultAbsolute}.real`;
		await writeFile(real, await readFile(resultAbsolute));
		await rm(resultAbsolute);
		await symlink(real, resultAbsolute);
		await expect(
			runEquipmentImageProductionCli({
				args: [
					'verify-result',
					'--target',
					valid.targetPath,
					'--assignment',
					valid.assignmentPath,
					'--result',
					valid.resultPath
				],
				workspaceRoot: valid.workspaceRoot
			})
		).rejects.toThrow(/symbolic|symlink/iu);
	});
});
