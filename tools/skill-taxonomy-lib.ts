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
};

export type SkillMigrationLedger = {
	schemaVersion: 'summonlab-skill-taxonomy-migration-v2';
	sourceRowCount: 520;
	records: SkillMigrationRecord[];
};

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

export function validateLegacyInventory(rows: readonly LegacySkillRow[]): string[] {
	const errors: string[] = [];
	const sourceIds = new Set<string>();

	for (const row of rows) {
		if (sourceIds.has(row.sourceId)) errors.push(`duplicate source id ${row.sourceId}`);
		sourceIds.add(row.sourceId);
	}

	return errors;
}

export function validateMigrationLedger(ledger: SkillMigrationLedger): string[] {
	const errors: string[] = [];
	const sourceIds = new Set<string>();

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

	return errors;
}
