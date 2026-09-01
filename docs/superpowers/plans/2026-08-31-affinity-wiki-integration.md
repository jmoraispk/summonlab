# Affinity Wiki Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the active wiki affinity model with the supplied four-base, six-dual design and
make every rendered wiki page, diagram, and enemy-visual label agree with that model.

**Architecture:** Treat the supplied Part 2 as canonical prose and the supplied migration notes as
the only authorized cross-file transformation list. Add an executable wiki-only contract before
editing content, update canonical progression pages first, then dependent wiki pages, then diagrams
and enemy review presentation. Keep legacy image candidates and immutable source inventories
explicitly separate from accepted mechanics and runtime assets.

**Tech Stack:** Markdown wiki catalog, Node.js 24, TypeScript, Vitest, Svelte 5, SVG, Prettier,
pnpm 10.

**Spec:**

- `/home/joao/.codex/attachments/22393792-fd2c-48df-8df4-93b0f34d82df/part2_affinities.md`
- `/home/joao/.codex/attachments/47762c80-f8b3-477f-9a47-eb1f4ed4275d/affinity_change_notes.md`

## Global Constraints

- There are exactly four base affinities: **Fire, Earth, Wind, Water**.
- There are exactly six rare dual affinities: **Mist, Lightning, Sand, Rot, Magma, Ice**.
- There are exactly ten affinities total: four base plus six dual.
- Unaligned is the absence of affinity and is not counted among the ten.
- Void and Radiance are off-cycle exceptions and are not counted among the ten.
- The sole overcoming cycle is **Earth → Water → Fire → Wind → Earth**.
- The dual mappings are exact: Water × Fire = Mist; Fire × Wind = Lightning; Wind × Earth =
  Sand; Earth × Water = Rot; Fire × Earth = Magma; Water × Wind = Ice.
- The base statuses are exact: Fire/Burn, Earth/Weight, Wind/Lacerate, Water/Chill.
- The dual statuses are exact: Mist/Shroud, Lightning/Shock, Sand/Abrade, Rot/Decay,
  Magma/Melt, Ice/Freeze.
- Dual affinities are rare hero/monster states. Enemy visual production targets only Normal plus
  the four base variants unless a separate manifest explicitly requests a dual.
- Wood and Metal may remain material words or legacy-candidate provenance. They must never be
  presented as current affinities.
- The exact word `Resonance`, case-insensitive, must not appear in rendered wiki prose or wiki UI.
  The supplied rank name `Resonant` remains valid because it is a different word and is present in
  the canonical Part 2.
- Canonical Part 2 prose is copied from the supplied file without editorial reinterpretation.
  Apply only the supplied migration-note renumbering: the star-gate cross-reference is `2.11`.
- Do not change engine contracts, executable skill catalogs, or runtime visual catalogs in this
  plan. Wiki skill mirrors and wiki-only presentation are in scope; changes requiring shared
  generators receive an explicit integration review before execution.
- Supplied SVG/PNG files are layout references, not canonical mechanics. A diagram ships only when
  its encoded labels and arrows pass the contract test.
- Generated cinematic images remain `approval-candidate` editorial assets. They are not required
  for the mechanics correction and cannot block it.

---

### Task 1: Add an executable four-base/six-dual wiki contract

**Files:**

- Create: `tools/affinity-wiki-contract.ts`
- Create: `tools/affinity-wiki-contract.spec.ts`
- Modify: `package.json`

**Interfaces:**

- Produces `BASE_AFFINITIES`, `DUAL_AFFINITIES`, `OVERCOMING_EDGES`,
  `validateAffinityWiki(root: string): Promise<string[]>`, and the command
  `pnpm validate:wiki-affinities`.
- Later tasks consume the failing findings list and may not weaken its constants.

- [ ] **Step 1: Write the contract constants and repository scanner**

```ts
export const BASE_AFFINITIES = ['Fire', 'Earth', 'Wind', 'Water'] as const;
export const DUAL_AFFINITIES = [
	{ name: 'Mist', parents: ['Water', 'Fire'], status: 'Shroud' },
	{ name: 'Lightning', parents: ['Fire', 'Wind'], status: 'Shock' },
	{ name: 'Sand', parents: ['Wind', 'Earth'], status: 'Abrade' },
	{ name: 'Rot', parents: ['Earth', 'Water'], status: 'Decay' },
	{ name: 'Magma', parents: ['Fire', 'Earth'], status: 'Melt' },
	{ name: 'Ice', parents: ['Water', 'Wind'], status: 'Freeze' }
] as const;
export const OVERCOMING_EDGES = [
	['Earth', 'Water'],
	['Water', 'Fire'],
	['Fire', 'Wind'],
	['Wind', 'Earth']
] as const;
```

`validateAffinityWiki` must inspect catalog-linked Markdown, the wiki Svelte components, and the
two affinity SVGs. It reports:

- any exact `Resonance` occurrence in rendered Markdown or wiki UI;
- `Wood affinity`, `Metal affinity`, a five-base claim, or a derived-Wind claim in rendered pages;
- a missing or extra base/dual name in the canonical affinity tables;
- a cycle edge that differs from `OVERCOMING_EDGES`;
- an affinity catalog entry for Wood or Metal;
- a monster page that calls a Wood or Metal image a current affinity variant;
- a circle SVG whose `data-overcomes` edges are not exactly the four required edges;
- a matrix SVG that does not contain four base cells and six dual cells.

Immutable skill-source JSON fields may retain source wording only when they are not rendered and
their corresponding target fields contain current terminology. The validator must name that narrow
exception rather than ignoring the entire JSON file.

- [ ] **Step 2: Write failing repository-level tests**

```ts
import { describe, expect, it } from 'vitest';
import { validateAffinityWiki } from './affinity-wiki-contract.js';

describe('active wiki affinity contract', () => {
	it('publishes exactly four bases and six duals with one cycle', async () => {
		expect(await validateAffinityWiki(process.cwd())).toEqual([]);
	});
});
```

- [ ] **Step 3: Run the test and capture the current failure inventory**

Run:

```bash
pnpm vitest run tools/affinity-wiki-contract.spec.ts
```

Expected: FAIL, naming the existing active-wiki occurrences in progression commentary, equipment,
skill summaries, skill target data, giant-tower-dragon copy, the Wood page/catalog entry, and the
legacy monster-variant presentation.

- [ ] **Step 4: Wire the contract into normal wiki validation**

Add:

```json
"validate:wiki-affinities": "tsx tools/affinity-wiki-contract.ts",
"validate:wiki": "node tools/validate-wiki.mjs && pnpm validate:wiki-affinities && pnpm validate:skill-taxonomy"
```

- [ ] **Step 5: Commit the failing contract separately**

```bash
git add package.json tools/affinity-wiki-contract.ts tools/affinity-wiki-contract.spec.ts
git commit -m "test(wiki): lock four-affinity contract"
```

---

### Task 2: Replace canonical Part 2 and apply every progression migration note

**Files:**

- Modify: `docs/wiki/mechanics/progression/affinities.md`
- Modify: `docs/wiki/mechanics/progression/README.md`
- Modify: `docs/wiki/mechanics/progression/attributes-and-training.md`
- Modify: `docs/wiki/mechanics/progression/skills-and-ladders.md`
- Modify: `docs/wiki/mechanics/progression/heroes-stars-and-summoning.md`
- Modify: `docs/wiki/mechanics/progression/open-decisions.md`
- Modify: `docs/wiki/systems/summoning-progression-combat.md`
- Modify: `docs/wiki/milestones/living-village.md`
- Test: `tools/affinity-wiki-contract.spec.ts`

**Interfaces:**

- Consumes the exact constants from Task 1 and both supplied specification files.
- Produces the only canonical affinity mechanics page, Wiki ID
  `mechanics.progression.affinities`.

- [ ] **Step 1: Replace the canonical page body from the supplied Part 2**

Keep only this wiki wrapper ahead of the supplied sections:

```markdown
# Affinities

Wiki ID: `mechanics.progression.affinities`

Design status: **accepted supplied design with explicit tuning gaps**.
```

Then copy Sections 2.1 through 2.11 from `part2_affinities.md`. Do not summarize, reinterpret, or
silently repair prose. Apply the migration-note section shift so the 2.3 star-gate reference points
to `2.11`.

- [ ] **Step 2: Make the progression overview state the exact count and rarity**

The overview must say:

```markdown
Affinities comprise four base affinities—Fire, Earth, Wind, and Water—and six rare dual
affinities, for ten total. Unaligned is the absence of affinity, not an eleventh affinity.
```

- [ ] **Step 3: Apply the Part 1 and Part 3 migration notes**

Verify Part 1 lists Might, Vitality, Agility, Dexterity, Intellect, and Spirit and contains no
attribute named with the retired noun. In Part 3, use this current requirement:

```markdown
S-grade requirements use a **minimum affinity rank** wherever a skill carries an infusion.
```

Remove retrospective wording that repeats the retired noun.

- [ ] **Step 4: Apply the Part 4 dependency**

Keep the star rules explicit:

```markdown
| Current stars | Affinity eligibility |
| 1–2★ | None; the hero remains Unaligned at this rating |
| 3★ | May awaken one base affinity |
| 4–7★ | May awaken one base affinity or, rarely, a dual affinity |
```

State that awakening rolls at level-up and star promotion and keys off current stars, not native
stars.

- [ ] **Step 5: Preserve all carried-forward tuning items**

The open-decisions page must retain Rot/Decay, Chill/torpor, Earth/Weight, awakening rate,
manifestation threshold, dual scarcity, and Dominion radius/tick/formation rulings. Monster notes
must state ten total affinities, T1–T5 rank mapping, and mostly Unaligned monsters below T3.

- [ ] **Step 6: Run the focused test**

```bash
pnpm vitest run tools/affinity-wiki-contract.spec.ts
```

Expected: progression findings pass; dependent wiki findings remain.

- [ ] **Step 7: Commit the canonical progression batch**

```bash
git add docs/wiki/mechanics/progression docs/wiki/systems/summoning-progression-combat.md docs/wiki/milestones/living-village.md
git commit -m "docs(wiki): replace canonical affinity progression"
```

---

### Task 3: Remove the duplicate five-element affinity surface

**Files:**

- Modify: `docs/wiki/mechanics/affinities/README.md`
- Modify: `docs/wiki/mechanics/affinities/fire.md`
- Modify: `docs/wiki/mechanics/affinities/wind.md`
- Create: `docs/wiki/mechanics/affinities/earth.md`
- Create: `docs/wiki/mechanics/affinities/water.md`
- Delete: `docs/wiki/mechanics/affinities/wood.md`
- Modify: `docs/wiki/mechanics/attributes.md`
- Modify: `docs/wiki/mechanics/equipment/README.md`
- Modify: `docs/wiki/mechanics/equipment/focuses-tools-accessories.md`
- Modify: `docs/wiki/catalog.json`
- Test: `tools/affinity-wiki-contract.spec.ts`

**Interfaces:**

- Consumes canonical mechanics from Task 2.
- Produces one support index plus exactly four base-affinity child pages; child pages may summarize
  but may not redefine cycle, rank, dual, or awakening rules.

- [ ] **Step 1: Make the support index a four-base navigation page**

It must open with:

```markdown
Summonlab has four base affinities: Fire, Earth, Wind, and Water. Every pair produces one of six
rare dual affinities, making ten affinities total. The canonical rules live in
[Affinities](../progression/affinities.md).
```

List the four base pages and the six dual name/status pairs. Do not include design-history prose in
the active mechanics page.

- [ ] **Step 2: Normalize the four base pages**

Each child page contains only its canonical base definition, status, attribute nudge, material
language, and a link back to the canonical page. Earth and Water use the exact Part 2 definitions;
Fire and Wind are checked against them.

- [ ] **Step 3: Remove Wood as an affinity page and catalog entry**

Delete `wood.md`, remove `affinity.wood`, and add `affinity.earth` and `affinity.water` catalog
entries with `designStatus: "accepted"`. Wood remains legal in prose only as a physical material or
explicitly labeled legacy image provenance.

- [ ] **Step 4: Remove retrospective terminology from dependent mechanics**

Replace historical migration commentary with current rules. Equipment pages say “affinity rank”
directly and do not mention the retired noun.

- [ ] **Step 5: Run focused and general wiki validation**

```bash
pnpm vitest run tools/affinity-wiki-contract.spec.ts
pnpm validate:wiki
```

Expected: affinity support and catalog findings pass; skill and monster-presentation findings
remain.

- [ ] **Step 6: Commit the support-page batch**

```bash
git add docs/wiki/mechanics/affinities docs/wiki/mechanics/attributes.md docs/wiki/mechanics/equipment docs/wiki/catalog.json
git commit -m "docs(wiki): publish four base affinity references"
```

---

### Task 4: Align the wiki skill mirror without changing executable skills

**Files:**

- Modify: `docs/wiki/mechanics/skills/README.md`
- Modify: `docs/wiki/mechanics/skills/framework.md`
- Modify: `docs/wiki/mechanics/skills/living-village.md`
- Modify: `docs/wiki/mechanics/skills/magical-disciplines.md`
- Modify: `docs/wiki/mechanics/skills/magical-elemental.md`
- Modify: `docs/wiki/mechanics/skills/migration-v2.json`
- Modify: `tools/export-skill-taxonomy-migration.ts`
- Modify: `tools/skill-taxonomy-lib.ts`
- Modify: `apps/web/src/lib/components/wiki/skill-tree-data.ts`
- Modify: `apps/web/src/lib/components/wiki/skill-tree-data.spec.ts`
- Test: `tools/skill-taxonomy-lib.spec.ts`
- Test: `tools/affinity-wiki-contract.spec.ts`

**Interfaces:**

- Consumes the explicit migration-note dispositions: Fire/Water/Earth retained, Metal documented as
  the mechanical source for a future Wind rewrite, and Wood removed from the active affinity model.
- Produces current wiki labels only. It does not rename or rebalance the individual Wind ladder;
  that remains the skill owner's separate content change.

- [ ] **Step 1: Limit active wiki skill labels to the four bases**

Set `ELEMENT_LABELS` and the skill-tree family labels to `Fire`, `Earth`, `Wind`, `Water`, plus the
non-affinity compatibility label `Attuned`. Remove Wood and Metal from active UI labels.

- [ ] **Step 2: Correct terminology that does not require skill redesign**

Change Elemental Attunement to:

```markdown
Grants an ally the hero's affinity temporarily at reduced affinity rank.
```

Update the replacement effect in the migration ledger/exporter while preserving the immutable
legacy source field as provenance.

- [ ] **Step 3: Stop publishing obsolete Wood/Metal ladders as current affinities**

The active Elemental page retains Fire, Water, and Earth rows. Move the Wood rows to deleted
migration dispositions with rationale `Wood affinity removed by accepted four-base model`. Move the
Metal rows to renamed/rehome dispositions targeting `Element: Wind`, but do not publish their old
metal-specific names and effects as finished Wind skills. The active page contains a concise Wind
family statement linking to the canonical affinity page and says its individual skill rewrite is
owned by the skill-content pass.

This produces an internally honest wiki: four current affinity labels, three preserved ladders,
and one explicitly unexpanded Wind ladder. It does not invent skill names the user reserved.

- [ ] **Step 4: Update Living Village examples**

The visible examples become Fire, Water, Earth, and Wind. Wind points to the Elemental family page
without claiming unpublished individual skills.

- [ ] **Step 5: Run taxonomy and affinity tests**

```bash
pnpm vitest run tools/skill-taxonomy-lib.spec.ts tools/affinity-wiki-contract.spec.ts apps/web/src/lib/components/wiki/skill-tree-data.spec.ts
pnpm validate:skill-taxonomy
```

Expected: no current skill label treats Wood or Metal as an affinity; immutable source rows remain
traceable; the target ledger and rendered skill pages agree.

- [ ] **Step 6: Commit the wiki-skill integration batch**

```bash
git add docs/wiki/mechanics/skills tools/export-skill-taxonomy-migration.ts tools/skill-taxonomy-lib.ts apps/web/src/lib/components/wiki/skill-tree-data.ts apps/web/src/lib/components/wiki/skill-tree-data.spec.ts
git commit -m "docs(wiki): align skills with four affinities"
```

---

### Task 5: Rebuild the cycle and matrix diagrams from the contract

**Files:**

- Create: `assets/enemies/wiki/affinities/reference/element-cycle-v2.svg`
- Create: `assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg`
- Create: `assets/enemies/wiki/affinities/reference/provenance.json`
- Modify: `docs/wiki/mechanics/progression/affinities.md`
- Modify: `docs/wiki/catalog.json`
- Test: `tools/affinity-wiki-contract.spec.ts`

**Interfaces:**

- Consumes `OVERCOMING_EDGES`, `BASE_AFFINITIES`, and `DUAL_AFFINITIES` from Task 1.
- Produces exact, code-native, accessible wiki diagrams marked `approved-supplied-layout`, not
  generated runtime art.

- [ ] **Step 1: Build the circle in the written cycle order**

Place Earth at top, Water at right, Fire at bottom, and Wind at left. Draw clockwise arrow segments
with these machine-readable attributes:

```xml
<path data-overcomes="Earth>Water" ... />
<path data-overcomes="Water>Fire" ... />
<path data-overcomes="Fire>Wind" ... />
<path data-overcomes="Wind>Earth" ... />
```

The SVG `<title>` is `Affinity overcoming cycle`; its `<desc>` states the four edges verbatim. Put
the six dual labels outside the cycle as secondary annotations; do not draw them as additional
overcoming edges.

- [ ] **Step 2: Build the ten-cell matrix**

Order rows and columns Earth, Water, Fire, Wind so the diagonal and upper triangle follow the cycle.
Use four `data-kind="base"` cells and six `data-kind="dual"` cells. Each dual cell declares
`data-parents` and `data-status` from Task 1.

- [ ] **Step 3: Record supplied-reference provenance**

The provenance file records the four attachment paths, their SHA-256 values, the new SVG paths,
`status: "approved-supplied-layout"`, and the note that mechanical labels/arrows were rebuilt from
the canonical contract rather than copied blindly.

- [ ] **Step 4: Add both SVGs to the canonical page and catalog**

Place the cycle immediately after Section 2.4 and the matrix immediately after the dual-affinity
tables in Section 2.10. Use descriptive alt text that repeats the exact cycle and the 4+6 count.

- [ ] **Step 5: Run the diagram contract and render check**

```bash
pnpm vitest run tools/affinity-wiki-contract.spec.ts
pnpm validate:wiki
```

Expected: four exact circle edges, four base matrix cells, six dual matrix cells, and ten unique
affinity names.

- [ ] **Step 6: Commit the exact-diagram batch**

```bash
git add assets/enemies/wiki/affinities/reference docs/wiki/mechanics/progression/affinities.md docs/wiki/catalog.json
git commit -m "docs(wiki): add verified affinity diagrams"
```

---

### Task 6: Separate current enemy targets from legacy Wood/Metal candidates

**Files:**

- Modify: `tools/export-wiki-monster-database.ts`
- Modify: `tools/wiki-monster-database-lib.ts`
- Modify: `tools/wiki-monster-database-lib.spec.ts`
- Modify: `apps/web/src/lib/components/wiki/AffinityIcon.svelte`
- Modify: `apps/web/src/lib/components/wiki/MonsterVisualMatrix.svelte`
- Modify: `apps/web/src/routes/wiki/monster-database.e2e.ts`
- Regenerate: `docs/wiki/creatures/monsters/README.md`
- Regenerate: `docs/wiki/creatures/monsters/*.md`
- Regenerate: `docs/wiki/creatures/monsters/visual-index.json`
- Regenerate: `docs/wiki/catalog.json`

**Interfaces:**

- Consumes the accepted enemy production target: Normal, Fire, Earth, Wind, Water.
- Produces a current-target viewer that never calls Wood or Metal an affinity while preserving old
  files as `legacy-candidate` review evidence until separately removed.

- [ ] **Step 1: Obtain integration approval for the shared wiki generator**

Send the root orchestrator this exact request before editing:

```text
Request: update the shared monster-wiki generator and presentation labels only. Keep all legacy
source files and hashes. Current target becomes Normal + Fire/Earth/Wind/Water; Wood/Metal remain
legacy-candidate evidence and are never runtime/approved. No engine contract or runtime visual
catalog changes.
```

- [ ] **Step 2: Write the failing presentation tests**

Assert that the current target selector accepts `fire | earth | wind | water`, that legacy Wood and
Metal records render under `Legacy visual studies`, and that alt text never calls them affinity
variants. Add an Earth icon branch to `AffinityIcon.svelte`; remove Wood/Metal from its current
affinity union.

- [ ] **Step 3: Fix the generator as the single source of generated prose**

Generate every monster page with two explicit sets:

```text
Current production target: Normal, Fire, Earth, Wind, Water
Legacy visual studies: Wood and Metal candidates; not current affinities and not runtime assets
```

Do not hand-edit the forty generated monster pages.

- [ ] **Step 4: Replace the unrelated monster counterplay use of the retired noun**

Change the giant tower dragon's displayed counterplay to `arcane scars exposed only after a
committed attack`. Keep this as wiki presentation copy unless the content owner separately approves
changing the source archetype.

- [ ] **Step 5: Regenerate and validate**

```bash
pnpm export:wiki-monsters
pnpm validate:wiki-monsters
pnpm vitest run tools/wiki-monster-database-lib.spec.ts tools/affinity-wiki-contract.spec.ts
pnpm --filter @summonlab/web test:e2e -- monster-database.e2e.ts
```

Expected: generated files are fresh, current target labels contain only the four bases, and legacy
candidate evidence remains accessible but cannot be confused with accepted/runtime art.

- [ ] **Step 6: Commit the enemy-review integration batch**

```bash
git add tools/export-wiki-monster-database.ts tools/wiki-monster-database-lib.ts tools/wiki-monster-database-lib.spec.ts apps/web/src/lib/components/wiki/AffinityIcon.svelte apps/web/src/lib/components/wiki/MonsterVisualMatrix.svelte apps/web/src/routes/wiki/monster-database.e2e.ts docs/wiki/creatures/monsters docs/wiki/catalog.json
git commit -m "fix(wiki): separate current and legacy affinity visuals"
```

---

### Task 7: Run the complete acceptance gate and publish review evidence

**Files:**

- Create: `docs/wiki/sources/2026-08-31-affinity-integration-evidence.md`
- Modify: `docs/wiki/catalog.json`

**Interfaces:**

- Consumes all previous tasks.
- Produces one evidence page listing exact commands, results, remaining owner handoffs, commit hashes,
  and preview route.

- [ ] **Step 1: Run the zero-occurrence and exact-count gates**

```bash
pnpm validate:wiki-affinities
rg -n -i '\bresonance\b' docs/wiki --glob '*.md'
rg -n -i 'wood affinity|metal affinity|five base affinities|derived affinity' docs/wiki --glob '*.md'
```

Expected: the validator passes; both searches return no active-rule matches. Explicit legacy visual
provenance may use Wood/Metal only when labeled `legacy-candidate` and not followed by `affinity`.

- [ ] **Step 2: Run repository validation relevant to this plan**

```bash
pnpm validate:wiki
pnpm validate:wiki-monsters
pnpm validate:skill-taxonomy
pnpm --filter @summonlab/web test
pnpm --filter @summonlab/web typecheck
```

Expected: every command exits 0.

- [ ] **Step 3: Preview the exact pages**

Run:

```bash
pnpm dev:app
```

Review:

- `/wiki/mechanics/progression/affinities`
- `/wiki/mechanics/affinities`
- `/wiki/mechanics/skills/magical-elemental`
- `/wiki/creatures/monsters/dire-wolf`

Confirm the cycle reads Earth → Water → Fire → Wind → Earth; the matrix shows four bases plus six
duals; the skill page does not publish Wood/Metal as affinities; and the monster page distinguishes
current targets from legacy candidates.

- [ ] **Step 4: Record evidence and catalog it**

The evidence page includes the ten-name roster, four cycle edges, command outputs, screenshot paths,
commit hashes, and the statement `No runtime catalog or engine contract changed`.

- [ ] **Step 5: Commit and push the final review batch**

```bash
git add docs/wiki/sources/2026-08-31-affinity-integration-evidence.md docs/wiki/catalog.json
git commit -m "docs(wiki): record affinity integration evidence"
git push origin codex/enemies-affinity-wiki
```

## Self-Review

- **Spec coverage:** The plan locks all four bases, all six rare duals, all statuses, the sole cycle,
  progression cross-file notes, skill-wiki dependencies, enemy candidate distinctions, diagrams,
  and review evidence.
- **No silent reinterpretation:** Task 2 copies supplied Part 2 and applies only the supplied
  renumbering instruction.
- **No count ambiguity:** Tests and diagrams use four bases, six duals, and ten total; section count
  is never presented as an affinity count.
- **No terminology drift:** The exact retired noun is forbidden in rendered wiki content; the valid
  rank name `Resonant` is preserved.
- **Ownership safety:** Executable skills and runtime catalogs remain untouched. The shared
  monster-wiki generator has an explicit integration request before modification.
- **Visual safety:** Exact SVG diagrams precede any cinematic candidate generation, and legacy
  Wood/Metal studies remain visibly separate from approved/runtime assets.
