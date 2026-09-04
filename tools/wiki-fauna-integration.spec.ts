import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

describe('integrated monster wiki database', () => {
	it('adds the approved fauna program without changing the original 750 coordinates', async () => {
		const modulePath = './wiki-fauna-integration.js';
		let integration: typeof import('./wiki-fauna-integration.js') | undefined;
		try {
			integration = await import(modulePath);
		} catch {
			expect.fail('fauna wiki integration implementation is missing');
		}
		if (!integration) throw new Error('fauna wiki integration implementation is missing');

		const database = await integration.loadIntegratedMonsterWikiDatabase(repositoryRoot);
		expect(database.counts).toMatchObject({
			families: 38,
			forms: 190,
			coordinates: 950,
			currentClasses: 40,
			canonicalMappings: 15,
			bridgeOnly: 25
		});
		expect(database.forms.slice(0, 150).flatMap(({ coordinates }) => coordinates)).toHaveLength(
			750
		);
		const fauna = database.forms.slice(150);
		expect(fauna).toHaveLength(40);
		expect(
			fauna
				.flatMap(({ coordinates }) => coordinates)
				.every(
					(coordinate) =>
						coordinate.presentationStatus === 'runtime' &&
						coordinate.approvedPath?.startsWith(
							'assets/enemies/approved/fauna-family-v1/sources/'
						) &&
						coordinate.runtimePath?.startsWith('apps/web/static/runtime/enemies/fauna-family-v1/')
				)
		).toBe(true);
		const greyWolf = database.reconciliation.find(
			({ currentClassId }) => currentClassId === 'grey-wolf'
		);
		expect(greyWolf).toMatchObject({
			disposition: 'rename-map',
			canonicalFamilyId: 'wolves',
			canonicalFormId: 'wolf-grey-wolf'
		});
	}, 120_000);
});
