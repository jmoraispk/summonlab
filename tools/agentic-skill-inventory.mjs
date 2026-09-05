import { readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const INVENTORY_START = '<!-- BEGIN GENERATED AGENTIC SKILL INVENTORY -->';
export const INVENTORY_END = '<!-- END GENERATED AGENTIC SKILL INVENTORY -->';

const entryRealPaths = new WeakMap();

function normalizePath(path) {
	return path.split(sep).join('/');
}

function isInsideRepository(repositoryRealPath, candidateRealPath) {
	const repositoryRelativePath = relative(repositoryRealPath, candidateRealPath);
	return (
		repositoryRelativePath !== '..' &&
		!repositoryRelativePath.startsWith(`..${sep}`) &&
		!isAbsolute(repositoryRelativePath)
	);
}

async function skillFilesUnder(repositoryRoot, relativeDirectory) {
	const directory = join(repositoryRoot, relativeDirectory);
	let children;
	try {
		children = await readdir(directory, { withFileTypes: true });
	} catch (error) {
		if (error.code === 'ENOENT') return [];
		throw error;
	}

	const candidates = [];
	for (const child of children.sort((left, right) => left.name.localeCompare(right.name))) {
		if (!child.isDirectory() && !child.isSymbolicLink()) continue;
		const candidate = join(directory, child.name, 'SKILL.md');
		try {
			if ((await stat(candidate)).isFile()) candidates.push(candidate);
		} catch (error) {
			if (error.code !== 'ENOENT') throw error;
		}
	}
	return candidates;
}

function parseYamlScalar(rawValue) {
	const value = rawValue.trim();
	if (value.startsWith('"') && value.endsWith('"')) return JSON.parse(value);
	if (value.startsWith("'") && value.endsWith("'")) {
		return value.slice(1, -1).replaceAll("''", "'");
	}
	return value;
}

function parseFrontmatter(contents, path) {
	const match = contents.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	if (!match) throw new Error(`Missing YAML frontmatter in ${path}`);
	const values = new Map();
	for (const line of match[1].split(/\r?\n/)) {
		const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
		if (!field) continue;
		if (
			field[1] === 'description' &&
			/^[>|](?:[1-9](?:[+-])?|[+-](?:[1-9])?)?(?:\s+#.*)?$/u.test(field[2].trim())
		) {
			throw new Error(`Unsupported YAML block scalar description in ${path}`);
		}
		values.set(field[1], parseYamlScalar(field[2]));
	}
	const name = values.get('name');
	const description = values.get('description');
	if (!name || !description)
		throw new Error(`Skill frontmatter requires name and description in ${path}`);
	return { name, description };
}

async function indexCandidates(repositoryRoot, candidates) {
	const resolvedRepositoryRoot = resolve(repositoryRoot);
	const repositoryRealPath = await realpath(resolvedRepositoryRoot);
	const candidatesByRealPath = new Map();
	for (const skillPath of candidates) {
		const realSkillPath = await realpath(skillPath);
		if (!isInsideRepository(repositoryRealPath, realSkillPath)) {
			throw new Error(`Skill path resolves outside repository: ${skillPath}`);
		}
		const repositoryRelativePath = normalizePath(relative(resolvedRepositoryRoot, skillPath));
		const frontmatter = parseFrontmatter(await readFile(skillPath, 'utf8'), repositoryRelativePath);
		candidatesByRealPath.set(realSkillPath, {
			...frontmatter,
			realSkillPath,
			path: repositoryRelativePath
		});
	}
	return candidatesByRealPath;
}

function ownershipFor(name) {
	if (name.startsWith('summonlab-')) return 'summonlab';
	if (name === 'pixijs' || name.startsWith('pixijs-')) return 'external-pixijs';
	throw new Error(`Unsupported skill in repository inventory: ${name}`);
}

function entryFrom(canonical, discovery) {
	const entry = {
		name: canonical.name,
		description: canonical.description,
		ownership: ownershipFor(canonical.name),
		canonicalPath: canonical.path,
		discoveryPath: discovery.path
	};
	entryRealPaths.set(entry, canonical.realSkillPath);
	return entry;
}

function addUniqueName(entriesByName, entry) {
	const existing = entriesByName.get(entry.name);
	if (!existing) {
		entriesByName.set(entry.name, entry);
		return;
	}
	if (entryRealPaths.get(existing) !== entryRealPaths.get(entry)) {
		throw new Error(`Duplicate skill name resolves to different content: ${entry.name}`);
	}
}

function compareOwnershipThenName(left, right) {
	const ownershipOrder = { summonlab: 0, 'external-pixijs': 1 };
	return (
		ownershipOrder[left.ownership] - ownershipOrder[right.ownership] ||
		left.name.localeCompare(right.name)
	);
}

export async function discoverAgenticSkills(repositoryRoot) {
	const canonicalCandidates = await skillFilesUnder(repositoryRoot, 'skills');
	const discoveryCandidates = await skillFilesUnder(repositoryRoot, '.agents/skills');
	const canonicalByRealPath = await indexCandidates(repositoryRoot, canonicalCandidates);
	const discoveryByRealPath = await indexCandidates(repositoryRoot, discoveryCandidates);
	const entriesByName = new Map();
	for (const discovery of discoveryByRealPath.values()) ownershipFor(discovery.name);
	for (const [realSkillPath, canonical] of canonicalByRealPath) {
		if (!canonical.name.startsWith('summonlab-')) continue;
		const discovery = discoveryByRealPath.get(realSkillPath);
		if (!discovery) throw new Error(`Missing repository discovery alias for ${canonical.name}`);
		addUniqueName(entriesByName, entryFrom(canonical, discovery));
	}
	for (const discovery of discoveryByRealPath.values()) {
		if (canonicalByRealPath.has(discovery.realSkillPath)) continue;
		addUniqueName(entriesByName, entryFrom(discovery, discovery));
	}
	return [...entriesByName.values()].sort(compareOwnershipThenName);
}

function renderTableCell(value) {
	return value.replace(/\s*(?:\r\n|\r|\n)\s*/gu, ' ').replaceAll('|', '\\|');
}

function discoveryLinkTarget({ canonicalPath, discoveryPath }) {
	const repositoryPath =
		canonicalPath === discoveryPath ? discoveryPath : discoveryPath.replace(/\/SKILL\.md$/u, '');
	return `../../../${repositoryPath}`;
}

export function renderAgenticSkillInventory(entries) {
	const summonlab = entries.filter(({ ownership }) => ownership === 'summonlab');
	const pixijs = entries.filter(({ ownership }) => ownership === 'external-pixijs');
	const renderTable = (rows) =>
		[
			'| Skill | Description | Discovery |',
			'| --- | --- | --- |',
			...rows.map(
				(entry) =>
					`| [\`${renderTableCell(entry.name)}\`](../../../${entry.canonicalPath}) | ${renderTableCell(entry.description)} | [\`${renderTableCell(entry.discoveryPath)}\`](${discoveryLinkTarget(entry)}) |`
			)
		].join('\n');
	return [
		INVENTORY_START,
		`_Inventory: ${entries.length} skills (${summonlab.length} Summonlab, ${pixijs.length} pinned PixiJS)._`,
		'## Summonlab-authored skills',
		renderTable(summonlab),
		'## Pinned external PixiJS skills',
		renderTable(pixijs),
		INVENTORY_END
	].join('\n\n');
}

function markerCount(contents, marker) {
	return contents.split(marker).length - 1;
}

function replaceInventoryRegion(contents, inventory) {
	if (markerCount(contents, INVENTORY_START) !== 1 || markerCount(contents, INVENTORY_END) !== 1) {
		throw new Error('Agentic-skills wiki must contain exactly one generated inventory region');
	}
	const start = contents.indexOf(INVENTORY_START);
	const end = contents.indexOf(INVENTORY_END, start);
	if (end < start) {
		throw new Error('Agentic-skills wiki generated inventory markers are out of order');
	}
	return contents.slice(0, start) + inventory + contents.slice(end + INVENTORY_END.length);
}

function parseArguments(arguments_) {
	let mode;
	let repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
	for (let index = 0; index < arguments_.length; index += 1) {
		const argument = arguments_[index];
		if (argument === '--write' || argument === '--check') {
			if (mode) throw new Error('Choose exactly one of --write or --check');
			mode = argument;
		} else if (argument === '--repository-root') {
			const value = arguments_[index + 1];
			if (!value) throw new Error('--repository-root requires a path');
			repositoryRoot = resolve(value);
			index += 1;
		} else {
			throw new Error(`Unsupported argument: ${argument}`);
		}
	}
	if (!mode) throw new Error('Choose exactly one of --write or --check');
	return { mode, repositoryRoot };
}

async function runCli(arguments_) {
	const { mode, repositoryRoot } = parseArguments(arguments_);
	const wikiPath = join(repositoryRoot, 'docs/wiki/systems/agentic-skills.md');
	const current = await readFile(wikiPath, 'utf8');
	const entries = await discoverAgenticSkills(repositoryRoot);
	const next = replaceInventoryRegion(current, renderAgenticSkillInventory(entries));
	if (mode === '--check') {
		if (next !== current) throw new Error('agentic-skills wiki inventory is stale');
		return;
	}
	await writeFile(wikiPath, next);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
	runCli(process.argv.slice(2)).catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
}
