import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { EQUIPMENT_APPROVED_ROOT } from './equipment-approved-source-contract.js';
import { checkEquipmentApprovedSources } from './equipment-approved-source-promotion.js';

const repositoryRoot = process.cwd();

function absolute(repositoryPath: string): string {
	return path.join(repositoryRoot, ...repositoryPath.split('/'));
}

describe('Equipment approved-source validation', () => {
	it('validates approved masters after every selected campaign raster is retired', async () => {
		const validation = await checkEquipmentApprovedSources(repositoryRoot);
		expect(validation).toMatchObject({
			verified: 161,
			items: 140,
			armorSetReferences: 21,
			totalBytes: 224_157_513,
			retiredCandidateCount: 161,
			unexpectedFiles: 0
		});
		const manifest = JSON.parse(
			await readFile(absolute(`${EQUIPMENT_APPROVED_ROOT}/manifest.json`), 'utf8')
		) as { records: Array<{ candidate: { path: string } }> };
		for (const record of manifest.records) {
			await expect(access(absolute(record.candidate.path))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		}
	}, 120_000);
});
