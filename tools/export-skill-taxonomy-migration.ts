import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	parseLegacySkillRows,
	LEGACY_SKILL_INVENTORY_V1_SHA256,
	validateLegacyInventory,
	type LegacySkillRow,
	type SkillMarkdownFile,
	type SkillMigrationRecord,
	type SkillMigrationLedger
} from './skill-taxonomy-lib.js';

export const LEGACY_SKILL_SOURCE_PATHS = [
	'docs/wiki/mechanics/skills/martial-blade.md',
	'docs/wiki/mechanics/skills/martial-haft-and-fist.md',
	'docs/wiki/mechanics/skills/martial-hunt-guard-motion.md',
	'docs/wiki/mechanics/skills/martial-universal.md',
	'docs/wiki/mechanics/skills/magical-evocation.md',
	'docs/wiki/mechanics/skills/magical-disciplines.md',
	'docs/wiki/mechanics/skills/craft-and-life.md'
] as const;

export const LEGACY_SKILL_INVENTORY_V1_PATH =
	'docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json';
export const SKILL_MIGRATION_V2_PATH = 'docs/wiki/mechanics/skills/migration-v2.json';

export type SkillTaxonomyExportMode = 'check' | 'write' | 'write-inventory';

function jsonText(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

function compareRows(left: LegacySkillRow, right: LegacySkillRow): number {
	return (
		left.sourcePath.localeCompare(right.sourcePath) ||
		left.section.localeCompare(right.section) ||
		left.row - right.row
	);
}

async function readLegacyCatalog(workspaceRoot: string): Promise<SkillMarkdownFile[]> {
	return Promise.all(
		LEGACY_SKILL_SOURCE_PATHS.map(async (sourcePath) => ({
			sourcePath,
			source: await readFile(path.resolve(workspaceRoot, sourcePath), 'utf8')
		}))
	);
}

async function readInventory(workspaceRoot: string): Promise<LegacySkillRow[]> {
	const inventoryPath = path.resolve(workspaceRoot, LEGACY_SKILL_INVENTORY_V1_PATH);
	const source = await readFile(inventoryPath, 'utf8');
	const digest = createHash('sha256').update(source).digest('hex');
	if (digest !== LEGACY_SKILL_INVENTORY_V1_SHA256)
		throw new Error(
			`legacy inventory SHA-256 mismatch: expected ${LEGACY_SKILL_INVENTORY_V1_SHA256}, found ${digest}`
		);
	const parsed = JSON.parse(source) as unknown;
	if (!Array.isArray(parsed)) throw new Error('Legacy skill inventory must be a JSON array');
	return parsed as LegacySkillRow[];
}

const SECTION_TARGETS = {
	Sword: ['Martial', 'Blade', 'Sword'],
	Dagger: ['Martial', 'Blade', 'Dagger'],
	Greatsword: ['Martial', 'Blade', 'Greatsword'],
	'Paired Blades': ['Martial', 'Blade', undefined],
	Spear: ['Martial', 'Polearm', 'Spear'],
	Axe: ['Martial', 'Polearm', 'Halberd'],
	Hammer: ['Martial', 'Polearm', 'Polehammer'],
	Bow: ['Martial', 'Ranged', 'Bow'],
	Crossbow: ['Martial', 'Ranged', 'Crossbow'],
	Shield: ['Martial', 'Shield', undefined],
	Unarmed: ['Martial', 'Body', 'Unarmed'],
	Grappling: ['Martial', 'Body', undefined],
	Motion: ['Martial', 'Body', undefined],
	'Universal Martial': ['Martial', 'Body', undefined],
	'Evocation — Fire': ['Magical', 'Elemental', 'Fire'],
	'Evocation — Water': ['Magical', 'Elemental', 'Water'],
	'Evocation — Wood': ['Magical', 'Elemental', 'Wood'],
	'Evocation — Earth': ['Magical', 'Elemental', 'Earth'],
	'Evocation — Metal': ['Magical', 'Elemental', 'Metal']
} as const;

const DIRECT_FAMILIES = new Set([
	'Ward',
	'Enchantment',
	'Restoration',
	'Mind',
	'Forging',
	'Alchemy',
	'Cooking',
	'Gathering'
]);

const TRACKING_DELETE_RATIONALE = 'Tracking ladder removed by approved taxonomy';
const THROWN_DELETE_RATIONALE = 'Generic Thrown ladder removed by approved taxonomy';
const EQUIPMENT_PROGRESSION_DELETE_RATIONALE = 'Equipment progression removed by approved taxonomy';

function targetForSection(row: LegacySkillRow): NonNullable<SkillMigrationRecord['target']> {
	const sectionTarget = SECTION_TARGETS[row.section as keyof typeof SECTION_TARGETS];
	if (sectionTarget) {
		const [domain, family, labelValue] = sectionTarget;
		return {
			domain,
			family,
			skill: row.name,
			...(labelValue === undefined
				? {}
				: {
						labels: [
							{
								namespace: domain === 'Martial' ? 'Equipment' : 'Element',
								value: labelValue
							}
						]
					})
		};
	}

	if (!DIRECT_FAMILIES.has(row.section))
		throw new Error(`No migration target configured for section ${row.section}`);

	return {
		domain: ['Ward', 'Enchantment', 'Restoration', 'Mind'].includes(row.section)
			? 'Magical'
			: 'Craft',
		family: row.section,
		skill: row.name
	};
}

function mapRow(row: LegacySkillRow): SkillMigrationRecord {
	const source = `${row.section}:${row.name}`;

	if (row.section === 'Tracking')
		return { ...row, disposition: 'delete', rationale: TRACKING_DELETE_RATIONALE };

	if (
		['Throwing', 'Hurl', 'Bandolier', 'Impact Sense', 'Everything Is a Weapon'].includes(row.name)
	)
		return { ...row, disposition: 'delete', rationale: THROWN_DELETE_RATIONALE };

	if (source === 'Axe:Throwing Axe')
		return {
			...row,
			disposition: 'delete',
			rationale: 'Short throwing axe is not a Polearm technique in the approved taxonomy'
		};

	if (row.section === 'Protection') {
		if (['Armour Training', 'Heavy Bearing', 'Fortress', 'Second Skin'].includes(row.name))
			return { ...row, disposition: 'delete', rationale: EQUIPMENT_PROGRESSION_DELETE_RATIONALE };
		if (row.name === 'Punishment')
			return {
				...row,
				disposition: 'merge',
				mergeTarget: { domain: 'Martial', family: 'Shield', skill: 'Retaliation Ward' }
			};
		if (row.name === 'Bulwark of the Line')
			return {
				...row,
				disposition: 'merge',
				mergeTarget: { domain: 'Martial', family: 'Shield', skill: 'Phalanx' }
			};
		if (row.name === 'They Shall Not Pass')
			return {
				...row,
				disposition: 'merge',
				mergeTarget: { domain: 'Martial', family: 'Shield', skill: 'The Last Wall' }
			};
		if (['Taunt', 'Draw Attention', 'Endure'].includes(row.name))
			return {
				...row,
				disposition: 'rehome',
				target: { domain: 'Martial', family: 'Shield', skill: row.name },
				...(['Taunt', 'Endure'].includes(row.name)
					? { replacementRequires: 'Shield Use Novice' }
					: {})
			};
		if (['Set Jaw', 'Undying'].includes(row.name))
			return {
				...row,
				disposition: 'rehome',
				target: { domain: 'Martial', family: 'Body', skill: row.name }
			};
	}

	if (source === 'Spear:Polearm Handling')
		return {
			...row,
			disposition: 'rehome',
			target: { domain: 'Martial', family: 'Polearm', skill: row.name },
			replacementRequires: 'Hold compatible Polearm equipment',
			replacementEffect: 'Damage and reach bonus with long-shafted melee weapons. **Foundation.**'
		};

	if (['Spear:Butt Strike', 'Spear:Keep Away'].includes(source))
		return {
			...row,
			disposition: 'rehome',
			target: { domain: 'Martial', family: 'Polearm', skill: row.name }
		};

	const spearEquipment: Record<string, string[]> = {
		'Spear:Sweep Low': ['Spear', 'Glaive', 'Halberd'],
		'Spear:Piercing Line': ['Spear', 'Halberd'],
		'Spear:Hook and Pull': ['Glaive', 'Halberd'],
		'Spear:Dragon Tail': ['Spear', 'Glaive', 'Halberd']
	};
	if (source in spearEquipment)
		return {
			...row,
			disposition: 'rehome',
			target: {
				domain: 'Martial',
				family: 'Polearm',
				skill: row.name,
				labels: spearEquipment[source].map((value) => ({
					namespace: 'Equipment' as const,
					value
				}))
			}
		};

	if (source === 'Axe:Axework')
		return {
			...row,
			disposition: 'rename',
			target: {
				domain: 'Martial',
				family: 'Polearm',
				skill: 'Halberd Handling',
				labels: [{ namespace: 'Equipment', value: 'Halberd' }]
			},
			replacementRequires: 'Hold a halberd',
			replacementEffect: 'Damage bonus with halberds; small armour-shred chance. **Foundation.**'
		};

	const halberdPrerequisites: Record<string, string> = {
		'Axe:Chop': 'Halberd Handling Novice',
		'Axe:Hook Shield': 'Halberd Handling Novice',
		'Axe:Split Grip': 'Halberd Handling Intermediate'
	};
	if (source in halberdPrerequisites)
		return {
			...row,
			disposition: 'rehome',
			target: targetForSection(row),
			replacementRequires: halberdPrerequisites[source]
		};

	if (source === 'Axe:Bloodletting')
		return {
			...row,
			disposition: 'rehome',
			target: targetForSection(row),
			replacementRequires: '10,000 halberd hits',
			replacementEffect: 'Halberd damage causes bleeding without any affinity'
		};

	if (source === 'Hammer:Hammerwork')
		return {
			...row,
			disposition: 'rename',
			target: {
				domain: 'Martial',
				family: 'Polearm',
				skill: 'Polehammer Handling',
				labels: [{ namespace: 'Equipment', value: 'Polehammer' }]
			},
			replacementRequires: 'Might threshold, hold a polehammer',
			replacementEffect: 'Damage and poise-damage bonus with polehammers. **Foundation.**'
		};

	const polehammerPrerequisites: Record<string, string> = {
		'Hammer:Crush': 'Polehammer Handling Novice',
		'Hammer:Knee Breaker': 'Polehammer Handling Novice',
		'Hammer:Heavy Footing': 'Polehammer Handling Intermediate'
	};
	if (source in polehammerPrerequisites)
		return {
			...row,
			disposition: 'rehome',
			target: targetForSection(row),
			replacementRequires: polehammerPrerequisites[source]
		};

	if (source === 'Hammer:Bell Ringer')
		return {
			...row,
			disposition: 'rehome',
			target: targetForSection(row),
			replacementRequires: 'Concussive Blow Master, 10,000 polehammer hits',
			replacementEffect: 'Every fourth polehammer hit dazes automatically'
		};

	if (source === 'Paired Blades:Two-Hand Fighting')
		return {
			...row,
			disposition: 'rename',
			target: { domain: 'Martial', family: 'Blade', skill: 'Two Blades' },
			replacementRequires: 'Equip two compatible Blade-family weapons',
			replacementEffect:
				'Enables coordinated two-blade techniques. **Foundation for the two-blade branch.**'
		};

	if (row.section === 'Paired Blades')
		return {
			...row,
			disposition: 'rehome',
			target: targetForSection(row),
			...(row.requires.includes('Two-Hand Fighting')
				? { replacementRequires: row.requires.replace('Two-Hand Fighting', 'Two Blades') }
				: {})
		};

	if (source === 'Dagger:Throwing Blade')
		return {
			...row,
			disposition: 'rename',
			target: {
				domain: 'Martial',
				family: 'Blade',
				skill: 'Blade Throw',
				labels: [{ namespace: 'Equipment', value: 'Dagger' }]
			}
		};

	if (source === 'Dagger:Hundred Needles')
		return {
			...row,
			disposition: 'rehome',
			target: targetForSection(row),
			replacementRequires: 'Blade Throw Master'
		};

	if (source === 'Dagger:Fleeting Step')
		return {
			...row,
			disposition: 'rehome',
			target: targetForSection(row),
			replacementRequires: 'Silent Step Expert'
		};

	if (source === 'Sword:Formless Blade')
		return {
			...row,
			disposition: 'rehome',
			target: targetForSection(row),
			replacementRequires:
				'Swordsmanship Master, Knifework Expert, Great Blade Expert, Two Blades Expert'
		};

	if (source === "Bow:Hunter's Mark")
		return {
			...row,
			disposition: 'rehome',
			target: targetForSection(row),
			replacementRequires: 'Archery Intermediate'
		};

	if (source === 'Grappling:Bind the Beast')
		return {
			...row,
			disposition: 'rehome',
			target: targetForSection(row),
			replacementRequires: 'Immovable Grip Master, Animal Handling Expert'
		};

	if (source === 'Beast:Animal Handling')
		return {
			...row,
			disposition: 'rehome',
			target: { domain: 'Craft', family: 'Gathering', skill: row.name },
			replacementEffect:
				'Animals do not flee or attack on sight; can calm hostile beasts and build trust through feeding. **Foundation.**'
		};

	if (['Beast:Calm', 'Beast:Feed'].includes(source))
		return {
			...row,
			disposition: 'merge',
			mergeTarget: { domain: 'Craft', family: 'Gathering', skill: 'Animal Handling' },
			rationale: 'Consolidated into Animal Handling by the approved creature acquisition ladder'
		};

	if (source === 'Beast:Riding')
		return {
			...row,
			disposition: 'rehome',
			target: { domain: 'Martial', family: 'Body', skill: row.name }
		};

	if (source === 'Beast:Taming')
		return {
			...row,
			disposition: 'rehome',
			target: { domain: 'Craft', family: 'Gathering', skill: row.name },
			replacementRequires: 'Animal Handling Master'
		};

	if (source === 'Beast:Beast Speech')
		return {
			...row,
			disposition: 'delete',
			rationale: 'Beast Speech is removed by the approved active taxonomy revision'
		};

	if (source === 'Beast:Pack Bond')
		return {
			...row,
			disposition: 'rehome',
			target: { domain: 'Martial', family: 'Body', skill: row.name },
			replacementEffect:
				"Commands several tamed companions to coordinate attacks on the hero's behalf."
		};

	if (source === 'Beast:Mounted Combat')
		return {
			...row,
			disposition: 'rehome',
			target: { domain: 'Martial', family: 'Body', skill: row.name },
			replacementRequires: 'Riding Master, another Martial skill at Expert'
		};

	if (source === 'Beast:Breeding' || source === 'Beast:Monarch of Beasts')
		return {
			...row,
			disposition: 'rehome',
			target: { domain: 'Craft', family: 'Gathering', skill: row.name }
		};

	if (source === 'Beast:Greater Taming')
		return {
			...row,
			disposition: 'rehome',
			target: { domain: 'Craft', family: 'Gathering', skill: row.name },
			replacementRequires: 'Taming Master, Rank III'
		};

	if (source === 'Beast:Bonded Mount')
		return {
			...row,
			disposition: 'rehome',
			target: { domain: 'Martial', family: 'Body', skill: row.name }
		};

	if (row.section === 'Lore')
		return {
			...row,
			disposition: 'rename',
			target: { domain: 'Craft', family: 'Knowledge', skill: row.name }
		};

	if (source === "Alchemy:Philosopher's Work")
		return {
			...row,
			disposition: 'retain',
			target: targetForSection(row),
			replacementRequires: 'Transmutation Master, Research Expert'
		};

	if (source === 'Cooking:Monster Cuisine')
		return {
			...row,
			disposition: 'retain',
			target: targetForSection(row),
			replacementRequires: 'Butchery Master, Animal Handling Expert'
		};

	if (source === 'Forging:Runic Foundation')
		return {
			...row,
			disposition: 'retain',
			target: targetForSection(row),
			replacementRequires: 'Alloying Master, Literacy Expert'
		};

	if (source === 'Forging:Monster Craft')
		return {
			...row,
			disposition: 'retain',
			target: targetForSection(row),
			replacementRequires: 'Alloying Master, Animal Handling Expert'
		};

	if (source === 'Gathering:Prospecting')
		return {
			...row,
			disposition: 'retain',
			target: targetForSection(row),
			replacementRequires: 'Mining Expert, Cartography Novice'
		};

	if (source === 'Thrown:Sling')
		return {
			...row,
			disposition: 'rehome',
			target: {
				domain: 'Martial',
				family: 'Ranged',
				skill: row.name,
				labels: [{ namespace: 'Equipment', value: 'Sling' }]
			},
			replacementRequires: 'Archery Novice'
		};

	if (source === 'Thrown:Grenade Throw')
		return {
			...row,
			disposition: 'rehome',
			target: { domain: 'Craft', family: 'Alchemy', skill: row.name },
			replacementRequires: 'Volatiles Novice'
		};

	const thrownBladePrerequisites: Record<string, string> = {
		Ricochet: 'Blade Throw Expert',
		'Fan Throw': 'Blade Throw Master, Dexterity threshold',
		'Boomerang Arc': 'Ricochet Master',
		'Storm of Steel': 'Fan Throw Master',
		'Perfect Arc': 'Boomerang Arc Master'
	};
	if (row.name in thrownBladePrerequisites)
		return {
			...row,
			disposition: 'rehome',
			target: {
				domain: 'Martial',
				family: 'Blade',
				skill: row.name,
				labels: [{ namespace: 'Equipment', value: 'Dagger' }]
			},
			replacementRequires: thrownBladePrerequisites[row.name]
		};

	if (source === 'Ward:Elemental Guard' || source === 'Ward:Counter Sigil')
		return {
			...row,
			disposition: 'retain',
			target: {
				...targetForSection(row),
				labels: [{ namespace: 'Element', value: 'Attuned' }]
			}
		};

	if (
		[
			'Enchantment:Weapon Oil',
			'Enchantment:Armour Imbuing',
			'Enchantment:Elemental Attunement'
		].includes(source)
	)
		return {
			...row,
			disposition: 'retain',
			target: {
				...targetForSection(row),
				labels: [{ namespace: 'Element', value: 'Attuned' }]
			}
		};

	return {
		...row,
		disposition: DIRECT_FAMILIES.has(row.section) ? 'retain' : 'rehome',
		target: targetForSection(row)
	};
}

function buildLedger(rows: readonly LegacySkillRow[]): SkillMigrationLedger {
	if (rows.length !== 520) throw new Error(`Expected 520 legacy skill rows, found ${rows.length}`);
	return {
		schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
		sourceInventorySha256: LEGACY_SKILL_INVENTORY_V1_SHA256,
		sourceRowCount: 520,
		records: rows.map(mapRow)
	};
}

async function writeIfDifferent(destination: string, expected: string): Promise<boolean> {
	const current = await readFile(destination, 'utf8').catch(() => null);
	if (current === expected) return false;
	await mkdir(path.dirname(destination), { recursive: true });
	await writeFile(destination, expected, 'utf8');
	return true;
}

export async function exportSkillTaxonomyMigration(options: {
	readonly workspaceRoot?: string;
	readonly mode: SkillTaxonomyExportMode;
}): Promise<{
	mode: SkillTaxonomyExportMode;
	sourceRowCount: number;
	inSync: boolean;
	written: boolean;
}> {
	const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());

	if (options.mode === 'write-inventory') {
		const rows = parseLegacySkillRows(await readLegacyCatalog(workspaceRoot)).sort(compareRows);
		const errors = validateLegacyInventory(rows);
		if (errors.length > 0) throw new Error(errors.join('\n'));
		if (rows.length !== 520)
			throw new Error(`Expected 520 legacy skill rows, found ${rows.length}`);

		const inventoryPath = path.resolve(workspaceRoot, LEGACY_SKILL_INVENTORY_V1_PATH);
		const expected = jsonText(rows);
		const current = await readFile(inventoryPath, 'utf8').catch(() => null);
		if (current !== null && current !== expected)
			throw new Error('Refusing to overwrite a non-equivalent legacy skill inventory snapshot');
		const written = current === null ? await writeIfDifferent(inventoryPath, expected) : false;
		return { mode: options.mode, sourceRowCount: rows.length, inSync: true, written };
	}

	const inventory = await readInventory(workspaceRoot);
	const errors = validateLegacyInventory(inventory);
	if (errors.length > 0) throw new Error(errors.join('\n'));
	const ledger = buildLedger(inventory);
	const expected = jsonText(ledger);
	const ledgerPath = path.resolve(workspaceRoot, SKILL_MIGRATION_V2_PATH);
	const current = await readFile(ledgerPath, 'utf8').catch(() => null);
	const inSync = current === expected;
	const written =
		options.mode === 'write' && !inSync ? await writeIfDifferent(ledgerPath, expected) : false;
	return {
		mode: options.mode,
		sourceRowCount: ledger.sourceRowCount,
		inSync: inSync || written,
		written
	};
}

function parseMode(args: readonly string[]): SkillTaxonomyExportMode {
	if (args.length !== 1 || !['--check', '--write', '--write-inventory'].includes(args[0] ?? ''))
		throw new Error(
			'Usage: tsx tools/export-skill-taxonomy-migration.ts --check|--write|--write-inventory'
		);
	return args[0].slice(2) as SkillTaxonomyExportMode;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	try {
		const report = await exportSkillTaxonomyMigration({ mode: parseMode(process.argv.slice(2)) });
		process.stdout.write(`${report.sourceRowCount} legacy skill rows\n`);
		if (!report.inSync) process.exitCode = 1;
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}
