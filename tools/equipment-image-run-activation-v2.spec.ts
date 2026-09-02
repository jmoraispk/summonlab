import { createHash } from 'node:crypto';
import {
	cp,
	lstat,
	mkdir,
	mkdtemp,
	readdir,
	rm,
	symlink,
	unlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildEquipmentV2ProfileAcceptance } from './equipment-image-profile-acceptance-v2.js';
import { buildEquipmentVisualProfileV2 } from './equipment-image-profile-v2.js';
import { buildRootEquipmentPacketsV2 } from './equipment-image-packets-v2.js';
import {
	DEFAULT_EQUIPMENT_V2_RUN_ID,
	EQUIPMENT_V2_RUN_ACTIVATION_PATH,
	EQUIPMENT_V2_RUN_PLAN_PATH,
	EquipmentV2RunActivationSchema,
	EquipmentV2RunPlanSchema,
	activateEquipmentV2Run,
	assertEquipmentV2RootTargetAuthorized,
	buildEquipmentV2RunPlan,
	reportEquipmentV2RunReadiness
} from './equipment-image-run-activation-v2.js';
import {
	EQUIPMENT_V2_PRODUCTION_ROOT,
	buildEquipmentMaterialAllocationPlanV2,
	buildEquipmentMaterialProductionManifestV2
} from './equipment-material-production-v2.js';

const SOURCE_WORKSPACE = process.cwd();
const CREATED_AT = '2026-09-02T21:00:00.000Z';
const ACTIVATED_AT = '2026-09-02T21:01:00.000Z';
const CHECKED_AT = '2026-09-02T21:02:00.000Z';
const roots: string[] = [];

function absolute(workspaceRoot: string, repositoryPath: string): string {
	return path.join(workspaceRoot, ...repositoryPath.split('/'));
}

async function writeJson(
	workspaceRoot: string,
	repositoryPath: string,
	value: unknown
): Promise<void> {
	await mkdir(path.dirname(absolute(workspaceRoot, repositoryPath)), { recursive: true });
	await writeFile(
		absolute(workspaceRoot, repositoryPath),
		`${JSON.stringify(value, null, '\t')}\n`,
		'utf8'
	);
}

async function readJson(workspaceRoot: string, repositoryPath: string): Promise<unknown> {
	return JSON.parse(
		await import('node:fs/promises').then(({ readFile }) =>
			readFile(absolute(workspaceRoot, repositoryPath), 'utf8')
		)
	) as unknown;
}

async function makeFixture(): Promise<string> {
	const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'equipment-v2-run-'));
	roots.push(workspaceRoot);
	await cp(
		absolute(SOURCE_WORKSPACE, EQUIPMENT_V2_PRODUCTION_ROOT),
		absolute(workspaceRoot, EQUIPMENT_V2_PRODUCTION_ROOT),
		{
			recursive: true,
			filter: (source) => {
				const relative = path.relative(
					absolute(SOURCE_WORKSPACE, EQUIPMENT_V2_PRODUCTION_ROOT),
					source
				);
				return !['targets', 'assignments', 'candidates', 'results', 'reviews', 'runs'].includes(
					relative.split(path.sep)[0] ?? ''
				);
			}
		}
	);
	const profile = buildEquipmentVisualProfileV2();
	for (const reference of profile.references) {
		await mkdir(path.dirname(absolute(workspaceRoot, reference.path)), { recursive: true });
		await cp(absolute(SOURCE_WORKSPACE, reference.path), absolute(workspaceRoot, reference.path));
	}
	const manifest = buildEquipmentMaterialProductionManifestV2();
	const allocation = buildEquipmentMaterialAllocationPlanV2();
	const acceptance = buildEquipmentV2ProfileAcceptance({
		profile,
		acknowledgedProfileSha256: (
			await readJson(
				workspaceRoot,
				`${EQUIPMENT_V2_PRODUCTION_ROOT}/visual-profile/acceptance.json`
			).then((value) => value as { profileCanonicalSha256: string })
		).profileCanonicalSha256
	});
	for (const packet of buildRootEquipmentPacketsV2({ manifest, allocation, profile, acceptance })) {
		await writeJson(workspaceRoot, packet.targetPath, packet.target);
		await writeJson(workspaceRoot, packet.assignmentPath, packet.assignment);
	}
	return workspaceRoot;
}

async function snapshotTree(workspaceRoot: string): Promise<string[]> {
	const entries: string[] = [];
	async function visit(directory: string, relative: string): Promise<void> {
		for (const name of (await readdir(directory)).sort()) {
			const child = path.join(directory, name);
			const childRelative = path.posix.join(relative, name);
			const metadata = await lstat(child);
			if (metadata.isSymbolicLink()) entries.push(`link:${childRelative}`);
			else if (metadata.isDirectory()) {
				entries.push(`directory:${childRelative}`);
				await visit(child, childRelative);
			} else {
				const bytes = await import('node:fs/promises').then(({ readFile }) => readFile(child));
				entries.push(`file:${childRelative}:${createHash('sha256').update(bytes).digest('hex')}`);
			}
		}
	}
	await visit(workspaceRoot, '.');
	return entries;
}

function readiness(workspaceRoot: string) {
	return reportEquipmentV2RunReadiness({
		workspaceRoot,
		runId: DEFAULT_EQUIPMENT_V2_RUN_ID,
		createdAt: CREATED_AT,
		checkedAt: CHECKED_AT
	});
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Equipment v2 immutable run activation', () => {
	it('binds exactly 77 root packet pairs, 84 gated children, and concurrency 16 without writes', async () => {
		const workspaceRoot = await makeFixture();
		const before = await snapshotTree(workspaceRoot);
		const plan = EquipmentV2RunPlanSchema.parse(
			await buildEquipmentV2RunPlan({
				workspaceRoot,
				runId: DEFAULT_EQUIPMENT_V2_RUN_ID,
				createdAt: CREATED_AT
			})
		);
		const report = await readiness(workspaceRoot);

		expect(plan.rootPackets).toHaveLength(77);
		expect(plan.gatedChildTargetIds).toHaveLength(84);
		expect(plan.reviewGates).toHaveLength(21);
		expect(plan.maximumConcurrency).toBe(16);
		expect(plan.initialGeneration).toMatchObject({
			scope: 'root-targets-only',
			gatedChildrenAuthorized: false
		});
		expect(plan.initialGeneration.authorizedTargetIds).toEqual(
			plan.rootPackets.map(({ targetId }) => targetId)
		);
		expect(report).toMatchObject({
			status: 'ready-to-activate',
			writesPerformed: 0,
			generation: { authorized: false, authorizedTargetCount: 0 },
			summary: { initiallyAuthorizedImages: 77, maximumConcurrency: 16 }
		});
		expect(await snapshotTree(workspaceRoot)).toEqual(before);
	});

	it('exclusively persists a hash-bound plan and root-only activation receipt', async () => {
		const workspaceRoot = await makeFixture();
		const result = await activateEquipmentV2Run({
			workspaceRoot,
			runId: DEFAULT_EQUIPMENT_V2_RUN_ID,
			createdAt: CREATED_AT,
			activatedAt: ACTIVATED_AT,
			activatedBy: 'equipment-production-owner'
		});
		expect(result).toMatchObject({
			authorizedRootTargets: 77,
			maximumConcurrency: 16,
			writesPerformed: 2
		});
		const plan = EquipmentV2RunPlanSchema.parse(
			await readJson(workspaceRoot, EQUIPMENT_V2_RUN_PLAN_PATH(DEFAULT_EQUIPMENT_V2_RUN_ID))
		);
		const activation = EquipmentV2RunActivationSchema.parse(
			await readJson(workspaceRoot, EQUIPMENT_V2_RUN_ACTIVATION_PATH(DEFAULT_EQUIPMENT_V2_RUN_ID))
		);
		expect(activation.runPlanCanonicalSha256).toBe(result.runPlanCanonicalSha256);
		expect(activation.authorization.authorizedTargetIds).toEqual(
			plan.initialGeneration.authorizedTargetIds
		);
		expect(activation.authorization).toMatchObject({
			imageGenerationAuthorized: true,
			maximumConcurrency: 16,
			gatedChildrenAuthorized: false
		});
		await expect(
			assertEquipmentV2RootTargetAuthorized({
				workspaceRoot,
				targetId: plan.rootPackets[0]!.targetId
			})
		).resolves.toMatchObject({ scope: 'root-targets-only' });
		await expect(
			assertEquipmentV2RootTargetAuthorized({
				workspaceRoot,
				targetId: plan.gatedChildTargetIds[0]!
			})
		).rejects.toThrow(/not authorized/iu);
		const firstAuthorizedTargetIndex = plan.targetIds.indexOf(
			activation.authorization.authorizedTargetIds[0]!
		);
		const firstCandidatePath = plan.reservedPaths.candidates[firstAuthorizedTargetIndex]!;
		await mkdir(path.dirname(absolute(workspaceRoot, firstCandidatePath)), { recursive: true });
		await writeFile(absolute(workspaceRoot, firstCandidatePath), 'generation has started');
		await expect(readiness(workspaceRoot)).resolves.toMatchObject({
			status: 'activated-root-generation-authorized',
			generation: {
				authorized: true,
				scope: 'root-targets-only',
				authorizedTargetCount: 77,
				gatedChildrenAuthorized: false
			}
		});
		await expect(
			activateEquipmentV2Run({
				workspaceRoot,
				runId: DEFAULT_EQUIPMENT_V2_RUN_ID,
				createdAt: CREATED_AT,
				activatedAt: ACTIVATED_AT,
				activatedBy: 'equipment-production-owner'
			})
		).rejects.toThrow('activated-root-generation-authorized');
	});

	it('blocks stale packets, existing outputs, and premature gated child packets without writing', async () => {
		for (const mutation of ['stale-root', 'existing-output', 'premature-child'] as const) {
			const workspaceRoot = await makeFixture();
			const plan = await buildEquipmentV2RunPlan({
				workspaceRoot,
				runId: DEFAULT_EQUIPMENT_V2_RUN_ID,
				createdAt: CREATED_AT
			});
			if (mutation === 'stale-root') {
				const target = (await readJson(workspaceRoot, plan.rootPackets[0]!.targetPath)) as {
					profileCanonicalSha256: string;
				};
				target.profileCanonicalSha256 = '0'.repeat(64);
				await writeJson(workspaceRoot, plan.rootPackets[0]!.targetPath, target);
			} else if (mutation === 'existing-output') {
				const candidatePath = plan.reservedPaths.candidates[0]!;
				await mkdir(path.dirname(absolute(workspaceRoot, candidatePath)), { recursive: true });
				await writeFile(absolute(workspaceRoot, candidatePath), 'not an image');
			} else {
				const targetId = plan.gatedChildTargetIds[0]!;
				const index = plan.targetIds.indexOf(targetId);
				const candidatePath = plan.reservedPaths.candidates[index]!;
				const childPath = candidatePath
					.replace('/candidates/', '/targets/')
					.replace(/\.png$/u, '.json');
				await writeJson(workspaceRoot, childPath, {});
			}
			const before = await snapshotTree(workspaceRoot);
			const report = await readiness(workspaceRoot);
			expect(report.status).toBe('blocked');
			expect(report.blockers).not.toHaveLength(0);
			expect(await snapshotTree(workspaceRoot)).toEqual(before);
		}
	});

	it('refuses symbolic-link packet and run paths without following them', async () => {
		const workspaceRoot = await makeFixture();
		const plan = await buildEquipmentV2RunPlan({
			workspaceRoot,
			runId: DEFAULT_EQUIPMENT_V2_RUN_ID,
			createdAt: CREATED_AT
		});
		const targetPath = plan.rootPackets[0]!.targetPath;
		const targetAbsolute = absolute(workspaceRoot, targetPath);
		const savedAbsolute = `${targetAbsolute}.saved`;
		await cp(targetAbsolute, savedAbsolute);
		await unlink(targetAbsolute);
		await symlink(path.basename(savedAbsolute), targetAbsolute);
		await expect(readiness(workspaceRoot)).resolves.toMatchObject({ status: 'blocked' });

		await unlink(targetAbsolute);
		await cp(savedAbsolute, targetAbsolute);
		const runsPath = absolute(workspaceRoot, `${EQUIPMENT_V2_PRODUCTION_ROOT}/runs`);
		await symlink(workspaceRoot, runsPath);
		await expect(
			activateEquipmentV2Run({
				workspaceRoot,
				runId: DEFAULT_EQUIPMENT_V2_RUN_ID,
				createdAt: CREATED_AT,
				activatedAt: ACTIVATED_AT,
				activatedBy: 'equipment-production-owner'
			})
		).rejects.toThrow(/symbolic|activation/iu);
	});
});
