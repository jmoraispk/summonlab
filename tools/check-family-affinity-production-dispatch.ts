import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	FamilyAffinityAssignmentSchema,
	FAMILY_AFFINITY_ROOT,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	familyAffinityPromptSha256,
	familyAffinityRawSha256,
	familyAffinitySha256,
	familyAffinitySourcePacketBinding,
	preflightFamilyAffinityProductionDispatch,
	readFamilyAffinityOwnedFile,
	stableFamilyAffinityJson,
	validateFamilyAffinityAttemptCrossBinding,
	validateFamilyAffinityCandidateEvidence,
	validateFamilyAffinityNormalAnchorEvidence,
	validateFamilyAffinityProductionCompatibility
} from './family-affinity-production-lib.js';

const SURFACE_FRAMING = 'length-prefixed-sha256-v1' as const;

function frameLength(length: number): Buffer {
	const value = Buffer.alloc(8);
	value.writeBigUInt64BE(BigInt(length));
	return value;
}

async function rawFileSha256(path: string): Promise<string> {
	const digest = createHash('sha256');
	for await (const chunk of createReadStream(path)) digest.update(chunk);
	return digest.digest('hex');
}

async function assertRealRegularPath(root: string, relativePath: string): Promise<string> {
	const absolute = resolve(root, relativePath);
	if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
		throw new Error(`Approved path escapes its root: ${relativePath}`);
	}
	let cursor = root;
	for (const part of relative(root, absolute).split(sep).filter(Boolean)) {
		cursor = join(cursor, part);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) throw new Error(`Approved path is symlinked: ${relativePath}`);
		if (cursor === absolute && !metadata.isFile()) {
			throw new Error(`Approved path is not a regular file: ${relativePath}`);
		}
	}
	return absolute;
}

async function assertApprovedAbsoluteRegularPath(path: string): Promise<void> {
	if (resolve(path) !== path)
		throw new Error('Approved runtime path must be absolute and normalized');
	let cursor: string = sep;
	for (const part of path.split(sep).filter(Boolean)) {
		cursor = join(cursor, part);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) throw new Error('Approved runtime path is symlinked');
		if (cursor === path && !metadata.isFile()) {
			throw new Error('Approved runtime path is not a regular file');
		}
	}
}

export async function computeFamilyAffinityProductionSurface(skillRoot: string) {
	const resolvedRoot = await realpath(skillRoot);
	const contractBytes = await readFile(join(resolvedRoot, 'references/contract-v3.json'));
	let contract: { executionSurface?: { framing?: unknown; files?: unknown } };
	try {
		contract = JSON.parse(contractBytes.toString('utf8'));
	} catch (error) {
		throw new Error(`Installed v3 execution-surface contract is invalid JSON: ${String(error)}`);
	}
	if (
		contract.executionSurface?.framing !== SURFACE_FRAMING ||
		!Array.isArray(contract.executionSurface.files) ||
		contract.executionSurface.files.length === 0 ||
		!contract.executionSurface.files.every(
			(path): path is string =>
				typeof path === 'string' &&
				path.length > 0 &&
				!path.includes('..') &&
				!path.startsWith('/') &&
				!path.includes('\\')
		)
	) {
		throw new Error('Installed v3 contract has no valid execution-surface allowlist');
	}
	const files = contract.executionSurface.files;
	if (new Set(files).size !== files.length) {
		throw new Error('Installed v3 execution-surface allowlist contains duplicates');
	}
	const digest = createHash('sha256');
	digest.update(Buffer.from('summonlab-image-production-surface-v1\0'));
	const fileHashes: Array<{ path: string; sha256: string }> = [];
	for (const path of files) {
		const bytes = await readFile(join(resolvedRoot, path));
		const pathBytes = Buffer.from(path, 'utf8');
		digest.update(frameLength(pathBytes.length));
		digest.update(pathBytes);
		digest.update(frameLength(bytes.length));
		digest.update(bytes);
		fileHashes.push({ path, sha256: familyAffinityRawSha256(bytes) });
	}
	return {
		root: resolvedRoot,
		framing: SURFACE_FRAMING,
		files: fileHashes,
		bundleSha256: digest.digest('hex'),
		contractBytes,
		contract
	};
}

export async function validateFamilyAffinityProductionSurface(input: {
	compatibility: unknown;
	trackedSkillRoot: string;
	installedSkillRoot: string;
	repositoryRoot: string;
}) {
	const [tracked, installed] = await Promise.all([
		computeFamilyAffinityProductionSurface(input.trackedSkillRoot),
		computeFamilyAffinityProductionSurface(input.installedSkillRoot)
	]);
	const compatibility = validateFamilyAffinityProductionCompatibility(
		input.compatibility,
		installed.contractBytes
	) as ReturnType<typeof validateFamilyAffinityProductionCompatibility> & {
		approvedSkillRoot: string;
		executionSurface: {
			framing: string;
			files: Array<{ path: string; sha256: string }>;
			bundleSha256: string;
		};
		sealedLauncher: {
			node: { path: string; sha256: string };
			bundle: { path: string; sha256: string };
			sources: Array<{ path: string; sha256: string }>;
		};
	};
	const approvedRoot = await realpath(compatibility.approvedSkillRoot);
	if (tracked.root !== approvedRoot || installed.root !== approvedRoot) {
		throw new Error('Installed and tracked skill roots must equal the receipt-approved root');
	}
	if (
		tracked.bundleSha256 !== installed.bundleSha256 ||
		stableFamilyAffinityJson(tracked.files) !== stableFamilyAffinityJson(installed.files) ||
		compatibility.executionSurface.framing !== SURFACE_FRAMING ||
		compatibility.executionSurface.bundleSha256 !== installed.bundleSha256 ||
		stableFamilyAffinityJson(compatibility.executionSurface.files) !==
			stableFamilyAffinityJson(installed.files)
	) {
		throw new Error('Installed or tracked v3 execution surface drifted from approval');
	}
	const expectedNonContract = (
		installed.contract as {
			executionSurface: {
				expectedNonContractSha256?: Record<string, string>;
			};
		}
	).executionSurface.expectedNonContractSha256;
	if (!expectedNonContract || typeof expectedNonContract !== 'object') {
		throw new Error('v3 contract lacks execution-surface per-file hashes');
	}
	const actualNonContract = Object.fromEntries(
		installed.files
			.filter(({ path }) => path !== 'references/contract-v3.json')
			.map(({ path, sha256 }) => [path, sha256])
	);
	if (
		stableFamilyAffinityJson(expectedNonContract) !== stableFamilyAffinityJson(actualNonContract)
	) {
		throw new Error('v3 execution-surface per-file hash drift');
	}
	const repositoryRoot = resolve(input.repositoryRoot);
	const dispatchPath = compatibility.repositoryDispatch.path;
	const dispatchAbsolute = resolve(repositoryRoot, dispatchPath);
	if (!dispatchAbsolute.startsWith(`${repositoryRoot}${sep}`)) {
		throw new Error('Repository dispatch entrypoint escapes the repository');
	}
	let cursor = repositoryRoot;
	for (const part of relative(repositoryRoot, dispatchAbsolute).split(sep).filter(Boolean)) {
		cursor = join(cursor, part);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink())
			throw new Error('Repository dispatch entrypoint path is symlinked');
	}
	const dispatchBytes = await readFile(dispatchAbsolute);
	if (familyAffinityRawSha256(dispatchBytes) !== compatibility.repositoryDispatch.sha256) {
		throw new Error('Repository dispatch entrypoint drifted from approval');
	}
	await assertApprovedAbsoluteRegularPath(compatibility.sealedLauncher.node.path);
	if (
		(await realpath(process.execPath)) !== compatibility.sealedLauncher.node.path ||
		(await rawFileSha256(compatibility.sealedLauncher.node.path)) !==
			compatibility.sealedLauncher.node.sha256
	) {
		throw new Error('Active Node runtime differs from the approved sealed launcher');
	}
	const launcherBundle = installed.files.find(
		({ path }) => path === compatibility.sealedLauncher.bundle.path
	);
	if (!launcherBundle || launcherBundle.sha256 !== compatibility.sealedLauncher.bundle.sha256) {
		throw new Error('Sealed family dispatch bundle drifted from approval');
	}
	for (const source of compatibility.sealedLauncher.sources) {
		const absolute = await assertRealRegularPath(repositoryRoot, source.path);
		if ((await rawFileSha256(absolute)) !== source.sha256) {
			throw new Error(`Sealed family dispatch source drifted from approval: ${source.path}`);
		}
	}
	return {
		status: 'compatible' as const,
		bundleSha256: installed.bundleSha256,
		contractSha256: familyAffinityRawSha256(installed.contractBytes),
		contractBytes: installed.contractBytes,
		root: installed.root,
		files: installed.files
	};
}

async function assertOutputAbsentWithoutSymlinks(repositoryRoot: string, ownedPath: string) {
	const root = resolve(repositoryRoot);
	const absolute = resolve(root, ownedPath);
	if (!absolute.startsWith(`${root}${sep}`)) throw new Error('Dispatch output escapes repository');
	const parts = relative(root, absolute).split(sep).filter(Boolean);
	let cursor = root;
	for (const part of parts) {
		cursor = join(cursor, part);
		try {
			const metadata = await lstat(cursor);
			if (metadata.isSymbolicLink())
				throw new Error(`Dispatch output path is symlinked: ${ownedPath}`);
			if (cursor === absolute) throw new Error(`Dispatch output collision: ${ownedPath}`);
			if (!metadata.isDirectory())
				throw new Error(`Dispatch output parent is not a directory: ${ownedPath}`);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
			throw error;
		}
	}
}

export async function checkFamilyAffinityProductionDispatch(input: {
	repositoryRoot: string;
	targetPath: string;
	assignmentPath: string;
	installedSkillRoot?: string;
	phase?: 'candidate' | 'result';
	result?: unknown;
}) {
	const repositoryRoot = resolve(input.repositoryRoot);
	const receipt = JSON.parse(
		await readFile(
			join(repositoryRoot, FAMILY_AFFINITY_ROOT, 'production-compatibility.json'),
			'utf8'
		)
	);
	const trackedSkillRoot = join(repositoryRoot, 'skills/summonlab-image-production');
	const installedSkillRoot =
		input.installedSkillRoot ?? join(homedir(), '.codex/skills/summonlab-image-production');
	const surface = await validateFamilyAffinityProductionSurface({
		compatibility: receipt,
		trackedSkillRoot,
		installedSkillRoot,
		repositoryRoot
	});
	const manifestPath = `${FAMILY_AFFINITY_ROOT}/manifest.json`;
	const [manifestBytes, targetBytes, assignmentBytes] = await Promise.all([
		readFamilyAffinityOwnedFile(repositoryRoot, manifestPath),
		readFamilyAffinityOwnedFile(repositoryRoot, input.targetPath),
		readFamilyAffinityOwnedFile(repositoryRoot, input.assignmentPath)
	]);
	const manifest = FamilyAffinityManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
	const target = FamilyAffinityTargetSchema.parse(JSON.parse(targetBytes.toString('utf8')));
	const assignment = FamilyAffinityAssignmentSchema.parse(
		JSON.parse(assignmentBytes.toString('utf8'))
	);
	const coordinates =
		target.namespace === 'canonical'
			? manifest.canonicalMatrix.activeCoordinates
			: manifest.bridge.activeCoordinates;
	const coordinate = coordinates.find(({ coordinateId }) => coordinateId === target.coordinateId);
	if (
		!coordinate ||
		coordinate.targetPath !== input.targetPath ||
		coordinate.assignmentPath !== input.assignmentPath ||
		coordinate.targetSha256 !== familyAffinitySha256(target) ||
		coordinate.assignmentSha256 !== familyAffinitySha256(assignment) ||
		coordinate.status !== target.status
	) {
		throw new Error('Dispatch target/assignment is stale or manifest-unbound');
	}
	validateFamilyAffinityAttemptCrossBinding(coordinate, target, assignment);
	if (
		target.status !== 'planned' &&
		target.status !== 'planned-provisional-anchor' &&
		target.status !== 'earth-bridge-provisional'
	) {
		throw new Error(`Target status is not dispatchable: ${target.status} (${target.targetId})`);
	}
	await validateFamilyAffinityNormalAnchorEvidence({
		repositoryRoot,
		manifestPath,
		targetPath: input.targetPath
	});
	const familyPacketBytes = await readFamilyAffinityOwnedFile(
		repositoryRoot,
		familyAffinitySourcePacketBinding(target).path
	);
	const promptBytes = Buffer.from(
		stableFamilyAffinityJson({
			schemaVersion: 'family-affinity-prompt-material-v1',
			target,
			assignment
		}).slice(0, -1)
	);
	if (familyAffinityRawSha256(promptBytes) !== familyAffinityPromptSha256(target, assignment)) {
		throw new Error('Repository prompt bytes do not match the active target and assignment');
	}
	preflightFamilyAffinityProductionDispatch({
		compatibility: receipt,
		installedContractBytes: surface.contractBytes,
		target,
		assignment,
		targetPath: input.targetPath,
		assignmentPath: input.assignmentPath,
		familyPacketBytes,
		renderedPromptBytes: promptBytes
	});
	const phase = input.phase ?? 'candidate';
	if (phase === 'candidate') {
		if (input.result !== undefined) {
			throw new Error('Candidate dispatch phase cannot accept result material');
		}
		await Promise.all([
			assertOutputAbsentWithoutSymlinks(repositoryRoot, target.ownedPaths.candidate),
			assertOutputAbsentWithoutSymlinks(repositoryRoot, target.ownedPaths.result)
		]);
	} else {
		if (input.result === undefined) {
			throw new Error('Result dispatch phase requires exact in-memory result material');
		}
		const [candidateBytes] = await Promise.all([
			readFamilyAffinityOwnedFile(repositoryRoot, target.ownedPaths.candidate),
			assertOutputAbsentWithoutSymlinks(repositoryRoot, target.ownedPaths.result)
		]);
		validateFamilyAffinityCandidateEvidence({
			target,
			assignment,
			familyPacketBytes,
			candidateBytes,
			resultBytes: Buffer.from(stableFamilyAffinityJson(input.result).slice(0, -1))
		});
	}
	return {
		dispatchable: true as const,
		phase,
		state: 'candidate-only' as const,
		targetId: target.targetId,
		affinity: target.affinity,
		status: target.status,
		profile: receipt.profile,
		bundleSha256: surface.bundleSha256,
		promptSha256: familyAffinityRawSha256(promptBytes),
		candidatePath: target.ownedPaths.candidate,
		resultPath: target.ownedPaths.result
	};
}

async function readJsonFromStdin(): Promise<unknown> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	const bytes = Buffer.concat(chunks);
	if (bytes.length === 0) throw new Error('Result dispatch phase requires JSON on stdin');
	return JSON.parse(bytes.toString('utf8'));
}

const cliEntrypoint = process.argv[1];
if (
	cliEntrypoint &&
	(import.meta.url === pathToFileURL(cliEntrypoint).href ||
		cliEntrypoint.startsWith('/proc/self/fd/'))
) {
	const argumentsAfterScript = process.argv.slice(2);
	const tokens =
		argumentsAfterScript[0] === '--' ? argumentsAfterScript.slice(1) : argumentsAfterScript;
	const targetPath = tokens.shift();
	const assignmentPath = tokens.shift();
	const repositoryRoot = tokens[0] && tokens[0] !== '--phase' ? tokens.shift()! : process.cwd();
	let phase: 'candidate' | 'result' = 'candidate';
	let installedSkillRoot: string | undefined;
	while (tokens.length > 0) {
		const option = tokens.shift();
		const value = tokens.shift();
		if (!value) break;
		if (option === '--phase' && (value === 'candidate' || value === 'result')) {
			phase = value;
		} else if (option === '--installed-skill-root') {
			installedSkillRoot = value;
		} else {
			tokens.unshift(value);
			break;
		}
	}
	if (!targetPath || !assignmentPath || tokens.length !== 0) {
		console.error(
			'usage: check-family-affinity-production-dispatch.ts TARGET ASSIGNMENT [REPOSITORY_ROOT] [--phase candidate|result] [--installed-skill-root PATH]'
		);
		process.exitCode = 2;
	} else {
		Promise.resolve(phase === 'result' ? readJsonFromStdin() : undefined)
			.then((result) =>
				checkFamilyAffinityProductionDispatch({
					repositoryRoot,
					targetPath,
					assignmentPath,
					phase,
					...(installedSkillRoot ? { installedSkillRoot } : {}),
					result
				})
			)
			.then((report) => console.log(JSON.stringify(report, null, 2)))
			.catch((error: unknown) => {
				console.error(error instanceof Error ? error.message : String(error));
				process.exitCode = 1;
			});
	}
}
