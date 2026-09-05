import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	SkillIconAssignmentV2Schema,
	SkillIconReferencePathSchema,
	SkillIconTargetV2Schema
} from '../packages/contracts/src/index.js';
import { exportCleanupReferencePackets } from './export-skill-icon-cleanup-reference-packets.js';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const temporaryRoots: string[] = [];

const OPTION_C_PATH = 'assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png';
const SELECTED_FRAME_SHEET_PATH =
	'assets/wiki/skills/icon-production-v1/mass-production-v1/references/approved-seven-frame-sheet.png';
const GEOMETRY_PATH = 'assets/wiki/skills/icon-production-v1/geometry-v2.json';
const PROVIDER_GUIDE_PATH =
	'assets/wiki/skills/icon-production-v1/references/geometry-guide-v2.png';
const frameRarities = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
const frameMaterials = {
	E: 'aged bronze with brown-gold patina and understated corner collars',
	D: 'tempered blue steel with cool edge highlights and restrained rivets',
	C: 'moonlit silver with clean bevels and minimal ornament',
	B: 'blackened amethyst metal with subtle violet inlay',
	A: 'champagne electrum with brighter bevels and four restrained point ornaments',
	S: 'ceremonial antique gold with the approved thorned crown ornament'
} as const;

afterEach(async () => {
	await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function temporaryWorkspace(): Promise<string> {
	const root = await mkdtemp(path.join(os.tmpdir(), 'summonlab-cleanup-reference-packets-'));
	temporaryRoots.push(root);
	for (const repositoryPath of [
		OPTION_C_PATH,
		SELECTED_FRAME_SHEET_PATH,
		GEOMETRY_PATH,
		PROVIDER_GUIDE_PATH
	]) {
		const destination = path.resolve(root, repositoryPath);
		await mkdir(path.dirname(destination), { recursive: true });
		await copyFile(path.resolve(workspaceRoot, repositoryPath), destination);
	}
	return root;
}

async function readJson(root: string, repositoryPath: string): Promise<unknown> {
	return JSON.parse(await readFile(path.resolve(root, repositoryPath), 'utf8')) as unknown;
}

describe('cleanup shared-layer reference packet exporter', () => {
	it('permits the selected frame sheet as one exact additional strict-v2 authority path', () => {
		expect(SkillIconReferencePathSchema.safeParse(SELECTED_FRAME_SHEET_PATH).success).toBe(true);
		expect(
			SkillIconReferencePathSchema.safeParse(`${SELECTED_FRAME_SHEET_PATH}/unrelated.png`).success
		).toBe(false);
	});

	it('exports six frame and one backing revision-five packet pairs with bounded authority', async () => {
		const root = await temporaryWorkspace();
		const report = await exportCleanupReferencePackets({ root, mode: 'write' });

		expect(report).toMatchObject({ mode: 'write', written: expect.any(Array), drifted: [] });
		expect(report.written).toHaveLength(14);
		expect(report.jobIds).toEqual([
			'rarity-frame-e-v5',
			'rarity-frame-d-v5',
			'rarity-frame-c-v5',
			'rarity-frame-b-v5',
			'rarity-frame-a-v5',
			'rarity-frame-s-v5',
			'charcoal-forged-stone-v5'
		]);

		const outputPaths = new Set<string>();
		for (const rarity of frameRarities) {
			const slug = rarity.toLowerCase();
			const jobId = `rarity-frame-${slug}-v5`;
			const targetPath = `assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`;
			const assignmentPath = `assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`;
			const target = SkillIconTargetV2Schema.parse(await readJson(root, targetPath));
			const assignment = SkillIconAssignmentV2Schema.parse(await readJson(root, assignmentPath));

			expect(target).toMatchObject({
				jobId,
				logicalIdentity: `rarity-frame-${slug}`,
				revision: 5,
				role: 'rarity-frame',
				rarity,
				normalization: { profile: 'skill-icon-green-key-role-mask-v3' }
			});
			expect(target.exactPrompt).toContain(frameMaterials[rarity]);
			expect(target.exactPrompt).toMatch(/uniform opaque #00FF00 matte/iu);
			expect(target.exactPrompt).toMatch(/provider matte/iu);
			expect(target.exactPrompt).toMatch(/completely empty aperture/iu);
			expect(target.exactPrompt).toMatch(/fully visible regular hexagon/iu);
			expect(target.exactPrompt).toMatch(/integrated crest\/letter/iu);
			expect(target.exactPrompt).toMatch(/no art or backing/iu);
			expect(target.exactPrompt).toMatch(/do not crop or trace/i);
			expect(target.references.map((reference) => reference.path)).toEqual([
				OPTION_C_PATH,
				SELECTED_FRAME_SHEET_PATH,
				PROVIDER_GUIDE_PATH
			]);
			expect(assignment).toMatchObject({
				jobId,
				revision: 5,
				skillVersion: 'summonlab-skill-icon-production-v4',
				normalization: { profile: 'skill-icon-green-key-role-mask-v3' },
				retryCeiling: 1
			});
			expect(assignment.targetPath).toBe(targetPath);
			expect(assignment.permittedOutputs).toEqual(target.output);
			outputPaths.add(target.output.candidatePath);
			outputPaths.add(target.output.resultPath);
		}

		const backingJobId = 'charcoal-forged-stone-v5';
		const backingTargetPath =
			'assets/wiki/skills/icon-production-v1/targets/references/charcoal-forged-stone-v5.json';
		const backingAssignmentPath =
			'assets/wiki/skills/icon-production-v1/assignments/references/charcoal-forged-stone-v5.json';
		const backing = SkillIconTargetV2Schema.parse(await readJson(root, backingTargetPath));
		const backingAssignment = SkillIconAssignmentV2Schema.parse(
			await readJson(root, backingAssignmentPath)
		);
		expect(backing).toMatchObject({
			jobId: backingJobId,
			logicalIdentity: 'charcoal-forged-stone',
			revision: 5,
			role: 'backing',
			rarity: null,
			normalization: { profile: 'skill-icon-green-key-role-mask-v3' }
		});
		expect(backing.references.map((reference) => reference.path)).toEqual([
			OPTION_C_PATH,
			PROVIDER_GUIDE_PATH
		]);
		expect(backing.exactPrompt).toMatch(/Option C tonal authority/iu);
		expect(backing.exactPrompt).toMatch(/geometry guide/iu);
		expect(backingAssignment).toMatchObject({
			jobId: backingJobId,
			revision: 5,
			skillVersion: 'summonlab-skill-icon-production-v4',
			normalization: { profile: 'skill-icon-green-key-role-mask-v3' },
			retryCeiling: 1
		});
		expect(backingAssignment.targetPath).toBe(backingTargetPath);
		expect(backingAssignment.permittedOutputs).toEqual(backing.output);
		outputPaths.add(backing.output.candidatePath);
		outputPaths.add(backing.output.resultPath);
		expect(outputPaths.size).toBe(14);

		await expect(exportCleanupReferencePackets({ root, mode: 'check' })).resolves.toMatchObject({
			mode: 'check',
			written: [],
			drifted: []
		});
	});
});
