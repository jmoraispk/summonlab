import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const validatorPath = join(repositoryRoot, 'tools/validate-character-animation-skills.mjs');
const animationSkillPath = join(repositoryRoot, 'skills/summonlab-character-animations/SKILL.md');
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
