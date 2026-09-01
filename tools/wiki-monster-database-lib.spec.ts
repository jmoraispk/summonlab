import { describe, expect, it } from 'vitest';

import {
	buildMonsterWikiPage,
	CURRENT_MONSTER_PRODUCTION_TARGET,
	LEGACY_MONSTER_VISUAL_STUDIES,
	matchesContentHash,
	partitionMonsterVisualStudies,
	presentationStatusForVisualStudy,
	selectCanonicalVariants,
	type MonsterVisualCandidate,
	wikiPresentationCounterplay
} from './wiki-monster-database-lib.js';

const candidate = (
	affinity: MonsterVisualCandidate['affinity'],
	status: MonsterVisualCandidate['status'],
	version: number
): MonsterVisualCandidate => ({
	targetId: `test-wolf-${affinity}-v${version}`,
	speciesId: 'test-wolf',
	affinity,
	status,
	candidatePath: `assets/test-wolf/${affinity}-v${version}.png`,
	contentHash: `${affinity}-${version}`,
	version
});

describe('monster wiki database export', () => {
	it('detects when a source image no longer matches its review-catalog hash', () => {
		const content = new TextEncoder().encode('bound visual candidate');

		expect(
			matchesContentHash(
				content,
				'f45f37ad2073fd1812ac64430b5656d59650d47d36c1f4835248d084c70dca36'
			)
		).toBe(true);
		expect(matchesContentHash(content, '0'.repeat(64))).toBe(false);
	});

	it('selects one strongest candidate for every canonical affinity', () => {
		const selected = selectCanonicalVariants([
			candidate('normal', 'candidate', 1),
			candidate('wood', 'candidate', 1),
			candidate('fire', 'revise', 2),
			candidate('fire', 'candidate', 1),
			candidate('metal', 'candidate', 1),
			candidate('water', 'candidate', 1),
			candidate('wind', 'revise', 1),
			candidate('wind', 'revise', 2)
		]);

		expect(selected.map((entry) => entry.affinity)).toEqual([
			'normal',
			'wood',
			'fire',
			'metal',
			'water',
			'wind'
		]);
		expect(selected.find((entry) => entry.affinity === 'fire')?.version).toBe(1);
		expect(selected.find((entry) => entry.affinity === 'wind')?.version).toBe(2);
	});

	it('separates the current five-form target from preserved legacy visual studies', () => {
		const visuals = [
			candidate('normal', 'candidate', 1),
			candidate('wood', 'candidate', 1),
			candidate('fire', 'candidate', 1),
			candidate('metal', 'candidate', 1),
			candidate('water', 'candidate', 1),
			candidate('wind', 'candidate', 1)
		];

		expect(CURRENT_MONSTER_PRODUCTION_TARGET).toEqual(['normal', 'fire', 'earth', 'wind', 'water']);
		expect(LEGACY_MONSTER_VISUAL_STUDIES).toEqual(['wood', 'metal']);
		expect(partitionMonsterVisualStudies(visuals)).toEqual({
			currentCandidates: [visuals[0], visuals[2], visuals[5], visuals[4]],
			missingCurrentTargets: ['earth'],
			legacyCandidates: [visuals[1], visuals[3]]
		});
		expect(presentationStatusForVisualStudy('fire')).toBe('current-target-candidate');
		expect(presentationStatusForVisualStudy('wood')).toBe('legacy-candidate');
		expect(presentationStatusForVisualStudy('metal')).toBe('legacy-candidate');
	});

	it('rejects an incomplete six-affinity identity set', () => {
		expect(() =>
			selectCanonicalVariants([
				candidate('normal', 'candidate', 1),
				candidate('wood', 'candidate', 1)
			])
		).toThrow(/missing affinity/i);
	});

	it('renders an individual editable wiki page around generated visual evidence', () => {
		const page = buildMonsterWikiPage({
			id: 'test-wolf',
			name: 'Test Wolf',
			familyId: 'beasts',
			familyName: 'Beasts',
			role: 'Fast flanking predator',
			telegraph: 'Lowers its shoulders before a rush.',
			counterplay: 'Open flank after the rush.',
			skills: ['Pursuit', 'Trip attack'],
			debutFloor: 3
		});

		expect(page).toContain('# Test Wolf');
		expect(page).toContain('Wiki ID: `monster.test-wolf`');
		expect(page).toContain('Beasts');
		expect(page).toContain('Fast flanking predator');
		expect(page).toContain('Current production target: Normal, Fire, Earth, Wind, Water');
		expect(page).toContain(
			'Legacy visual studies: Wood and Metal candidates; not current affinities and not runtime assets'
		);
		expect(page).not.toMatch(/candidate matrix|hash-bound|hashes, and statuses/iu);
	});

	it('uses wiki-only counterplay copy for the giant tower dragon', () => {
		expect(
			wikiPresentationCounterplay(
				'giant-tower-dragon',
				'resonance scars exposed only after a committed attack'
			)
		).toBe('arcane scars exposed only after a committed attack');
		expect(wikiPresentationCounterplay('test-wolf', 'Open flank after the rush.')).toBe(
			'Open flank after the rush.'
		);
	});
});
