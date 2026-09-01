import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const temporaryRoots: string[] = [];
const validatorPath = path.resolve('tools/validate-wiki.mjs');

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

async function writeFixture(options: { provenance: boolean; mutateDerived?: boolean }) {
	const root = await mkdtemp(path.join(os.tmpdir(), 'wiki-provenance-'));
	temporaryRoots.push(root);
	const derivedFile = 'apps/web/static/wiki-media/skills/test-domain.webp';
	const referenceFile = 'assets/wiki/skills/domain-art-v1/sources/test-initial.webp';
	const sourceFile = 'assets/wiki/skills/domain-art-v1/sources/test-final.webp';
	const provenanceFile = 'assets/wiki/skills/domain-art-v1/catalog.json';
	const original = await readFile('apps/web/static/wiki-media/skills/martial-domain.webp');
	const derived = Buffer.from(original);
	if (options.mutateDerived) derived[derived.length - 1] ^= 1;
	const sha256 = createHash('sha256').update(original).digest('hex');

	for (const file of [derivedFile, referenceFile, sourceFile]) {
		await mkdir(path.dirname(path.join(root, file)), { recursive: true });
	}
	await writeFile(path.join(root, derivedFile), derived);
	await writeFile(path.join(root, referenceFile), original);
	await writeFile(path.join(root, sourceFile), original);
	await mkdir(path.join(root, 'docs/wiki'), { recursive: true });
	await writeFile(path.join(root, 'docs/wiki/test.md'), '# Test\n\nWiki ID: `test.page`\n');
	await writeFile(
		path.join(root, 'docs/wiki/catalog.json'),
		JSON.stringify(
			{
				schemaVersion: 'summonlab-wiki-catalog-v1',
				entries: [
					{
						wikiId: 'test.page',
						path: 'docs/wiki/test.md',
						designStatus: 'draft',
						implementationStatus: 'partial',
						visualStatus: 'candidate',
						spoilerScope: 'public',
						assets: [
							{
								assetKey: 'test-domain-v1',
								file: derivedFile,
								status: 'candidate',
								generationMode: 'built-in-imagegen',
								...(options.provenance ? { provenanceFile } : {})
							}
						]
					}
				]
			},
			null,
			2
		)
	);

	if (options.provenance) {
		await mkdir(path.dirname(path.join(root, provenanceFile)), { recursive: true });
		await writeFile(
			path.join(root, provenanceFile),
			JSON.stringify(
				{
					schemaVersion: 'summonlab-wiki-generated-art-v1',
					status: 'approval-candidate',
					assets: [
						{
							assetKey: 'test-domain-v1',
							status: 'approval-candidate',
							generationMode: 'built-in-imagegen',
							createdAt: '2026-08-31T17:41:44.630Z',
							prompt: 'Exact final edit prompt.',
							referenceInputs: [
								{
									assetKey: 'test-domain-initial-v1',
									file: referenceFile,
									width: 900,
									height: 900,
									bytes: original.length,
									sha256,
									prompt: 'Exact initial generation prompt.'
								}
							],
							sourceOriginal: {
								file: sourceFile,
								width: 900,
								height: 900,
								bytes: original.length,
								sha256
							},
							derived: {
								file: derivedFile,
								width: 900,
								height: 900,
								bytes: original.length,
								sha256,
								recipe: 'sharp resize 900x900 fit cover; webp quality 84 effort 5'
							},
							recognitionChecks: [
								{ name: 'domain objects preserved', passed: true, note: 'Fixture check.' },
								{ name: 'thumbnail legibility', passed: true, note: 'Fixture check.' },
								{ name: 'no text or watermark', passed: true, note: 'Fixture check.' }
							],
							productionNote: 'Approval candidate fixture.'
						}
					]
				},
				null,
				2
			)
		);
	}

	return root;
}

describe('wiki generated-art provenance validation', () => {
	it('rejects a generated wiki asset without a provenance manifest', async () => {
		const root = await writeFixture({ provenance: false });

		await expect(
			execFileAsync(process.execPath, [validatorPath, '--repository-root', root])
		).rejects.toMatchObject({
			stderr: expect.stringContaining('test.page/test-domain-v1 requires provenanceFile')
		});
	});

	it('rejects a one-byte mutation of a provenance-bound derived asset', async () => {
		const root = await writeFixture({ provenance: true, mutateDerived: true });

		await expect(
			execFileAsync(process.execPath, [validatorPath, '--repository-root', root])
		).rejects.toMatchObject({
			stderr: expect.stringContaining('test-domain-v1 derived SHA-256 mismatch')
		});
	});
});
