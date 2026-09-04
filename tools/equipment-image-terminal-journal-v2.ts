import { z } from 'zod';

import {
	EquipmentV2ImageAssignmentSchema,
	EquipmentV2ImageTargetSchema
} from './equipment-image-production-contract-v2.js';
import { canonicalJsonSha256V2 } from './equipment-image-profile-acceptance-v2.js';
import {
	DEFAULT_EQUIPMENT_V2_RUN_ID,
	EquipmentV2RunActivationSchema,
	EquipmentV2RunPlanSchema,
	assertEquipmentV2RootTargetAuthorized
} from './equipment-image-run-activation-v2.js';
import { verifyPersistedEquipmentImageResultEvidenceV2 } from './equipment-image-result-v2.js';
import { EQUIPMENT_V2_PRODUCTION_ROOT } from './equipment-material-production-v2.js';
import {
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

const SlugSchema = z.string().regex(/^[a-z][a-z0-9-]{1,159}$/u);
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const IsoDateTimeSchema = z.iso.datetime({ offset: true });
const RepositoryPathSchema = z
	.string()
	.refine((value) => value.startsWith(`${EQUIPMENT_V2_PRODUCTION_ROOT}/`), {
		message: 'Terminal journal paths must remain inside the Equipment v2 production root'
	})
	.refine(
		(value) =>
			!value.includes('\\') &&
			value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..'),
		{ message: 'Terminal journal paths must be repository-relative POSIX without traversal' }
	);

const ArtifactBindingSchema = z
	.object({ path: RepositoryPathSchema, canonicalSha256: HashSchema })
	.strict();

export const EquipmentV2TerminalJournalEntrySchema = z
	.object({
		schemaVersion: z.literal('equipment-production-terminal-journal-v2'),
		journalEntryId: SlugSchema,
		runId: SlugSchema,
		targetId: SlugSchema,
		recordedAt: IsoDateTimeSchema,
		recordedBy: z.literal('root-orchestrator'),
		terminalStatus: z.enum(['candidate', 'revise', 'failed']),
		runPlan: ArtifactBindingSchema,
		activation: ArtifactBindingSchema.extend({ activationId: SlugSchema }).strict(),
		target: ArtifactBindingSchema,
		assignment: ArtifactBindingSchema,
		result: ArtifactBindingSchema.extend({ candidateSha256: HashSchema.nullable() }).strict()
	})
	.strict();

export type EquipmentV2TerminalJournalEntry = z.infer<typeof EquipmentV2TerminalJournalEntrySchema>;

export interface EquipmentV2TerminalJournalInput {
	readonly workspaceRoot: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly resultPath: string;
	readonly recordedAt: string;
	readonly runId?: string;
}

export interface VerifiedEquipmentV2TerminalJournalEntry extends EquipmentV2TerminalJournalEntry {
	readonly journalPath: string;
	readonly journalCanonicalSha256: string;
}

function runPaths(runId: string): {
	readonly planPath: string;
	readonly activationPath: string;
} {
	const directory = `${EQUIPMENT_V2_PRODUCTION_ROOT}/runs/${runId}`;
	return {
		planPath: `${directory}/plan.json`,
		activationPath: `${directory}/activation.json`
	};
}

export function equipmentV2TerminalJournalPath(runId: string, targetId: string): string {
	SlugSchema.parse(runId);
	SlugSchema.parse(targetId);
	return `${EQUIPMENT_V2_PRODUCTION_ROOT}/runs/${runId}/terminal/${targetId}.json`;
}

async function buildExpectedEntry(
	input: EquipmentV2TerminalJournalInput
): Promise<EquipmentV2TerminalJournalEntry> {
	const runId = input.runId ?? DEFAULT_EQUIPMENT_V2_RUN_ID;
	const paths = runPaths(runId);
	const [planValue, activationValue, targetValue, assignmentValue] = await Promise.all([
		readEquipmentRepositoryJson(input.workspaceRoot, paths.planPath),
		readEquipmentRepositoryJson(input.workspaceRoot, paths.activationPath),
		readEquipmentRepositoryJson(input.workspaceRoot, input.targetPath),
		readEquipmentRepositoryJson(input.workspaceRoot, input.assignmentPath)
	]);
	const plan = EquipmentV2RunPlanSchema.parse(planValue);
	const activation = EquipmentV2RunActivationSchema.parse(activationValue);
	const target = EquipmentV2ImageTargetSchema.parse(targetValue);
	const assignment = EquipmentV2ImageAssignmentSchema.parse(assignmentValue);
	const recordedAt = IsoDateTimeSchema.parse(input.recordedAt);
	const planHash = canonicalJsonSha256V2(plan);
	const binding = plan.rootPackets.find(({ targetId }) => targetId === target.targetId);
	await assertEquipmentV2RootTargetAuthorized({
		workspaceRoot: input.workspaceRoot,
		targetId: target.targetId,
		runId
	});
	if (plan.runId !== runId || activation.runId !== runId) {
		throw new Error('Terminal journal run ID does not match the persisted run artifacts');
	}
	if (
		activation.runPlanCanonicalSha256 !== planHash ||
		activation.authorization.scope !== 'root-targets-only' ||
		!activation.authorization.authorizedTargetIds.includes(target.targetId)
	) {
		throw new Error('Terminal journal target is not authorized by the persisted activation');
	}
	if (
		binding === undefined ||
		binding.targetPath !== input.targetPath ||
		binding.assignmentPath !== input.assignmentPath ||
		binding.targetCanonicalSha256 !== canonicalJsonSha256V2(target) ||
		binding.assignmentCanonicalSha256 !== canonicalJsonSha256V2(assignment)
	) {
		throw new Error('Terminal journal packets do not match the immutable run-plan binding');
	}
	if (assignment.targetId !== target.targetId) {
		throw new Error('Terminal journal assignment does not bind the target');
	}
	if (input.resultPath !== target.output.provenanceResultPath) {
		throw new Error('Terminal journal result path does not match the target output contract');
	}
	const result = await verifyPersistedEquipmentImageResultEvidenceV2({
		workspaceRoot: input.workspaceRoot,
		targetPath: input.targetPath,
		assignmentPath: input.assignmentPath,
		resultPath: input.resultPath
	});
	if (
		Date.parse(recordedAt) < Date.parse(result.completedAt) ||
		Date.parse(recordedAt) < Date.parse(activation.activatedAt)
	) {
		throw new Error('Terminal journal recordedAt must not precede activation or result completion');
	}
	return EquipmentV2TerminalJournalEntrySchema.parse({
		schemaVersion: 'equipment-production-terminal-journal-v2',
		journalEntryId: `terminal-${target.targetId}`,
		runId,
		targetId: target.targetId,
		recordedAt,
		recordedBy: 'root-orchestrator',
		terminalStatus: result.status,
		runPlan: { path: paths.planPath, canonicalSha256: planHash },
		activation: {
			path: paths.activationPath,
			canonicalSha256: canonicalJsonSha256V2(activation),
			activationId: activation.activationId
		},
		target: { path: input.targetPath, canonicalSha256: binding.targetCanonicalSha256 },
		assignment: {
			path: input.assignmentPath,
			canonicalSha256: binding.assignmentCanonicalSha256
		},
		result: {
			path: input.resultPath,
			canonicalSha256: result.resultCanonicalSha256,
			candidateSha256: result.candidateSha256
		}
	});
}

export async function verifyEquipmentV2TerminalJournalEntry(
	input: EquipmentV2TerminalJournalInput & { readonly entry: unknown }
): Promise<VerifiedEquipmentV2TerminalJournalEntry> {
	const entry = EquipmentV2TerminalJournalEntrySchema.parse(input.entry);
	const expected = await buildExpectedEntry({ ...input, recordedAt: entry.recordedAt });
	if (canonicalJsonSha256V2(entry) !== canonicalJsonSha256V2(expected)) {
		throw new Error('Terminal journal entry does not match persisted run and result evidence');
	}
	return {
		...entry,
		journalPath: equipmentV2TerminalJournalPath(entry.runId, entry.targetId),
		journalCanonicalSha256: canonicalJsonSha256V2(entry)
	};
}

export async function persistEquipmentV2TerminalJournalEntry(
	input: EquipmentV2TerminalJournalInput
): Promise<VerifiedEquipmentV2TerminalJournalEntry> {
	const entry = await buildExpectedEntry(input);
	const journalPath = equipmentV2TerminalJournalPath(entry.runId, entry.targetId);
	const serialized = `${JSON.stringify(entry, null, '\t')}\n`;
	await exclusiveCreateEquipmentRepositoryFile(input.workspaceRoot, journalPath, serialized);
	const persistedBytes = await readEquipmentRepositoryFile(input.workspaceRoot, journalPath);
	if (persistedBytes.toString('utf8') !== serialized) {
		throw new Error(`Persisted terminal journal bytes changed during write: ${journalPath}`);
	}
	return verifyEquipmentV2TerminalJournalEntry({
		...input,
		entry: JSON.parse(persistedBytes.toString('utf8')) as unknown
	});
}

export async function verifyPersistedEquipmentV2TerminalJournalEntry(input: {
	readonly workspaceRoot: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly resultPath: string;
	readonly journalPath: string;
	readonly runId?: string;
}): Promise<VerifiedEquipmentV2TerminalJournalEntry> {
	const entry = await readEquipmentRepositoryJson(input.workspaceRoot, input.journalPath);
	const parsed = EquipmentV2TerminalJournalEntrySchema.parse(entry);
	if (input.journalPath !== equipmentV2TerminalJournalPath(parsed.runId, parsed.targetId)) {
		throw new Error('Supplied terminal journal path does not match its run and target');
	}
	return verifyEquipmentV2TerminalJournalEntry({
		...input,
		recordedAt: parsed.recordedAt,
		entry
	});
}
