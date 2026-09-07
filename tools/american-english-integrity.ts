import { createHash } from 'node:crypto';

import type { AmericanEnglishMigrationPlan } from './american-english-migration.js';
import { equipmentIntegrityOwner } from './american-english-equipment-successors.js';
import { runtimeAndEngineIntegrityOwner } from './american-english-runtime-successors.js';
import { visualProductionIntegrityOwner } from './american-english-visual-successors.js';

export type IntegrityBindingKind =
	| 'raw-file'
	| 'utf8-string'
	| 'canonical-json'
	| 'path-and-content'
	| 'event-chain'
	| 'generated-output';

export type IntegrityOwnerId = 'equipment' | 'visual-production' | 'runtime-and-engine';

export type IntegritySerializerId =
	| 'equipment-v1'
	| 'equipment-v2'
	| 'equipment-v3'
	| 'family-affinity'
	| 'image-production'
	| 'character-manifest'
	| 'engine';

export interface IntegrityPlanningNode {
	readonly path: string;
	readonly kind: IntegrityBindingKind;
	readonly serializer: IntegritySerializerId;
	readonly value: unknown;
	readonly dependsOn: readonly string[];
	readonly dependencyBindings?: readonly {
		readonly sourcePath: string;
		readonly jsonPointer: string;
	}[];
}

export interface IntegrityPlanningContext {
	readonly nodes: readonly IntegrityPlanningNode[];
}

export interface IntegrityVerificationContext {
	readonly nodes: readonly IntegrityPlanningNode[];
	readonly successors: readonly IntegritySuccessor[];
}

export interface IntegritySuccessor {
	readonly path: string;
	readonly kind: IntegrityBindingKind;
	readonly digest: string;
	readonly value: unknown;
	readonly dependencies: readonly { readonly path: string; readonly digest: string }[];
	readonly languageMigrationSuccessor: true;
}

export type IntegrityProblemCode =
	| 'ambiguous-owner'
	| 'changed-binary'
	| 'digest-mismatch'
	| 'missing-command'
	| 'missing-node'
	| 'unknown-digest'
	| 'unowned-binding';

export interface IntegrityProblem {
	readonly path: string;
	readonly jsonPointer: string;
	readonly code: IntegrityProblemCode;
	readonly message: string;
}

export interface AmericanEnglishIntegrityOwner {
	readonly id: IntegrityOwnerId;
	readonly regeneration: {
		readonly writeCommand: string;
		readonly checkCommand: string;
	} | null;
	owns(path: string, jsonPointer: string): boolean;
	planSuccessors(context: IntegrityPlanningContext): Promise<readonly IntegritySuccessor[]>;
	verify(context: IntegrityVerificationContext): Promise<readonly IntegrityProblem[]>;
}

export interface TrackedTreeEntry {
	readonly path: string;
	readonly bytes: Uint8Array;
	readonly binary: boolean;
	readonly baselineBytes?: Uint8Array;
	readonly binaryChanged?: boolean;
}

export interface TrackedTreeSnapshot {
	readonly entries: readonly TrackedTreeEntry[];
}

export interface IntegrityBinding {
	readonly path: string;
	readonly jsonPointer: string;
	readonly field: string;
	readonly kind: IntegrityBindingKind;
	readonly ownerId: IntegrityOwnerId;
}

export interface IntegrityOwnerPlan {
	readonly id: IntegrityOwnerId;
	readonly bindingCount: number;
	readonly pathCount: number;
	readonly paths: readonly string[];
	readonly writeCommand: string;
	readonly checkCommand: string;
}

export interface IntegrityBindingReport {
	readonly bindings: readonly IntegrityBinding[];
	readonly ownerPlans: readonly IntegrityOwnerPlan[];
	readonly problems: readonly IntegrityProblem[];
}

type MigrationProjection = Pick<AmericanEnglishMigrationPlan, 'textEdits' | 'pathMoves'>;

const INTEGRITY_MARKERS = [
	'canonicalHash',
	'checksum',
	'contentHash',
	'manifestHash',
	'promptHash',
	'sha256',
	'sourceHash'
] as const;

const KNOWN_DIGEST_FIELDS = new Set([
	'activatedIdentitySignature',
	'activeQuotaSummarySha256',
	'activeSelectionSha256',
	'allocationCanonicalSha256',
	'approvedSourceManifestHash',
	'assignmentCanonicalSha256',
	'assignmentSha256',
	'byteSha256',
	'calibrationInspectionSha256',
	'candidateByteSha256',
	'candidateHash',
	'candidateSha256',
	'canonicalPromptSha256',
	'canonicalSha256',
	'catalogHash',
	'chainHeadSha256',
	'characterKernelSha256',
	'checkpointInspectionSha256',
	'chibiSha256',
	'chibiSourceSha256',
	'contentHash',
	'contentSha256',
	'corpusHash',
	'eligibilityHash',
	'evidenceHash',
	'evidenceSetCanonicalSha256',
	'excludedIdentitySignaturesSha256',
	'excludedIdsSha256',
	'excludedNormalizedDisplayNamesSha256',
	'externalArtifactSha256',
	'failureResultSha256',
	'familyPacketSha256',
	'finalImageHash',
	'frozenIdentitySignature',
	'identityPacketSha256',
	'identitySignature',
	'imageByteSha256',
	'imageSha256',
	'integrationReceiptCanonicalSha256',
	'inventorySha256',
	'legalActionHash',
	'manifestCanonicalSha256',
	'manifestContentHash',
	'manifestHash',
	'manifestSha256',
	'normalCandidateSha256',
	'normalResultSha256',
	'normalTargetSha256',
	'packetHash',
	'planCanonicalSha256',
	'planContentSha256',
	'postRepairContentHash',
	'preRepairContentHash',
	'previousActivationSha256',
	'previousEventCanonicalSha256',
	'producerIdentitySha256',
	'profileAcceptanceCanonicalSha256',
	'profileCanonicalSha256',
	'promptHash',
	'promptSha256',
	'providerSourceHash',
	'providerSourceSha256',
	'recomputedContentHash',
	'referenceSheetHash',
	'registryCanonicalSha256',
	'renderedPromptSha256',
	'reserveAnalysisSha256',
	'resultCanonicalSha256',
	'resultHash',
	'resultSha256',
	'reviewReceiptSha256',
	'reviewSha256',
	'rosterPlanSha256',
	'runPlanCanonicalSha256',
	'selectedResultSha256',
	'sha256',
	'sourceCandidateSha256',
	'sourceContentHash',
	'sourceInventorySha256',
	'sourceMappingSha256',
	'sourcePacketSha256',
	'sourceRosterSha256',
	'sourceSha256',
	'sourceVisualIndexSha256',
	'stateHash',
	'submittedPromptSha256',
	'submittedReferenceSha256',
	'summonSha256',
	'summonSourceSha256',
	'supplementalReservePacketSha256',
	'supplementalReserveSha256',
	'targetCanonicalSha256',
	'targetSha256'
]);

function compareCodepoints(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value: string | Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

function escapePointerToken(value: string): string {
	return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function setJsonPointer(value: unknown, pointer: string, replacement: string): unknown {
	if (!pointer.startsWith('/') || value === null || typeof value !== 'object') {
		throw new Error(`Invalid dependency JSON pointer: ${pointer}`);
	}
	const clone = structuredClone(value);
	const components = pointer
		.slice(1)
		.split('/')
		.map((component) => component.replaceAll('~1', '/').replaceAll('~0', '~'));
	let parent: unknown = clone;
	for (const component of components.slice(0, -1)) {
		if (parent === null || typeof parent !== 'object') {
			throw new Error(`Dependency JSON pointer does not resolve: ${pointer}`);
		}
		parent = (parent as Record<string, unknown>)[component];
	}
	if (parent === null || typeof parent !== 'object') {
		throw new Error(`Dependency JSON pointer does not resolve: ${pointer}`);
	}
	const leaf = components.at(-1);
	if (leaf === undefined || !(leaf in parent)) {
		throw new Error(`Dependency JSON pointer does not resolve: ${pointer}`);
	}
	(parent as Record<string, unknown>)[leaf] = replacement;
	return clone;
}

export async function planTopologicalIntegritySuccessors(
	context: IntegrityPlanningContext,
	digest: (serializer: IntegritySerializerId, value: unknown) => string
): Promise<readonly IntegritySuccessor[]> {
	const nodes = new Map<string, IntegrityPlanningNode>();
	for (const node of context.nodes) {
		if (nodes.has(node.path)) throw new Error(`Duplicate integrity node: ${node.path}`);
		nodes.set(node.path, node);
	}
	for (const node of nodes.values()) {
		for (const sourcePath of node.dependsOn) {
			if (!nodes.has(sourcePath)) {
				throw new Error(`Missing source node ${sourcePath} required by ${node.path}`);
			}
		}
	}

	const remaining = new Map(nodes);
	const completed = new Map<string, IntegritySuccessor>();
	const successors: IntegritySuccessor[] = [];
	while (remaining.size > 0) {
		const ready = [...remaining.values()]
			.filter((node) => node.dependsOn.every((sourcePath) => completed.has(sourcePath)))
			.sort((left, right) => compareCodepoints(left.path, right.path));
		if (ready.length === 0) throw new Error('Integrity dependency cycle');
		for (const node of ready) {
			let value = structuredClone(node.value);
			const dependencies = node.dependsOn.map((sourcePath) => {
				const source = completed.get(sourcePath)!;
				return { path: sourcePath, digest: source.digest };
			});
			for (const binding of node.dependencyBindings ?? []) {
				if (!node.dependsOn.includes(binding.sourcePath)) {
					throw new Error(
						`Dependency binding references undeclared source ${binding.sourcePath} from ${node.path}`
					);
				}
				value = setJsonPointer(
					value,
					binding.jsonPointer,
					completed.get(binding.sourcePath)!.digest
				);
			}
			const successor: IntegritySuccessor = {
				path: node.path,
				kind: node.kind,
				digest: digest(node.serializer, value),
				value,
				dependencies,
				languageMigrationSuccessor: true
			};
			completed.set(node.path, successor);
			successors.push(successor);
			remaining.delete(node.path);
		}
	}
	return successors;
}

export async function verifyTopologicalIntegritySuccessors(
	context: IntegrityVerificationContext,
	digest: (serializer: IntegritySerializerId, value: unknown) => string
): Promise<readonly IntegrityProblem[]> {
	const expected = await planTopologicalIntegritySuccessors({ nodes: context.nodes }, digest);
	const actualByPath = new Map(context.successors.map((successor) => [successor.path, successor]));
	const problems: IntegrityProblem[] = [];
	for (const successor of expected) {
		const actual = actualByPath.get(successor.path);
		if (
			actual === undefined ||
			actual.digest !== successor.digest ||
			actual.languageMigrationSuccessor !== true
		) {
			problems.push({
				path: successor.path,
				jsonPointer: '',
				code: 'digest-mismatch',
				message: 'Successor digest does not match the live canonical serializer'
			});
		}
	}
	for (const actual of context.successors) {
		if (!expected.some(({ path }) => path === actual.path)) {
			problems.push({
				path: actual.path,
				jsonPointer: '',
				code: 'missing-node',
				message: 'Successor has no registered source node'
			});
		}
	}
	return problems.sort((left, right) => compareCodepoints(left.path, right.path));
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
	return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

function inferKind(field: string): IntegrityBindingKind {
	if (field === 'generated-output') return 'generated-output';
	if (/prompt/iu.test(field)) return 'utf8-string';
	if (/canonical/iu.test(field)) return 'canonical-json';
	if (/state|event|chain|legalAction/iu.test(field)) return 'event-chain';
	if (/manifest|catalog|roster|inventory/iu.test(field)) return 'generated-output';
	if (/content|source|candidate|image|reference|sha256/iu.test(field)) return 'raw-file';
	return 'path-and-content';
}

function isGeneratedArtifactPath(path: string): boolean {
	return (
		/\.(?:html|webp)$/u.test(path) ||
		path.includes('/review/') ||
		path.includes('/reviews/') ||
		path.includes('/runtime/') ||
		path.startsWith('apps/web/static/')
	);
}

function isKnownDigestField(field: string, parentPointer: string): boolean {
	return KNOWN_DIGEST_FIELDS.has(field) || parentPointer.endsWith('/intermediateHashes');
}

function scanJsonBindings(
	value: unknown,
	path: string,
	pointer: string,
	bindings: { readonly path: string; readonly jsonPointer: string; readonly field: string }[],
	problems: IntegrityProblem[]
): void {
	if (Array.isArray(value)) {
		value.forEach((child, index) =>
			scanJsonBindings(child, path, `${pointer}/${index}`, bindings, problems)
		);
		return;
	}
	if (value === null || typeof value !== 'object') return;
	for (const [field, child] of Object.entries(value as Record<string, unknown>)) {
		const childPointer = `${pointer}/${escapePointerToken(field)}`;
		if (typeof child === 'string' && /^[0-9a-f]{64}$/u.test(child)) {
			if (isKnownDigestField(field, pointer))
				bindings.push({ path, jsonPointer: childPointer, field });
			else {
				problems.push({
					path,
					jsonPointer: childPointer,
					code: 'unknown-digest',
					message: `Unregistered 64-character digest field: ${field}`
				});
			}
		}
		scanJsonBindings(child, path, childPointer, bindings, problems);
	}
}

export const AMERICAN_ENGLISH_INTEGRITY_OWNERS = [
	equipmentIntegrityOwner,
	visualProductionIntegrityOwner,
	runtimeAndEngineIntegrityOwner
] as const satisfies readonly AmericanEnglishIntegrityOwner[];

export async function classifyIntegrityBindings(
	before: TrackedTreeSnapshot,
	proposed: MigrationProjection,
	owners: readonly AmericanEnglishIntegrityOwner[] = AMERICAN_ENGLISH_INTEGRITY_OWNERS
): Promise<IntegrityBindingReport> {
	const affectedPaths = [
		...new Set([
			...proposed.textEdits.map(({ path }) => path),
			...proposed.pathMoves.map(({ source }) => source)
		])
	].sort(compareCodepoints);
	const entries = new Map(before.entries.map((entry) => [entry.path, entry]));
	const bindings: IntegrityBinding[] = [];
	const problems: IntegrityProblem[] = [];

	for (const path of affectedPaths) {
		const entry = entries.get(path);
		if (entry === undefined) {
			problems.push({
				path,
				jsonPointer: '',
				code: 'missing-node',
				message: 'Affected integrity source is absent from the tracked-tree snapshot'
			});
			continue;
		}
		const registeredBinary = entry.binary && owners.some((owner) => owner.owns(path, ''));
		if (
			registeredBinary &&
			(entry.binaryChanged === true ||
				(entry.baselineBytes !== undefined && !bytesEqual(entry.bytes, entry.baselineBytes)))
		) {
			problems.push({
				path,
				jsonPointer: '',
				code: 'changed-binary',
				message: 'A moved source binary differs from its baseline bytes'
			});
		}

		const source = entry.binary ? '' : Buffer.from(entry.bytes).toString('utf8');
		const scanned: {
			readonly path: string;
			readonly jsonPointer: string;
			readonly field: string;
		}[] = [];
		if (!entry.binary) {
			try {
				scanJsonBindings(JSON.parse(source), path, '', scanned, problems);
			} catch {
				// Non-JSON source is classified at the file boundary below.
			}
		}
		const hasMarker = INTEGRITY_MARKERS.some((marker) => source.includes(marker));
		const hasRegisteredPath = owners.some((owner) => owner.owns(path, ''));
		if (registeredBinary) scanned.push({ path, jsonPointer: '', field: 'raw-file' });
		else if (scanned.length === 0 && hasMarker) {
			scanned.push({ path, jsonPointer: '', field: 'source-integrity-reference' });
		} else if (scanned.length === 0 && hasRegisteredPath) {
			scanned.push({
				path,
				jsonPointer: '',
				field: isGeneratedArtifactPath(path) ? 'generated-output' : 'owned-path'
			});
		}

		for (const scannedBinding of scanned) {
			const matchingOwners = owners.filter((owner) =>
				owner.owns(scannedBinding.path, scannedBinding.jsonPointer)
			);
			if (matchingOwners.length === 0) {
				problems.push({
					path,
					jsonPointer: scannedBinding.jsonPointer,
					code: 'unowned-binding',
					message: 'No registered integrity owner matches this binding'
				});
				continue;
			}
			if (matchingOwners.length > 1) {
				problems.push({
					path,
					jsonPointer: scannedBinding.jsonPointer,
					code: 'ambiguous-owner',
					message: `Multiple integrity owners match: ${matchingOwners.map(({ id }) => id).join(', ')}`
				});
				continue;
			}
			const owner = matchingOwners[0]!;
			if (owner.regeneration === null) {
				problems.push({
					path,
					jsonPointer: scannedBinding.jsonPointer,
					code: 'missing-command',
					message: `Integrity owner ${owner.id} has no regeneration command`
				});
				continue;
			}
			bindings.push({
				...scannedBinding,
				kind: inferKind(scannedBinding.field),
				ownerId: owner.id
			});
		}
	}

	const ownerPlans = owners
		.flatMap((owner): IntegrityOwnerPlan[] => {
			const ownedBindings = bindings.filter(({ ownerId }) => ownerId === owner.id);
			if (ownedBindings.length === 0 || owner.regeneration === null) return [];
			return [
				{
					id: owner.id,
					bindingCount: ownedBindings.length,
					pathCount: new Set(ownedBindings.map(({ path }) => path)).size,
					paths: [...new Set(ownedBindings.map(({ path }) => path))].sort(compareCodepoints),
					...owner.regeneration
				}
			];
		})
		.sort((left, right) => compareCodepoints(left.id, right.id));
	return {
		bindings: bindings.sort(
			(left, right) =>
				compareCodepoints(left.path, right.path) ||
				compareCodepoints(left.jsonPointer, right.jsonPointer)
		),
		ownerPlans,
		problems: problems.sort(
			(left, right) =>
				compareCodepoints(left.path, right.path) ||
				compareCodepoints(left.jsonPointer, right.jsonPointer) ||
				compareCodepoints(left.code, right.code)
		)
	};
}

export function digestUtf8(value: string): string {
	return sha256(value);
}
