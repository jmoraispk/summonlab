import { createHash } from 'node:crypto';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

export type IntegrityBindingKind =
	| 'raw-file'
	| 'utf8-string'
	| 'canonical-json'
	| 'path-and-content'
	| 'event-chain'
	| 'generated-output';

export type IntegrityOwnerId = 'equipment' | 'visual-production' | 'runtime-and-engine';

export type IntegritySerializerId =
	| 'raw-file'
	| 'utf8-string'
	| 'equipment-v1'
	| 'equipment-v2'
	| 'equipment-v3'
	| 'family-affinity'
	| 'image-production'
	| 'character-manifest'
	| 'engine';

export interface IntegrityPlanningNode {
	readonly path: string;
	readonly sourcePath?: string;
	readonly kind: IntegrityBindingKind;
	readonly serializer: IntegritySerializerId;
	readonly value: unknown;
	readonly rawBytes?: Uint8Array;
	readonly dependsOn: readonly string[];
	readonly dependencyBindings?: readonly {
		readonly sourcePath: string;
		readonly jsonPointer: string;
		readonly replacement?: 'digest' | 'raw-digest' | 'path';
	}[];
	readonly externalDependencies?: readonly {
		readonly jsonPointer: string;
		readonly value: string;
		readonly candidatePaths?: readonly string[];
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
	readonly sourcePath: string;
	readonly kind: IntegrityBindingKind;
	readonly digest: string;
	readonly rawDigest: string;
	readonly rawBytes: Uint8Array;
	readonly value: unknown;
	readonly dependencies: readonly {
		readonly path: string;
		readonly digest: string;
		readonly digestKind?: 'raw-bytes';
	}[];
	readonly externalDependencies: readonly {
		readonly jsonPointer: string;
		readonly value: string;
		readonly candidatePaths?: readonly string[];
	}[];
	readonly languageMigrationSuccessor: true;
}

export type IntegrityProblemCode =
	| 'ambiguous-owner'
	| 'changed-binary'
	| 'digest-mismatch'
	| 'missing-command'
	| 'missing-node'
	| 'unknown-digest'
	| 'unknown-serializer'
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
	readonly intentMaterialization?: {
		readonly commands: readonly (readonly string[])[];
		readonly paths: readonly string[];
		readonly selectPaths?: (trackedPaths: readonly string[]) => readonly string[];
	};
	ownsPath(path: string): boolean;
	regeneratesPath(path: string): boolean;
	owns(path: string, jsonPointer: string): boolean;
	serializerFor(path: string, kind: IntegrityBindingKind): IntegritySerializerId | null;
	digest(serializer: IntegritySerializerId, value: unknown): string;
	planSuccessors(context: IntegrityPlanningContext): Promise<readonly IntegritySuccessor[]>;
	verify(context: IntegrityVerificationContext): Promise<readonly IntegrityProblem[]>;
}

function compareCodepoints(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
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

function getJsonPointer(value: unknown, pointer: string): unknown {
	let current = value;
	for (const token of pointer.slice(1).split('/').filter(Boolean)) {
		if (current === null || typeof current !== 'object') return undefined;
		current = (current as Record<string, unknown>)[
			token.replaceAll('~1', '/').replaceAll('~0', '~')
		];
	}
	return current;
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

		for (const binding of node.dependencyBindings ?? []) {
			if (!node.dependsOn.includes(binding.sourcePath)) {
				throw new Error(
					`Dependency binding references undeclared source ${binding.sourcePath} from ${node.path}`
				);
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
			let value =
				(node.dependencyBindings?.length ?? 0) > 0 ? structuredClone(node.value) : node.value;
			let rawBytes = Buffer.from(
				node.rawBytes ??
					(typeof node.value === 'string'
						? node.value
						: node.value instanceof Uint8Array
							? node.value
							: JSON.stringify(node.value))
			);
			const dependencies = node.dependsOn.map((sourcePath) => {
				const source = completed.get(sourcePath)!;
				return { path: sourcePath, digest: source.digest };
			});
			for (const binding of node.dependencyBindings ?? []) {
				const source = completed.get(binding.sourcePath)!;
				const previous = getJsonPointer(value, binding.jsonPointer);
				const replacement =
					binding.replacement === 'path'
						? typeof previous === 'string' &&
							path.posix.normalize(path.posix.join(path.posix.dirname(node.path), previous)) ===
								source.path
							? previous
							: source.path
						: binding.replacement === 'raw-digest'
							? source.rawDigest
							: source.digest;
				value = setJsonPointer(value, binding.jsonPointer, replacement);
				if (typeof previous === 'string') {
					rawBytes = Buffer.from(
						rawBytes.toString('utf8').replaceAll(previous, replacement),
						'utf8'
					);
				}
				if (binding.replacement === 'raw-digest') {
					const dependency = dependencies.find(({ path }) => path === binding.sourcePath)!;
					(dependency as { digest: string; digestKind?: 'raw-bytes' }).digest = source.rawDigest;
					(dependency as { digest: string; digestKind?: 'raw-bytes' }).digestKind = 'raw-bytes';
				}
			}
			const successor: IntegritySuccessor = {
				path: node.path,
				sourcePath: node.sourcePath ?? node.path,
				kind: node.kind,
				digest: digest(node.serializer, value),
				rawDigest: digestBytes(rawBytes),
				rawBytes,
				value,
				dependencies,
				externalDependencies: node.externalDependencies ?? [],
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
	const actualByPath = new Map<string, IntegritySuccessor>();
	const duplicatePaths = new Set<string>();
	for (const successor of context.successors) {
		if (actualByPath.has(successor.path)) duplicatePaths.add(successor.path);
		actualByPath.set(successor.path, successor);
	}
	const problems: IntegrityProblem[] = [];
	const expectedPaths = new Set(expected.map(({ path }) => path));
	for (const successor of expected) {
		const actual = actualByPath.get(successor.path);
		const sourceNode = context.nodes.find(({ path }) => path === successor.path)!;
		if (
			actual === undefined ||
			duplicatePaths.has(successor.path) ||
			actual.digest !== successor.digest ||
			actual.digest !== digest(sourceNode.serializer, actual.value) ||
			actual.sourcePath !== successor.sourcePath ||
			actual.kind !== successor.kind ||
			!isDeepStrictEqual(actual.value, successor.value) ||
			!isDeepStrictEqual(actual.dependencies, successor.dependencies) ||
			!isDeepStrictEqual(actual.externalDependencies, successor.externalDependencies) ||
			actual.languageMigrationSuccessor !== true
		) {
			problems.push({
				path: successor.path,
				jsonPointer: '',
				code: 'digest-mismatch',
				message: 'Successor does not match its canonical value, kind, path, or dependency contract'
			});
		}
	}
	for (const actual of context.successors) {
		if (!expectedPaths.has(actual.path)) {
			problems.push({
				path: actual.path,
				jsonPointer: '',
				code: 'missing-node',
				message: 'Successor has no registered source node'
			});
		}
	}
	return problems.sort(
		(left, right) =>
			compareCodepoints(left.path, right.path) || compareCodepoints(left.code, right.code)
	);
}

export function digestUtf8(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

export function digestBytes(value: Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}
