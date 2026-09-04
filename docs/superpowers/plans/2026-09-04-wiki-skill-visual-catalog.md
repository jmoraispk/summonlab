# Wiki Skill Visual Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish all 456 canonical skills as a searchable, filterable, image-bearing wiki catalog
without sending the 806 MiB production PNG library to browsers.

**Architecture:** A deterministic Sharp exporter derives one hash-named 512px WebP from each
manifest-bound candidate PNG and writes a strict runtime manifest under the web static tree. A
server-only join validates the canonical skill catalog, mass-production manifest, and delivery
manifest by `targetId`. One dedicated Svelte component owns URL-backed filters and incremental
rendering while ordinary wiki Markdown pages remain unchanged.

**Tech Stack:** TypeScript 6, Node.js 24, Sharp 0.35, Vitest 4, Svelte 5 runes, SvelteKit 2,
Playwright 1.60, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-09-04-wiki-skill-visual-catalog-design.md`

## Global Constraints

- Publish exactly 456 skills: 258 Martial, 124 Magical, and 74 Craft.
- Read skill mechanics from `assets/wiki/skills/icon-production-v1/catalog.json`; never parse or
  duplicate Markdown tables.
- Read selected candidate paths and hashes from
  `assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json`.
- Produce exactly one 512×512 alpha WebP per skill at quality 86, alpha quality 100, effort 4, with
  smart subsampling and stripped metadata.
- Keep every derivative at or below 130 KiB and the complete managed runtime directory at or below
  42 MiB.
- Treat export as delivery-only transformation: no crop, repaint, frame repair, glyph removal, or
  source mutation.
- Do not display a separate rarity label; the integrated frame already communicates rarity.
- Use a solid `#090805` image well, never a transparency checkerboard.
- Render 120 matching records initially and add 120 per `Load more` activation.
- Preserve four-card desktop density and no horizontal overflow at 390px.
- Write tests first, observe each intended RED state, and commit/push every completed task.
- Execute all tasks continuously. Do not pause for intermediate approval; request product review
  only after the full Definition of Done passes.
- Keep the separate icon-quality issue out of this implementation. Corrected source images can flow
  through the same exporter later without changing this page architecture.

## File map

| File | Responsibility |
| --- | --- |
| `tools/wiki-skill-visual-catalog-lib.ts` | Build, validate, write, and check browser derivatives |
| `tools/wiki-skill-visual-catalog-lib.spec.ts` | Export determinism, inventory, alpha, hash, and budget tests |
| `tools/export-wiki-skill-visual-catalog.ts` | `--write` / `--check` CLI |
| `apps/web/static/wiki-media/skills/visual-catalog-v1/**` | Generated WebP delivery tree and manifest |
| `apps/web/src/lib/server/skill-visual-catalog.ts` | Strict three-authority join and public view model |
| `apps/web/src/lib/server/skill-visual-catalog.spec.ts` | Join/count/drift tests |
| `apps/web/src/lib/components/wiki/skill-visual-catalog-model.ts` | Pure search/filter/query/visible-window logic |
| `apps/web/src/lib/components/wiki/skill-visual-catalog-model.spec.ts` | Pure interaction-model tests |
| `apps/web/src/lib/components/wiki/SkillVisualCatalog.svelte` | Accessible visual catalog UI |
| `apps/web/src/routes/wiki/[...slug]/+page.server.ts` | Load visual records only for the new wiki ID |
| `apps/web/src/routes/wiki/[...slug]/+page.svelte` | Select the dedicated renderer |
| `apps/web/src/routes/wiki-skill-visual-catalog.e2e.ts` | Desktop/mobile/keyboard browser coverage |
| `docs/wiki/mechanics/skills/visual-catalog.md` | Canonical page introduction |
| `docs/wiki/mechanics/skills/README.md` | Discovery link from the Skills index |
| `docs/wiki/catalog.json` | Wiki registration and status |
| `apps/web/DESIGN.md` | Accepted dense visual-catalog exception |
| `package.json` | Export and validation scripts |

---

### Task 1: Build the deterministic derivative exporter

**Files:**

- Create: `tools/wiki-skill-visual-catalog-lib.ts`
- Create: `tools/wiki-skill-visual-catalog-lib.spec.ts`
- Create: `tools/export-wiki-skill-visual-catalog.ts`
- Modify: `tools/tsconfig.skill-icon-production.json`

**Interfaces:**

- Consumes: canonical catalog records and completed mass-production skill records keyed by
  `targetId`.
- Produces:

```ts
export const WIKI_SKILL_VISUAL_ROOT =
  'apps/web/static/wiki-media/skills/visual-catalog-v1' as const;
export type WikiSkillVisualExportMode = 'write' | 'check';
export interface WikiSkillVisualRuntimeRecord {
  targetId: string;
  sourcePath: string;
  sourceContentHash: string;
  file: string;
  publicPath: string;
  width: 512;
  height: 512;
  bytes: number;
  contentHash: string;
}
export async function buildWikiSkillVisualCatalog(
  workspaceRoot?: string
): Promise<{ manifest: WikiSkillVisualRuntimeManifest; generated: readonly GeneratedAsset[] }>;
export async function writeWikiSkillVisualCatalog(
  built: BuiltWikiSkillVisualCatalog,
  workspaceRoot?: string
): Promise<void>;
export async function checkWikiSkillVisualCatalog(
  built: BuiltWikiSkillVisualCatalog,
  workspaceRoot?: string
): Promise<void>;
```

- [ ] **Step 1: Write exporter tests and verify RED**

Create two temporary 1024×1024 RGBA fixtures and strict two-record catalog/mass manifests. Assert:

```ts
expect(built.manifest.schemaVersion).toBe('wiki-skill-visual-catalog-v1');
expect(built.manifest.summary).toEqual({
  skillCount: 2,
  assetCount: 2,
  totalBytes: expect.any(Number),
  maximumAssetBytes: 133_120
});
expect(built.generated).toHaveLength(2);
expect(built.generated.every(({ record }) => record.width === 512)).toBe(true);
expect(built.generated.every(({ record }) => record.height === 512)).toBe(true);
expect(built.generated.every(({ record }) => record.publicPath.endsWith('.webp'))).toBe(true);
```

Generate the same fixture twice and require byte-identical buffers and manifests after removing no
fields—the manifest contains no current timestamp. Change one source byte and require a source-hash
failure. Add duplicate/missing IDs, a 1023px source, RGB-only source, unexpected output file, changed
derivative, and stale manifest cases.

Run:

```bash
corepack pnpm vitest run tools/wiki-skill-visual-catalog-lib.spec.ts
```

Expected RED: the exporter module does not exist.

- [ ] **Step 2: Implement strict authority loading and joining**

In `buildWikiSkillVisualCatalog`, parse both JSON authorities as unknown objects before narrowing.
Require completed mass production and exact counts:

```ts
if (mass.schemaVersion !== 'skill-icon-mass-production-manifest-v1')
  throw new Error('Invalid skill mass-production manifest schema');
if (mass.completionState !== 'complete' || mass.skills.length !== 456)
  throw new Error('Skill mass-production inventory is incomplete');
if (catalog.records.length !== 456)
  throw new Error(`Expected 456 canonical skills; got ${catalog.records.length}`);
```

Build unique maps and require every canonical record to have exactly one mass record with matching
name, Domain, Family, rarity, motif family, source path, and current file hash. Reject paths outside
`assets/wiki/skills/icon-production-v1/mass-production-v1/icons/`, symbolic links, non-regular files,
and output slugs outside `[a-z0-9-]+`.

- [ ] **Step 3: Implement exact derivative generation**

For each sorted canonical record, verify 1024×1024 RGBA and generate:

```ts
const { data, info } = await sharp(sourceBytes, { failOn: 'error' })
  .resize(512, 512, { fit: 'fill' })
  .webp({ quality: 86, alphaQuality: 100, effort: 4, smartSubsample: true })
  .toBuffer({ resolveWithObject: true });
```

Require `info.width === 512`, `info.height === 512`, output alpha, `data.byteLength <= 133_120`, and
name the file `<slug>.<source hash first 12>.webp`. Hash source and output with SHA-256. Use a bounded
worker pool of 12 rather than starting 456 Sharp pipelines simultaneously.

The manifest contains exporter version, encoder settings, source authority hashes, sorted records,
and summary. Format it deterministically with Prettier and no wall-clock timestamp.

- [ ] **Step 4: Implement atomic write and zero-write check**

Write the full output into a sibling `.staging-<pid>-<uuid>` directory using exclusive files, fsync
the manifest, verify its 456-file inventory and total budget, then rename the existing managed root
to `.backup-<pid>-<uuid>`, install staging, and remove backup. Roll back the backup if the install
rename fails. Never delete or replace a path outside the exact managed root.

Check mode rebuilds expected bytes in memory, reads the existing manifest and each managed WebP,
compares exact bytes, and rejects missing or unexpected files. It performs no mkdir, write, rename,
or remove call.

- [ ] **Step 5: Add the CLI and focused typecheck**

The CLI accepts exactly one argument:

```ts
const mode = process.argv.at(-1);
if (mode !== '--write' && mode !== '--check')
  throw new Error('Usage: tsx tools/export-wiki-skill-visual-catalog.ts --write|--check');
const built = await buildWikiSkillVisualCatalog();
if (mode === '--write') await writeWikiSkillVisualCatalog(built);
else await checkWikiSkillVisualCatalog(built);
```

Add all three new TypeScript files to `tools/tsconfig.skill-icon-production.json`.

- [ ] **Step 6: Verify and commit Task 1**

```bash
corepack pnpm vitest run tools/wiki-skill-visual-catalog-lib.spec.ts
corepack pnpm tsc -p tools/tsconfig.skill-icon-production.json --noEmit
git diff --check
git add tools/wiki-skill-visual-catalog-lib.ts \
  tools/wiki-skill-visual-catalog-lib.spec.ts \
  tools/export-wiki-skill-visual-catalog.ts \
  tools/tsconfig.skill-icon-production.json
git commit -m "feat(wiki): add skill visual catalog exporter"
git push
```

---

### Task 2: Publish and validate all 456 browser derivatives

**Files:**

- Create: `apps/web/static/wiki-media/skills/visual-catalog-v1/manifest.json`
- Create: 456 WebPs under `apps/web/static/wiki-media/skills/visual-catalog-v1/icons/`
- Modify: `package.json`

**Interfaces:**

- Consumes: Task 1 exporter.
- Produces: `/wiki-media/skills/visual-catalog-v1/icons/<hash-named-file>.webp` and two package
  scripts.

- [ ] **Step 1: Add export/check package scripts**

Add:

```json
"export:wiki-skill-visual-catalog": "tsx tools/export-wiki-skill-visual-catalog.ts --write",
"validate:wiki-skill-visual-catalog": "tsx tools/export-wiki-skill-visual-catalog.ts --check"
```

- [ ] **Step 2: Generate the managed directory once**

```bash
corepack pnpm export:wiki-skill-visual-catalog
```

Expected summary: 456 sources, 456 WebPs, 512×512, total no more than 44,040,192 bytes, and no
individual file above 133,120 bytes.

- [ ] **Step 3: Prove deterministic zero-write validation**

```bash
git status --short > /tmp/summonlab-skill-catalog-before.txt
corepack pnpm validate:wiki-skill-visual-catalog
git status --short > /tmp/summonlab-skill-catalog-after.txt
diff -u /tmp/summonlab-skill-catalog-before.txt /tmp/summonlab-skill-catalog-after.txt
```

Expected: check succeeds and the status snapshots are identical.

- [ ] **Step 4: Inspect representative alpha and detail**

Inspect one F, E, D, C, B, A, and S derivative plus one icon from each Domain. Confirm solid image
content remains centered, transparent exterior survives WebP export, the complete frame is visible,
and no derivative uses a checkerboard background. This is delivery-fidelity inspection only; record
existing art defects against the separate cleanup issue.

- [ ] **Step 5: Commit and push Task 2**

```bash
git add package.json apps/web/static/wiki-media/skills/visual-catalog-v1
git commit -m "feat(wiki): publish skill catalog visuals"
git push
```

---

### Task 3: Build the strict server-side skill view model

**Files:**

- Create: `apps/web/src/lib/server/skill-visual-catalog.ts`
- Create: `apps/web/src/lib/server/skill-visual-catalog.spec.ts`

**Interfaces:**

- Consumes: canonical catalog JSON, completed mass manifest, and Task 2 runtime manifest.
- Produces:

```ts
export interface SkillVisualCatalogRecord {
  targetId: string;
  name: string;
  domain: 'Martial' | 'Magical' | 'Craft';
  family: string;
  labels: readonly { namespace: 'Equipment' | 'Element'; value: string }[];
  type: 'Active' | 'Passive' | 'Stance' | 'Craft';
  acquisition: string;
  effect: string;
  motifFamily: string;
  primaryVisualParent: { targetId: string; name: string } | null;
  image: { publicPath: string; width: 512; height: 512 };
  provenance: {
    status: 'candidate';
    sourcePath: string;
    runtimePath: string;
  };
}
export function buildSkillVisualCatalog(input?: SkillVisualCatalogAuthorities):
  readonly SkillVisualCatalogRecord[];
export function getSkillVisualCatalog(): readonly SkillVisualCatalogRecord[];
```

- [ ] **Step 1: Write strict join tests and verify RED**

Require exact counts and all visible fields:

```ts
const records = getSkillVisualCatalog();
expect(records).toHaveLength(456);
expect(Object.fromEntries(['Martial', 'Magical', 'Craft'].map(
  (domain) => [domain, records.filter((record) => record.domain === domain).length]
))).toEqual({ Martial: 258, Magical: 124, Craft: 74 });
expect(records[0]).toMatchObject({
  targetId: expect.any(String),
  acquisition: expect.any(String),
  effect: expect.any(String),
  motifFamily: expect.any(String),
  image: { width: 512, height: 512 }
});
expect(records[0]).not.toHaveProperty('rarity');
```

Fixture tests must reject a missing runtime record, duplicate target ID, source hash mismatch,
unknown Domain/type/label namespace, unresolved parent ID, and a public path outside
`/wiki-media/skills/visual-catalog-v1/icons/`.

Run:

```bash
corepack pnpm --filter @summonlab/web vitest run src/lib/server/skill-visual-catalog.spec.ts
```

Expected RED: the server module does not exist.

- [ ] **Step 2: Implement runtime-manifest integrity validation**

Import the three JSON files server-side. Parse object/array/string/literal fields explicitly rather
than casting the whole document. Verify the runtime source-authority hashes, 456 unique records,
each source path/hash against the mass record, and each public path/file relation.

- [ ] **Step 3: Implement the canonical join**

Sort in canonical catalog order. Resolve `primaryVisualParent` through the canonical record map and
return only the interface above. Do not include rank in the returned view model. Freeze the
constructed record array so request handlers cannot mutate shared module state.

- [ ] **Step 4: Verify and commit Task 3**

```bash
corepack pnpm --filter @summonlab/web vitest run src/lib/server/skill-visual-catalog.spec.ts
corepack pnpm --filter @summonlab/web typecheck
git diff --check
git add apps/web/src/lib/server/skill-visual-catalog.ts \
  apps/web/src/lib/server/skill-visual-catalog.spec.ts
git commit -m "feat(wiki): expose canonical skill visual records"
git push
```

---

### Task 4: Implement deterministic search, filters, and visible windows

**Files:**

- Create: `apps/web/src/lib/components/wiki/skill-visual-catalog-model.ts`
- Create: `apps/web/src/lib/components/wiki/skill-visual-catalog-model.spec.ts`

**Interfaces:**

- Consumes: `readonly SkillVisualCatalogRecord[]` from Task 3.
- Produces:

```ts
export const SKILL_CATALOG_PAGE_SIZE = 120;
export interface SkillCatalogFilters {
  q: string;
  domain: '' | 'Martial' | 'Magical' | 'Craft';
  family: string;
  motif: string;
}
export const EMPTY_SKILL_CATALOG_FILTERS: SkillCatalogFilters;
export function parseSkillCatalogQuery(search: string, records: readonly SkillVisualCatalogRecord[]):
  SkillCatalogFilters;
export function serializeSkillCatalogQuery(filters: SkillCatalogFilters): string;
export function compatibleSkillCatalogOptions(records: readonly SkillVisualCatalogRecord[],
  filters: SkillCatalogFilters): { families: readonly string[]; motifs: readonly string[] };
export function normalizeSkillCatalogFilters(records: readonly SkillVisualCatalogRecord[],
  filters: SkillCatalogFilters): SkillCatalogFilters;
export function filterSkillVisualCatalog(records: readonly SkillVisualCatalogRecord[],
  filters: SkillCatalogFilters): readonly SkillVisualCatalogRecord[];
```

- [ ] **Step 1: Write model tests and verify RED**

Use a six-record fixture spanning all Domains, two families, labels, acquisition, effects, motifs,
and one visual parent. Assert case-insensitive whitespace-normalized search across every specified
field; combined filters; Domain-dependent Family options; Domain/Family-dependent motif options;
incompatible narrower-filter clearing; stable source order; URL parse/serialize round trips; invalid
query value removal; and page boundaries 120/240/360/456.

Run:

```bash
corepack pnpm --filter @summonlab/web vitest run \
  src/lib/components/wiki/skill-visual-catalog-model.spec.ts
```

Expected RED: the model module does not exist.

- [ ] **Step 2: Implement normalized searchable text**

Build the haystack without rank or technical paths:

```ts
function searchable(record: SkillVisualCatalogRecord): string {
  return [record.name, record.domain, record.family,
    ...record.labels.flatMap(({ namespace, value }) => [namespace, value]),
    record.type, record.acquisition, record.effect, record.motifFamily,
    record.primaryVisualParent?.name ?? '']
    .join(' ')
    .toLocaleLowerCase('en')
    .replace(/\s+/gu, ' ')
    .trim();
}
```

Normalize query text with the same function. Preserve canonical record order.

- [ ] **Step 3: Implement compatible options and query serialization**

Return sorted unique options after applying only broader filters. Use `URLSearchParams`; omit empty
keys and emit them in fixed order `q`, `domain`, `family`, `motif`. Normalization clears Family when
it is not compatible with Domain and clears Motif when it is not compatible with Domain/Family.

- [ ] **Step 4: Verify and commit Task 4**

```bash
corepack pnpm --filter @summonlab/web vitest run \
  src/lib/components/wiki/skill-visual-catalog-model.spec.ts
git diff --check
git add apps/web/src/lib/components/wiki/skill-visual-catalog-model.ts \
  apps/web/src/lib/components/wiki/skill-visual-catalog-model.spec.ts
git commit -m "feat(wiki): add skill catalog filters"
git push
```

---

### Task 5: Build and integrate the permanent wiki page

**Files:**

- Create: `apps/web/src/lib/components/wiki/SkillVisualCatalog.svelte`
- Modify: `apps/web/src/routes/wiki/[...slug]/+page.server.ts`
- Modify: `apps/web/src/routes/wiki/[...slug]/+page.svelte`
- Modify: `apps/web/src/lib/server/wiki.spec.ts`
- Create: `docs/wiki/mechanics/skills/visual-catalog.md`
- Modify: `docs/wiki/mechanics/skills/README.md`
- Modify: `docs/wiki/catalog.json`
- Modify: `apps/web/DESIGN.md`

**Interfaces:**

- Consumes: `getSkillVisualCatalog()` and Task 4 model functions.
- Produces: `data.skillVisualCatalog` only when `wikiId === 'skills.visual-catalog'` and the public
  route `/wiki/mechanics/skills/visual-catalog`.

- [ ] **Step 1: Add failing wiki registration/load tests**

Extend `apps/web/src/lib/server/wiki.spec.ts`:

```ts
const page = getWikiPage('mechanics/skills/visual-catalog');
expect(page).toMatchObject({
  wikiId: 'skills.visual-catalog',
  href: '/wiki/mechanics/skills/visual-catalog'
});
const loaded = loadWikiPage({ params: { slug: 'mechanics/skills/visual-catalog' } } as never);
expect(loaded.skillVisualCatalog).toHaveLength(456);
expect(loaded.monsterDatabase).toBeNull();
```

Run:

```bash
corepack pnpm --filter @summonlab/web vitest run src/lib/server/wiki.spec.ts
```

Expected RED: the page and load field do not exist.

- [ ] **Step 2: Register canonical wiki content**

Create `visual-catalog.md` with a title, one paragraph describing the joined view, and links back to
the Skills index and framework. Add a catalog entry:

```json
{
  "wikiId": "skills.visual-catalog",
  "path": "docs/wiki/mechanics/skills/visual-catalog.md",
  "pageType": "skill-visual-catalog",
  "owner": "skill-catalog",
  "designStatus": "approved",
  "implementationStatus": "implemented",
  "visualStatus": "candidate",
  "spoilerScope": "public"
}
```

Add `Visual catalog` under Catalog navigation in `README.md`. Update `apps/web/DESIGN.md` with the
four-card exception, solid-dark image well, no duplicate rarity text, and no checkerboard rule.

- [ ] **Step 3: Load records only for the new wiki ID**

Import `getSkillVisualCatalog` in `+page.server.ts` and return:

```ts
skillVisualCatalog:
  wikiPage.wikiId === 'skills.visual-catalog' ? getSkillVisualCatalog() : null
```

Keep monster and visual-packet branches unchanged.

- [ ] **Step 4: Build the Svelte component**

Use Svelte 5 runes with one `filters` state and one `visibleCount` state. Initialize query state in
the browser from `window.location.search`, normalize after every broader filter change, reset
`visibleCount` to 120, and call `history.replaceState` with the serialized query.

Render native labeled search/select controls, an `aria-live="polite"` status with the displayed
range, semantic `article`
cards, lazy 512×512 images, definition rows, native provenance `details`, clear actions, no-results
copy, and a `Load more` button whose label includes the exact next batch size. Each activation moves
focus with `preventScroll` to the first appended heading, including the final batch where the button
disappears.

Use this exact hierarchy:

```svelte
<section class="skill-catalog" aria-labelledby="skill-catalog-heading">
  <header class="catalog-intro">...</header>
  <form class="catalog-controls" onsubmit={(event) => event.preventDefault()}>...</form>
  <p class="result-count" role="status" aria-live="polite">...</p>
  <div class="skill-grid">
    {#each visibleRecords as skill (skill.targetId)}
      <article class="skill-card">...</article>
    {/each}
  </div>
  {#if visibleRecords.length < matchingRecords.length}<button>Load more...</button>{/if}
</section>
```

Styles consume the existing archive colors. Make the catalog an inline-size container and use
`grid-template-columns: repeat(4, minmax(0, 1fr))` above 64rem of available catalog width, then
3/2/1 at 52rem and 30rem. Use `aspect-ratio: 1`, `object-fit: contain`, and `background: #090805`
for image wells. Use square surfaces, fine dividers, Georgia headings/body, monospace metadata,
visible focus, 40px control targets, and reduced-motion rules.

- [ ] **Step 5: Select the dedicated page renderer**

Import `SkillVisualCatalog` in `+page.svelte` and add the branch before generic Markdown:

```svelte
{#if data.wikiPage.wikiId === 'skills.visual-catalog' && data.skillVisualCatalog}
  <SkillVisualCatalog records={data.skillVisualCatalog} />
  <div class="article-body">{@html data.wikiPage.bodyHtml}</div>
{:else if data.wikiPage.wikiId === 'skills.index'}
  ...existing SkillTree branch...
{:else}
  ...existing generic branch...
{/if}
```

Preserve the standard article metadata and canonical source footer.

- [ ] **Step 6: Run focused validation and commit Task 5**

```bash
corepack pnpm --filter @summonlab/web vitest run \
  src/lib/server/wiki.spec.ts \
  src/lib/server/skill-visual-catalog.spec.ts \
  src/lib/components/wiki/skill-visual-catalog-model.spec.ts
corepack pnpm validate:wiki
corepack pnpm --filter @summonlab/web typecheck
git diff --check
git add apps/web/src/lib/components/wiki/SkillVisualCatalog.svelte \
  apps/web/src/routes/wiki/'[...slug]'/+page.server.ts \
  apps/web/src/routes/wiki/'[...slug]'/+page.svelte \
  apps/web/src/lib/server/wiki.spec.ts \
  docs/wiki/mechanics/skills/visual-catalog.md \
  docs/wiki/mechanics/skills/README.md docs/wiki/catalog.json apps/web/DESIGN.md
git commit -m "feat(wiki): publish the skill visual catalog"
git push
```

---

### Task 6: Verify browser behavior, performance, and final integration

**Files:**

- Create: `apps/web/src/routes/wiki-skill-visual-catalog.e2e.ts`
- Create: `docs/superpowers/reports/2026-09-04-wiki-skill-visual-catalog.md`

**Interfaces:**

- Consumes: complete route from Tasks 1–5.
- Produces: browser regression coverage and final evidence report.

- [ ] **Step 1: Write Playwright coverage and verify RED when disabled behavior is asserted**

Cover:

```ts
test('filters, shares, expands, and clears the complete skill catalog', async ({ page }) => {
  await page.goto('/wiki/mechanics/skills/visual-catalog');
  await expect(page.getByRole('status')).toContainText('456 skills');
  await expect(page.locator('.skill-card')).toHaveCount(120);
  await page.getByLabel('Domain').selectOption('Martial');
  await expect(page.getByRole('status')).toContainText('258 skills');
  await page.getByLabel('Family').selectOption('Blade');
  await page.getByRole('searchbox').fill('parry');
  await expect(page).toHaveURL(/domain=Martial/);
  await expect(page).toHaveURL(/family=Blade/);
  await expect(page).toHaveURL(/q=parry/);
  await page.getByRole('button', { name: /clear filters/i }).click();
  await expect(page.getByRole('status')).toContainText('456 skills');
  await page.getByRole('button', { name: /load 120 more/i }).click();
  await expect(page.locator('.skill-card')).toHaveCount(240);
});
```

Add direct query hydration, Motif Family filtering, incompatible filter reset, no-results recovery,
provenance details, keyboard traversal, image alt text, no separate rarity metadata, and image
`loading="lazy"` assertions.

Run the new spec once before its selectors are satisfied to observe RED, then correct component or
test contract—not both at once.

- [ ] **Step 2: Add desktop and phone layout assertions**

At 1440×1000, require four first-row cards with non-overlapping bounding boxes. At 390×844, require
one column, wrapped controls, and `document.documentElement.scrollWidth === 390`. Confirm the first
image well computed background is `rgb(9, 8, 5)` and no checkerboard/repeating-conic background is
present.

- [ ] **Step 3: Run the full verification matrix**

```bash
corepack pnpm validate:wiki-skill-visual-catalog
corepack pnpm validate:wiki
corepack pnpm tsc -p tools/tsconfig.skill-icon-production.json --noEmit
corepack pnpm vitest run tools/wiki-skill-visual-catalog-lib.spec.ts
corepack pnpm --filter @summonlab/web test
corepack pnpm --filter @summonlab/web typecheck
corepack pnpm --filter @summonlab/web lint
corepack pnpm --filter @summonlab/web test:e2e -- wiki-skill-visual-catalog.e2e.ts
corepack pnpm --filter @summonlab/web build
corepack pnpm validate:web-build-budget
git diff --check
```

Expected: all commands pass; 456 derivative records remain hash-clean; the build does not bundle the
806 MiB PNG source directory; and the client initially creates 120 cards rather than 456.

- [ ] **Step 4: Serve and inspect the final route**

Start the production preview on an unused port bound to all interfaces:

```bash
corepack pnpm --filter @summonlab/web preview --host 0.0.0.0 --port 4189
```

Verify the listener with `ss -ltnp | rg ':4189'` and review:

```text
http://10.110.24.218:4189/wiki/mechanics/skills/visual-catalog
```

Test search, dependent filters, direct URL reload, load-more progression, provenance details, the
four-card desktop row, and the 390px single-column view. Decisions sought at final review are card
density, metadata hierarchy, and whether any symbolic content belongs in the separate cleanup list.

- [ ] **Step 5: Record evidence, commit, and push Task 6**

The report records commands and results, exact derivative totals/bytes, representative asset paths,
desktop/mobile screenshots, preview URL, known icon-quality issue link, and final commit hashes.

```bash
git add apps/web/src/routes/wiki-skill-visual-catalog.e2e.ts \
  docs/superpowers/reports/2026-09-04-wiki-skill-visual-catalog.md
git commit -m "test(wiki): verify skill visual catalog"
git push
```

## Definition of Done

- All six tasks are committed and pushed on the implementation branch.
- Exactly 456 candidate skills and 456 512px WebPs validate with exact hashes.
- Total browser image output is no more than 42 MiB; no derivative exceeds 130 KiB.
- `/wiki/mechanics/skills/visual-catalog` is discoverable from Skills and from wiki navigation.
- Every card exposes all approved authored and motif information without duplicate rarity text.
- Search, Domain, Family, Motif Family, URL state, clear, no-results, details, and load more work by
  pointer and keyboard.
- Desktop renders four cards per row and 390px has no horizontal overflow.
- The image well is solid dark and does not reproduce the checkerboard review artifact.
- Focused tests, complete web tests, typecheck, lint, Playwright, wiki validation, derivative check,
  production build, and build-budget validation all pass.
- The icon-quality issue remains separate, linked, and does not mutate source candidates during this
  implementation.
