import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { AGENT_READINESS_CONTENT_BINDING_V2 } from '../packages/content/src/agent-readiness-content-binding.js';
import {
	calculateCombatContentAggregateHash,
	COMBAT_CONTENT_BINDING
} from '../packages/content/src/combat-content-binding.js';
import {
	calculateProgressionRulesContentHash,
	PROGRESSION_RULES_V1
} from '../packages/content/src/progression-rules.js';

const COMBAT_BINDING_PATH = 'packages/content/src/combat-content-binding.ts';
const READINESS_BINDING_PATH = 'packages/content/src/agent-readiness-content-binding.ts';
const READINESS_CONTRACT_PATH = 'packages/contracts/src/readiness-combat.ts';
const READINESS_SPEC_PATH = 'packages/contracts/src/readiness-combat.spec.ts';
const PROGRESSION_RULES_PATH = 'packages/content/src/progression-rules.ts';
const GAME_STATE_PATH = 'packages/contracts/src/engine/game-state.ts';
const ENGINE_COMPATIBILITY_SPEC_PATH = 'packages/contracts/src/engine-compatibility.spec.ts';

function replaceNamedHash(source: string, name: string, contentHash: string): string {
	const pattern = new RegExp(`(const ${name} =\\n?\\s*')[0-9a-f]{64}(';?)`, 'u');
	const matches = [...source.matchAll(new RegExp(pattern.source, 'gu'))];
	if (matches.length !== 1) {
		throw new Error(`Expected exactly one ${name} hash binding`);
	}
	return source.replace(pattern, `$1${contentHash}$2`);
}

function replaceObjectContentHash(
	source: string,
	declaration: string,
	contentHash: string
): string {
	const start = source.indexOf(`export const ${declaration}`);
	if (start === -1) throw new Error(`Missing ${declaration} declaration`);
	const next = source.indexOf('\nexport const ', start + declaration.length);
	const end = next === -1 ? source.length : next;
	const declarationSource = source.slice(start, end);
	const pattern = /contentHash: '[0-9a-f]{64}'/gu;
	if ([...declarationSource.matchAll(pattern)].length !== 1) {
		throw new Error(`Expected exactly one ${declaration} content hash binding`);
	}
	return `${source.slice(0, start)}${declarationSource.replace(
		pattern,
		`contentHash: '${contentHash}'`
	)}${source.slice(end)}`;
}

function replaceScopedHash(
	source: string,
	scopeStart: string,
	scopeEnd: string,
	pattern: RegExp,
	contentHash: string
): string {
	const start = source.indexOf(scopeStart);
	if (start === -1) throw new Error(`Missing ${scopeStart} expectation scope`);
	const next = source.indexOf(scopeEnd, start + scopeStart.length);
	const end = next === -1 ? source.length : next;
	const scopedSource = source.slice(start, end);
	if ([...scopedSource.matchAll(new RegExp(pattern.source, 'gu'))].length !== 1) {
		throw new Error(`Expected exactly one hash binding in ${scopeStart}`);
	}
	return `${source.slice(0, start)}${scopedSource.replace(pattern, `$1${contentHash}$2`)}${source.slice(end)}`;
}

export function resealCombatContentSources(
	combatBindingSource: string,
	readinessBindingSource: string,
	readinessContractSource: string,
	readinessSpecSource: string,
	progressionRulesSource: string,
	gameStateSource: string,
	engineCompatibilitySpecSource: string,
	combatContentHash: string,
	readinessContentHash: string,
	progressionContentHash: string
): {
	readonly combatBindingSource: string;
	readonly readinessBindingSource: string;
	readonly readinessContractSource: string;
	readonly readinessSpecSource: string;
	readonly progressionRulesSource: string;
	readonly gameStateSource: string;
	readonly engineCompatibilitySpecSource: string;
} {
	return {
		combatBindingSource: replaceObjectContentHash(
			combatBindingSource,
			'COMBAT_CONTENT_BINDING',
			combatContentHash
		),
		readinessBindingSource: replaceObjectContentHash(
			readinessBindingSource,
			'AGENT_READINESS_CONTENT_BINDING_V2',
			readinessContentHash
		),
		readinessContractSource: replaceNamedHash(
			replaceNamedHash(
				readinessContractSource,
				'LEGACY_AND_READINESS_V1_CONTENT_HASH',
				combatContentHash
			),
			'READINESS_V2_CONTENT_HASH',
			readinessContentHash
		),
		readinessSpecSource: replaceScopedHash(
			replaceScopedHash(
				readinessSpecSource,
				'const HASH = {',
				'} as const;',
				/(content: ')[0-9a-f]{64}(')/u,
				combatContentHash
			),
			"it('returns only a decision window or a common combat result'",
			'\n\tit(',
			/(contentHash: ')[0-9a-f]{64}(')/u,
			readinessContentHash
		),
		progressionRulesSource: replaceObjectContentHash(
			progressionRulesSource,
			'PROGRESSION_RULES_V1_BINDING',
			progressionContentHash
		),
		gameStateSource: replaceNamedHash(
			gameStateSource,
			'PROGRESSION_RULES_V1_CONTENT_HASH',
			progressionContentHash
		),
		engineCompatibilitySpecSource: replaceScopedHash(
			engineCompatibilitySpecSource,
			"it('adds bound v27 progression without widening the frozen v26 schema'",
			'\n\tit(',
			/(contentHash: ')[0-9a-f]{64}(')/u,
			progressionContentHash
		)
	};
}

async function main(): Promise<void> {
	const repositoryRoot = process.cwd();
	const paths = [
		COMBAT_BINDING_PATH,
		READINESS_BINDING_PATH,
		READINESS_CONTRACT_PATH,
		READINESS_SPEC_PATH,
		PROGRESSION_RULES_PATH,
		GAME_STATE_PATH,
		ENGINE_COMPATIBILITY_SPEC_PATH
	] as const;
	const [
		combatBindingSource,
		readinessBindingSource,
		readinessContractSource,
		readinessSpecSource,
		progressionRulesSource,
		gameStateSource,
		engineCompatibilitySpecSource
	] = await Promise.all(
		paths.map((repositoryPath) =>
			readFile(path.join(repositoryRoot, ...repositoryPath.split('/')), 'utf8')
		)
	);
	const [combatContentHash, readinessContentHash, progressionContentHash] = await Promise.all([
		calculateCombatContentAggregateHash(COMBAT_CONTENT_BINDING.components),
		calculateCombatContentAggregateHash(AGENT_READINESS_CONTENT_BINDING_V2.components),
		calculateProgressionRulesContentHash(PROGRESSION_RULES_V1)
	]);
	const resealed = resealCombatContentSources(
		combatBindingSource,
		readinessBindingSource,
		readinessContractSource,
		readinessSpecSource,
		progressionRulesSource,
		gameStateSource,
		engineCompatibilitySpecSource,
		combatContentHash,
		readinessContentHash,
		progressionContentHash
	);
	await Promise.all([
		writeFile(
			path.join(repositoryRoot, ...COMBAT_BINDING_PATH.split('/')),
			resealed.combatBindingSource
		),
		writeFile(
			path.join(repositoryRoot, ...READINESS_BINDING_PATH.split('/')),
			resealed.readinessBindingSource
		),
		writeFile(
			path.join(repositoryRoot, ...READINESS_CONTRACT_PATH.split('/')),
			resealed.readinessContractSource
		),
		writeFile(
			path.join(repositoryRoot, ...READINESS_SPEC_PATH.split('/')),
			resealed.readinessSpecSource
		),
		writeFile(
			path.join(repositoryRoot, ...PROGRESSION_RULES_PATH.split('/')),
			resealed.progressionRulesSource
		),
		writeFile(path.join(repositoryRoot, ...GAME_STATE_PATH.split('/')), resealed.gameStateSource),
		writeFile(
			path.join(repositoryRoot, ...ENGINE_COMPATIBILITY_SPEC_PATH.split('/')),
			resealed.engineCompatibilitySpecSource
		)
	]);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
