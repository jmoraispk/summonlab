import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';

import {
	SkillIconCleanupRevisionV2PacketSchema,
	SkillIconCleanupRevisionV2ResultSchema,
	type SkillIconCleanupRevisionV2Result
} from '../packages/contracts/src/index.js';
import {
	SKILL_ICON_NORMALIZER_SHARP_VERSION,
	SKILL_ICON_NORMALIZER_VIPS_VERSION,
	prepareSkillIconProviderSourceV3
} from './normalize-skill-icon-provider-source.js';
import {
	assertAllHeldParentsNamed,
	assertOwnedPath,
	assertSnapshotUnchanged,
	cleanupTransaction,
	heldChild,
	publishStaged,
	readSafeRepositoryFile,
	removeOwnedPath,
	stageOutput,
	type SafeSnapshot,
	type StagedOutput
} from './persist-skill-icon-cleanup-output.js';
import {
	cleanupRevisionV2JsonBytes,
	deriveCleanupRevisionV2,
	type CleanupRevisionV2AuthorityBytes,
	type CleanupRevisionV2DerivationPhase,
	type CleanupRevisionV2Packet
} from './skill-icon-quality-cleanup-v2-lib.js';

const CLEANUP_V2_PACKET_PATH =
	/^assets\/wiki\/skills\/icon-production-v1\/quality-cleanup-v1\/prompts\/revisions-v2\/[a-z0-9]+(?:-[a-z0-9]+)*-v2\.json$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

export interface PersistCleanupRevisionV2CliRequest {
	readonly packetPath: string;
	readonly fullSizeOutcome: 'pass' | 'fail';
	readonly fullSizeObservation: string;
	readonly display384Outcome: 'pass' | 'fail';
	readonly display384Observation: string;
}

export interface PersistCleanupRevisionV2TestHooks {
	readonly afterAuthorityRead?: () => void | Promise<void>;
	readonly afterDerivation?: () => void | Promise<void>;
	readonly afterStage?: () => void | Promise<void>;
	readonly afterPublish?: (index: number, repositoryPath: string) => void | Promise<void>;
	readonly beforeRollbackDetach?: (repositoryPath: string) => void | Promise<void>;
}

export interface PersistCleanupRevisionV2Input extends PersistCleanupRevisionV2CliRequest {
	readonly root?: string;
	/** @internal Test-only synchronization around authenticated transaction boundaries. */
	readonly testHooks?: PersistCleanupRevisionV2TestHooks;
}

interface AuthorityBinding {
	readonly description: string;
	readonly repositoryPath: string;
	readonly snapshot: SafeSnapshot;
}

interface ExecutionPhase {
	readonly name: 'source-read' | 'normalization' | 'composition' | 'inspection' | 'publication';
	readonly startedAt: string;
	readonly finishedAt: string;
	readonly durationMs: number;
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function required(values: ReadonlyMap<string, string>, name: string): string {
	const value = values.get(name);
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

function outcome(value: string, name: string): 'pass' | 'fail' {
	if (value !== 'pass' && value !== 'fail') throw new Error(`${name} must be pass or fail`);
	return value;
}

function observation(value: string, name: string): string {
	const normalized = value.trim();
	if (normalized.length === 0 || normalized.length > 1_000) {
		throw new Error(`${name} must contain between 1 and 1000 characters`);
	}
	return normalized;
}

export function parsePersistCleanupRevisionV2CliRequest(
	args: readonly string[]
): PersistCleanupRevisionV2CliRequest {
	const normalizedArgs = args[0] === '--' ? args.slice(1) : [...args];
	if (normalizedArgs.includes('--')) {
		throw new Error(
			'The -- argument separator is allowed only once and only as the first argument'
		);
	}
	const allowed = new Set([
		'--packet',
		'--full-size-outcome',
		'--full-size-observation',
		'--display-384-outcome',
		'--display-384-observation'
	]);
	const values = new Map<string, string>();
	for (let index = 0; index < normalizedArgs.length; index += 2) {
		const flag = normalizedArgs[index];
		const value = normalizedArgs[index + 1];
		if (!flag || !allowed.has(flag) || !value) {
			throw new Error(`Unknown or incomplete argument: ${flag ?? '<missing>'}`);
		}
		if (values.has(flag)) throw new Error(`Duplicate argument: ${flag}`);
		values.set(flag, value);
	}
	const packetPath = required(values, '--packet');
	if (!CLEANUP_V2_PACKET_PATH.test(packetPath)) {
		throw new Error('--packet must be a canonical cleanup revision-v2 packet path');
	}
	return {
		packetPath,
		fullSizeOutcome: outcome(required(values, '--full-size-outcome'), '--full-size-outcome'),
		fullSizeObservation: observation(
			required(values, '--full-size-observation'),
			'--full-size-observation'
		),
		display384Outcome: outcome(required(values, '--display-384-outcome'), '--display-384-outcome'),
		display384Observation: observation(
			required(values, '--display-384-observation'),
			'--display-384-observation'
		)
	};
}

function artifactEvidence(pathValue: string, bytes: Buffer, width: number, height: number) {
	return {
		path: pathValue,
		mediaType: 'image/png' as const,
		width,
		height,
		bytes: bytes.byteLength,
		contentHash: sha256(bytes)
	};
}

function phaseFromDerivation(phase: CleanupRevisionV2DerivationPhase): ExecutionPhase {
	return phase;
}

async function measurePhase<T>(
	name: ExecutionPhase['name'],
	operation: () => Promise<T>
): Promise<{ readonly value: T; readonly phase: ExecutionPhase }> {
	const startedAt = new Date().toISOString();
	const started = process.hrtime.bigint();
	try {
		const value = await operation();
		const finishedAt = new Date().toISOString();
		return {
			value,
			phase: {
				name,
				startedAt,
				finishedAt,
				durationMs: Number((process.hrtime.bigint() - started) / 1_000_000n)
			}
		};
	} catch (error) {
		throw error;
	}
}

function bindingRequests(packet: CleanupRevisionV2Packet): readonly {
	readonly repositoryPath: string;
	readonly contentHash: string;
	readonly description: string;
}[] {
	const request = (
		binding: { readonly path: string; readonly contentHash: string },
		description: string
	) => ({ repositoryPath: binding.path, contentHash: binding.contentHash, description });
	const requests = [
		request(packet.predecessor.packet, 'Immutable v1 revision packet'),
		request(packet.predecessor.result, 'Immutable v1 revision result'),
		request(packet.predecessor.providerSource, 'Immutable v1 provider source'),
		request(packet.predecessor.revisedInterior, 'Immutable v1 revised interior'),
		request(packet.predecessor.composite, 'Immutable v1 composite'),
		...Object.entries(packet.compositionAuthority).map(([name, binding]) => ({
			repositoryPath: binding.path,
			contentHash: binding.contentHash,
			description: `V2 composition ${name} authority`
		})),
		...packet.references.map((reference, index) => ({
			repositoryPath: reference.path,
			contentHash: reference.contentHash,
			description: `V2 ordered reference ${index + 1}`
		}))
	];
	if (packet.transform.kind === 'identity-adoption-v1') {
		requests.push(
			request(packet.transform.revisedInterior, 'V1 identity-adoption interior'),
			request(packet.transform.composite, 'V1 identity-adoption composite')
		);
	}
	return requests;
}

async function bindAuthorities(
	root: string,
	packetSnapshot: SafeSnapshot,
	packet: CleanupRevisionV2Packet
): Promise<readonly AuthorityBinding[]> {
	const unique = new Map<
		string,
		{ readonly contentHash: string; readonly descriptions: string[] }
	>();
	for (const request of bindingRequests(packet)) {
		const previous = unique.get(request.repositoryPath);
		if (previous && previous.contentHash !== request.contentHash) {
			throw new Error(`Conflicting cleanup v2 authority hashes: ${request.repositoryPath}`);
		}
		unique.set(request.repositoryPath, {
			contentHash: request.contentHash,
			descriptions: [...(previous?.descriptions ?? []), request.description]
		});
	}
	const bindings: AuthorityBinding[] = [
		{
			description: 'Cleanup v2 revision packet',
			repositoryPath: packetSnapshot.path,
			snapshot: packetSnapshot
		}
	];
	for (const [repositoryPath, request] of unique) {
		const description = request.descriptions.join(' / ');
		const snapshot = await readSafeRepositoryFile(root, repositoryPath, description);
		if (sha256(snapshot.bytes) !== request.contentHash) {
			throw new Error(`${description} hash changed before v2 persistence: ${repositoryPath}`);
		}
		bindings.push({ description, repositoryPath, snapshot });
	}
	return bindings;
}

function authorityByteMap(bindings: readonly AuthorityBinding[]): CleanupRevisionV2AuthorityBytes {
	return Object.fromEntries(
		bindings
			.filter(({ repositoryPath }) => !path.isAbsolute(repositoryPath))
			.map(({ repositoryPath, snapshot }) => [repositoryPath, snapshot.bytes])
	);
}

async function assertAuthoritiesUnchanged(bindings: readonly AuthorityBinding[]): Promise<void> {
	for (const binding of bindings) {
		await assertSnapshotUnchanged(binding.snapshot, binding.description);
	}
}

function assertPacketPath(packetPath: string, packet: CleanupRevisionV2Packet): void {
	const expected = `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/prompts/revisions-v2/${packet.targetId.replaceAll(':', '-')}-v2.json`;
	if (packetPath !== expected) {
		throw new Error('Cleanup v2 revision packet path does not bind its target identity');
	}
}

function makePublicationPlaceholder(): ExecutionPhase {
	const timestamp = new Date().toISOString();
	return { name: 'publication', startedAt: timestamp, finishedAt: timestamp, durationMs: 0 };
}

export async function persistCleanupRevisionV2(
	input: PersistCleanupRevisionV2Input
): Promise<SkillIconCleanupRevisionV2Result> {
	const request = parsePersistCleanupRevisionV2CliRequest([
		'--packet',
		input.packetPath,
		'--full-size-outcome',
		input.fullSizeOutcome,
		'--full-size-observation',
		input.fullSizeObservation,
		'--display-384-outcome',
		input.display384Outcome,
		'--display-384-observation',
		input.display384Observation
	]);
	const root = path.resolve(input.root ?? process.cwd());
	const testHooks = input.testHooks ? { ...input.testHooks } : undefined;
	const executionStartedAt = new Date().toISOString();
	const executionStarted = process.hrtime.bigint();
	const sourceRead = await measurePhase('source-read', async () => {
		const packetSnapshot = await readSafeRepositoryFile(
			root,
			request.packetPath,
			'Cleanup v2 revision packet'
		);
		const packet = SkillIconCleanupRevisionV2PacketSchema.parse(
			JSON.parse(packetSnapshot.bytes.toString('utf8')) as unknown
		);
		assertPacketPath(request.packetPath, packet);
		if (packet.sourceMode === 'generation-v2') {
			throw new Error(
				`Cleanup v2 generation lane cannot be persisted without an authenticated generation result: ${packet.targetId}`
			);
		}
		return {
			packetSnapshot,
			packet,
			bindings: await bindAuthorities(root, packetSnapshot, packet)
		};
	});
	const { packetSnapshot, packet, bindings } = sourceRead.value;
	for (const repositoryPath of Object.values(packet.output)) {
		if (bindings.some(({ snapshot }) => snapshot.path === path.resolve(root, repositoryPath))) {
			throw new Error('Cleanup v2 authority cannot also be a destination');
		}
	}
	await testHooks?.afterAuthorityRead?.();

	const derived = await deriveCleanupRevisionV2({
		root,
		packet,
		authorityBytes: authorityByteMap(bindings)
	});
	await testHooks?.afterDerivation?.();
	const provider = prepareSkillIconProviderSourceV3(derived.sourceBytes).source;
	if (provider.contentHash !== packet.predecessor.providerSource.contentHash) {
		throw new Error(`Cleanup v2 provider identity drift: ${packet.targetId}`);
	}
	const packetHash = sha256(packetSnapshot.bytes);
	const providerEvidence = { path: packet.output.providerSourcePath, ...provider };
	const interiorEvidence = artifactEvidence(
		packet.output.revisedInteriorPath,
		derived.revisedInterior,
		1024,
		1024
	);
	const compositeEvidence = artifactEvidence(
		packet.output.compositePath,
		derived.composite,
		1024,
		1024
	);
	const display384Evidence = {
		mediaType: 'image/png' as const,
		width: 384 as const,
		height: 384 as const,
		bytes: derived.display384.byteLength,
		contentHash: sha256(derived.display384)
	};
	const inspection = {
		fullSize: { outcome: request.fullSizeOutcome, observation: request.fullSizeObservation },
		display384: { outcome: request.display384Outcome, observation: request.display384Observation }
	};
	const executionFinishedAt = new Date().toISOString();
	const executionDurationMs = Number((process.hrtime.bigint() - executionStarted) / 1_000_000n);
	const phases: readonly ExecutionPhase[] = [
		sourceRead.phase,
		...derived.phases.map(phaseFromDerivation),
		makePublicationPlaceholder()
	];
	const execution = {
		startedAt: executionStartedAt,
		finishedAt: executionFinishedAt,
		durationMs: executionDurationMs,
		phases,
		generation: { attemptCount: 0, callIdentifiers: [] as string[] },
		normalizationTransactionCount: derived.normalizationTransactionCount,
		invocation: {
			tool: 'tools/persist-skill-icon-cleanup-v2-output.ts' as const,
			command: 'persist:skill-icon-cleanup-v2-output' as const,
			nodeVersion: process.version,
			sharpVersion: sharp.versions.sharp,
			vipsVersion: sharp.versions.vips
		}
	};
	const transactionContentHash = sha256(
		cleanupRevisionV2JsonBytes({
			packet: packetHash,
			predecessor: packet.predecessor,
			sourceMode: packet.sourceMode,
			transform: packet.transform,
			providerSource: providerEvidence.contentHash,
			revisedInterior: interiorEvidence.contentHash,
			compositionAuthority: packet.compositionAuthority,
			composite: compositeEvidence.contentHash,
			display384: display384Evidence.contentHash,
			inspection,
			execution,
			output: packet.output
		})
	);
	const result = SkillIconCleanupRevisionV2ResultSchema.parse({
		schemaVersion: 'skill-icon-quality-cleanup-revision-result-v2',
		revision: 2,
		status:
			request.fullSizeOutcome === 'pass' && request.display384Outcome === 'pass'
				? 'candidate'
				: 'revise',
		targetId: packet.targetId,
		name: packet.name,
		rank: packet.rank,
		motifFamily: packet.motifFamily,
		finding: packet.finding,
		revisionPacket: { path: request.packetPath, contentHash: packetHash },
		predecessor: packet.predecessor,
		sourceMode: packet.sourceMode,
		transform: packet.transform,
		providerSource: providerEvidence,
		revisedInterior: interiorEvidence,
		compositionAuthority: packet.compositionAuthority,
		composite: compositeEvidence,
		display384: display384Evidence,
		inspection,
		execution,
		transactionContentHash,
		resultPath: packet.output.resultPath,
		writtenOutputPaths: Object.values(packet.output),
		completionContract: { sharedFilesRemainUntouched: true, selfPromotionForbidden: true }
	});
	const outputBytes = [
		{ repositoryPath: packet.output.providerSourcePath, bytes: derived.sourceBytes },
		{ repositoryPath: packet.output.revisedInteriorPath, bytes: derived.revisedInterior },
		{ repositoryPath: packet.output.compositePath, bytes: derived.composite },
		{ repositoryPath: packet.output.resultPath, bytes: cleanupRevisionV2JsonBytes(result) }
	] as const;
	const staged: StagedOutput[] = [];
	try {
		for (const output of outputBytes) {
			staged.push(await stageOutput(root, output.repositoryPath, output.bytes));
		}
		await testHooks?.afterStage?.();
		await assertAuthoritiesUnchanged(bindings);
		for (const [index, output] of staged.entries()) {
			await publishStaged(output);
			await testHooks?.afterPublish?.(index, output.repositoryPath);
			await assertAllHeldParentsNamed(staged);
		}
		await assertAuthoritiesUnchanged(bindings);
		await assertAllHeldParentsNamed(staged);
		for (const output of staged) {
			const finalPath = heldChild(output.parent, path.basename(output.destination));
			await assertOwnedPath(finalPath, output, 'Cleanup v2 revision output');
			if (!(await readFile(finalPath)).equals(output.bytes)) {
				throw new Error(`Cleanup v2 revision output bytes changed: ${output.repositoryPath}`);
			}
		}
		for (const output of staged) await removeOwnedPath(output.temporaryPath, output);
		await assertAllHeldParentsNamed(staged);
		return result;
	} catch (error) {
		try {
			await cleanupTransaction(staged, testHooks?.beforeRollbackDetach);
		} catch (cleanupError) {
			throw new AggregateError(
				[error, cleanupError],
				'Cleanup v2 revision persistence failed and safe rollback was incomplete',
				{ cause: cleanupError }
			);
		}
		throw error;
	} finally {
		await Promise.all(staged.map(({ parent }) => parent.handle.close().catch(() => undefined)));
	}
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	let request: PersistCleanupRevisionV2CliRequest | undefined;
	try {
		request = parsePersistCleanupRevisionV2CliRequest(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
	if (request) {
		persistCleanupRevisionV2(request)
			.then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
			.catch((error: unknown) => {
				process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
				process.exitCode = 1;
			});
	}
}
