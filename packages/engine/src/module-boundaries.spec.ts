import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const SOURCE_ROOT = path.dirname(fileURLToPath(import.meta.url));
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
	if (!specifier.startsWith('.')) return null;
	const resolved = path.resolve(path.dirname(importer), specifier.replace(/\.js$/u, '.ts'));
	return normalizedRelative(resolved);
}

function importSpecifiers(fileName: string, source: string): string[] {
	const sourceFile = ts.createSourceFile(
		fileName,
		source,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	);
	return sourceFile.statements.flatMap((statement) => {
		if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) return [];
		if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) return [];
		if (
			ts.isExportDeclaration(statement) &&
			normalizedRelative(fileName) === 'index.ts' &&
			statement.moduleSpecifier.text === './engine.js'
		) {
			return [];
		}
		return [statement.moduleSpecifier.text];
	});
}

function boundaryViolations(importer: string, specifier: string): string[] {
	const importerPath = normalizedRelative(importer);
	const resolved = resolvedInternalPath(importer, specifier);
	const violations: string[] = [];

	if (FORBIDDEN_PACKAGE_PATTERN.test(specifier)) {
		violations.push('engine source imports a forbidden package');
	}
	if (!resolved) return violations;
	if (FORBIDDEN_RESOLVED_PATH_PATTERN.test(resolved)) {
		violations.push('engine source imports a forbidden package path');
	}

	if (
		path.posix.basename(resolved) === 'engine.ts' &&
		!TEMPORARY_ENGINE_FACADE_IMPORTS.has(importerPath)
	) {
		violations.push('internal source imports the public engine facade');
	}
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
	it('enforces the core, domain, orchestration, and public-facade dependency directions', async () => {
		const violations: string[] = [];
		const temporaryFacadeImports = new Map<string, string>();
		for (const file of await sourceFiles(SOURCE_ROOT)) {
			const source = await readFile(file, 'utf8');
			for (const specifier of importSpecifiers(file, source)) {
				const resolved = resolvedInternalPath(file, specifier);
				const importerPath = normalizedRelative(file);
				if (
					resolved &&
					path.posix.basename(resolved) === 'engine.ts' &&
					TEMPORARY_ENGINE_FACADE_IMPORTS.has(importerPath)
				) {
					temporaryFacadeImports.set(
						importerPath,
						TEMPORARY_ENGINE_FACADE_IMPORTS.get(importerPath)!
					);
				}
				for (const violation of boundaryViolations(file, specifier)) {
					violations.push(`${normalizedRelative(file)} -> ${specifier}: ${violation}`);
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
