import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
	buildEquipmentImageResultEvidenceV2,
	persistEquipmentImageResultEvidenceV2,
	verifyEquipmentImageResultEvidenceV2,
	verifyPersistedEquipmentImageResultEvidenceV2
} from './equipment-image-result-v2.js';
import {
	EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256,
	buildEquipmentV2ProfileAcceptance,
	canonicalJsonSha256V2
} from './equipment-image-profile-acceptance-v2.js';
import { buildEquipmentVisualProfileV2 } from './equipment-image-profile-v2.js';
import { buildRootEquipmentPacketsV2 } from './equipment-image-packets-v2.js';
import {
	buildEquipmentMaterialAllocationPlanV2,
	buildEquipmentMaterialProductionManifestV2
} from './equipment-material-production-v2.js';
import { persistEquipmentImageProductionOutputV2 } from './persist-equipment-image-production-output-v2.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

function jsonBytes(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

async function writeRepositoryFile(
	workspaceRoot: string,
	repositoryPath: string,
	contents: string | Uint8Array
): Promise<void> {
	const absolutePath = path.join(workspaceRoot, ...repositoryPath.split('/'));
	await mkdir(path.dirname(absolutePath), { recursive: true });
	await writeFile(absolutePath, contents);
}

async function fixture(input: { readonly withCandidate: boolean }) {
	const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'summonlab-equipment-v2-result-'));
	temporaryDirectories.push(workspaceRoot);
	const manifest = buildEquipmentMaterialProductionManifestV2();
	const allocation = buildEquipmentMaterialAllocationPlanV2();
	const profile = buildEquipmentVisualProfileV2();
	const acceptance = buildEquipmentV2ProfileAcceptance({
		profile,
		acknowledgedProfileSha256: EQUIPMENT_V2_ACCEPTED_PROFILE_CANONICAL_SHA256
	});
	const packet = buildRootEquipmentPacketsV2({ manifest, allocation, profile, acceptance })[0]!;
	await Promise.all([
		writeRepositoryFile(
			workspaceRoot,
			'assets/equipment/experiments/material-equipment-v2/manifest.json',
			jsonBytes(manifest)
		),
		writeRepositoryFile(
			workspaceRoot,
			'assets/equipment/experiments/material-equipment-v2/allocation-plan.json',
			jsonBytes(allocation)
		),
		writeRepositoryFile(
			workspaceRoot,
			'assets/equipment/experiments/material-equipment-v2/visual-profile/profile.json',
			jsonBytes(profile)
		),
		writeRepositoryFile(
			workspaceRoot,
			'assets/equipment/experiments/material-equipment-v2/visual-profile/acceptance.json',
			jsonBytes(acceptance)
		),
		writeRepositoryFile(workspaceRoot, packet.targetPath, jsonBytes(packet.target)),
		writeRepositoryFile(workspaceRoot, packet.assignmentPath, jsonBytes(packet.assignment)),
		...packet.target.references.map(async ({ path: repositoryPath }) => {
			const destination = path.join(workspaceRoot, ...repositoryPath.split('/'));
			await mkdir(path.dirname(destination), { recursive: true });
			await cp(path.join(process.cwd(), ...repositoryPath.split('/')), destination);
		})
	]);
	if (input.withCandidate) {
		const sourcePath = path.join(workspaceRoot, 'source.png');
		await writeFile(
			sourcePath,
			await sharp({
				create: {
					width: packet.target.presentation.canvas.width,
					height: packet.target.presentation.canvas.height,
					channels: 4,
					background: '#374151ff'
				}
			})
				.png()
				.toBuffer()
		);
		await persistEquipmentImageProductionOutputV2({
			workspaceRoot,
			sourcePath,
			targetPath: packet.targetPath,
			assignmentPath: packet.assignmentPath,
			destinationPath: packet.target.output.candidatePath
		});
	}
	return { workspaceRoot, packet };
}

function findings(packet: Awaited<ReturnType<typeof fixture>>['packet'], pass = true) {
	return packet.target.acceptanceCriteria.map(({ criterionId }, index) => ({
		criterionId,
		outcome: pass || index > 0 ? ('pass' as const) : ('fail' as const),
		observation: pass || index > 0 ? 'Passed inspection.' : 'Generation produced no image.'
	}));
}

function resultInput(
	fixtureValue: Awaited<ReturnType<typeof fixture>>,
	status: 'candidate' | 'revise' | 'failed' = 'candidate'
) {
	return {
		workspaceRoot: fixtureValue.workspaceRoot,
		targetPath: fixtureValue.packet.targetPath,
		assignmentPath: fixtureValue.packet.assignmentPath,
		status,
		sourceOutputId: status === 'failed' ? null : 'imagegen-output-v2-1',
		requestStartedAt: '2026-09-02T22:00:00.000Z',
		generationCompletedAt: '2026-09-02T22:00:20.000Z',
		inspectionCompletedAt: '2026-09-02T22:00:30.000Z',
		startedAt: '2026-09-02T21:59:59.000Z',
		completedAt: '2026-09-02T22:00:31.000Z',
		findings: findings(fixtureValue.packet, status !== 'failed')
	};
}

describe('Equipment v2 result evidence persistence', () => {
	it('builds, verifies, exclusive-persists, and re-verifies exact candidate evidence', async () => {
		const prepared = await fixture({ withCandidate: true });
		const result = await buildEquipmentImageResultEvidenceV2(resultInput(prepared));
		expect(result).toMatchObject({
			resultId: `result-${prepared.packet.target.targetId}`,
			status: 'candidate',
			humanReviewLabel: 'Pass',
			candidate: {
				path: prepared.packet.target.output.candidatePath,
				width: 1024,
				height: 1024,
				mediaType: 'image/png'
			},
			writtenOutputPaths: [
				prepared.packet.target.output.candidatePath,
				prepared.packet.target.output.provenanceResultPath
			]
		});
		await expect(
			verifyEquipmentImageResultEvidenceV2({
				workspaceRoot: prepared.workspaceRoot,
				targetPath: prepared.packet.targetPath,
				assignmentPath: prepared.packet.assignmentPath,
				result
			})
		).resolves.toMatchObject({
			candidateSha256: result.candidateSha256,
			resultCanonicalSha256: canonicalJsonSha256V2(result)
		});
		const persisted = await persistEquipmentImageResultEvidenceV2({
			workspaceRoot: prepared.workspaceRoot,
			targetPath: prepared.packet.targetPath,
			assignmentPath: prepared.packet.assignmentPath,
			result
		});
		expect(persisted.resultCanonicalSha256).toBe(canonicalJsonSha256V2(result));
		await expect(
			verifyPersistedEquipmentImageResultEvidenceV2({
				workspaceRoot: prepared.workspaceRoot,
				targetPath: prepared.packet.targetPath,
				assignmentPath: prepared.packet.assignmentPath,
				resultPath: prepared.packet.target.output.provenanceResultPath
			})
		).resolves.toMatchObject({ status: 'candidate' });
		await expect(
			persistEquipmentImageResultEvidenceV2({
				workspaceRoot: prepared.workspaceRoot,
				targetPath: prepared.packet.targetPath,
				assignmentPath: prepared.packet.assignmentPath,
				result
			})
		).rejects.toThrow(/collision/u);
	});

	it('persists failed evidence only when no candidate exists', async () => {
		const prepared = await fixture({ withCandidate: false });
		const input = resultInput(prepared, 'failed');
		const result = await buildEquipmentImageResultEvidenceV2(input);
		expect(result).toMatchObject({
			status: 'failed',
			humanReviewLabel: 'No image',
			candidate: null,
			candidateSha256: null,
			writtenOutputPaths: [prepared.packet.target.output.provenanceResultPath]
		});
		await expect(
			persistEquipmentImageResultEvidenceV2({
				workspaceRoot: prepared.workspaceRoot,
				targetPath: prepared.packet.targetPath,
				assignmentPath: prepared.packet.assignmentPath,
				result
			})
		).resolves.toMatchObject({ status: 'failed' });
	});

	it('rejects forged result fields and candidate byte evidence', async () => {
		const prepared = await fixture({ withCandidate: true });
		const result = await buildEquipmentImageResultEvidenceV2(resultInput(prepared));
		for (const forged of [
			{ ...result, promptSha256: '0'.repeat(64) },
			{ ...result, referenceInputs: [...result.referenceInputs].reverse() },
			{ ...result, candidateSha256: '1'.repeat(64) }
		]) {
			await expect(
				verifyEquipmentImageResultEvidenceV2({
					workspaceRoot: prepared.workspaceRoot,
					targetPath: prepared.packet.targetPath,
					assignmentPath: prepared.packet.assignmentPath,
					result: forged
				})
			).rejects.toThrow();
		}
		const candidateAbsolute = path.join(
			prepared.workspaceRoot,
			...prepared.packet.target.output.candidatePath.split('/')
		);
		await writeFile(
			candidateAbsolute,
			await sharp({
				create: { width: 1024, height: 1024, channels: 4, background: '#111827ff' }
			})
				.png()
				.toBuffer()
		);
		await expect(
			verifyEquipmentImageResultEvidenceV2({
				workspaceRoot: prepared.workspaceRoot,
				targetPath: prepared.packet.targetPath,
				assignmentPath: prepared.packet.assignmentPath,
				result
			})
		).rejects.toThrow(/candidate evidence/u);
	});

	it('rejects a supplied result path not owned by the target', async () => {
		const prepared = await fixture({ withCandidate: true });
		const result = await buildEquipmentImageResultEvidenceV2(resultInput(prepared));
		await expect(
			verifyEquipmentImageResultEvidenceV2({
				workspaceRoot: prepared.workspaceRoot,
				targetPath: prepared.packet.targetPath,
				assignmentPath: prepared.packet.assignmentPath,
				resultPath:
					'assets/equipment/experiments/material-equipment-v2/results/f/bronze/dagger-v2.json',
				result
			})
		).rejects.toThrow(/does not match/u);
		await expect(
			readFile(
				path.join(
					prepared.workspaceRoot,
					...prepared.packet.target.output.provenanceResultPath.split('/')
				)
			)
		).rejects.toMatchObject({ code: 'ENOENT' });
	});
});
