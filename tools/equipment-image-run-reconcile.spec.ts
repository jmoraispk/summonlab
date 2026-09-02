import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
	EQUIPMENT_PRODUCTION_ROOT,
	type EquipmentImageAssignment,
	type EquipmentImageTarget
} from './equipment-image-production-contract.js';
import { canonicalJsonSha256, renderEquipmentPrompt } from './equipment-image-packets.js';
import { runEquipmentImageProductionCli } from './equipment-image-production.js';
import { reconcileEquipmentRun } from './equipment-image-run-reconcile.js';
import { claimNextEquipmentJobs, recordEquipmentRunEvent } from './equipment-image-run-recorder.js';
import { DEFAULT_EQUIPMENT_RUN_ID, activateEquipmentRun } from './equipment-image-run-readiness.js';

const SOURCE_WORKSPACE_ROOT = process.cwd();
const PROFILE_REFERENCE_PATH =
	'assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png';
const RUN_DIRECTORY = `${EQUIPMENT_PRODUCTION_ROOT}/runs/${DEFAULT_EQUIPMENT_RUN_ID}`;
const EVENTS_DIRECTORY = `${RUN_DIRECTORY}/events`;
const CREATED_AT = '2026-09-01T23:15:00.000Z';
const ACTIVATED_AT = '2026-09-01T23:16:00.000Z';
const fixtureRoots: string[] = [];

function absolute(workspaceRoot: string, repositoryPath: string): string {
	return path.join(workspaceRoot, ...repositoryPath.split('/'));
}

function sha256(bytes: string | Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function writeRepositoryFile(
	workspaceRoot: string,
	repositoryPath: string,
	bytes: string | Uint8Array
): Promise<void> {
	const destination = absolute(workspaceRoot, repositoryPath);
	await mkdir(path.dirname(destination), { recursive: true });
	await writeFile(destination, bytes);
}

async function makeStartedFixture() {
	const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'equipment-reconcile-'));
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
	await activateEquipmentRun({
		workspaceRoot,
		runId: DEFAULT_EQUIPMENT_RUN_ID,
		createdAt: CREATED_AT,
		activatedAt: ACTIVATED_AT,
		activatedBy: 'owner'
	});
	const [claim] = await claimNextEquipmentJobs({
		workspaceRoot,
		runId: DEFAULT_EQUIPMENT_RUN_ID,
		availableWorkerSlots: 1,
		epochId: 'epoch-one',
		actor: 'root-orchestrator',
		requestedAt: '2026-09-02T00:00:00.000Z',
		recordedAt: '2026-09-02T00:00:01.000Z',
		lockOwnerId: 'root-orchestrator-claim-controller'
	});
	if (claim === undefined) throw new Error('Expected one fixture claim');
	await recordEquipmentRunEvent({
		workspaceRoot,
		runId: DEFAULT_EQUIPMENT_RUN_ID,
		request: {
			schemaVersion: 'equipment-production-event-request-v1',
			eventId: 'worker-started-one',
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			requestedAt: '2026-09-02T00:01:00.000Z',
			actor: 'root-orchestrator',
			kind: 'worker-started',
			claimId: claim.claimId,
			targetId: claim.targetId,
			workerId: claim.workerId
		},
		recordedAt: '2026-09-02T00:01:01.000Z',
		lockOwnerId: 'root-orchestrator-start-controller'
	});
	const target = JSON.parse(
		await readFile(absolute(workspaceRoot, claim.targetPath), 'utf8')
	) as EquipmentImageTarget;
	const assignment = JSON.parse(
		await readFile(absolute(workspaceRoot, claim.assignmentPath), 'utf8')
	) as EquipmentImageAssignment;
	return { workspaceRoot, claim, target, assignment };
}

async function materializeCandidateAndResult(
	fixture: Awaited<ReturnType<typeof makeStartedFixture>>
): Promise<void> {
	const candidateBytes = await sharp({
		create: {
			width: fixture.target.presentation.canvas.width,
			height: fixture.target.presentation.canvas.height,
			channels: 4,
			background: { r: 44, g: 30, b: 22, alpha: 1 }
		}
	})
		.png()
		.toBuffer();
	const candidateSha256 = sha256(candidateBytes);
	const result = {
		schemaVersion: 'equipment-image-result-v1',
		resultId: `result-${fixture.target.targetId}`,
		targetId: fixture.target.targetId,
		assignmentId: fixture.assignment.assignmentId,
		status: 'candidate',
		promptSha256: sha256(renderEquipmentPrompt(fixture.target)),
		referenceInputs: fixture.target.references.map(({ path: referencePath, contentHash }) => ({
			path: referencePath,
			contentHash
		})),
		attempts: [
			{
				attemptId: `attempt-${fixture.target.targetId}`,
				attemptNumber: 1,
				sourceOutputId: `imagegen-output-${fixture.target.targetId}`,
				requestStartedAt: '2026-09-02T00:01:02.000Z',
				generationCompletedAt: '2026-09-02T00:01:03.000Z',
				inspectionCompletedAt: '2026-09-02T00:01:04.000Z'
			}
		],
		findings: fixture.target.acceptanceCriteria.map(({ criterionId }) => ({
			criterionId,
			outcome: 'pass',
			observation: `Inspected ${criterionId}.`
		})),
		candidate: {
			path: fixture.target.output.candidatePath,
			mediaType: 'image/png',
			width: fixture.target.presentation.canvas.width,
			height: fixture.target.presentation.canvas.height,
			bytes: candidateBytes.byteLength,
			sha256: candidateSha256
		},
		candidateSha256,
		startedAt: '2026-09-02T00:01:02.000Z',
		completedAt: '2026-09-02T00:01:05.000Z',
		writtenOutputPaths: [fixture.target.output.candidatePath, fixture.target.output.resultPath],
		noSharedFilesEdited: true,
		selfPromoted: false
	};
	await Promise.all([
		writeRepositoryFile(fixture.workspaceRoot, fixture.target.output.candidatePath, candidateBytes),
		writeRepositoryFile(
			fixture.workspaceRoot,
			fixture.target.output.resultPath,
			`${JSON.stringify(result, null, '\t')}\n`
		)
	]);
}

async function eventNames(workspaceRoot: string): Promise<string[]> {
	return (await readdir(absolute(workspaceRoot, EVENTS_DIRECTORY))).sort();
}

async function readResult(fixture: Awaited<ReturnType<typeof makeStartedFixture>>) {
	return JSON.parse(
		await readFile(absolute(fixture.workspaceRoot, fixture.target.output.resultPath), 'utf8')
	) as Record<string, unknown>;
}

afterEach(async () => {
	await Promise.all(
		fixtureRoots.splice(0).map((fixtureRoot) => rm(fixtureRoot, { recursive: true, force: true }))
	);
});

describe('Equipment run reconciliation', () => {
	it('requires one authorized append for a verified candidate and result pair', async () => {
		const fixture = await makeStartedFixture();
		await materializeCandidateAndResult(fixture);
		const beforeEvents = await eventNames(fixture.workspaceRoot);

		const reconciliation = await reconcileEquipmentRun({
			workspaceRoot: fixture.workspaceRoot,
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			targetId: fixture.claim.targetId,
			workerId: fixture.claim.workerId,
			observedAt: '2026-09-20T00:00:00.000Z'
		});

		expect(reconciliation).toMatchObject({
			action: 'append-terminal-event',
			writesRequired: 1,
			writesPerformed: 0,
			terminalStatus: 'candidate'
		});
		expect(await eventNames(fixture.workspaceRoot)).toEqual(beforeEvents);
	});

	it.each([
		['candidate without result', true, false],
		['result without candidate', false, true]
	] as const)('blocks %s without writing', async (_label, candidateExists, resultExists) => {
		const fixture = await makeStartedFixture();
		await materializeCandidateAndResult(fixture);
		if (!candidateExists)
			await rm(absolute(fixture.workspaceRoot, fixture.target.output.candidatePath));
		if (!resultExists) await rm(absolute(fixture.workspaceRoot, fixture.target.output.resultPath));
		const beforeEvents = await eventNames(fixture.workspaceRoot);

		await expect(
			reconcileEquipmentRun({
				workspaceRoot: fixture.workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				targetId: fixture.claim.targetId,
				workerId: fixture.claim.workerId,
				observedAt: '2026-09-20T00:00:00.000Z'
			})
		).resolves.toMatchObject({
			action: 'blocked-partial-output',
			writesRequired: 0,
			writesPerformed: 0
		});
		expect(await eventNames(fixture.workspaceRoot)).toEqual(beforeEvents);
	});

	it('never time-reaps an active started worker', async () => {
		const fixture = await makeStartedFixture();
		const beforeEvents = await eventNames(fixture.workspaceRoot);

		await expect(
			reconcileEquipmentRun({
				workspaceRoot: fixture.workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				targetId: fixture.claim.targetId,
				workerId: fixture.claim.workerId,
				observedAt: '2036-09-20T00:00:00.000Z'
			})
		).resolves.toMatchObject({
			action: 'preserve-active-worker',
			writesRequired: 0,
			writesPerformed: 0
		});
		expect(await eventNames(fixture.workspaceRoot)).toEqual(beforeEvents);
	});

	it('requires exact acknowledged operator failure evidence and appends rather than deleting', async () => {
		const fixture = await makeStartedFixture();
		for (const operatorConfirmedFailure of [
			{
				targetId: 'material-equipment-v1-copper-dagger-v1',
				workerId: fixture.claim.workerId,
				reason: 'Worker process was confirmed lost.',
				acknowledged: true
			},
			{
				targetId: fixture.claim.targetId,
				workerId: 'equipment-worker-wrong',
				reason: 'Worker process was confirmed lost.',
				acknowledged: true
			},
			{
				targetId: fixture.claim.targetId,
				workerId: fixture.claim.workerId,
				reason: '',
				acknowledged: true
			},
			{
				targetId: fixture.claim.targetId,
				workerId: fixture.claim.workerId,
				reason: 'Worker process was confirmed lost.',
				acknowledged: false
			}
		]) {
			await expect(
				reconcileEquipmentRun({
					workspaceRoot: fixture.workspaceRoot,
					runId: DEFAULT_EQUIPMENT_RUN_ID,
					targetId: fixture.claim.targetId,
					workerId: fixture.claim.workerId,
					observedAt: '2026-09-02T00:10:00.000Z',
					operatorConfirmedFailure
				})
			).rejects.toThrow(/exact|reason|acknowledge/iu);
		}

		const result = await reconcileEquipmentRun({
			workspaceRoot: fixture.workspaceRoot,
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			targetId: fixture.claim.targetId,
			workerId: fixture.claim.workerId,
			observedAt: '2026-09-02T00:10:00.000Z',
			operatorConfirmedFailure: {
				targetId: fixture.claim.targetId,
				workerId: fixture.claim.workerId,
				reason: 'Worker process was confirmed lost.',
				acknowledged: true,
				eventId: 'operator-confirmed-failure-one',
				operator: 'owner',
				confirmedAt: '2026-09-02T00:10:00.000Z',
				recordedAt: '2026-09-02T00:10:01.000Z'
			}
		});

		expect(result).toMatchObject({
			action: 'append-operator-confirmed-failure',
			writesRequired: 1,
			writesPerformed: 1,
			terminalStatus: 'failed',
			operatorFailureReason: 'Worker process was confirmed lost.'
		});
		expect(result.event).toMatchObject({
			request: {
				targetId: fixture.claim.targetId,
				workerId: fixture.claim.workerId,
				failureKind: 'operator-confirmed'
			}
		});
		expect(
			await readFile(absolute(fixture.workspaceRoot, `${RUN_DIRECTORY}/plan.json`))
		).toBeTruthy();
		expect(await eventNames(fixture.workspaceRoot)).toHaveLength(4);
	});

	it('appends an authorized verified terminal event exactly once', async () => {
		const fixture = await makeStartedFixture();
		await materializeCandidateAndResult(fixture);
		const resultValue = await readResult(fixture);
		const dry = await reconcileEquipmentRun({
			workspaceRoot: fixture.workspaceRoot,
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			targetId: fixture.claim.targetId,
			workerId: fixture.claim.workerId,
			observedAt: '2026-09-02T00:09:00.000Z'
		});
		if (dry.action !== 'append-terminal-event') throw new Error('Expected dry terminal append');

		const result = await reconcileEquipmentRun({
			workspaceRoot: fixture.workspaceRoot,
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			targetId: fixture.claim.targetId,
			workerId: fixture.claim.workerId,
			observedAt: '2026-09-02T00:10:00.000Z',
			terminalAuthorization: {
				acknowledged: true,
				expectedTerminalStatus: dry.terminalStatus,
				expectedResultCanonicalSha256: dry.resultCanonicalSha256,
				eventId: 'reconciled-terminal-one',
				actor: 'root-orchestrator',
				requestedAt: '2026-09-02T00:10:00.000Z',
				recordedAt: '2026-09-02T00:10:01.000Z'
			}
		});

		expect(result).toMatchObject({
			action: 'append-terminal-event',
			writesRequired: 1,
			writesPerformed: 1,
			resultCanonicalSha256: canonicalJsonSha256(resultValue)
		});
		expect(await eventNames(fixture.workspaceRoot)).toHaveLength(4);
	});

	it('rejects candidate-to-revise drift from the dry reconciliation authorization', async () => {
		const fixture = await makeStartedFixture();
		await materializeCandidateAndResult(fixture);
		const dry = await reconcileEquipmentRun({
			workspaceRoot: fixture.workspaceRoot,
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			targetId: fixture.claim.targetId,
			workerId: fixture.claim.workerId,
			observedAt: '2026-09-02T00:09:00.000Z'
		});
		if (dry.action !== 'append-terminal-event') throw new Error('Expected dry terminal append');
		const candidateResult = await readResult(fixture);
		const findings = candidateResult.findings as Array<Record<string, unknown>>;
		const revisedResult = {
			...candidateResult,
			status: 'revise',
			findings: findings.map((finding, index) =>
				index === 0 ? { ...finding, outcome: 'concern' } : finding
			)
		};
		await writeRepositoryFile(
			fixture.workspaceRoot,
			fixture.target.output.resultPath,
			`${JSON.stringify(revisedResult, null, '\t')}\n`
		);
		const beforeEvents = await eventNames(fixture.workspaceRoot);

		await expect(
			reconcileEquipmentRun({
				workspaceRoot: fixture.workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				targetId: fixture.claim.targetId,
				workerId: fixture.claim.workerId,
				observedAt: '2026-09-02T00:10:00.000Z',
				terminalAuthorization: {
					acknowledged: true,
					expectedTerminalStatus: dry.terminalStatus,
					expectedResultCanonicalSha256: dry.resultCanonicalSha256,
					eventId: 'reconciled-terminal-drift',
					actor: 'root-orchestrator',
					requestedAt: '2026-09-02T00:10:00.000Z',
					recordedAt: '2026-09-02T00:10:01.000Z'
				}
			})
		).rejects.toThrow(/expected terminal status|authorization/iu);
		expect(await eventNames(fixture.workspaceRoot)).toEqual(beforeEvents);
	});

	it('rejects result-hash drift between dry and authorized reconciliation without an append', async () => {
		const fixture = await makeStartedFixture();
		await materializeCandidateAndResult(fixture);
		const dry = await reconcileEquipmentRun({
			workspaceRoot: fixture.workspaceRoot,
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			targetId: fixture.claim.targetId,
			workerId: fixture.claim.workerId,
			observedAt: '2026-09-02T00:09:00.000Z'
		});
		if (dry.action !== 'append-terminal-event') throw new Error('Expected dry terminal append');
		const beforeEvents = await eventNames(fixture.workspaceRoot);
		const changed = {
			...(await readResult(fixture)),
			resultId: `changed-${fixture.target.targetId}`
		};
		await writeRepositoryFile(
			fixture.workspaceRoot,
			fixture.target.output.resultPath,
			`${JSON.stringify(changed, null, '\t')}\n`
		);

		await expect(
			reconcileEquipmentRun({
				workspaceRoot: fixture.workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				targetId: fixture.claim.targetId,
				workerId: fixture.claim.workerId,
				observedAt: '2026-09-02T00:10:00.000Z',
				terminalAuthorization: {
					acknowledged: true,
					expectedTerminalStatus: dry.terminalStatus,
					expectedResultCanonicalSha256: dry.resultCanonicalSha256,
					eventId: 'reconciled-terminal-locked-drift',
					actor: 'root-orchestrator',
					requestedAt: '2026-09-02T00:10:00.000Z',
					recordedAt: '2026-09-02T00:10:01.000Z'
				}
			})
		).rejects.toThrow(/result canonical SHA-256|authorization/iu);
		expect(await eventNames(fixture.workspaceRoot)).toEqual(beforeEvents);
	});

	it('rejects incomplete, mixed, or metadata-only reconcile CLI modes before reconciliation', async () => {
		const common = [
			'reconcile',
			'--target-id',
			'material-equipment-v1-copper-sword-v1',
			'--worker-id',
			'equipment-worker-2',
			'--observed-at',
			'2026-09-02T00:10:00.000Z'
		] as const;
		for (const extra of [
			['--acknowledge-terminal', 'yes'],
			['--event-id', 'metadata-without-mode'],
			[
				'--acknowledge-terminal',
				'yes',
				'--expected-terminal-status',
				'candidate',
				'--expected-result-canonical-sha256',
				'0'.repeat(64),
				'--operator-confirmed-failure-reason',
				'Worker lost.',
				'--acknowledge-operator-confirmed-failure',
				'yes'
			],
			[
				'--operator-confirmed-failure-reason',
				'Worker lost.',
				'--acknowledge-operator-confirmed-failure',
				'yes',
				'--expected-terminal-status',
				'candidate'
			]
		]) {
			await expect(
				runEquipmentImageProductionCli({
					workspaceRoot: '/definitely-not-a-workspace',
					args: [...common, ...extra]
				})
			).rejects.toThrow(/exactly one complete reconciliation mode/iu);
		}
	});

	it('accepts the exact complete terminal CLI mode reported by dry reconciliation', async () => {
		const fixture = await makeStartedFixture();
		await materializeCandidateAndResult(fixture);
		const dry = await runEquipmentImageProductionCli({
			workspaceRoot: fixture.workspaceRoot,
			args: [
				'reconcile',
				'--target-id',
				fixture.claim.targetId,
				'--worker-id',
				fixture.claim.workerId,
				'--observed-at',
				'2026-09-02T00:09:00.000Z'
			]
		});
		expect(dry).toMatchObject({
			command: 'reconcile',
			action: 'append-terminal-event',
			writesPerformed: 0
		});

		await expect(
			runEquipmentImageProductionCli({
				workspaceRoot: fixture.workspaceRoot,
				args: [
					'reconcile',
					'--target-id',
					fixture.claim.targetId,
					'--worker-id',
					fixture.claim.workerId,
					'--observed-at',
					'2026-09-02T00:10:00.000Z',
					'--event-id',
					'reconciled-terminal-cli',
					'--actor',
					'root-orchestrator',
					'--requested-at',
					'2026-09-02T00:10:00.000Z',
					'--recorded-at',
					'2026-09-02T00:10:01.000Z',
					'--acknowledge-terminal',
					'yes',
					'--expected-terminal-status',
					String(dry.terminalStatus),
					'--expected-result-canonical-sha256',
					String(dry.resultCanonicalSha256)
				]
			})
		).resolves.toMatchObject({
			command: 'reconcile',
			action: 'append-terminal-event',
			writesPerformed: 1
		});
	});
});
