# Four-Element Domain Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a literal `Skills → Martial | Magic | Craft` tree with three circular domain-image nodes, a selectable full-width family branch, a four-element Magic emblem, and a migration ledger that deletes Metal without inventing Wind skills.

**Architecture:** Keep the canonical taxonomy model at `Domain → Family → Skill`, with Equipment and Element as optional terminal labels. `Magical` remains the internal/canonical domain; `Magic` is presentation copy only. The Svelte component owns one nullable selected-domain id and renders one shared branch beneath the three roots. The migration exporter remains the sole writer of the checked-in ledger, and legacy inventory provenance remains immutable.

**Tech Stack:** Svelte 5 runes, TypeScript 6, Vitest, Playwright, Sharp, repository Markdown/JSON generators, built-in image generation.

**Spec:** `docs/superpowers/specs/2026-09-01-four-element-domain-tree-design.md`

## Global Constraints

- Keep `apps/web/static/wiki-media/skills/martial-domain.webp` and `craft-domain.webp` byte-for-byte unchanged.
- Keep `apps/web/static/wiki-media/skills/magical-domain.webp` as unmodified provenance; ship a versioned `magical-domain-v2.webp`.
- Use Fire, Water, Wind, and Earth as the only active Element labels. Earth stands alone; never rebrand Wood or Metal as Earth.
- Do not publish or invent a Wind skill ladder.
- Do not add skill-card frames, rarity cues, levels, or progression visualization in this pass.
- Preserve the active target at 456 published skills: 258 Martial, 124 Magical, and 74 Craft.
- Use tests before implementation changes, run the narrowest failing test first, and commit each completed task.
- Do not merge to `main` until all gates pass and the user approves the live visual result.

---

## Task 1: Select and promote the four-element Magic emblem

**Files:**

- Reference only: `apps/web/static/wiki-media/skills/magical-domain.webp`
- Preserve: `apps/web/static/wiki-media/skills/martial-domain.webp`
- Preserve: `apps/web/static/wiki-media/skills/craft-domain.webp`
- Create: `apps/web/static/wiki-media/skills/magical-domain-v2.webp`

**Existing review candidates:**

- Prototype A — cardinal astrolabe: `/home/joao/.codex/generated_images/01a058d5-4568-76e1-bae0-81d6988ab046/exec-fef3f355-aa58-48da-9fbf-bda2db70bf6a.png`
- Prototype B — elemental quadrant wheel: `/home/joao/.codex/generated_images/01a058d5-4568-76e1-bae0-81d6988ab046/exec-f7e1efa0-f6eb-4516-b1d1-be4751a9c949.png`

- [ ] **Step 1: Record the protected asset hashes**

Run:

```bash
sha256sum \
  apps/web/static/wiki-media/skills/martial-domain.webp \
  apps/web/static/wiki-media/skills/craft-domain.webp \
  apps/web/static/wiki-media/skills/magical-domain.webp
```

Save the three values in the implementation notes for the final comparison; do not modify these files.

- [ ] **Step 2: Obtain the prototype decision**

Show A and B together. Recommend B for a small circular node because its boundary and four-way reading remain clearer after cropping. Accept one of three outcomes: A, B, or one bounded revision of the preferred candidate. Do not promote an image before this decision.

If revision is requested, use the built-in image-generation tool with the chosen candidate as the edit target and repeat all invariants: exactly four nodes; Fire top; Wind right; Earth bottom; Water left; no Wood, Metal, fifth symbol, lettering, or blade.

- [ ] **Step 3: Convert the chosen candidate into the versioned project asset**

For Prototype A, run:

```bash
pnpm exec node --input-type=module -e "import sharp from 'sharp'; await sharp(process.argv[1]).resize(1200, 1200, { fit: 'cover' }).webp({ quality: 88 }).toFile(process.argv[2]);" \
  /home/joao/.codex/generated_images/01a058d5-4568-76e1-bae0-81d6988ab046/exec-fef3f355-aa58-48da-9fbf-bda2db70bf6a.png \
  apps/web/static/wiki-media/skills/magical-domain-v2.webp
```

For Prototype B, run the same command with this source:

```bash
/home/joao/.codex/generated_images/01a058d5-4568-76e1-bae0-81d6988ab046/exec-f7e1efa0-f6eb-4516-b1d1-be4751a9c949.png
```

- [ ] **Step 4: Verify dimensions, format, and protected hashes**

Run:

```bash
pnpm exec node --input-type=module -e "import sharp from 'sharp'; console.log(await sharp(process.argv[1]).metadata());" \
  apps/web/static/wiki-media/skills/magical-domain-v2.webp
sha256sum \
  apps/web/static/wiki-media/skills/martial-domain.webp \
  apps/web/static/wiki-media/skills/craft-domain.webp \
  apps/web/static/wiki-media/skills/magical-domain.webp
```

Expected: `format: 'webp'`, width `1200`, height `1200`, and all three protected hashes match Step 1.

Inspect `magical-domain-v2.webp` at original detail. Confirm exactly four readable nodes and a clean circular crop.

- [ ] **Step 5: Commit the selected asset**

```bash
git add apps/web/static/wiki-media/skills/magical-domain-v2.webp
git commit -m "feat(art): add four-element magic domain emblem"
```

---

## Task 2: Delete Metal migration targets and remove deferred-target machinery

**Files:**

- Modify: `tools/export-skill-taxonomy-migration.ts`
- Modify: `tools/export-skill-taxonomy-migration.spec.ts`
- Modify: `tools/skill-taxonomy-lib.ts`
- Modify: `tools/skill-taxonomy-lib.spec.ts`
- Regenerate: `docs/wiki/mechanics/skills/migration-v2.json`

- [ ] **Step 1: Write failing exporter expectations**

In `tools/export-skill-taxonomy-migration.spec.ts`, define published rows by actual published targets:

```ts
const activeRecords = ledger.records.filter((record) => record.target?.skill);
```

Change the count expectations to:

```ts
expect(domainCounts).toEqual({ Martial: 258, Magical: 124, Craft: 74 });
expect(activeRecords).toHaveLength(456);
```

Add an assertion over `Evocation — Metal`:

```ts
const metalRows = ledger.records.filter((record) => record.section === 'Evocation — Metal');
expect(metalRows).toHaveLength(18);
expect(
  metalRows.every(
    (record) =>
      record.disposition === 'delete' &&
      record.rationale === 'Metal affinity removed by accepted four-base model' &&
      !('target' in record)
  )
).toBe(true);
```

- [ ] **Step 2: Replace deferred-target tests with the deletion contract**

In `tools/skill-taxonomy-lib.spec.ts`, update the retired Elemental test so both Wood and Metal assert deletion with their distinct approved rationales. Delete the test named `requires a published target for non-Metal rows that claim deferred Wind metadata`, because the migration schema will no longer represent deferred targets.

Add this ledger-wide assertion:

```ts
expect(
  ledger.records.some(
    (record) => record.target && 'publication' in record.target
  )
).toBe(false);
```

- [ ] **Step 3: Run the focused tests and confirm RED**

```bash
pnpm exec vitest run tools/skill-taxonomy-lib.spec.ts tools/export-skill-taxonomy-migration.spec.ts
```

Expected: failures show Metal still maps to deferred Wind and the generated ledger still contains those targets.

- [ ] **Step 4: Change the exporter from deferred Wind to deletion**

In `tools/export-skill-taxonomy-migration.ts`, replace `deferredWindTarget` with:

```ts
const METAL_DELETE_RATIONALE = 'Metal affinity removed by accepted four-base model';
```

Replace the Metal branch with:

```ts
if (row.section === 'Evocation — Metal')
  return { ...row, disposition: 'delete', rationale: METAL_DELETE_RATIONALE };
```

- [ ] **Step 5: Simplify the migration target type**

In `tools/skill-taxonomy-lib.ts`, remove `DeferredSkillMigrationTarget` and make the target concrete:

```ts
export type SkillMigrationTarget = {
  domain: SkillDomain;
  family: string;
  skill: string;
  labels?: SkillLabel[];
};
```

Delete `isDeferredWindRewrite`, `hasValidDeferredWindTarget`, and both `publication === 'deferred'` branches. Retained, renamed, and rehomed records must always have a target with a skill; deleted records must have a rationale.

- [ ] **Step 6: Regenerate and verify the ledger**

```bash
pnpm exec tsx tools/export-skill-taxonomy-migration.ts --write
pnpm exec tsx tools/export-skill-taxonomy-migration.ts --check
pnpm exec vitest run tools/skill-taxonomy-lib.spec.ts tools/export-skill-taxonomy-migration.spec.ts
pnpm validate:skill-taxonomy
```

Expected: 520 immutable source rows, 456 published targets, all 18 Metal records deleted without `target`, and no deferred publication field anywhere in `migration-v2.json`.

- [ ] **Step 7: Commit the migration cleanup**

```bash
git add \
  tools/export-skill-taxonomy-migration.ts \
  tools/export-skill-taxonomy-migration.spec.ts \
  tools/skill-taxonomy-lib.ts \
  tools/skill-taxonomy-lib.spec.ts \
  docs/wiki/mechanics/skills/migration-v2.json
git commit -m "fix(skills): retire metal elemental ladder"
```

---

## Task 3: Add the Magic display contract and Wind empty result

**Files:**

- Modify: `apps/web/src/lib/components/wiki/skill-tree-data.ts`
- Modify: `apps/web/src/lib/components/wiki/skill-tree-data.spec.ts`

- [ ] **Step 1: Write failing navigation-data tests**

Add exact assertions:

```ts
expect(SKILL_DOMAINS.map(({ name }) => name)).toEqual(['Martial', 'Magic', 'Craft']);
expect(domain('magical')).toMatchObject({
  id: 'magical',
  name: 'Magic',
  image: '/wiki-media/skills/magical-domain-v2.webp'
});
```

Extend `SkillTreeFamily` test coverage so Elemental exposes:

```ts
emptyLabelMessages: {
  Wind: 'The Wind skill ladder is not published yet.'
}
```

Retain the exact filter order `Fire`, `Earth`, `Wind`, `Water`, and assert that representative skills have one Element label each and none uses Wood or Metal.

- [ ] **Step 2: Run the data test and confirm RED**

```bash
pnpm exec vitest run apps/web/src/lib/components/wiki/skill-tree-data.spec.ts
```

- [ ] **Step 3: Implement the presentation-only name and empty-message field**

Add to `SkillTreeFamily`:

```ts
emptyLabelMessages?: Partial<Record<string, string>>;
```

Change only the Magical display record:

```ts
{
  id: 'magical',
  name: 'Magic',
  image: '/wiki-media/skills/magical-domain-v2.webp',
  // ...
}
```

Add to its Elemental family:

```ts
emptyLabelMessages: {
  Wind: 'The Wind skill ladder is not published yet.'
},
```

Do not add a Wind representative skill.

- [ ] **Step 4: Run the data test and commit**

```bash
pnpm exec vitest run apps/web/src/lib/components/wiki/skill-tree-data.spec.ts
git add \
  apps/web/src/lib/components/wiki/skill-tree-data.ts \
  apps/web/src/lib/components/wiki/skill-tree-data.spec.ts
git commit -m "feat(wiki): define magic domain tree data"
```

---

## Task 4: Build the circular interactive domain tree

**Files:**

- Modify: `apps/web/src/lib/components/wiki/SkillTree.svelte`
- Modify: `apps/web/src/routes/wiki/skill-tree.e2e.ts`

- [ ] **Step 1: Rewrite the browser contract first**

In `apps/web/src/routes/wiki/skill-tree.e2e.ts`, make the first test assert:

```ts
const tree = page.getByRole('region', { name: 'Interactive skill tree' });
const martial = tree.getByRole('button', { name: /Martial.*5 families/i });
const magic = tree.getByRole('button', { name: /Magic.*5 families/i });
const craft = tree.getByRole('button', { name: /Craft.*5 families/i });

await expect(tree.getByText('Skills', { exact: true })).toBeVisible();
await expect(martial).toHaveAttribute('aria-expanded', 'false');
await expect(magic).toHaveAttribute('aria-expanded', 'false');
await expect(craft).toHaveAttribute('aria-expanded', 'false');
await expect(tree.locator('.domain-branch')).toHaveCount(0);
```

Then cover this sequence:

1. Click Martial: one branch appears and Blade is visible.
2. Click Martial again: branch count returns to zero.
3. Focus Magic and press Enter: Elemental is visible and `aria-expanded` is true.
4. Click Craft: Magic closes, Craft opens, and exactly one branch remains.
5. Return to Magic, select Wind, and assert the exact unpublished-ladder message plus zero Elemental representative links.

For the 390px test, assert all three node buttons are visible, each circular image wrapper has equal width and height, and `document.documentElement.scrollWidth <= 390`.

Update the reduced-motion test to inspect `.domain-branch` and `.domain-node-image` instead of the removed `.domain-stage` image.

- [ ] **Step 2: Run the browser test and confirm RED**

```bash
pnpm --filter @summonlab/web test:e2e -- src/routes/wiki/skill-tree.e2e.ts
```

- [ ] **Step 3: Implement nullable disclosure state**

Replace the required default with:

```ts
let selectedId = $state<DomainId | null>(null);
let activeDomain = $derived(
  selectedId ? (SKILL_DOMAINS.find((domain) => domain.id === selectedId) ?? null) : null
);

function toggleDomain(id: DomainId): void {
  selectedId = selectedId === id ? null : id;
}
```

Keep `selectedLabels` local and unchanged when switching roots so returning to a domain preserves the reader's filter during the page session.

- [ ] **Step 4: Replace the switcher and repeated figure with tree markup**

Use one semantic navigation region and one shared branch id:

```svelte
<div class="tree-root" aria-hidden="true"><span>Skills</span></div>

<nav class="domain-tree" aria-label="Skill domains">
  {#each SKILL_DOMAINS as domain (domain.id)}
    <button
      class:active={selectedId === domain.id}
      type="button"
      aria-expanded={selectedId === domain.id}
      aria-controls="skill-domain-branch"
      onclick={() => toggleDomain(domain.id)}
    >
      <span class="domain-node-image">
        <img src={domain.image} alt="" width="900" height="900" />
      </span>
      <strong>{domain.name}</strong>
      <small>{domain.families.length} families</small>
    </button>
  {/each}
</nav>

{#if activeDomain}
  <section id="skill-domain-branch" class="domain-branch" aria-label={`${activeDomain.name} families`}>
    <!-- domain copy and existing family ledger -->
  </section>
{/if}
```

Do not render a second large domain `<figure>`.

- [ ] **Step 5: Render a truthful family empty result**

Before each representative-skill navigation, derive its selected filter and visible set. When the set is empty, render:

```svelte
<p class="empty-result">
  {family.emptyLabelMessages?.[selectedLabels[family.name]] ??
    'No published representative skills match this label.'}
</p>
```

Do not render an empty `<nav>`.

- [ ] **Step 6: Implement the circular geometry and structural connectors**

Use CSS grid for the three roots and `aspect-ratio: 1` plus `border-radius: 50%` only on `.domain-node-image`. Use one pseudo-element for the horizontal branch and one per node for its short vertical stem. Use another short selected stem between `.domain-tree` and `.domain-branch`.

The circle size should be:

```css
width: clamp(5.5rem, 18vw, 13rem);
aspect-ratio: 1;
```

At `max-width: 640px`, hide family-count text if necessary, but retain all three domain names and side-by-side circles. Keep the family ledger flat and square. Add visible hover, focus-visible, active, and `[aria-expanded='true']` states. Under `prefers-reduced-motion: reduce`, remove transitions, transforms, and branch animation.

- [ ] **Step 7: Run focused UI verification**

```bash
pnpm exec prettier --write \
  apps/web/src/lib/components/wiki/SkillTree.svelte \
  apps/web/src/routes/wiki/skill-tree.e2e.ts
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web test:unit -- src/lib/components/wiki/skill-tree-data.spec.ts
pnpm --filter @summonlab/web test:e2e -- src/routes/wiki/skill-tree.e2e.ts
```

- [ ] **Step 8: Commit the interactive tree**

```bash
git add \
  apps/web/src/lib/components/wiki/SkillTree.svelte \
  apps/web/src/routes/wiki/skill-tree.e2e.ts
git commit -m "feat(wiki): add circular skill domain tree"
```

---

## Task 5: Align durable design and canonical wiki prose

**Files:**

- Modify: `apps/web/DESIGN.md`
- Modify: `docs/wiki/mechanics/skills/README.md`
- Modify: `docs/wiki/mechanics/skills/magical-elemental.md`

- [ ] **Step 1: Record the intentional circle exception**

In `apps/web/DESIGN.md`, replace the single-image signature with a rule that supports this surface:

```md
- **Memorable signature:** Expressive domain imagery anchors major reference surfaces; the skill
  taxonomy uses three circular image roots connected to one flat family ledger.
```

Update `Navigation and data display` to say circular nodes are reserved for top-level taxonomy roots. Update the anti-reference and Do/Don't language so structural connectors are permitted but ornamental diagrams remain forbidden.

- [ ] **Step 2: Clarify current Elemental publication**

In `docs/wiki/mechanics/skills/README.md` and `magical-elemental.md`, retain the canonical domain name `Magical` and make the rule explicit:

```md
Fire, Water, Wind, and Earth are the active Element labels. Fire, Water, and Earth currently have
published Elemental ladders. Wind is active but its skill ladder is not published yet. Wood and
Metal legacy ladders are deleted; neither is renamed or folded into Earth.
```

Do not change published skill rows.

- [ ] **Step 3: Validate prose and commit**

```bash
pnpm validate:wiki
pnpm exec prettier --check \
  apps/web/DESIGN.md \
  docs/wiki/mechanics/skills/README.md \
  docs/wiki/mechanics/skills/magical-elemental.md
git add \
  apps/web/DESIGN.md \
  docs/wiki/mechanics/skills/README.md \
  docs/wiki/mechanics/skills/magical-elemental.md
git commit -m "docs(skills): clarify four-element publication"
```

---

## Task 6: Verify the complete slice and prepare live review

**Files:**

- Verify: all files changed in Tasks 1–5
- Capture locally: Playwright screenshots or browser evidence; do not commit generated evidence unless the repository contract requires it

- [ ] **Step 1: Run the full focused gate from a clean command session**

```bash
pnpm exec vitest run \
  tools/skill-taxonomy-lib.spec.ts \
  tools/export-skill-taxonomy-migration.spec.ts \
  apps/web/src/lib/components/wiki/skill-tree-data.spec.ts
pnpm validate:wiki
pnpm validate:skill-taxonomy
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web lint
pnpm --filter @summonlab/web test:e2e -- src/routes/wiki/skill-tree.e2e.ts
pnpm --filter @summonlab/web build
git diff --check
```

- [ ] **Step 2: Audit generated and preserved artifacts**

```bash
jq -e '
  ([.records[] | select(.section == "Evocation — Metal")] | length == 18) and
  ([.records[] | select(.section == "Evocation — Metal" and (.disposition != "delete" or .target != null))] | length == 0) and
  ([.records[] | select(.target.skill != null)] | length == 456) and
  ([.records[] | select(.target.publication != null)] | length == 0)
' docs/wiki/mechanics/skills/migration-v2.json
sha256sum \
  apps/web/static/wiki-media/skills/martial-domain.webp \
  apps/web/static/wiki-media/skills/craft-domain.webp \
  apps/web/static/wiki-media/skills/magical-domain.webp
```

Compare the hashes with Task 1. Inspect the final v2 image again.

- [ ] **Step 3: Serve the wiki on the remote interface**

```bash
pnpm --filter @summonlab/web dev --host 0.0.0.0
```

Report the exact reachable URL using server IP `10.110.24.218` and Vite's displayed port, normally:

```text
http://10.110.24.218:5173/wiki/mechanics/skills
```

Ask the user to test:

1. Open, switch, and collapse Martial, Magic, and Craft.
2. Compare the three circular emblems at desktop and phone width.
3. Open Magic → Elemental → Wind and confirm the empty publication message feels truthful.

- [ ] **Step 4: Request code review before integration**

Use `superpowers:requesting-code-review`. Resolve any findings with `superpowers:receiving-code-review`, rerun the affected gates, and do not merge with unresolved correctness or accessibility issues.

- [ ] **Step 5: Confirm final repository state and push**

```bash
git status --short --branch
git log -5 --oneline
git push origin codex/four-element-domain-tree
```

Expected: branch is pushed, no in-scope changes are uncommitted, and the working tree is clean. After user visual approval, use `superpowers:finishing-a-development-branch` to integrate into `main` and push `main`.
