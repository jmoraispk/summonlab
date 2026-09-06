import { spawn } from 'node:child_process';
import { lstat, readFile, readlink } from 'node:fs/promises';
import path from 'node:path';

export const AMERICAN_ENGLISH_RULE_IDS = [
	'armor',
	'ocher',
	'gray',
	'behavior',
	'fiber',
	'catalog',
	'vigor',
	'practice',
	'center',
	'mustache',
	'acknowledgment',
	'color',
	'math',
	'channel',
	'draft',
	'immobilize',
	'neighbor',
	'specialize',
	'defense',
	'flavor',
	'cancel',
	'favor',
	'crystallize',
	'label',
	'level',
	'luster',
	'realize',
	'recognize',
	'saber',
	'vapor'
] as const;

export type AmericanEnglishRuleId = (typeof AMERICAN_ENGLISH_RULE_IDS)[number];

export interface AmericanEnglishViolation {
	readonly kind: 'content' | 'path';
	readonly ruleId: AmericanEnglishRuleId;
	readonly found: string;
	readonly recommended: string;
	readonly path: string;
	readonly line: number | null;
	readonly column: number | null;
}

type DerivationOperation =
	| { readonly kind: 'insert'; readonly at: number; readonly text: string }
	| { readonly kind: 'remove'; readonly at: number; readonly count: number }
	| { readonly kind: 'replace'; readonly at: number; readonly count: number; readonly text: string }
	| { readonly kind: 'transpose'; readonly at: number }
	| { readonly kind: 'double'; readonly at: number };

interface FormDefinition {
	readonly american: string;
	readonly operations: readonly DerivationOperation[];
}

interface RuleDefinition {
	readonly id: AmericanEnglishRuleId;
	readonly forms: readonly FormDefinition[];
}

interface CompiledForm {
	readonly ruleId: AmericanEnglishRuleId;
	readonly american: string;
	readonly retired: string;
}

interface PolicyException {
	readonly id: string;
	readonly token: string;
	readonly path: string;
	readonly reason: string;
}

export interface AmericanEnglishExceptionUse {
	readonly id: string;
	readonly token: string;
	readonly path: string;
	readonly reason: string;
	readonly occurrences: number;
}

export interface AmericanEnglishAuditReport {
	readonly head: string;
	readonly counts: {
		readonly total: number;
		readonly content: number;
		readonly path: number;
		readonly byRule: Readonly<Record<AmericanEnglishRuleId, number>>;
		readonly byRoot: Readonly<Record<string, number>>;
	};
	readonly violations: readonly AmericanEnglishViolation[];
	readonly exceptionsUsed: readonly AmericanEnglishExceptionUse[];
}

const insert = (american: string, at: number, text: string): FormDefinition => ({
	american,
	operations: [{ kind: 'insert', at, text }]
});
const remove = (american: string, at: number, count: number): FormDefinition => ({
	american,
	operations: [{ kind: 'remove', at, count }]
});
const replace = (american: string, at: number, count: number, text: string): FormDefinition => ({
	american,
	operations: [{ kind: 'replace', at, count, text }]
});
const transpose = (american: string, at: number): FormDefinition => ({
	american,
	operations: [{ kind: 'transpose', at }]
});
const double = (american: string, at: number): FormDefinition => ({
	american,
	operations: [{ kind: 'double', at }]
});
const insertBeforeLast = (american: string, character: string, text: string): FormDefinition =>
	insert(american, american.lastIndexOf(character), text);
const replaceLast = (american: string, character: string, text: string): FormDefinition =>
	replace(american, american.lastIndexOf(character), 1, text);

const definitions: readonly RuleDefinition[] = [
	{
		id: 'armor',
		forms: [
			'armor',
			'armors',
			'armored',
			'armoring',
			'armory',
			'armorer',
			'armorsmith',
			'armorsmithing'
		].map((value) => insert(value, 4, 'u'))
	},
	{ id: 'ocher', forms: ['ocher', 'ochers'].map((value) => transpose(value, 3)) },
	{
		id: 'gray',
		forms: ['gray', 'grays', 'grayed', 'graying', 'grayish', 'grayness', 'grayscale'].map((value) =>
			replace(value, 2, 1, 'e')
		)
	},
	{
		id: 'behavior',
		forms: [
			'behavior',
			'behaviors',
			'behavioral',
			'behaviorally',
			'behaviorism',
			'behaviorist',
			'behaviorists'
		].map((value) => insert(value, 7, 'u'))
	},
	{
		id: 'fiber',
		forms: [
			...['fiber', 'fibers', 'fiberboard', 'fiberboards', 'fiberglass'].map((value) =>
				transpose(value, 3)
			),
			remove('fibered', 3, 1)
		]
	},
	{
		id: 'catalog',
		forms: [
			insert('catalog', 7, 'ue'),
			insert('catalogs', 7, 'ue'),
			...['cataloged', 'cataloging', 'cataloger'].map((value) => insert(value, 7, 'u'))
		]
	},
	{ id: 'vigor', forms: ['vigor', 'vigors'].map((value) => insertBeforeLast(value, 'r', 'u')) },
	{
		id: 'practice',
		forms: ['practice', 'practices', 'practiced', 'practicing'].map((value) =>
			replace(value, 6, 1, 's')
		)
	},
	{
		id: 'center',
		forms: [
			transpose('center', 4),
			transpose('centers', 4),
			{
				american: 'centered',
				operations: [
					{ kind: 'transpose', at: 4 },
					{ kind: 'remove', at: 6, count: 1 }
				]
			},
			remove('centering', 4, 1)
		]
	},
	{
		id: 'mustache',
		forms: ['mustache', 'mustaches', 'mustached'].map((value) => insert(value, 1, 'o'))
	},
	{
		id: 'acknowledgment',
		forms: ['acknowledgment', 'acknowledgments'].map((value) =>
			insert(value, value.indexOf('m'), 'e')
		)
	},
	{
		id: 'color',
		forms: [
			'color',
			'colors',
			'colored',
			'coloring',
			'colorful',
			'colorfully',
			'colorless',
			'colorway',
			'colorways',
			'colorspace',
			'multicolor',
			'multicolored'
		].map((value) => insertBeforeLast(value, 'r', 'u'))
	},
	{ id: 'math', forms: [insert('math', 4, 's')] },
	{
		id: 'channel',
		forms: ['channeled', 'channeling', 'channeler'].map((value) => double(value, 6))
	},
	{
		id: 'draft',
		forms: ['draft', 'drafts', 'drafty'].map((value) => replace(value, 3, 1, 'ugh'))
	},
	{
		id: 'immobilize',
		forms: [
			'immobilize',
			'immobilizes',
			'immobilized',
			'immobilizing',
			'immobilization',
			'immobilizations'
		].map((value) => replaceLast(value, 'z', 's'))
	},
	{
		id: 'neighbor',
		forms: [
			'neighbor',
			'neighbors',
			'neighbored',
			'neighboring',
			'neighborhood',
			'neighborhoods',
			'neighborly'
		].map((value) => insertBeforeLast(value, 'r', 'u'))
	},
	{
		id: 'specialize',
		forms: [
			'specialize',
			'specializes',
			'specialized',
			'specializing',
			'specialization',
			'specializations'
		].map((value) => replaceLast(value, 'z', 's'))
	},
	{
		id: 'defense',
		forms: ['defense', 'defenses', 'defenseless'].map((value) => replace(value, 5, 1, 'c'))
	},
	{
		id: 'flavor',
		forms: [
			'flavor',
			'flavors',
			'flavored',
			'flavoring',
			'flavorings',
			'flavorful',
			'flavorless'
		].map((value) => insert(value, 5, 'u'))
	},
	{ id: 'cancel', forms: ['canceled', 'canceling', 'canceler'].map((value) => double(value, 5)) },
	{
		id: 'favor',
		forms: [
			'favor',
			'favored',
			'favoring',
			'favors',
			'favorite',
			'favorable',
			'favorably',
			'favorites',
			'favoritism'
		].map((value) => insert(value, 4, 'u'))
	},
	{
		id: 'crystallize',
		forms: [
			'crystallize',
			'crystallizes',
			'crystallized',
			'crystallizing',
			'crystallization',
			'crystallizations'
		].map((value) => replaceLast(value, 'z', 's'))
	},
	{ id: 'label', forms: ['labeled', 'labeling', 'labeler'].map((value) => double(value, 4)) },
	{ id: 'level', forms: ['leveled', 'leveling', 'leveler'].map((value) => double(value, 4)) },
	{
		id: 'luster',
		forms: [transpose('luster', 4), transpose('lusters', 4), remove('lustered', 4, 1)]
	},
	{
		id: 'realize',
		forms: ['realize', 'realizes', 'realized', 'realizing', 'realization', 'realizations'].map(
			(value) => replaceLast(value, 'z', 's')
		)
	},
	{
		id: 'recognize',
		forms: ['recognize', 'recognizes', 'recognized', 'recognizing'].map((value) =>
			replaceLast(value, 'z', 's')
		)
	},
	{ id: 'saber', forms: ['saber', 'sabers', 'sabered'].map((value) => transpose(value, 3)) },
	{
		id: 'vapor',
		forms: [
			...['vapor', 'vapors', 'vapored', 'vaporing'].map((value) => insert(value, 4, 'u')),
			...['vaporize', 'vaporizes', 'vaporized', 'vaporizing', 'vaporization'].map(
				(value): FormDefinition => ({
					american: value,
					operations: [
						{ kind: 'insert', at: 4, text: 'u' },
						{ kind: 'replace', at: value.lastIndexOf('z') + 1, count: 1, text: 's' }
					]
				})
			)
		]
	}
];

function applyOperations(source: string, operations: readonly DerivationOperation[]): string {
	let value = source;
	for (const operation of operations) {
		switch (operation.kind) {
			case 'insert':
				value = `${value.slice(0, operation.at)}${operation.text}${value.slice(operation.at)}`;
				break;
			case 'remove':
				value = `${value.slice(0, operation.at)}${value.slice(operation.at + operation.count)}`;
				break;
			case 'replace':
				value = `${value.slice(0, operation.at)}${operation.text}${value.slice(operation.at + operation.count)}`;
				break;
			case 'transpose': {
				const left = value[operation.at];
				const right = value[operation.at + 1];
				if (left === undefined || right === undefined)
					throw new Error('Invalid transpose operation');
				value = `${value.slice(0, operation.at)}${right}${left}${value.slice(operation.at + 2)}`;
				break;
			}
			case 'double': {
				const character = value[operation.at];
				if (character === undefined) throw new Error('Invalid double operation');
				value = `${value.slice(0, operation.at)}${character}${value.slice(operation.at)}`;
				break;
			}
		}
	}
	return value;
}

function compilePolicy(ruleDefinitions: readonly RuleDefinition[]): readonly CompiledForm[] {
	const ruleIds = new Set<string>();
	const retiredForms = new Set<string>();
	const compiled: CompiledForm[] = [];
	for (const definition of ruleDefinitions) {
		if (ruleIds.has(definition.id))
			throw new Error(`Duplicate American English rule ID: ${definition.id}`);
		ruleIds.add(definition.id);
		if (definition.forms.length === 0)
			throw new Error(`Empty American English rule: ${definition.id}`);
		for (const form of definition.forms) {
			if (form.american.length === 0 || form.operations.length === 0) {
				throw new Error(`Empty American English pattern: ${definition.id}`);
			}
			const retired = applyOperations(form.american, form.operations);
			if (retired.length === 0 || retired === form.american) {
				throw new Error(`Invalid American English derivation: ${definition.id}`);
			}
			const normalized = retired.toLowerCase();
			if (retiredForms.has(normalized)) throw new Error(`Duplicate retired form: ${definition.id}`);
			retiredForms.add(normalized);
			compiled.push({ ruleId: definition.id, american: form.american, retired });
		}
	}
	if (ruleIds.size !== AMERICAN_ENGLISH_RULE_IDS.length) {
		throw new Error('American English rule list and definitions are inconsistent');
	}
	return compiled.sort((left, right) => right.retired.length - left.retired.length);
}

const compiledForms = compilePolicy(definitions);

function retiredRoot(ruleId: AmericanEnglishRuleId): string {
	const definition = definitions.find((candidate) => candidate.id === ruleId);
	const form = definition?.forms[0];
	if (form === undefined) throw new Error(`Unknown American English rule: ${ruleId}`);
	return applyOperations(form.american, form.operations);
}

const packageToken = `@img/${retiredRoot('color')}`;
const retiredColor = retiredRoot('color');
const methodToken = `to${retiredColor[0]!.toUpperCase()}${retiredColor.slice(1)}space`;
const designPath =
	'docs/superpowers/specs/2026-09-06-american-english-repository-migration-design.md';
const exceptions: readonly PolicyException[] = [
	{
		id: 'package-lock-name',
		token: packageToken,
		path: 'pnpm-lock.yaml',
		reason: 'Required third-party package identifier'
	},
	{
		id: 'package-name-in-design',
		token: packageToken,
		path: designPath,
		reason: 'Required third-party package identifier in its governing specification'
	},
	{
		id: 'sharp-api-name',
		token: methodToken,
		path: 'tools/normalize-skill-icon-provider-source.ts',
		reason: 'Required third-party API identifier'
	},
	{
		id: 'sharp-api-name-in-design',
		token: methodToken,
		path: designPath,
		reason: 'Required third-party API identifier in its governing specification'
	}
];

function validateExceptions(values: readonly PolicyException[]): void {
	const ids = new Set<string>();
	for (const exception of values) {
		if (ids.has(exception.id))
			throw new Error(`Duplicate American English exception: ${exception.id}`);
		ids.add(exception.id);
		if (
			exception.path.length === 0 ||
			exception.path.endsWith('/') ||
			exception.path.includes('*') ||
			exception.path.includes('..')
		) {
			throw new Error(`Broad American English exception path: ${exception.id}`);
		}
		if (!compiledForms.some(({ retired }) => exception.token.toLowerCase().includes(retired))) {
			throw new Error(`American English exception matches no rule: ${exception.id}`);
		}
	}
}

validateExceptions(exceptions);

export function deriveRetiredForms(ruleId: AmericanEnglishRuleId): readonly string[] {
	return definitions
		.find((definition) => definition.id === ruleId)!
		.forms.map(({ american, operations }) => applyOperations(american, operations));
}

function isLetter(value: string | undefined): boolean {
	return value !== undefined && /[A-Za-z]/u.test(value);
}

function hasTokenBoundaries(source: string, start: number, length: number): boolean {
	const previous = source[start - 1];
	const first = source[start];
	const last = source[start + length - 1];
	const next = source[start + length];
	const leftBoundary =
		previous === undefined ||
		!isLetter(previous) ||
		(previous === previous.toLowerCase() && first !== undefined && first === first.toUpperCase());
	const rightBoundary =
		next === undefined ||
		!isLetter(next) ||
		(last !== undefined && last === last.toLowerCase() && next === next.toUpperCase());
	return leftBoundary && rightBoundary;
}

function restoreCase(found: string, american: string): string {
	if (found === found.toUpperCase()) return american.toUpperCase();
	if (found === found.toLowerCase()) return american.toLowerCase();
	if (found[0] === found[0]?.toUpperCase() && found.slice(1) === found.slice(1).toLowerCase()) {
		return `${american[0]!.toUpperCase()}${american.slice(1).toLowerCase()}`;
	}
	return american;
}

interface TextMatch {
	readonly index: number;
	readonly length: number;
	readonly ruleId: AmericanEnglishRuleId;
	readonly found: string;
	readonly recommended: string;
}

function findMatches(source: string): readonly TextMatch[] {
	const normalizedSource = source.toLowerCase();
	const matches: TextMatch[] = [];
	for (const form of compiledForms) {
		let from = 0;
		while (from <= normalizedSource.length - form.retired.length) {
			const index = normalizedSource.indexOf(form.retired, from);
			if (index === -1) break;
			if (hasTokenBoundaries(source, index, form.retired.length)) {
				const found = source.slice(index, index + form.retired.length);
				matches.push({
					index,
					length: form.retired.length,
					ruleId: form.ruleId,
					found,
					recommended: restoreCase(found, form.american)
				});
			}
			from = index + 1;
		}
	}
	return matches
		.sort((left, right) => left.index - right.index || right.length - left.length)
		.filter(
			(match, index, ordered) =>
				index === 0 || match.index >= ordered[index - 1]!.index + ordered[index - 1]!.length
		);
}

export function replaceRetiredForms(source: string): string {
	let offset = 0;
	let result = '';
	for (const match of findMatches(source)) {
		result += source.slice(offset, match.index);
		result += match.recommended;
		offset = match.index + match.length;
	}
	return `${result}${source.slice(offset)}`;
}

function runGit(
	repositoryRoot: string,
	arguments_: readonly string[],
	input?: Buffer
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const child = spawn('git', arguments_, {
			cwd: repositoryRoot,
			stdio: ['pipe', 'pipe', 'pipe']
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) resolve(Buffer.concat(stdout));
			else reject(new Error(Buffer.concat(stderr).toString('utf8').trim() || `Git exited ${code}`));
		});
		child.stdin.end(input);
	});
}

function splitNul(buffer: Buffer): string[] {
	const values = buffer.toString('utf8').split('\0');
	if (values.at(-1) === '') values.pop();
	return values;
}

function hasExactExceptionTokenBoundaries(source: string, start: number, token: string): boolean {
	const previous = source[start - 1];
	const next = source[start + token.length];
	const packageToken = token.startsWith('@');
	const extendsOnLeft = packageToken ? /[A-Za-z0-9_.@/-]/u : /[A-Za-z0-9_$]/u;
	const extendsOnRight = packageToken ? /[A-Za-z0-9_./-]/u : /[A-Za-z0-9_$]/u;
	return (
		(previous === undefined || !extendsOnLeft.test(previous)) &&
		(next === undefined || !extendsOnRight.test(next))
	);
}

function isException(
	repositoryPath: string,
	source: string,
	match: TextMatch,
	usage: Map<string, number>
): boolean {
	for (const exception of exceptions) {
		if (exception.path !== repositoryPath) continue;
		let from = 0;
		while (from <= source.length - exception.token.length) {
			const tokenStart = source.indexOf(exception.token, from);
			if (tokenStart === -1) break;
			const tokenEnd = tokenStart + exception.token.length;
			if (
				hasExactExceptionTokenBoundaries(source, tokenStart, exception.token) &&
				match.index >= tokenStart &&
				match.index + match.length <= tokenEnd
			) {
				usage.set(exception.id, (usage.get(exception.id) ?? 0) + 1);
				return true;
			}
			from = tokenStart + 1;
		}
	}
	return false;
}

function lineAndColumn(
	source: string,
	index: number
): { readonly line: number; readonly column: number } {
	const prefix = source.slice(0, index);
	const lines = prefix.split('\n');
	return { line: lines.length, column: lines.at(-1)!.length + 1 };
}

async function readTrackedBytes(filePath: string): Promise<Buffer | null> {
	const status = await lstat(filePath);
	if (status.isSymbolicLink()) return Buffer.from(await readlink(filePath));
	if (!status.isFile()) return null;
	return readFile(filePath);
}

function compareViolations(
	left: AmericanEnglishViolation,
	right: AmericanEnglishViolation
): number {
	return (
		left.path.localeCompare(right.path) ||
		left.kind.localeCompare(right.kind) ||
		(left.line ?? -1) - (right.line ?? -1) ||
		(left.column ?? -1) - (right.column ?? -1) ||
		left.ruleId.localeCompare(right.ruleId)
	);
}

function collectTrackedPathViolations(
	trackedPaths: readonly string[],
	usage: Map<string, number>
): AmericanEnglishViolation[] {
	const violations: AmericanEnglishViolation[] = [];
	for (const repositoryPath of trackedPaths) {
		for (const match of findMatches(repositoryPath)) {
			if (isException(repositoryPath, repositoryPath, match, usage)) continue;
			violations.push({
				kind: 'path',
				ruleId: match.ruleId,
				found: match.found,
				recommended: match.recommended,
				path: repositoryPath,
				line: null,
				column: null
			});
		}
	}
	return violations;
}

export function auditTrackedPaths(
	trackedPaths: readonly string[]
): readonly AmericanEnglishViolation[] {
	return collectTrackedPathViolations(trackedPaths, new Map()).sort(compareViolations);
}

async function audit(repositoryRoot: string): Promise<{
	readonly violations: readonly AmericanEnglishViolation[];
	readonly usage: ReadonlyMap<string, number>;
}> {
	const trackedPaths = splitNul(await runGit(repositoryRoot, ['ls-files', '-z']));
	const usage = new Map<string, number>();
	const violations = collectTrackedPathViolations(trackedPaths, usage);

	const pathInput = Buffer.from(`${trackedPaths.join('\0')}\0`);
	const attributeFields = splitNul(
		await runGit(repositoryRoot, ['check-attr', '-z', '--stdin', 'text'], pathInput)
	);
	if (attributeFields.length !== trackedPaths.length * 3) {
		throw new Error('Unexpected output from git check-attr');
	}
	const textAttributes = new Map<string, string>();
	for (let index = 0; index < attributeFields.length; index += 3) {
		textAttributes.set(attributeFields[index]!, attributeFields[index + 2]!);
	}

	for (const repositoryPath of trackedPaths) {
		const bytes = await readTrackedBytes(path.join(repositoryRoot, ...repositoryPath.split('/')));
		if (bytes === null) continue;
		const attribute = textAttributes.get(repositoryPath);
		const isText =
			attribute === 'set' || (attribute !== 'unset' && !bytes.subarray(0, 8_000).includes(0));
		if (!isText) continue;
		const source = bytes.toString('utf8');
		for (const match of findMatches(source)) {
			if (isException(repositoryPath, source, match, usage)) continue;
			const position = lineAndColumn(source, match.index);
			violations.push({
				kind: 'content',
				ruleId: match.ruleId,
				found: match.found,
				recommended: match.recommended,
				path: repositoryPath,
				line: position.line,
				column: position.column
			});
		}
	}
	return { violations: violations.sort(compareViolations), usage };
}

export async function auditTrackedTree(
	repositoryRoot = process.cwd()
): Promise<readonly AmericanEnglishViolation[]> {
	return (await audit(path.resolve(repositoryRoot))).violations;
}

export async function auditTrackedTreeReport(
	repositoryRoot = process.cwd()
): Promise<AmericanEnglishAuditReport> {
	const root = path.resolve(repositoryRoot);
	const { violations, usage } = await audit(root);
	const byRule = Object.fromEntries(
		AMERICAN_ENGLISH_RULE_IDS.map((ruleId) => [ruleId, 0])
	) as Record<AmericanEnglishRuleId, number>;
	const byRoot: Record<string, number> = {};
	let content = 0;
	let pathCount = 0;
	for (const violation of violations) {
		byRule[violation.ruleId] += 1;
		const repositoryArea = violation.path.includes('/') ? violation.path.split('/')[0]! : '(root)';
		byRoot[repositoryArea] = (byRoot[repositoryArea] ?? 0) + 1;
		if (violation.kind === 'content') content += 1;
		else pathCount += 1;
	}
	return {
		head: (await runGit(root, ['rev-parse', 'HEAD'])).toString('utf8').trim(),
		counts: {
			total: violations.length,
			content,
			path: pathCount,
			byRule,
			byRoot: Object.fromEntries(
				Object.entries(byRoot).sort(([left], [right]) => left.localeCompare(right))
			)
		},
		violations,
		exceptionsUsed: exceptions
			.filter(({ id }) => usage.has(id))
			.map((exception) => ({ ...exception, occurrences: usage.get(exception.id)! }))
	};
}
