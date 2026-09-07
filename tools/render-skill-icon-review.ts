import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
	CANONICAL_SKILL_CATALOG_PATH,
	loadPromotedCanonicalSkillAssets
} from './skill-icon-canonical-assets.js';
import { composeSkillIconLayers } from './wiki-skill-visual-catalog-lib.js';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface CatalogRecord {
	readonly targetId: string;
	readonly rarity: 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
	readonly domain: string;
	readonly family: string;
	readonly motifFamily?: string;
}

export interface SkillIconReviewOptions {
	readonly targetId: string;
	readonly candidatePath?: string | undefined;
	readonly reviewOutputPath?: string | undefined;
	readonly familyOutputPath?: string | undefined;
}

function resolveInside(root: string, relativePath: string): string {
	if (path.isAbsolute(relativePath) || relativePath.includes('\\')) {
		throw new Error(`Expected repository-relative path: ${relativePath}`);
	}
	const absolute = path.resolve(root, relativePath);
	const relative = path.relative(root, absolute);
	if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`)) {
		throw new Error(`Path escapes repository: ${relativePath}`);
	}
	return absolute;
}

function temporaryOutput(root: string, relativePath: string): string {
	if (!relativePath.startsWith('.skill-icon-work/')) {
		throw new Error(`Review output must stay under .skill-icon-work/: ${relativePath}`);
	}
	return resolveInside(root, relativePath);
}

function temporaryInput(relativePath: string): string {
	if (!relativePath.startsWith('.skill-icon-work/')) {
		throw new Error(`Candidate must stay under .skill-icon-work/: ${relativePath}`);
	}
	return relativePath;
}

async function regularBytes(root: string, relativePath: string): Promise<Buffer> {
	const absolute = resolveInside(root, relativePath);
	const metadata = await lstat(absolute);
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Expected regular file: ${relativePath}`);
	}
	return readFile(absolute);
}

async function assertFramelessCandidate(bytes: Buffer): Promise<void> {
	const decoded = await sharp(bytes, { failOn: 'error' })
		.raw()
		.toBuffer({ resolveWithObject: true });
	if (decoded.info.width !== 1024 || decoded.info.height !== 1024 || decoded.info.channels !== 4) {
		throw new Error('Candidate must be a 1024px RGBA image');
	}
	let visible = false;
	for (let y = 0; y < decoded.info.height; y += 1) {
		for (let x = 0; x < decoded.info.width; x += 1) {
			const alpha = decoded.data[(y * decoded.info.width + x) * 4 + 3]!;
			visible ||= alpha > 0;
			if ((x === 0 || y === 0 || x === 1023 || y === 1023) && alpha !== 0) {
				throw new Error('Candidate canvas boundary must be transparent');
			}
		}
	}
	if (!visible) throw new Error('Candidate must contain visible artwork');
}

async function writeTemporary(output: string, bytes: Buffer): Promise<void> {
	await mkdir(path.dirname(output), { recursive: true });
	await writeFile(output, bytes, { flag: 'wx' });
}

export async function renderSkillIconReview(
	options: SkillIconReviewOptions,
	root = repositoryRoot
): Promise<{
	readonly reviewOutputPath: string | undefined;
	readonly familyOutputPath: string | undefined;
}> {
	if (!options.reviewOutputPath && !options.familyOutputPath) {
		throw new Error('Request a review composite, a family sheet, or both');
	}
	const assets = await loadPromotedCanonicalSkillAssets(root);
	const catalog = JSON.parse(
		(await regularBytes(root, CANONICAL_SKILL_CATALOG_PATH)).toString('utf8')
	) as { records: CatalogRecord[] };
	const target = catalog.records.find((record) => record.targetId === options.targetId);
	if (!target) throw new Error(`Unknown skill target: ${options.targetId}`);
	const frames = new Map(assets.frames.map((frame) => [frame.rarity, frame.path]));
	const backing = await regularBytes(root, assets.backing.path);
	const candidate = options.candidatePath
		? await regularBytes(root, temporaryInput(options.candidatePath))
		: undefined;
	if (candidate) await assertFramelessCandidate(candidate);

	if (options.reviewOutputPath) {
		if (!candidate) throw new Error('A candidate is required for a review composite');
		const frame = await regularBytes(root, frames.get(target.rarity)!);
		await writeTemporary(
			temporaryOutput(root, options.reviewOutputPath),
			await composeSkillIconLayers(backing, candidate, frame)
		);
	}

	if (options.familyOutputPath) {
		const lineageKey = target.motifFamily;
		const acceptedById = new Map(assets.records.map((record) => [record.targetId, record]));
		const members = lineageKey
			? catalog.records.filter(
					(record) =>
						record.targetId !== target.targetId &&
						record.motifFamily === lineageKey &&
						acceptedById.has(record.targetId)
				)
			: [];
		const icons = await Promise.all(
			members.map(async (member) => {
				const interior = acceptedById.get(member.targetId)!;
				return composeSkillIconLayers(
					backing,
					await regularBytes(root, interior.interiorPath),
					await regularBytes(root, frames.get(member.rarity)!)
				);
			})
		);
		if (candidate) {
			icons.push(
				await composeSkillIconLayers(
					backing,
					candidate,
					await regularBytes(root, frames.get(target.rarity)!)
				)
			);
		}
		if (icons.length === 0) throw new Error('No accepted lineage members; omit the family sheet');
		const cell = 256;
		const columns = Math.min(5, icons.length);
		const rows = Math.ceil(icons.length / columns);
		const thumbnails = await Promise.all(
			icons.map((icon) => sharp(icon).resize(cell, cell).png().toBuffer())
		);
		const sheet = await sharp({
			create: { width: columns * cell, height: rows * cell, channels: 4, background: '#00000000' }
		})
			.composite(
				thumbnails.map((input, index) => ({
					input,
					left: (index % columns) * cell,
					top: Math.floor(index / columns) * cell
				}))
			)
			.png()
			.toBuffer();
		await writeTemporary(temporaryOutput(root, options.familyOutputPath), sheet);
	}

	return {
		reviewOutputPath: options.reviewOutputPath,
		familyOutputPath: options.familyOutputPath
	};
}

function argument(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index === -1 ? undefined : process.argv[index + 1];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const targetId = argument('--target-id');
	if (!targetId) throw new Error('Missing --target-id');
	const result = await renderSkillIconReview({
		targetId,
		candidatePath: argument('--candidate'),
		reviewOutputPath: argument('--review-output'),
		familyOutputPath: argument('--family-output')
	});
	console.log(JSON.stringify(result));
}
