import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { EquipmentV2ImageTargetSchema } from './equipment-image-production-contract-v2.js';
import { canonicalJsonSha256V2 } from './equipment-image-profile-acceptance-v2.js';
import {
	buildEquipmentImageResultEvidenceV2,
	persistEquipmentImageResultEvidenceV2
} from './equipment-image-result-v2.js';
import {
	EquipmentV2TerminalJournalEntrySchema,
	equipmentV2TerminalJournalPath,
	persistEquipmentV2TerminalJournalEntry,
	verifyEquipmentV2TerminalJournalEntry,
	verifyPersistedEquipmentV2TerminalJournalEntry
} from './equipment-image-terminal-journal-v2.js';
import { readEquipmentRepositoryJson } from './equipment-repository-io.js';
import { recordEquipmentV2TerminalJournal } from './record-equipment-image-terminal-v2.js';

const ROOT = 'assets/equipment/experiments/material-equipment-v2';
const RUN_ID = 'material-equipment-v2-run-001';
const TARGET_PATH = `${ROOT}/targets/f/bronze/sword-v2.json`;
const ASSIGNMENT_PATH = `${ROOT}/assignments/f/bronze/sword-v2.json`;
const RECORDED_AT = '2026-09-02T23:30:00.000Z';
const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true }))
	);
});

async function copyRepositoryPath(workspaceRoot: string, repositoryPath: string): Promise<void> {
	const destination = path.join(workspaceRoot, ...repositoryPath.split('/'));
	await mkdir(path.dirname(destination), { recursive: true });
	await cp(path.join(process.cwd(), ...repositoryPath.split('/')), destination, {
		recursive: true
	});
}

async function fixture() {
	const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'summonlab-equipment-v2-terminal-'));
	temporaryDirectories.push(workspaceRoot);
	for (const repositoryPath of [
		`${ROOT}/manifest.json`,
		`${ROOT}/allocation-plan.json`,
		`${ROOT}/visual-profile`,
		`${ROOT}/targets`,
		`${ROOT}/assignments`,
		`${ROOT}/runs/${RUN_ID}/plan.json`,
		`${ROOT}/runs/${RUN_ID}/activation.json`
	]) {
		await copyRepositoryPath(workspaceRoot, repositoryPath);
	}
	const profile = (await readEquipmentRepositoryJson(
		workspaceRoot,
		`${ROOT}/visual-profile/profile.json`
	)) as { readonly references: readonly { readonly path: string }[] };
	for (const reference of profile.references) {
		await copyRepositoryPath(workspaceRoot, reference.path);
	}
	const target = EquipmentV2ImageTargetSchema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, TARGET_PATH)
	);
	const findings = target.acceptanceCriteria.map(({ criterionId }) => ({
		criterionId,
		outcome: 'not-applicable' as const,
		observation: 'No image was available for producer inspection.'
	}));
	const result = await buildEquipmentImageResultEvidenceV2({
		workspaceRoot,
		targetPath: TARGET_PATH,
		assignmentPath: ASSIGNMENT_PATH,
		status: 'failed',
		sourceOutputId: null,
		requestStartedAt: '2026-09-02T23:00:00.000Z',
		generationCompletedAt: '2026-09-02T23:10:00.000Z',
		inspectionCompletedAt: '2026-09-02T23:20:00.000Z',
		startedAt: '2026-09-02T23:00:00.000Z',
		completedAt: '2026-09-02T23:20:00.000Z',
		findings
	});
	const persistedResult = await persistEquipmentImageResultEvidenceV2({
		workspaceRoot,
		targetPath: TARGET_PATH,
		assignmentPath: ASSIGNMENT_PATH,
		result
	});
	return {
		workspaceRoot,
		target,
		result: persistedResult,
		resultPath: target.output.provenanceResultPath
	};
}

function journalInput(built: Awaited<ReturnType<typeof fixture>>) {
	return {
		workspaceRoot: built.workspaceRoot,
		targetPath: TARGET_PATH,
		assignmentPath: ASSIGNMENT_PATH,
		resultPath: built.resultPath,
		recordedAt: RECORDED_AT,
		runId: RUN_ID
	};
}

function terminalEntryOnly(value: object) {
	return EquipmentV2TerminalJournalEntrySchema.parse(
		Object.fromEntries(
			Object.entries(value).filter(
				([key]) => key !== 'journalPath' && key !== 'journalCanonicalSha256'
			)
		)
	);
}

describe('Equipment v2 terminal journal', () => {
	it('persists and reverifies an immutable binding to the run, activation, packets, and result', async () => {
		const built = await fixture();
		const persisted = await persistEquipmentV2TerminalJournalEntry(journalInput(built));
		const entry = terminalEntryOnly(persisted);

		expect(persisted).toMatchObject({
			runId: RUN_ID,
			targetId: built.target.targetId,
			terminalStatus: 'failed',
			recordedBy: 'root-orchestrator',
			result: {
				path: built.resultPath,
				canonicalSha256: built.result.resultCanonicalSha256,
				candidateSha256: null
			}
		});
		expect(persisted.runPlan.canonicalSha256).toBe(
			'40f174c589881af351603cd891050ceae12c10570b59e0c578e173132ba6d7ed'
		);
		expect(persisted.journalCanonicalSha256).toBe(canonicalJsonSha256V2(entry));
		await expect(
			verifyPersistedEquipmentV2TerminalJournalEntry({
				...journalInput(built),
				journalPath: persisted.journalPath
			})
		).resolves.toEqual(persisted);
	});

	it('exposes terminal recording only through the explicit root-orchestrator boundary', async () => {
		const built = await fixture();
		await expect(
			recordEquipmentV2TerminalJournal({
				...journalInput(built),
				actor: 'equipment-worker'
			})
		).rejects.toThrow(/root-orchestrator-owned/iu);
		await expect(
			recordEquipmentV2TerminalJournal({
				...journalInput(built),
				actor: 'root-orchestrator'
			})
		).resolves.toMatchObject({ targetId: built.target.targetId, terminalStatus: 'failed' });
	});

	it('allows exactly one winner when two writers race for the same target receipt', async () => {
		const built = await fixture();
		const outcomes = await Promise.allSettled([
			persistEquipmentV2TerminalJournalEntry(journalInput(built)),
			persistEquipmentV2TerminalJournalEntry(journalInput(built))
		]);
		expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
		expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(1);
		expect(
			String((outcomes.find(({ status }) => status === 'rejected') as PromiseRejectedResult).reason)
		).toMatch(/exclusive-create collision/iu);
	});

	it('rejects altered journal claims and an activation with a changed authorization set', async () => {
		const built = await fixture();
		const persisted = await persistEquipmentV2TerminalJournalEntry(journalInput(built));
		const entry = terminalEntryOnly(persisted);
		await expect(
			verifyEquipmentV2TerminalJournalEntry({
				...journalInput(built),
				entry: {
					...entry,
					terminalStatus: 'candidate'
				}
			})
		).rejects.toThrow(/does not match persisted run and result evidence/iu);

		const second = await fixture();
		const activationPath = path.join(
			second.workspaceRoot,
			...`${ROOT}/runs/${RUN_ID}/activation.json`.split('/')
		);
		const activation = (await readEquipmentRepositoryJson(
			second.workspaceRoot,
			`${ROOT}/runs/${RUN_ID}/activation.json`
		)) as {
			readonly authorization: {
				readonly authorizedTargetIds: readonly string[];
			};
		};
		const authorizedTargetIds = [...activation.authorization.authorizedTargetIds];
		authorizedTargetIds[1] = 'material-equipment-v2-bronze-heavy-armour-head-v2';
		await writeFile(
			activationPath,
			`${JSON.stringify(
				{
					...activation,
					authorization: { ...activation.authorization, authorizedTargetIds }
				},
				null,
				'\t'
			)}\n`
		);
		await expect(persistEquipmentV2TerminalJournalEntry(journalInput(second))).rejects.toThrow(
			/not authorized|activation/iu
		);
		const expectedJournal = equipmentV2TerminalJournalPath(RUN_ID, second.target.targetId);
		await expect(
			readEquipmentRepositoryJson(second.workspaceRoot, expectedJournal)
		).rejects.toThrow(/regular file/iu);
	});

	it('rejects terminal timestamps that precede activation or result completion', async () => {
		const built = await fixture();
		await expect(
			persistEquipmentV2TerminalJournalEntry({
				...journalInput(built),
				recordedAt: '2026-09-02T23:19:59.999Z'
			})
		).rejects.toThrow(/must not precede/iu);
	});
});
