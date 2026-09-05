import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';

const FRAME_SIZE = 256;
const CONTACT_LINE_Y = 246;
const ALPHA_THRESHOLD = 18;
const REQUIRED_SUPPORT = ['left', 'left', 'none', 'right', 'right'];
const NON_ADVANCE_CLIPS = { idle: 5, attack: 5, hit: 2, down: 3 };
const CLI_FLAGS = ['--manifest', '--evidence', '--preserve-from-manifest'];

function valuesFor(flag) {
	const values = [];
	for (let index = 2; index < process.argv.length; index += 1) {
		if (process.argv[index] === flag) values.push(process.argv[index + 1]);
	}
	return values;
}

function usageError() {
	throw new Error(
		'Usage: node tools/validate-iron-guardian-motion-v5.mjs --manifest <v5-manifest.json> --evidence <v5-support.json> --preserve-from-manifest <v4-manifest.json>'
	);
}

if (process.argv.length !== 8) usageError();
for (let index = 2; index < process.argv.length; index += 2) {
	if (!CLI_FLAGS.includes(process.argv[index]) || process.argv[index + 1]?.startsWith('--')) {
		usageError();
	}
}
for (const flag of CLI_FLAGS) {
	if (valuesFor(flag).length !== 1) usageError();
}

const manifestPath = valuesFor('--manifest')[0];
const evidencePath = valuesFor('--evidence')[0];
const preservedManifestPath = valuesFor('--preserve-from-manifest')[0];
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
const preservedManifest = JSON.parse(await readFile(preservedManifestPath, 'utf8'));

if (manifest.version !== 5 || evidence.version !== 5) {
	throw new Error('Toma v5 manifest and evidence versions must both be 5.');
}
if (preservedManifest.version !== 4) {
	throw new Error('The preserve-from manifest must be Toma v4.');
}
if (
	manifest.actorId !== 'iron-guardian' ||
	evidence.actorId !== manifest.actorId ||
	preservedManifest.actorId !== manifest.actorId
) {
	throw new Error('Toma v5 actor does not match its evidence and preserved manifest.');
}
if (evidence.clip !== 'advance' || evidence.actionAuthority !== 'classical-human-run-5') {
	throw new Error('Toma v5 evidence must describe the classical-human-run-5 advance clip.');
}
if (evidence.status !== 'candidate') {
	throw new Error('Toma v5 evidence status must remain candidate.');
}
if (
	!Array.isArray(evidence.support) ||
	evidence.support.length !== REQUIRED_SUPPORT.length ||
	evidence.support.some((support, index) => support !== REQUIRED_SUPPORT[index])
) {
	throw new Error('Toma v5 support sequence must be left,left,none,right,right.');
}
if (!Array.isArray(manifest.clips?.advance?.frames) || manifest.clips.advance.frames.length !== 5) {
	throw new Error('Toma v5 requires exactly five runtime advance frames.');
}
if (new Set(manifest.clips.advance.frames).size !== 5) {
	throw new Error('Toma v5 requires five unique runtime advance frame names.');
}
if (
	!Array.isArray(evidence.cellSha256) ||
	evidence.cellSha256.length !== 5 ||
	!evidence.cellSha256.every((hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)) ||
	new Set(evidence.cellSha256).size !== 5
) {
	throw new Error('Toma v5 evidence requires five unique lowercase SHA-256 cell hashes.');
}
if (
	typeof evidence.sourceSheetPath !== 'string' ||
	!evidence.sourceSheetPath ||
	evidence.sourceGrid?.columns !== 5 ||
	evidence.sourceGrid?.rows !== 4 ||
	evidence.sourceGrid?.row !== 1
) {
	throw new Error('Toma v5 evidence source grid must be 5x4@1.');
}

const sourceSheetPath = path.resolve(path.dirname(evidencePath), evidence.sourceSheetPath);
const sourceMetadata = await sharp(sourceSheetPath).metadata();
if (!sourceMetadata.width || !sourceMetadata.height) {
	throw new Error('Toma v5 evidence source sheet has no dimensions.');
}
const sourceTop = Math.floor(sourceMetadata.height / evidence.sourceGrid.rows);
const sourceBottom = Math.floor((2 * sourceMetadata.height) / evidence.sourceGrid.rows);
const computedCellHashes = [];
for (let column = 0; column < evidence.sourceGrid.columns; column += 1) {
	const sourceLeft = Math.floor((column * sourceMetadata.width) / evidence.sourceGrid.columns);
	const sourceRight = Math.floor(
		((column + 1) * sourceMetadata.width) / evidence.sourceGrid.columns
	);
	const pixels = await sharp(sourceSheetPath)
		.removeAlpha()
		.extract({
			left: sourceLeft,
			top: sourceTop,
			width: sourceRight - sourceLeft,
			height: sourceBottom - sourceTop
		})
		.raw()
		.toBuffer();
	computedCellHashes.push(createHash('sha256').update(pixels).digest('hex'));
}
if (computedCellHashes.some((hash, index) => hash !== evidence.cellSha256[index])) {
	throw new Error('Toma v5 source cell hashes do not match the bound source sheet.');
}

const measurementFields = [
	'frame',
	'crownY',
	'lowestOpaqueY',
	'shieldDiameter',
	'strideWidth',
	'torsoTop'
];
if (!Array.isArray(evidence.measurements) || evidence.measurements.length !== 5) {
	throw new Error('Toma v5 evidence requires five ordered measurements.');
}
for (let index = 0; index < evidence.measurements.length; index += 1) {
	const measurement = evidence.measurements[index];
	if (
		measurement?.frame !== index + 1 ||
		measurement?.support !== evidence.support[index] ||
		measurementFields.some(
			(field) => !Number.isInteger(measurement?.[field]) || measurement[field] < 0
		) ||
		measurement.shieldDiameter < 1 ||
		measurement.strideWidth < 1
	) {
		throw new Error(
			'Toma v5 measurements must be ordered frames 1-5 with matching support labels.'
		);
	}
}

const range = (values) => Math.max(...values) - Math.min(...values);
const relativeRange = (values) => range(values) / Math.max(...values);
const relativeDifference = (left, right) => Math.abs(left - right) / Math.max(left, right);
const airborneGap = CONTACT_LINE_Y - evidence.measurements[2].lowestOpaqueY;
if (airborneGap < 4 || airborneGap > 10) {
	throw new Error('Toma v5 airborne gap must be between 4 and 10 pixels.');
}
if (range(evidence.measurements.map(({ crownY }) => crownY)) > 16) {
	throw new Error('Toma v5 crown-height spread must not exceed 16 pixels.');
}
if (relativeRange(evidence.measurements.map(({ shieldDiameter }) => shieldDiameter)) > 0.05) {
	throw new Error('Toma v5 shield diameter variance must not exceed 5%.');
}
const frame1 = evidence.measurements[0];
const frame4 = evidence.measurements[3];
if (relativeDifference(frame1.strideWidth, frame4.strideWidth) > 0.08) {
	throw new Error('Toma v5 opposite contacts must keep stride width within 8%.');
}
if (Math.abs(frame1.torsoTop - frame4.torsoTop) > 8) {
	throw new Error('Toma v5 opposite contacts must keep torso height within 8 pixels.');
}

async function loadRuntimePack(runtimeManifestPath, runtimeManifest) {
	const atlasJsonPath = path.resolve(path.dirname(runtimeManifestPath), runtimeManifest.atlas);
	const atlas = JSON.parse(await readFile(atlasJsonPath, 'utf8'));
	const atlasPath = path.resolve(path.dirname(atlasJsonPath), atlas.meta.image);
	const { data, info } = await sharp(atlasPath)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	if (info.width !== atlas.meta.size?.w || info.height !== atlas.meta.size?.h) {
		throw new Error('Runtime atlas dimensions do not match atlas metadata.');
	}
	return { atlas, atlasPath, data, info };
}

function extractFrame(pack, frameName) {
	const frame = pack.atlas.frames?.[frameName]?.frame;
	if (
		!frame ||
		frame.w !== FRAME_SIZE ||
		frame.h !== FRAME_SIZE ||
		frame.x < 0 ||
		frame.y < 0 ||
		frame.x + frame.w > pack.info.width ||
		frame.y + frame.h > pack.info.height
	) {
		throw new Error(`Runtime atlas is missing a valid ${frameName} cell.`);
	}
	const pixels = Buffer.alloc(frame.w * frame.h * 4);
	for (let row = 0; row < frame.h; row += 1) {
		const sourceStart = ((frame.y + row) * pack.info.width + frame.x) * 4;
		pack.data.copy(pixels, row * frame.w * 4, sourceStart, sourceStart + frame.w * 4);
	}
	return pixels;
}

function alphaBounds(pixels) {
	let crownY = FRAME_SIZE;
	let lowestOpaqueY = -1;
	for (let pixel = 0; pixel < pixels.length / 4; pixel += 1) {
		if (pixels[pixel * 4 + 3] <= ALPHA_THRESHOLD) continue;
		const y = Math.floor(pixel / FRAME_SIZE);
		crownY = Math.min(crownY, y);
		lowestOpaqueY = Math.max(lowestOpaqueY, y);
	}
	if (lowestOpaqueY < 0) throw new Error('Runtime advance frame has no opaque subject pixels.');
	return { crownY, lowestOpaqueY };
}

const v5Pack = await loadRuntimePack(manifestPath, manifest);
const v4Pack = await loadRuntimePack(preservedManifestPath, preservedManifest);
const decodedAdvanceHashes = [];
for (let index = 0; index < manifest.clips.advance.frames.length; index += 1) {
	const pixels = extractFrame(v5Pack, manifest.clips.advance.frames[index]);
	decodedAdvanceHashes.push(createHash('sha256').update(pixels).digest('hex'));
	const bounds = alphaBounds(pixels);
	const measurement = evidence.measurements[index];
	if (bounds.crownY !== measurement.crownY) {
		throw new Error(`Frame ${index + 1} crownY does not match the direct runtime alpha bounds.`);
	}
	if (bounds.lowestOpaqueY !== measurement.lowestOpaqueY) {
		throw new Error(
			`Frame ${index + 1} lowestOpaqueY does not match the direct runtime alpha bounds.`
		);
	}
}
if (new Set(decodedAdvanceHashes).size !== 5) {
	throw new Error('Toma v5 requires five unique decoded runtime advance frames.');
}

let preservedFrames = 0;
for (const [clip, requiredCount] of Object.entries(NON_ADVANCE_CLIPS)) {
	const v5Frames = manifest.clips?.[clip]?.frames;
	const v4Frames = preservedManifest.clips?.[clip]?.frames;
	if (
		!Array.isArray(v5Frames) ||
		!Array.isArray(v4Frames) ||
		v5Frames.length !== requiredCount ||
		v4Frames.length !== requiredCount
	) {
		throw new Error(`Toma non-advance preservation requires ${requiredCount} ${clip} frames.`);
	}
	for (let index = 0; index < requiredCount; index += 1) {
		if (!extractFrame(v5Pack, v5Frames[index]).equals(extractFrame(v4Pack, v4Frames[index]))) {
			throw new Error(`Toma non-advance preservation failed for ${clip} frame ${index + 1}.`);
		}
		preservedFrames += 1;
	}
}

process.stdout.write(
	`${JSON.stringify({
		valid: true,
		actorId: manifest.actorId,
		advanceFrames: manifest.clips.advance.frames.length,
		preservedFrames,
		atlasPath: v5Pack.atlasPath
	})}\n`
);
