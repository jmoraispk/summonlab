import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkReversalCutIconRun } from './check-reversal-cut-icon-run.js';
import { exportSkillIconRuntime } from './compose-skill-icon-assets.js';

const ACTIVATION_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v7/activation.json';
const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

async function runtimeFixture(): Promise<{
	root: string;
	activation: {
		runtime: Array<{ path: string }>;
		recognition: { path: string };
	};
}> {
	const root = await mkdtemp(path.join(tmpdir(), 'reversal-cut-runtime-'));
	temporaryRoots.push(root);
	const activation = JSON.parse(await readFile(ACTIVATION_PATH, 'utf8')) as {
		runtime: Array<{ path: string }>;
		recognition: { path: string };
	};
	const fixturePaths = [
		'assets/wiki/skills/icon-production-v1/catalog.json',
		ACTIVATION_PATH,
		...activation.runtime.map(({ path: pathname }) => pathname),
		activation.recognition.path
	];
	for (const pathname of fixturePaths) {
		const destination = path.join(root, pathname);
		await mkdir(path.dirname(destination), { recursive: true });
		await cp(path.resolve(pathname), destination);
	}
	return { root, activation };
}

describe('Reversal Cut icon run', () => {
	it('binds the candidate result to the additive authority without promotion', async () => {
		await expect(checkReversalCutIconRun(path.resolve('.'))).resolves.toMatchObject({
			runId: 'reversal-cut-v2',
			jobId: 'blade-guard-flow-reversal-cut-v2',
			status: 'candidate',
			candidateHash: 'e505f796d2ec174c5db35eb762ea37dd1fe51f0a08579f403847a5303d3a7d54',
			selfPromoted: false,
			ownerDecision: 'accepted',
			calibrationStatus: 'approved',
			individualStatus: 'failed-provider-envelope',
			individualJobId: 'martial-blade-reversal-cut-v1',
			individualAttemptCount: 2,
			previousActivationStatus: 'rejected-frame',
			previousActivationId: 'martial-blade-reversal-cut-activation-v2',
			activationStatus: 'approved-runtime',
			activationId: 'martial-blade-reversal-cut-activation-v3',
			correctionStatus: 'superseded',
			correctionId: 'martial-blade-reversal-cut-frame-correction-v1',
			frameCandidateStatus: 'candidate',
			frameCandidateRunId: 'reversal-cut-v6',
			frameVisualDecision: 'accepted',
			framePromotionStatus: 'approved-runtime',
			approvedFrameHash: '3e5b368c8953bd9eec50044e61ae12c2966451450e6721776c713fd4db2e47d1',
			runtimeUpdated: true,
			runtimeSizes: [512, 256, 128]
		});
	});

	it('recognizes the approved v2 activation derivatives as managed runtime assets', async () => {
		const { root } = await runtimeFixture();

		await expect(exportSkillIconRuntime({ root, mode: 'check' })).resolves.toMatchObject({
			inSync: true,
			orphanPaths: [],
			drift: []
		});
	});

	it('rejects an approved v2 activation derivative whose bytes drift from its receipt', async () => {
		const { root, activation } = await runtimeFixture();
		await writeFile(path.join(root, activation.runtime[0]!.path), Buffer.from('drift'));

		await expect(exportSkillIconRuntime({ root, mode: 'check' })).rejects.toThrow(
			/standalone runtime asset hash drift/u
		);
	});
});
