import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { ENGINE_REPLAY_VECTOR_CASES } from '../packages/engine/src/compatibility/replay-vectors.js';
import { hashCanonical } from '../packages/engine/src/hash.js';

const repositoryRoot = process.cwd();
const replayPath = path.join(repositoryRoot, 'packages/engine/src/compatibility/replay-vectors.ts');
const check = process.argv.includes('--check');
const source = await readFile(replayPath, 'utf8');
let expected = source;
const replacements = new Map<string, string>();

for (const replayCase of ENGINE_REPLAY_VECTOR_CASES) {
	const previous = replayCase.vector.expectedFinalStateHash;
	const projected = hashCanonical(replayCase.finalState);
	const finalEventHash = replayCase.vector.events.at(-1)?.afterStateHash;
	if (finalEventHash !== projected) {
		throw new Error(`Replay ${replayCase.vector.id} final event does not bind its final state`);
	}
	if (previous === projected) continue;
	const existing = replacements.get(previous);
	if (existing !== undefined && existing !== projected) {
		throw new Error('One prior replay digest resolves to multiple projected states');
	}
	replacements.set(previous, projected);
}

for (const [previous, projected] of replacements) {
	if (!expected.includes(previous)) throw new Error('Prior replay expectation is absent');
	expected = expected.replaceAll(previous, projected);
}

if (check) {
	if (source !== expected) throw new Error('Engine replay expectations require resealing');
} else if (source !== expected) {
	await writeFile(replayPath, expected, 'utf8');
}
