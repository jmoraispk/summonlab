import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

import { afterEach, describe, expect, it } from 'vitest';

import {
	AMERICAN_ENGLISH_RULE_IDS,
	auditTrackedPaths,
	auditTrackedTree,
	deriveRetiredForms,
	replaceRetiredForms
} from './american-english-policy.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

function retired(ruleId: (typeof AMERICAN_ENGLISH_RULE_IDS)[number], index = 0): string {
	const value = deriveRetiredForms(ruleId)[index];
	if (value === undefined) throw new Error(`Missing fixture form ${ruleId}[${index}]`);
	return value;
}

async function makeRepository(
	files: Readonly<Record<string, string | Uint8Array>>
): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'american-english-policy-'));
	temporaryRoots.push(root);
	execFileSync('git', ['init', '--quiet'], { cwd: root });
	for (const [repositoryPath, contents] of Object.entries(files)) {
		const destination = path.join(root, ...repositoryPath.split('/'));
		await mkdir(path.dirname(destination), { recursive: true });
		await writeFile(destination, contents);
	}
	execFileSync('git', ['add', '--all'], { cwd: root });
	execFileSync(
		'git',
		[
			'-c',
			'user.name=Test',
			'-c',
			'user.email=test@example.com',
			'commit',
			'--quiet',
			'-m',
			'fixture'
		],
		{
			cwd: root
		}
	);
	return root;
}

function titleCase(value: string): string {
	return `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

describe('American English finite policy', () => {
	it('builds the complete tracked-path inventory independently of content', () => {
		const form = retired('gray');
		expect(auditTrackedPaths(['a-safe.txt', `z-${form}-wolf/notes.txt`])).toEqual([
			{
				kind: 'path',
				ruleId: 'gray',
				found: form,
				recommended: 'gray',
				path: `z-${form}-wolf/notes.txt`,
				line: null,
				column: null
			}
		]);
	});

	it('recommends American case conventions in prose and identifiers', () => {
		const root = retired('behavior');
		const plural = retired('behavior', 1);
		const source = [
			root,
			titleCase(root),
			root.toUpperCase(),
			`${root}_policy`,
			`${root}-policy`,
			`combat${titleCase(root)}`,
			`Combat${titleCase(root)}`,
			plural
		].join(' ');

		expect(replaceRetiredForms(source)).toBe(
			[
				'behavior',
				'Behavior',
				'BEHAVIOR',
				'behavior_policy',
				'behavior-policy',
				'combatBehavior',
				'CombatBehavior',
				'behaviors'
			].join(' ')
		);
	});

	it('preserves grammar for explicit plurals and inflections', () => {
		const fixtures = [
			['practice', 1, 'practices'],
			['practice', 2, 'practiced'],
			['practice', 3, 'practicing'],
			['center', 2, 'centered'],
			['center', 3, 'centering'],
			['favor', 5, 'favorable'],
			['realize', 4, 'realization'],
			['channel', 0, 'channeled'],
			['channel', 1, 'channeling']
		] as const;
		for (const [ruleId, index, recommended] of fixtures) {
			expect(replaceRetiredForms(retired(ruleId, index))).toBe(recommended);
		}
	});

	it('derives irregular and compound forms from American pieces', () => {
		const fixtures = [
			['fiber', 5, ['fib', 'r', 'ed'], 'fibered'],
			['catalog', 0, ['catalog', 'u', 'e'], 'catalog'],
			['catalog', 1, ['catalog', 'u', 'e', 's'], 'catalogs'],
			['center', 2, ['cent', 'r', 'ed'], 'centered'],
			['center', 3, ['cent', 'r', 'ing'], 'centering'],
			['neighbor', 0, ['neighbo', 'u', 'r'], 'neighbor'],
			['luster', 2, ['lust', 'r', 'ed'], 'lustered'],
			['armor', 6, ['armo', 'u', 'rsmith'], 'armorsmith'],
			['gray', 6, ['gr', 'e', 'yscale'], 'grayscale']
		] as const;
		for (const [ruleId, index, retiredPieces, recommended] of fixtures) {
			const derived = retiredPieces.join('');
			expect(deriveRetiredForms(ruleId)[index]).toBe(derived);
			expect(replaceRetiredForms(derived)).toBe(recommended);
		}
	});

	it('does not report American words, near matches, or character names', () => {
		const source = [
			'armor ocher gray behavior fiber catalog vigor practice center mustache acknowledgment',
			'color math channel draft immobilize neighbor specialize defense flavor cancel favor',
			'crystallize label level luster realize recognize saber vapor checkerboard Nessa Toma'
		].join(' ');
		expect(replaceRetiredForms(source)).toBe(source);
	});

	it('reports retired forms in tracked path components and tracked text content', async () => {
		const pathForm = retired('gray');
		const contentForm = retired('armor');
		const repository = await makeRepository({
			[`docs/${pathForm}-wolf/notes.txt`]: `${contentForm}\n`
		});

		expect(await auditTrackedTree(repository)).toEqual([
			{
				kind: 'content',
				ruleId: 'armor',
				found: contentForm,
				recommended: 'armor',
				path: `docs/${pathForm}-wolf/notes.txt`,
				line: 1,
				column: 1
			},
			{
				kind: 'path',
				ruleId: 'gray',
				found: pathForm,
				recommended: 'gray',
				path: `docs/${pathForm}-wolf/notes.txt`,
				line: null,
				column: null
			}
		]);
	});

	it('uses NUL detection only when Git leaves the text attribute unspecified', async () => {
		const form = retired('color');
		const repository = await makeRepository({
			'.gitattributes': 'forced.bin text\n',
			'binary.bin': Buffer.concat([Buffer.from([0]), Buffer.from(form)]),
			'forced.bin': Buffer.concat([Buffer.from([0]), Buffer.from(form)]),
			'late-nul.bin': Buffer.concat([
				Buffer.from(`${form}\n`),
				Buffer.alloc(7_999 - form.length, 97),
				Buffer.from([0])
			])
		});

		const violations = await auditTrackedTree(repository);
		expect(violations.map(({ path: repositoryPath }) => repositoryPath)).toEqual([
			'forced.bin',
			'late-nul.bin'
		]);
	});

	it('inspects a tracked symbolic link without following its directory target', async () => {
		const repository = await makeRepository({ 'target/keep.txt': 'safe\n' });
		await mkdir(path.join(repository, 'links'));
		await symlink('../target', path.join(repository, 'links/target'));
		execFileSync('git', ['add', 'links/target'], { cwd: repository });

		expect(await auditTrackedTree(repository)).toEqual([]);
	});

	it('applies external identifier exceptions only to the exact token in an approved path', async () => {
		const packageToken = `@img/${retired('color')}`;
		const methodToken = `to${titleCase(retired('color'))}space`;
		const repository = await makeRepository({
			'pnpm-lock.yaml': `'${packageToken}@1.1.0'\n'${packageToken}Extra'\n`,
			'tools/normalize-skill-icon-provider-source.ts': `image.${methodToken}('srgb')\nimage.${methodToken}Extra('srgb')\n`,
			'notes/pnpm-lock.yaml': `'${packageToken}@1.1.0'\n`,
			'tools/copied-provider-source.ts': `image.${methodToken}('srgb')\n`
		});

		const violations = await auditTrackedTree(repository);
		expect(violations.map(({ path: repositoryPath }) => repositoryPath)).toEqual([
			'notes/pnpm-lock.yaml',
			'pnpm-lock.yaml',
			'tools/copied-provider-source.ts',
			'tools/normalize-skill-icon-provider-source.ts'
		]);
	});
});

describe('American English audit CLI', () => {
	it('prints a zero-count text summary and exits zero for a clean repository', async () => {
		const repository = await makeRepository({ 'notes.txt': 'safe\n' });
		const result = spawnSync(
			path.resolve('node_modules/.bin/tsx'),
			[path.resolve('tools/check-american-english.ts'), '--repository-root', repository],
			{ encoding: 'utf8' }
		);

		expect(result.status).toBe(0);
		expect(result.stdout).toBe('American English audit: 0 violation(s) (0 content, 0 path).\n');
	});

	it('prints the complete JSON report and exits one when violations exist', async () => {
		const form = retired('armor');
		const repository = await makeRepository({ 'notes.txt': `${form}\n` });
		const result = spawnSync(
			path.resolve('node_modules/.bin/tsx'),
			[
				path.resolve('tools/check-american-english.ts'),
				'--',
				'--repository-root',
				repository,
				'--format',
				'json'
			],
			{ encoding: 'utf8' }
		);

		expect(result.status).toBe(1);
		const report = JSON.parse(result.stdout) as Record<string, unknown>;
		expect(report).toMatchObject({
			head: expect.stringMatching(/^[0-9a-f]{40}$/u),
			counts: {
				total: 1,
				content: 1,
				path: 0,
				byRule: { armor: 1 },
				byRoot: { '(root)': 1 }
			},
			violations: [{ kind: 'content', ruleId: 'armor', path: 'notes.txt' }],
			exceptionsUsed: []
		});
	});

	it('rejects unsupported arguments with exit two', () => {
		const result = spawnSync(
			path.resolve('node_modules/.bin/tsx'),
			[path.resolve('tools/check-american-english.ts'), '--unknown'],
			{ encoding: 'utf8' }
		);

		expect(result.status).toBe(2);
		expect(result.stderr).toContain('Usage: tsx tools/check-american-english.ts');
	});
});
