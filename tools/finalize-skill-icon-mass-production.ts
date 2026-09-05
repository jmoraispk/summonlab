import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp, { type OverlayOptions } from 'sharp';

import {
	MASS_PRODUCTION_MANIFEST_PATH,
	type MassProductionManifest,
	sha256
} from './skill-icon-mass-production-lib.js';

type Mode = 'write' | 'check';

interface ResultRecord {
	readonly schemaVersion: 'skill-icon-mass-result-v1';
	readonly kind: 'family' | 'skill';
	readonly identity: string;
	readonly status: 'candidate';
	readonly promptPath: string;
	readonly promptHash: string;
	readonly references: readonly { readonly path: string; readonly contentHash: string }[];
	readonly output: {
		readonly path: string;
		readonly contentHash: string;
		readonly width: number;
		readonly height: number;
		readonly alphaMode: 'rgb' | 'rgba';
	};
	readonly providerSource: {
		readonly path: string | null;
		readonly contentHash: string;
		readonly width: number;
		readonly height: number;
	};
	readonly attemptCount: number;
	readonly normalizationHistory?: {
		readonly operation: 'restore-interior-and-mask-exterior';
		readonly preRepairContentHash: string;
		readonly postRepairContentHash: string;
		readonly removedPixels: number;
	};
}

const FAMILY_CONTACT_ROOT =
	'assets/wiki/skills/icon-production-v1/mass-production-v1/contact-sheets/families';
const CATALOG_CONTACT_ROOT =
	'assets/wiki/skills/icon-production-v1/mass-production-v1/contact-sheets/catalog';

function parseMode(args: readonly string[]): Mode {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	if (normalized.length !== 1 || !['--write', '--check'].includes(normalized[0] ?? '')) {
		throw new Error('Usage: tsx tools/finalize-skill-icon-mass-production.ts --write|--check');
	}
	return normalized[0] === '--write' ? 'write' : 'check';
}

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

async function regularBytes(root: string, relativePath: string): Promise<Buffer> {
	const absolute = path.resolve(root, relativePath);
	const metadata = await lstat(absolute);
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Expected regular file: ${relativePath}`);
	}
	return readFile(absolute);
}

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

async function syncBytes(
	root: string,
	relativePath: string,
	bytes: Buffer,
	mode: Mode
): Promise<void> {
	const absolute = path.resolve(root, relativePath);
	const current = await readFile(absolute).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (current?.equals(bytes)) return;
	if (mode === 'check') throw new Error(`Stale or missing derived artifact: ${relativePath}`);
	await writeAtomic(absolute, bytes);
}

function textLayer(
	width: number,
	height: number,
	lines: readonly {
		text: string;
		x: number;
		y: number;
		size: number;
		anchor?: 'start' | 'middle';
	}[]
): Buffer {
	const content = lines
		.map(
			(line) =>
				`<text x="${line.x}" y="${line.y}" text-anchor="${line.anchor ?? 'middle'}" font-family="serif" font-size="${line.size}" fill="#f3ead8">${escapeXml(line.text)}</text>`
		)
		.join('');
	return Buffer.from(
		`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`
	);
}

async function familyContactSheet(
	root: string,
	manifest: MassProductionManifest,
	family: MassProductionManifest['families'][number]
): Promise<Buffer> {
	const columns = 4;
	const cellWidth = 400;
	const cellHeight = 390;
	const header = 96;
	const rows = Math.ceil(family.memberTargetIds.length / columns);
	const width = columns * cellWidth;
	const height = header + rows * cellHeight;
	const composites: OverlayOptions[] = [];
	const labels: { text: string; x: number; y: number; size: number }[] = [
		{
			text: `${family.domain} / ${family.family} / ${family.familyId}`,
			x: width / 2,
			y: 58,
			size: 34
		}
	];
	for (const [index, targetId] of family.memberTargetIds.entries()) {
		const skill = manifest.skills.find((candidate) => candidate.targetId === targetId);
		if (!skill) throw new Error(`Missing family member ${targetId}`);
		const icon = await sharp(await regularBytes(root, skill.finalImagePath))
			.resize(300, 300, { fit: 'contain' })
			.png()
			.toBuffer();
		const column = index % columns;
		const row = Math.floor(index / columns);
		composites.push({ input: icon, left: column * cellWidth + 50, top: header + row * cellHeight });
		labels.push({
			text: `${skill.name} · ${skill.rarity}`,
			x: column * cellWidth + cellWidth / 2,
			y: header + row * cellHeight + 340,
			size: 23
		});
	}
	composites.push({ input: textLayer(width, height, labels), left: 0, top: 0 });
	return sharp({
		create: { width, height, channels: 4, background: { r: 6, g: 7, b: 9, alpha: 1 } }
	})
		.composite(composites)
		.png({ compressionLevel: 9 })
		.toBuffer();
}

async function catalogContactSheet(
	root: string,
	page: number,
	skills: readonly MassProductionManifest['skills'][number][]
): Promise<Buffer> {
	const columns = 6;
	const cellWidth = 340;
	const cellHeight = 370;
	const header = 100;
	const rows = 4;
	const width = columns * cellWidth;
	const height = header + rows * cellHeight;
	const composites: OverlayOptions[] = [];
	const labels: { text: string; x: number; y: number; size: number }[] = [
		{ text: `Summonlab Skill Catalog · Page ${page}`, x: width / 2, y: 62, size: 36 }
	];
	for (const [index, skill] of skills.entries()) {
		const icon = await sharp(await regularBytes(root, skill.finalImagePath))
			.resize(270, 270, { fit: 'contain' })
			.png()
			.toBuffer();
		const column = index % columns;
		const row = Math.floor(index / columns);
		const center = column * cellWidth + cellWidth / 2;
		composites.push({ input: icon, left: column * cellWidth + 35, top: header + row * cellHeight });
		labels.push(
			{
				text: `${skill.name} · ${skill.rarity}`,
				x: center,
				y: header + row * cellHeight + 302,
				size: 20
			},
			{
				text: `${skill.domain} / ${skill.family}`,
				x: center,
				y: header + row * cellHeight + 332,
				size: 15
			}
		);
	}
	composites.push({ input: textLayer(width, height, labels), left: 0, top: 0 });
	return sharp({
		create: { width, height, channels: 4, background: { r: 6, g: 7, b: 9, alpha: 1 } }
	})
		.composite(composites)
		.png({ compressionLevel: 9 })
		.toBuffer();
}

async function readResult(
	root: string,
	relativePath: string
): Promise<{ record: ResultRecord; hash: string }> {
	const bytes = await regularBytes(root, relativePath);
	const record = JSON.parse(bytes.toString('utf8')) as ResultRecord;
	if (record.schemaVersion !== 'skill-icon-mass-result-v1' || record.status !== 'candidate') {
		throw new Error(`Invalid candidate result: ${relativePath}`);
	}
	return { record, hash: sha256(bytes) };
}

async function assertInventory(
	root: string,
	relativeDirectory: string,
	expectedNames: ReadonlySet<string>
): Promise<void> {
	const actual = new Set(
		(await readdir(path.resolve(root, relativeDirectory))).filter(
			(name) => !name.startsWith('.') && !name.includes('.stage-')
		)
	);
	if (actual.size !== expectedNames.size || [...actual].some((name) => !expectedNames.has(name))) {
		throw new Error(`Unexpected file inventory: ${relativeDirectory}`);
	}
}

async function assertReferenceBindings(
	root: string,
	result: ResultRecord,
	expectedPaths: readonly string[],
	historicalHashesByPath: ReadonlyMap<string, ReadonlySet<string>> = new Map()
): Promise<void> {
	if (
		result.references.length !== expectedPaths.length ||
		result.references.some((reference, index) => reference.path !== expectedPaths[index])
	) {
		throw new Error(`Reference order or identity drift: ${result.identity}`);
	}
	for (const reference of result.references) {
		const currentHash = sha256(await regularBytes(root, reference.path));
		if (
			currentHash !== reference.contentHash &&
			!historicalHashesByPath.get(reference.path)?.has(reference.contentHash)
		) {
			throw new Error(`Reference hash drift for ${result.identity}: ${reference.path}`);
		}
	}
}

async function assertPromptBinding(
	root: string,
	result: ResultRecord,
	expectedPromptPath: string
): Promise<void> {
	if (result.promptPath !== expectedPromptPath) {
		throw new Error(`Prompt path drift: ${result.identity}`);
	}
	const packet = JSON.parse((await regularBytes(root, expectedPromptPath)).toString('utf8')) as {
		readonly identity: string;
		readonly exactPrompt: string;
	};
	if (packet.identity !== result.identity || sha256(packet.exactPrompt) !== result.promptHash) {
		throw new Error(`Prompt hash or identity drift: ${result.identity}`);
	}
}

async function assertTransparentExterior(iconBytes: Buffer, identity: string): Promise<void> {
	const decoded = await sharp(iconBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const { width, height } = decoded.info;
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;
	let opaque = 0;
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const alpha = decoded.data[(y * width + x) * 4 + 3] ?? 0;
			if (alpha <= 8) continue;
			opaque += 1;
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
	}
	const edgeIndexes: number[] = [];
	for (let x = 0; x < width; x += 1) {
		edgeIndexes.push(x, (height - 1) * width + x);
	}
	for (let y = 1; y < height - 1; y += 1) {
		edgeIndexes.push(y * width, y * width + width - 1);
	}
	if (edgeIndexes.some((index) => (decoded.data[index * 4 + 3] ?? 0) > 8)) {
		throw new Error(`Skill exterior reaches the canvas edge: ${identity}`);
	}
	const boundsWidth = maxX - minX + 1;
	const boundsHeight = maxY - minY + 1;
	const ratio = boundsHeight / boundsWidth;
	if (
		opaque < width * height * 0.12 ||
		boundsWidth < 600 ||
		boundsHeight < 600 ||
		ratio < 0.8 ||
		ratio > 1.45
	) {
		throw new Error(`Skill alpha geometry is implausible: ${identity}`);
	}
}

export async function finalizeSkillIconMassProduction(options: {
	readonly root?: string;
	readonly mode: Mode;
}): Promise<{ readonly families: number; readonly skills: number; readonly catalogPages: number }> {
	const root = path.resolve(options.root ?? process.cwd());
	const manifestBytes = await regularBytes(root, MASS_PRODUCTION_MANIFEST_PATH);
	const manifest = JSON.parse(manifestBytes.toString('utf8')) as MassProductionManifest;
	if (
		manifest.expected.families !== manifest.families.length ||
		manifest.expected.skills !== manifest.skills.length
	) {
		throw new Error('Manifest expected counts do not match its records');
	}

	const familyRecords = [];
	for (const family of manifest.families) {
		const sheetBytes = await regularBytes(root, family.referenceSheetPath);
		const result = await readResult(root, family.resultPath);
		if (
			result.record.kind !== 'family' ||
			result.record.identity !== family.familyId ||
			result.record.output.path !== family.referenceSheetPath ||
			result.record.output.contentHash !== sha256(sheetBytes) ||
			result.record.providerSource.contentHash !== sha256(sheetBytes) ||
			result.record.providerSource.path !== null ||
			result.record.attemptCount !== 1
		) {
			throw new Error(`Family result drift: ${family.familyId}`);
		}
		await assertPromptBinding(root, result.record, family.promptPath);
		await assertReferenceBindings(root, result.record, [
			manifest.authorities.frameSheet.path,
			manifest.authorities.paintedEmblem.path
		]);
		familyRecords.push({
			...family,
			status: 'candidate' as const,
			referenceSheetHash: sha256(sheetBytes),
			resultHash: result.hash
		});
	}

	const skillRecords = [];
	for (const skill of manifest.skills) {
		const iconBytes = await regularBytes(root, skill.finalImagePath);
		const result = await readResult(root, skill.resultPath);
		if (
			result.record.kind !== 'skill' ||
			result.record.identity !== skill.targetId ||
			result.record.output.path !== skill.finalImagePath ||
			result.record.output.contentHash !== sha256(iconBytes) ||
			result.record.attemptCount !== 1
		) {
			throw new Error(`Skill result drift: ${skill.targetId}`);
		}
		await assertPromptBinding(root, result.record, skill.promptPath);
		const family = manifest.families.find((record) => record.familyId === skill.motifFamily);
		if (!family) throw new Error(`Missing motif family: ${skill.motifFamily}`);
		const expectedReferences = [
			manifest.authorities.frameSheet.path,
			manifest.authorities.paintedEmblem.path,
			family.referenceSheetPath
		];
		const historicalHashesByPath = new Map<string, ReadonlySet<string>>();
		if (skill.primaryVisualParent) {
			const parent = manifest.skills.find(
				(record) => record.targetId === skill.primaryVisualParent
			);
			if (!parent) throw new Error(`Missing visual parent: ${skill.primaryVisualParent}`);
			expectedReferences.push(parent.finalImagePath);
			const parentResult = (await readResult(root, parent.resultPath)).record;
			if (parentResult.normalizationHistory) {
				historicalHashesByPath.set(
					parent.finalImagePath,
					new Set([parentResult.normalizationHistory.preRepairContentHash])
				);
			}
		}
		await assertReferenceBindings(root, result.record, expectedReferences, historicalHashesByPath);
		const metadata = await sharp(iconBytes).metadata();
		if (
			metadata.width !== 1024 ||
			metadata.height !== 1024 ||
			!metadata.hasAlpha ||
			result.record.output.width !== 1024 ||
			result.record.output.height !== 1024 ||
			result.record.output.alphaMode !== 'rgba'
		) {
			throw new Error(`Skill output is not 1024x1024 RGBA: ${skill.targetId}`);
		}
		await assertTransparentExterior(iconBytes, skill.targetId);
		if (!result.record.providerSource.path)
			throw new Error(`Missing provider source: ${skill.targetId}`);
		const providerBytes = await regularBytes(root, result.record.providerSource.path);
		if (sha256(providerBytes) !== result.record.providerSource.contentHash) {
			throw new Error(`Provider-source drift: ${skill.targetId}`);
		}
		skillRecords.push({
			...skill,
			status: 'candidate' as const,
			finalImageHash: sha256(iconBytes),
			providerSourceHash: sha256(providerBytes),
			resultHash: result.hash
		});
	}

	await Promise.all([
		assertInventory(
			root,
			'assets/wiki/skills/icon-production-v1/mass-production-v1/prompts/families',
			new Set(manifest.families.map((record) => `${record.slug}.json`))
		),
		assertInventory(
			root,
			'assets/wiki/skills/icon-production-v1/mass-production-v1/prompts/skills',
			new Set(manifest.skills.map((record) => `${record.slug}.json`))
		),
		assertInventory(
			root,
			'assets/wiki/skills/icon-production-v1/mass-production-v1/reference-sheet-maps',
			new Set(manifest.families.map((record) => `${record.slug}.json`))
		),
		assertInventory(
			root,
			'assets/wiki/skills/icon-production-v1/mass-production-v1/reference-sheets',
			new Set(manifest.families.map((record) => `${record.slug}.png`))
		),
		assertInventory(
			root,
			'assets/wiki/skills/icon-production-v1/mass-production-v1/icons',
			new Set(manifest.skills.map((record) => `${record.slug}.png`))
		),
		assertInventory(
			root,
			'assets/wiki/skills/icon-production-v1/mass-production-v1/provider-sources',
			new Set(manifest.skills.map((record) => `${record.slug}-v1.png`))
		),
		assertInventory(
			root,
			'assets/wiki/skills/icon-production-v1/mass-production-v1/results/families',
			new Set(manifest.families.map((record) => `${record.slug}.json`))
		),
		assertInventory(
			root,
			'assets/wiki/skills/icon-production-v1/mass-production-v1/results/skills',
			new Set(manifest.skills.map((record) => `${record.slug}.json`))
		)
	]);

	const familyContacts = [];
	for (const family of manifest.families) {
		const contactPath = `${FAMILY_CONTACT_ROOT}/${family.slug}.png`;
		const bytes = await familyContactSheet(root, manifest, family);
		await syncBytes(root, contactPath, bytes, options.mode);
		familyContacts.push({
			familyId: family.familyId,
			path: contactPath,
			contentHash: sha256(bytes)
		});
	}

	const catalogContacts = [];
	for (let offset = 0, page = 1; offset < manifest.skills.length; offset += 24, page += 1) {
		const contactPath = `${CATALOG_CONTACT_ROOT}/page-${String(page).padStart(2, '0')}.png`;
		const bytes = await catalogContactSheet(root, page, manifest.skills.slice(offset, offset + 24));
		await syncBytes(root, contactPath, bytes, options.mode);
		catalogContacts.push({ page, path: contactPath, contentHash: sha256(bytes) });
	}

	const completedAt = manifest.completedAt ?? new Date().toISOString();
	const finalized: MassProductionManifest = {
		...manifest,
		completionState: 'complete',
		completedAt,
		families: familyRecords,
		skills: skillRecords,
		evidence: {
			providerCalls: {
				retainedFamilyOutputs: familyRecords.length,
				retainedSkillOutputs: skillRecords.length,
				retainedSuccessfulTotal: familyRecords.length + skillRecords.length,
				correctiveOutputs: 0,
				accountingBoundary: 'retained-output-evidence'
			},
			orchestration: {
				workerInterruptions: 1,
				dependencyDeferralsRecovered: 6,
				unresolvedFailures: 0
			},
			contactSheets: { families: familyContacts, catalog: catalogContacts },
			validation: [
				{ command: 'pnpm check:skill-icon-mass-production', completedAt },
				{ command: 'pnpm typecheck:skill-icons', completedAt },
				{ command: 'pnpm test:skill-icons', completedAt }
			]
		}
	};
	const finalizedBytes = Buffer.from(`${JSON.stringify(finalized, null, '\t')}\n`);
	await syncBytes(root, MASS_PRODUCTION_MANIFEST_PATH, finalizedBytes, options.mode);

	const expectedFamilyFiles = new Set(manifest.families.map((family) => `${family.slug}.png`));
	const expectedCatalogFiles = new Set(catalogContacts.map((record) => path.basename(record.path)));
	for (const [directory, expected] of [
		[FAMILY_CONTACT_ROOT, expectedFamilyFiles],
		[CATALOG_CONTACT_ROOT, expectedCatalogFiles]
	] as const) {
		const actual = new Set(
			(await readdir(path.resolve(root, directory))).filter((name) => name.endsWith('.png'))
		);
		if (actual.size !== expected.size || [...actual].some((name) => !expected.has(name))) {
			throw new Error(`Unexpected contact-sheet inventory: ${directory}`);
		}
	}

	return {
		families: familyRecords.length,
		skills: skillRecords.length,
		catalogPages: catalogContacts.length
	};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	finalizeSkillIconMassProduction({ mode: parseMode(process.argv.slice(2)) })
		.then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}
