import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('Tower exploration map', () => {
	const root = fileURLToPath(new URL('.', import.meta.url));
	const source = readFileSync(`${root}/TowerExplorationMap.svelte`, 'utf8');

	it('makes server-approved destinations clickable and renders campaign chibis', () => {
		expect(source).toContain('exploration.destinations');
		expect(source).toContain('resident.combatArt.publicPath');
		expect(source).toContain('data-testid="tower-party-member"');
		expect(source).not.toContain('Choose an adjacent tile');
	});

	it('animates only the accepted server path before refreshing the projection', () => {
		expect(source).toContain('for (const tileId of travel.pathTileIds)');
		expect(source).toContain('visualTileId = tileId');
		expect(source).toContain('await onTravelComplete()');
		expect(source.indexOf('visualTileId = tileId')).toBeLessThan(
			source.indexOf('await onTravelComplete()')
		);
	});

	it('explains why a revealed tile is not selectable', () => {
		expect(source).toContain('No safe route avoids enemy-controlled tiles');
		expect(source).toContain("destination?.intent === 'encounter'");
	});
});
