import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaults = {
	'animation-skill': 'skills/summonlab-character-animations/SKILL.md',
	'action-skill': 'skills/summonlab-character-action-creation/SKILL.md',
	'known-actions': 'skills/summonlab-character-animations/references/known-actions.md'
};

function parseArguments(argv) {
	const paths = { ...defaults };
	for (let index = 0; index < argv.length; index += 1) {
		const option = argv[index].replace(/^--/, '');
		if (!(option in paths) || !argv[index + 1]) {
			throw new Error(
				`usage: ${process.argv[1]} [--animation-skill path] [--action-skill path] [--known-actions path]`
			);
		}
		paths[option] = argv[index + 1];
		index += 1;
	}
	return Object.fromEntries(
		Object.entries(paths).map(([option, path]) => [option, resolve(repositoryRoot, path)])
	);
}

function read(path, label, errors) {
	if (!existsSync(path)) {
		errors.push(`${label} is missing: ${path}`);
		return '';
	}
	return readFileSync(path, 'utf8');
}

function requireText(text, pattern, message, errors) {
	if (!pattern.test(text)) errors.push(message);
}

function validateFrontmatter(text, expectedName, label, errors) {
	const frontmatter = text.match(/^---\n([\s\S]*?)\n---/m)?.[1] ?? '';
	const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
	const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim();
	if (name !== expectedName) errors.push(`${label} frontmatter name must be ${expectedName}`);
	if (!description?.startsWith('Use when ')) {
		errors.push(`${label} frontmatter must provide a Use when trigger`);
	}
}

function textTemplate(markdown, label, errors) {
	const template = markdown.match(/```text\n([\s\S]*?)\n```/)?.[1];
	if (!template) errors.push(`${label} must contain a text template`);
	return template ?? '';
}

function requireTemplateFields(template, fields, label, errors) {
	const lines = template.split('\n').map((line) => line.trim());
	for (const field of fields) {
		if (lines.filter((line) => line === field).length !== 1) {
			errors.push(`${label} must include exactly one ${field} field`);
		}
	}
}

function keyValueContract(markdown, language, label, errors) {
	const escapedLanguage = language.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const block = markdown.match(new RegExp(`\`\`\`${escapedLanguage}\\n([\\s\\S]*?)\\n\`\`\``))?.[1];
	if (!block) {
		errors.push(`${label} must contain a ${language} contract`);
		return new Map();
	}
	const contract = new Map();
	for (const line of block.split('\n').map((value) => value.trim())) {
		const match = line.match(/^([a-z][a-z0-9.-]*)=([a-z][a-z0-9-]*)$/);
		if (!match || contract.has(match[1])) {
			errors.push(`${label} contains an invalid or duplicate contract entry: ${line}`);
			continue;
		}
		contract.set(match[1], match[2]);
	}
	return contract;
}

function requireContractValues(contract, required, label, errors) {
	for (const [key, value] of Object.entries(required)) {
		if (contract.get(key) !== value) {
			errors.push(`${label} ${key} must be ${value}`);
		}
	}
}

const classicalRunSupports = ['left', 'left', 'none', 'right', 'right'];
const classicalRunLabels = [
	'Contact A',
	'Compression A',
	'Airborne pass',
	'Contact B',
	'Recovery B'
];

function compareSupportSequence(actual, source, errors) {
	for (const [index, expected] of classicalRunSupports.entries()) {
		if (actual[index] !== expected) {
			errors.push(
				`classical human run ${source} support at beat ${index + 1} must be ${expected}, got ${actual[index] ?? 'missing'}`
			);
		}
	}
}

function parseKnownActionTableRows(markdown) {
	return [...markdown.matchAll(/^\|\s*(\d+)\s*\|[^|]+\|\s*([^|]+)\|/gm)].map((match) => ({
		beat: Number(match[1]),
		support: match[2].trim()
	}));
}

function parseRunDiagramPanels(svg) {
	return [
		...svg.matchAll(
			/<g transform="translate\([^)]*\)">[\s\S]*?<text[^>]*>(\d+) ([^<]+)<\/text><text[^>]*>support=([^<]+)<\/text>/g
		)
	].map((match) => ({
		beat: Number(match[1]),
		label: match[2].trim(),
		support: match[3].trim()
	}));
}

function validateMarkdownLinks(path, text, errors) {
	for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
		const target = match[1].trim().replace(/^<|>$/g, '').split(/[\s#]/, 1)[0];
		if (!target || /^(?:[a-z]+:|\/|#)/i.test(target)) continue;
		const targetPath = resolve(dirname(path), target);
		if (!existsSync(targetPath)) errors.push(`relative link is missing: ${path} -> ${target}`);
	}
}

function validateSvgLinks(path, text, errors) {
	for (const match of text.matchAll(/(?:href|xlink:href)=["']([^"']+)["']/g)) {
		const target = match[1].split('#', 1)[0];
		if (!target || /^(?:[a-z]+:|\/)/i.test(target)) continue;
		const targetPath = resolve(dirname(path), target);
		if (!existsSync(targetPath)) errors.push(`relative SVG link is missing: ${path} -> ${target}`);
	}
}

function main() {
	const paths = parseArguments(process.argv.slice(2));
	const errors = [];
	const animationSkill = read(paths['animation-skill'], 'animation skill', errors);
	const actionSkill = read(paths['action-skill'], 'action skill', errors);
	const knownActions = read(paths['known-actions'], 'known actions', errors);
	const clipContractsPath = resolve(
		dirname(paths['animation-skill']),
		'references/clip-contracts.md'
	);
	const clipContracts = read(clipContractsPath, 'clip-contract reference', errors);

	validateFrontmatter(animationSkill, 'summonlab-character-animations', 'animation skill', errors);
	validateFrontmatter(actionSkill, 'summonlab-character-action-creation', 'action skill', errors);
	requireText(
		animationSkill,
		/summonlab-character-action-creation/,
		'undefined action must route through action creation',
		errors
	);
	const actionRouting = keyValueContract(
		animationSkill,
		'action-routing',
		'animation action routing',
		errors
	);
	requireContractValues(
		actionRouting,
		{
			'known-referenced.authority': 'saved-known-action',
			'known-referenced.action-creation': 'bypass',
			'known-referenced.pixel-work': 'allow-after-clip-brief',
			'undefined-ambiguous.authority': 'summonlab-character-action-creation',
			'undefined-ambiguous.action-creation': 'invoke',
			'undefined-ambiguous.pixel-work': 'refuse-until-approved-brief'
		},
		'animation action routing',
		errors
	);
	const animationBrief = textTemplate(animationSkill, 'animation clip brief', errors);
	requireTemplateFields(
		animationBrief,
		[
			'Character / clip:',
			'Action authority:',
			'Gameplay intent:',
			'Starting pose / prerequisite state:',
			'Motion sentence:',
			'Frame beats (left to right):',
			'Acting limb / delivery:',
			'Target direction / contact beat:',
			'Support/contact sequence:',
			'Contacts / center of mass:',
			'Equipment / identity constraints:',
			'Loop seam or terminal state:',
			'Forbidden alternatives:'
		],
		'animation clip brief',
		errors
	);

	const actionContractPath = resolve(
		dirname(paths['action-skill']),
		'references/action-contract.md'
	);
	const actionContract = read(actionContractPath, 'action-contract reference', errors);
	const actionBrief = textTemplate(actionContract, 'action brief', errors);
	requireTemplateFields(
		actionBrief,
		[
			'Character / action:',
			'Gameplay intent:',
			'Motion sentence:',
			'Starting pose / prerequisite state:',
			'Acting limb / delivery:',
			'Target direction / contact beat:',
			'Contacts / center of mass:',
			'Equipment / identity constraints:',
			'Loop seam or terminal state:',
			'Forbidden alternatives:'
		],
		'action brief',
		errors
	);
	const beatNumbers = actionBrief
		.split('\n')
		.map((line) => line.trim().match(/^(\d+)\.\s+[^:]+:/)?.[1])
		.filter(Boolean)
		.map(Number);
	if (
		beatNumbers.length !== 5 ||
		new Set(beatNumbers).size !== 5 ||
		beatNumbers.some((beat, index) => beat !== index + 1)
	) {
		errors.push('action brief must contain exactly five ordered unique beat fields');
	}

	requireText(
		knownActions,
		/classical-human-run-5/,
		'known actions must define classical-human-run-5',
		errors
	);
	requireText(
		knownActions,
		/left, left, none, right, right/,
		'classical human run support sequence must be left, left, none, right, right',
		errors
	);
	requireText(
		knownActions,
		/Contact A[\s\S]*Compression A[\s\S]*Airborne pass[\s\S]*Contact B[\s\S]*Recovery B/,
		'known actions must preserve the classical human run beat order',
		errors
	);
	const tableRows = parseKnownActionTableRows(knownActions);
	if (
		tableRows.length !== 5 ||
		new Set(tableRows.map((row) => row.beat)).size !== 5 ||
		tableRows.some((row, index) => row.beat !== index + 1)
	) {
		errors.push('classical human run table must contain exactly five ordered unique beats');
	}
	compareSupportSequence(
		tableRows.map((row) => row.support),
		'table',
		errors
	);
	const diagramPath = resolve(dirname(paths['known-actions']), 'classical-human-run.svg');
	const diagram = read(diagramPath, 'classical human run diagram', errors);
	const diagramPanels = parseRunDiagramPanels(diagram);
	if (
		diagramPanels.length !== 5 ||
		new Set(diagramPanels.map((panel) => panel.beat)).size !== 5 ||
		diagramPanels.some((panel, index) => panel.beat !== index + 1)
	) {
		errors.push('classical human run SVG must contain exactly five ordered unique panels');
	}
	compareSupportSequence(
		diagramPanels.map((panel) => panel.support),
		'SVG panel',
		errors
	);
	for (const [index, expected] of classicalRunLabels.entries()) {
		const actual = diagramPanels[index]?.label;
		if (actual !== expected) {
			errors.push(
				`classical human run SVG panel label at beat ${index + 1} must be ${expected}, got ${actual ?? 'missing'}`
			);
		}
	}

	for (const [path, text] of [
		[paths['animation-skill'], animationSkill],
		[paths['action-skill'], actionSkill],
		[paths['known-actions'], knownActions],
		[clipContractsPath, clipContracts],
		[actionContractPath, actionContract]
	])
		validateMarkdownLinks(path, text, errors);
	if (diagram && existsSync(diagramPath) && statSync(diagramPath).isFile())
		validateSvgLinks(diagramPath, diagram, errors);

	if (errors.length) throw new Error(errors.join('\n'));
	process.stdout.write(`${JSON.stringify({ valid: true })}\n`);
}

try {
	main();
} catch (error) {
	process.stderr.write(`${error.message}\n`);
	process.exitCode = 1;
}
