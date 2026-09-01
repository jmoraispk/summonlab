import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const repositoryRootArgument = process.argv.indexOf('--repository-root');
const repositoryRoot =
	repositoryRootArgument === -1
		? resolve(dirname(fileURLToPath(import.meta.url)), '..')
		: resolve(process.argv[repositoryRootArgument + 1] ?? '');
const wikiRoot = join(repositoryRoot, 'docs/wiki');
const catalogPath = join(wikiRoot, 'catalog.json');

const allowed = {
	designStatus: new Set(['seed', 'draft', 'accepted', 'superseded']),
	implementationStatus: new Set(['none', 'partial', 'implemented', 'verified']),
	visualStatus: new Set(['none', 'brief', 'candidate', 'approved', 'runtime']),
	spoilerScope: new Set(['public', 'discoverable', 'internal']),
	assetStatus: new Set(['brief', 'candidate', 'approved', 'runtime'])
};

function fail(message) {
	throw new Error(`Wiki validation failed: ${message}`);
}

function markdownFiles(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			return entry.name === 'templates' ? [] : markdownFiles(path);
		}
		return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
	});
}

function validateLocalLinks(filePath, source) {
	for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/gu)) {
		const rawTarget = match[1].trim().split(/\s+['"]/u)[0];
		const target = rawTarget.split('#')[0];
		if (!target || /^(?:https?:|mailto:)/u.test(target)) continue;
		const resolved = resolve(dirname(filePath), decodeURIComponent(target));
		if (!existsSync(resolved)) {
			fail(`${relative(repositoryRoot, filePath)} links to missing ${target}`);
		}
	}
}

function nonEmptyString(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

function sha256(filePath) {
	return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

async function validateBoundImage(assetKey, role, metadata) {
	if (!metadata || typeof metadata !== 'object') fail(`${assetKey} requires ${role} metadata`);
	if (!nonEmptyString(metadata.file)) fail(`${assetKey} ${role} requires file`);
	const filePath = join(repositoryRoot, metadata.file);
	if (!existsSync(filePath) || !statSync(filePath).isFile())
		fail(`${assetKey} ${role} points to missing ${metadata.file}`);
	const stats = statSync(filePath);
	if (metadata.bytes !== stats.size)
		fail(
			`${assetKey} ${role} byte count mismatch: expected ${metadata.bytes}, found ${stats.size}`
		);
	const digest = sha256(filePath);
	if (metadata.sha256 !== digest)
		fail(`${assetKey} ${role} SHA-256 mismatch: expected ${metadata.sha256}, found ${digest}`);
	const imageMetadata = await sharp(filePath).metadata();
	if (metadata.width !== imageMetadata.width || metadata.height !== imageMetadata.height)
		fail(
			`${assetKey} ${role} dimensions mismatch: expected ${metadata.width}x${metadata.height}, found ${imageMetadata.width}x${imageMetadata.height}`
		);
}

const provenanceCatalogs = new Map();

async function validateGeneratedAsset(wikiId, asset) {
	if (!nonEmptyString(asset.provenanceFile))
		fail(`${wikiId}/${asset.assetKey} requires provenanceFile`);
	const provenancePath = join(repositoryRoot, asset.provenanceFile);
	if (!existsSync(provenancePath) || !statSync(provenancePath).isFile())
		fail(`${wikiId}/${asset.assetKey} points to missing provenance ${asset.provenanceFile}`);
	let provenance = provenanceCatalogs.get(provenancePath);
	if (!provenance) {
		provenance = JSON.parse(readFileSync(provenancePath, 'utf8'));
		if (provenance.schemaVersion !== 'summonlab-wiki-generated-art-v1')
			fail(`${asset.provenanceFile} has unsupported schema ${String(provenance.schemaVersion)}`);
		if (provenance.status !== 'approval-candidate')
			fail(`${asset.provenanceFile} must remain approval-candidate before human review`);
		if (!Array.isArray(provenance.assets) || provenance.assets.length === 0)
			fail(`${asset.provenanceFile} requires generated asset records`);
		provenanceCatalogs.set(provenancePath, provenance);
	}
	const matches = provenance.assets.filter((record) => record.assetKey === asset.assetKey);
	if (matches.length !== 1)
		fail(
			`${wikiId}/${asset.assetKey} requires exactly one provenance record, found ${matches.length}`
		);
	const record = matches[0];
	if (record.status !== 'approval-candidate')
		fail(`${asset.assetKey} provenance status must be approval-candidate`);
	if (record.generationMode !== asset.generationMode)
		fail(`${asset.assetKey} generationMode does not match its provenance record`);
	if (!nonEmptyString(record.createdAt) || Number.isNaN(Date.parse(record.createdAt)))
		fail(`${asset.assetKey} requires a valid createdAt timestamp`);
	if (!nonEmptyString(record.prompt)) fail(`${asset.assetKey} requires the exact final prompt`);
	if (!Array.isArray(record.referenceInputs) || record.referenceInputs.length === 0)
		fail(`${asset.assetKey} requires referenceInputs`);
	for (const reference of record.referenceInputs) {
		if (!nonEmptyString(reference.assetKey) || !nonEmptyString(reference.prompt))
			fail(`${asset.assetKey} reference input requires assetKey and exact prompt`);
		await validateBoundImage(asset.assetKey, `reference ${reference.assetKey}`, reference);
	}
	await validateBoundImage(asset.assetKey, 'source original', record.sourceOriginal);
	if (record.derived?.file !== asset.file)
		fail(`${asset.assetKey} derived file does not match wiki catalog file ${asset.file}`);
	if (!nonEmptyString(record.derived?.recipe))
		fail(`${asset.assetKey} derived asset requires recipe`);
	await validateBoundImage(asset.assetKey, 'derived', record.derived);
	if (!Array.isArray(record.recognitionChecks) || record.recognitionChecks.length < 3)
		fail(`${asset.assetKey} requires explicit recognition checks`);
	for (const check of record.recognitionChecks) {
		if (!nonEmptyString(check.name) || check.passed !== true || !nonEmptyString(check.note))
			fail(`${asset.assetKey} has an incomplete recognition check`);
	}
	if (!nonEmptyString(record.productionNote)) fail(`${asset.assetKey} requires productionNote`);
}

if (!existsSync(catalogPath)) fail('docs/wiki/catalog.json is missing');

const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
if (catalog.schemaVersion !== 'summonlab-wiki-catalog-v1') {
	fail(`unsupported catalog schema ${String(catalog.schemaVersion)}`);
}
if (!Array.isArray(catalog.entries) || catalog.entries.length === 0) {
	fail('catalog entries must be a non-empty array');
}

const ids = new Set();
const paths = new Set();
let assetReferenceCount = 0;
const assetFiles = new Set();

for (const entry of catalog.entries) {
	if (typeof entry.wikiId !== 'string' || !/^[a-z][a-z0-9.-]+$/u.test(entry.wikiId)) {
		fail(`invalid wiki id ${String(entry.wikiId)}`);
	}
	if (ids.has(entry.wikiId)) fail(`duplicate wiki id ${entry.wikiId}`);
	ids.add(entry.wikiId);

	if (typeof entry.path !== 'string' || !entry.path.startsWith('docs/wiki/')) {
		fail(`${entry.wikiId} has invalid path ${String(entry.path)}`);
	}
	if (paths.has(entry.path)) fail(`duplicate wiki path ${entry.path}`);
	paths.add(entry.path);

	for (const statusKey of [
		'designStatus',
		'implementationStatus',
		'visualStatus',
		'spoilerScope'
	]) {
		if (!allowed[statusKey].has(entry[statusKey])) {
			fail(`${entry.wikiId} has invalid ${statusKey} ${String(entry[statusKey])}`);
		}
	}

	const filePath = join(repositoryRoot, entry.path);
	if (!existsSync(filePath) || !statSync(filePath).isFile()) {
		fail(`${entry.wikiId} points to missing page ${entry.path}`);
	}
	const source = readFileSync(filePath, 'utf8');
	if (!source.includes(`Wiki ID: \`${entry.wikiId}\``)) {
		fail(`${entry.path} does not declare Wiki ID ${entry.wikiId}`);
	}
	validateLocalLinks(filePath, source);

	for (const asset of entry.assets ?? []) {
		assetReferenceCount += 1;
		if (typeof asset.assetKey !== 'string' || asset.assetKey.length === 0) {
			fail(`${entry.wikiId} has an asset without assetKey`);
		}
		if (!allowed.assetStatus.has(asset.status)) {
			fail(`${entry.wikiId}/${asset.assetKey} has invalid asset status ${String(asset.status)}`);
		}
		const assetPath = join(repositoryRoot, asset.file);
		if (!existsSync(assetPath) || !statSync(assetPath).isFile()) {
			fail(`${entry.wikiId}/${asset.assetKey} points to missing ${asset.file}`);
		}
		assetFiles.add(asset.file);
		if (asset.generationMode === 'built-in-imagegen')
			await validateGeneratedAsset(entry.wikiId, asset);
	}
}

for (const filePath of markdownFiles(wikiRoot)) {
	const pagePath = relative(repositoryRoot, filePath);
	if (!paths.has(pagePath)) fail(`unregistered wiki page ${pagePath}`);
}

console.log(
	`Validated ${catalog.entries.length} wiki pages and ${assetReferenceCount} asset references covering ${assetFiles.size} files (${catalog.schemaVersion}).`
);
