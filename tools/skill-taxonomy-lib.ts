import path from 'node:path';

export type SkillDomain = 'Martial' | 'Magical' | 'Craft';
export type SkillDisposition = 'retain' | 'rename' | 'rehome' | 'merge' | 'delete';
export type SkillLabel = { namespace: 'Equipment' | 'Element'; value: string };
export type SkillMarkdownFile = { sourcePath: string; source: string };

export type LegacySkillRow = {
	sourceId: string;
	sourcePath: string;
	section: string;
	row: number;
	name: string;
	rarity: string;
	type: string;
	requires: string;
	effect: string;
};

export type SkillMigrationRecord = LegacySkillRow & {
	disposition: SkillDisposition | 'unmapped';
	target?: {
		domain: SkillDomain;
		family: string;
		skill: string;
		labels?: SkillLabel[];
	};
	mergeTarget?: string;
	rationale?: string;
	replacementRequires?: string;
	replacementEffect?: string;
};

export type SkillMigrationLedger = {
	schemaVersion: 'summonlab-skill-taxonomy-migration-v2';
	sourceRowCount: 520;
	records: SkillMigrationRecord[];
};

export type TargetSkillRow = {
	targetId: string;
	domain: SkillDomain;
	family: string;
	name: string;
	labels: SkillLabel[];
	rarity: string;
	type: string;
	requires: string;
	effect: string;
};

const DOMAIN_FAMILIES: Record<SkillDomain, ReadonlySet<string>> = {
	Martial: new Set(['Blade', 'Body', 'Polearm', 'Ranged', 'Shield']),
	Magical: new Set(['Elemental', 'Enchantment', 'Mind', 'Restoration', 'Ward']),
	Craft: new Set(['Alchemy', 'Beast', 'Cooking', 'Forging', 'Gathering', 'Lore'])
};

const EQUIPMENT_LABELS = new Set([
	'Sword',
	'Dagger',
	'Greatsword',
	'Spear',
	'Glaive',
	'Halberd',
	'Polehammer',
	'Bow',
	'Crossbow',
	'Sling',
	'Unarmed'
]);
const ELEMENT_LABELS = new Set(['Fire', 'Water', 'Wood', 'Earth', 'Metal', 'Attuned']);

const FORBIDDEN_SKILL_REFERENCES = [
	'skills.martial-universal',
	'skills.martial-haft-fist',
	'skills.martial-hunt-guard-motion',
	'skills.magical-evocation',
	'martial-universal.md',
	'martial-haft-and-fist.md',
	'martial-hunt-guard-motion.md',
	'magical-evocation.md',
	'/wiki/mechanics/skills/martial-universal',
	'/wiki/mechanics/skills/martial-haft-and-fist',
	'/wiki/mechanics/skills/martial-hunt-guard-motion',
	'/wiki/mechanics/skills/magical-evocation',
	'Universal Martial',
	'Fire Evocation',
	'## Paired Blades',
	'## Thrown — Hunt',
	'## Fist — Unarmed and Grappling'
] as const;

export function findForbiddenSkillReferences(files: readonly SkillMarkdownFile[]): string[] {
	return files.flatMap(({ sourcePath, source }) =>
		FORBIDDEN_SKILL_REFERENCES.filter((reference) => source.includes(reference)).map(
			(reference) => `${sourcePath}: ${reference}`
		)
	);
}

function slugSection(section: string): string {
	return section
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, '-')
		.replace(/^-|-$/gu, '');
}

function tableCells(line: string): string[] {
	return line
		.trim()
		.split('|')
		.slice(1, -1)
		.map((cell) => cell.trim());
}

export function parseSkillMarkdown(sourcePath: string, source: string): LegacySkillRow[] {
	const rows: LegacySkillRow[] = [];
	let section: string | undefined;
	const basename = path.basename(sourcePath);

	for (const line of source.split(/\r?\n/u)) {
		const heading = /^##\s+(.+?)\s*$/u.exec(line);
		if (heading) {
			section = heading[1];
			continue;
		}

		if (!section || !line.trimStart().startsWith('|')) continue;
		const cells = tableCells(line);
		const rowNumber = /^(\d+)$/u.exec(cells[0] ?? '');
		const skill = /^\*\*(.+?)\*\*(?:\s+.*)?$/u.exec(cells[1] ?? '');
		if (!rowNumber || !skill || cells.length !== 6) continue;

		const row = Number(rowNumber[1]);
		rows.push({
			sourceId: `${basename}#${slugSection(section)}:${row}`,
			sourcePath,
			section,
			row,
			name: skill[1].trim(),
			rarity: cells[2] ?? '',
			type: cells[3] ?? '',
			requires: cells[4] ?? '',
			effect: cells[5] ?? ''
		});
	}

	return rows;
}

export function parseLegacySkillRows(files: readonly SkillMarkdownFile[]): LegacySkillRow[] {
	return files.flatMap(({ sourcePath, source }) => parseSkillMarkdown(sourcePath, source));
}

export function parseTargetSkillRows(files: readonly SkillMarkdownFile[]): TargetSkillRow[] {
	return files.flatMap(({ sourcePath, source }) => {
		if (/^Subfamily:/imu.test(source) || /^#{2,}\s+Subfamily\b/imu.test(source))
			throw new Error(`${sourcePath} declares a forbidden subfamily`);
		const domainMatch = /^Domain:\s+\*\*(Martial|Magical|Craft)\*\*\s*$/mu.exec(source);
		if (!domainMatch) throw new Error(`${sourcePath} requires Domain metadata`);
		const domain = domainMatch[1] as SkillDomain;
		const pageFamily = /^Family:\s+\*\*(.+?)\*\*\s*$/mu.exec(source)?.[1];
		if (/^#{3,}\s+/mu.test(source) || (pageFamily !== undefined && /^##\s+/mu.test(source)))
			throw new Error(`${sourcePath} declares a forbidden subfamily`);
		const rows: TargetSkillRow[] = [];
		let section: string | undefined;
		let columns: string[] | undefined;

		for (const line of source.split(/\r?\n/u)) {
			const heading = /^##\s+(.+?)\s*$/u.exec(line);
			if (heading) {
				section = heading[1];
				columns = undefined;
				continue;
			}

			if (!line.trimStart().startsWith('|')) {
				columns = undefined;
				continue;
			}

			const cells = tableCells(line);
			if (cells[0] === '#' && cells[1] === 'Skill') {
				columns = cells;
				continue;
			}
			if (!columns || !/^\d+$/u.test(cells[0] ?? '')) continue;

			const name = /^\*\*(.+?)\*\*(?:\s+.*)?$/u.exec(cells[1] ?? '')?.[1]?.trim();
			if (!name) continue;
			const family = pageFamily ?? section;
			if (!family) throw new Error(`${sourcePath} requires Family metadata or a family heading`);
			const cell = (column: string) => cells[columns?.indexOf(column) ?? -1] ?? '';
			const labelColumn = columns.includes('Equipment')
				? 'Equipment'
				: columns.includes('Element')
					? 'Element'
					: undefined;
			const labelCell = labelColumn ? cell(labelColumn) : '—';
			const labels =
				labelCell === '—' || labelCell === ''
					? []
					: labelCell.split(',').map((value) => ({
							namespace: labelColumn as SkillLabel['namespace'],
							value: value.trim()
						}));

			rows.push({
				targetId: `${domain.toLowerCase()}:${slugSection(family)}:${slugSection(name)}`,
				domain,
				family,
				name,
				labels,
				rarity: cell('R'),
				type: cell('T'),
				requires: cell('Requires'),
				effect: cell('Effect')
			});
		}

		return rows;
	});
}

function targetKey(domain: SkillDomain, family: string, skill: string): string {
	return `${domain}/${family}/${skill}`;
}

function sortedLabels(labels: readonly SkillLabel[] | undefined): string[] {
	return (labels ?? []).map(({ namespace, value }) => `${namespace}:${value}`).sort();
}

export function validateTargetTaxonomy(
	rows: readonly TargetSkillRow[],
	ledger: SkillMigrationLedger
): string[] {
	const errors: string[] = [];
	const rowsByKey = new Map<string, TargetSkillRow>();
	const targetIds = new Set<string>();

	for (const row of rows) {
		if (targetIds.has(row.targetId)) errors.push(`duplicate target id ${row.targetId}`);
		targetIds.add(row.targetId);
		rowsByKey.set(targetKey(row.domain, row.family, row.name), row);

		if (!DOMAIN_FAMILIES[row.domain].has(row.family))
			errors.push(`unknown ${row.domain} family ${row.family}`);
		if (row.name === 'Two Blades' && row.family !== 'Blade')
			errors.push('Two Blades must belong to Martial/Blade');
		const elementLabels = row.labels.filter((label) => label.namespace === 'Element');
		if (elementLabels.length > 1)
			errors.push(
				`${targetKey(row.domain, row.family, row.name)} accepts at most one Element label`
			);
		if (
			row.domain === 'Magical' &&
			row.family === 'Elemental' &&
			(elementLabels.length !== 1 || elementLabels[0]?.value === 'Attuned')
		)
			errors.push(
				`${targetKey(row.domain, row.family, row.name)} requires exactly one concrete Element label`
			);

		for (const label of row.labels) {
			if (label.namespace === 'Equipment') {
				if (label.value === 'Two Blades') errors.push('Equipment label Two Blades is forbidden');
				else if (row.domain !== 'Martial')
					errors.push(`Equipment label is invalid for ${row.domain}/${row.family}/${row.name}`);
				else if (!EQUIPMENT_LABELS.has(label.value))
					errors.push(`unknown Equipment label ${label.value}`);
			} else {
				if (row.domain !== 'Magical')
					errors.push(`Element label is invalid for ${row.domain}/${row.family}/${row.name}`);
				else if (!ELEMENT_LABELS.has(label.value))
					errors.push(`unknown Element label ${label.value}`);
			}
		}
	}

	const lineageKeys = new Set<string>();
	const mergeTargets = new Set<string>();
	for (const record of ledger.records) {
		if (record.disposition === 'delete') continue;
		if (record.disposition === 'merge') {
			if (!record.mergeTarget) continue;
			mergeTargets.add(record.mergeTarget);
			if (!rows.some((row) => row.name === record.mergeTarget))
				errors.push(`${record.sourceId} merges into missing ${record.mergeTarget}`);
			continue;
		}
		if (!record.target) {
			errors.push(`${record.sourceId} has no target`);
			continue;
		}

		const key = targetKey(record.target.domain, record.target.family, record.target.skill);
		const row = rowsByKey.get(key);
		lineageKeys.add(key);
		if (!row) {
			errors.push(`${record.sourceId} targets missing ${key}`);
			continue;
		}
		if (sortedLabels(row.labels).join('|') !== sortedLabels(record.target.labels).join('|'))
			errors.push(`${record.sourceId} labels do not match ${key}`);

		const expectedFields = {
			rarity: record.rarity,
			type: record.type,
			requires: record.replacementRequires ?? record.requires,
			effect: record.replacementEffect ?? record.effect
		};
		for (const field of ['rarity', 'type', 'requires', 'effect'] as const) {
			if (row[field] !== expectedFields[field])
				errors.push(
					`${field} mismatch for ${key}: expected ${expectedFields[field]}, found ${row[field]}`
				);
		}
	}

	for (const row of rows) {
		const key = targetKey(row.domain, row.family, row.name);
		if (!lineageKeys.has(key) && !mergeTargets.has(row.name))
			errors.push(`${key} has no legacy lineage`);
	}

	return errors;
}

export function validateLegacyInventory(rows: readonly LegacySkillRow[]): string[] {
	const errors: string[] = [];
	const sourceIds = new Set<string>();

	for (const row of rows) {
		if (sourceIds.has(row.sourceId)) errors.push(`duplicate source id ${row.sourceId}`);
		sourceIds.add(row.sourceId);
	}

	return errors;
}

export function validateMigrationLedger(
	ledger: SkillMigrationLedger,
	legacyInventory?: readonly LegacySkillRow[]
): string[] {
	const errors: string[] = [];
	const sourceIds = new Set<string>();

	if (ledger.sourceRowCount !== 520)
		errors.push(`expected source row count 520, found ${ledger.sourceRowCount}`);
	if (ledger.records.length !== 520)
		errors.push(`expected 520 ledger records, found ${ledger.records.length}`);
	if (ledger.records.length !== ledger.sourceRowCount)
		errors.push(
			`source row count ${ledger.sourceRowCount} does not match ${ledger.records.length} ledger records`
		);

	for (const record of ledger.records) {
		if (sourceIds.has(record.sourceId)) errors.push(`duplicate source id ${record.sourceId}`);
		sourceIds.add(record.sourceId);

		if (record.disposition === 'unmapped') errors.push(`${record.sourceId} is unmapped`);
		if (['retain', 'rename', 'rehome'].includes(record.disposition) && record.target === undefined)
			errors.push(`${record.disposition} record ${record.sourceId} requires target`);
		if (record.disposition === 'merge' && !record.mergeTarget)
			errors.push(`merge record ${record.sourceId} requires mergeTarget`);
		if (record.disposition === 'delete' && !record.rationale)
			errors.push(`delete record ${record.sourceId} requires rationale`);
	}

	if (legacyInventory) {
		if (legacyInventory.length !== 520)
			errors.push(`expected 520 legacy inventory records, found ${legacyInventory.length}`);
		errors.push(...validateLegacyInventory(legacyInventory));
		const inventorySourceIds = new Set(legacyInventory.map((row) => row.sourceId));
		for (const sourceId of inventorySourceIds) {
			if (!sourceIds.has(sourceId)) errors.push(`missing source id ${sourceId}`);
		}
		for (const sourceId of sourceIds) {
			if (!inventorySourceIds.has(sourceId)) errors.push(`unknown source id ${sourceId}`);
		}
	}

	return errors;
}
