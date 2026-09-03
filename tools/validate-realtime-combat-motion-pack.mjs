import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';

const manifestPath = process.argv[2];
if (!manifestPath)
	throw new Error('Usage: node tools/validate-realtime-combat-motion-pack.mjs <manifest.json>');

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const requiredClips = ['idle', 'advance', 'attack', 'hit', 'down'];
for (const clip of requiredClips) {
	if (!manifest.clips?.[clip]?.frames?.length) throw new Error(`Missing ${clip} clip.`);
	if (!(manifest.clips[clip].fps > 0)) throw new Error(`Invalid ${clip} fps.`);
}
if (manifest.feetAnchor?.x !== 0.5 || !(manifest.feetAnchor?.y > 0.9)) {
	throw new Error('Motion pack feet anchor is not bottom-center.');
}

const atlasJsonPath = path.join(path.dirname(manifestPath), manifest.atlas);
const atlas = JSON.parse(await readFile(atlasJsonPath, 'utf8'));
const frameNames = requiredClips.flatMap((clip) => manifest.clips[clip].frames);
if (new Set(frameNames).size !== frameNames.length)
	throw new Error('Motion pack reuses frame names.');
for (const frameName of frameNames) {
	if (!atlas.frames?.[frameName]) throw new Error(`Atlas is missing ${frameName}.`);
}

const atlasPath = path.join(path.dirname(atlasJsonPath), atlas.meta.image);
const metadata = await sharp(atlasPath).metadata();
if (
	!metadata.hasAlpha ||
	metadata.width !== atlas.meta.size.w ||
	metadata.height !== atlas.meta.size.h
) {
	throw new Error('Atlas dimensions or alpha do not match metadata.');
}
console.log(
	JSON.stringify({ valid: true, actorId: manifest.actorId, frames: frameNames.length, atlasPath })
);
