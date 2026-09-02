import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	checkFamilyAffinityProductionDispatch,
	validateFamilyAffinityProductionSurface
} from './check-family-affinity-production-dispatch.js';

const repositoryRoot = process.cwd();
const receiptPath = 'assets/enemies/experiments/family-affinity-v1/production-compatibility.json';
const trackedSkillRoot = resolve('skills/summonlab-image-production');

describe('mandatory family affinity production dispatch gate', () => {
	it('binds the approved tracked and installed full v3 execution surface', async () => {
		const receipt = JSON.parse(await readFile(join(repositoryRoot, receiptPath), 'utf8'));
		await expect(
			validateFamilyAffinityProductionSurface({
				compatibility: receipt,
				trackedSkillRoot,
				installedSkillRoot: trackedSkillRoot
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
		'scripts/persist_family_candidate.py'
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
					installedSkillRoot: copiedSkill
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
					compatibility: receipt,
					trackedSkillRoot,
					installedSkillRoot: copiedSkill
				})
			).rejects.toThrow(/root/i);
		} finally {
			await rm(temporary, { recursive: true, force: true });
		}
	});

	it('dispatches the active canonical Normal only through receipt, bundle, manifest, packet, prompt, and absence gates', async () => {
		const targetPath =
			'assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-bog-troll/normal/target-v1.json';
		const assignmentPath = targetPath
			.replace('/targets/', '/assignments/')
			.replace('target-v1.json', 'assignment-v1.json');
		await expect(
			checkFamilyAffinityProductionDispatch({
				repositoryRoot,
				targetPath,
				assignmentPath,
				installedSkillRoot: trackedSkillRoot
			})
		).resolves.toMatchObject({ dispatchable: true, affinity: 'normal', state: 'candidate-only' });
	});

	it('rejects the active canonical Earth while its exact Normal chain is blocked', async () => {
		const targetPath =
			'assets/enemies/experiments/family-affinity-v1/targets/trolls/troll-bog-troll/earth/target-v1.json';
		const assignmentPath = targetPath
			.replace('/targets/', '/assignments/')
			.replace('target-v1.json', 'assignment-v1.json');
		await expect(
			checkFamilyAffinityProductionDispatch({
				repositoryRoot,
				targetPath,
				assignmentPath,
				installedSkillRoot: trackedSkillRoot
			})
		).rejects.toThrow(/blocked-on-anchor/i);
	});
});
