# Monster Wiki Family Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an image-first monster wiki with a concise 38-family index, one 25-image page per family, and one five-image page per canonical form.

**Architecture:** Keep the integrated monster database and existing evidence records authoritative. Extend the deterministic wiki exporter with family and reconciliation pages plus a combined visual-presentation catalog; generate deployable WebP derivatives only for the 750 original-family LFS sources and reuse the 200 fauna runtime URLs. The web server parses that catalog into ordered index, family, and form models rendered by dedicated Svelte components.

**Tech Stack:** TypeScript 6, Node.js 24, Vitest, Sharp 0.35, SvelteKit 2, Svelte 5, Playwright, pnpm

**Spec:** `docs/superpowers/specs/2026-09-06-monster-wiki-family-navigation-design.md`

## Global Constraints

- Preserve exactly 38 families, five ordered forms per family, five ordered affinities per form, 190 forms, and 950 unique coordinates.
- Preserve T1, T2, T3, T4, T5 order and Normal, Fire, Earth, Wind, Water order; never alphabetize either sequence.
- Keep the 750 original-family PNG masters at their existing LFS-covered paths.
- Reuse the existing 200 fauna WebP runtime URLs without duplicating fauna images.
- Preserve every coordinate's current `presentationStatus`; presentation export must not imply approval or gameplay promotion.
- Generate original-family derivatives at a 640-pixel maximum width and height with Sharp WebP quality 72, effort 4, `picture` preset, smart subsampling, and stripped metadata.
- Reject any original-family derivative over 180,000 bytes and any aggregate 750-image derivative set over 75,000,000 bytes.
- Keep WebP derivatives in regular Git under `apps/web/static/runtime/enemies/monster-wiki-v1/`; keep the compact combined catalog in regular Git under `assets/enemies/runtime/monster-wiki-v1/catalog.json`.
- Do not create a review gallery, contact sheet, approval UI, or legacy-pack entry.
- Do not touch the skill-icon branch or skill-icon assets.

## File structure

- `tools/wiki-monster-database-lib.ts`: pure canonical Markdown builders, generated-page ownership, legacy route destinations, candidate evidence hashes, and visual-index family bindings.
- `tools/wiki-monster-database-lib.spec.ts`: behavioral tests for concise index, family/form/appendix content ownership, page sets, and freshness.
- `tools/monster-wiki-runtime-visuals.ts`: pure visual-plan construction, Sharp derivative encoding, catalog construction, safe write/check synchronization, and storage budgets.
- `tools/monster-wiki-runtime-visuals.spec.ts`: visual-plan and encoder contract tests using real canonical records and one controlled source.
- `tools/export-wiki-monster-database.ts`: orchestration for Markdown, catalog registrations, visual derivatives, and combined catalog.
- `package.json`: explicit `export:wiki-monster-visuals` and `validate:wiki-monster-visuals` commands if a direct diagnostic entry point is needed; `export:wiki-monsters` remains the all-in-one command.
- `docs/wiki/creatures/monsters/README.md`: generated image-first index source with concise copy only.
- `docs/wiki/creatures/monsters/families/*.md`: 38 generated family sources.
- `docs/wiki/creatures/monsters/reconciliation.md`: generated historical reconciliation appendix.
- `docs/wiki/creatures/monsters/*.md`: 190 regenerated form sources with family backlinks and form-owned details.
- `docs/wiki/creatures/monsters/visual-index.json`: existing canonical index extended with stable family page bindings.
- `docs/wiki/catalog.json`: 38 family registrations plus the reconciliation registration.
- `assets/enemies/runtime/monster-wiki-v1/catalog.json`: 950-record combined presentation catalog.
- `apps/web/static/runtime/enemies/monster-wiki-v1/**/*.webp`: 750 hash-addressed deployable original-family derivatives.
- `apps/web/src/lib/server/monster-database.ts`: strict catalog parser and ordered index/family/form view models.
- `apps/web/src/lib/server/wiki.spec.ts`: server-boundary route, count, ordering, and status tests.
- `apps/web/src/routes/wiki/[...slug]/+page.server.ts`: page-type dispatch for index, family, and form models.
- `apps/web/src/routes/wiki/[...slug]/+page.svelte`: component selection without duplicated Markdown bodies.
- `apps/web/src/lib/components/wiki/MonsterDatabase.svelte`: concise family index with five Normal-image cards per family.
- `apps/web/src/lib/components/wiki/MonsterFamily.svelte`: family header, compact T1–T5 table, and 5 × 5 affinity atlas.
- `apps/web/src/lib/components/wiki/MonsterVisualMatrix.svelte`: five-image form header, truthful statuses, family backlink, and form Markdown continuation.
- `apps/web/src/routes/wiki/monster-database.e2e.ts`: browser coverage for index, family, original-family form, fauna form, navigation, and narrow layout.

---

### Task 1: Generate the three-level Markdown hierarchy

**Files:**
- Modify: `tools/wiki-monster-database-lib.spec.ts`
- Modify: `tools/wiki-monster-database-lib.ts`
- Modify: `tools/export-wiki-monster-database.ts`
- Modify: `docs/wiki/catalog.json`
- Regenerate: `docs/wiki/creatures/monsters/README.md`
- Create: `docs/wiki/creatures/monsters/families/*.md`
- Create: `docs/wiki/creatures/monsters/reconciliation.md`
- Regenerate: `docs/wiki/creatures/monsters/*.md`
- Modify: `docs/wiki/creatures/monsters/visual-index.json`

**Interfaces:**
- Consumes: `CanonicalMonsterWikiDatabase`, `CanonicalMonsterFamily`, and `CanonicalMonsterForm` from `tools/wiki-monster-database-lib.ts`.
- Produces: `buildMonsterFamilyWikiPage(family)`, `buildMonsterReconciliationWikiPage(database)`, `generatedMonsterFamilyPageFileNames(database)`, candidate `sourceContentHash` values, and family `pagePath` values in `buildMonsterVisualIndex(database)`.

- [ ] **Step 1: Write failing hierarchy tests**

Replace the current index-heavy assertion with behavior that names the ownership boundary:

```ts
const index = buildMonsterDatabaseIndex(database);
const familyPage = buildMonsterFamilyWikiPage(goblins);
const formPage = buildMonsterWikiPage(goblinKing);
const reconciliation = buildMonsterReconciliationWikiPage(database);

expect(index).toContain('[Goblins](families/goblins.md)');
expect(index).toContain('[Goblin King](goblin-king.md)');
expect(index).not.toContain(goblins.classificationNotes);
expect(index).not.toContain(goblinKing.signatureMechanic);
expect(index).not.toContain('Current class reconciliation');
expect(familyPage).toContain(goblins.classificationNotes);
expect(familyPage).toContain(goblinKing.signatureMechanic);
expect(familyPage.match(/^\| T[1-5] /gmu)).toHaveLength(5);
expect(formPage).toContain('[← Goblins family](families/goblins.md)');
expect(reconciliation.match(/^\| `[^`]+` \|/gmu)).toHaveLength(40);
expect(goblinKing.coordinates.every(({ sourceContentHash }) => /^[a-f0-9]{64}$/u.test(sourceContentHash))).toBe(true);
expect(legacyMonsterRouteMap(database).find(({ currentClassId }) => currentClassId === 'death-knight')?.destination)
  .toBe('/wiki/creatures/monsters/reconciliation');
```

Extend freshness fixtures to include a `familyPages` map and `reconciliation` string, then assert a
missing or altered family page fails independently. Assert the family filename list is exactly 38
unique `<family-id>.md` names.

- [ ] **Step 2: Run the hierarchy test and verify RED**

Run:

```bash
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm exec vitest run tools/wiki-monster-database-lib.spec.ts
```

Expected: FAIL because the family and reconciliation builders do not exist and the current index
still owns family mechanics and reconciliation prose.

- [ ] **Step 3: Implement the pure Markdown builders and ownership checks**

Add these public functions and extend stored-output freshness:

```ts
export function buildMonsterFamilyWikiPage(family: CanonicalMonsterFamily): string;
export function buildMonsterReconciliationWikiPage(database: CanonicalMonsterWikiDatabase): string;
export function generatedMonsterFamilyPageFileNames(
  database: CanonicalMonsterWikiDatabase
): string[];

export type StoredMonsterWikiOutputs = {
  readme: string;
  reconciliation: string;
  visualIndex: string;
  pages: ReadonlyMap<string, string>;
  familyPages: ReadonlyMap<string, string>;
  existingFileNames: readonly string[];
  existingFamilyFileNames: readonly string[];
};
```

Build the index with short count/taxonomy copy and family sections containing only the family link,
one escalation sentence, and five form links. Build family pages with family metadata, visual
constants, the five-row comparison table, and a semantic placeholder heading for the web-owned
affinity atlas. Build the appendix from the existing reconciliation prose/table. Replace form-page
family-wide lists with a family backlink and concise escalation summary while retaining visual delta,
combat reading, and evidence matrices. Carry each candidate review evidence SHA-256 into
`CanonicalProductionCoordinate.sourceContentHash` and the visual-index variant; use the existing
approved-source hash for fauna runtime coordinates.

- [ ] **Step 4: Update exporter ownership and catalog registrations**

Create and validate `docs/wiki/creatures/monsters/families/`, write all 38 pages, write
`reconciliation.md`, and safely remove stale `.md` files only inside the managed family directory.
Register:

```ts
{
  wikiId: `monster-family.${family.familyId}`,
  path: `docs/wiki/creatures/monsters/families/${family.familyId}.md`,
  pageType: 'monster-family',
  owner: 'visuals-content',
  designStatus: 'accepted',
  implementationStatus: 'partial',
  visualStatus: 'runtime',
  spoilerScope: 'discoverable'
}
```

Register `creatures.monster-reconciliation` as `monster-reference`, update managed wiki-ID guards,
and add `pagePath: docs/wiki/creatures/monsters/families/<family-id>.md` to each visual-index family.

- [ ] **Step 5: Run GREEN tests and regenerate outputs**

Run:

```bash
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm exec vitest run tools/wiki-monster-database-lib.spec.ts
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm export:wiki-monsters
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm validate:wiki-monsters
```

Expected: PASS; exporter reports 38 family pages, 190 form pages, one appendix, and unchanged
canonical counts.

- [ ] **Step 6: Commit the hierarchy slice**

```bash
git add tools/wiki-monster-database-lib.ts tools/wiki-monster-database-lib.spec.ts tools/export-wiki-monster-database.ts docs/wiki/catalog.json docs/wiki/creatures/monsters
git commit -m "feat(wiki): add monster family hierarchy"
```

### Task 2: Export the 950-record visual presentation catalog

**Files:**
- Create: `tools/monster-wiki-runtime-visuals.spec.ts`
- Create: `tools/monster-wiki-runtime-visuals.ts`
- Modify: `tools/export-wiki-monster-database.ts`
- Modify: `package.json`
- Create: `assets/enemies/runtime/monster-wiki-v1/catalog.json`
- Create: `apps/web/static/runtime/enemies/monster-wiki-v1/**/*.webp`

**Interfaces:**
- Consumes: integrated `CanonicalMonsterWikiDatabase` and
  `assets/enemies/runtime/fauna-family-v1/catalog.json`.
- Produces: `buildMonsterWikiVisualPlan(database, faunaCatalog)`,
  `encodeMonsterWikiDerivative(repositoryRoot, source)`, and
  `syncMonsterWikiRuntimeVisuals(repositoryRoot, database, mode)`.

- [ ] **Step 1: Write failing visual-plan and encoder tests**

Use the integrated production database for relationship assertions and one real Goblin source for
encoding:

```ts
const plan = buildMonsterWikiVisualPlan(database, faunaCatalog);
expect(plan.records).toHaveLength(950);
expect(plan.generated).toHaveLength(750);
expect(plan.reused).toHaveLength(200);
expect(new Set(plan.records.map(({ coordinateId }) => coordinateId))).toHaveLength(950);
expect(plan.records[0]).toMatchObject({
  coordinateId: 'goblins/goblin-runt/normal',
  presentationStatus: 'approved-review',
  sourcePath: 'assets/enemies/experiments/family-affinity-v1/candidates/goblins/goblin-runt/normal-v1.png'
});

const derivative = await encodeMonsterWikiDerivative(repositoryRoot, plan.generated[0]!);
expect(Math.max(derivative.width, derivative.height)).toBe(640);
expect(derivative.bytes).toBeLessThanOrEqual(180_000);
expect(derivative.path).toMatch(/normal\.[a-f0-9]{12}\.webp$/u);
expect(createHash('sha256').update(derivative.buffer).digest('hex')).toBe(derivative.sha256);
```

Also mutate one fauna binding and assert `buildMonsterWikiVisualPlan` throws rather than silently
substituting it.

- [ ] **Step 2: Run the visual test and verify RED**

Run:

```bash
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm exec vitest run tools/monster-wiki-runtime-visuals.spec.ts
```

Expected: FAIL because the visual-plan and encoder module does not exist.

- [ ] **Step 3: Implement the visual plan, encoder, and catalog**

Define a strict catalog headed by:

```ts
type MonsterWikiVisualCatalog = {
  schemaVersion: 'monster-wiki-visual-catalog-v1';
  exporterVersion: 'monster-wiki-visual-exporter-v1';
  familyCount: 38;
  formCount: 190;
  coordinateCount: 950;
  generatedCount: 750;
  reusedCount: 200;
  generatedBytes: number;
  records: MonsterWikiVisualRecord[];
};
```

For original-family sources, validate source existence and SHA-256, encode with the global Sharp
profile, hash the resulting bytes, and derive the hash-addressed file name. For fauna, require exact
agreement with its source path/hash, form ID, family ID, affinity, dimensions, and runtime URL.
`syncMonsterWikiRuntimeVisuals` must stage all output in a task-scoped temporary directory, validate
the complete catalog and budgets, then replace only the explicit `monster-wiki-v1` output root in
write mode. Check mode compares catalog JSON and every expected derivative byte and rejects extras.

- [ ] **Step 4: Integrate the visual sync into the existing exporter**

Call the visual sync after loading the integrated database in both `--write` and `--check` modes.
Keep `pnpm export:wiki-monsters` as the only required synchronization command. Add direct diagnostic
aliases that invoke the same module without changing output ownership:

```json
"export:wiki-monster-visuals": "tsx tools/monster-wiki-runtime-visuals.ts --write",
"validate:wiki-monster-visuals": "tsx tools/monster-wiki-runtime-visuals.ts --check"
```

- [ ] **Step 5: Run GREEN tests, write all derivatives, and verify budgets**

Run:

```bash
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm exec vitest run tools/monster-wiki-runtime-visuals.spec.ts
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm export:wiki-monsters
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm validate:wiki-monster-visuals
```

Expected: PASS with 950 catalog records, 750 generated derivatives, 200 reused fauna records, no
record over 180,000 bytes, and generated total no higher than 75,000,000 bytes.

- [ ] **Step 6: Commit the runtime visual slice**

```bash
git add package.json tools/monster-wiki-runtime-visuals.ts tools/monster-wiki-runtime-visuals.spec.ts tools/export-wiki-monster-database.ts assets/enemies/runtime/monster-wiki-v1 apps/web/static/runtime/enemies/monster-wiki-v1
git commit -m "feat(wiki): export canonical monster visuals"
```

### Task 3: Expose ordered index, family, and form server models

**Files:**
- Modify: `apps/web/src/lib/server/wiki.spec.ts`
- Modify: `apps/web/src/lib/server/monster-database.ts`
- Modify: `apps/web/src/routes/wiki/[...slug]/+page.server.ts`

**Interfaces:**
- Consumes: `visual-index.json`, `monster-wiki-v1/catalog.json`, and cataloged wiki page IDs.
- Produces: `getMonsterVisualDatabase(): readonly MonsterVisualFamily[]`,
  `getMonsterFamilyVisualEntry(wikiId): MonsterVisualFamily | null`, and
  `getMonsterVisualEntry(wikiId): MonsterVisualEntry | null` for all 190 forms.

- [ ] **Step 1: Write failing server-boundary tests**

Change the former null expectations to exact ordered models:

```ts
const families = getMonsterVisualDatabase();
expect(families).toHaveLength(38);
expect(families[0]?.forms.map(({ tier }) => tier)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5']);
expect(families[0]?.forms.map(({ variants }) => variants[0]?.affinity)).toEqual([
  'normal', 'normal', 'normal', 'normal', 'normal'
]);
expect(getMonsterFamilyVisualEntry('monster-family.goblins')?.forms.flatMap(({ variants }) => variants))
  .toHaveLength(25);
expect(getMonsterVisualEntry('monster.goblin-runt')?.variants).toHaveLength(5);
expect(getMonsterVisualEntry('monster.goblin-runt')?.variants[0]?.thumbnailPath)
  .toMatch(/^\/runtime\/enemies\/monster-wiki-v1\//u);
expect(getMonsterVisualEntry('monster.wolf-grey-wolf')?.variants[0]?.thumbnailPath)
  .toMatch(/^\/runtime\/enemies\/fauna-family-v1\//u);
```

Load `creatures/monsters/families/goblins` and assert the route payload contains the family model,
while index and form routes receive only their relevant model.

- [ ] **Step 2: Run the web unit test and verify RED**

Run:

```bash
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/server/wiki.spec.ts
```

Expected: FAIL because the database hook is null, original-family visuals are absent, and family
route dispatch does not exist.

- [ ] **Step 3: Implement strict combined-catalog parsing and view models**

Parse every required record field and enforce exact counts, unique coordinates, source/status
agreement with `visual-index.json`, derivative file extensions, and existing fauna bindings. Build
families by iterating visual-index families in source order and form IDs in declared order; bind
variants in `MONSTER_AFFINITIES` order.

Use these view-model shapes:

```ts
export interface MonsterVisualFamily extends MonsterProductionFamily {
  pagePath: string;
  forms: MonsterVisualEntry[];
}

export interface MonsterVisualVariant extends MonsterProductionVariant {
  thumbnailPath: string;
  sourcePath: string;
  sourceHash: string;
  derivativeHash: string;
  width: number;
  height: number;
  bytes: number;
}
```

- [ ] **Step 4: Dispatch route payloads by wiki ID**

Return `monsterDatabase`, `monsterFamily`, and `monsterVisual` as mutually relevant fields. Resolve
legacy IDs before page lookup as today. Do not parse filenames in the route.

- [ ] **Step 5: Run GREEN server tests and typecheck**

Run:

```bash
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/server/wiki.spec.ts
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web typecheck
```

Expected: all web unit tests pass and SvelteKit reports no errors.

- [ ] **Step 6: Commit the server-model slice**

```bash
git add apps/web/src/lib/server/monster-database.ts apps/web/src/lib/server/wiki.spec.ts apps/web/src/routes/wiki/\[...slug\]/+page.server.ts
git commit -m "feat(wiki): expose monster family visuals"
```

### Task 4: Render the image-first index, family atlas, and form page

**Files:**
- Modify: `apps/web/src/routes/wiki/monster-database.e2e.ts`
- Modify: `apps/web/src/lib/components/wiki/MonsterDatabase.svelte`
- Create: `apps/web/src/lib/components/wiki/MonsterFamily.svelte`
- Modify: `apps/web/src/lib/components/wiki/MonsterVisualMatrix.svelte`
- Modify: `apps/web/src/routes/wiki/[...slug]/+page.svelte`

**Interfaces:**
- Consumes: the three server models from Task 3.
- Produces: accessible browser pages for index, family, and form routes.

- [ ] **Step 1: Write failing browser tests**

Replace the old Markdown-index expectation and add family/original-form coverage:

```ts
await page.goto('/wiki/creatures/monsters');
await expect(page.locator('.database .family')).toHaveCount(38);
await expect(page.locator('#database-goblins img')).toHaveCount(5);
await expect(page.locator('#database-goblins img').first()).toHaveAttribute('alt', /Runt.*Normal/iu);
await expect(page.getByRole('heading', { name: 'Current class reconciliation' })).toHaveCount(0);

await page.goto('/wiki/creatures/monsters/families/goblins');
await expect(page.locator('.family-atlas img')).toHaveCount(25);
await expect(page.locator('.family-progression tbody tr')).toHaveCount(5);

await page.goto('/wiki/creatures/monsters/goblin-runt');
await expect(page.locator('.matrix img')).toHaveCount(5);
await expect(page.locator('.matrix')).toContainText('approved review');
await expect(page.getByRole('link', { name: /Goblins family/iu })).toBeVisible();
```

Keep the fauna test and update it to expect five simultaneously visible images. Add a 360-pixel
viewport assertion that the index cards wrap while T1 appears before T2 and the page has no
horizontal document overflow.

- [ ] **Step 2: Run the browser test and verify RED**

Run:

```bash
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:e2e -- monster-database.e2e.ts
```

Expected: FAIL because the index still renders Markdown, the family visual component does not exist,
and original-family form routes have no visual model.

- [ ] **Step 3: Implement the concise index component**

Render families in supplied source order. For each family, render five linked cards using only each
form's Normal variant, tier, and name. Include the family route and one short escalation sentence;
do not add status badges, mechanics tables, affinity selectors, or reconciliation text. Preserve the
existing dark bestiary visual language and make the five-card row wrap responsively.

- [ ] **Step 4: Implement the family component**

Render the family Markdown body for canonical prose and the visual component for navigation and the
atlas. The component must provide a semantic table with five form rows and a CSS grid whose row
headers are T1–T5 and column headers are Normal/Fire/Earth/Wind/Water. Each of the 25 images links to
its form page and carries `<form name>, <affinity> affinity` alt text.

- [ ] **Step 5: Simplify and generalize the form visual component**

Show all five variants simultaneously rather than a four-item carousel. Label each image with its
affinity and truthful normalized evidence text (`approved review`, `candidate only`, or `runtime`).
Use the catalog source path for the source link label without claiming approval. Add index and family
backlinks, then let the generated Markdown continue below with the full combat/evidence contract.

- [ ] **Step 6: Select components in the page route and run GREEN browser tests**

Render exactly one of `MonsterDatabase`, `MonsterFamily`, or `MonsterVisualMatrix` above the relevant
Markdown continuation. Run:

```bash
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:e2e -- monster-database.e2e.ts
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web typecheck
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web lint
```

Expected: browser tests, typecheck, and lint all pass.

- [ ] **Step 7: Commit the presentation slice**

```bash
git add apps/web/src/lib/components/wiki/MonsterDatabase.svelte apps/web/src/lib/components/wiki/MonsterFamily.svelte apps/web/src/lib/components/wiki/MonsterVisualMatrix.svelte apps/web/src/routes/wiki/\[...slug\]/+page.svelte apps/web/src/routes/wiki/monster-database.e2e.ts
git commit -m "feat(wiki): render image-first monster atlas"
```

### Task 5: Integrate validation, measure storage, and preview

**Files:**
- Modify: `package.json` only if the root `check` chain does not already invoke the combined visual check through `validate:wiki-monsters`.
- Modify: implementation files above only for test-proven integration defects.

**Interfaces:**
- Consumes: all outputs from Tasks 1–4.
- Produces: a clean, pushed branch with deterministic validation and a remote preview.

- [ ] **Step 1: Add a failing root-validation assertion if visual checks are not transitively covered**

Run `pnpm validate:wiki-monsters` after temporarily renaming one generated WebP inside a task-scoped
test fixture. If the command does not fail, add an integration test around the exporter check mode
that expects a missing derivative error, watch it fail, then make `validate:wiki-monsters` invoke the
visual check. Do not mutate a real checked-in asset for this test.

- [ ] **Step 2: Run the focused and repository-level verification set**

Run:

```bash
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm exec vitest run tools/wiki-monster-database-lib.spec.ts tools/monster-wiki-runtime-visuals.spec.ts
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm validate:wiki-monsters
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm validate:repository-assets
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:unit -- src/lib/server/wiki.spec.ts
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web test:e2e -- monster-database.e2e.ts
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web typecheck
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web lint
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web build
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm exec prettier --check tools apps/web/src docs/wiki docs/superpowers/specs/2026-09-06-monster-wiki-family-navigation-design.md docs/superpowers/plans/2026-09-06-monster-wiki-family-navigation.md
git diff --check
```

Expected: every command passes with no warnings attributable to this change.

- [ ] **Step 3: Measure and record the actual derivative footprint**

Run:

```bash
du -sh apps/web/static/runtime/enemies/monster-wiki-v1
node -e "const c=require('./assets/enemies/runtime/monster-wiki-v1/catalog.json'); console.log({records:c.records.length,generated:c.generatedCount,reused:c.reusedCount,bytes:c.generatedBytes})"
git lfs ls-files | rg 'assets/enemies/experiments/family-affinity-v1/candidates' | wc -l
```

Expected: 950 records, 750 generated, 200 reused, generated bytes at or below 75,000,000, and 750
canonical source PNGs still listed by Git LFS.

- [ ] **Step 4: Start or refresh the collaborator preview**

Run:

```bash
PATH=/tmp/summonlab-node-24.14.1/bin:$PATH pnpm --filter @summonlab/web exec vite dev --host 0.0.0.0 --port 4174
```

Verify `0.0.0.0:4174` is listening and the index, Goblin family, Goblin Runt, and Grey Wolf routes
return HTTP 200. Share `http://10.110.24.218:4174/wiki/creatures/monsters`.

- [ ] **Step 5: Commit any final test-proven integration fix**

If Step 1 required a change:

```bash
git add package.json tools apps/web/src
git commit -m "test(wiki): enforce monster visual freshness"
```

If no files changed, do not create an empty commit.

- [ ] **Step 6: Push and confirm the final repository state**

```bash
git push origin codex/repository-cleanup
git status --short
git log -1 --format='%H%n%s'
```

Expected: push succeeds and `git status --short` prints nothing.
