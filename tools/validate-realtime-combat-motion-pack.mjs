import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';

const manifestPath = process.argv[2];
if (!manifestPath)
	throw new Error('Usage: node tools/validate-realtime-combat-motion-pack.mjs <manifest.json>');
const groundArtifactFlag = process.argv.indexOf('--max-advance-ground-artifact-pixels');
const maximumAdvanceGroundArtifactPixels =
	groundArtifactFlag >= 0
		? Number.parseInt(process.argv[groundArtifactFlag + 1] ?? '', 10)
		: undefined;
if (
	maximumAdvanceGroundArtifactPixels !== undefined &&
	(!Number.isInteger(maximumAdvanceGroundArtifactPixels) || maximumAdvanceGroundArtifactPixels < 0)
) {
	throw new Error('Maximum advance ground artifact pixels must be a non-negative integer.');
}
const advanceSupportEvidenceFlag = process.argv.indexOf('--advance-support-evidence');
const advanceSupportEvidencePath =
	advanceSupportEvidenceFlag >= 0 ? process.argv[advanceSupportEvidenceFlag + 1] : undefined;
if (advanceSupportEvidenceFlag >= 0 && !advanceSupportEvidencePath) {
	throw new Error('Advance support evidence path is required.');
}

if (advanceSupportEvidencePath) {
	const evidence = JSON.parse(await readFile(advanceSupportEvidencePath, 'utf8'));
	if (evidence.actionAuthority !== 'classical-human-run-5') {
		throw new Error('Advance support evidence action authority is invalid.');
	}
	if (
		!Array.isArray(evidence.support) ||
		!evidence.support.every((value) => typeof value === 'string') ||
		evidence.support.join(',') !== 'left,left,none,right,right'
	) {
		throw new Error('Advance support evidence support sequence is invalid.');
	}
	if (!Array.isArray(evidence.cellSha256) || evidence.cellSha256.length !== 5) {
		throw new Error('Advance support evidence requires five unique cell hashes.');
	}
	if (
		!evidence.cellSha256.every((value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value))
	) {
		throw new Error('Advance support evidence cell hashes must be lowercase SHA-256 values.');
	}
	if (new Set(evidence.cellSha256).size !== 5) {
		throw new Error('Advance support evidence requires five unique cell hashes.');
	}
	if (evidence.status !== 'candidate') {
		throw new Error('Advance support evidence status must be candidate.');
	}
}

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
if (maximumAdvanceGroundArtifactPixels !== undefined) {
	const { data, info } = await sharp(atlasPath)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	for (const frameName of manifest.clips.advance.frames) {
		const frame = atlas.frames[frameName].frame;
		let artifactPixels = 0;
		for (let y = Math.max(0, frame.h - 48); y < frame.h; y += 1) {
			for (let x = 0; x < frame.w; x += 1) {
				const offset = ((frame.y + y) * info.width + frame.x + x) * info.channels;
				const red = data[offset];
				const green = data[offset + 1];
				const blue = data[offset + 2];
				const alpha = data[offset + 3];
				const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
				if (alpha > 18 && red > 155 && green > 155 && blue > 155 && chroma < 24) {
					artifactPixels += 1;
				}
			}
		}
		if (artifactPixels > maximumAdvanceGroundArtifactPixels) {
			throw new Error(
				`Advance frame ${frameName} contains a baked ground artifact (${artifactPixels} bright neutral pixels).`
			);
		}
	}
}
console.log(
	JSON.stringify({ valid: true, actorId: manifest.actorId, frames: frameNames.length, atlasPath })
);
