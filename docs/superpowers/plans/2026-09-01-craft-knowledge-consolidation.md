# Craft Knowledge Consolidation Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task with fresh implementers and reviewers.

**Goal:** Remove the Beast and Lore families, establish Craft's exact five-family taxonomy, and preserve creature acquisition versus creature combat through Gathering, Knowledge, and Martial/Body.

**Architecture:** Keep the immutable legacy inventory as the source of identity and encode every decision in the deterministic migration exporter. The generated migration ledger and canonical Markdown must agree exactly. The interactive tree remains a projection of the canonical taxonomy and retains the current visual language.

**Tech Stack:** TypeScript, Vitest, Markdown wiki sources, Svelte 5, Playwright

**Spec:** `docs/superpowers/specs/2026-09-01-craft-knowledge-consolidation-design.md`

---

### Task 1: Encode the five-family migration

**Files:**
- Modify: `tools/skill-taxonomy-lib.ts`
- Modify: `tools/skill-taxonomy-lib.spec.ts`
- Modify: `tools/export-skill-taxonomy-migration.ts`
- Modify: `tools/export-skill-taxonomy-migration.spec.ts`
- Regenerate: `docs/wiki/mechanics/skills/migration-v2.json`

**Step 1: Write failing migration tests**

Add assertions for:

- exact Craft families `Alchemy, Cooking, Forging, Gathering, Knowledge`;
- target totals `493`, with `258 Martial`, `160 Magical`, `75 Craft`;
- Craft counts `16, 12, 16, 18, 13` for Alchemy, Cooking, Forging, Gathering, and Knowledge;
- `Calm` and `Feed` merge into `Animal Handling`;
- former Beast rows rehome to their approved Gathering, Knowledge, or Body destinations;
- `Pack Bond` remains a separate Body skill whose replacement effect explicitly commands several tamed companions to coordinate attacks;
- `Greater Taming` follows `Taming`, not Pack Bond;
- active prerequisite text contains no `Beast prerequisite` or `Lore prerequisite`.

Run: `pnpm exec vitest run tools/skill-taxonomy-lib.spec.ts tools/export-skill-taxonomy-migration.spec.ts`
Expected: FAIL on the old six-family mapping and counts.

**Step 2: Implement deterministic mappings**

Update the allowed Craft families and exporter mappings. Preserve source identity, rarity, and skill type. Add explicit replacement effects/requirements where consolidation or rehoming changes semantics. Repair cross-family prerequisites to point to surviving skills.

**Step 3: Regenerate and verify the ledger**

Run: `pnpm exec tsx tools/export-skill-taxonomy-migration.ts --write`
Run: `pnpm exec vitest run tools/skill-taxonomy-lib.spec.ts tools/export-skill-taxonomy-migration.spec.ts`
Run: `pnpm validate:skill-taxonomy`
Expected: PASS after canonical Markdown is synchronized in Task 2; focused exporter tests should pass in this task.

**Step 4: Commit**

Commit message: `feat(skills): encode five-family craft migration`

### Task 2: Rewrite the canonical mechanics and knowledge sources

**Files:**
- Modify: `docs/wiki/mechanics/skills/craft-and-life.md`
- Modify: `docs/wiki/mechanics/skills/martial-body.md`
- Modify: `docs/wiki/mechanics/skills/README.md`
- Modify: `docs/wiki/mechanics/skills/framework.md`
- Modify: `docs/wiki/mechanics/progression/skills-and-ladders.md`
- Modify: relevant authored wiki references found by `rg -n "Beast|Lore" docs/wiki apps/web/src/routes/living-village-lab/summon/fixtures.ts`
- Modify: `apps/web/src/routes/living-village-lab/summon/fixtures.ts`

**Step 1: Add/adjust failing source-validation assertions**

Extend taxonomy tests so active authored sources cannot declare Beast or Lore as families and canonical target Markdown must match the generated ledger.

Run: `pnpm exec vitest run tools/skill-taxonomy-lib.spec.ts`
Expected: FAIL while old wiki text remains.

**Step 2: Apply the approved taxonomy**

- Fold Calm and Feed into Animal Handling's effect.
- Move Animal Handling, Taming, Breeding, Greater Taming, and Monarch of Beasts into Gathering.
- Rename Lore to Knowledge and add Beast Speech.
- Move Riding, Pack Bond, Mounted Combat, and Bonded Mount into Body.
- Describe Pack Bond as active multi-beast combat command on the hero's behalf.
- Repair numbering, counts, links, anchors, capability labels, fixtures, and prerequisites.
- Keep historical legacy inventory unchanged.

**Step 3: Validate canonical agreement**

Run: `pnpm validate:skill-taxonomy`
Run: `pnpm validate:wiki`
Run: `rg -n "\b(Beast|Lore)\b" docs/wiki apps/web/src/routes/living-village-lab/summon/fixtures.ts`
Expected: validators PASS; remaining matches, if any, refer to beasts as creatures or clearly historical records rather than active family labels.

**Step 4: Commit**

Commit message: `docs(skills): establish gathering and knowledge families`

### Task 3: Update and verify the interactive wiki

**Files:**
- Modify: `apps/web/src/lib/components/wiki/skill-tree-data.ts`
- Modify: `apps/web/src/lib/components/wiki/skill-tree-data.spec.ts`
- Modify: `apps/web/src/routes/wiki/skill-tree.e2e.ts`
- Preserve unless a durable new UI rule is required: `apps/web/DESIGN.md`

**Step 1: Write failing projection tests**

Assert exact 5/5/5 family symmetry, the absence of Beast/Lore nodes, and representative links for Gathering, Knowledge, and Body including Pack Bond.

Run: `pnpm exec vitest run apps/web/src/lib/components/wiki/skill-tree-data.spec.ts`
Expected: FAIL against the old six-family Craft projection.

**Step 2: Update the projection**

Update only taxonomy data and concise descriptions. Preserve current typography, layout, focus behavior, animation behavior, mobile behavior, and reduced-motion support.

**Step 3: Run focused UI verification**

Run: `pnpm exec vitest run apps/web/src/lib/components/wiki/skill-tree-data.spec.ts`
Run: `PLAYWRIGHT_PORT=4178 pnpm --filter @summonlab/web exec playwright test src/routes/wiki/skill-tree.e2e.ts`
Run: `pnpm --filter @summonlab/web lint`
Run: `pnpm --filter @summonlab/web check`
Run: `pnpm --filter @summonlab/web build`

Inspect `/wiki/skill-tree` in a live browser at desktop and mobile widths, confirming keyboard traversal, five Craft nodes, readable expanded skills, stable layout, and reduced-motion behavior.

**Step 4: Commit**

Commit message: `feat(wiki): project consolidated craft skill tree`

### Task 4: Whole-branch verification and integration

**Step 1: Run final review**

Dispatch one fresh whole-branch reviewer with the spec, plan, all task reports, and review packages. Apply at most one consolidated fix wave, then re-review the affected scope.

**Step 2: Run repository verification**

Run the strict frontend audit, taxonomy/wiki validators, focused E2E, full `pnpm test`, web lint/typecheck/build, and `git diff --check`.

Because the repository's image-production readiness test compares the project skill directory to the installed canonical skill by realpath, use the established temporary symlink wrapper for `pnpm test`, restoring the worktree path in a trap.

**Step 3: Integrate**

Merge the completed branch into `main`, rerun the critical validators on merged `main`, push `main`, and confirm a clean working tree.
