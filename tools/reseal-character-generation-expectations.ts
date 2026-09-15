import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	PACK_TWO_PILOT_SEEDS,
	generateCharacterDraft,
	generatePackTwoCohort,
	generatePackTwoPilot,
	recipeFromSeed
} from '../packages/characters/src/index.js';

const repositoryRoot = process.cwd();
const specificationPath = path.join(repositoryRoot, 'packages/characters/src/characters.spec.ts');
const check = process.argv.includes('--check');
const source = await readFile(specificationPath, 'utf8');

function replaceHashArray(
	current: string,
	label: string,
	marker: string,
	hashes: readonly string[]
): string {
	const start = current.indexOf(marker);
	if (start < 0) throw new Error(`${label} expectation marker is absent`);
	const valuesStart = start + marker.length;
	const endMarker = '\t\t]);';
	const valuesEnd = current.indexOf(endMarker, valuesStart);
	if (valuesEnd < 0) throw new Error(`${label} expectation terminator is absent`);
	const values = hashes
		.map(
			(manifestHash, index) => `\t\t\t'${manifestHash}'${index === hashes.length - 1 ? '' : ','}\n`
		)
		.join('');
	return `${current.slice(0, valuesStart)}${values}${current.slice(valuesEnd)}`;
}

function replaceHashValue(current: string, label: string, marker: string, hash: string): string {
	const start = current.indexOf(marker);
	if (start < 0) throw new Error(`${label} expectation marker is absent`);
	const valuesStart = start + marker.length;
	const endMarker = '\t\t);';
	const valuesEnd = current.indexOf(endMarker, valuesStart);
	if (valuesEnd < 0) throw new Error(`${label} expectation terminator is absent`);
	return `${current.slice(0, valuesStart)}\t\t\t'${hash}'\n${current.slice(valuesEnd)}`;
}

const [ember, pilot, cohort] = await Promise.all([
	generateCharacterDraft(recipeFromSeed('ember-01')),
	generatePackTwoPilot(),
	generatePackTwoCohort()
]);
const expansion = cohort.slice(PACK_TWO_PILOT_SEEDS.length);
const expected = replaceHashArray(
	replaceHashArray(
		replaceHashValue(
			source,
			'human-v3 Ember',
			'\t\texpect(ember.manifestHash).toBe(\n',
			ember.manifestHash
		),
		'Pack 2 pilot',
		'\t\texpect(pilot.map((draft) => draft.manifestHash)).toEqual([\n',
		pilot.map(({ manifestHash }) => manifestHash)
	),
	'Pack 2 expansion',
	'\t\texpect(expansion.map((draft) => draft.manifestHash)).toEqual([\n',
	expansion.map(({ manifestHash }) => manifestHash)
);

if (check) {
	if (source !== expected) throw new Error('Character generation expectations require resealing');
} else if (source !== expected) {
	await writeFile(specificationPath, expected, 'utf8');
}
