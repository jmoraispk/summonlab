import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';

import {
	MASS_PRODUCTION_MANIFEST_PATH,
	type MassProductionManifest,
	sha256
} from './skill-icon-mass-production-lib.js';
import { normalizeSkillSource } from './persist-skill-icon-mass-output.js';

async function writeAtomic(destination: string, bytes: Buffer): Promise<void> {
	await mkdir(path.dirname(destination), { recursive: true });
	const stage = `${destination}.stage-${process.pid}-${randomUUID()}`;
	let handle: Awaited<ReturnType<typeof open>> | null = null;
	try {
		handle = await open(stage, 'wx');
		await handle.writeFile(bytes);
		await handle.sync();
		await handle.close();
		handle = null;
		await rename(stage, destination);
	} catch (error) {
		await handle?.close().catch(() => undefined);
		await unlink(stage).catch(() => undefined);
		throw error;
	}
}

function applyExteriorGeometryMask(
	unkeyedData: Buffer,
	keyedData: Buffer,
	width: number,
	height: number
): { readonly data: Buffer; readonly removed: number } {
	const output = Buffer.from(unkeyedData);
	const scaleX = width / 1024;
	const scaleY = height / 1024;
	let removed = 0;
	for (let y = 0; y < height; y += 1) {
		const canonicalY = y / scaleY;
		let halfWidth = 0;
		if (canonicalY >= 8 && canonicalY <= 263) {
			halfWidth = ((canonicalY - 8) / 255) * 432;
		} else if (canonicalY > 263 && canonicalY <= 749) {
			halfWidth = 432;
		} else if (canonicalY > 749 && canonicalY <= 1016) {
			halfWidth = ((1016 - canonicalY) / 267) * 432;
		}
		for (let x = 0; x < width; x += 1) {
			const canonicalX = x / scaleX;
			const inOuterHexagon = halfWidth > 0 && Math.abs(canonicalX - 512) <= halfWidth;
			const inOuterCrest =
				canonicalY >= 8 && canonicalY <= 264 && canonicalX >= 340 && canonicalX <= 684;
			const alphaOffset = (y * width + x) * 4 + 3;
			if (!inOuterHexagon && !inOuterCrest) {
				if ((output[alphaOffset] ?? 0) > 0) removed += 1;
				output[alphaOffset] = 0;
				continue;
			}
			let innerHalfWidth = 0;
			if (canonicalY >= 120 && canonicalY <= 315) {
				innerHalfWidth = ((canonicalY - 120) / 195) * 342;
			} else if (canonicalY > 315 && canonicalY <= 700) {
				innerHalfWidth = 342;
			} else if (canonicalY > 700 && canonicalY <= 895) {
				innerHalfWidth = ((895 - canonicalY) / 195) * 342;
			}
			const inInnerHexagon = innerHalfWidth > 0 && Math.abs(canonicalX - 512) <= innerHalfWidth;
			let crestHalfWidth = 0;
			if (canonicalY >= 36 && canonicalY <= 80) {
				crestHalfWidth = ((canonicalY - 36) / 44) * 92;
			} else if (canonicalY > 80 && canonicalY <= 166) {
				crestHalfWidth = 92;
			} else if (canonicalY > 166 && canonicalY <= 210) {
				crestHalfWidth = ((210 - canonicalY) / 44) * 92;
			}
			const inInnerCrest = crestHalfWidth > 0 && Math.abs(canonicalX - 512) <= crestHalfWidth;
			if (!inInnerHexagon && !inInnerCrest) {
				output[alphaOffset] = keyedData[alphaOffset] ?? 0;
			}
		}
	}
	return { data: output, removed };
}

export async function repairSkillIconMassExteriors(root = process.cwd()): Promise<{
	readonly scanned: number;
	readonly repaired: number;
	readonly removedPixels: number;
}> {
	root = path.resolve(root);
	const manifest = JSON.parse(
		await readFile(path.resolve(root, MASS_PRODUCTION_MANIFEST_PATH), 'utf8')
	) as MassProductionManifest;
	let repaired = 0;
	let removedPixels = 0;
	for (const skill of manifest.skills) {
		const iconPath = path.resolve(root, skill.finalImagePath);
		const currentBytes = await readFile(iconPath);
		const resultPath = path.resolve(root, skill.resultPath);
		const result = JSON.parse(await readFile(resultPath, 'utf8')) as {
			providerSource: { path: string | null };
			output: { contentHash: string; bytes: number };
			processing: string;
			normalizationHistory?: {
				operation: 'restore-interior-and-mask-exterior';
				preRepairContentHash: string;
				postRepairContentHash: string;
				removedPixels: number;
			};
		};
		if (!result.providerSource.path) throw new Error(`Missing provider source: ${skill.targetId}`);
		if (result.output.contentHash !== sha256(currentBytes)) {
			throw new Error(`Result does not bind the current output: ${skill.targetId}`);
		}
		const providerBytes = await readFile(path.resolve(root, result.providerSource.path));
		const originalBytes = await normalizeSkillSource(providerBytes);
		const keyed = await sharp(originalBytes)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		const unkeyedBytes = await sharp(providerBytes, { failOn: 'error' })
			.ensureAlpha()
			.resize(1024, 1024, {
				fit: 'contain',
				background: { r: 0, g: 0, b: 0, alpha: 0 },
				withoutEnlargement: true
			})
			.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
			.toBuffer();
		const decoded = await sharp(unkeyedBytes)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		const cleaned = applyExteriorGeometryMask(
			decoded.data,
			keyed.data,
			decoded.info.width,
			decoded.info.height
		);
		const outputBytes = await sharp(cleaned.data, {
			raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 }
		})
			.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
			.toBuffer();
		result.output.contentHash = sha256(outputBytes);
		result.output.bytes = outputBytes.byteLength;
		result.processing = 'keyed-frame-plus-restored-interior-and-exterior-mask';
		result.normalizationHistory = {
			operation: 'restore-interior-and-mask-exterior',
			preRepairContentHash: sha256(originalBytes),
			postRepairContentHash: sha256(outputBytes),
			removedPixels: cleaned.removed
		};
		if (!currentBytes.equals(outputBytes)) await writeAtomic(iconPath, outputBytes);
		await writeAtomic(resultPath, Buffer.from(`${JSON.stringify(result, null, '\t')}\n`));
		if (!currentBytes.equals(outputBytes)) repaired += 1;
		removedPixels += cleaned.removed;
	}
	return { scanned: manifest.skills.length, repaired, removedPixels };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	repairSkillIconMassExteriors()
		.then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}
