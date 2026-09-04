import assert from 'node:assert/strict';
import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readlinkSync,
	readdirSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const validatorPath = join(repositoryRoot, 'tools/validate-character-animation-skills.mjs');
const animationSkillPath = join(repositoryRoot, 'skills/summonlab-character-animations/SKILL.md');
const actionSkillPath = join(repositoryRoot, 'skills/summonlab-character-action-creation/SKILL.md');
const actionContractPath = join(
	repositoryRoot,
	'skills/summonlab-character-action-creation/references/action-contract.md'
);
const knownActionsPath = join(
	repositoryRoot,
	'skills/summonlab-character-animations/references/known-actions.md'
);

function runValidator(options = {}) {
	const args = [validatorPath];
	for (const [option, path] of Object.entries(options)) {
		args.push(`--${option}`, path);
	}
	return spawnSync(process.execPath, args, { encoding: 'utf8' });
}

function withFixture(callback) {
	const fixtureRoot = mkdtempSync(join(tmpdir(), 'summonlab-character-animation-skills-'));
	cpSync(join(repositoryRoot, 'skills'), join(fixtureRoot, 'skills'), { recursive: true });
	try {
		return callback(fixtureRoot);
	} finally {
		rmSync(fixtureRoot, { recursive: true, force: true });
	}
}

function runValidatorWithAnimationSkill(animationSkill) {
	return withFixture((fixtureRoot) => {
		const fixturePath = join(fixtureRoot, 'skills/summonlab-character-animations/SKILL.md');
		writeFileSync(fixturePath, animationSkill);
		return runValidator({ 'animation-skill': fixturePath });
	});
}

function runValidatorWithSkills({ animationSkill, actionSkill }) {
	return withFixture((fixtureRoot) => {
		const fixtureAnimationPath = join(
			fixtureRoot,
			'skills/summonlab-character-animations/SKILL.md'
		);
		const fixtureActionPath = join(
			fixtureRoot,
			'skills/summonlab-character-action-creation/SKILL.md'
		);
		writeFileSync(fixtureAnimationPath, animationSkill);
		writeFileSync(fixtureActionPath, actionSkill);
		return runValidator({
			'animation-skill': fixtureAnimationPath,
			'action-skill': fixtureActionPath
		});
	});
}

function runValidatorWithActionContract(actionContract) {
	return withFixture((fixtureRoot) => {
		const fixtureActionSkill = join(
			fixtureRoot,
			'skills/summonlab-character-action-creation/SKILL.md'
		);
		writeFileSync(
			join(fixtureRoot, 'skills/summonlab-character-action-creation/references/action-contract.md'),
			actionContract
		);
		return runValidator({ 'action-skill': fixtureActionSkill });
	});
}

function runValidatorWithKnownActions(knownActions) {
	return withFixture((fixtureRoot) => {
		const fixturePath = join(
			fixtureRoot,
			'skills/summonlab-character-animations/references/known-actions.md'
		);
		writeFileSync(fixturePath, knownActions);
		return runValidator({ 'known-actions': fixturePath });
	});
}

function runValidatorWithRunDiagram(diagram) {
	return withFixture((fixtureRoot) => {
		const fixturePath = join(
			fixtureRoot,
			'skills/summonlab-character-animations/references/classical-human-run.svg'
		);
		writeFileSync(fixturePath, diagram);
		return runValidator({
			'known-actions': join(
				fixtureRoot,
				'skills/summonlab-character-animations/references/known-actions.md'
			)
		});
	});
}

test('validates the repository character-animation skill contract', () => {
	const result = runValidator();
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(JSON.parse(result.stdout), { valid: true });
});

test('requires undefined actions to route through action creation', () => {
	const animationSkill = readFileSync(animationSkillPath, 'utf8');
	const result = runValidatorWithAnimationSkill(
		animationSkill.replace('summonlab-character-action-creation', 'missing-action-authority')
	);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /undefined action.*action creation/i);
});

test('accepts equivalent skill guidance without coupling validation to exact prose', () => {
	const animationSkill = readFileSync(animationSkillPath, 'utf8')
		.replace(
			'known + referenced -> copy the saved beats into the clip brief',
			'known action with a saved reference -> carry its beats into the clip brief'
		)
		.replace(
			'undefined/ambiguous -> stop; invoke summonlab-character-action-creation; await approved contract',
			'undefined or ambiguous action -> use summonlab-character-action-creation and wait for the approved contract'
		);
	const actionSkill = readFileSync(actionSkillPath, 'utf8')
		.replace('exactly one coherent five-beat action brief', 'one coherent brief with five beats')
		.replace(
			'Obtain owner approval for that brief.',
			'Submit that complete brief for owner approval.'
		)
		.replace(
			'Do not generate raster frames or use pose variations to\n   discover the action before approval.',
			'Raster work and pose exploration begin only after the action is approved.'
		);
	const result = runValidatorWithSkills({ animationSkill, actionSkill });

	assert.equal(result.status, 0, result.stderr);
});

test('requires exactly five ordered beat fields', () => {
	const actionContract = readFileSync(actionContractPath, 'utf8');
	const result = runValidatorWithActionContract(
		actionContract.replace('5. Beat five:', '5. Beat five:\n6. Beat six:')
	);

	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /exactly five ordered unique beat fields/i);
});

test('rejects a duplicate beat field even when beats one through five remain present', () => {
	const actionContract = readFileSync(actionContractPath, 'utf8');
	const result = runValidatorWithActionContract(
		actionContract.replace('4. Beat four:', '3. Duplicate beat:\n4. Beat four:')
	);

	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /exactly five ordered unique beat fields/i);
});

test('rejects a missing beat field', () => {
	const actionContract = readFileSync(actionContractPath, 'utf8');
	const result = runValidatorWithActionContract(actionContract.replace(/^3\. Beat three:\n/m, ''));

	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /exactly five ordered unique beat fields/i);
});

for (const field of [
	'Starting pose / prerequisite state:',
	'Target direction / contact beat:',
	'Equipment / identity constraints:'
]) {
	test(`requires the ${field} action-contract field`, () => {
		const actionContract = readFileSync(actionContractPath, 'utf8');
		const result = runValidatorWithActionContract(actionContract.replace(`${field}\n`, ''));

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, new RegExp(field.split(':')[0], 'i'));
	});
}

for (const field of ['Gameplay intent:', 'Contacts / center of mass:', 'Forbidden alternatives:']) {
	test(`requires the ${field} animation-handoff field`, () => {
		const animationSkill = readFileSync(animationSkillPath, 'utf8');
		const result = runValidatorWithAnimationSkill(animationSkill.replace(`${field}\n`, ''));

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, new RegExp(field.split(':')[0], 'i'));
	});
}

test('discovers the canonical action skill through the repository skill catalog', () => {
	const catalogLink = join(repositoryRoot, '.agents/skills/summonlab-character-action-creation');
	assert.equal(existsSync(catalogLink), true, 'catalog skill entry is missing');
	assert.equal(
		lstatSync(catalogLink).isSymbolicLink(),
		true,
		'catalog entry must avoid duplication'
	);
	assert.equal(
		realpathSync(catalogLink),
		realpathSync(join(repositoryRoot, 'skills/summonlab-character-action-creation'))
	);

	const fixtureRoot = mkdtempSync(join(tmpdir(), 'summonlab-skill-catalog-'));
	try {
		mkdirSync(join(fixtureRoot, '.agents/skills'), { recursive: true });
		mkdirSync(join(fixtureRoot, 'skills'), { recursive: true });
		cpSync(
			join(repositoryRoot, 'skills/summonlab-character-action-creation'),
			join(fixtureRoot, 'skills/summonlab-character-action-creation'),
			{ recursive: true }
		);
		symlinkSync(
			readlinkSync(catalogLink),
			join(fixtureRoot, '.agents/skills/summonlab-character-action-creation')
		);
		const discoveredNames = readdirSync(join(fixtureRoot, '.agents/skills')).map((entry) => {
			const skill = readFileSync(join(fixtureRoot, '.agents/skills', entry, 'SKILL.md'), 'utf8');
			return skill.match(/^name:\s*([^\n]+)$/m)?.[1];
		});

		assert.deepEqual(discoveredNames, ['summonlab-character-action-creation']);
	} finally {
		rmSync(fixtureRoot, { recursive: true, force: true });
	}
});

test('requires the classical run support sequence', () => {
	const knownActions = readFileSync(knownActionsPath, 'utf8');
	const result = runValidatorWithKnownActions(
		knownActions.replace('left, left, none, right, right', 'left, left, left, left, right')
	);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /classical human run.*support/i);
});

test('requires each classical run table row to retain its ordered support', () => {
	const knownActions = readFileSync(knownActionsPath, 'utf8');
	const result = runValidatorWithKnownActions(
		knownActions.replace(/\| 3\s+\| Airborne pass \| none\s+\|/, '| 3 | Airborne pass | right |')
	);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /classical human run table.*support/i);
});

test('requires each classical run SVG panel to retain its ordered support', () => {
	const diagramPath = join(
		repositoryRoot,
		'skills/summonlab-character-animations/references/classical-human-run.svg'
	);
	const diagram = readFileSync(diagramPath, 'utf8');
	const result = runValidatorWithRunDiagram(
		diagram.replace(
			'3 Airborne pass</text><text x="105" y="141" text-anchor="middle" font-size="15">support=none',
			'3 Airborne pass</text><text x="105" y="141" text-anchor="middle" font-size="15" data-original="support=none">support=right'
		)
	);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /classical human run SVG.*support/i);
});

test('requires each classical run SVG panel to retain its ordered beat label', () => {
	const diagramPath = join(
		repositoryRoot,
		'skills/summonlab-character-animations/references/classical-human-run.svg'
	);
	const diagram = readFileSync(diagramPath, 'utf8');
	const result = runValidatorWithRunDiagram(
		diagram.replace('1 Contact A</text>', '1 Anything</text>')
	);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /classical human run SVG.*label/i);
});
