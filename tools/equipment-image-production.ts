import { mkdir, open, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
	EQUIPMENT_PRODUCTION_ROOT,
	EquipmentVisualProfileAcceptanceSchema,
	EquipmentVisualProfileSchema
} from './equipment-image-production-contract.js';
import {
	EQUIPMENT_PROFILE_ACCEPTANCE_PATH,
	buildEquipmentProfileAcceptance,
	buildRootEquipmentPackets,
	materializeRootEquipmentPackets,
	renderEquipmentPrompt,
	validateEquipmentPacket
} from './equipment-image-packets.js';
import {
	persistEquipmentImageResult,
	readEquipmentRepositoryJson,
	verifyEquipmentImageResult
} from './equipment-image-result.js';
import {
	DEFAULT_EQUIPMENT_RUN_ID,
	activateEquipmentRun,
	reportEquipmentRunReadiness
} from './equipment-image-run-readiness.js';

const PROFILE_PATH = `${EQUIPMENT_PRODUCTION_ROOT}/visual-profile/profile.json` as const;
const MANIFEST_PATH = `${EQUIPMENT_PRODUCTION_ROOT}/manifest.json` as const;
const ALLOCATION_PATH = `${EQUIPMENT_PRODUCTION_ROOT}/allocation-plan.json` as const;
const ACCEPTED_AT = '2026-09-01T23:00:00.000Z' as const;

type PacketSources = Parameters<typeof buildRootEquipmentPackets>[0];

async function readJson(workspaceRoot: string, repositoryPath: string): Promise<unknown> {
	const contents = await readFile(path.resolve(workspaceRoot, repositoryPath), 'utf8');
	return JSON.parse(contents) as unknown;
}

async function readPacketSources(workspaceRoot: string): Promise<PacketSources> {
	const [manifest, allocation, profile, acceptance] = await Promise.all([
		readJson(workspaceRoot, MANIFEST_PATH),
		readJson(workspaceRoot, ALLOCATION_PATH),
		readJson(workspaceRoot, PROFILE_PATH),
		readJson(workspaceRoot, EQUIPMENT_PROFILE_ACCEPTANCE_PATH)
	]);
	return {
		manifest: manifest as PacketSources['manifest'],
		allocation: allocation as PacketSources['allocation'],
		profile: EquipmentVisualProfileSchema.parse(profile),
		acceptance: EquipmentVisualProfileAcceptanceSchema.parse(acceptance)
	};
}

function parseOptions(
	args: readonly string[],
	allowedNames: readonly string[]
): Map<string, string> {
	if (args.length % 2 !== 0) throw new Error(`Missing value for ${args.at(-1)}`);
	const options = new Map<string, string>();
	for (let index = 0; index < args.length; index += 2) {
		const name = args[index]!;
		const value = args[index + 1]!;
		if (!allowedNames.includes(name)) throw new Error(`Unknown argument: ${name}`);
		if (options.has(name)) throw new Error(`Duplicate argument: ${name}`);
		if (value.length === 0) throw new Error(`Empty value for ${name}`);
		options.set(name, value);
	}
	return options;
}

function requireOption(options: ReadonlyMap<string, string>, name: string): string {
	const value = options.get(name);
	if (value === undefined) throw new Error(`Required argument missing: ${name}`);
	return value;
}

async function readStandardInput(): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
	}
	return Buffer.concat(chunks).toString('utf8');
}

function parseExactlyOneJsonValue(stdin: string): unknown {
	if (stdin.trim().length === 0) {
		throw new Error('persist-result stdin must contain exactly one JSON value');
	}
	try {
		return JSON.parse(stdin) as unknown;
	} catch (error) {
		throw new Error('persist-result stdin must contain exactly one JSON value', { cause: error });
	}
}

async function exclusiveJsonWrite(
	workspaceRoot: string,
	repositoryPath: string,
	value: unknown
): Promise<void> {
	const absolute = path.resolve(workspaceRoot, repositoryPath);
	await mkdir(path.dirname(absolute), { recursive: true });
	let handle;
	try {
		handle = await open(absolute, 'wx');
	} catch (error) {
		const code = (error as NodeJS.ErrnoException).code;
		if (code === 'EEXIST')
			throw new Error(`Exclusive-create collision: ${repositoryPath}`, { cause: error });
		throw error;
	}
	try {
		await handle.writeFile(`${JSON.stringify(value, null, '\t')}\n`, 'utf8');
		await handle.sync();
	} finally {
		await handle.close();
	}
}

export async function runEquipmentImageProductionCli(input: {
	readonly args: readonly string[];
	readonly workspaceRoot: string;
	readonly stdin?: string;
}): Promise<Record<string, unknown>> {
	const [command, ...commandArgs] = input.args;
	if (command === undefined) throw new Error('An Equipment image-production command is required');

	if (command === 'accept-profile') {
		const options = parseOptions(commandArgs, ['--reviewer', '--acknowledge-profile-sha256']);
		const reviewer = requireOption(options, '--reviewer');
		const acknowledgedProfileSha256 = requireOption(options, '--acknowledge-profile-sha256');
		if (!/^[a-f0-9]{64}$/u.test(acknowledgedProfileSha256)) {
			throw new Error(
				'--acknowledge-profile-sha256 must be exactly 64 lowercase hexadecimal characters'
			);
		}
		const profile = EquipmentVisualProfileSchema.parse(
			await readJson(input.workspaceRoot, PROFILE_PATH)
		);
		const acceptance = buildEquipmentProfileAcceptance({
			profile,
			profilePath: PROFILE_PATH,
			reviewer,
			acceptedAt: ACCEPTED_AT,
			acknowledgedProfileSha256
		});
		await exclusiveJsonWrite(input.workspaceRoot, EQUIPMENT_PROFILE_ACCEPTANCE_PATH, acceptance);
		return {
			command,
			acceptancePath: EQUIPMENT_PROFILE_ACCEPTANCE_PATH,
			profileCanonicalSha256: acceptance.profileCanonicalSha256,
			writesPerformed: 1
		};
	}

	if (command === 'export-root-packets' || command === 'check-root-packets') {
		if (commandArgs.length !== 0) throw new Error(`${command} accepts no arguments`);
		const result = await materializeRootEquipmentPackets({
			...(await readPacketSources(input.workspaceRoot)),
			workspaceRoot: input.workspaceRoot,
			check: command === 'check-root-packets'
		});
		return { command, ...result };
	}

	if (command === 'validate-packet') {
		const options = parseOptions(commandArgs, ['--target', '--assignment']);
		const targetPath = requireOption(options, '--target');
		const assignmentPath = requireOption(options, '--assignment');
		const sources = await readPacketSources(input.workspaceRoot);
		const result = await validateEquipmentPacket({
			workspaceRoot: input.workspaceRoot,
			...sources,
			target: await readJson(input.workspaceRoot, targetPath),
			assignment: await readJson(input.workspaceRoot, assignmentPath)
		});
		return { command, targetPath, assignmentPath, ...result };
	}

	if (command === 'render-prompt') {
		const options = parseOptions(commandArgs, ['--target']);
		const targetPath = requireOption(options, '--target');
		return {
			command,
			targetPath,
			prompt: renderEquipmentPrompt(
				(await readJson(input.workspaceRoot, targetPath)) as Parameters<
					typeof renderEquipmentPrompt
				>[0]
			)
		};
	}

	if (command === 'persist-result') {
		const options = parseOptions(commandArgs, ['--target', '--assignment']);
		const targetPath = requireOption(options, '--target');
		const assignmentPath = requireOption(options, '--assignment');
		const result = await persistEquipmentImageResult({
			workspaceRoot: input.workspaceRoot,
			targetPath,
			assignmentPath,
			result: parseExactlyOneJsonValue(input.stdin ?? (await readStandardInput()))
		});
		return { command, targetPath, assignmentPath, ...result };
	}

	if (command === 'verify-result') {
		const options = parseOptions(commandArgs, ['--target', '--assignment', '--result']);
		const targetPath = requireOption(options, '--target');
		const assignmentPath = requireOption(options, '--assignment');
		const resultPath = requireOption(options, '--result');
		const result = await verifyEquipmentImageResult({
			workspaceRoot: input.workspaceRoot,
			targetPath,
			assignmentPath,
			resultPath,
			result: await readEquipmentRepositoryJson(input.workspaceRoot, resultPath)
		});
		return { command, targetPath, assignmentPath, resultPath, ...result };
	}

	if (command === 'report-readiness') {
		const options = parseOptions(commandArgs, ['--run-id', '--created-at', '--checked-at']);
		const checkedAt = options.get('--checked-at') ?? new Date().toISOString();
		const result = await reportEquipmentRunReadiness({
			workspaceRoot: input.workspaceRoot,
			runId: options.get('--run-id') ?? DEFAULT_EQUIPMENT_RUN_ID,
			createdAt: options.get('--created-at') ?? checkedAt,
			checkedAt
		});
		return { command, ...result };
	}

	if (command === 'activate-run') {
		const options = parseOptions(commandArgs, [
			'--run-id',
			'--created-at',
			'--activated-at',
			'--activated-by'
		]);
		const activatedAt = options.get('--activated-at') ?? new Date().toISOString();
		const result = await activateEquipmentRun({
			workspaceRoot: input.workspaceRoot,
			runId: options.get('--run-id') ?? DEFAULT_EQUIPMENT_RUN_ID,
			createdAt: options.get('--created-at') ?? activatedAt,
			activatedAt,
			activatedBy: requireOption(options, '--activated-by')
		});
		return { command, ...result };
	}

	throw new Error(`Unknown Equipment image-production command: ${command}`);
}

const isDirectExecution =
	process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
	const result = await runEquipmentImageProductionCli({
		args: process.argv.slice(2),
		workspaceRoot: process.cwd()
	});
	if (result.prompt !== undefined) process.stdout.write(String(result.prompt));
	else process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
