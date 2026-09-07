import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	chmod,
	lstat,
	mkdtemp,
	mkdir,
	readFile,
	readlink,
	rm,
	symlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	applyAmericanEnglishMigration,
	finalizeAmericanEnglishMigrationReceipt,
	planAmericanEnglishMigration,
	resolveIntentMaterializationPathPairs
} from './american-english-migration.js';
import { type AmericanEnglishRuleId, deriveRetiredForms } from './american-english-policy.js';
import { hashCanonical } from '../packages/engine/src/hash.js';

const temporaryRoots: string[] = [];

describe('owner intent materialization paths', () => {
	it('projects dynamically selected source paths through migration moves', () => {
		expect(
			resolveIntentMaterializationPathPairs(
				{
					commands: [['pnpm', 'fixture']],
					paths: ['fixed.json'],
					selectPaths: (paths) => paths.filter((value) => value.endsWith('.assignment.json'))
				},
				['fixed.json', 'nested/legacy.assignment.json', 'ignored.json'],
				[
					{
						source: 'nested/legacy.assignment.json',
						destination: 'nested/current.assignment.json'
					}
				]
			)
		).toEqual([
			{ source: 'fixed.json', destination: 'fixed.json' },
			{
				source: 'nested/legacy.assignment.json',
				destination: 'nested/current.assignment.json'
			}
		]);
	});
});

type FixtureValue = string | Uint8Array | { readonly symlink: string };

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

function retired(ruleId: AmericanEnglishRuleId, index = 0): string {
	const value = deriveRetiredForms(ruleId)[index];
	if (value === undefined) throw new Error(`Missing fixture form ${ruleId}[${index}]`);
	return value;
}

function titleCase(value: string): string {
	return `${value[0]!.toUpperCase()}${value.slice(1)}`;
}

function git(repositoryRoot: string, arguments_: readonly string[]): string {
	return execFileSync('git', arguments_, { cwd: repositoryRoot, encoding: 'utf8' }).trim();
}

function commitAll(repositoryRoot: string, message: string): string {
	git(repositoryRoot, ['add', '--all']);
	git(repositoryRoot, [
		'-c',
		'user.name=Test',
		'-c',
		'user.email=test@example.com',
		'commit',
		'--quiet',
		'-m',
		message
	]);
	return git(repositoryRoot, ['rev-parse', 'HEAD']);
}

function pathHash(repositoryPath: string): string {
	return createHash('sha256').update(repositoryPath).digest('hex');
}

async function fileSha256(filePath: string): Promise<string> {
	return createHash('sha256')
		.update(await readFile(filePath))
		.digest('hex');
}

async function writePlanArtifact(
	directory: string,
	name: string,
	plan: Awaited<ReturnType<typeof planAmericanEnglishMigration>>
): Promise<{ readonly path: string; readonly sha256: string }> {
	const planPath = path.join(directory, name);
	await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`);
	return { path: planPath, sha256: await fileSha256(planPath) };
}

function journalPath(repositoryRoot: string): string {
	return path.resolve(
		repositoryRoot,
		git(repositoryRoot, ['rev-parse', '--git-dir']),
		'american-english-migration'
	);
}

async function makeRepository(files: Readonly<Record<string, FixtureValue>>): Promise<{
	readonly root: string;
	readonly baseline: string;
}> {
	const root = await mkdtemp(path.join(tmpdir(), 'american-english-migration-'));
	temporaryRoots.push(root);
	git(root, ['init', '--quiet']);
	for (const [repositoryPath, contents] of Object.entries(files)) {
		const destination = path.join(root, ...repositoryPath.split('/'));
		await mkdir(path.dirname(destination), { recursive: true });
		if (typeof contents === 'object' && !ArrayBuffer.isView(contents)) {
			await symlink(contents.symlink, destination);
		} else {
			await writeFile(destination, contents);
		}
	}
	git(root, ['add', '--all']);
	git(root, [
		'-c',
		'user.name=Test',
		'-c',
		'user.email=test@example.com',
		'commit',
		'--quiet',
		'-m',
		'fixture'
	]);
	return { root, baseline: git(root, ['rev-parse', 'HEAD']) };
}

async function trackedSnapshot(repositoryRoot: string): Promise<Readonly<Record<string, Buffer>>> {
	const tracked = git(repositoryRoot, ['ls-files']).split('\n').filter(Boolean);
	return Object.fromEntries(
		await Promise.all(
			tracked.map(async (repositoryPath) => {
				const absolutePath = path.join(repositoryRoot, ...repositoryPath.split('/'));
				try {
					return [repositoryPath, Buffer.from(await readlink(absolutePath))] as const;
				} catch {
					return [repositoryPath, await readFile(absolutePath)] as const;
				}
			})
		)
	);
}

function planPaths(plan: Awaited<ReturnType<typeof planAmericanEnglishMigration>>): string[] {
	return plan.pathMoves.map(({ source, destination }) => `${source} -> ${destination}`);
}

describe('American English migration planning', () => {
	it('formats TypeScript successors after a replacement changes line wrapping', async () => {
		const armor = retired('armor');
		const repository = await makeRepository({
			'.prettierrc.json': `${JSON.stringify({
				useTabs: true,
				singleQuote: true,
				trailingComma: 'none',
				printWidth: 100
			})}\n`,
			'fixture.ts': `expect(() =>\n\tresolveEquipmentVisual('equipment-v1-f-bronze-heavy-${armor}-set-reference')\n).toThrow(/${titleCase(armor)}-set-reference/u);\n`
		});
		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['armor']
		});
		const receiptPath = path.join(tmpdir(), `formatted-successor-${process.pid}.json`);
		temporaryRoots.push(receiptPath);

		await applyAmericanEnglishMigration(plan, {
			repositoryRoot: repository.root,
			receiptPath
		});

		expect(await readFile(path.join(repository.root, 'fixture.ts'), 'utf8')).toBe(
			"expect(() => resolveEquipmentVisual('equipment-v1-f-bronze-heavy-armor-set-reference')).toThrow(\n\t/Armor-set-reference/u\n);\n"
		);
	});

	it('authenticates filtered binary moves from tracked blobs instead of smudged bytes', async () => {
		const armor = retired('armor');
		const sourcePath = `assets/heroes/${armor}.png`;
		const destinationPath = 'assets/heroes/armor.png';
		const repository = await makeRepository({
			'.gitattributes': 'assets/heroes/*.png filter=fixture -text\n',
			[sourcePath]: 'smudged\n'
		});
		git(repository.root, ['config', 'filter.fixture.clean', 'sed s/smudged/pointer/g']);
		git(repository.root, ['config', 'filter.fixture.smudge', 'sed s/pointer/smudged/g']);
		git(repository.root, ['config', 'filter.fixture.required', 'true']);
		const baseline = commitAll(repository.root, 'store filtered fixture bytes');
		expect(await readFile(path.join(repository.root, ...sourcePath.split('/')), 'utf8')).toBe(
			'smudged\n'
		);
		expect(git(repository.root, ['show', `HEAD:${sourcePath}`])).toBe('pointer');
		expect(git(repository.root, ['status', '--porcelain=v1'])).toBe('');

		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: baseline,
			ruleIds: ['armor']
		});
		const receiptDirectory = await mkdtemp(path.join(tmpdir(), 'filtered-binary-receipts-'));
		temporaryRoots.push(receiptDirectory);
		const planArtifact = await writePlanArtifact(receiptDirectory, 'plan.json', plan);
		const initialReceiptPath = path.join(receiptDirectory, 'initial.json');
		const direct = plan.directSuccessors.find(
			({ successorPathHash }) => successorPathHash === pathHash(destinationPath)
		);
		expect(direct).toBeDefined();
		expect(direct?.binary).toBe(true);
		expect(direct?.successorBlobId).toBe(direct?.sourceBlobId);

		const receipt = await applyAmericanEnglishMigration(plan, {
			repositoryRoot: repository.root,
			receiptPath: initialReceiptPath
		});
		expect(await readFile(path.join(repository.root, ...destinationPath.split('/')), 'utf8')).toBe(
			'smudged\n'
		);
		expect(git(repository.root, ['show', `:${destinationPath}`])).toBe('pointer');
		expect(
			receipt.files.find(({ successorPathHash }) => successorPathHash === pathHash(destinationPath))
		).toMatchObject({ unchangedBinary: true, ownerId: 'visual-production' });
		const migrationCommit = commitAll(repository.root, 'migrate filtered binary fixture');
		await expect(
			finalizeAmericanEnglishMigrationReceipt({
				repositoryRoot: repository.root,
				expectedMigrationCommit: migrationCommit,
				planPath: planArtifact.path,
				expectedPlanHash: planArtifact.sha256,
				initialReceiptPath,
				expectedInitialReceiptHash: await fileSha256(initialReceiptPath),
				receiptPath: path.join(receiptDirectory, 'final.json')
			})
		).resolves.toMatchObject({
			files: [expect.objectContaining({ unchangedBinary: true, ownerId: 'visual-production' })]
		});
	});

	it('chains validated prior receipts across sequential filtered migrations', async () => {
		const gray = retired('gray');
		const armor = retired('armor');
		const color = retired('color');
		const repository = await makeRepository({
			[`docs/${gray}/${armor}.txt`]: `${armor}\n`,
			[`other/${gray}/safe.txt`]: `${color}\n`
		});
		const firstReceiptPath = path.join(tmpdir(), `chain-first-${process.pid}.json`);
		const firstPlan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['gray']
		});
		await applyAmericanEnglishMigration(firstPlan, {
			repositoryRoot: repository.root,
			receiptPath: firstReceiptPath
		});
		commitAll(repository.root, 'first spelling slice');
		const identityReceiptPath = path.join(tmpdir(), `chain-identity-${process.pid}.json`);
		const validReceipt = JSON.parse(await readFile(firstReceiptPath, 'utf8'));
		await writeFile(
			identityReceiptPath,
			`${JSON.stringify({ ...validReceipt, baselineCommit: 'f'.repeat(40) })}\n`
		);
		await expect(
			planAmericanEnglishMigration({
				repositoryRoot: repository.root,
				baselineCommit: repository.baseline,
				ruleIds: ['armor'],
				previousReceiptPath: identityReceiptPath
			})
		).rejects.toThrow(/receipt baseline/i);
		await writeFile(
			identityReceiptPath,
			`${JSON.stringify({ ...validReceipt, policyVersion: 2 })}\n`
		);
		await expect(
			planAmericanEnglishMigration({
				repositoryRoot: repository.root,
				baselineCommit: repository.baseline,
				ruleIds: ['armor'],
				previousReceiptPath: identityReceiptPath
			})
		).rejects.toThrow(/receipt policy version/i);
		const tamperedReceiptPath = path.join(tmpdir(), `chain-tampered-${process.pid}.json`);
		const firstReceipt = JSON.parse(await readFile(firstReceiptPath, 'utf8'));
		const tamperedBinding = firstReceipt.files.find(
			(file: { successorPathHash: string }) =>
				file.successorPathHash === pathHash(`docs/gray/${armor}.txt`)
		);
		if (tamperedBinding === undefined) throw new Error('Missing receipt fixture binding');
		tamperedBinding.successorBlobId = '0'.repeat(40);
		await writeFile(tamperedReceiptPath, `${JSON.stringify(firstReceipt)}\n`);
		await expect(
			planAmericanEnglishMigration({
				repositoryRoot: repository.root,
				baselineCommit: repository.baseline,
				ruleIds: ['armor'],
				previousReceiptPath: tamperedReceiptPath
			})
		).rejects.toThrow(/receipt successor blob/i);

		const secondPlan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['armor'],
			roots: ['docs'],
			previousReceiptPath: firstReceiptPath
		});
		expect(secondPlan.pathMoves).toEqual([
			expect.objectContaining({
				source: `docs/gray/${armor}.txt`,
				destination: 'docs/gray/armor.txt'
			})
		]);
		const secondReceiptPath = path.join(tmpdir(), `chain-second-${process.pid}.json`);
		await applyAmericanEnglishMigration(secondPlan, {
			repositoryRoot: repository.root,
			receiptPath: secondReceiptPath,
			previousReceiptPath: firstReceiptPath
		});
		expect(await readFile(path.join(repository.root, 'docs/gray/armor.txt'), 'utf8')).toBe(
			'armor\n'
		);
		commitAll(repository.root, 'second spelling slice');

		const thirdPlan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['color'],
			roots: ['other'],
			previousReceiptPath: secondReceiptPath
		});
		const thirdReceiptPath = path.join(tmpdir(), `chain-third-${process.pid}.json`);
		await applyAmericanEnglishMigration(thirdPlan, {
			repositoryRoot: repository.root,
			receiptPath: thirdReceiptPath,
			previousReceiptPath: secondReceiptPath
		});
		expect(await readFile(path.join(repository.root, 'other/gray/safe.txt'), 'utf8')).toBe(
			'color\n'
		);
	});

	it('accepts the package-manager argument separator at the CLI boundary', async () => {
		const repository = await makeRepository({ 'safe.txt': 'safe\n' });
		const command = spawnSync(
			process.execPath,
			[
				path.resolve('node_modules/tsx/dist/cli.mjs'),
				path.resolve('tools/american-english-migration.ts'),
				'--',
				'--baseline',
				repository.baseline,
				'--repository-root',
				repository.root,
				'--format',
				'json'
			],
			{ encoding: 'utf8' }
		);

		expect(command.status).toBe(0);
		expect(JSON.parse(command.stdout)).toMatchObject({ baselineCommit: repository.baseline });
	});

	it('excludes requested rules at the CLI boundary', async () => {
		const armor = retired('armor');
		const color = retired('color');
		const repository = await makeRepository({ 'docs/note.txt': `${armor} ${color}\n` });
		const command = spawnSync(
			process.execPath,
			[
				path.resolve('node_modules/tsx/dist/cli.mjs'),
				path.resolve('tools/american-english-migration.ts'),
				'--baseline',
				repository.baseline,
				'--repository-root',
				repository.root,
				'--exclude-rules',
				'armor',
				'--format',
				'json'
			],
			{ encoding: 'utf8' }
		);

		expect(command.status).toBe(0);
		const plan = JSON.parse(command.stdout);
		expect(plan.ruleIds).not.toContain('armor');
		expect(plan.ruleIds).toContain('color');
		expect(plan.textEdits).toEqual([{ path: 'docs/note.txt', violationCount: 1 }]);
		expect(await readFile(path.join(repository.root, 'docs/note.txt'), 'utf8')).toBe(
			`${armor} ${color}\n`
		);
	});

	it('rejects unknown excluded rules at the CLI boundary', async () => {
		const repository = await makeRepository({ 'safe.txt': 'safe\n' });
		const command = spawnSync(
			process.execPath,
			[
				path.resolve('node_modules/tsx/dist/cli.mjs'),
				path.resolve('tools/american-english-migration.ts'),
				'--baseline',
				repository.baseline,
				'--repository-root',
				repository.root,
				'--exclude-rules',
				'unknown'
			],
			{ encoding: 'utf8' }
		);

		expect(command.status).toBe(2);
		expect(command.stderr).toMatch(/unknown american english rule/i);
	});

	it('rejects combining included and excluded rule filters', async () => {
		const repository = await makeRepository({ 'safe.txt': 'safe\n' });
		const command = spawnSync(
			process.execPath,
			[
				path.resolve('node_modules/tsx/dist/cli.mjs'),
				path.resolve('tools/american-english-migration.ts'),
				'--baseline',
				repository.baseline,
				'--repository-root',
				repository.root,
				'--rules',
				'color',
				'--exclude-rules',
				'armor'
			],
			{ encoding: 'utf8' }
		);

		expect(command.status).toBe(2);
		expect(command.stderr).toMatch(/cannot combine.*--rules.*--exclude-rules/i);
	});

	it('plans deterministic filtered edits while preserving dry-run bytes', async () => {
		const gray = retired('gray');
		const armor = retired('armor');
		const behavior = retired('behavior');
		const color = retired('color');
		const sharpMethod = `to${titleCase(color)}space`;
		const repository = await makeRepository({
			'.gitattributes': 'assets/heroes/*.png -text\n',
			[`assets/heroes/${gray}.png`]: Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(color)]),
			[`docs/${gray}/nested/${armor}-note.txt`]: Buffer.from(
				`\uFEFFcombat${titleCase(behavior)}\r\n${armor}\r\n`,
				'utf8'
			),
			[`links/${gray}-alias`]: { symlink: `../docs/${color}` },
			'pnpm-lock.yaml': `name: "@img/${color}"\n`,
			'tools/normalize-skill-icon-provider-source.ts': `image.${sharpMethod}();\n`
		});
		const before = await trackedSnapshot(repository.root);

		const first = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline
		});
		const second = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline
		});

		expect(second).toEqual(first);
		expect(planPaths(first)).toEqual([
			`assets/heroes/${gray}.png -> assets/heroes/gray.png`,
			`docs/${gray}/nested/${armor}-note.txt -> docs/gray/nested/armor-note.txt`,
			`links/${gray}-alias -> links/gray-alias`
		]);
		expect(
			first.pathMoves.find(({ source }) => source === `assets/heroes/${gray}.png`)?.binary
		).toBe(true);
		expect(first.textEdits).toEqual([
			{ path: `docs/${gray}/nested/${armor}-note.txt`, violationCount: 2 },
			{ path: `links/${gray}-alias`, violationCount: 1 }
		]);
		expect(first.collisions).toEqual([]);
		expect(first.unownedIntegrityBindings).toEqual([]);
		expect(await trackedSnapshot(repository.root)).toEqual(before);
		expect(git(repository.root, ['status', '--porcelain'])).toBe('');

		const filtered = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['gray'],
			roots: ['docs']
		});
		expect(planPaths(filtered)).toEqual([
			`docs/${gray}/nested/${armor}-note.txt -> docs/gray/nested/${armor}-note.txt`
		]);
		expect(filtered.textEdits).toEqual([]);
	});

	it('reports full-tree exact and case-folded collisions before filters', async () => {
		const gray = retired('gray');
		const color = retired('color');
		const repository = await makeRepository({
			[`docs/${gray}/color.txt`]: 'first\n',
			[`docs/gray/${color}.txt`]: 'second\n',
			[`outside/${titleCase(color)}.txt`]: 'third\n',
			[`outside/${color}.txt`]: 'fourth\n',
			'src/safe.txt': 'safe\n'
		});

		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			roots: ['src']
		});

		expect(plan.pathMoves).toEqual([]);
		expect(plan.collisions).toEqual([
			{
				destination: 'docs/gray/color.txt',
				sources: [`docs/gray/${color}.txt`, `docs/${gray}/color.txt`]
			},
			{
				destination: 'outside/Color.txt',
				sources: [`outside/${titleCase(color)}.txt`, `outside/${color}.txt`]
			}
		]);
	});

	it('reports an untracked path occupying a tracked destination', async () => {
		const gray = retired('gray');
		const repository = await makeRepository({ [`docs/${gray}.txt`]: 'tracked\n' });
		await writeFile(path.join(repository.root, 'docs/gray.txt'), 'untracked\n');

		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline
		});

		expect(plan.collisions).toEqual([
			{
				destination: 'docs/gray.txt',
				sources: ['docs/gray.txt', `docs/${gray}.txt`]
			}
		]);
	});

	it('reports an ignored case-folded destination occupant', async () => {
		const color = retired('color');
		const repository = await makeRepository({
			'.gitignore': 'docs/color.txt\n',
			[`docs/${titleCase(color)}.txt`]: 'tracked\n'
		});
		await writeFile(path.join(repository.root, 'docs/color.txt'), 'ignored\n');

		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline
		});

		expect(plan.collisions).toEqual([
			{
				destination: 'docs/Color.txt',
				sources: [`docs/${titleCase(color)}.txt`, 'docs/color.txt']
			}
		]);
	});

	it('conservatively reports files with potential integrity bindings', async () => {
		const behavior = retired('behavior');
		const repository = await makeRepository({
			'records/manifest.json': `{"${behavior}":true,"contentHash":"${'a'.repeat(64)}"}\n`
		});

		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline
		});

		expect(plan.unownedIntegrityBindings).toEqual([
			{
				path: 'records/manifest.json',
				reasons: [
					'unowned-binding /contentHash: No registered integrity owner matches this binding'
				]
			}
		]);
	});

	it('consumes the integrity registry for an explicitly owned runtime binding', async () => {
		const behavior = retired('behavior');
		const repository = await makeRepository({
			'packages/engine/src/story.ts': `export const ${behavior}Fixture = { contentHash: '${'a'.repeat(64)}' };\n`
		});

		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline
		});

		expect(plan.unownedIntegrityBindings).toEqual([]);
		expect(plan.integrityOwners).toEqual([
			expect.objectContaining({
				id: 'runtime-and-engine',
				bindingCount: 1,
				pathCount: 1,
				successorIntents: [
					expect.objectContaining({
						path: 'packages/engine/src/story.ts',
						languageMigrationSuccessor: true
					})
				],
				writeCommand: expect.stringContaining('export:playtest-release'),
				checkCommand: expect.stringContaining('validate:playtest-release')
			})
		]);
	});
});

describe('American English transactional application', () => {
	it('records the registered integrity owner on each successor receipt entry', async () => {
		const behavior = retired('behavior');
		const repository = await makeRepository({
			'packages/engine/src/story.ts': `export const ${behavior}Fixture = { contentHash: '${'a'.repeat(64)}' };\n`
		});
		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline
		});
		const receiptPath = path.join(tmpdir(), `owned-successor-${process.pid}.json`);

		const receipt = await applyAmericanEnglishMigration(plan, {
			repositoryRoot: repository.root,
			receiptPath
		});

		expect(receipt.ownerCounts).toEqual({ 'runtime-and-engine': 1 });
		expect(receipt.files).toEqual([
			expect.objectContaining({ ownerId: 'runtime-and-engine', unchangedBinary: false })
		]);
	});

	it('recomputes the full preflight and rejects collision or integrity drift before journaling', async () => {
		const gray = retired('gray');
		const behavior = retired('behavior');
		const collisionRepository = await makeRepository({ [`docs/${gray}.txt`]: 'source\n' });
		const collisionPlan = await planAmericanEnglishMigration({
			repositoryRoot: collisionRepository.root,
			baselineCommit: collisionRepository.baseline
		});
		await writeFile(path.join(collisionRepository.root, 'docs/gray.txt'), 'new destination\n');
		commitAll(collisionRepository.root, 'introduce destination collision');
		const collisionBefore = await trackedSnapshot(collisionRepository.root);
		await expect(
			applyAmericanEnglishMigration(collisionPlan, {
				repositoryRoot: collisionRepository.root,
				receiptPath: path.join(tmpdir(), `fresh-collision-${process.pid}.json`)
			})
		).rejects.toThrow(/preflight.*changed/i);
		expect(await trackedSnapshot(collisionRepository.root)).toEqual(collisionBefore);
		await expect(lstat(journalPath(collisionRepository.root))).rejects.toThrow();

		const integrityRepository = await makeRepository({
			'record.json': `{"${behavior}":true}\n`
		});
		const integrityPlan = await planAmericanEnglishMigration({
			repositoryRoot: integrityRepository.root,
			baselineCommit: integrityRepository.baseline
		});
		await writeFile(
			path.join(integrityRepository.root, 'record.json'),
			`{"${behavior}":true,"contentHash":"${'c'.repeat(64)}"}\n`
		);
		commitAll(integrityRepository.root, 'introduce integrity binding');
		const integrityBefore = await trackedSnapshot(integrityRepository.root);
		await expect(
			applyAmericanEnglishMigration(integrityPlan, {
				repositoryRoot: integrityRepository.root,
				receiptPath: path.join(tmpdir(), `fresh-integrity-${process.pid}.json`)
			})
		).rejects.toThrow(/preflight.*changed/i);
		expect(await trackedSnapshot(integrityRepository.root)).toEqual(integrityBefore);
		await expect(lstat(journalPath(integrityRepository.root))).rejects.toThrow();

		const inventoryRepository = await makeRepository({ [`docs/${gray}.txt`]: 'source\n' });
		const inventoryPlan = await planAmericanEnglishMigration({
			repositoryRoot: inventoryRepository.root,
			baselineCommit: inventoryRepository.baseline
		});
		await writeFile(path.join(inventoryRepository.root, 'unrelated-safe.txt'), 'safe\n');
		commitAll(inventoryRepository.root, 'change tracked inventory');
		const inventoryBefore = await trackedSnapshot(inventoryRepository.root);
		await expect(
			applyAmericanEnglishMigration(inventoryPlan, {
				repositoryRoot: inventoryRepository.root,
				receiptPath: path.join(tmpdir(), `fresh-inventory-${process.pid}.json`)
			})
		).rejects.toThrow(/preflight.*changed/i);
		expect(await trackedSnapshot(inventoryRepository.root)).toEqual(inventoryBefore);
		await expect(lstat(journalPath(inventoryRepository.root))).rejects.toThrow();
	});

	it('hashes a partial-rule successor path that still contains a deferred form', async () => {
		const gray = retired('gray');
		const armor = retired('armor');
		const repository = await makeRepository({ [`docs/${gray}/${armor}.txt`]: 'safe\n' });
		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['gray']
		});
		const receiptPath = path.join(tmpdir(), `partial-private-${process.pid}.json`);

		const receipt = await applyAmericanEnglishMigration(plan, {
			repositoryRoot: repository.root,
			receiptPath
		});

		expect(receipt.files).toEqual([
			expect.objectContaining({
				successorPathHash: pathHash(`docs/gray/${armor}.txt`)
			})
		]);
		const serialized = JSON.stringify(receipt);
		expect(serialized).not.toContain(gray);
		expect(serialized).not.toContain(armor);
		expect(serialized).not.toContain('docs/');
		expect(serialized).not.toContain('successorPath"');
	});

	it('does not overwrite an existing receipt or start repository changes', async () => {
		const gray = retired('gray');
		const repository = await makeRepository({ [`docs/${gray}.txt`]: 'source\n' });
		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline
		});
		const before = await trackedSnapshot(repository.root);
		const receiptPath = path.join(tmpdir(), `existing-${process.pid}.json`);
		await writeFile(receiptPath, 'existing receipt\n');
		temporaryRoots.push(receiptPath);

		await expect(
			applyAmericanEnglishMigration(plan, { repositoryRoot: repository.root, receiptPath })
		).rejects.toThrow(/receipt.*exists/i);
		expect(await readFile(receiptPath, 'utf8')).toBe('existing receipt\n');
		expect(await trackedSnapshot(repository.root)).toEqual(before);
		expect(git(repository.root, ['status', '--porcelain'])).toBe('');
	});

	it('blocks collisions, dirty trees, stale baselines, and unowned bindings before changes', async () => {
		const gray = retired('gray');
		const behavior = retired('behavior');

		const collisionRepository = await makeRepository({
			[`docs/${gray}.txt`]: 'source\n',
			'docs/gray.txt': 'destination\n'
		});
		const collisionPlan = await planAmericanEnglishMigration({
			repositoryRoot: collisionRepository.root,
			baselineCommit: collisionRepository.baseline
		});
		const collisionBefore = await trackedSnapshot(collisionRepository.root);
		await expect(
			applyAmericanEnglishMigration(collisionPlan, {
				repositoryRoot: collisionRepository.root,
				receiptPath: path.join(tmpdir(), `collision-${process.pid}.json`)
			})
		).rejects.toThrow(/collision/i);
		expect(await trackedSnapshot(collisionRepository.root)).toEqual(collisionBefore);

		const dirtyRepository = await makeRepository({ [`docs/${gray}.txt`]: 'source\n' });
		const dirtyPlan = await planAmericanEnglishMigration({
			repositoryRoot: dirtyRepository.root,
			baselineCommit: dirtyRepository.baseline
		});
		await writeFile(path.join(dirtyRepository.root, 'unrelated.txt'), 'dirty\n');
		const dirtyBefore = await readFile(path.join(dirtyRepository.root, `docs/${gray}.txt`));
		await expect(
			applyAmericanEnglishMigration(dirtyPlan, {
				repositoryRoot: dirtyRepository.root,
				receiptPath: path.join(tmpdir(), `dirty-${process.pid}.json`)
			})
		).rejects.toThrow(/clean working tree/i);
		expect(await readFile(path.join(dirtyRepository.root, `docs/${gray}.txt`))).toEqual(
			dirtyBefore
		);

		const staleRepository = await makeRepository({ [`docs/${gray}.txt`]: 'source\n' });
		const stalePlan = await planAmericanEnglishMigration({
			repositoryRoot: staleRepository.root,
			baselineCommit: staleRepository.baseline
		});
		git(staleRepository.root, ['checkout', '--quiet', '--orphan', 'unrelated-history']);
		git(staleRepository.root, ['rm', '--quiet', '-r', '--force', '.']);
		await writeFile(path.join(staleRepository.root, `docs-${gray}.txt`), 'source\n');
		git(staleRepository.root, ['add', '--all']);
		git(staleRepository.root, [
			'-c',
			'user.name=Test',
			'-c',
			'user.email=test@example.com',
			'commit',
			'--quiet',
			'-m',
			'unrelated'
		]);
		await expect(
			applyAmericanEnglishMigration(stalePlan, {
				repositoryRoot: staleRepository.root,
				receiptPath: path.join(tmpdir(), `stale-${process.pid}.json`)
			})
		).rejects.toThrow(/ancestor/i);

		const bindingRepository = await makeRepository({
			'record.json': `{"${behavior}":true,"sha256":"${'b'.repeat(64)}"}\n`
		});
		const bindingPlan = await planAmericanEnglishMigration({
			repositoryRoot: bindingRepository.root,
			baselineCommit: bindingRepository.baseline
		});
		const bindingBefore = await trackedSnapshot(bindingRepository.root);
		await expect(
			applyAmericanEnglishMigration(bindingPlan, {
				repositoryRoot: bindingRepository.root,
				receiptPath: path.join(tmpdir(), `binding-${process.pid}.json`)
			})
		).rejects.toThrow(/integrity/i);
		expect(await trackedSnapshot(bindingRepository.root)).toEqual(bindingBefore);
	});

	it('rejects a committed source that drifted from the frozen baseline', async () => {
		const gray = retired('gray');
		const repository = await makeRepository({ [`docs/${gray}.txt`]: 'source\n' });
		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline
		});
		await writeFile(path.join(repository.root, `docs/${gray}.txt`), 'changed source\n');
		git(repository.root, ['add', '--all']);
		git(repository.root, [
			'-c',
			'user.name=Test',
			'-c',
			'user.email=test@example.com',
			'commit',
			'--quiet',
			'-m',
			'source drift'
		]);
		const before = await trackedSnapshot(repository.root);

		await expect(
			applyAmericanEnglishMigration(plan, {
				repositoryRoot: repository.root,
				receiptPath: path.join(tmpdir(), `drift-${process.pid}.json`)
			})
		).rejects.toThrow(/preflight.*changed/i);
		expect(await trackedSnapshot(repository.root)).toEqual(before);
		expect(git(repository.root, ['status', '--porcelain'])).toBe('');
	});

	it('rolls back every path and byte after an injected mid-operation failure', async () => {
		const gray = retired('gray');
		const armor = retired('armor');
		const repository = await makeRepository({
			[`deep/${gray}/${armor}.txt`]: `${armor}\n`,
			[`other/${gray}.txt`]: `${armor}\n`
		});
		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline
		});
		const before = await trackedSnapshot(repository.root);
		const receiptPath = path.join(tmpdir(), `rollback-${process.pid}.json`);

		await expect(
			applyAmericanEnglishMigration(plan, {
				repositoryRoot: repository.root,
				receiptPath,
				failAfterOperation: 1
			})
		).rejects.toThrow(/injected/i);

		expect(await trackedSnapshot(repository.root)).toEqual(before);
		expect(git(repository.root, ['status', '--porcelain'])).toBe('');
		await expect(readFile(receiptPath)).rejects.toThrow();
		await expect(lstat(journalPath(repository.root))).rejects.toThrow();

		const retryReceipt = await applyAmericanEnglishMigration(plan, {
			repositoryRoot: repository.root,
			receiptPath
		});
		expect(retryReceipt.files).toHaveLength(2);
	});

	it('preserves representation and mode while producing a hash-only receipt', async () => {
		const gray = retired('gray');
		const armor = retired('armor');
		const behavior = retired('behavior');
		const color = retired('color');
		const sourceText = Buffer.from(`\uFEFFcombat${titleCase(behavior)}\r\n${armor}`, 'utf8');
		const binaryBytes = Buffer.concat([Buffer.from([0, 255, 4]), Buffer.from(color)]);
		const repository = await makeRepository({
			'.gitattributes': 'assets/heroes/*.png -text\n',
			[`assets/heroes/${gray}.png`]: binaryBytes,
			[`docs/${gray}/${armor}.txt`]: sourceText,
			[`links/${gray}`]: { symlink: `../${color}` }
		});
		const executablePath = path.join(repository.root, `docs/${gray}/${armor}.txt`);
		await chmod(executablePath, 0o755);
		git(repository.root, ['add', `docs/${gray}/${armor}.txt`]);
		git(repository.root, [
			'-c',
			'user.name=Test',
			'-c',
			'user.email=test@example.com',
			'commit',
			'--quiet',
			'-m',
			'executable mode'
		]);
		const baseline = git(repository.root, ['rev-parse', 'HEAD']);
		const sourceMode = Number.parseInt(
			git(repository.root, ['ls-files', '-s', `docs/${gray}/${armor}.txt`]).slice(0, 6),
			10
		);
		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: baseline
		});
		const receiptPath = path.join(tmpdir(), `success-${process.pid}.json`);

		const receipt = await applyAmericanEnglishMigration(plan, {
			repositoryRoot: repository.root,
			receiptPath
		});

		expect(await readFile(path.join(repository.root, 'docs/gray/armor.txt'))).toEqual(
			Buffer.from('\uFEFFcombatBehavior\r\narmor', 'utf8')
		);
		expect(await readFile(path.join(repository.root, 'assets/heroes/gray.png'))).toEqual(
			binaryBytes
		);
		expect(await readlink(path.join(repository.root, 'links/gray'))).toBe('../color');
		const successorMode = Number.parseInt(
			git(repository.root, ['ls-files', '-s', 'docs/gray/armor.txt']).slice(0, 6),
			10
		);
		expect(successorMode).toBe(sourceMode);
		expect(receipt).toEqual(JSON.parse(await readFile(receiptPath, 'utf8')));
		expect(receipt.baselineCommit).toBe(baseline);
		expect(receipt.policyVersion).toBe(1);
		expect(receipt.ruleCounts).toMatchObject({ armor: 2, behavior: 1, color: 1, gray: 3 });
		expect(receipt.ownerCounts).toEqual({ 'migration-planner': 2, 'visual-production': 1 });
		expect(receipt.files).toHaveLength(3);
		expect(
			receipt.files.find(
				({ successorPathHash }) => successorPathHash === pathHash('assets/heroes/gray.png')
			)
		).toMatchObject({ unchangedBinary: true });
		const serialized = JSON.stringify(receipt);
		for (const value of [gray, armor, behavior, color]) expect(serialized).not.toContain(value);
		expect(serialized).not.toContain(`docs/${gray}/${armor}.txt`);
		expect(executablePath).not.toBe(path.join(repository.root, 'docs/gray/armor.txt'));
	});
});

describe('American English receipt finalization', () => {
	it.each(['reordered JSON', 'whitespace-only JSON', 'final-newline difference'] as const)(
		'rejects owner successor bytes with a %s despite an equal canonical digest',
		async (scenario) => {
			const color = retired('color');
			const upstreamBefore = { contentHash: 'a'.repeat(64), label: color };
			const repository = await makeRepository({
				'packages/engine/src/fixture.json': `${JSON.stringify(upstreamBefore, null, 2)}\n`,
				'packages/engine/src/downstream.json': `${JSON.stringify(
					{ stateHash: hashCanonical(upstreamBefore), marker: 'stable' },
					null,
					2
				)}\n`
			});
			const receiptDirectory = await mkdtemp(path.join(tmpdir(), 'american-english-receipts-'));
			temporaryRoots.push(receiptDirectory);
			const initialReceiptPath = path.join(receiptDirectory, 'initial.json');
			const plan = await planAmericanEnglishMigration({
				repositoryRoot: repository.root,
				baselineCommit: repository.baseline,
				ruleIds: ['color']
			});
			const artifact = await writePlanArtifact(receiptDirectory, 'plan.json', plan);
			await applyAmericanEnglishMigration(plan, {
				repositoryRoot: repository.root,
				receiptPath: initialReceiptPath
			});
			const downstreamPath = path.join(repository.root, 'packages/engine/src/downstream.json');
			const value = JSON.parse(await readFile(downstreamPath, 'utf8')) as {
				readonly stateHash: string;
				readonly marker: string;
			};
			const mutated =
				scenario === 'reordered JSON'
					? `${JSON.stringify({ marker: value.marker, stateHash: value.stateHash }, null, 2)}\n`
					: scenario === 'whitespace-only JSON'
						? `${JSON.stringify(value)}\n`
						: JSON.stringify(value, null, 2);
			await writeFile(downstreamPath, mutated);
			const migrationCommit = commitAll(repository.root, scenario);

			await expect(
				finalizeAmericanEnglishMigrationReceipt({
					repositoryRoot: repository.root,
					expectedMigrationCommit: migrationCommit,
					planPath: artifact.path,
					expectedPlanHash: artifact.sha256,
					initialReceiptPath,
					expectedInitialReceiptHash: await fileSha256(initialReceiptPath),
					receiptPath: path.join(receiptDirectory, 'final.json')
				})
			).rejects.toThrow(/raw|exact|bytes|blob/iu);
		}
	);

	it('materializes the complete owner closure from authenticated pre-apply intent', async () => {
		const color = retired('color');
		const upstreamBefore = { contentHash: 'a'.repeat(64), label: color };
		const repository = await makeRepository({
			'packages/engine/src/fixture.json': `${JSON.stringify(upstreamBefore, null, 2)}\n`,
			'packages/engine/src/downstream.json': `${JSON.stringify(
				{ stateHash: hashCanonical(upstreamBefore) },
				null,
				2
			)}\n`
		});
		const receiptDirectory = await mkdtemp(path.join(tmpdir(), 'american-english-receipts-'));
		temporaryRoots.push(receiptDirectory);
		const initialReceiptPath = path.join(receiptDirectory, 'initial.json');
		const finalReceiptPath = path.join(receiptDirectory, 'final.json');
		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['color']
		});
		const artifact = await writePlanArtifact(receiptDirectory, 'plan.json', plan);
		await applyAmericanEnglishMigration(plan, {
			repositoryRoot: repository.root,
			receiptPath: initialReceiptPath
		});

		const upstreamIntent = plan.expectedOwnerSuccessors.find(
			({ successorPathHash }) => successorPathHash === pathHash('packages/engine/src/fixture.json')
		)!;
		expect(
			JSON.parse(
				await readFile(path.join(repository.root, 'packages/engine/src/downstream.json'), 'utf8')
			)
		).toEqual({ stateHash: upstreamIntent.projectedValueDigest });
		const migrationCommit = commitAll(repository.root, 'materialized owner closure');

		await expect(
			finalizeAmericanEnglishMigrationReceipt({
				repositoryRoot: repository.root,
				expectedMigrationCommit: migrationCommit,
				planPath: artifact.path,
				expectedPlanHash: artifact.sha256,
				initialReceiptPath,
				expectedInitialReceiptHash: await fileSha256(initialReceiptPath),
				receiptPath: finalReceiptPath
			})
		).resolves.toMatchObject({ ownerCounts: { 'runtime-and-engine': 2 } });
	});

	it('rejects structurally valid owner bytes that merely self-verify from current state', async () => {
		const color = retired('color');
		const repository = await makeRepository({
			'packages/engine/src/story.ts': `export const direct = '${color}';\n`
		});
		const receiptDirectory = await mkdtemp(path.join(tmpdir(), 'american-english-receipts-'));
		temporaryRoots.push(receiptDirectory);
		const initialReceiptPath = path.join(receiptDirectory, 'initial.json');
		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['color']
		});
		const artifact = await writePlanArtifact(receiptDirectory, 'plan.json', plan);
		await applyAmericanEnglishMigration(plan, {
			repositoryRoot: repository.root,
			receiptPath: initialReceiptPath
		});
		await writeFile(
			path.join(repository.root, 'packages/engine/src/story.ts'),
			"export const direct = 'color';\nexport const unauthorizedButValid = true;\n"
		);
		const migrationCommit = commitAll(repository.root, 'migration with unauthorized owner bytes');

		await expect(
			finalizeAmericanEnglishMigrationReceipt({
				repositoryRoot: repository.root,
				expectedMigrationCommit: migrationCommit,
				initialReceiptPath,
				expectedInitialReceiptHash: await fileSha256(initialReceiptPath),
				receiptPath: path.join(receiptDirectory, 'finalized.json'),
				planPath: artifact.path,
				expectedPlanHash: artifact.sha256
			} as Parameters<typeof finalizeAmericanEnglishMigrationReceipt>[0])
		).rejects.toThrow(/expected successor|owner.*intent|plan/i);
	});

	it('rejects a missing or valid-looking mutated downstream reverse-dependency successor', async () => {
		const color = retired('color');
		for (const scenario of ['missing', 'mutated'] as const) {
			const upstream = { contentHash: 'a'.repeat(64), label: color };
			const repository = await makeRepository({
				'packages/engine/src/fixture.json': `${JSON.stringify(upstream)}\n`,
				'packages/engine/src/downstream.json': `${JSON.stringify({ stateHash: hashCanonical(upstream) })}\n`
			});
			const receiptDirectory = await mkdtemp(path.join(tmpdir(), 'american-english-receipts-'));
			temporaryRoots.push(receiptDirectory);
			const initialReceiptPath = path.join(receiptDirectory, 'initial.json');
			const plan = await planAmericanEnglishMigration({
				repositoryRoot: repository.root,
				baselineCommit: repository.baseline,
				ruleIds: ['color']
			});
			const artifact = await writePlanArtifact(receiptDirectory, 'plan.json', plan);
			expect(
				plan.expectedOwnerSuccessors.some(
					({ successorPathHash }) =>
						successorPathHash === pathHash('packages/engine/src/downstream.json')
				)
			).toBe(true);
			await applyAmericanEnglishMigration(plan, {
				repositoryRoot: repository.root,
				receiptPath: initialReceiptPath
			});
			if (scenario === 'missing') {
				await rm(path.join(repository.root, 'packages/engine/src/downstream.json'));
			} else {
				await writeFile(
					path.join(repository.root, 'packages/engine/src/downstream.json'),
					`${JSON.stringify({ stateHash: 'b'.repeat(64), unauthorized: true })}\n`
				);
			}
			const migrationCommit = commitAll(repository.root, `${scenario} downstream successor`);
			await expect(
				finalizeAmericanEnglishMigrationReceipt({
					repositoryRoot: repository.root,
					expectedMigrationCommit: migrationCommit,
					planPath: artifact.path,
					expectedPlanHash: artifact.sha256,
					initialReceiptPath,
					expectedInitialReceiptHash: await fileSha256(initialReceiptPath),
					receiptPath: path.join(receiptDirectory, 'finalized.json')
				})
			).rejects.toThrow(/successor intent|owner bytes|post-apply delta/i);
		}
	});

	it('authenticates reverse dependencies bound to exact source bytes', async () => {
		const color = retired('color');
		const upstreamText = `${JSON.stringify({ contentHash: 'a'.repeat(64), label: color }, null, 2)}\n`;
		const rawSourceDigest = createHash('sha256').update(upstreamText).digest('hex');
		const repository = await makeRepository({
			'packages/engine/src/fixture.json': upstreamText,
			'packages/engine/src/downstream.json': `${JSON.stringify({ contentHash: rawSourceDigest }, null, 2)}\n`
		});

		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['color']
		});
		const upstream = plan.expectedOwnerSuccessors.find(
			({ successorPathHash }) => successorPathHash === pathHash('packages/engine/src/fixture.json')
		);
		const downstream = plan.expectedOwnerSuccessors.find(
			({ successorPathHash }) =>
				successorPathHash === pathHash('packages/engine/src/downstream.json')
		);

		expect(upstream).toBeDefined();
		expect(downstream).toBeDefined();
		expect(downstream?.dependencies).toEqual([
			{
				successorPathHash: pathHash('packages/engine/src/fixture.json'),
				digest: upstream?.projectedRawDigest,
				digestKind: 'raw-bytes'
			}
		]);
	});

	it('rejects an extra owner-matched delta absent from the authenticated closure', async () => {
		const color = retired('color');
		const repository = await makeRepository({
			'packages/engine/src/story.ts': `export const direct = '${color}';\n`,
			'packages/engine/src/story.spec.ts': 'export const untouched = true;\n'
		});
		const receiptDirectory = await mkdtemp(path.join(tmpdir(), 'american-english-receipts-'));
		temporaryRoots.push(receiptDirectory);
		const initialReceiptPath = path.join(receiptDirectory, 'initial.json');
		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['color']
		});
		const artifact = await writePlanArtifact(receiptDirectory, 'plan.json', plan);
		await applyAmericanEnglishMigration(plan, {
			repositoryRoot: repository.root,
			receiptPath: initialReceiptPath
		});
		await writeFile(
			path.join(repository.root, 'packages/engine/src/story.spec.ts'),
			'export const unauthorizedOwnerDelta = true;\n'
		);
		const migrationCommit = commitAll(repository.root, 'extra owner-matched delta');
		await expect(
			finalizeAmericanEnglishMigrationReceipt({
				repositoryRoot: repository.root,
				expectedMigrationCommit: migrationCommit,
				planPath: artifact.path,
				expectedPlanHash: artifact.sha256,
				initialReceiptPath,
				expectedInitialReceiptHash: await fileSha256(initialReceiptPath),
				receiptPath: path.join(receiptDirectory, 'finalized.json')
			})
		).rejects.toThrow(/unplanned.*owner.*post-apply|successor intent/i);
	});

	it('rejects forged, sibling, altered-plan, and non-direct migration boundaries', async () => {
		const color = retired('color');
		const repository = await makeRepository({ 'docs/note.txt': `${color}\n` });
		const receiptDirectory = await mkdtemp(path.join(tmpdir(), 'american-english-receipts-'));
		temporaryRoots.push(receiptDirectory);
		const initialReceiptPath = path.join(receiptDirectory, 'initial.json');
		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['color']
		});
		const artifact = await writePlanArtifact(receiptDirectory, 'plan.json', plan);
		await applyAmericanEnglishMigration(plan, {
			repositoryRoot: repository.root,
			receiptPath: initialReceiptPath
		});
		const migrationCommit = commitAll(repository.root, 'migration');
		const siblingCommit = git(repository.root, [
			'-c',
			'user.name=Test',
			'-c',
			'user.email=test@example.com',
			'commit-tree',
			git(repository.root, ['rev-parse', `${migrationCommit}^{tree}`]),
			'-p',
			repository.baseline,
			'-m',
			'sibling forged base'
		]);
		const common = {
			repositoryRoot: repository.root,
			expectedMigrationCommit: migrationCommit,
			initialReceiptPath,
			expectedInitialReceiptHash: await fileSha256(initialReceiptPath),
			planPath: artifact.path,
			expectedPlanHash: artifact.sha256
		};

		await expect(
			finalizeAmericanEnglishMigrationReceipt({
				...common,
				migrationBaseCommit: siblingCommit,
				receiptPath: path.join(receiptDirectory, 'sibling.json')
			} as Parameters<typeof finalizeAmericanEnglishMigrationReceipt>[0])
		).rejects.toThrow(/plan head|direct parent|migration boundary/i);

		const altered = { ...plan, roots: ['forged'] };
		await writeFile(artifact.path, `${JSON.stringify(altered, null, 2)}\n`);
		await expect(
			finalizeAmericanEnglishMigrationReceipt({
				...common,
				receiptPath: path.join(receiptDirectory, 'altered.json')
			} as Parameters<typeof finalizeAmericanEnglishMigrationReceipt>[0])
		).rejects.toThrow(/plan.*hash|fingerprint/i);

		await writeFile(artifact.path, `${JSON.stringify(plan, null, 2)}\n`);
		const intermediate = git(repository.root, [
			'-c',
			'user.name=Test',
			'-c',
			'user.email=test@example.com',
			'commit-tree',
			git(repository.root, ['rev-parse', `${repository.baseline}^{tree}`]),
			'-p',
			repository.baseline,
			'-m',
			'intermediate'
		]);
		const nonDirectMigration = git(repository.root, [
			'-c',
			'user.name=Test',
			'-c',
			'user.email=test@example.com',
			'commit-tree',
			git(repository.root, ['rev-parse', `${migrationCommit}^{tree}`]),
			'-p',
			intermediate,
			'-m',
			'non-direct migration'
		]);
		git(repository.root, ['update-ref', 'HEAD', nonDirectMigration, migrationCommit]);
		await expect(
			finalizeAmericanEnglishMigrationReceipt({
				...common,
				expectedMigrationCommit: nonDirectMigration,
				receiptPath: path.join(receiptDirectory, 'non-direct.json')
			} as Parameters<typeof finalizeAmericanEnglishMigrationReceipt>[0])
		).rejects.toThrow(/direct parent|migration boundary/i);
	});

	it('reseals validated owner changes and lets the next filtered slice plan and apply', async () => {
		const armor = retired('armor');
		const color = retired('color');
		const upstreamBefore = { contentHash: 'a'.repeat(64), label: color, next: armor };
		const repository = await makeRepository({
			'packages/engine/src/fixture.json': `${JSON.stringify(upstreamBefore)}\n`,
			'packages/engine/src/downstream.json': `${JSON.stringify({ stateHash: hashCanonical(upstreamBefore), label: color, next: armor })}\n`,
			'packages/engine/src/presentation.ts': `export const preexisting = '${armor}';\n`
		});
		await writeFile(
			path.join(repository.root, 'packages/engine/src/presentation.ts'),
			`export const preexisting = '${armor}';\nexport const changedBeforeThisSlice = true;\n`
		);
		commitAll(repository.root, 'prepare preexisting owner state');
		const receiptDirectory = await mkdtemp(path.join(tmpdir(), 'american-english-receipts-'));
		temporaryRoots.push(receiptDirectory);
		const initialReceiptPath = path.join(receiptDirectory, 'initial.json');
		const finalizedReceiptPath = path.join(receiptDirectory, 'finalized.json');
		const nextReceiptPath = path.join(receiptDirectory, 'next.json');
		const firstPlan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['color']
		});
		const planArtifact = await writePlanArtifact(receiptDirectory, 'plan.json', firstPlan);
		const upstreamIntent = firstPlan.expectedOwnerSuccessors.find(
			({ successorPathHash }) => successorPathHash === pathHash('packages/engine/src/fixture.json')
		);
		const downstreamIntent = firstPlan.expectedOwnerSuccessors.find(
			({ successorPathHash }) =>
				successorPathHash === pathHash('packages/engine/src/downstream.json')
		);
		expect(upstreamIntent).toBeDefined();
		expect(downstreamIntent?.dependencies).toEqual([
			{
				successorPathHash: pathHash('packages/engine/src/fixture.json'),
				digest: upstreamIntent!.projectedValueDigest
			}
		]);
		await applyAmericanEnglishMigration(firstPlan, {
			repositoryRoot: repository.root,
			receiptPath: initialReceiptPath
		});
		const migrationCommit = commitAll(repository.root, 'apply and regenerate first spelling slice');

		await expect(
			planAmericanEnglishMigration({
				repositoryRoot: repository.root,
				baselineCommit: repository.baseline,
				ruleIds: ['armor'],
				previousReceiptPath: initialReceiptPath
			})
		).rejects.toThrow(/receipt successor blob/i);
		const unchainedPlan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['armor']
		});
		await expect(
			applyAmericanEnglishMigration(unchainedPlan, {
				repositoryRoot: repository.root,
				receiptPath: nextReceiptPath,
				previousReceiptPath: initialReceiptPath
			})
		).rejects.toThrow(/preflight.*changed/i);

		const finalized = await finalizeAmericanEnglishMigrationReceipt({
			repositoryRoot: repository.root,
			expectedMigrationCommit: migrationCommit,
			planPath: planArtifact.path,
			expectedPlanHash: planArtifact.sha256,
			initialReceiptPath,
			expectedInitialReceiptHash: await fileSha256(initialReceiptPath),
			receiptPath: finalizedReceiptPath
		});
		expect(finalized.files).toHaveLength(3);
		expect(finalized.ownerCounts).toEqual({
			'authenticated-plan-head': 1,
			'runtime-and-engine': 2
		});
		expect(finalized.files).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					successorPathHash: pathHash('packages/engine/src/downstream.json'),
					ownerId: 'runtime-and-engine'
				}),
				expect.objectContaining({
					successorPathHash: pathHash('packages/engine/src/fixture.json'),
					ownerId: 'runtime-and-engine'
				}),
				expect.objectContaining({
					successorPathHash: pathHash('packages/engine/src/presentation.ts'),
					ownerId: 'authenticated-plan-head'
				})
			])
		);
		const serialized = JSON.stringify(finalized);
		for (const privateValue of [armor, color, 'packages/', 'story.ts']) {
			expect(serialized).not.toContain(privateValue);
		}
		await expect(
			finalizeAmericanEnglishMigrationReceipt({
				repositoryRoot: repository.root,
				expectedMigrationCommit: migrationCommit,
				planPath: planArtifact.path,
				expectedPlanHash: planArtifact.sha256,
				initialReceiptPath,
				expectedInitialReceiptHash: await fileSha256(initialReceiptPath),
				receiptPath: finalizedReceiptPath
			})
		).rejects.toThrow(/receipt.*exists/i);
		const cliReceiptPath = path.join(receiptDirectory, 'finalized-cli.json');
		const cli = spawnSync(
			process.execPath,
			[
				path.resolve('node_modules/tsx/dist/cli.mjs'),
				path.resolve('tools/american-english-migration.ts'),
				'--finalize-receipt',
				initialReceiptPath,
				'--initial-receipt-sha256',
				await fileSha256(initialReceiptPath),
				'--plan',
				planArtifact.path,
				'--plan-sha256',
				planArtifact.sha256,
				'--expected-migration-commit',
				migrationCommit,
				'--repository-root',
				repository.root,
				'--receipt',
				cliReceiptPath,
				'--format',
				'json'
			],
			{ encoding: 'utf8' }
		);
		expect(cli.status).toBe(0);
		expect(JSON.parse(cli.stdout)).toEqual(finalized);

		const nextPlan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['armor'],
			previousReceiptPath: finalizedReceiptPath
		});
		expect(nextPlan.textEdits).toHaveLength(3);
		await applyAmericanEnglishMigration(nextPlan, {
			repositoryRoot: repository.root,
			receiptPath: nextReceiptPath,
			previousReceiptPath: finalizedReceiptPath
		});
		expect(
			await readFile(path.join(repository.root, 'packages/engine/src/fixture.json'), 'utf8')
		).toContain('armor');
		expect(
			await readFile(path.join(repository.root, 'packages/engine/src/downstream.json'), 'utf8')
		).toContain('armor');
		expect(
			await readFile(path.join(repository.root, 'packages/engine/src/presentation.ts'), 'utf8')
		).toContain("'armor'");
	});

	it('reseals an authenticated future-rule preimage through a current-rule path move', async () => {
		const armor = retired('armor');
		const behavior = retired('behavior');
		const color = retired('color');
		const sourcePath = `docs/${color}-${armor}.txt`;
		const colorPath = `docs/color-${armor}.txt`;
		const finalPath = 'docs/color-armor.txt';
		const repository = await makeRepository({ [sourcePath]: `${behavior}\n` });
		const receiptDirectory = await mkdtemp(path.join(tmpdir(), 'american-english-receipts-'));
		temporaryRoots.push(receiptDirectory);
		const previousInitialReceiptPath = path.join(receiptDirectory, 'previous-initial.json');
		const previousReceiptPath = path.join(receiptDirectory, 'previous-finalized.json');
		const initialReceiptPath = path.join(receiptDirectory, 'initial.json');
		const finalizedReceiptPath = path.join(receiptDirectory, 'finalized.json');
		const nextReceiptPath = path.join(receiptDirectory, 'next.json');
		const previousPlan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['behavior']
		});
		const previousPlanArtifact = await writePlanArtifact(
			receiptDirectory,
			'previous-plan.json',
			previousPlan
		);
		await applyAmericanEnglishMigration(previousPlan, {
			repositoryRoot: repository.root,
			receiptPath: previousInitialReceiptPath
		});
		const previousMigrationCommit = commitAll(repository.root, 'apply preceding content slice');
		const previousReceipt = await finalizeAmericanEnglishMigrationReceipt({
			repositoryRoot: repository.root,
			expectedMigrationCommit: previousMigrationCommit,
			planPath: previousPlanArtifact.path,
			expectedPlanHash: previousPlanArtifact.sha256,
			initialReceiptPath: previousInitialReceiptPath,
			expectedInitialReceiptHash: await fileSha256(previousInitialReceiptPath),
			receiptPath: previousReceiptPath
		});
		await writeFile(previousReceiptPath, JSON.stringify(previousReceipt));
		const firstPlan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['color'],
			previousReceiptPath
		});
		const planArtifact = await writePlanArtifact(receiptDirectory, 'plan.json', firstPlan);

		expect(firstPlan.pathMoves).toEqual([
			expect.objectContaining({ source: sourcePath, destination: colorPath })
		]);
		expect(firstPlan.authenticatedHeadPreimages).toEqual([
			expect.objectContaining({ successorPathHash: pathHash(sourcePath) })
		]);
		await applyAmericanEnglishMigration(firstPlan, {
			repositoryRoot: repository.root,
			receiptPath: initialReceiptPath,
			previousReceiptPath
		});
		const migrationCommit = commitAll(repository.root, 'apply current-rule path move');

		const finalized = await finalizeAmericanEnglishMigrationReceipt({
			repositoryRoot: repository.root,
			expectedMigrationCommit: migrationCommit,
			planPath: planArtifact.path,
			expectedPlanHash: planArtifact.sha256,
			initialReceiptPath,
			expectedInitialReceiptHash: await fileSha256(initialReceiptPath),
			receiptPath: finalizedReceiptPath,
			previousReceiptPath
		});
		expect(finalized.files).toEqual([
			expect.objectContaining({
				successorPathHash: pathHash(colorPath),
				ownerId: 'migration-planner'
			})
		]);

		const nextPlan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['armor'],
			previousReceiptPath: finalizedReceiptPath
		});
		expect(nextPlan.pathMoves).toEqual([
			expect.objectContaining({ source: colorPath, destination: finalPath })
		]);
		await applyAmericanEnglishMigration(nextPlan, {
			repositoryRoot: repository.root,
			receiptPath: nextReceiptPath,
			previousReceiptPath: finalizedReceiptPath
		});
		expect(await readFile(path.join(repository.root, finalPath), 'utf8')).toBe('behavior\n');
	});

	it('rejects unowned and migration-planner-owned post-apply drift', async () => {
		const armor = retired('armor');
		const color = retired('color');
		const plannerRepository = await makeRepository({
			'docs/note.txt': `${color} ${armor}\n`
		});
		const receiptDirectory = await mkdtemp(path.join(tmpdir(), 'american-english-receipts-'));
		temporaryRoots.push(receiptDirectory);
		const plannerReceiptPath = path.join(receiptDirectory, 'planner-initial.json');
		const plannerPlan = await planAmericanEnglishMigration({
			repositoryRoot: plannerRepository.root,
			baselineCommit: plannerRepository.baseline,
			ruleIds: ['color']
		});
		const plannerArtifact = await writePlanArtifact(
			receiptDirectory,
			'planner-plan.json',
			plannerPlan
		);
		await applyAmericanEnglishMigration(plannerPlan, {
			repositoryRoot: plannerRepository.root,
			receiptPath: plannerReceiptPath
		});
		await writeFile(
			path.join(plannerRepository.root, 'docs/note.txt'),
			`color ${armor}\narbitrary drift\n`
		);
		const plannerMigrationCommit = commitAll(plannerRepository.root, 'tamper planner successor');
		await expect(
			finalizeAmericanEnglishMigrationReceipt({
				repositoryRoot: plannerRepository.root,
				expectedMigrationCommit: plannerMigrationCommit,
				planPath: plannerArtifact.path,
				expectedPlanHash: plannerArtifact.sha256,
				initialReceiptPath: plannerReceiptPath,
				expectedInitialReceiptHash: await fileSha256(plannerReceiptPath),
				receiptPath: path.join(receiptDirectory, 'planner-final.json')
			})
		).rejects.toThrow(/migration-planner.*drift/i);
		const initialReceiptHash = await fileSha256(plannerReceiptPath);
		const forgedReceipt = JSON.parse(await readFile(plannerReceiptPath, 'utf8'));
		forgedReceipt.files[0].successorBlobId = git(plannerRepository.root, [
			'rev-parse',
			'HEAD:docs/note.txt'
		]);
		const forgedReceiptPath = path.join(receiptDirectory, 'planner-forged.json');
		await writeFile(forgedReceiptPath, `${JSON.stringify(forgedReceipt, null, 2)}\n`);
		await expect(
			finalizeAmericanEnglishMigrationReceipt({
				repositoryRoot: plannerRepository.root,
				expectedMigrationCommit: plannerMigrationCommit,
				planPath: plannerArtifact.path,
				expectedPlanHash: plannerArtifact.sha256,
				initialReceiptPath: forgedReceiptPath,
				expectedInitialReceiptHash: initialReceiptHash,
				receiptPath: path.join(receiptDirectory, 'planner-forged-final.json')
			})
		).rejects.toThrow(/initial receipt.*hash/i);

		const unownedRepository = await makeRepository({
			'docs/note.txt': `${color}\n`,
			'misc/safe.txt': 'safe\n'
		});
		const unownedReceiptPath = path.join(receiptDirectory, 'unowned-initial.json');
		const unownedPlan = await planAmericanEnglishMigration({
			repositoryRoot: unownedRepository.root,
			baselineCommit: unownedRepository.baseline,
			ruleIds: ['color']
		});
		const unownedArtifact = await writePlanArtifact(
			receiptDirectory,
			'unowned-plan.json',
			unownedPlan
		);
		await applyAmericanEnglishMigration(unownedPlan, {
			repositoryRoot: unownedRepository.root,
			receiptPath: unownedReceiptPath
		});
		await writeFile(path.join(unownedRepository.root, 'misc/safe.txt'), 'tampered\n');
		const unownedMigrationCommit = commitAll(unownedRepository.root, 'tamper unowned path');
		await expect(
			finalizeAmericanEnglishMigrationReceipt({
				repositoryRoot: unownedRepository.root,
				expectedMigrationCommit: unownedMigrationCommit,
				planPath: unownedArtifact.path,
				expectedPlanHash: unownedArtifact.sha256,
				initialReceiptPath: unownedReceiptPath,
				expectedInitialReceiptHash: await fileSha256(unownedReceiptPath),
				receiptPath: path.join(receiptDirectory, 'unowned-final.json')
			})
		).rejects.toThrow(/unowned.*post-apply/i);
	});

	it('rejects post-apply binary drift instead of resealing it', async () => {
		const gray = retired('gray');
		const repository = await makeRepository({
			'.gitattributes': 'assets/wiki/**/*.png -text\n',
			[`assets/wiki/icons/${gray}.png`]: Buffer.from([0, 1, 2, 3])
		});
		const receiptDirectory = await mkdtemp(path.join(tmpdir(), 'american-english-receipts-'));
		temporaryRoots.push(receiptDirectory);
		const initialReceiptPath = path.join(receiptDirectory, 'initial.json');
		const firstPlan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['gray']
		});
		const planArtifact = await writePlanArtifact(receiptDirectory, 'binary-plan.json', firstPlan);
		await applyAmericanEnglishMigration(firstPlan, {
			repositoryRoot: repository.root,
			receiptPath: initialReceiptPath
		});
		await writeFile(
			path.join(repository.root, 'assets/wiki/icons/gray.png'),
			Buffer.from([9, 8, 7])
		);
		const migrationCommit = commitAll(repository.root, 'tamper binary successor');

		await expect(
			finalizeAmericanEnglishMigrationReceipt({
				repositoryRoot: repository.root,
				expectedMigrationCommit: migrationCommit,
				planPath: planArtifact.path,
				expectedPlanHash: planArtifact.sha256,
				initialReceiptPath,
				expectedInitialReceiptHash: await fileSha256(initialReceiptPath),
				receiptPath: path.join(receiptDirectory, 'finalized.json')
			})
		).rejects.toThrow(/binary.*drift/i);
	});
});

describe('American English apply materialization authentication', () => {
	it.each([
		['serialized and reparsed', (plan: object) => JSON.parse(JSON.stringify(plan))],
		['shallow-cloned', (plan: object) => ({ ...plan })]
	] as const)('rejects a %s owner plan before mutation', async (_label, clone) => {
		const color = retired('color');
		const repository = await makeRepository({
			'packages/engine/src/story.ts': `export const value = '${color}';\n`
		});
		const receiptDirectory = await mkdtemp(path.join(tmpdir(), 'american-english-receipts-'));
		temporaryRoots.push(receiptDirectory);
		const receiptPath = path.join(receiptDirectory, 'initial.json');
		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['color']
		});
		expect(plan.expectedOwnerSuccessors.length).toBeGreaterThan(0);
		const before = await readFile(path.join(repository.root, 'packages/engine/src/story.ts'));

		await expect(
			applyAmericanEnglishMigration(
				clone(plan) as Awaited<ReturnType<typeof planAmericanEnglishMigration>>,
				{ repositoryRoot: repository.root, receiptPath }
			)
		).rejects.toThrow(/private|materialization|original.*plan/iu);
		expect(await readFile(path.join(repository.root, 'packages/engine/src/story.ts'))).toEqual(
			before
		);
		expect(git(repository.root, ['status', '--porcelain=v1'])).toBe('');
		await expect(lstat(receiptPath)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('allows a reparsed direct-only plan with no owner closure', async () => {
		const color = retired('color');
		const repository = await makeRepository({ 'docs/note.txt': `${color}\n` });
		const receiptDirectory = await mkdtemp(path.join(tmpdir(), 'american-english-receipts-'));
		temporaryRoots.push(receiptDirectory);
		const plan = await planAmericanEnglishMigration({
			repositoryRoot: repository.root,
			baselineCommit: repository.baseline,
			ruleIds: ['color']
		});
		expect(plan.expectedOwnerSuccessors).toHaveLength(0);

		await expect(
			applyAmericanEnglishMigration(JSON.parse(JSON.stringify(plan)), {
				repositoryRoot: repository.root,
				receiptPath: path.join(receiptDirectory, 'initial.json')
			})
		).resolves.toMatchObject({ files: expect.any(Array) });
	});
});
