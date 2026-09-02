import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
	EQUIPMENT_PRODUCTION_ROOT,
	EquipmentRunActivationSchema,
	EquipmentRunPlanSchema,
	type EquipmentImageTarget
} from './equipment-image-production-contract.js';
import { canonicalJsonSha256, renderEquipmentPrompt } from './equipment-image-packets.js';
import { runEquipmentImageProductionCli } from './equipment-image-production.js';
import { persistEquipmentImageResult } from './equipment-image-result.js';
import { activateEquipmentRun, DEFAULT_EQUIPMENT_RUN_ID } from './equipment-image-run-readiness.js';
import {
	claimNextEquipmentJobs,
	recordEquipmentRunEvent,
	recordVerifiedEquipmentRunTerminal
} from './equipment-image-run-recorder.js';
import {
	buildArmourSourceReviewReceipt,
	materializeDependentArmourPackets,
	verifyArmourSourceReviewReceipt
} from './equipment-armour-review.js';

const SOURCE_WORKSPACE_ROOT = process.cwd();
const PROFILE_REFERENCE_PATH =
	'assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png';
const RUN_DIRECTORY = `${EQUIPMENT_PRODUCTION_ROOT}/runs/${DEFAULT_EQUIPMENT_RUN_ID}`;
const PLAN_PATH = `${RUN_DIRECTORY}/plan.json`;
const ACTIVATION_PATH = `${RUN_DIRECTORY}/activation.json`;
const CREATED_AT = '2026-09-01T23:15:00.000Z';
const ACTIVATED_AT = '2026-09-01T23:16:00.000Z';
const REVIEWED_AT = '2026-09-02T00:07:00.000Z';
const REVIEWER = 'equipment-art-director';
const GATE_ID = 'material-equipment-v1-copper-heavy-armour-full-set-v1-review-pass';

const fixtureRoots: string[] = [];

function absolute(workspaceRoot: string, repositoryPath: string): string {
	return path.join(workspaceRoot, ...repositoryPath.split('/'));
}

function sha256(bytes: string | Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function readJson<T>(workspaceRoot: string, repositoryPath: string): Promise<T> {
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

async function makeWorkspace(): Promise<string> {
	const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'equipment-armour-review-'));
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

function candidateResult(input: {
	readonly target: EquipmentImageTarget;
	readonly assignmentId: string;
	readonly candidateBytes: Buffer;
}) {
	const candidateSha256 = sha256(input.candidateBytes);
	return {
		schemaVersion: 'equipment-image-result-v1' as const,
		resultId: `result-${input.target.targetId}`,
		targetId: input.target.targetId,
		assignmentId: input.assignmentId,
		status: 'candidate' as const,
		promptSha256: sha256(renderEquipmentPrompt(input.target)),
		referenceInputs: input.target.references.map(({ path: referencePath, contentHash }) => ({
			path: referencePath,
			contentHash
		})),
		attempts: [
			{
				attemptId: `attempt-${input.target.targetId}`,
				attemptNumber: 1 as const,
				sourceOutputId: `imagegen-output-${input.target.targetId}`,
				requestStartedAt: '2026-09-02T00:02:00.000Z',
				generationCompletedAt: '2026-09-02T00:03:00.000Z',
				inspectionCompletedAt: '2026-09-02T00:04:00.000Z'
			}
		],
		findings: input.target.acceptanceCriteria.map(({ criterionId }) => ({
			criterionId,
			outcome: 'pass' as const,
			observation: `Inspected ${criterionId}.`
		})),
		candidate: {
			path: input.target.output.candidatePath,
			mediaType: 'image/png' as const,
			width: input.target.presentation.canvas.width,
			height: input.target.presentation.canvas.height,
			bytes: input.candidateBytes.byteLength,
			sha256: candidateSha256
		},
		candidateSha256,
		startedAt: '2026-09-02T00:01:59.000Z',
		completedAt: '2026-09-02T00:05:00.000Z',
		writtenOutputPaths: [input.target.output.candidatePath, input.target.output.resultPath],
		noSharedFilesEdited: true as const,
		selfPromoted: false as const
	};
}

async function makeCandidateFixture() {
	const workspaceRoot = await makeWorkspace();
	await activateEquipmentRun({
		workspaceRoot,
		runId: DEFAULT_EQUIPMENT_RUN_ID,
		createdAt: CREATED_AT,
		activatedAt: ACTIVATED_AT,
		activatedBy: 'owner'
	});
	const claims = await claimNextEquipmentJobs({
		workspaceRoot,
		runId: DEFAULT_EQUIPMENT_RUN_ID,
		availableWorkerSlots: 7,
		epochId: 'epoch-one',
		actor: 'root-orchestrator',
		requestedAt: '2026-09-02T00:00:00.000Z',
		recordedAt: '2026-09-02T00:00:01.000Z',
		lockOwnerId: 'root-orchestrator-claim-controller'
	});
	const sourceClaim = claims.find(({ targetId }) => targetId.includes('heavy-armour-full-set'))!;
	await recordEquipmentRunEvent({
		workspaceRoot,
		runId: DEFAULT_EQUIPMENT_RUN_ID,
		request: {
			schemaVersion: 'equipment-production-event-request-v1',
			eventId: 'copper-heavy-armour-worker-started',
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			requestedAt: '2026-09-02T00:01:00.000Z',
			actor: 'root-orchestrator',
			kind: 'worker-started',
			claimId: sourceClaim.claimId,
			targetId: sourceClaim.targetId,
			workerId: sourceClaim.workerId
		},
		recordedAt: '2026-09-02T00:01:01.000Z',
		lockOwnerId: 'root-orchestrator-start-controller'
	});
	const target = await readJson<EquipmentImageTarget>(workspaceRoot, sourceClaim.targetPath);
	const assignment = await readJson<{ assignmentId: string }>(
		workspaceRoot,
		sourceClaim.assignmentPath
	);
	const candidateBytes = await sharp({
		create: {
			width: target.presentation.canvas.width,
			height: target.presentation.canvas.height,
			channels: 4,
			background: { r: 114, g: 71, b: 48, alpha: 1 }
		}
	})
		.png()
		.toBuffer();
	await mkdir(path.dirname(absolute(workspaceRoot, target.output.candidatePath)), {
		recursive: true
	});
	await writeFile(absolute(workspaceRoot, target.output.candidatePath), candidateBytes);
	const result = candidateResult({ target, assignmentId: assignment.assignmentId, candidateBytes });
	await persistEquipmentImageResult({
		workspaceRoot,
		targetPath: sourceClaim.targetPath,
		assignmentPath: sourceClaim.assignmentPath,
		result
	});
	await recordVerifiedEquipmentRunTerminal({
		workspaceRoot,
		runId: DEFAULT_EQUIPMENT_RUN_ID,
		eventId: 'copper-heavy-armour-terminal',
		requestedAt: '2026-09-02T00:06:00.000Z',
		actor: 'root-orchestrator',
		targetId: sourceClaim.targetId,
		workerId: sourceClaim.workerId,
		recordedAt: '2026-09-02T00:06:01.000Z',
		lockOwnerId: 'root-orchestrator-terminal-controller'
	});
	const plan = EquipmentRunPlanSchema.parse(await readJson(workspaceRoot, PLAN_PATH));
	const gate = plan.reviewGates.find(({ gateId }) => gateId === GATE_ID)!;
	const receipt = await buildArmourSourceReviewReceipt({
		workspaceRoot,
		runId: DEFAULT_EQUIPMENT_RUN_ID,
		gateId: GATE_ID,
		decision: 'accepted',
		reviewer: REVIEWER,
		reviewedAt: REVIEWED_AT,
		acknowledgedCandidateSha256: result.candidateSha256
	});
	return {
		workspaceRoot,
		plan,
		gate,
		sourceClaim,
		target,
		result,
		receipt
	};
}

afterEach(async () => {
	await Promise.all(
		fixtureRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

describe('Equipment Armour source-review receipts', () => {
	it('requires activation before a source review can be built', async () => {
		const workspaceRoot = await makeWorkspace();
		await expect(
			buildArmourSourceReviewReceipt({
				workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				gateId: GATE_ID,
				decision: 'accepted',
				reviewer: REVIEWER,
				reviewedAt: REVIEWED_AT,
				acknowledgedCandidateSha256: '0'.repeat(64)
			})
		).rejects.toThrow(/plan|activation|run/iu);
	});

	it('unlocks exactly four ordered children only for exact accepted evidence', async () => {
		const valid = await makeCandidateFixture();
		await expect(
			verifyArmourSourceReviewReceipt({
				workspaceRoot: valid.workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				receipt: valid.receipt
			})
		).resolves.toMatchObject({
			decision: 'accepted',
			unlocksTargetIds: [
				'material-equipment-v1-copper-heavy-armour-head-v1',
				'material-equipment-v1-copper-heavy-armour-torso-v1',
				'material-equipment-v1-copper-heavy-armour-legs-v1',
				'material-equipment-v1-copper-heavy-armour-boots-v1'
			]
		});

		for (const [label, receipt] of [
			['candidate', { ...valid.receipt, candidateSha256: '0'.repeat(64) }],
			['plan', { ...valid.receipt, runPlanCanonicalSha256: '0'.repeat(64) }],
			['manifest', { ...valid.receipt, manifestCanonicalSha256: '0'.repeat(64) }],
			['allocation', { ...valid.receipt, allocationCanonicalSha256: '0'.repeat(64) }],
			['profile', { ...valid.receipt, profileCanonicalSha256: '0'.repeat(64) }],
			['result', { ...valid.receipt, sourceResultCanonicalSha256: '0'.repeat(64) }],
			['source', { ...valid.receipt, sourceTargetId: 'material-equipment-v1-copper-sword-v1' }]
		] as const) {
			await expect(
				verifyArmourSourceReviewReceipt({
					workspaceRoot: valid.workspaceRoot,
					runId: DEFAULT_EQUIPMENT_RUN_ID,
					receipt
				})
			).rejects.toThrow(new RegExp(label, 'iu'));
		}
	});

	it('preserves a rejected decision as evidence while unlocking zero children', async () => {
		const valid = await makeCandidateFixture();
		const receipt = await buildArmourSourceReviewReceipt({
			workspaceRoot: valid.workspaceRoot,
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			gateId: GATE_ID,
			decision: 'rejected',
			reviewer: REVIEWER,
			reviewedAt: REVIEWED_AT,
			acknowledgedCandidateSha256: valid.result.candidateSha256
		});
		await expect(
			verifyArmourSourceReviewReceipt({
				workspaceRoot: valid.workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				receipt
			})
		).resolves.toMatchObject({ decision: 'rejected', unlocksTargetIds: [] });
	});

	it('rejects empty, merely existing, or invalid receipt files', async () => {
		for (const contents of ['', '{}\n', '{not-json}\n']) {
			const valid = await makeCandidateFixture();
			await mkdir(path.dirname(absolute(valid.workspaceRoot, valid.gate.reviewPath)), {
				recursive: true
			});
			await writeFile(absolute(valid.workspaceRoot, valid.gate.reviewPath), contents, 'utf8');
			await expect(
				verifyArmourSourceReviewReceipt({
					workspaceRoot: valid.workspaceRoot,
					runId: DEFAULT_EQUIPMENT_RUN_ID,
					receiptPath: valid.gate.reviewPath
				})
			).rejects.toThrow();
		}
	});

	it('rejects omitted reviewers, stale timestamps, non-candidate results, and non-four-child gates', async () => {
		const missingReviewer = await makeCandidateFixture();
		await expect(
			verifyArmourSourceReviewReceipt({
				workspaceRoot: missingReviewer.workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				receipt: { ...missingReviewer.receipt, reviewer: '' }
			})
		).rejects.toThrow(/reviewer|text/iu);

		const stale = await makeCandidateFixture();
		await expect(
			verifyArmourSourceReviewReceipt({
				workspaceRoot: stale.workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				receipt: { ...stale.receipt, reviewedAt: '2026-09-02T00:05:59.000Z' }
			})
		).rejects.toThrow(/timestamp|stale|terminal/iu);

		const nonCandidate = await makeCandidateFixture();
		await writeJson(nonCandidate.workspaceRoot, nonCandidate.target.output.resultPath, {
			...nonCandidate.result,
			status: 'revise'
		});
		await expect(
			verifyArmourSourceReviewReceipt({
				workspaceRoot: nonCandidate.workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				receipt: nonCandidate.receipt
			})
		).rejects.toThrow(/candidate|result/iu);

		const wrongGate = await makeCandidateFixture();
		const changedPlan = {
			...wrongGate.plan,
			reviewGates: wrongGate.plan.reviewGates.map((gate) =>
				gate.gateId === GATE_ID
					? { ...gate, unlocksTargetIds: gate.unlocksTargetIds.slice(0, 3) }
					: gate
			)
		};
		await writeJson(wrongGate.workspaceRoot, PLAN_PATH, changedPlan);
		const activation = EquipmentRunActivationSchema.parse(
			await readJson(wrongGate.workspaceRoot, ACTIVATION_PATH)
		);
		await writeJson(wrongGate.workspaceRoot, ACTIVATION_PATH, {
			...activation,
			runPlanCanonicalSha256: canonicalJsonSha256(changedPlan)
		});
		await expect(
			verifyArmourSourceReviewReceipt({
				workspaceRoot: wrongGate.workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				receipt: {
					...wrongGate.receipt,
					runPlanCanonicalSha256: canonicalJsonSha256(changedPlan)
				}
			})
		).rejects.toThrow();
	});
});

describe('Equipment Armour review materialization', () => {
	function materializeInput(valid: Awaited<ReturnType<typeof makeCandidateFixture>>) {
		return {
			workspaceRoot: valid.workspaceRoot,
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			gateId: GATE_ID,
			decision: 'accepted' as const,
			reviewer: REVIEWER,
			reviewedAt: REVIEWED_AT,
			acknowledgedCandidateSha256: valid.result.candidateSha256,
			lockOwnerId: 'equipment-art-director-review-controller'
		};
	}

	async function reviewEvents(workspaceRoot: string) {
		const eventsDirectory = `${RUN_DIRECTORY}/events`;
		return Promise.all(
			(await readdir(absolute(workspaceRoot, eventsDirectory))).map((name) =>
				readJson<{ request: { kind: string; decision?: string } }>(
					workspaceRoot,
					`${eventsDirectory}/${name}`
				)
			)
		).then((events) => events.filter(({ request }) => request.kind === 'armour-source-reviewed'));
	}

	it('preserves the pre-activation zero-write boundary and refuses a held run lock', async () => {
		const preActivation = await makeWorkspace();
		await expect(
			materializeDependentArmourPackets({
				workspaceRoot: preActivation,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				gateId: GATE_ID,
				decision: 'accepted',
				reviewer: REVIEWER,
				reviewedAt: REVIEWED_AT,
				acknowledgedCandidateSha256: '0'.repeat(64),
				lockOwnerId: 'pre-activation-review-controller'
			})
		).rejects.toThrow(/directory|activation|run/iu);
		await expect(
			readFile(
				absolute(
					preActivation,
					`${EQUIPMENT_PRODUCTION_ROOT}/runs/${DEFAULT_EQUIPMENT_RUN_ID}/.journal.lock`
				)
			)
		).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(
			readdir(absolute(preActivation, `${EQUIPMENT_PRODUCTION_ROOT}/runs`))
		).rejects.toMatchObject({ code: 'ENOENT' });

		const locked = await makeCandidateFixture();
		const lockPath = `${RUN_DIRECTORY}/.journal.lock`;
		await writeJson(locked.workspaceRoot, lockPath, {
			ownerId: 'another-controller',
			processId: process.pid,
			acquiredAt: REVIEWED_AT
		});
		await expect(
			materializeDependentArmourPackets({
				...materializeInput(locked),
				lockWaitTimeoutMs: 0
			})
		).rejects.toThrow(/collided|lock/iu);
		expect(await readJson(locked.workspaceRoot, lockPath)).toMatchObject({
			ownerId: 'another-controller'
		});
		expect(await reviewEvents(locked.workspaceRoot)).toHaveLength(0);

		await writeJson(locked.workspaceRoot, lockPath, {
			ownerId: 'crashed-controller',
			processId: 2_147_483_647,
			acquiredAt: '2026-09-01T00:00:00.000Z'
		});
		await expect(
			materializeDependentArmourPackets({
				...materializeInput(locked),
				now: () => new Date(REVIEWED_AT),
				staleLockAfterMs: 0
			})
		).resolves.toMatchObject({ decision: 'accepted', writesPerformed: 10 });
	});

	it('exclusively creates the receipt and eight exact packets before appending acceptance', async () => {
		const valid = await makeCandidateFixture();
		let packetPathsAtEventBoundary: string[] = [];
		const result = await materializeDependentArmourPackets({
			...materializeInput(valid),
			testHooks: {
				beforeReviewEventCreated: async ({ packetPaths }) => {
					packetPathsAtEventBoundary = packetPaths.slice();
					for (const packetPath of packetPaths) {
						expect(await readFile(absolute(valid.workspaceRoot, packetPath), 'utf8')).not.toBe('');
					}
					expect(await reviewEvents(valid.workspaceRoot)).toHaveLength(0);
				}
			}
		});

		expect(result).toMatchObject({
			decision: 'accepted',
			writesPerformed: 10,
			reconciled: false,
			targetCount: 4,
			assignmentCount: 4
		});
		expect(packetPathsAtEventBoundary).toHaveLength(8);
		expect(await reviewEvents(valid.workspaceRoot)).toMatchObject([
			{ request: { kind: 'armour-source-reviewed', decision: 'accepted' } }
		]);
		await expect(materializeDependentArmourPackets(materializeInput(valid))).resolves.toMatchObject(
			{
				decision: 'accepted',
				writesPerformed: 0,
				reconciled: true
			}
		);
		expect(await reviewEvents(valid.workspaceRoot)).toHaveLength(1);
	});

	it('records rejection with no child packets and requires an explicit matching hash in the CLI', async () => {
		const valid = await makeCandidateFixture();
		const commonArgs = [
			'review-armour-source',
			'--run-id',
			DEFAULT_EQUIPMENT_RUN_ID,
			'--gate-id',
			GATE_ID,
			'--reviewer',
			REVIEWER,
			'--reviewed-at',
			REVIEWED_AT
		];
		await expect(
			runEquipmentImageProductionCli({ args: commonArgs, workspaceRoot: valid.workspaceRoot })
		).rejects.toThrow(/accept-candidate-sha256|reject-candidate-sha256/iu);
		await expect(
			runEquipmentImageProductionCli({
				args: [
					...commonArgs,
					'--accept-candidate-sha256',
					valid.result.candidateSha256,
					'--reject-candidate-sha256',
					valid.result.candidateSha256
				],
				workspaceRoot: valid.workspaceRoot
			})
		).rejects.toThrow(/exactly one/iu);
		await expect(
			runEquipmentImageProductionCli({
				args: [...commonArgs, '--reject-candidate-sha256', '0'.repeat(64)],
				workspaceRoot: valid.workspaceRoot
			})
		).rejects.toThrow(/candidate/iu);
		const result = await runEquipmentImageProductionCli({
			args: [...commonArgs, '--reject-candidate-sha256', valid.result.candidateSha256],
			workspaceRoot: valid.workspaceRoot
		});
		expect(result).toMatchObject({
			command: 'review-armour-source',
			decision: 'rejected',
			targetCount: 0,
			assignmentCount: 0,
			writesPerformed: 2
		});
		for (const targetId of valid.gate.unlocksTargetIds) {
			const index = valid.plan.targetIds.indexOf(targetId);
			const candidatePath = valid.plan.reservedPaths.candidates[index]!;
			const suffix = candidatePath
				.slice(`${EQUIPMENT_PRODUCTION_ROOT}/candidates/`.length, -4)
				.concat('.json');
			await expect(
				readFile(absolute(valid.workspaceRoot, `${EQUIPMENT_PRODUCTION_ROOT}/targets/${suffix}`))
			).rejects.toMatchObject({ code: 'ENOENT' });
		}
	});

	it('reconciles a crash only when all eight exact packet files exist before the event', async () => {
		const valid = await makeCandidateFixture();
		await expect(
			materializeDependentArmourPackets({
				...materializeInput(valid),
				testHooks: {
					afterAllPacketFilesVerified: () => {
						throw new Error('simulated crash after eight packet files');
					}
				}
			})
		).rejects.toThrow('simulated crash');
		expect(await reviewEvents(valid.workspaceRoot)).toHaveLength(0);

		await expect(materializeDependentArmourPackets(materializeInput(valid))).resolves.toMatchObject(
			{
				decision: 'accepted',
				reconciled: true,
				writesPerformed: 1,
				targetCount: 4,
				assignmentCount: 4
			}
		);
		expect(await reviewEvents(valid.workspaceRoot)).toHaveLength(1);
	});

	it('blocks a partial crash without appending an unlock event', async () => {
		const valid = await makeCandidateFixture();
		await expect(
			materializeDependentArmourPackets({
				...materializeInput(valid),
				testHooks: {
					afterPacketFileCreated: ({ index }) => {
						if (index === 2) throw new Error('simulated partial packet crash');
					}
				}
			})
		).rejects.toThrow('simulated partial');
		await expect(materializeDependentArmourPackets(materializeInput(valid))).rejects.toThrow(
			/partial|eight/iu
		);
		expect(await reviewEvents(valid.workspaceRoot)).toHaveLength(0);
	});
});
