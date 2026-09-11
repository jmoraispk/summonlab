# Skill Taxonomy Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mixed skill hierarchy with a canonical `Domain → Family → Skill [optional labels]` model across the wiki, migration evidence, Living Village fixtures, and interactive skill browser.

**Architecture:** Canonical Markdown remains the authored source, while a checked-in migration ledger records the disposition of every legacy row. A focused TypeScript validator parses the old-row inventory and the new Markdown tables, proves lineage and taxonomy invariants, and joins the existing wiki validation command. The Svelte tree consumes a small typed navigation model that mirrors family ownership and representative labels without becoming a second full catalog.

**Tech Stack:** Markdown, JSON, Node.js 24, TypeScript, `tsx`, Svelte 5, Vitest 4, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-08-31-skill-taxonomy-consolidation-design.md`

## Global Constraints

- The only canonical ownership hierarchy is `Domain → Family → Skill`.
- Every retained skill has exactly one owning family.
- Labels are optional metadata and never progression nodes.
- The only authored label namespaces in this change are `Equipment` and `Element`.
- `Two Blades` is a Blade skill, never a family, subfamily, equipment type, or label.
- Martial exposes exactly Blade, Polearm, Ranged, Shield, and Body.
- Magical exposes exactly Elemental, Ward, Enchantment, Restoration, and Mind.
- Element values are Fire, Water, Wood, Earth, Metal, and Attuned; neutral magic omits the label.
- Craft remains Forging, Alchemy, Cooking, Gathering, Beast, and Lore.
- Universal Martial, Tracking, generic Thrown, Grappling, Protection, and Paired Blades must not survive as structural nodes.
- No legacy row may disappear without an explicit retain, rename, rehome, merge, or delete disposition.
- Do not invent runtime costs, cooldowns, damage values, status rules, weapon contracts, or balance values.
- Preserve keyboard operation, reduced-motion behavior, narrow-viewport containment, and canonical Markdown below the interactive surface.

---

## Target file structure

### Migration and validation

- Create `tools/skill-taxonomy-lib.ts`: Markdown table parser, ledger types, target-table parser, and pure validation functions.
- Create `tools/skill-taxonomy-lib.spec.ts`: parser, lineage, family, label, Two Blades, and stale-structure tests.
- Create `tools/export-skill-taxonomy-migration.ts`: deterministic legacy inventory and migration-ledger writer.
- Create `tools/validate-skill-taxonomy.ts`: CLI wrapper used by `pnpm validate:wiki`.
- Create `docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json`: immutable 520-row snapshot parsed before legacy pages are removed.
- Create `docs/wiki/mechanics/skills/migration-v2.json`: checked-in source-row inventory and disposition ledger.
- Modify `package.json`: run taxonomy validation after structural wiki validation.

### Canonical skill pages

- Modify `docs/wiki/mechanics/skills/README.md`: new hierarchy, family navigation, labels, and reconciled counts.
- Modify `docs/wiki/mechanics/skills/framework.md`: remove sector/subfamily/universal rules and rewrite aptitude, ladder, coverage, and merge examples.
- Modify `docs/wiki/mechanics/skills/living-village.md`: new family names, links, labels, and deferred scope.
- Modify `docs/wiki/mechanics/skills/martial-blade.md`: one Blade family table with optional Equipment labels and Two Blades as a skill.
- Create `docs/wiki/mechanics/skills/martial-polearm.md`: consolidated Spear/Glaive/Halberd/Polehammer content.
- Create `docs/wiki/mechanics/skills/martial-ranged.md`: consolidated Bow/Crossbow content and any explicitly retained tool-owned thrown techniques.
- Create `docs/wiki/mechanics/skills/martial-shield.md`: Shield plus approved Protection merges.
- Create `docs/wiki/mechanics/skills/martial-body.md`: Universal, Unarmed, Grappling, Motion, endurance, awareness, and general combat consolidation.
- Delete `docs/wiki/mechanics/skills/martial-universal.md` after ledger coverage passes.
- Delete `docs/wiki/mechanics/skills/martial-haft-and-fist.md` after its target pages exist.
- Delete `docs/wiki/mechanics/skills/martial-hunt-guard-motion.md` after its target pages exist.
- Rename `docs/wiki/mechanics/skills/magical-evocation.md` to `docs/wiki/mechanics/skills/magical-elemental.md` and flatten element headings into one Elemental table.
- Modify `docs/wiki/mechanics/skills/magical-disciplines.md`: optional Attuned labels and neutral rows without a fabricated label.
- Modify `docs/wiki/mechanics/skills/craft-and-life.md`: terminology only; retain the six direct families and existing rows.
- Modify `docs/wiki/catalog.json`: remove old entries, register five Martial pages and Magical Elemental, and update review/status metadata.

### Cross-references and prototype fixtures

- Modify `docs/wiki/mechanics/equipment/weapons.md`: equipment labels, Two Blades skill requirement, Polearm equipment, and removal of the generic Thrown ladder.
- Modify `docs/wiki/mechanics/equipment/rarity-and-weight.md`: replace Paired Blades/Fist taxonomy names with concrete equipment or Body terminology.
- Modify `docs/wiki/mechanics/equipment/armour-and-shields.md`: replace old aptitude/family references.
- Modify `docs/wiki/mechanics/progression/skills-and-ladders.md`: mirror the canonical three-level model.
- Modify every repository-authored Markdown link reported by the migration validator.
- Modify `apps/web/src/routes/living-village-lab/summon/fixtures.ts`: migrate displayed aptitude names.
- Modify `apps/web/src/routes/living-village-lab/summon/summon.e2e.ts`: assert new aptitude labels.

### Interactive wiki

- Create `apps/web/src/lib/components/wiki/skill-tree-data.ts`: typed domain/family/representative-skill navigation data.
- Create `apps/web/src/lib/components/wiki/skill-tree-data.spec.ts`: hierarchy and label invariants.
- Modify `apps/web/src/lib/components/wiki/SkillTree.svelte`: one-path family browser with optional label chips.
- Modify `apps/web/src/routes/wiki/skill-tree.e2e.ts`: five/five/six family counts, no Universal UI, Two Blades as a skill, optional Element labels, keyboard, motion, and mobile tests.
- Modify `apps/web/src/lib/server/wiki.spec.ts`: catalog page count and renamed/removed route assertions.

---

### Task 1: Characterize the legacy catalog and create the migration ledger schema

**Files:**

- Create: `tools/skill-taxonomy-lib.ts`
- Create: `tools/skill-taxonomy-lib.spec.ts`
- Create: `tools/export-skill-taxonomy-migration.ts`
- Create: `docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json`
- Create: `docs/wiki/mechanics/skills/migration-v2.json`

**Interfaces:**

- Produces `LegacySkillRow`, `SkillDisposition`, `SkillMigrationRecord`, and `SkillMigrationLedger`.
- Produces `SkillMarkdownFile`, `parseSkillMarkdown(sourcePath, source)`,
  `parseLegacySkillRows(files)`, and `validateLegacyInventory(rows)`.
- Later tasks consume the checked-in `migration-v2.json` and `validateMigrationLedger`.

- [ ] **Step 1: Write failing parser and inventory tests**

Add these cases to `tools/skill-taxonomy-lib.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { parseSkillMarkdown, validateLegacyInventory } from './skill-taxonomy-lib.js';

describe('skill taxonomy migration inventory', () => {
	it('parses a catalog row with its page and section identity', () => {
		const rows = parseSkillMarkdown(
			'martial-blade.md',
			'## Sword\n\n| # | Skill | R | T | Requires | Effect |\n|---|---|---|---|---|---|\n| 1 | **Swordsmanship** | F | P | Hold a sword | Foundation |'
		);

		expect(rows).toEqual([
			expect.objectContaining({
				sourcePath: 'martial-blade.md',
				section: 'Sword',
				name: 'Swordsmanship',
				rarity: 'F',
				type: 'P'
			})
		]);
	});

	it('rejects duplicate source identities', () => {
		const row = {
			sourceId: 'martial-blade.md#sword:1',
			sourcePath: 'martial-blade.md',
			section: 'Sword',
			row: 1,
			name: 'Swordsmanship',
			rarity: 'F',
			type: 'P',
			requires: 'Hold a sword',
			effect: 'Foundation'
		} as const;

		expect(validateLegacyInventory([row, row])).toContain(
			'duplicate source id martial-blade.md#sword:1'
		);
	});
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run tools/skill-taxonomy-lib.spec.ts
```

Expected: FAIL because `skill-taxonomy-lib.ts` does not exist.

- [ ] **Step 3: Implement the parser and ledger types**

Define these exact public types in `tools/skill-taxonomy-lib.ts`:

```ts
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
};

export type SkillMigrationLedger = {
	schemaVersion: 'summonlab-skill-taxonomy-migration-v2';
	sourceRowCount: 520;
	records: SkillMigrationRecord[];
};

export function parseSkillMarkdown(sourcePath: string, source: string): LegacySkillRow[];
export function parseLegacySkillRows(files: readonly SkillMarkdownFile[]): LegacySkillRow[];
export function validateLegacyInventory(rows: readonly LegacySkillRow[]): string[];
```

Parse only bold skill-name table rows under `##` headings. Build `sourceId` as
`<basename>#<slugged-section>:<row-number>` so duplicate display names remain distinct.

- [ ] **Step 4: Generate the baseline inventory**

Implement `tools/export-skill-taxonomy-migration.ts` with `--write-inventory`, `--write`, and
`--check` modes. `--write-inventory` must read the seven legacy catalog files explicitly, sort by
source file/section/row, and write the immutable `legacy-skill-inventory-v1.json` snapshot. It must
refuse to overwrite an existing snapshot unless its parsed content is byte-equivalent. `--write`
must read that snapshot and initially emit every record with `disposition: "unmapped"`.

Run:

```bash
pnpm exec tsx tools/export-skill-taxonomy-migration.ts --write-inventory
pnpm exec tsx tools/export-skill-taxonomy-migration.ts --write
```

Expected: both JSON files contain exactly 520 source rows and `migration-v2.json` declares
`sourceRowCount: 520`.

- [ ] **Step 5: Run the focused test and inventory check**

Run:

```bash
pnpm exec vitest run tools/skill-taxonomy-lib.spec.ts
pnpm exec tsx tools/export-skill-taxonomy-migration.ts --check
```

Expected: PASS; check mode rebuilds the ledger from the frozen inventory and reports
`520 legacy skill rows` without depending on legacy Markdown still existing.

- [ ] **Step 6: Commit the characterization boundary**

```bash
git add tools/skill-taxonomy-lib.ts tools/skill-taxonomy-lib.spec.ts tools/export-skill-taxonomy-migration.ts docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json docs/wiki/mechanics/skills/migration-v2.json
git commit -m "test: characterize legacy skill catalog"
```

---

### Task 2: Complete and enforce the migration map

**Files:**

- Modify: `tools/skill-taxonomy-lib.ts`
- Modify: `tools/skill-taxonomy-lib.spec.ts`
- Modify: `tools/export-skill-taxonomy-migration.ts`
- Create: `tools/validate-skill-taxonomy.ts`
- Modify: `docs/wiki/mechanics/skills/migration-v2.json`
- Modify: `package.json`

**Interfaces:**

- Consumes the Task 1 ledger types and frozen legacy inventory.
- Produces `validateMigrationLedger(ledger): string[]` and the `pnpm validate:skill-taxonomy` command.
- Produces a fully mapped ledger consumed by canonical-content tasks.

- [ ] **Step 1: Add failing ledger-invariant tests**

Add tests proving:

```ts
expect(validateMigrationLedger(ledgerWithUnmappedRecord)).toContain(
	'martial-universal.md#universal-martial:1 is unmapped'
);
expect(validateMigrationLedger(ledgerWithTwoTargetsForOneSource)).toContain(
	'duplicate source id martial-blade.md#sword:1'
);
expect(validateMigrationLedger(ledgerWithMergeWithoutTarget)).toContain(
	'merge record martial-hunt-guard-motion.md#protection:8 requires mergeTarget'
);
expect(validateMigrationLedger(ledgerWithDeleteWithoutRationale)).toContain(
	'delete record martial-hunt-guard-motion.md#tracking:1 requires rationale'
);
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm exec vitest run tools/skill-taxonomy-lib.spec.ts
```

Expected: FAIL because `validateMigrationLedger` is not implemented.

- [ ] **Step 3: Encode default section ownership and explicit exceptions**

Use a total mapping function in `export-skill-taxonomy-migration.ts` over the frozen inventory.
Defaults are:

```ts
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
```

Use `Equipment` for the third value on Martial rows and `Element` for Magical rows. All Ward,
Enchantment, Restoration, Mind, and Craft sections retain their section name as the family.

Encode these explicit dispositions rather than relying on fuzzy name matching:

- Rename `Two-Hand Fighting` to `Two Blades`; rehome every other Paired Blades row to Blade and
  replace its old foundation prerequisite with Two Blades where applicable.
- Delete every Tracking row with rationale `Tracking ladder removed by approved taxonomy`.
- Delete `Throwing`, `Hurl`, `Bandolier`, `Impact Sense`, and `Everything Is a Weapon`.
- Rehome `Sling` to Ranged with `Equipment: Sling`.
- Rehome `Grenade Throw` to Alchemy with no equipment label.
- Rehome `Ricochet`, `Fan Throw`, `Boomerang Arc`, `Storm of Steel`, and `Perfect Arc` to Blade with
  `Equipment: Dagger`; rewrite their prerequisites through the retained Blade throwing technique.
- Rename `Throwing Blade` to `Blade Throw` and retain it in Blade with `Equipment: Dagger`.
- Delete `Throwing Axe`; the approved Polearm set does not classify a short throwing axe.
- Delete Protection's `Armour Training`, `Heavy Bearing`, `Fortress`, and `Second Skin` as equipment
  progression rather than family skills.
- Rehome `Taunt`, `Draw Attention`, and `Endure` to Shield.
- Rehome `Set Jaw` and `Undying` to Body.
- Merge `Punishment` into `Retaliation Ward`, `Bulwark of the Line` into `Phalanx`, and
  `They Shall Not Pass` into `The Last Wall`.
- Apply `Element: Attuned` to Ward's `Elemental Guard` and `Counter Sigil`, and Enchantment's
  `Weapon Oil`, `Armour Imbuing`, and `Elemental Attunement`.

- [ ] **Step 4: Regenerate the complete ledger**

Run:

```bash
pnpm exec tsx tools/export-skill-taxonomy-migration.ts --write
```

Expected: no `unmapped` records; each delete has a rationale; each merge has `mergeTarget`.

- [ ] **Step 5: Implement the validator CLI and package scripts**

Add:

```json
{
  "scripts": {
    "validate:skill-taxonomy": "tsx tools/validate-skill-taxonomy.ts",
    "validate:wiki": "node tools/validate-wiki.mjs && pnpm validate:skill-taxonomy"
  }
}
```

`validate-skill-taxonomy.ts` must load the ledger, call `validateMigrationLedger`, print all errors,
and exit nonzero if any exist. At this stage it validates ledger completeness only; target Markdown
reconciliation is added in Tasks 3 and 4.

- [ ] **Step 6: Run tests and validation**

Run:

```bash
pnpm exec vitest run tools/skill-taxonomy-lib.spec.ts
pnpm validate:wiki
```

Expected: PASS with 520 mapped legacy records and 98 current wiki pages.

- [ ] **Step 7: Commit the migration contract**

```bash
git add package.json tools/skill-taxonomy-lib.ts tools/skill-taxonomy-lib.spec.ts tools/export-skill-taxonomy-migration.ts tools/validate-skill-taxonomy.ts docs/wiki/mechanics/skills/migration-v2.json
git commit -m "feat: define skill taxonomy migration ledger"
```

---

### Task 3: Consolidate the Martial catalog

**Files:**

- Modify: `tools/skill-taxonomy-lib.ts`
- Modify: `tools/skill-taxonomy-lib.spec.ts`
- Modify: `tools/validate-skill-taxonomy.ts`
- Modify: `docs/wiki/mechanics/skills/martial-blade.md`
- Create: `docs/wiki/mechanics/skills/martial-polearm.md`
- Create: `docs/wiki/mechanics/skills/martial-ranged.md`
- Create: `docs/wiki/mechanics/skills/martial-shield.md`
- Create: `docs/wiki/mechanics/skills/martial-body.md`
- Delete: `docs/wiki/mechanics/skills/martial-universal.md`
- Delete: `docs/wiki/mechanics/skills/martial-haft-and-fist.md`
- Delete: `docs/wiki/mechanics/skills/martial-hunt-guard-motion.md`
- Modify: `docs/wiki/catalog.json`

**Interfaces:**

- Consumes the complete Task 2 migration ledger.
- Produces target Martial tables with columns `# | Skill | Equipment | R | T | Requires | Effect`.
- Produces `parseTargetSkillRows` and target-lineage validation used by all remaining tasks.

- [ ] **Step 1: Add failing target-taxonomy tests**

Add fixtures and assertions that:

```ts
expect(validateTargetTaxonomy(targetRows, ledger)).toEqual([]);
expect(familiesFor(targetRows, 'Martial')).toEqual([
	'Blade',
	'Body',
	'Polearm',
	'Ranged',
	'Shield'
]);
expect(labelsFor(targetRows, 'Two Blades')).toEqual([]);
expect(targetRows.find((row) => row.name === 'Two Blades')?.family).toBe('Blade');
```

Also add negative fixtures for an unknown Martial family, an `Equipment: Two Blades` label, a
retained source row with no target, and a target row with no legacy lineage.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run tools/skill-taxonomy-lib.spec.ts
```

Expected: FAIL because target parsing and reconciliation do not exist.

- [ ] **Step 3: Implement target parsing and lineage checks**

Export:

```ts
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

export function parseTargetSkillRows(files: readonly SkillMarkdownFile[]): TargetSkillRow[];
export function validateTargetTaxonomy(
	rows: readonly TargetSkillRow[],
	ledger: SkillMigrationLedger
): string[];
```

The parser derives Domain from a required page metadata line and Family from either a single-family
page metadata line or the nearest `##` heading in a grouped-family page:

```text
Domain: **Martial**
Family: **Blade**
```

Parse `Equipment` or `Element` cells as comma-separated labels; `—` means no labels. Reconciliation
must prove every non-delete/non-merge ledger target exists, every merge target exists, and every
target has at least one ledger source.

- [ ] **Step 4: Write the five Martial family pages**

Each page declares one family and uses one flat table. Example header:

```markdown
# Martial Skills — Blade

Wiki ID: `skills.martial-blade`

Domain: **Martial**
Family: **Blade**

Equipment labels narrow compatibility; `—` means any compatible Blade-family equipment.

| # | Skill | Equipment | R | T | Requires | Effect |
| ---: | --- | --- | :---: | :---: | --- | --- |
```

Use the ledger as the row checklist. Preserve rarity, type, and effect unless a rename/merge/delete
record explicitly authorizes a change. Renumber only after all target rows are present.

For Two Blades, use:

```markdown
| … | **Two Blades** | — | F | P | Equip two compatible Blade-family weapons | Enables coordinated two-blade techniques. **Foundation for the two-blade branch.** |
```

Do not add Two Blades to the Equipment column. Paired techniques require Two Blades mastery.

For Polearm, use only Spear, Glaive, Halberd, and Polehammer labels. Convert Axe rows to Halberd
only when their hook/reap/cut effect still fits; convert Hammer rows to Polehammer. Delete or rehome
exceptions exactly as recorded in the ledger.

- [ ] **Step 5: Update the wiki catalog atomically**

Remove entries `skills.martial-universal`, `skills.martial-haft-fist`, and
`skills.martial-hunt-guard-motion`. Retain `skills.martial-blade` and add:

```text
skills.martial-polearm → docs/wiki/mechanics/skills/martial-polearm.md
skills.martial-ranged  → docs/wiki/mechanics/skills/martial-ranged.md
skills.martial-shield  → docs/wiki/mechanics/skills/martial-shield.md
skills.martial-body    → docs/wiki/mechanics/skills/martial-body.md
```

Use `pageType: skill-catalog`, `owner: skill-catalog`, `designStatus: draft`,
`implementationStatus: none`, `visualStatus: brief`, and `spoilerScope: discoverable`.

- [ ] **Step 6: Enable target reconciliation and run RED-to-GREEN**

Point `validate-skill-taxonomy.ts` at the five new Martial pages and reconcile only ledger records
whose target domain is Martial. Task 4 switches the validator to all domains after Magical and Craft
carry the target metadata. Run:

```bash
pnpm exec vitest run tools/skill-taxonomy-lib.spec.ts
pnpm validate:wiki
```

Expected: PASS. Wiki count becomes 99 after three old Martial pages are removed and four new pages
are added. The migration validator reports all Martial ledger targets reconciled.

- [ ] **Step 7: Commit the Martial consolidation**

```bash
git add tools/skill-taxonomy-lib.ts tools/skill-taxonomy-lib.spec.ts tools/validate-skill-taxonomy.ts docs/wiki/catalog.json docs/wiki/mechanics/skills
git commit -m "feat: consolidate martial skill families"
```

---

### Task 4: Flatten Magical labels and rewrite the canonical framework/index

**Files:**

- Rename: `docs/wiki/mechanics/skills/magical-evocation.md` → `docs/wiki/mechanics/skills/magical-elemental.md`
- Modify: `docs/wiki/mechanics/skills/magical-elemental.md`
- Modify: `docs/wiki/mechanics/skills/magical-disciplines.md`
- Modify: `docs/wiki/mechanics/skills/craft-and-life.md`
- Modify: `docs/wiki/mechanics/skills/README.md`
- Modify: `docs/wiki/mechanics/skills/framework.md`
- Modify: `docs/wiki/mechanics/skills/living-village.md`
- Modify: `docs/wiki/catalog.json`
- Modify: `tools/skill-taxonomy-lib.spec.ts`
- Modify: `tools/validate-skill-taxonomy.ts`

**Interfaces:**

- Consumes target parsing and migration reconciliation from Task 3.
- Produces the final five/five/six family taxonomy and all Element-label invariants.

- [ ] **Step 1: Add failing Magical and global hierarchy tests**

Add assertions:

```ts
expect(familiesFor(targetRows, 'Magical')).toEqual([
	'Elemental',
	'Enchantment',
	'Mind',
	'Restoration',
	'Ward'
]);
expect(familiesFor(targetRows, 'Craft')).toEqual([
	'Alchemy',
	'Beast',
	'Cooking',
	'Forging',
	'Gathering',
	'Lore'
]);
expect(elementLabelsForFamily(targetRows, 'Elemental')).toEqual([
	'Earth',
	'Fire',
	'Metal',
	'Water',
	'Wood'
]);
expect(targetRows.find((row) => row.name === 'Shield Sigil')?.labels).toEqual([]);
expect(targetRows.find((row) => row.name === 'Elemental Guard')?.labels).toEqual([
	{ namespace: 'Element', value: 'Attuned' }
]);
```

Reject `Element: Neutral`, a concrete Elemental row without exactly one concrete element, and any
heading or metadata declaring a subfamily.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec vitest run tools/skill-taxonomy-lib.spec.ts
```

Expected: FAIL on the legacy Evocation/subfamily structure.

- [ ] **Step 3: Rename and flatten Magical Elemental**

Use `git mv` for the page, change its Wiki ID to `skills.magical-elemental`, and use:

```markdown
# Magical Skills — Elemental

Wiki ID: `skills.magical-elemental`

Domain: **Magical**
Family: **Elemental**

| # | Skill | Element | R | T | Requires | Effect |
| ---: | --- | --- | :---: | :---: | --- | --- |
```

Flatten all five old Evocation sections into this table. Every row keeps one concrete Fire, Water,
Wood, Earth, or Metal label. Preserve the five foundation chains through skill prerequisites, not
headings.

- [ ] **Step 4: Add optional Element columns to Magical disciplines**

Keep Ward, Enchantment, Restoration, and Mind as direct `##` family sections in the grouped file.
Use `Element: Attuned` only for the five ledger-approved rows. Use `—` everywhere else; never write
`Neutral`. Add `Domain: **Magical**` page metadata so the target parser treats each `##` heading as a
family.

Add `Domain: **Craft**` metadata and the target label column to `craft-and-life.md`. Preserve the
existing six `##` family headings and rows, then add the ledger-authorized `Grenade Throw` row to
Alchemy with its original effect and an Alchemy-compatible prerequisite. Do not add speculative
labels to other Craft rows.

- [ ] **Step 5: Rewrite the framework and index**

Replace the hierarchy table with:

```markdown
| Level | Meaning | Example |
| --- | --- | --- |
| Domain | Broad source of practice | Martial |
| Family | The skill's single aptitude and progression home | Blade |
| Skill | One learnable definition | Measured Cut |
| Optional label | Compatibility or affinity metadata | Equipment: Sword |
```

Remove the Universal rule, subfamily coverage, and “two ways forward” prose. State that family
membership owns aptitude/progression, while labels narrow equipment or element compatibility.
Update merge examples to the new families; replace Hunt + Lore and Guard + Mind with valid examples
such as Ranged + Lore and Shield + Mind.

In `README.md`, list exactly five Martial, five Magical, and six Craft families. Replace the fixed
520-current-row claim with:

```text
The legacy compendium contained 520 rows. The v2 migration ledger records the disposition of every
row; the consolidated target count is derived by validation and may be lower because approved
merges and deletions are intentional.
```

- [ ] **Step 6: Update Living Village links and terminology**

Map shared martial basics and movement to Body, Fire/Water/Wood/Earth/Metal casters to Elemental
with labels, Bow to Ranged, Shield to Shield, and Sword to Blade. Recalculate the expansion-pool row
count from the retained named definitions rather than preserving 45 by assertion.

- [ ] **Step 7: Update catalog and run validation**

Replace `skills.magical-evocation` with `skills.magical-elemental` and the new page path. Run:

```bash
pnpm exec vitest run tools/skill-taxonomy-lib.spec.ts
pnpm validate:wiki
```

Expected: PASS with 99 wiki pages, complete ledger reconciliation, no Evocation family, and no
invalid label values.

- [ ] **Step 8: Commit the canonical taxonomy**

```bash
git add docs/wiki/catalog.json docs/wiki/mechanics/skills tools/skill-taxonomy-lib.spec.ts tools/validate-skill-taxonomy.ts
git commit -m "docs: adopt consolidated skill taxonomy"
```

---

### Task 5: Migrate equipment, progression, and Living Village references

**Files:**

- Modify: `docs/wiki/mechanics/equipment/weapons.md`
- Modify: `docs/wiki/mechanics/equipment/rarity-and-weight.md`
- Modify: `docs/wiki/mechanics/equipment/armour-and-shields.md`
- Modify: `docs/wiki/mechanics/progression/skills-and-ladders.md`
- Modify: other Markdown files reported by exact old wiki IDs or old skill-page hrefs
- Modify: `apps/web/src/routes/living-village-lab/summon/fixtures.ts`
- Modify: `apps/web/src/routes/living-village-lab/summon/summon.e2e.ts`
- Modify: `tools/validate-skill-taxonomy.ts`

**Interfaces:**

- Consumes final family names and hrefs from Task 4.
- Produces a stale-reference scan for structural terms and old wiki routes.

- [ ] **Step 1: Add stale-reference validation and observe RED**

Scan repository-authored wiki Markdown, `SkillTree.svelte`, and the Living Village summon fixtures
for exact obsolete identities:

```ts
const forbiddenReferences = [
	'skills.martial-universal',
	'skills.martial-haft-fist',
	'skills.martial-hunt-guard-motion',
	'skills.magical-evocation',
	'martial-universal.md',
	'martial-haft-and-fist.md',
	'martial-hunt-guard-motion.md',
	'magical-evocation.md',
	'Universal Martial',
	'Fire Evocation',
	'## Paired Blades',
	'## Thrown — Hunt',
	'## Fist — Unarmed and Grappling'
];
```

Do not ban ordinary prose words such as guard, motion, protection, or tracking globally. Run:

```bash
pnpm validate:skill-taxonomy
```

Expected: FAIL and print every exact stale path/value.

- [ ] **Step 2: Rewrite equipment taxonomy**

In `weapons.md`:

- keep Sword, Dagger, and Greatsword equipment sections labeled Blade;
- replace Paired Blades equipment identity with a short “Two Blades compatibility” section stating
  that any two compatible Blade weapons can satisfy the skill;
- replace Spear/Axe/Hammer family sections with concrete Polearm sections for Spear, Glaive,
  Halberd, and Polehammer;
- remove the generic Thrown section and attach throwing notes to the concrete tool entries;
- replace Fist taxonomy with Body-compatible unarmed equipment.

Update weight and armor prose to refer to equipment types and new families rather than removed
structural nodes.

- [ ] **Step 3: Rewrite progression terminology**

Mirror the canonical hierarchy table from Task 4. Replace “subfamily ladder” with “family skill
graph,” and state that each family has one or more foundation skills. Replace coverage claims with
five/five/six family counts and link to the migration ledger for consolidated counts.

- [ ] **Step 4: Migrate Living Village fixture aptitudes and tests**

Use these exact fixture changes:

```text
Dara: Hunt → Ranged; Motion → Body; Lore unchanged
Mara: Guard → Shield; Fire Evocation → Elemental; Universal Martial → Body
Remy: Blade unchanged; Motion → Body; Universal Martial → Ranged
```

Update `summon.e2e.ts` to assert `Shield`, `Elemental`, and `Body` for Mara. Preserve the three
aptitude slots and their existing class icons.

- [ ] **Step 5: Resolve exact old routes across authored Markdown**

Run:

```bash
rg -n "martial-universal|martial-haft-and-fist|martial-hunt-guard-motion|magical-evocation|skills\.martial-(universal|haft-fist|hunt-guard-motion)|skills\.magical-evocation|Universal Martial|Fire Evocation" docs/wiki apps/web/src
```

For each result, replace it with the ledger-authorized family/page/anchor. Re-run until the command
returns no structural references; visual prose mentioning ordinary fire evocation as an action may
remain only if it is not a family name or link.

- [ ] **Step 6: Run focused and integrated checks**

Run:

```bash
pnpm validate:wiki
pnpm --filter @summonlab/web exec playwright test src/routes/living-village-lab/summon/summon.e2e.ts
```

Expected: PASS; the stale-reference validator reports zero obsolete identities.

- [ ] **Step 7: Commit cross-reference migration**

```bash
git add docs/wiki apps/web/src/routes/living-village-lab/summon tools/validate-skill-taxonomy.ts
git commit -m "docs: migrate skill taxonomy references"
```

---

### Task 6: Rebuild the interactive skill browser around families and labels

**Files:**

- Create: `apps/web/src/lib/components/wiki/skill-tree-data.ts`
- Create: `apps/web/src/lib/components/wiki/skill-tree-data.spec.ts`
- Modify: `apps/web/src/lib/components/wiki/SkillTree.svelte`
- Modify: `apps/web/src/routes/wiki/skill-tree.e2e.ts`
- Modify: `apps/web/src/lib/server/wiki.spec.ts`

**Interfaces:**

- Produces `SKILL_DOMAINS`, `SkillTreeDomain`, `SkillTreeFamily`, `SkillTreeSkill`, and `SkillTreeLabel`.
- `SkillTree.svelte` consumes only `SKILL_DOMAINS` and does not duplicate family definitions.

- [ ] **Step 1: Replace browser expectations and verify RED**

Change the primary Playwright test to assert:

```ts
await expect(tree.getByRole('button', { name: /martial/i })).toContainText('5 families');
await expect(tree.getByRole('heading', { name: 'Blade' })).toBeVisible();
await expect(tree.getByRole('link', { name: 'Two Blades' })).toBeVisible();
await expect(tree.getByText('Two Blades', { exact: true })).toHaveCount(1);
await expect(tree.getByText(/universal skills/i)).toHaveCount(0);

await tree.getByRole('button', { name: /magical/i }).click();
await expect(tree.getByRole('heading', { name: 'Elemental' })).toBeVisible();
await expect(tree.getByRole('button', { name: 'Fire' })).toBeVisible();
await expect(tree.getByText('Neutral', { exact: true })).toHaveCount(0);
```

Keep the existing keyboard, reduced-motion, single-H1, canonical-source, and 390px overflow checks.
Run the file and expect failure on the old Universal UI.

- [ ] **Step 2: Add failing typed-data invariant tests**

In `skill-tree-data.spec.ts`, assert exact family lists, unique family ownership, allowed label
namespaces, no `Two Blades` label, no Universal branch, and representative canonical hrefs:

```ts
expect(domain('martial').families.map((family) => family.name)).toEqual([
	'Blade',
	'Polearm',
	'Ranged',
	'Shield',
	'Body'
]);
expect(domain('magical').families.map((family) => family.name)).toEqual([
	'Elemental',
	'Ward',
	'Enchantment',
	'Restoration',
	'Mind'
]);
expect(allLabels()).not.toContain('Two Blades');
expect(skill('Two Blades')).toMatchObject({ family: 'Blade', labels: [] });
```

- [ ] **Step 3: Implement the navigation model**

Use:

```ts
export type SkillTreeLabel = { namespace: 'Equipment' | 'Element'; value: string };
export type SkillTreeSkill = { name: string; href: string; labels: SkillTreeLabel[] };
export type SkillTreeFamily = {
	name: string;
	href: string;
	description: string;
	labels: SkillTreeLabel[];
	skills: SkillTreeSkill[];
};
export type SkillTreeDomain = {
	id: 'martial' | 'magical' | 'craft';
	name: string;
	image: string;
	description: string;
	families: SkillTreeFamily[];
};
```

Include all 16 families and representative skill links sufficient to demonstrate labels and direct
ownership. Two Blades must link into the Blade table. Elemental must expose Fire, Water, Wood,
Earth, and Metal chips; Ward and Enchantment expose Attuned only where representative skills use it.

- [ ] **Step 4: Refactor `SkillTree.svelte`**

Remove `UniversalBranch`, `BranchedSkillFamily`, reserved lanes, and all “two ways forward” copy.
Render:

```text
Skills root
  domain switcher
  active domain artwork
  family cards
    family title/link
    optional filter chips
    representative direct skill links
```

Use native `<button>` controls for domain and label selection. Give pressed filter chips
`aria-pressed`. Filtering must never hide unlabeled family-wide skills unless the chip explicitly
means “only compatible with this label”; provide a visible reset button after selection.

- [ ] **Step 5: Update server registry assertions**

Set `getWikiPageCount()` to 99. Assert the new route exists and obsolete routes return null:

```ts
expect(getWikiPage('mechanics/skills/magical-elemental')?.wikiId).toBe(
	'skills.magical-elemental'
);
expect(getWikiPage('mechanics/skills/magical-evocation')).toBeNull();
expect(getWikiPage('mechanics/skills/martial-universal')).toBeNull();
```

- [ ] **Step 6: Run component, server, and browser tests**

Run:

```bash
pnpm --filter @summonlab/web exec vitest run src/lib/components/wiki/skill-tree-data.spec.ts src/lib/server/wiki.spec.ts
pnpm --filter @summonlab/web exec playwright test src/routes/wiki/skill-tree.e2e.ts
```

Expected: all tests PASS, including keyboard, reduced motion, and mobile containment.

- [ ] **Step 7: Commit the interactive hierarchy**

```bash
git add apps/web/src/lib/components/wiki/SkillTree.svelte apps/web/src/lib/components/wiki/skill-tree-data.ts apps/web/src/lib/components/wiki/skill-tree-data.spec.ts apps/web/src/routes/wiki/skill-tree.e2e.ts apps/web/src/lib/server/wiki.spec.ts
git commit -m "feat: browse skills by family and label"
```

---

### Task 7: Full validation, visual review, and delivery

**Files:**

- Modify only files required by failures attributable to this migration.
- Capture visual evidence outside the repository under the active Codex visualization directory.

**Interfaces:**

- Consumes the completed canonical migration and interactive browser.
- Produces final verification evidence and a clean pushed branch.

- [ ] **Step 1: Run formatting and static checks**

Run:

```bash
pnpm exec prettier --write package.json tools/skill-taxonomy-lib.ts tools/skill-taxonomy-lib.spec.ts tools/export-skill-taxonomy-migration.ts tools/validate-skill-taxonomy.ts docs/wiki/catalog.json docs/wiki/mechanics/skills apps/web/src/lib/components/wiki/SkillTree.svelte apps/web/src/lib/components/wiki/skill-tree-data.ts apps/web/src/lib/components/wiki/skill-tree-data.spec.ts apps/web/src/routes/wiki/skill-tree.e2e.ts apps/web/src/lib/server/wiki.spec.ts
pnpm validate:wiki
pnpm --filter @summonlab/web lint
pnpm --filter @summonlab/web typecheck
```

Expected: all commands exit 0 with no Svelte diagnostics.

- [ ] **Step 2: Run unit and focused browser tests**

Run:

```bash
pnpm exec vitest run tools/skill-taxonomy-lib.spec.ts
pnpm --filter @summonlab/web test:unit
pnpm --filter @summonlab/web exec playwright test src/routes/wiki/skill-tree.e2e.ts src/routes/living-village-lab/summon/summon.e2e.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Run the production build**

Run:

```bash
pnpm --filter @summonlab/web build
```

Expected: exit 0. Existing chunk-size and optional Sharp adapter warnings may remain; no new error is
accepted.

- [ ] **Step 4: Serve and inspect the remote page**

Run from the repository root:

```bash
pnpm --filter @summonlab/web dev --host 0.0.0.0 --port 5173
```

Open `http://10.110.24.122:5173/wiki/mechanics/skills`. Capture desktop (1440×1000) and mobile
(390×844) screenshots. Inspect Martial, Magical, and Craft states and verify family cards, labels,
Two Blades ownership, Elemental filtering, canonical Markdown placement, focus rings, and overflow.

- [ ] **Step 5: Run the final source and working-tree audit**

Run:

```bash
pnpm exec tsx tools/export-skill-taxonomy-migration.ts --check
pnpm validate:skill-taxonomy
git diff --check
git status --short
```

Expected: ledger is deterministic, every source row reconciles, no diff whitespace errors, and only
intentional final fixes are present.

- [ ] **Step 6: Commit final verification fixes if any**

If Step 1–5 required in-scope fixes:

```bash
git add package.json tools/skill-taxonomy-lib.ts tools/skill-taxonomy-lib.spec.ts tools/export-skill-taxonomy-migration.ts tools/validate-skill-taxonomy.ts docs/wiki/catalog.json docs/wiki/mechanics apps/web/src/lib/components/wiki apps/web/src/lib/server/wiki.spec.ts apps/web/src/routes/wiki/skill-tree.e2e.ts apps/web/src/routes/living-village-lab/summon
git commit -m "fix: complete skill taxonomy migration"
```

If no files changed, do not create an empty commit.

- [ ] **Step 7: Push and report delivery**

```bash
git push
git status --short
git log -1 --oneline
```

Expected: branch is pushed, working tree is clean, and the handoff reports the live URL, validation
results, commit hashes/subjects, push destination, migration row totals, and focused review actions.
