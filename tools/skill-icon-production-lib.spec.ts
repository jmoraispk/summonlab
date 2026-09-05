import {
	access,
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	realpath,
	rm,
	symlink
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	buildSkillIconCatalog,
	CANONICAL_SKILL_SOURCE_PATHS,
	loadCanonicalSkillRows,
	parseAcceptedMotifMap,
	summarizeSkillIconCatalog,
	validateVisualLineage,
	type SkillIconVisualSpecs
} from './skill-icon-production-lib.js';
import type { TargetSkillRow } from './skill-taxonomy-lib.js';
import {
	exportSkillIconProduction,
	SKILL_ICON_MOTIF_SOURCE_PATH
} from './export-skill-icon-production.js';

function row(targetId: string, name: string): TargetSkillRow {
	return {
		targetId,
		domain: 'Martial',
		family: 'Blade',
		name,
		labels: [],
		rarity: 'F',
		type: 'Passive',
		requires: '—',
		effect: `${name} effect.`
	};
}

describe('skill icon production catalog', () => {
	it('parses only accepted table assignments and links immediate predecessors', () => {
		const rows = [
			row('martial:blade:first', 'First'),
			row('martial:blade:second', 'Second'),
			row('martial:blade:alone', 'Alone')
		];
		const markdown = `# Map

**Status:** Accepted

This **prose bolding** is not an assignment and \`prose.id\` is not a table row.

## Martial

### Blade — 3 skills

| Motif ID | Proposed primary visual lineage |
| --- | --- |
| \`blade.progression\` | **First** → **Second** |
| \`blade.standalone\` | **Alone** |
`;

		const map = parseAcceptedMotifMap(markdown, rows);
		expect(map.entries).toHaveLength(2);
		expect(map.records).toEqual([
			{
				targetId: 'martial:blade:first',
				mapEntryId: 'blade.progression',
				motifFamily: 'blade.progression',
				primaryVisualParent: null
			},
			{
				targetId: 'martial:blade:second',
				mapEntryId: 'blade.progression',
				motifFamily: 'blade.progression',
				primaryVisualParent: 'martial:blade:first'
			},
			{
				targetId: 'martial:blade:alone',
				mapEntryId: 'blade.standalone',
				motifFamily: null,
				primaryVisualParent: null
			}
		]);
		expect(() => parseAcceptedMotifMap(markdown.replace('Accepted', 'Proposed'), rows)).toThrow(
			/accepted status/u
		);
		expect(() =>
			parseAcceptedMotifMap(
				markdown.replace('| `blade.standalone` | **Alone** |', '| blade.standalone | **Alone** |'),
				rows
			)
		).toThrow(/backticked/u);
	});

	it('ignores fenced and indented code when discovering acceptance and assignments', () => {
		const rows = [row('martial:blade:first', 'First')];
		const fencedOnly = `~~~markdown
**Status:** Accepted
## Martial
### Blade
| \`blade.first\` | **First** |
~~~`;
		expect(() => parseAcceptedMotifMap(fencedOnly, rows)).toThrow(/accepted status/u);

		const liveMap = `# Map

\`\`\`md
**Status:** Proposed
## Martial
### Blade
| \`blade.fake\` | **Not a skill** |
\`\`\`

    **Status:** Proposed
    ## Magical
    ### Elemental
    | \`blade.indented\` | **Not a skill** |

**Status:** Accepted
## Martial
### Blade
| Motif ID | Proposed primary visual lineage |
| --- | --- |
| \`blade.first\` | **First** |`;
		expect(parseAcceptedMotifMap(liveMap, rows).entries).toEqual([
			{
				mapEntryId: 'blade.first',
				domain: 'Martial',
				family: 'Blade',
				memberTargetIds: ['martial:blade:first']
			}
		]);
	});

	it('ignores single-line, multiline, and unterminated HTML comments', () => {
		const rows = [row('martial:blade:first', 'First')];
		const entirelyCommented = `<!--
**Status:** Accepted
## Martial
### Blade
| \`blade.first\` | **First** |
-->`;
		expect(() => parseAcceptedMotifMap(entirelyCommented, rows)).toThrow(/accepted status/u);

		const liveMapWithRetiredComments = `# Map

<!-- **Status:** Proposed -->
<!--
**Status:** Accepted
## Martial
### Blade
| \`blade.retired\` | **Retired First** |
-->

\`\`\`md
<!-- unterminated inside the fence
**Status:** Proposed
\`\`\`

**Status:** Accepted
## Martial
### Blade
| Motif ID | Proposed primary visual lineage |
| --- | --- |
| \`blade.first\` | **First** |

<!-- unterminated retired example
**Status:** Accepted
| \`blade.retired-tail\` | **Retired Tail** |`;
		expect(parseAcceptedMotifMap(liveMapWithRetiredComments, rows).entries).toEqual([
			{
				mapEntryId: 'blade.first',
				domain: 'Martial',
				family: 'Blade',
				memberTargetIds: ['martial:blade:first']
			}
		]);
	});

	it('ignores literal motif Markdown inside raw HTML blocks', () => {
		const rows = [row('martial:blade:first', 'First')];
		const markdown = `<pre data-example="retired">
**Status:** Proposed
## Martial
### Blade
| \`blade.retired\` | **Retired** |
</pre>

**Status:** Accepted
## Martial
### Blade
| Motif ID | Proposed primary visual lineage |
| --- | --- |
| \`blade.first\` | **First** |`;
		expect(parseAcceptedMotifMap(markdown, rows).entries).toHaveLength(1);
		expect(parseAcceptedMotifMap(markdown, rows).entries[0]?.mapEntryId).toBe('blade.first');
	});

	it.each([
		['type-1 tag', '<pre>', '</pr<!-- retired -->e>', '</pre>'],
		['CDATA', '<![CDATA[', ']]<!-- retired -->>', ']]>'],
		['processing instruction', '<?retired', '?<!-- retired -->>', '?>']
	])(
		'does not synthesize a %s terminator by deleting an HTML comment',
		(_label, opener, apparentTerminator, closer) => {
			const markdown = `${opener}
${apparentTerminator}
**Status:** Accepted
## Martial
### Blade
| Motif ID | Proposed primary visual lineage |
| --- | --- |
| \`blade.first\` | **First** |
${closer}`;
			expect(() => parseAcceptedMotifMap(markdown, [row('martial:blade:first', 'First')])).toThrow(
				/accepted status/u
			);
		}
	);

	it.each([
		[
			'generic block tag',
			`<div>
**Status:** Accepted
## Martial
### Blade
| \`blade.first\` | **First** |
</div>`
		],
		[
			'CDATA',
			`<![CDATA[
**Status:** Accepted
## Martial
### Blade
| \`blade.first\` | **First** |
]]>`
		],
		[
			'processing instruction',
			`<?retired
**Status:** Accepted
## Martial
### Blade
| \`blade.first\` | **First** |
?>`
		]
	])('rejects a complete accepted mapping contained by %s raw HTML', (_label, markdown) => {
		expect(() => parseAcceptedMotifMap(markdown, [row('martial:blade:first', 'First')])).toThrow(
			/accepted status/u
		);
	});

	it('excludes all seven CommonMark HTML block types beside a live mapping', () => {
		const rows = [row('martial:blade:first', 'First')];
		const markdown = `<script>
**Status:** Proposed
</script>

<!-- **Status:** Proposed -->

<?retired
**Status:** Proposed
?>

<!RETIRED
**Status:** Proposed
>

<![CDATA[
**Status:** Proposed
]]>

<div class="retired">
**Status:** Proposed
## Martial
### Blade
| \`blade.retired-six\` | **Retired Six** |
</div>

<retired-example data-kind="motif">
**Status:** Proposed
## Martial
### Blade
| \`blade.retired-seven\` | **Retired Seven** |
</retired-example>

**Status:** Accepted
## Martial
### Blade
| Motif ID | Proposed primary visual lineage |
| --- | --- |
| \`blade.first\` | **First** |`;
		expect(parseAcceptedMotifMap(markdown, rows).entries).toEqual([
			{
				mapEntryId: 'blade.first',
				domain: 'Martial',
				family: 'Blade',
				memberTargetIds: ['martial:blade:first']
			}
		]);
	});

	it.each(['pre', 'script', 'style', 'textarea'])(
		'rescans a line after an HTML comment into a type-1 <%s> block',
		(tag) => {
			const rows = [row('martial:blade:first', 'First')];
			const markdown = `<!-- retired -->\u003c${tag}>
**Status:** Proposed
## Martial
### Blade
| \`blade.retired\` | **Retired** |
</${tag}>

**Status:** Accepted
## Martial
### Blade
| Motif ID | Proposed primary visual lineage |
| --- | --- |
| \`blade.first\` | **First** |`;
			expect(parseAcceptedMotifMap(markdown, rows).entries[0]?.mapEntryId).toBe('blade.first');
		}
	);

	it.each([
		['pre', 'script'],
		['script', 'style'],
		['style', 'textarea'],
		['textarea', 'pre']
	])('keeps a type-1 <%s> block open across a mismatched </%s>', (opener, wrongCloser) => {
		const markdown = `<${opener}>
</${wrongCloser}>
**Status:** Accepted
## Martial
### Blade
| \`blade.first\` | **First** |
</${opener}>`;
		expect(() => parseAcceptedMotifMap(markdown, [row('martial:blade:first', 'First')])).toThrow(
			/accepted status/u
		);
	});

	it.each(['pre', 'script', 'style', 'textarea'])(
		'resumes after a same-line case-insensitive matching </%s> close',
		(tag) => {
			const markdown = `<${tag}></${tag.toUpperCase()}>
**Status:** Accepted
## Martial
### Blade
| Motif ID | Proposed primary visual lineage |
| --- | --- |
| \`blade.first\` | **First** |`;
			expect(
				parseAcceptedMotifMap(markdown, [row('martial:blade:first', 'First')]).entries[0]
					?.mapEntryId
			).toBe('blade.first');
		}
	);

	it.each([
		[
			'thematic break',
			`---
<retired-example>
**Status:** Accepted
## Martial
### Blade
| \`blade.first\` | **First** |
</retired-example>`
		],
		[
			'setext heading',
			`Retired section
---
<retired-example>
**Status:** Accepted
## Martial
### Blade
| \`blade.first\` | **First** |
</retired-example>`
		],
		[
			'GFM table',
			`| Retired | Value |
| --- | --- |
| old | map |
<retired-example>
**Status:** Accepted
## Martial
### Blade
| \`blade.first\` | **First** |
</retired-example>`
		]
	])('does not expose a type-7 HTML mapping after a %s boundary', (_label, markdown) => {
		expect(() => parseAcceptedMotifMap(markdown, [row('martial:blade:first', 'First')])).toThrow(
			/accepted status/u
		);
	});

	it('rejects cycles and parents outside a motif family', () => {
		expect(() =>
			validateVisualLineage([
				{
					targetId: 'martial:blade:first',
					mapEntryId: 'blade.one',
					motifFamily: 'blade.one',
					primaryVisualParent: 'martial:blade:second'
				},
				{
					targetId: 'martial:blade:second',
					mapEntryId: 'blade.one',
					motifFamily: 'blade.one',
					primaryVisualParent: 'martial:blade:first'
				}
			])
		).toThrow(/visual parent cycle/u);

		expect(() =>
			validateVisualLineage([
				{
					targetId: 'martial:blade:first',
					mapEntryId: 'blade.one',
					motifFamily: 'blade.one',
					primaryVisualParent: null
				},
				{
					targetId: 'martial:blade:second',
					mapEntryId: 'blade.two',
					motifFamily: 'blade.two',
					primaryVisualParent: 'martial:blade:first'
				}
			])
		).toThrow(/outside motif family/u);
	});

	it('materializes exact accepted-map coverage against canonical rows', async () => {
		const canonicalRows = await loadCanonicalSkillRows();
		const markdown = await readFile(
			path.resolve('docs/superpowers/specs/2026-09-01-skill-icon-motif-map.md'),
			'utf8'
		);
		const lineage = parseAcceptedMotifMap(markdown, canonicalRows, {
			allowUnmappedCanonicalRows: true
		});
		const mappedIds = new Set(lineage.records.map((record) => record.targetId));
		const rows = canonicalRows.filter((row) => mappedIds.has(row.targetId));
		const visualSpecs: SkillIconVisualSpecs = {
			schemaVersion: 'skill-icon-visual-specs-v1',
			records: rows.map(({ targetId }) => ({
				targetId,
				status: 'mapped',
				visualSpec: null,
				assets: null,
				review: null
			}))
		};
		const catalog = buildSkillIconCatalog(rows, lineage, visualSpecs);

		expect(summarizeSkillIconCatalog(catalog)).toEqual({
			canonical: 456,
			mapped: 456,
			missing: [],
			duplicates: [],
			mapEntries: 124,
			calibrationFamilies: 104,
			standalones: 20,
			longestLineage: 12
		});
		expect(catalog.records.filter((record) => record.motifFamily === null)).toHaveLength(20);
		expect(
			catalog.records.every((record) =>
				record.motifFamily === null ? record.mapEntryId.length > 0 : true
			)
		).toBe(true);
	});

	it('rejects any missing visual assignment during the canonical join', () => {
		const rows = [row('martial:blade:ember', 'Ember')];
		const lineage = parseAcceptedMotifMap(
			`**Status:** Accepted

## Martial
### Blade
| Motif ID | Proposed primary visual lineage |
| --- | --- |
| \`blade.ember\` | **Ember** |`,
			rows
		);
		const specs: SkillIconVisualSpecs = {
			schemaVersion: 'skill-icon-visual-specs-v1',
			records: []
		};

		expect(() => buildSkillIconCatalog(rows, lineage, specs)).toThrow(/martial:blade:ember/u);
	});

	it('rejoins canonical fields while preserving authored visual state', () => {
		const rows = [row('martial:blade:ember', 'Canonical Ember')];
		const lineage = parseAcceptedMotifMap(
			`**Status:** Accepted

## Martial
### Blade
| Motif ID | Proposed primary visual lineage |
| --- | --- |
| \`blade.ember\` | **Canonical Ember** |`,
			rows
		);
		const visualSpec = {
			dominantSubject: 'One ember',
			supportingCue: null,
			semanticPalette: ['orange'],
			composition: 'Centered emblem',
			exclusions: ['No text']
		};
		const specs: SkillIconVisualSpecs = {
			schemaVersion: 'skill-icon-visual-specs-v1',
			records: [
				{
					targetId: 'martial:blade:ember',
					status: 'authored',
					visualSpec,
					assets: null,
					review: null
				}
			]
		};

		expect(buildSkillIconCatalog(rows, lineage, specs).records[0]).toMatchObject({
			name: 'Canonical Ember',
			status: 'authored',
			visualSpec
		});
		expect(() =>
			buildSkillIconCatalog(rows, lineage, {
				...specs,
				records: [{ ...specs.records[0]!, name: 'Stale copy' } as never]
			})
		).toThrow(/canonical field name/u);
	});

	it('rejects a symlink ancestor before writing any catalog file outside the workspace', async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-export-root-'));
		const outside = await mkdtemp(path.join(os.tmpdir(), 'skill-icon-export-outside-'));
		try {
			for (const sourcePath of [...CANONICAL_SKILL_SOURCE_PATHS, SKILL_ICON_MOTIF_SOURCE_PATH]) {
				const destination = path.join(root, sourcePath);
				await mkdir(path.dirname(destination), { recursive: true });
				await copyFile(path.resolve(sourcePath), destination);
			}
			const skillAssets = path.join(root, 'assets/wiki/skills');
			await mkdir(skillAssets, { recursive: true });
			await symlink(await realpath(outside), path.join(skillAssets, 'icon-production-v1'), 'dir');

			await expect(exportSkillIconProduction({ root, mode: 'write' })).rejects.toThrow(
				/symbolic link ancestor/u
			);
			await expect(access(path.join(outside, 'motif-map.json'))).rejects.toMatchObject({
				code: 'ENOENT'
			});
			await expect(access(path.join(outside, 'visual-specs.json'))).rejects.toMatchObject({
				code: 'ENOENT'
			});
			await expect(access(path.join(outside, 'catalog.json'))).rejects.toMatchObject({
				code: 'ENOENT'
			});
		} finally {
			await rm(root, { recursive: true, force: true });
			await rm(outside, { recursive: true, force: true });
		}
	});
});
