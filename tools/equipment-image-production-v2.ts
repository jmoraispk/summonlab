import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
	EquipmentV2ProfileAcceptanceSchema,
	EquipmentV2ImageAssignmentSchema,
	EquipmentV2ImageTargetSchema
} from './equipment-image-production-contract-v2.js';
import { EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH } from './equipment-image-profile-acceptance-v2.js';
import {
	EQUIPMENT_V2_VISUAL_PROFILE_PATH,
	EquipmentVisualProfileV2Schema
} from './equipment-image-profile-v2.js';
import {
	materializeRootEquipmentPacketsV2,
	renderEquipmentPromptV2,
	validateEquipmentPacketV2
} from './equipment-image-packets-v2.js';
import {
	EQUIPMENT_V2_ALLOCATION_PLAN_PATH,
	EQUIPMENT_V2_MANIFEST_PATH,
	type buildEquipmentMaterialAllocationPlanV2,
	type buildEquipmentMaterialProductionManifestV2
} from './equipment-material-production-v2.js';
import {
	DEFAULT_EQUIPMENT_V2_RUN_ID,
	activateEquipmentV2Run,
	reportEquipmentV2RunReadiness
} from './equipment-image-run-activation-v2.js';
import { verifyPersistedEquipmentImageResultEvidenceV2 } from './equipment-image-result-v2.js';
import { readEquipmentRepositoryJson } from './equipment-repository-io.js';

type Manifest = ReturnType<typeof buildEquipmentMaterialProductionManifestV2>;
type Allocation = ReturnType<typeof buildEquipmentMaterialAllocationPlanV2>;

async function sources(workspaceRoot: string) {
	const [manifest, allocation, profile, acceptance] = await Promise.all([
		readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_V2_MANIFEST_PATH),
		readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_V2_ALLOCATION_PLAN_PATH),
		readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_V2_VISUAL_PROFILE_PATH),
		readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH)
	]);
	return {
		manifest: manifest as Manifest,
		allocation: allocation as Allocation,
		profile: EquipmentVisualProfileV2Schema.parse(profile),
		acceptance: EquipmentV2ProfileAcceptanceSchema.parse(acceptance)
	};
}

function options(args: readonly string[]): Map<string, string> {
	if (args.length % 2 !== 0) throw new Error(`Missing value for ${args.at(-1)}`);
	const parsed = new Map<string, string>();
	for (let index = 0; index < args.length; index += 2) {
		const name = args[index]!;
		const value = args[index + 1]!;
		if (!name.startsWith('--') || value.length === 0 || parsed.has(name)) {
			throw new Error(`Invalid Equipment v2 option: ${name}`);
		}
		parsed.set(name, value);
	}
	return parsed;
}

function required(parsed: ReadonlyMap<string, string>, name: string): string {
	const value = parsed.get(name);
	if (value === undefined) throw new Error(`Missing ${name}`);
	return value;
}

export async function runEquipmentImageProductionV2Cli(input: {
	readonly workspaceRoot: string;
	readonly args: readonly string[];
}): Promise<Record<string, unknown>> {
	const [command, ...rest] = input.args;
	if (command === undefined) throw new Error('Equipment v2 command required');
	const parsed = options(rest);
	if (command === 'export-root-packets' || command === 'check-root-packets') {
		if (parsed.size !== 0) throw new Error(`${command} accepts no options`);
		return {
			command,
			...(await materializeRootEquipmentPacketsV2({
				...(await sources(input.workspaceRoot)),
				workspaceRoot: input.workspaceRoot,
				check: command === 'check-root-packets'
			}))
		};
	}
	if (command === 'report-readiness') {
		const checkedAt = parsed.get('--checked-at') ?? new Date().toISOString();
		return {
			command,
			...(await reportEquipmentV2RunReadiness({
				workspaceRoot: input.workspaceRoot,
				runId: parsed.get('--run-id') ?? DEFAULT_EQUIPMENT_V2_RUN_ID,
				createdAt: parsed.get('--created-at') ?? checkedAt,
				checkedAt
			}))
		};
	}
	if (command === 'activate-run') {
		const activatedAt = parsed.get('--activated-at') ?? new Date().toISOString();
		return {
			command,
			...(await activateEquipmentV2Run({
				workspaceRoot: input.workspaceRoot,
				runId: parsed.get('--run-id') ?? DEFAULT_EQUIPMENT_V2_RUN_ID,
				createdAt: parsed.get('--created-at') ?? activatedAt,
				activatedAt,
				activatedBy: required(parsed, '--activated-by')
			}))
		};
	}
	if (command === 'render-prompt') {
		const targetPath = required(parsed, '--target');
		const target = EquipmentV2ImageTargetSchema.parse(
			await readEquipmentRepositoryJson(input.workspaceRoot, targetPath)
		);
		return { command, targetPath, prompt: renderEquipmentPromptV2(target) };
	}
	if (command === 'validate-packet' || command === 'preflight') {
		const targetPath = required(parsed, '--target');
		const assignmentPath = required(parsed, '--assignment');
		const packetSources = await sources(input.workspaceRoot);
		const target = EquipmentV2ImageTargetSchema.parse(
			await readEquipmentRepositoryJson(input.workspaceRoot, targetPath)
		);
		const assignment = EquipmentV2ImageAssignmentSchema.parse(
			await readEquipmentRepositoryJson(input.workspaceRoot, assignmentPath)
		);
		const validated = await validateEquipmentPacketV2({
			workspaceRoot: input.workspaceRoot,
			...packetSources,
			target,
			assignment
		});
		if (command === 'preflight') {
			const now = new Date().toISOString();
			const readiness = await reportEquipmentV2RunReadiness({
				workspaceRoot: input.workspaceRoot,
				runId: DEFAULT_EQUIPMENT_V2_RUN_ID,
				createdAt: now,
				checkedAt: now
			});
			if (
				readiness.status !== 'activated-root-generation-authorized' ||
				target.consistencySource !== null
			) {
				throw new Error('Equipment v2 target is not authorized for root generation');
			}
			return { command, targetPath, assignmentPath, readiness, ...validated };
		}
		return { command, targetPath, assignmentPath, ...validated };
	}
	if (command === 'verify-result') {
		const targetPath = required(parsed, '--target');
		const assignmentPath = required(parsed, '--assignment');
		const resultPath = required(parsed, '--result');
		return {
			command,
			targetPath,
			assignmentPath,
			resultPath,
			...(await verifyPersistedEquipmentImageResultEvidenceV2({
				workspaceRoot: input.workspaceRoot,
				targetPath,
				assignmentPath,
				resultPath
			}))
		};
	}
	throw new Error(`Unknown Equipment v2 command: ${command}`);
}

const isCli = process.argv[1]
	? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
	: false;
if (isCli) {
	const result = await runEquipmentImageProductionV2Cli({
		workspaceRoot: process.cwd(),
		args: process.argv.slice(2)
	});
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
