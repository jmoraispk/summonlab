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
	planAmericanEnglishMigration
} from './american-english-migration.js';
import { type AmericanEnglishRuleId, deriveRetiredForms } from './american-english-policy.js';

const temporaryRoots: string[] = [];

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

	it('plans deterministic filtered edits while preserving dry-run bytes', async () => {
		const gray = retired('gray');
		const armor = retired('armor');
		const behavior = retired('behavior');
		const color = retired('color');
		const sharpMethod = `to${titleCase(color)}space`;
		const repository = await makeRepository({
			'.gitattributes': 'assets/*.bin -text\n',
			[`assets/${gray}.bin`]: Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(color)]),
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
			`assets/${gray}.bin -> assets/gray.bin`,
			`docs/${gray}/nested/${armor}-note.txt -> docs/gray/nested/armor-note.txt`,
			`links/${gray}-alias -> links/gray-alias`
		]);
		expect(first.pathMoves.find(({ source }) => source === `assets/${gray}.bin`)?.binary).toBe(
			true
		);
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
				reasons: ['contentHash']
			}
		]);
	});
});

describe('American English transactional application', () => {
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
			'.gitattributes': 'assets/*.bin -text\n',
			[`assets/${gray}.bin`]: binaryBytes,
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
		expect(await readFile(path.join(repository.root, 'assets/gray.bin'))).toEqual(binaryBytes);
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
		expect(receipt.ownerCounts).toEqual({ 'migration-planner': 3 });
		expect(receipt.files).toHaveLength(3);
		expect(
			receipt.files.find(
				({ successorPathHash }) => successorPathHash === pathHash('assets/gray.bin')
			)
		).toMatchObject({ unchangedBinary: true });
		const serialized = JSON.stringify(receipt);
		for (const value of [gray, armor, behavior, color]) expect(serialized).not.toContain(value);
		expect(serialized).not.toContain(`docs/${gray}/${armor}.txt`);
		expect(executablePath).not.toBe(path.join(repository.root, 'docs/gray/armor.txt'));
	});
});
