import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	checkFamilyAffinityProductionDispatch,
	validateFamilyAffinityProductionSurface
} from './check-family-affinity-production-dispatch.js';
import {
	buildFamilyAffinityProductionBundle,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityTargetSchema,
	familyAffinityPromptSha256,
	familyAffinityRawSha256,
	familyAffinitySha256,
	loadFamilyAffinityActiveSources,
	stableFamilyAffinityJson
} from './family-affinity-production-lib.js';

const repositoryRoot = process.cwd();
const receiptPath = 'assets/enemies/experiments/family-affinity-v1/production-compatibility.json';
const trackedSkillRoot = resolve('skills/summonlab-image-production');

async function stageCleanDispatchCorpus(): Promise<{
	repositoryRoot: string;
	installedSkillRoot: string;
}> {
	const temporary = await mkdtemp(join(tmpdir(), 'family-dispatch-clean-'));
	const { registry, families, mapping } = await loadFamilyAffinityActiveSources(repositoryRoot);
	const bundle = buildFamilyAffinityProductionBundle(families, mapping);
	for (const { path, value } of bundle.artifacts) {
		await mkdir(dirname(join(temporary, path)), { recursive: true });
		await writeFile(join(temporary, path), stableFamilyAffinityJson(value));
	}
	for (const path of [...registry.familyPacketPaths, registry.mappingPath]) {
		await mkdir(dirname(join(temporary, path)), { recursive: true });
		await writeFile(join(temporary, path), await readFile(join(repositoryRoot, path)));
	}
	const installedSkillRoot = join(temporary, 'skills/summonlab-image-production');
	await cp(trackedSkillRoot, installedSkillRoot, { recursive: true });
	const receipt = JSON.parse(await readFile(join(repositoryRoot, receiptPath), 'utf8'));
	for (const source of receipt.sealedLauncher.sources as Array<{ path: string }>) {
		await mkdir(dirname(join(temporary, source.path)), { recursive: true });
		await cp(join(repositoryRoot, source.path), join(temporary, source.path));
	}
	receipt.approvedSkillRoot = installedSkillRoot;
	await mkdir(dirname(join(temporary, receiptPath)), { recursive: true });
	await writeFile(join(temporary, receiptPath), stableFamilyAffinityJson(receipt));
	return { repositoryRoot: temporary, installedSkillRoot };
}

describe('mandatory family affinity production dispatch gate', () => {
	it('binds the approved tracked and installed full v3 execution surface', async () => {
		const receipt = JSON.parse(await readFile(join(repositoryRoot, receiptPath), 'utf8'));
		const worktreeApproval = { ...receipt, approvedSkillRoot: trackedSkillRoot };
		await expect(
			validateFamilyAffinityProductionSurface({
				compatibility: worktreeApproval,
				trackedSkillRoot,
				installedSkillRoot: trackedSkillRoot,
				repositoryRoot
			})
		).resolves.toMatchObject({
			status: 'compatible',
			bundleSha256: receipt.executionSurface.bundleSha256
		});
	});

	it.each([
		'contract-v3.json',
		'SKILL.md',
		'references/target-schema.md',
		'scripts/validate_target.py',
		'scripts/render_prompt.py',
		'scripts/verify_result.py',
		'scripts/write_family_result.py',
		'scripts/persist_family_candidate.py',
		'scripts/family_dispatch_gate.mjs'
	])('rejects installed execution-surface drift in %s', async (relativePath) => {
		const temporary = await mkdtemp(join(tmpdir(), 'family-surface-'));
		try {
			const copiedSkill = join(temporary, 'summonlab-image-production');
			await cp(trackedSkillRoot, copiedSkill, { recursive: true });
			const mutationPath =
				relativePath === 'contract-v3.json'
					? join(copiedSkill, 'references', relativePath)
					: join(copiedSkill, relativePath);
			await writeFile(
				mutationPath,
				Buffer.concat([await readFile(mutationPath), Buffer.from('\nDRIFT')])
			);
			const receipt = JSON.parse(await readFile(join(repositoryRoot, receiptPath), 'utf8'));
			const syntheticApproval = { ...receipt, approvedSkillRoot: copiedSkill };
			await expect(
				validateFamilyAffinityProductionSurface({
					compatibility: syntheticApproval,
					trackedSkillRoot: copiedSkill,
					installedSkillRoot: copiedSkill,
					repositoryRoot
				})
			).rejects.toThrow(/surface|bundle|contract|drift|hash/i);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	it('rejects an installed root different from the receipt-approved tracked root', async () => {
		const temporary = await mkdtemp(join(tmpdir(), 'family-root-'));
		try {
			const copiedSkill = join(temporary, 'summonlab-image-production');
			await cp(trackedSkillRoot, copiedSkill, { recursive: true });
			const receipt = JSON.parse(await readFile(join(repositoryRoot, receiptPath), 'utf8'));
			await expect(
				validateFamilyAffinityProductionSurface({
					compatibility: { ...receipt, approvedSkillRoot: trackedSkillRoot },
					trackedSkillRoot,
					installedSkillRoot: copiedSkill,
					repositoryRoot
				})
			).rejects.toThrow(/root/i);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	it('rejects raw repository dispatch entrypoint drift', async () => {
		const temporary = await mkdtemp(join(tmpdir(), 'family-dispatch-drift-'));
		try {
			const copiedSkill = join(temporary, 'skills/summonlab-image-production');
			await cp(trackedSkillRoot, copiedSkill, { recursive: true });
			const copiedEntrypoint = join(
				temporary,
				'tools/check-family-affinity-production-dispatch.ts'
			);
			await mkdir(dirname(copiedEntrypoint), { recursive: true });
			await writeFile(
				copiedEntrypoint,
				Buffer.concat([
					await readFile(
						join(repositoryRoot, 'tools/check-family-affinity-production-dispatch.ts')
					),
					Buffer.from('\nDRIFT')
				])
			);
			const receipt = JSON.parse(await readFile(join(repositoryRoot, receiptPath), 'utf8'));
			await expect(
				validateFamilyAffinityProductionSurface({
					compatibility: { ...receipt, approvedSkillRoot: copiedSkill },
					trackedSkillRoot: copiedSkill,
					installedSkillRoot: copiedSkill,
					repositoryRoot: temporary
				})
			).rejects.toThrow(/dispatch.*drift/i);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	it.each([
		'tools/check-family-affinity-production-dispatch.ts',
		'tools/family-affinity-production-lib.ts',
		'package.json',
		'pnpm-lock.yaml'
	])('rejects sealed bundle source drift in %s', async (mutatedSource) => {
		const temporary = await mkdtemp(join(tmpdir(), 'family-launcher-source-drift-'));
		try {
			const copiedSkill = join(temporary, 'skills/summonlab-image-production');
			await cp(trackedSkillRoot, copiedSkill, { recursive: true });
			const receipt = JSON.parse(await readFile(join(repositoryRoot, receiptPath), 'utf8'));
			for (const source of receipt.sealedLauncher.sources as Array<{ path: string }>) {
				const destination = join(temporary, source.path);
				await mkdir(dirname(destination), { recursive: true });
				await cp(join(repositoryRoot, source.path), destination);
			}
			const mutationPath = join(temporary, mutatedSource);
			await writeFile(
				mutationPath,
				Buffer.concat([await readFile(mutationPath), Buffer.from('\nDRIFT')])
			);
			await expect(
				validateFamilyAffinityProductionSurface({
					compatibility: { ...receipt, approvedSkillRoot: copiedSkill },
					trackedSkillRoot: copiedSkill,
					installedSkillRoot: copiedSkill,
					repositoryRoot: temporary
				})
			).rejects.toThrow(/dispatch|source.*drift/i);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	it('dispatches the active canonical Normal only through receipt, bundle, manifest, packet, prompt, and absence gates', async () => {
		const clean = await stageCleanDispatchCorpus();
		const targetPath =
			'assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-bog-troll/normal/target-v1.json';
		const assignmentPath = targetPath
			.replace('/targets/', '/assignments/')
			.replace('target-v1.json', 'assignment-v1.json');
		try {
			await expect(
				checkFamilyAffinityProductionDispatch({
					repositoryRoot: clean.repositoryRoot,
					targetPath,
					assignmentPath,
					installedSkillRoot: clean.installedSkillRoot
				})
			).resolves.toMatchObject({ dispatchable: true, affinity: 'normal', state: 'candidate-only' });
		} finally {
			await rm(clean.repositoryRoot, { recursive: true, force: true });
		}
	});

	it('rejects the active canonical Earth while its exact Normal chain is blocked', async () => {
		const clean = await stageCleanDispatchCorpus();
		const targetPath =
			'assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-bog-troll/earth/target-v1.json';
		const assignmentPath = targetPath
			.replace('/targets/', '/assignments/')
			.replace('target-v1.json', 'assignment-v1.json');
		try {
			await expect(
				checkFamilyAffinityProductionDispatch({
					repositoryRoot: clean.repositoryRoot,
					targetPath,
					assignmentPath,
					installedSkillRoot: clean.installedSkillRoot
				})
			).rejects.toThrow(/blocked-on-anchor/i);
		} finally {
			await rm(clean.repositoryRoot, { recursive: true, force: true });
		}
	});

	it('separates candidate and result persistence phases with exact candidate/result binding', async () => {
		const clean = await stageCleanDispatchCorpus();
		const temporary = clean.repositoryRoot;
		try {
			const familyRoot = 'assets/enemies/experiments/family-affinity-v1';
			const copiedSkill = clean.installedSkillRoot;
			const targetPath = `${familyRoot}/targets/trolls/troll-bog-troll/normal/target-v1.json`;
			const assignmentPath = targetPath
				.replace('/targets/', '/assignments/')
				.replace('target-v1.json', 'assignment-v1.json');
			const target = FamilyAffinityTargetSchema.parse(
				JSON.parse(await readFile(join(temporary, targetPath), 'utf8'))
			);
			const assignment = FamilyAffinityAssignmentSchema.parse(
				JSON.parse(await readFile(join(temporary, assignmentPath), 'utf8'))
			);
			await expect(
				checkFamilyAffinityProductionDispatch({
					repositoryRoot: temporary,
					targetPath,
					assignmentPath,
					installedSkillRoot: copiedSkill,
					phase: 'candidate'
				})
			).resolves.toMatchObject({ dispatchable: true, phase: 'candidate' });
			const candidateBytes = Buffer.from('phase-bound-candidate');
			const result = {
				schemaVersion: 'family-affinity-result-v1',
				targetId: target.targetId,
				targetSha256: familyAffinitySha256(target),
				coordinateId: target.coordinateId,
				candidateVersion: target.version,
				producerId: 'image-producer-phase-test',
				candidatePath: target.ownedPaths.candidate,
				candidateSha256: familyAffinityRawSha256(candidateBytes),
				resultPath: target.ownedPaths.result,
				sourcePath: target.sources.familyPacketPath,
				sourceSha256: target.sources.familyPacketSha256,
				promptSha256: familyAffinityPromptSha256(target, assignment),
				state: 'candidate-only',
				runtimeCatalogMutationForbidden: true
			};
			await expect(
				checkFamilyAffinityProductionDispatch({
					repositoryRoot: temporary,
					targetPath,
					assignmentPath,
					installedSkillRoot: copiedSkill,
					phase: 'result',
					result
				})
			).rejects.toThrow(/candidate|missing/i);
			const candidateAbsolute = join(temporary, target.ownedPaths.candidate);
			await mkdir(dirname(candidateAbsolute), { recursive: true });
			await writeFile(candidateAbsolute, candidateBytes);
			await expect(
				checkFamilyAffinityProductionDispatch({
					repositoryRoot: temporary,
					targetPath,
					assignmentPath,
					installedSkillRoot: copiedSkill,
					phase: 'result',
					result
				})
			).resolves.toMatchObject({ dispatchable: true, phase: 'result' });
			await expect(
				checkFamilyAffinityProductionDispatch({
					repositoryRoot: temporary,
					targetPath,
					assignmentPath,
					installedSkillRoot: copiedSkill,
					phase: 'result',
					result: { ...result, candidateSha256: 'a'.repeat(64) }
				})
			).rejects.toThrow(/candidate|stale|forged|cross-bound/i);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});
});
