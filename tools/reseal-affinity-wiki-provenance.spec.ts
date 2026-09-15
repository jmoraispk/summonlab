import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	AFFINITY_WIKI_PROVENANCE_PATH,
	resealAffinityWikiProvenance
} from './reseal-affinity-wiki-provenance.js';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

describe('affinity wiki provenance reseal', () => {
	it('fails closed in check mode and byte-preservingly reseals promoted output hashes', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wiki-provenance-'));
		const outputPath = 'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg';
		const provenancePath = path.join(root, ...AFFINITY_WIKI_PROVENANCE_PATH.split('/'));
		await Promise.all([
			mkdir(path.dirname(path.join(root, outputPath)), { recursive: true }),
			mkdir(path.dirname(provenancePath), { recursive: true })
		]);
		const output = '<svg><desc>center</desc></svg>\n';
		const stale = '1'.repeat(64);
		const provenance = `{"promotions":[{"output":"${outputPath}","sha256":"${stale}"}]}\n`;
		await Promise.all([
			writeFile(path.join(root, outputPath), output),
			writeFile(provenancePath, provenance)
		]);

		await expect(resealAffinityWikiProvenance({ root, mode: 'check' })).rejects.toThrow(
			'Affinity wiki promotion lineage is stale'
		);
		await expect(resealAffinityWikiProvenance({ root, mode: 'write' })).resolves.toEqual({
			promotions: 1,
			resealed: 1
		});
		expect(await readFile(provenancePath, 'utf8')).toBe(provenance.replace(stale, sha256(output)));
		await expect(resealAffinityWikiProvenance({ root, mode: 'check' })).resolves.toEqual({
			promotions: 1,
			resealed: 0
		});
	});
});
