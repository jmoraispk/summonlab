import { createHash } from 'node:crypto';
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
	readonly dependsOn: readonly string[];
	readonly dependencyBindings?: readonly {
		readonly sourcePath: string;
		readonly jsonPointer: string;
		readonly replacement?: 'digest' | 'path';
	}[];
	readonly externalDependencies?: readonly {
		readonly jsonPointer: string;
		readonly value: string;
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
	readonly value: unknown;
	readonly dependencies: readonly { readonly path: string; readonly digest: string }[];
	readonly externalDependencies: readonly {
		readonly jsonPointer: string;
		readonly value: string;
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
	ownsPath(path: string): boolean;
	owns(path: string, jsonPointer: string): boolean;
	serializerFor(path: string, kind: IntegrityBindingKind): IntegritySerializerId | null;
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
			const dependencies = node.dependsOn.map((sourcePath) => {
				const source = completed.get(sourcePath)!;
				return { path: sourcePath, digest: source.digest };
			});
			for (const binding of node.dependencyBindings ?? []) {
				value = setJsonPointer(
					value,
					binding.jsonPointer,
					binding.replacement === 'path'
						? completed.get(binding.sourcePath)!.path
						: completed.get(binding.sourcePath)!.digest
				);
			}
			const successor: IntegritySuccessor = {
				path: node.path,
				sourcePath: node.sourcePath ?? node.path,
				kind: node.kind,
				digest: digest(node.serializer, value),
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
