import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_TSCONFIG = path.resolve(SOURCE_ROOT, '..', 'tsconfig.json');
const ENGINE_PACKAGE_NAME = '@summonlab/engine';
// Task 1 intentionally compiles the public package types from inside this package.
const COMPILE_ONLY_SELF_IMPORT_FIXTURE = 'compatibility/public-types.ts';
// Task 2 intentionally exercises replay vectors through the black-box public facade.
const BLACK_BOX_REPLAY_FACADE_FIXTURE = 'compatibility/replay-vectors.ts';
const TYPESCRIPT_FILE_PATTERN = /\.tsx?$/u;
const TEST_FILE_PATTERN = /\.(?:spec|test)\.tsx?$/u;
const FORBIDDEN_PACKAGE_PATTERN =
	/^@summonlab\/(?:database|worker|web|policies|evaluation)(?:\/|$)/u;
const FORBIDDEN_RESOLVED_PATH_PATTERN =
	/(?:^|\/)(?:database|worker|web|policies|evaluation)(?:\/|$)/u;
const TEMPORARY_ENGINE_FACADE_IMPORTS: ReadonlyMap<string, string> = new Map([
	['catch-up.ts', 'Task 12'],
	['context.ts', 'Task 11'],
	['simulation.ts', 'Task 12']
] as const);

const loadedConfig = ts.readConfigFile(ENGINE_TSCONFIG, ts.sys.readFile);
if (loadedConfig.error) {
	throw new Error(ts.flattenDiagnosticMessageText(loadedConfig.error.messageText, '\n'));
}
const parsedConfig = ts.parseJsonConfigFileContent(
	loadedConfig.config,
	ts.sys,
	path.dirname(ENGINE_TSCONFIG),
	undefined,
	ENGINE_TSCONFIG
);
if (parsedConfig.errors.length > 0) {
	throw new Error(
		parsedConfig.errors
			.map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n'))
			.join('\n')
	);
}
const MODULE_RESOLUTION_CACHE = ts.createModuleResolutionCache(
	path.dirname(ENGINE_TSCONFIG),
	(fileName) => fileName,
	parsedConfig.options
);

type ModuleReferenceKind = 'import' | 'export' | 'import-equals' | 'dynamic-import';
interface ModuleReference {
	readonly kind: ModuleReferenceKind;
	readonly specifier: string;
}

async function sourceFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const absolute = path.join(directory, entry.name);
			if (entry.isDirectory()) return sourceFiles(absolute);
			return entry.isFile() &&
				TYPESCRIPT_FILE_PATTERN.test(entry.name) &&
				!TEST_FILE_PATTERN.test(entry.name)
				? [absolute]
				: [];
		})
	);
	return nested.flat().sort((left, right) => left.localeCompare(right));
}

function normalizedRelative(file: string): string {
	return path.relative(SOURCE_ROOT, file).split(path.sep).join('/');
}

function resolvedInternalPath(importer: string, specifier: string): string | null {
	const resolution = ts.resolveModuleName(
		specifier,
		importer,
		parsedConfig.options,
		ts.sys,
		MODULE_RESOLUTION_CACHE
	).resolvedModule;
	if (resolution) {
		return normalizedRelative(
			ts.sys.realpath?.(resolution.resolvedFileName) ?? resolution.resolvedFileName
		);
	}
	if (!specifier.startsWith('.')) return null;
	return normalizedRelative(
		path.resolve(path.dirname(importer), specifier.replace(/\.js$/u, '.ts'))
	);
}

function moduleReferences(fileName: string, source: string): ModuleReference[] {
	const sourceFile = ts.createSourceFile(
		fileName,
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	);
	const references: ModuleReference[] = [];
	const visit = (node: ts.Node): void => {
		if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
			references.push({ kind: 'import', specifier: node.moduleSpecifier.text });
		} else if (
			ts.isExportDeclaration(node) &&
			node.moduleSpecifier &&
			ts.isStringLiteralLike(node.moduleSpecifier)
		) {
			references.push({ kind: 'export', specifier: node.moduleSpecifier.text });
		} else if (
			ts.isImportEqualsDeclaration(node) &&
			ts.isExternalModuleReference(node.moduleReference) &&
			node.moduleReference.expression &&
			ts.isStringLiteralLike(node.moduleReference.expression)
		) {
			references.push({
				kind: 'import-equals',
				specifier: node.moduleReference.expression.text
			});
		} else if (
			ts.isCallExpression(node) &&
			node.expression.kind === ts.SyntaxKind.ImportKeyword &&
			node.arguments[0] &&
			ts.isStringLiteralLike(node.arguments[0])
		) {
			references.push({ kind: 'dynamic-import', specifier: node.arguments[0].text });
		}
		ts.forEachChild(node, visit);
	};
	visit(sourceFile);
	return references;
}

function isEngineFacadeReference(reference: ModuleReference, resolved: string | null): boolean {
	return (
		reference.specifier === ENGINE_PACKAGE_NAME ||
		reference.specifier.startsWith(`${ENGINE_PACKAGE_NAME}/`) ||
		resolved === 'engine.ts' ||
		resolved === 'index.ts'
	);
}

function isRootFacadeReexport(
	importerPath: string,
	reference: ModuleReference,
	resolved: string | null
): boolean {
	return (
		importerPath === 'index.ts' &&
		reference.kind === 'export' &&
		reference.specifier === './engine.js' &&
		resolved === 'engine.ts'
	);
}

function isTemporaryFacadeImport(
	importerPath: string,
	reference: ModuleReference,
	resolved: string | null
): boolean {
	return (
		TEMPORARY_ENGINE_FACADE_IMPORTS.has(importerPath) &&
		reference.kind === 'import' &&
		reference.specifier === './engine.js' &&
		resolved === 'engine.ts'
	);
}

function isCompileOnlySelfImportFixture(importerPath: string, reference: ModuleReference): boolean {
	return (
		importerPath === COMPILE_ONLY_SELF_IMPORT_FIXTURE &&
		reference.kind === 'import' &&
		reference.specifier === ENGINE_PACKAGE_NAME
	);
}

function isBlackBoxReplayFacadeFixture(
	importerPath: string,
	reference: ModuleReference,
	resolved: string | null
): boolean {
	return (
		importerPath === BLACK_BOX_REPLAY_FACADE_FIXTURE &&
		reference.kind === 'import' &&
		reference.specifier === '../index.js' &&
		resolved === 'index.ts'
	);
}

function boundaryViolations(importer: string, reference: ModuleReference): string[] {
	const importerPath = normalizedRelative(importer);
	const resolved = resolvedInternalPath(importer, reference.specifier);
	const violations: string[] = [];

	if (FORBIDDEN_PACKAGE_PATTERN.test(reference.specifier)) {
		violations.push('engine source imports a forbidden package');
	}
	if (resolved && FORBIDDEN_RESOLVED_PATH_PATTERN.test(resolved)) {
		violations.push('engine source imports a forbidden package path');
	}

	if (
		isEngineFacadeReference(reference, resolved) &&
		!isRootFacadeReexport(importerPath, reference, resolved) &&
		!isTemporaryFacadeImport(importerPath, reference, resolved) &&
		!isCompileOnlySelfImportFixture(importerPath, reference) &&
		!isBlackBoxReplayFacadeFixture(importerPath, reference, resolved)
	) {
		violations.push('internal source imports the public engine facade');
	}
	if (!resolved) return violations;
	if (importerPath.startsWith('core/') && /^(?:domains|orchestration)\//u.test(resolved)) {
		violations.push('core imports a domain or orchestration module');
	}
	if (importerPath.startsWith('domains/') && resolved.startsWith('orchestration/')) {
		violations.push('domain imports orchestration');
	}

	const importerDomain = /^domains\/([^/]+)\//u.exec(importerPath)?.[1];
	const importedDomain = /^domains\/([^/]+)\//u.exec(resolved)?.[1];
	if (importerDomain && importedDomain && importerDomain !== importedDomain) {
		violations.push(`domain ${importerDomain} imports domain ${importedDomain}`);
	}

	return violations;
}

describe('engine module boundaries', () => {
	it('rejects self-package aliases, nested dynamic imports, and import-equals references', () => {
		const importer = path.join(SOURCE_ROOT, 'core', 'synthetic.ts');
		const references = moduleReferences(
			importer,
			`// import('@summonlab/engine') is only a comment.
			import type * as publicEngine from '@summonlab/engine';
			import engineFacade = require('../engine.js');
			export async function loadEngine() {
				return import('../engine.js');
			}`
		);

		expect(references).toEqual([
			{ kind: 'import', specifier: '@summonlab/engine' },
			{ kind: 'import-equals', specifier: '../engine.js' },
			{ kind: 'dynamic-import', specifier: '../engine.js' }
		]);
		expect(resolvedInternalPath(importer, '@summonlab/engine')).toBe('index.ts');
		expect(references.flatMap((reference) => boundaryViolations(importer, reference))).toEqual([
			'internal source imports the public engine facade',
			'internal source imports the public engine facade',
			'internal source imports the public engine facade'
		]);
	});

	it('exempts only the Task 1 compile-only self-package fixture', async () => {
		const fixture = path.join(SOURCE_ROOT, 'compatibility', 'public-types.ts');
		const fixtureReferences = moduleReferences(fixture, await readFile(fixture, 'utf8'));
		expect(
			fixtureReferences.flatMap((reference) => boundaryViolations(fixture, reference))
		).toEqual([]);

		const neighboringFile = path.join(SOURCE_ROOT, 'compatibility', 'synthetic.ts');
		expect(
			boundaryViolations(neighboringFile, {
				kind: 'import',
				specifier: '@summonlab/engine'
			})
		).toEqual(['internal source imports the public engine facade']);
	});

	it('exempts only the Task 2 black-box replay-vector facade fixture', async () => {
		const fixture = path.join(SOURCE_ROOT, 'compatibility', 'replay-vectors.ts');
		const fixtureReferences = moduleReferences(fixture, await readFile(fixture, 'utf8'));
		expect(
			fixtureReferences.flatMap((reference) => boundaryViolations(fixture, reference))
		).toEqual([]);

		const neighboringFile = path.join(SOURCE_ROOT, 'compatibility', 'synthetic.ts');
		expect(
			boundaryViolations(neighboringFile, {
				kind: 'import',
				specifier: '../index.js'
			})
		).toEqual(['internal source imports the public engine facade']);
	});

	it('enforces the core, domain, orchestration, and public-facade dependency directions', async () => {
		const violations: string[] = [];
		const temporaryFacadeImports = new Map<string, string>();
		for (const file of await sourceFiles(SOURCE_ROOT)) {
			const source = await readFile(file, 'utf8');
			for (const reference of moduleReferences(file, source)) {
				const resolved = resolvedInternalPath(file, reference.specifier);
				const importerPath = normalizedRelative(file);
				if (isTemporaryFacadeImport(importerPath, reference, resolved)) {
					temporaryFacadeImports.set(
						importerPath,
						TEMPORARY_ENGINE_FACADE_IMPORTS.get(importerPath)!
					);
				}
				for (const violation of boundaryViolations(file, reference)) {
					violations.push(`${normalizedRelative(file)} -> ${reference.specifier}: ${violation}`);
				}
			}
		}

		expect(violations).toEqual([]);
		expect([...temporaryFacadeImports]).toEqual([
			['catch-up.ts', 'Task 12'],
			['context.ts', 'Task 11'],
			['simulation.ts', 'Task 12']
		]);
	});
});
