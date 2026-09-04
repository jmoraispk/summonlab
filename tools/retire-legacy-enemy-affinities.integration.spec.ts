import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	RETIREMENT_EXACT_DELETION_FILES,
	RETIREMENT_RECURSIVE_ROOTS
} from './retire-legacy-enemy-affinities-lib.js';
import { runLegacyAffinityRetirement } from './retire-legacy-enemy-affinities.js';

const temporaryRoots: string[] = [];
const silent = () => undefined;

async function makeRepository(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'summonlab-retirement-'));
	temporaryRoots.push(root);
	for (const path of RETIREMENT_RECURSIVE_ROOTS) {
		await mkdir(resolve(root, path), { recursive: true });
	}
	return root;
}

async function writeRepositoryFile(root: string, path: string, content: string): Promise<void> {
	const absolute = resolve(root, path);
	await mkdir(dirname(absolute), { recursive: true });
	await writeFile(absolute, content);
}

async function seedSafeRetirement(root: string): Promise<void> {
	const experiment = RETIREMENT_RECURSIVE_ROOTS[0];
	await writeRepositoryFile(
		root,
		`${experiment}/targets/wolf/wood.json`,
		`${JSON.stringify({ targetId: 'wolf-wood', affinity: 'wood' }, null, 2)}\n`
	);
	await writeRepositoryFile(
		root,
		`${experiment}/review/catalog.json`,
		`${JSON.stringify(
			{
				entries: [
					{ targetId: 'wolf-wood', affinity: 'wood' },
					{ targetId: 'wolf-fire', affinity: 'fire' }
				],
				targetCount: 2
			},
			null,
			2
		)}\n`
	);
	for (const path of RETIREMENT_EXACT_DELETION_FILES) {
		await writeRepositoryFile(root, path, 'obsolete route-only E2E\n');
	}
}

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

describe('retirement filesystem boundary', () => {
	it('previews, deletes exact E2Es, rewrites aggregates, and is idempotent', async () => {
		const root = await makeRepository();
		await seedSafeRetirement(root);

		const preview = await runLegacyAffinityRetirement({
			repositoryRoot: root,
			mode: 'check',
			log: silent
		});
		expect(preview.plan.deletions).toHaveLength(3);
		expect(preview.plan.deletions).toEqual(
			expect.arrayContaining(
				RETIREMENT_EXACT_DELETION_FILES.map((path) =>
					expect.objectContaining({ path, kind: 'obsolete-route-test' })
				)
			)
		);
		expect(preview.plan.rewrites).toHaveLength(1);
		expect(await readFile(resolve(root, RETIREMENT_EXACT_DELETION_FILES[0]), 'utf8')).toContain(
			'obsolete'
		);

		await runLegacyAffinityRetirement({ repositoryRoot: root, mode: 'write', log: silent });
		const catalog = JSON.parse(
			await readFile(resolve(root, `${RETIREMENT_RECURSIVE_ROOTS[0]}/review/catalog.json`), 'utf8')
		) as { entries: Array<{ affinity: string }>; targetCount: number };
		expect(catalog).toEqual({
			entries: [{ targetId: 'wolf-fire', affinity: 'fire' }],
			targetCount: 1
		});

		const second = await runLegacyAffinityRetirement({
			repositoryRoot: root,
			mode: 'check',
			log: silent
		});
		expect(second.plan.deletions).toHaveLength(0);
		expect(second.plan.rewrites).toHaveLength(0);
	});

	it('refuses a dangling exact dependency reference', async () => {
		const root = await makeRepository();
		await seedSafeRetirement(root);
		await writeRepositoryFile(root, 'docs/wiki/systems/visuals.md', 'target: wolf-wood\n');

		await expect(
			runLegacyAffinityRetirement({ repositoryRoot: root, mode: 'check', log: silent })
		).rejects.toThrow(/dangling active references.*wolf-wood/isu);
	});

	it('rejects a recursive root that is itself a symlink', async () => {
		const root = await makeRepository();
		const recursiveRoot = resolve(root, RETIREMENT_RECURSIVE_ROOTS[0]);
		const outside = await mkdtemp(join(tmpdir(), 'summonlab-retirement-outside-'));
		temporaryRoots.push(outside);
		await rm(recursiveRoot, { recursive: true });
		await symlink(outside, recursiveRoot, 'dir');

		await expect(
			runLegacyAffinityRetirement({ repositoryRoot: root, mode: 'check', log: silent })
		).rejects.toThrow(/recursive root is a symlink/iu);
	});

	it('rejects a symlinked file beneath a recursive root without touching its target', async () => {
		const root = await makeRepository();
		const recursiveRoot = resolve(root, RETIREMENT_RECURSIVE_ROOTS[0]);
		const outside = await mkdtemp(join(tmpdir(), 'summonlab-retirement-outside-'));
		temporaryRoots.push(outside);
		const outsideFile = resolve(outside, 'wood.json');
		const sentinel = '{"affinity":"wood","ownership":"external"}\n';
		await writeFile(outsideFile, sentinel);
		await mkdir(resolve(recursiveRoot, 'targets/wolf'), { recursive: true });
		await symlink(outsideFile, resolve(recursiveRoot, 'targets/wolf/wood.json'), 'file');

		await expect(
			runLegacyAffinityRetirement({ repositoryRoot: root, mode: 'check', log: silent })
		).rejects.toThrow(/refusing symlink in retirement traversal/iu);
		expect(await readFile(outsideFile, 'utf8')).toBe(sentinel);
	});

	it('rejects a nested symlink directory beneath a recursive root without touching its target', async () => {
		const root = await makeRepository();
		const recursiveRoot = resolve(root, RETIREMENT_RECURSIVE_ROOTS[0]);
		const outside = await mkdtemp(join(tmpdir(), 'summonlab-retirement-outside-'));
		temporaryRoots.push(outside);
		const outsideFile = resolve(outside, 'wood.json');
		const sentinel = '{"affinity":"wood","ownership":"external-directory"}\n';
		await writeFile(outsideFile, sentinel);
		await mkdir(resolve(recursiveRoot, 'targets'), { recursive: true });
		await symlink(outside, resolve(recursiveRoot, 'targets/wolf'), 'dir');

		await expect(
			runLegacyAffinityRetirement({ repositoryRoot: root, mode: 'check', log: silent })
		).rejects.toThrow(/refusing symlink in retirement traversal/iu);
		expect(await readFile(outsideFile, 'utf8')).toBe(sentinel);
	});

	it('rejects a symlinked ancestor of an exact dependency path', async () => {
		const root = await makeRepository();
		const outside = await mkdtemp(join(tmpdir(), 'summonlab-retirement-outside-'));
		temporaryRoots.push(outside);
		await writeFile(resolve(outside, 'visuals.md'), 'outside\n');
		await mkdir(resolve(root, 'docs/wiki'), { recursive: true });
		await symlink(outside, resolve(root, 'docs/wiki/systems'), 'dir');

		await expect(
			runLegacyAffinityRetirement({ repositoryRoot: root, mode: 'check', log: silent })
		).rejects.toThrow(/symlinked ancestor.*docs\/wiki\/systems/iu);
	});
});
