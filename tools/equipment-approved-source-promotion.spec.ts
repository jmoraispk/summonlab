import { copyFile, link, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { EQUIPMENT_APPROVED_ROOT } from './equipment-approved-source-contract.js';
import {
	buildEquipmentApprovedPromotionPlan,
	equipmentApprovedPromotionPlanSha256
} from './equipment-approved-source-promotion.js';

const SOURCE_ROOT = process.cwd();
const INPUT_PATHS = [
	'docs/superpowers/specs/2026-09-03-equipment-promotion-runtime-integration-design.md',
	'docs/superpowers/plans/2026-09-03-equipment-promotion-runtime-integration.md',
	'assets/equipment/experiments/material-equipment-v3/manifest.json',
	'assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-1-directions.json',
	'assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-2-roots.json',
	'assets/equipment/experiments/material-equipment-v3/checkpoints/checkpoint-3-armour-pieces.json',
	'assets/equipment/experiments/material-equipment-v3/reviews/proposed-promotions/candidate-promotion-v1.json'
] as const;
const PROPOSAL_PATH = INPUT_PATHS[6];
const ROOT_SELECTION_PATH =
	'assets/equipment/experiments/material-equipment-v3/reviews/selections/root-audit-v1.json';
const ARMOUR_SELECTION_PATH =
	'assets/equipment/experiments/material-equipment-v3/reviews/selections/armour-pieces-v1.json';
const workspaces: string[] = [];

function absolute(workspaceRoot: string, repositoryPath: string): string {
	return path.join(workspaceRoot, ...repositoryPath.split('/'));
}

async function copyRepositoryFile(workspaceRoot: string, repositoryPath: string): Promise<void> {
	const destination = absolute(workspaceRoot, repositoryPath);
	await mkdir(path.dirname(destination), { recursive: true });
	await copyFile(absolute(SOURCE_ROOT, repositoryPath), destination);
}

async function makePromotionWorkspace(): Promise<string> {
	const workspaceRoot = await mkdtemp(
		path.join(path.dirname(SOURCE_ROOT), 'equipment-approved-promotion-')
	);
	workspaces.push(workspaceRoot);
	for (const repositoryPath of INPUT_PATHS) await copyRepositoryFile(workspaceRoot, repositoryPath);
	await copyRepositoryFile(workspaceRoot, ROOT_SELECTION_PATH);
	await copyRepositoryFile(workspaceRoot, ARMOUR_SELECTION_PATH);
	const armourSelections = JSON.parse(
		await readFile(absolute(SOURCE_ROOT, ARMOUR_SELECTION_PATH), 'utf8')
	) as {
		revisionPlan: { path: string };
		selections: Array<{ assignmentPath: string; resultPath: string }>;
	};
	await copyRepositoryFile(workspaceRoot, armourSelections.revisionPlan.path);
	for (const selection of armourSelections.selections) {
		await copyRepositoryFile(workspaceRoot, selection.assignmentPath);
		await copyRepositoryFile(workspaceRoot, selection.resultPath);
	}
	const proposal = JSON.parse(await readFile(absolute(workspaceRoot, PROPOSAL_PATH), 'utf8')) as {
		entries: Array<{ candidatePath: string }>;
	};
	for (const { candidatePath } of proposal.entries) {
		const destination = absolute(workspaceRoot, candidatePath);
		await mkdir(path.dirname(destination), { recursive: true });
		await link(absolute(SOURCE_ROOT, candidatePath), destination);
	}
	return workspaceRoot;
}

afterEach(async () => {
	await Promise.all(
		workspaces.splice(0).map((workspaceRoot) => rm(workspaceRoot, { recursive: true }))
	);
});

describe('Equipment approved-source promotion planner', () => {
	it('builds the deterministic 161/140/21 zero-write plan', async () => {
		const workspaceRoot = await makePromotionWorkspace();
		const first = await buildEquipmentApprovedPromotionPlan(workspaceRoot);
		const second = await buildEquipmentApprovedPromotionPlan(workspaceRoot);

		expect(first.entries).toHaveLength(161);
		expect(first.entries.filter(({ role }) => role === 'item')).toHaveLength(140);
		expect(first.entries.filter(({ role }) => role === 'armour-set-reference')).toHaveLength(21);
		expect(new Set(first.entries.map(({ approvedPath }) => approvedPath)).size).toBe(161);
		expect(equipmentApprovedPromotionPlanSha256(first)).toBe(
			equipmentApprovedPromotionPlanSha256(second)
		);
		expect(await readFile(absolute(workspaceRoot, PROPOSAL_PATH), 'utf8')).toContain(
			'equipment-candidate-promotion-proposal-v3'
		);
		await expect(
			readFile(absolute(workspaceRoot, `${EQUIPMENT_APPROVED_ROOT}/manifest.json`))
		).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('preserves selected base and revised candidates exactly', async () => {
		const workspaceRoot = await makePromotionWorkspace();
		const proposal = JSON.parse(await readFile(absolute(workspaceRoot, PROPOSAL_PATH), 'utf8')) as {
			entries: Array<{ targetId: string; candidatePath: string; candidateSha256: string }>;
		};
		const plan = await buildEquipmentApprovedPromotionPlan(workspaceRoot);

		for (const targetId of [
			'material-equipment-v3-bronze-sword-v3',
			'material-equipment-v3-bronze-axe-v3'
		]) {
			const selected = proposal.entries.find((entry) => entry.targetId === targetId)!;
			const planned = plan.entries.find((entry) => entry.targetId === targetId)!;
			expect(planned.candidate).toEqual({
				path: selected.candidatePath,
				sha256: selected.candidateSha256
			});
		}
		expect(
			plan.entries.find(({ targetId }) => targetId === 'material-equipment-v3-bronze-axe-v3')!
				.candidate.path
		).toContain('/revisions/');
	});

	it('binds 84 Armour pieces to checkpoint 3 and every other source to checkpoint 2', async () => {
		const workspaceRoot = await makePromotionWorkspace();
		const plan = await buildEquipmentApprovedPromotionPlan(workspaceRoot);
		const checkpoint3 = plan.entries.filter(({ checkpoint }) =>
			checkpoint.path.endsWith('checkpoint-3-armour-pieces.json')
		);
		const checkpoint2 = plan.entries.filter(({ checkpoint }) =>
			checkpoint.path.endsWith('checkpoint-2-roots.json')
		);

		expect(checkpoint3).toHaveLength(84);
		expect(checkpoint3.every(({ role, slot }) => role === 'item' && slot !== null)).toBe(true);
		expect(checkpoint2).toHaveLength(77);
		expect(checkpoint2.filter(({ role }) => role === 'item')).toHaveLength(56);
		expect(checkpoint2.filter(({ role }) => role === 'armour-set-reference')).toHaveLength(21);
	});

	it('rejects candidate/proposal hash drift', async () => {
		const workspaceRoot = await makePromotionWorkspace();
		const proposal = JSON.parse(await readFile(absolute(workspaceRoot, PROPOSAL_PATH), 'utf8')) as {
			entries: Array<{ candidateSha256: string }>;
		};
		proposal.entries[0]!.candidateSha256 = 'f'.repeat(64);
		await writeFile(
			absolute(workspaceRoot, PROPOSAL_PATH),
			`${JSON.stringify(proposal, null, 2)}\n`
		);

		await expect(buildEquipmentApprovedPromotionPlan(workspaceRoot)).rejects.toThrow(/hash/i);
	});

	it('rejects role-count drift before producing a plan', async () => {
		const workspaceRoot = await makePromotionWorkspace();
		const proposal = JSON.parse(await readFile(absolute(workspaceRoot, PROPOSAL_PATH), 'utf8')) as {
			entries: unknown[];
		};
		proposal.entries.pop();
		await writeFile(
			absolute(workspaceRoot, PROPOSAL_PATH),
			`${JSON.stringify(proposal, null, 2)}\n`
		);

		await expect(buildEquipmentApprovedPromotionPlan(workspaceRoot)).rejects.toThrow(/161/);
	});
});
