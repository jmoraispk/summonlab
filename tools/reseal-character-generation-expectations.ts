import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { generatePackTwoPilot } from '../packages/characters/src/index.js';

const repositoryRoot = process.cwd();
const specificationPath = path.join(repositoryRoot, 'packages/characters/src/characters.spec.ts');
const check = process.argv.includes('--check');
const source = await readFile(specificationPath, 'utf8');
const marker = '\t\texpect(pilot.map((draft) => draft.manifestHash)).toEqual([\n';
const start = source.indexOf(marker);
if (start < 0) throw new Error('Pack 2 pilot expectation marker is absent');
const valuesStart = start + marker.length;
const endMarker = '\t\t]);';
const valuesEnd = source.indexOf(endMarker, valuesStart);
if (valuesEnd < 0) throw new Error('Pack 2 pilot expectation terminator is absent');
const pilot = await generatePackTwoPilot();
const values = pilot
	.map(
		({ manifestHash }, index) => `\t\t\t'${manifestHash}'${index === pilot.length - 1 ? '' : ','}\n`
	)
	.join('');
const expected = `${source.slice(0, valuesStart)}${values}${source.slice(valuesEnd)}`;

if (check) {
	if (source !== expected) throw new Error('Character generation expectations require resealing');
} else if (source !== expected) {
	await writeFile(specificationPath, expected, 'utf8');
}
