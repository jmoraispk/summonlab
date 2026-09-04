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

	requireText(
		animationSkill,
		/^---\nname: summonlab-character-animations\ndescription: Use when /m,
		'animation skill frontmatter must declare its name and trigger',
		errors
	);
	requireText(
		animationSkill,
		/^name: summonlab-character-animations$/m,
		'animation skill frontmatter name must be summonlab-character-animations',
		errors
	);
	requireText(
		actionSkill,
		/^---\nname: summonlab-character-action-creation\ndescription: Use when a Summonlab character action does not already have an explicit known motion contract and its gameplay intent, acting limb or delivery mechanism, five ordered beats, contacts, or ending must be defined before animation production\.\n---/m,
		'action skill frontmatter must declare the approved motion-contract trigger',
		errors
	);
	requireText(
		actionSkill,
		/exactly one coherent five-beat action brief/i,
		'action skill must require one coherent five-beat brief',
		errors
	);
	requireText(
		actionSkill,
		/obtain owner approval/i,
		'action skill must require owner approval',
		errors
	);
	requireText(
		actionSkill,
		/do not generate raster frames or use pose variations to\s+discover the action/i,
		'action skill must forbid raster and pose-variation discovery',
		errors
	);
	requireText(
		animationSkill,
		/Action authority:/,
		'animation clip brief must include Action authority',
		errors
	);
	requireText(
		animationSkill,
		/Support\/contact sequence:/i,
		'animation clip brief must include Support/contact sequence',
		errors
	);
	requireText(
		animationSkill,
		/known \+ referenced -> copy the saved beats into the clip brief/i,
		'animation skill must copy known referenced beats into the brief',
		errors
	);
	requireText(
		animationSkill,
		/undefined\/ambiguous -> stop; invoke summonlab-character-action-creation; await approved contract/i,
		'undefined action must route through action creation',
		errors
	);

	const actionContractPath = resolve(
		dirname(paths['action-skill']),
		'references/action-contract.md'
	);
	const actionContract = read(actionContractPath, 'action-contract reference', errors);
	for (const field of [
		'Character / action:',
		'Gameplay intent:',
		'Motion sentence:',
		'Acting limb / delivery:',
		'Contacts / center of mass:',
		'Loop seam or terminal state:',
		'Forbidden alternatives:'
	])
		requireText(
			actionContract,
			new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
			`action brief must include ${field}`,
			errors
		);
	for (let beat = 1; beat <= 5; beat += 1)
		requireText(
			actionContract,
			new RegExp(`^${beat}\\. Beat`, 'm'),
			`action brief must include numbered beat ${beat}`,
			errors
		);

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
	const diagramPath = resolve(dirname(paths['known-actions']), 'classical-human-run.svg');
	const diagram = read(diagramPath, 'classical human run diagram', errors);
	for (const label of [
		'1 Contact A',
		'2 Compression A',
		'3 Airborne pass',
		'4 Contact B',
		'5 Recovery B',
		'support=left',
		'support=none',
		'support=right'
	])
		requireText(
			diagram,
			new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
			`classical human run diagram must include ${label}`,
			errors
		);

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
