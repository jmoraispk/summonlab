import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
	INVENTORY_END,
	INVENTORY_START,
	discoverAgenticSkills,
	renderAgenticSkillInventory
} from './agentic-skill-inventory.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inventoryScript = join(repositoryRoot, 'tools/agentic-skill-inventory.mjs');
const expectedSummonlabNames = [
	'summonlab-character-action-creation',
	'summonlab-character-animations',
	'summonlab-enemy-creation',
	'summonlab-hero-creation',
	'summonlab-image-production',
	'summonlab-item-production',
	'summonlab-skill-creation',
	'summonlab-skill-icon-production'
];

function createTemporaryRoot(prefix = 'summonlab-agentic-skill-inventory-') {
	return mkdtempSync(join(tmpdir(), prefix));
}

function writeSkill(root, directory, { name, description, heading = 'Heading text' }) {
	const skillDirectory = join(root, directory);
	mkdirSync(skillDirectory, { recursive: true });
	writeFileSync(
		join(skillDirectory, 'SKILL.md'),
		`---\nname: ${name}\ndescription: ${description}\n---\n\n# ${heading}\n`
	);
}

function addRelativeAlias(root, name) {
	mkdirSync(join(root, '.agents/skills'), { recursive: true });
	symlinkSync(`../../skills/${name}`, join(root, '.agents/skills', name));
}

function createHappyFixture() {
	const root = createTemporaryRoot();
	writeSkill(root, 'skills/summonlab-alpha', {
		name: 'summonlab-alpha',
		description: 'Use when testing a first-party skill.'
	});
	addRelativeAlias(root, 'summonlab-alpha');
	writeSkill(root, '.agents/skills/pixijs', {
		name: 'pixijs',
		description: 'Use when routing PixiJS work.'
	});
	return root;
}

function runInventory(root, mode) {
	return spawnSync(process.execPath, [inventoryScript, mode, '--repository-root', root], {
		encoding: 'utf8'
	});
}

test('discovers aliased first-party and pinned external skills', async (context) => {
	const fixtureRoot = createHappyFixture();
	context.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));

	assert.deepEqual(await discoverAgenticSkills(fixtureRoot), [
		{
			name: 'summonlab-alpha',
			description: 'Use when testing a first-party skill.',
			ownership: 'summonlab',
			canonicalPath: 'skills/summonlab-alpha/SKILL.md',
			discoveryPath: '.agents/skills/summonlab-alpha/SKILL.md'
		},
		{
			name: 'pixijs',
			description: 'Use when routing PixiJS work.',
			ownership: 'external-pixijs',
			canonicalPath: '.agents/skills/pixijs/SKILL.md',
			discoveryPath: '.agents/skills/pixijs/SKILL.md'
		}
	]);
});

test('rejects a canonical first-party skill without its discovery alias', async (context) => {
	const fixtureRoot = createTemporaryRoot();
	context.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
	writeSkill(fixtureRoot, 'skills/summonlab-missing', {
		name: 'summonlab-missing',
		description: 'Use when testing a missing alias.'
	});

	await assert.rejects(() => discoverAgenticSkills(fixtureRoot), /missing.*alias/i);
});

test('rejects a discovery symlink that resolves outside the repository', async (context) => {
	const fixtureParent = createTemporaryRoot('summonlab-agentic-skill-escape-');
	const fixtureRoot = join(fixtureParent, 'repository');
	const escapedSkill = join(fixtureParent, 'escaped-pixijs');
	context.after(() => rmSync(fixtureParent, { recursive: true, force: true }));
	mkdirSync(join(fixtureRoot, '.agents/skills'), { recursive: true });
	writeSkill(fixtureParent, 'escaped-pixijs', {
		name: 'pixijs',
		description: 'Use when testing escaped paths.'
	});
	symlinkSync(escapedSkill, join(fixtureRoot, '.agents/skills/pixijs'));

	await assert.rejects(() => discoverAgenticSkills(fixtureRoot), /outside.*repository/i);
});

test('rejects duplicate names that resolve to different skill content', async (context) => {
	const fixtureRoot = createTemporaryRoot();
	context.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
	writeSkill(fixtureRoot, '.agents/skills/pixijs-first', {
		name: 'pixijs',
		description: 'Use when testing the first duplicate.'
	});
	writeSkill(fixtureRoot, '.agents/skills/pixijs-second', {
		name: 'pixijs',
		description: 'Use when testing the second duplicate.'
	});

	await assert.rejects(() => discoverAgenticSkills(fixtureRoot), /duplicate.*name/i);
});

test('rejects discovered skills outside the supported inventory boundary', async (context) => {
	const fixtureRoot = createTemporaryRoot();
	context.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
	writeSkill(fixtureRoot, '.agents/skills/general-purpose', {
		name: 'general-purpose',
		description: 'Use when testing unsupported inventory scope.'
	});

	await assert.rejects(() => discoverAgenticSkills(fixtureRoot), /unsupported.*skill/i);
});

test('deduplicates a canonical skill and its matching discovery alias', async (context) => {
	const fixtureRoot = createHappyFixture();
	context.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));

	const entries = await discoverAgenticSkills(fixtureRoot);
	assert.equal(entries.filter(({ name }) => name === 'summonlab-alpha').length, 1);
});

test('sorts by ownership and then by skill name', async (context) => {
	const fixtureRoot = createTemporaryRoot();
	context.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
	for (const name of ['summonlab-zeta', 'summonlab-alpha']) {
		writeSkill(fixtureRoot, `skills/${name}`, {
			name,
			description: `Use when testing ${name}.`
		});
		addRelativeAlias(fixtureRoot, name);
	}
	for (const name of ['pixijs-zeta', 'pixijs-alpha']) {
		writeSkill(fixtureRoot, `.agents/skills/${name}`, {
			name,
			description: `Use when testing ${name}.`
		});
	}

	const entries = await discoverAgenticSkills(fixtureRoot);
	assert.deepEqual(
		entries.map(({ name }) => name),
		['summonlab-alpha', 'summonlab-zeta', 'pixijs-alpha', 'pixijs-zeta']
	);
});

test('reads descriptions from YAML frontmatter instead of heading text', async (context) => {
	const fixtureRoot = createTemporaryRoot();
	context.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
	writeSkill(fixtureRoot, '.agents/skills/pixijs', {
		name: 'pixijs',
		description: 'Use the frontmatter description.',
		heading: 'Do not use this heading as the description'
	});

	const [entry] = await discoverAgenticSkills(fixtureRoot);
	assert.equal(entry.description, 'Use the frontmatter description.');
});

test('renders deterministic ownership sections and repository-relative links', () => {
	assert.equal(
		renderAgenticSkillInventory([
			{
				name: 'summonlab-alpha',
				description: 'Use when testing a first-party skill.',
				ownership: 'summonlab',
				canonicalPath: 'skills/summonlab-alpha/SKILL.md',
				discoveryPath: '.agents/skills/summonlab-alpha/SKILL.md'
			},
			{
				name: 'pixijs',
				description: 'Use when routing PixiJS work.',
				ownership: 'external-pixijs',
				canonicalPath: '.agents/skills/pixijs/SKILL.md',
				discoveryPath: '.agents/skills/pixijs/SKILL.md'
			}
		]),
		`${INVENTORY_START}\n\n_Inventory: 2 skills (1 Summonlab, 1 pinned PixiJS)._\n\n## Summonlab-authored skills\n\n| Skill | Description | Discovery |\n| --- | --- | --- |\n| [\`summonlab-alpha\`](../../../skills/summonlab-alpha/SKILL.md) | Use when testing a first-party skill. | [\`.agents/skills/summonlab-alpha/SKILL.md\`](../../../.agents/skills/summonlab-alpha/SKILL.md) |\n\n## Pinned external PixiJS skills\n\n| Skill | Description | Discovery |\n| --- | --- | --- |\n| [\`pixijs\`](../../../.agents/skills/pixijs/SKILL.md) | Use when routing PixiJS work. | [\`.agents/skills/pixijs/SKILL.md\`](../../../.agents/skills/pixijs/SKILL.md) |\n\n${INVENTORY_END}`
	);
});

test('write preserves prose around exactly one generated region and check detects drift', (context) => {
	const fixtureRoot = createHappyFixture();
	context.after(() => rmSync(fixtureRoot, { recursive: true, force: true }));
	const wikiPath = join(fixtureRoot, 'docs/wiki/systems/agentic-skills.md');
	mkdirSync(dirname(wikiPath), { recursive: true });
	writeFileSync(
		wikiPath,
		`# Intro\n\nProse before.\n\n${INVENTORY_START}\nold inventory\n${INVENTORY_END}\n\nProse after.\n`
	);

	const writeResult = runInventory(fixtureRoot, '--write');
	assert.equal(writeResult.status, 0, writeResult.stderr);
	const written = readFileSync(wikiPath, 'utf8');
	assert.equal(written.startsWith('# Intro\n\nProse before.\n\n'), true);
	assert.equal(written.endsWith('\n\nProse after.\n'), true);
	assert.match(written, /summonlab-alpha/);
	assert.match(written, /pixijs/);

	const checkResult = runInventory(fixtureRoot, '--check');
	assert.equal(checkResult.status, 0, checkResult.stderr);
	writeFileSync(
		wikiPath,
		written
			.split('\n')
			.filter((line) => !line.includes('summonlab-alpha'))
			.join('\n')
	);
	const staleResult = runInventory(fixtureRoot, '--check');
	assert.notEqual(staleResult.status, 0);
	assert.match(staleResult.stderr, /agentic-skills wiki inventory is stale/);
});

const realRepositoryAliasesExist = expectedSummonlabNames.every((name) => {
	return existsSync(join(repositoryRoot, '.agents/skills', name, 'SKILL.md'));
});

test(
	'real repository contains the complete 34-skill inventory once discovery aliases exist',
	{
		skip: realRepositoryAliasesExist ? false : 'Task 3 discovery aliases are not present yet'
	},
	async () => {
		const entries = await discoverAgenticSkills(repositoryRoot);
		const summonlabNames = entries
			.filter(({ ownership }) => ownership === 'summonlab')
			.map(({ name }) => name);
		const pixijsNames = entries
			.filter(({ ownership }) => ownership === 'external-pixijs')
			.map(({ name }) => name);

		assert.deepEqual(summonlabNames, expectedSummonlabNames);
		assert.equal(pixijsNames.length, 26);
		assert.equal(entries.length, 34);
	}
);
