import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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
	}
}

for (const filePath of markdownFiles(wikiRoot)) {
	const pagePath = relative(repositoryRoot, filePath);
	if (!paths.has(pagePath)) fail(`unregistered wiki page ${pagePath}`);
}

console.log(
	`Validated ${catalog.entries.length} wiki pages and ${assetReferenceCount} asset references covering ${assetFiles.size} files (${catalog.schemaVersion}).`
);
