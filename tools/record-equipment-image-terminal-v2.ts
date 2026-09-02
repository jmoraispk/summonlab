import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { persistEquipmentV2TerminalJournalEntry } from './equipment-image-terminal-journal-v2.js';

export interface RecordEquipmentV2TerminalJournalInput {
	readonly actor: string;
	readonly workspaceRoot: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly resultPath: string;
	readonly recordedAt?: string;
	readonly runId?: string;
}

export async function recordEquipmentV2TerminalJournal(
	input: RecordEquipmentV2TerminalJournalInput
) {
	if (input.actor !== 'root-orchestrator') {
		throw new Error('Equipment v2 terminal receipts are root-orchestrator-owned');
	}
	return persistEquipmentV2TerminalJournalEntry({
		workspaceRoot: input.workspaceRoot,
		targetPath: input.targetPath,
		assignmentPath: input.assignmentPath,
		resultPath: input.resultPath,
		recordedAt: input.recordedAt ?? new Date().toISOString(),
		...(input.runId === undefined ? {} : { runId: input.runId })
	});
}

function option(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(name: string): string {
	const value = option(name);
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

const isCli = process.argv[1]
	? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
	: false;
if (isCli) {
	const recordedAt = option('--recorded-at');
	const runId = option('--run-id');
	const terminal = await recordEquipmentV2TerminalJournal({
		actor: required('--actor'),
		workspaceRoot: required('--workspace-root'),
		targetPath: required('--target'),
		assignmentPath: required('--assignment'),
		resultPath: required('--result'),
		...(recordedAt === undefined ? {} : { recordedAt }),
		...(runId === undefined ? {} : { runId })
	});
	process.stdout.write(
		`${JSON.stringify(
			{
				targetId: terminal.targetId,
				status: terminal.terminalStatus,
				journalPath: terminal.journalPath,
				journalCanonicalSha256: terminal.journalCanonicalSha256
			},
			null,
			2
		)}\n`
	);
}
