import { createHash } from 'node:crypto';
import {
	cp,
	lstat,
	mkdtemp,
	mkdir,
	readFile,
	readdir,
	rm,
	symlink,
	unlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	EQUIPMENT_PRODUCTION_ROOT,
	EquipmentRunActivationSchema,
	EquipmentRunPlanSchema
} from './equipment-image-production-contract.js';
import { canonicalJsonSha256 } from './equipment-image-packets.js';
import { runEquipmentImageProductionCli } from './equipment-image-production.js';
import {
	DEFAULT_EQUIPMENT_RUN_ID,
	activateEquipmentRun,
	buildEquipmentRunPlan,
	reportEquipmentRunReadiness
} from './equipment-image-run-readiness.js';

const SOURCE_WORKSPACE_ROOT = process.cwd();
const PROFILE_REFERENCE_PATH =
	'assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png';
const RUN_DIRECTORY = `${EQUIPMENT_PRODUCTION_ROOT}/runs/${DEFAULT_EQUIPMENT_RUN_ID}`;
const PLAN_PATH = `${RUN_DIRECTORY}/plan.json`;
const ACTIVATION_PATH = `${RUN_DIRECTORY}/activation.json`;
const LOCK_PATH = `${EQUIPMENT_PRODUCTION_ROOT}/runs/.${DEFAULT_EQUIPMENT_RUN_ID}.activation.lock`;
const CREATED_AT = '2026-09-01T23:15:00.000Z';
const CHECKED_AT = '2026-09-01T23:18:00.000Z';
const ACTIVATED_AT = '2026-09-01T23:16:00.000Z';

interface MutableManifest {
	targets: Array<{ dependsOnTargetId: string | null }>;
}

const fixtureRoots: string[] = [];

function absolute(workspaceRoot: string, repositoryPath: string): string {
	return path.join(workspaceRoot, ...repositoryPath.split('/'));
}

async function makeFixture(): Promise<string> {
	const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'equipment-run-readiness-'));
	fixtureRoots.push(workspaceRoot);
	await cp(
		absolute(SOURCE_WORKSPACE_ROOT, EQUIPMENT_PRODUCTION_ROOT),
		absolute(workspaceRoot, EQUIPMENT_PRODUCTION_ROOT),
		{ recursive: true }
	);
	await mkdir(path.dirname(absolute(workspaceRoot, PROFILE_REFERENCE_PATH)), { recursive: true });
	await cp(
		absolute(SOURCE_WORKSPACE_ROOT, PROFILE_REFERENCE_PATH),
		absolute(workspaceRoot, PROFILE_REFERENCE_PATH)
	);
	return workspaceRoot;
}

async function readJson<T = Record<string, unknown>>(
	workspaceRoot: string,
	repositoryPath: string
): Promise<T> {
	return JSON.parse(await readFile(absolute(workspaceRoot, repositoryPath), 'utf8')) as T;
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

async function snapshotTree(workspaceRoot: string): Promise<string[]> {
	const entries: string[] = [];
	async function visit(absoluteDirectory: string, relativeDirectory: string): Promise<void> {
		for (const name of (await readdir(absoluteDirectory)).sort()) {
			const absolutePath = path.join(absoluteDirectory, name);
			const relativePath = path.posix.join(relativeDirectory, name);
			const metadata = await lstat(absolutePath);
			if (metadata.isSymbolicLink()) {
				entries.push(`link:${relativePath}`);
			} else if (metadata.isDirectory()) {
				entries.push(`directory:${relativePath}`);
				await visit(absolutePath, relativePath);
			} else {
				const hash = createHash('sha256')
					.update(await readFile(absolutePath))
					.digest('hex');
				entries.push(`file:${relativePath}:${hash}`);
			}
		}
	}
	await visit(workspaceRoot, '.');
	return entries;
}

async function readyReport(workspaceRoot: string) {
	return reportEquipmentRunReadiness({
		workspaceRoot,
		runId: DEFAULT_EQUIPMENT_RUN_ID,
		createdAt: CREATED_AT,
		checkedAt: CHECKED_AT
	});
}

async function activate(workspaceRoot: string) {
	return activateEquipmentRun({
		workspaceRoot,
		runId: DEFAULT_EQUIPMENT_RUN_ID,
		createdAt: CREATED_AT,
		activatedAt: ACTIVATED_AT,
		activatedBy: 'owner'
	});
}

async function firstRootPacketPaths(workspaceRoot: string): Promise<{
	targetPath: string;
	assignmentPath: string;
}> {
	const plan = await buildEquipmentRunPlan({
		workspaceRoot,
		runId: DEFAULT_EQUIPMENT_RUN_ID,
		createdAt: CREATED_AT
	});
	return plan.rootPackets[0]!;
}

afterEach(async () => {
	await Promise.all(
		fixtureRoots.splice(0).map((fixtureRoot) => rm(fixtureRoot, { recursive: true }))
	);
});

describe('Equipment immutable run readiness', () => {
	it('builds the exact immutable topology and reports readiness with zero filesystem writes', async () => {
		const workspaceRoot = await makeFixture();
		const before = await snapshotTree(workspaceRoot);
		const plan = EquipmentRunPlanSchema.parse(
			await buildEquipmentRunPlan({
				workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				createdAt: CREATED_AT
			})
		);
		const report = await readyReport(workspaceRoot);

		expect(report).toMatchObject({
			status: 'ready',
			writesPerformed: 0,
			summary: {
				totalJobs: 161,
				materializedRootJobs: 77,
				gatedPieceJobs: 84,
				armourReviewGates: 21,
				maximumConcurrency: 16
			}
		});
		expect(plan.targetIds).toHaveLength(161);
		expect(plan.rootPackets).toHaveLength(77);
		expect(plan.reviewGates).toHaveLength(21);
		expect(plan.unmaterializedReviewGatedTargetIds).toHaveLength(84);
		expect(plan.reservedPaths.candidates).toHaveLength(161);
		expect(plan.reservedPaths.results).toHaveLength(161);
		expect(plan.reservedPaths.reviews).toHaveLength(21);
		expect(plan.reservedPaths.runArtifacts).toEqual([PLAN_PATH, ACTIVATION_PATH]);
		expect(plan.versions).toEqual({
			contract: 'equipment-image-production-contract-v1',
			renderer: 'equipment-image-prompt-v1',
			verifier: 'equipment-image-result-verifier-v1',
			persistence: 'equipment-image-persistence-v1',
			journal: 'equipment-production-journal-v1'
		});
		const manifest = await readJson<{
			targets: Array<{
				targetId: string;
				dependsOnTargetId: string | null;
				output: { candidatePath: string; provenanceResultPath: string };
			}>;
		}>(workspaceRoot, `${EQUIPMENT_PRODUCTION_ROOT}/manifest.json`);
		const allocation = await readJson<{
			reviewGates: Array<{
				gateId: string;
				sourceTargetId: string;
				unlocksTargetIds: string[];
				evidencePath: string;
			}>;
		}>(workspaceRoot, `${EQUIPMENT_PRODUCTION_ROOT}/allocation-plan.json`);
		const profile = await readJson(
			workspaceRoot,
			`${EQUIPMENT_PRODUCTION_ROOT}/visual-profile/profile.json`
		);
		const acceptance = await readJson(
			workspaceRoot,
			`${EQUIPMENT_PRODUCTION_ROOT}/visual-profile/acceptance.json`
		);
		expect(plan.boundArtifacts).toEqual({
			manifestCanonicalSha256: canonicalJsonSha256(manifest),
			allocationCanonicalSha256: canonicalJsonSha256(allocation),
			profileCanonicalSha256: canonicalJsonSha256(profile),
			profileAcceptanceCanonicalSha256: canonicalJsonSha256(acceptance)
		});
		expect(plan.targetIds).toEqual(manifest.targets.map(({ targetId }) => targetId));
		expect(plan.unmaterializedReviewGatedTargetIds).toEqual(
			manifest.targets
				.filter(({ dependsOnTargetId }) => dependsOnTargetId !== null)
				.map(({ targetId }) => targetId)
		);
		expect(plan.reviewGates).toEqual(
			allocation.reviewGates.map(({ gateId, sourceTargetId, unlocksTargetIds, evidencePath }) => ({
				gateId,
				sourceTargetId,
				unlocksTargetIds,
				reviewPath: evidencePath
			}))
		);
		expect(plan.reservedPaths.candidates).toEqual(
			manifest.targets.map(({ output }) => output.candidatePath)
		);
		expect(plan.reservedPaths.results).toEqual(
			manifest.targets.map(({ output }) => output.provenanceResultPath)
		);
		for (const packet of plan.rootPackets) {
			expect(packet.targetCanonicalSha256).toBe(
				canonicalJsonSha256(await readJson(workspaceRoot, packet.targetPath))
			);
			expect(packet.assignmentCanonicalSha256).toBe(
				canonicalJsonSha256(await readJson(workspaceRoot, packet.assignmentPath))
			);
		}
		expect(new Set(plan.targetIds).size).toBe(161);
		expect(new Set(Object.values(plan.reservedPaths).flat()).size).toBe(345);
		expect(await snapshotTree(workspaceRoot)).toEqual(before);
	});

	it.each([
		['manifest', `${EQUIPMENT_PRODUCTION_ROOT}/manifest.json`],
		['allocation', `${EQUIPMENT_PRODUCTION_ROOT}/allocation-plan.json`],
		['profile', `${EQUIPMENT_PRODUCTION_ROOT}/visual-profile/profile.json`],
		['acceptance', `${EQUIPMENT_PRODUCTION_ROOT}/visual-profile/acceptance.json`]
	])('blocks a stale %s artifact without writing', async (_label, repositoryPath) => {
		const workspaceRoot = await makeFixture();
		const value = await readJson(workspaceRoot, repositoryPath);
		value.schemaVersion = `${value.schemaVersion}-stale`;
		await writeJson(workspaceRoot, repositoryPath, value);
		const before = await snapshotTree(workspaceRoot);

		const report = await readyReport(workspaceRoot);

		expect(report.status).toBe('blocked');
		expect(report.writesPerformed).toBe(0);
		expect(report.blockers).not.toHaveLength(0);
		expect(await snapshotTree(workspaceRoot)).toEqual(before);
	});

	it('blocks stale packet hashes and stale packet paths', async () => {
		for (const mutation of ['hash', 'path'] as const) {
			const workspaceRoot = await makeFixture();
			const { targetPath } = await firstRootPacketPaths(workspaceRoot);
			const target = await readJson<{
				manifestCanonicalSha256: string;
				output: { candidatePath: string };
			}>(workspaceRoot, targetPath);
			if (mutation === 'hash') target.manifestCanonicalSha256 = '0'.repeat(64);
			else target.output.candidatePath = target.output.candidatePath.replace('.png', '-stale.png');
			await writeJson(workspaceRoot, targetPath, target);
			const before = await snapshotTree(workspaceRoot);

			const report = await readyReport(workspaceRoot);

			expect(report.status).toBe('blocked');
			expect(report.writesPerformed).toBe(0);
			expect(await snapshotTree(workspaceRoot)).toEqual(before);
		}
	});

	it('blocks duplicate packet output reservations', async () => {
		const workspaceRoot = await makeFixture();
		const plan = await buildEquipmentRunPlan({
			workspaceRoot,
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			createdAt: CREATED_AT
		});
		const first = plan.rootPackets[0]!;
		const second = plan.rootPackets[1]!;
		const firstTarget = await readJson<{ output: { candidatePath: string; resultPath: string } }>(
			workspaceRoot,
			first.targetPath
		);
		const secondTarget = await readJson<{ output: { candidatePath: string; resultPath: string } }>(
			workspaceRoot,
			second.targetPath
		);
		const secondAssignment = await readJson<{
			permittedOutputs: { candidatePath: string; resultPath: string };
		}>(workspaceRoot, second.assignmentPath);
		secondTarget.output = firstTarget.output;
		secondAssignment.permittedOutputs = firstTarget.output;
		await writeJson(workspaceRoot, second.targetPath, secondTarget);
		await writeJson(workspaceRoot, second.assignmentPath, secondAssignment);

		const report = await readyReport(workspaceRoot);

		expect(report.status).toBe('blocked');
		expect(report.blockers.some(({ message }) => /packet|path|output/iu.test(message))).toBe(true);
	});

	it.each([
		['unexpected complete output', true, true],
		['partial candidate output', true, false],
		['partial result output', false, true]
	])('blocks %s', async (_label, candidateExists, resultExists) => {
		const workspaceRoot = await makeFixture();
		const plan = await buildEquipmentRunPlan({
			workspaceRoot,
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			createdAt: CREATED_AT
		});
		const candidatePath = plan.reservedPaths.candidates[0]!;
		const resultPath = plan.reservedPaths.results[0]!;
		if (candidateExists) {
			await mkdir(path.dirname(absolute(workspaceRoot, candidatePath)), { recursive: true });
			await writeFile(absolute(workspaceRoot, candidatePath), 'unexpected candidate');
		}
		if (resultExists) await writeJson(workspaceRoot, resultPath, { unexpected: true });
		const before = await snapshotTree(workspaceRoot);

		const report = await readyReport(workspaceRoot);

		expect(report.status).toBe('blocked');
		expect(report.writesPerformed).toBe(0);
		expect(report.blockers.some(({ message }) => /output/iu.test(message))).toBe(true);
		expect(await snapshotTree(workspaceRoot)).toEqual(before);
	});

	it('blocks a symbolic-link artifact without following it or writing', async () => {
		const workspaceRoot = await makeFixture();
		const { assignmentPath } = await firstRootPacketPaths(workspaceRoot);
		const assignmentAbsolute = absolute(workspaceRoot, assignmentPath);
		const savedAbsolute = `${assignmentAbsolute}.saved`;
		await cp(assignmentAbsolute, savedAbsolute);
		await unlink(assignmentAbsolute);
		await symlink(path.basename(savedAbsolute), assignmentAbsolute);
		const before = await snapshotTree(workspaceRoot);

		const report = await readyReport(workspaceRoot);

		expect(report.status).toBe('blocked');
		expect(report.blockers.some(({ message }) => /symbolic/iu.test(message))).toBe(true);
		expect(await snapshotTree(workspaceRoot)).toEqual(before);
	});

	it('blocks a missing target or assignment packet', async () => {
		for (const kind of ['targetPath', 'assignmentPath'] as const) {
			const workspaceRoot = await makeFixture();
			const packet = await firstRootPacketPaths(workspaceRoot);
			await unlink(absolute(workspaceRoot, packet[kind]));

			const report = await readyReport(workspaceRoot);

			expect(report.status).toBe('blocked');
			expect(report.blockers.some(({ message }) => /packet|missing/iu.test(message))).toBe(true);
		}
	});

	it.each([
		['77 root jobs', (manifest: MutableManifest) => manifest.targets.shift()],
		[
			'84 gated jobs',
			(manifest: MutableManifest) => {
				const index = manifest.targets.findIndex((target) => target.dependsOnTargetId !== null);
				manifest.targets.splice(index, 1);
			}
		]
	])('blocks a manifest with the wrong %s topology', async (_label, mutate) => {
		const workspaceRoot = await makeFixture();
		const manifestPath = `${EQUIPMENT_PRODUCTION_ROOT}/manifest.json`;
		const manifest = await readJson<MutableManifest>(workspaceRoot, manifestPath);
		mutate(manifest);
		await writeJson(workspaceRoot, manifestPath, manifest);

		const report = await readyReport(workspaceRoot);

		expect(report.status).toBe('blocked');
		expect(report.writesPerformed).toBe(0);
	});

	it('treats a persisted plan without its receipt as incomplete activation evidence', async () => {
		const workspaceRoot = await makeFixture();
		const plan = await buildEquipmentRunPlan({
			workspaceRoot,
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			createdAt: CREATED_AT
		});
		await writeJson(workspaceRoot, PLAN_PATH, plan);
		const before = await snapshotTree(workspaceRoot);

		const report = await readyReport(workspaceRoot);

		expect(report.status).toBe('blocked');
		expect(report.blockers.some(({ message }) => /incomplete activation/iu.test(message))).toBe(
			true
		);
		expect(await snapshotTree(workspaceRoot)).toEqual(before);
	});

	it('blocks an activation without a plan and a hash-mismatched activation pair', async () => {
		for (const state of ['activation-only', 'mismatched-pair'] as const) {
			const workspaceRoot = await makeFixture();
			const plan = await buildEquipmentRunPlan({
				workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				createdAt: CREATED_AT
			});
			if (state === 'mismatched-pair') await writeJson(workspaceRoot, PLAN_PATH, plan);
			await writeJson(workspaceRoot, ACTIVATION_PATH, {
				schemaVersion: 'equipment-production-run-activation-v1',
				activationId: `${DEFAULT_EQUIPMENT_RUN_ID}-activation`,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				runPlanCanonicalSha256: '0'.repeat(64),
				activatedAt: ACTIVATED_AT,
				activatedBy: 'owner'
			});

			const report = await readyReport(workspaceRoot);

			expect(report.status).toBe('blocked');
			expect(report.blockers.some(({ message }) => /activation/iu.test(message))).toBe(true);
		}
	});

	it('activates plan-first and receipt-last, then verifies the exact immutable pair', async () => {
		const workspaceRoot = await makeFixture();

		const result = await activate(workspaceRoot);
		const persistedPlan = EquipmentRunPlanSchema.parse(await readJson(workspaceRoot, PLAN_PATH));
		const persistedActivation = EquipmentRunActivationSchema.parse(
			await readJson(workspaceRoot, ACTIVATION_PATH)
		);

		expect(result).toMatchObject({
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			planPath: PLAN_PATH,
			activationPath: ACTIVATION_PATH,
			writesPerformed: 2
		});
		expect(persistedPlan.createdAt).toBe(CREATED_AT);
		expect(persistedActivation).toEqual({
			schemaVersion: 'equipment-production-run-activation-v1',
			activationId: `${DEFAULT_EQUIPMENT_RUN_ID}-activation`,
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			runPlanCanonicalSha256: canonicalJsonSha256(persistedPlan),
			activatedAt: ACTIVATED_AT,
			activatedBy: 'owner'
		});
		await expect(lstat(absolute(workspaceRoot, LOCK_PATH))).rejects.toMatchObject({
			code: 'ENOENT'
		});
		await expect(readyReport(workspaceRoot)).resolves.toMatchObject({ status: 'ready' });
		const beforeRetry = await snapshotTree(workspaceRoot);
		await expect(activate(workspaceRoot)).rejects.toThrow(/collision/iu);
		expect(await snapshotTree(workspaceRoot)).toEqual(beforeRetry);
	});

	it('never overwrites or automatically cleans ambiguous activation evidence', async () => {
		const workspaceRoot = await makeFixture();
		const plan = await buildEquipmentRunPlan({
			workspaceRoot,
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			createdAt: CREATED_AT
		});
		await writeJson(workspaceRoot, PLAN_PATH, plan);
		const before = await snapshotTree(workspaceRoot);

		await expect(activate(workspaceRoot)).rejects.toThrow(/readiness|incomplete activation/iu);

		expect(await snapshotTree(workspaceRoot)).toEqual(before);
	});

	it('keeps a verified plan when receipt creation fails and then reports incomplete activation', async () => {
		const workspaceRoot = await makeFixture();

		await expect(
			activateEquipmentRun({
				workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				createdAt: CREATED_AT,
				activatedAt: ACTIVATED_AT,
				activatedBy: ''
			})
		).rejects.toThrow();

		await expect(lstat(absolute(workspaceRoot, PLAN_PATH))).resolves.toMatchObject({});
		await expect(lstat(absolute(workspaceRoot, ACTIVATION_PATH))).rejects.toMatchObject({
			code: 'ENOENT'
		});
		await expect(lstat(absolute(workspaceRoot, LOCK_PATH))).rejects.toMatchObject({
			code: 'ENOENT'
		});
		await expect(readyReport(workspaceRoot)).resolves.toMatchObject({
			status: 'blocked',
			writesPerformed: 0,
			blockers: [{ code: 'incomplete-activation' }]
		});
	});

	it('uses an exclusive short-lived activation lock and preserves a lock it did not create', async () => {
		const workspaceRoot = await makeFixture();
		await writeJson(workspaceRoot, LOCK_PATH, { owner: 'other-activator' });
		const before = await snapshotTree(workspaceRoot);

		await expect(activate(workspaceRoot)).rejects.toThrow(/lock|collision/iu);

		expect(await snapshotTree(workspaceRoot)).toEqual(before);
	});

	it('exposes zero-write readiness and fixture-only activation through the CLI', async () => {
		const workspaceRoot = await makeFixture();
		const before = await snapshotTree(workspaceRoot);
		const report = await runEquipmentImageProductionCli({
			workspaceRoot,
			args: [
				'report-readiness',
				'--run-id',
				DEFAULT_EQUIPMENT_RUN_ID,
				'--created-at',
				CREATED_AT,
				'--checked-at',
				CHECKED_AT
			]
		});
		expect(report).toMatchObject({
			command: 'report-readiness',
			status: 'ready',
			writesPerformed: 0
		});
		expect(await snapshotTree(workspaceRoot)).toEqual(before);

		const activation = await runEquipmentImageProductionCli({
			workspaceRoot,
			args: [
				'activate-run',
				'--run-id',
				DEFAULT_EQUIPMENT_RUN_ID,
				'--created-at',
				CREATED_AT,
				'--activated-at',
				ACTIVATED_AT,
				'--activated-by',
				'owner'
			]
		});
		expect(activation).toMatchObject({ command: 'activate-run', writesPerformed: 2 });
	});
});
