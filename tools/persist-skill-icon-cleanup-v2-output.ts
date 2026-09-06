import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';

import {
	SkillIconCleanupRevisionCompletionAuditSchema,
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
	publishStaged,
	readSafeAbsoluteFile,
	readSafeRepositoryFile,
	removeOwnedPath,
	stageOutput,
	type SafeSnapshot,
	type StagedOutput
} from './persist-skill-icon-cleanup-output.js';
import {
	cleanupRevisionCompletionAuditPath,
	cleanupRevisionPacketPath,
	cleanupRevisionV2JsonBytes,
	computeCleanupRevisionTransactionContentHash,
	deriveCleanupRevisionV2,
	assertIdentityAdoptionPredecessorBindings,
	type CleanupRevisionV2AuthorityBytes,
	type CleanupRevisionV2DerivationPhase,
	type CleanupRevisionV2Packet
} from './skill-icon-quality-cleanup-v2-lib.js';

const CLEANUP_REVISION_PACKET_PATH =
	/^assets\/wiki\/skills\/icon-production-v1\/quality-cleanup-v1\/prompts\/revisions-v(?:[2-9]|[1-9][0-9]+)\/[a-z0-9]+(?:-[a-z0-9]+)*-v(?:[2-9]|[1-9][0-9]+)\.json$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

export interface PersistCleanupRevisionV2CliRequest {
	readonly packetPath: string;
	readonly fullSizeOutcome: 'pass' | 'fail';
	readonly fullSizeObservation: string;
	readonly display384Outcome: 'pass' | 'fail';
	readonly display384Observation: string;
	/** Required only by the generation-v2 lane. */
	readonly sourcePath?: string;
	readonly sourceHash?: string;
	readonly attemptCount?: 1 | 2;
	readonly generationCallIdentifiers?: readonly string[];
	readonly generationCallContentHashes?: readonly string[];
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
		'--source',
		'--source-hash',
		'--attempt-count',
		'--generation-call-id',
		'--generation-call-hash',
		'--full-size-outcome',
		'--full-size-observation',
		'--display-384-outcome',
		'--display-384-observation'
	]);
	const values = new Map<string, string>();
	const generationCallIdentifiers: string[] = [];
	const generationCallContentHashes: string[] = [];
	for (let index = 0; index < normalizedArgs.length; index += 2) {
		const flag = normalizedArgs[index];
		const value = normalizedArgs[index + 1];
		if (!flag || !allowed.has(flag) || !value) {
			throw new Error(`Unknown or incomplete argument: ${flag ?? '<missing>'}`);
		}
		if (flag === '--generation-call-id') {
			generationCallIdentifiers.push(value);
			continue;
		}
		if (flag === '--generation-call-hash') {
			generationCallContentHashes.push(value);
			continue;
		}
		if (values.has(flag)) throw new Error(`Duplicate argument: ${flag}`);
		values.set(flag, value);
	}
	const packetPath = required(values, '--packet');
	if (!CLEANUP_REVISION_PACKET_PATH.test(packetPath)) {
		throw new Error('--packet must be a canonical cleanup revision packet path');
	}
	const hasGenerationArguments =
		values.has('--source') ||
		values.has('--source-hash') ||
		values.has('--attempt-count') ||
		generationCallIdentifiers.length > 0 ||
		generationCallContentHashes.length > 0;
	const request: PersistCleanupRevisionV2CliRequest = {
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
	if (!hasGenerationArguments) return request;
	const sourcePath = required(values, '--source');
	if (!path.isAbsolute(sourcePath)) throw new Error('--source must be an absolute path');
	const sourceHash = required(values, '--source-hash');
	if (!SHA256.test(sourceHash)) throw new Error('--source-hash must be a lowercase SHA-256 hash');
	const attemptCountValue = required(values, '--attempt-count');
	if (attemptCountValue !== '1' && attemptCountValue !== '2') {
		throw new Error('--attempt-count must be one or two');
	}
	const attemptCount = Number(attemptCountValue) as 1 | 2;
	if (
		generationCallIdentifiers.length !== attemptCount ||
		generationCallContentHashes.length !== attemptCount
	) {
		throw new Error(
			'Generation persistence requires one call identifier and hash per actual attempt'
		);
	}
	if (
		generationCallIdentifiers.some((value) => value.trim().length === 0) ||
		generationCallContentHashes.some((value) => !SHA256.test(value))
	) {
		throw new Error(
			'Generation call identifiers must be nonempty and call hashes must be lowercase SHA-256'
		);
	}
	return {
		...request,
		sourcePath,
		sourceHash,
		attemptCount,
		generationCallIdentifiers,
		generationCallContentHashes
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
	// Persisting an identity lane repeats this check before it binds any source.
	// This makes a cross-target/same-rank transform fail before a transaction can
	// stage or publish an artifact, even if a caller bypasses packet builders.
	assertIdentityAdoptionPredecessorBindings(packet, packet.predecessor);
	const request = (
		binding: { readonly path: string; readonly contentHash: string },
		description: string
	) => ({ repositoryPath: binding.path, contentHash: binding.contentHash, description });
	const requests = [
		request(packet.predecessor.packet, 'Immutable immediate predecessor revision packet'),
		request(packet.predecessor.result, 'Immutable immediate predecessor revision result'),
		request(packet.predecessor.providerSource, 'Immutable immediate predecessor provider source'),
		request(packet.predecessor.revisedInterior, 'Immutable immediate predecessor revised interior'),
		request(packet.predecessor.composite, 'Immutable immediate predecessor composite'),
		...Object.entries(packet.compositionAuthority).map(([name, binding]) => ({
			repositoryPath: binding.path,
			contentHash: binding.contentHash,
			description: `Revision composition ${name} authority`
		})),
		...packet.references.map((reference, index) => ({
			repositoryPath: reference.path,
			contentHash: reference.contentHash,
			description: `Revision ordered reference ${index + 1}`
		}))
	];
	if (packet.sourceMode === 'identity-adoption') {
		if (!('revisedInterior' in packet.transform) || !('composite' in packet.transform)) {
			throw new Error(`Identity-adoption transform is malformed: ${packet.targetId}`);
		}
		requests.push(
			request(packet.transform.revisedInterior, 'Immediate identity-adoption interior'),
			request(packet.transform.composite, 'Immediate identity-adoption composite')
		);
	}
	return requests;
}

/**
 * Authenticate create-only published artifacts through their canonical named
 * paths, rather than only through held directory descriptors. `readSafe...`
 * supplies O_NOFOLLOW/O_NONBLOCK reads and verifies the canonical parent and
 * file identities while it reads, so a symlink, FIFO, parent swap, or inode
 * replacement after audit publication fails closed.
 */
async function assertPublishedOutputs(
	outputs: readonly StagedOutput[],
	description: string
): Promise<void> {
	for (const output of outputs) {
		await assertAllHeldParentsNamed(outputs);
		await assertOwnedPath(output.destination, output, description);
		const snapshot = await readSafeAbsoluteFile(output.destination, description);
		if (
			snapshot.parent.realPath !== output.parent.realPath ||
			snapshot.parent.device !== BigInt(output.parent.device) ||
			snapshot.parent.inode !== BigInt(output.parent.inode) ||
			snapshot.file.device !== BigInt(output.device) ||
			snapshot.file.inode !== BigInt(output.inode) ||
			!snapshot.bytes.equals(output.bytes)
		) {
			throw new Error(`${description} identity or bytes changed: ${output.repositoryPath}`);
		}
		await assertOwnedPath(output.destination, output, description);
		await assertAllHeldParentsNamed(outputs);
	}
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
			description: 'Cleanup revision packet',
			repositoryPath: packetSnapshot.path,
			snapshot: packetSnapshot
		}
	];
	for (const [repositoryPath, request] of unique) {
		const description = request.descriptions.join(' / ');
		const snapshot = await readSafeRepositoryFile(root, repositoryPath, description);
		if (sha256(snapshot.bytes) !== request.contentHash) {
			throw new Error(`${description} hash changed before revision persistence: ${repositoryPath}`);
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
	const expected = cleanupRevisionPacketPath(packet.targetId, packet.revision);
	if (packetPath !== expected) {
		throw new Error('Cleanup revision packet path does not bind its target and revision identity');
	}
}

export async function persistCleanupRevisionV2(
	input: PersistCleanupRevisionV2Input
): Promise<SkillIconCleanupRevisionV2Result> {
	const requestArguments = [
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
	];
	if (input.sourcePath !== undefined) requestArguments.push('--source', input.sourcePath);
	if (input.sourceHash !== undefined) requestArguments.push('--source-hash', input.sourceHash);
	if (input.attemptCount !== undefined)
		requestArguments.push('--attempt-count', String(input.attemptCount));
	for (const callIdentifier of input.generationCallIdentifiers ?? []) {
		requestArguments.push('--generation-call-id', callIdentifier);
	}
	for (const callContentHash of input.generationCallContentHashes ?? []) {
		requestArguments.push('--generation-call-hash', callContentHash);
	}
	const request = parsePersistCleanupRevisionV2CliRequest(requestArguments);
	const root = path.resolve(input.root ?? process.cwd());
	const testHooks = input.testHooks ? { ...input.testHooks } : undefined;
	const executionStartedAt = new Date().toISOString();
	const executionStarted = process.hrtime.bigint();
	const sourceRead = await measurePhase('source-read', async () => {
		const packetSnapshot = await readSafeRepositoryFile(
			root,
			request.packetPath,
			'Cleanup revision packet'
		);
		const packet = SkillIconCleanupRevisionV2PacketSchema.parse(
			JSON.parse(packetSnapshot.bytes.toString('utf8')) as unknown
		);
		assertPacketPath(request.packetPath, packet);
		const bindings = [...(await bindAuthorities(root, packetSnapshot, packet))];
		let generationSource: SafeSnapshot | undefined;
		if (packet.sourceMode === 'generation-v2') {
			if (
				!request.sourcePath ||
				!request.sourceHash ||
				request.attemptCount === undefined ||
				!request.generationCallIdentifiers ||
				!request.generationCallContentHashes
			) {
				throw new Error(
					`Cleanup generation-v2 persistence requires authenticated source/call provenance: ${packet.targetId}`
				);
			}
			generationSource = await readSafeAbsoluteFile(
				request.sourcePath,
				'Cleanup generation-v2 native provider source'
			);
			if (sha256(generationSource.bytes) !== request.sourceHash) {
				throw new Error(`Cleanup generation-v2 source hash drift: ${packet.targetId}`);
			}
			const provider = prepareSkillIconProviderSourceV3(generationSource.bytes).source;
			if (provider.contentHash !== request.sourceHash) {
				throw new Error(`Cleanup generation-v2 provider envelope hash drift: ${packet.targetId}`);
			}
			if (request.generationCallContentHashes.at(-1) !== request.sourceHash) {
				throw new Error(
					`Cleanup generation-v2 final provider must bind the final call content hash: ${packet.targetId}`
				);
			}
			bindings.push({
				description: 'Cleanup generation-v2 native provider source',
				repositoryPath: generationSource.path,
				snapshot: generationSource
			});
		} else if (
			request.sourcePath !== undefined ||
			request.sourceHash !== undefined ||
			request.attemptCount !== undefined ||
			(request.generationCallIdentifiers?.length ?? 0) !== 0 ||
			(request.generationCallContentHashes?.length ?? 0) !== 0
		) {
			throw new Error(
				`Deterministic cleanup lane cannot claim generation provenance: ${packet.targetId}`
			);
		}
		return {
			packetSnapshot,
			packet,
			bindings,
			generationSource
		};
	});
	const { packetSnapshot, packet, bindings, generationSource } = sourceRead.value;
	for (const repositoryPath of Object.values(packet.output)) {
		if (bindings.some(({ snapshot }) => snapshot.path === path.resolve(root, repositoryPath))) {
			throw new Error('Cleanup v2 authority cannot also be a destination');
		}
	}
	await testHooks?.afterAuthorityRead?.();

	const derived = await deriveCleanupRevisionV2({
		root,
		packet,
		authorityBytes: authorityByteMap(bindings),
		...(generationSource ? { generationSourceBytes: generationSource.bytes } : {})
	});
	await testHooks?.afterDerivation?.();
	const provider = prepareSkillIconProviderSourceV3(derived.sourceBytes).source;
	if (
		packet.sourceMode !== 'generation-v2' &&
		provider.contentHash !== packet.predecessor.providerSource.contentHash
	) {
		throw new Error(`Cleanup revision provider identity drift: ${packet.targetId}`);
	}
	if (packet.sourceMode === 'generation-v2' && provider.contentHash !== request.sourceHash) {
		throw new Error(`Cleanup generation-v2 persisted provider hash drift: ${packet.targetId}`);
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
		...derived.phases.map(phaseFromDerivation)
	];
	const execution = {
		startedAt: executionStartedAt,
		finishedAt: executionFinishedAt,
		durationMs: executionDurationMs,
		phases,
		generation:
			packet.sourceMode === 'generation-v2'
				? {
						attemptCount: request.attemptCount!,
						callIdentifiers: [...request.generationCallIdentifiers!],
						callContentHashes: [...request.generationCallContentHashes!]
					}
				: {
						attemptCount: 0 as const,
						callIdentifiers: [] as string[],
						callContentHashes: [] as string[]
					},
		normalizationTransactionCount: derived.normalizationTransactionCount,
		invocation: {
			tool: 'tools/persist-skill-icon-cleanup-v2-output.ts' as const,
			command: 'persist:skill-icon-cleanup-v2-output' as const,
			nodeVersion: process.version,
			sharpVersion: sharp.versions.sharp,
			vipsVersion: sharp.versions.vips
		}
	};
	const transactionContentHash = computeCleanupRevisionTransactionContentHash({
		packetContentHash: packetHash,
		predecessor: packet.predecessor,
		sourceMode: packet.sourceMode,
		transform: packet.transform,
		providerSourceContentHash: providerEvidence.contentHash,
		revisedInteriorContentHash: interiorEvidence.contentHash,
		compositionAuthority: packet.compositionAuthority,
		compositeContentHash: compositeEvidence.contentHash,
		display384ContentHash: display384Evidence.contentHash,
		inspection,
		execution,
		output: packet.output
	});
	const result = SkillIconCleanupRevisionV2ResultSchema.parse({
		schemaVersion: `skill-icon-quality-cleanup-revision-result-v${packet.revision}`,
		revision: packet.revision,
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
		const corePublicationStartedAt = new Date().toISOString();
		const corePublicationStarted = process.hrtime.bigint();
		for (const [index, output] of staged.entries()) {
			await publishStaged(output);
			await testHooks?.afterPublish?.(index, output.repositoryPath);
			await assertAllHeldParentsNamed(staged);
		}
		await assertAuthoritiesUnchanged(bindings);
		await assertPublishedOutputs(staged, 'Cleanup v2 revision output');
		const corePublicationCompletedAt = new Date().toISOString();
		const corePublicationDurationMs = Number(
			(process.hrtime.bigint() - corePublicationStarted) / 1_000_000n
		);
		const resultBytes = outputBytes[3].bytes;
		const completionAudit = SkillIconCleanupRevisionCompletionAuditSchema.parse({
			schemaVersion: 'skill-icon-quality-cleanup-revision-completion-audit-v1',
			revision: packet.revision,
			targetId: packet.targetId,
			revisionPacket: { path: request.packetPath, contentHash: packetHash },
			result: { path: packet.output.resultPath, contentHash: sha256(resultBytes) },
			status: result.status,
			corePublication: {
				startedAt: corePublicationStartedAt,
				completedAt: corePublicationCompletedAt,
				durationMs: corePublicationDurationMs,
				artifacts: {
					providerSource: {
						path: providerEvidence.path,
						contentHash: providerEvidence.contentHash
					},
					revisedInterior: {
						path: interiorEvidence.path,
						contentHash: interiorEvidence.contentHash
					},
					composite: {
						path: compositeEvidence.path,
						contentHash: compositeEvidence.contentHash
					},
					result: { path: packet.output.resultPath, contentHash: sha256(resultBytes) }
				}
			}
		});
		for (const output of staged) await removeOwnedPath(output.temporaryPath, output);
		await assertAllHeldParentsNamed(staged);

		// The audit is staged only after all four core files were published and
		// re-read through their held parents. It intentionally has no claim about
		// when its own create-only publication finishes.
		const auditPath = cleanupRevisionCompletionAuditPath(packet.targetId, packet.revision);
		const auditStaged = await stageOutput(
			root,
			auditPath,
			cleanupRevisionV2JsonBytes(completionAudit)
		);
		staged.push(auditStaged);
		await assertAuthoritiesUnchanged(bindings);
		await publishStaged(auditStaged);
		await testHooks?.afterPublish?.(4, auditPath);
		// This is the post-audit return gate: reauthenticate every core artifact
		// plus its audit by canonical path, inode, and bytes before exposing a
		// candidate to the caller.
		await assertPublishedOutputs(staged, 'Cleanup revision completion artifact');
		await removeOwnedPath(auditStaged.temporaryPath, auditStaged);
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
