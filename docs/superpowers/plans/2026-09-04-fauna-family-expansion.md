# Fauna Family Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Design nine new expedition-first enemy families with complete T1–T5 combat and visual progressions while leaving every existing 30-family image coordinate untouched.

**Architecture:** Keep `family-affinity-v1` immutable as the completed 30-family, 750-coordinate production set. Add a collision-safe `fauna-family-v1` planning root containing nine compatible family packets and one scope manifest, then publish the same approved design as a human-readable wiki specification. No targets, assignments, candidates, reviews, approvals, or runtime catalog entries are created in this batch.

**Tech Stack:** Markdown, JSON family packets, TypeScript/Zod validation, Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-04-fauna-family-expansion-design.md`

## Global Constraints

- The existing 30 families and all 750 generated coordinates remain byte-for-byte outside this change.
- The expansion contains exactly nine families: Wolves, Bears, Boars, Burrowers, Great Cats, Serpents, Crocodilians, Raptors, and Rodents.
- Every family contains exactly T1, T2, T3, T4, and T5; T3 is a qualitative Specialist pivot and T5 is a Sovereign boss.
- Future image scope is exactly 45 new forms × five targets (`normal`, `fire`, `earth`, `wind`, `water`) = 225 new coordinates.
- Existing fauna and bridge pixels remain candidate/reference evidence only and receive no automatic approval or runtime status.
- This batch performs no image generation and no shared runtime catalog mutation.

---

### Task 1: Freeze the production boundary and specify the expansion

**Files:**
- Create: `docs/superpowers/specs/2026-09-04-fauna-family-expansion-design.md`
- Modify: `docs/superpowers/plans/2026-09-03-monster-image-single-checkpoint-goal-harness.md`

**Interfaces:**
- Consumes: the accepted five-tier grammar and affinity contract from `docs/superpowers/specs/2026-09-01-monster-family-floor-image-production-design.md`.
- Produces: the authoritative human-readable scope, family roster, 45-form ledger, legacy mappings, and explicit non-regeneration rule.

- [x] **Step 1: Write the expansion specification**

  Record the nine-family roster, all 45 forms, combat duties, teaching goals, mechanics, telegraphs, counterplay, lower-form interactions, visual escalation, and shared affinity rules. State that original-family regeneration is forbidden.

- [x] **Step 2: Supersede the old harness scope**

  Add a historical-scope note to the 750-image harness explaining that it remains evidence for the completed original matrix and must not be rerun; future production is restricted to the new 225-coordinate fauna expansion.

- [x] **Step 3: Check terminology and counts**

  Run: `rg -n "nine|45|225|750|regenerat|runtime" docs/superpowers/specs/2026-09-04-fauna-family-expansion-design.md docs/superpowers/plans/2026-09-03-monster-image-single-checkpoint-goal-harness.md`

  Expected: all counts and the frozen-original boundary are explicit, with no instruction to regenerate an existing family.

### Task 2: Add machine-readable fauna family packets

**Files:**
- Create: `assets/enemies/experiments/fauna-family-v1/active-sources.json`
- Create: `assets/enemies/experiments/fauna-family-v1/manifest.json`
- Create: `assets/enemies/experiments/fauna-family-v1/families/01-wolves.json`
- Create: `assets/enemies/experiments/fauna-family-v1/families/02-bears.json`
- Create: `assets/enemies/experiments/fauna-family-v1/families/03-boars.json`
- Create: `assets/enemies/experiments/fauna-family-v1/families/04-burrowers.json`
- Create: `assets/enemies/experiments/fauna-family-v1/families/05-great-cats.json`
- Create: `assets/enemies/experiments/fauna-family-v1/families/06-serpents.json`
- Create: `assets/enemies/experiments/fauna-family-v1/families/07-crocodilians.json`
- Create: `assets/enemies/experiments/fauna-family-v1/families/08-raptors.json`
- Create: `assets/enemies/experiments/fauna-family-v1/families/09-rodents.json`

**Interfaces:**
- Consumes: `FamilyPacketSchema` from `tools/family-affinity-production-lib.ts` and the Task 1 specification.
- Produces: nine source packets compatible with later collision-safe target materialization, plus a manifest that declares planning-only status and 225 unmaterialized coordinates.

- [x] **Step 1: Add the nine packets**

  Encode each approved family using `family-packet-v1`, including five affinity themes and exactly five authored forms.

- [x] **Step 2: Add source and scope manifests**

  List exactly the nine packet paths. Declare `existingFamilyAction: "retain-without-regeneration"`, `candidateCount: 0`, `approvedCount: 0`, `runtimeCount: 0`, and `targetMaterializationStatus: "not-started"`.

- [x] **Step 3: Validate raw JSON**

  Run: `for file in assets/enemies/experiments/fauna-family-v1/**/*.json assets/enemies/experiments/fauna-family-v1/*.json; do jq -e . "$file" >/dev/null; done`

  Expected: exit 0.

### Task 3: Add executable design validation

**Files:**
- Create: `tools/fauna-family-design.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: the nine packet paths and `FamilyPacketSchema`.
- Produces: `pnpm validate:fauna-family-design`, which proves roster, tier, ID, affinity, count, scope, legacy mapping, and original-manifest immutability assumptions.

- [x] **Step 1: Write the validation test**

  Assert exactly nine unique family packets; exactly 45 unique forms; T1–T5 once per family; five affinity themes; exactly 225 planned coordinates; zero generated/approved/runtime entries; and `retain-without-regeneration` for existing families. Assert that `family-affinity-v1/manifest.json` still reports 30 families, 150 forms, and 750 assignments.

- [x] **Step 2: Run the new test**

  Run: `pnpm vitest run tools/fauna-family-design.spec.ts`

  Expected: PASS.

- [x] **Step 3: Add and run the package command**

  Add `"validate:fauna-family-design": "vitest run tools/fauna-family-design.spec.ts"` and run `pnpm validate:fauna-family-design`.

  Expected: PASS.

### Task 4: Publish the wiki entry and verify the batch

**Files:**
- Create: `docs/wiki/creatures/fauna-family-expansion.md`
- Modify: `docs/wiki/README.md`
- Modify: `docs/wiki/catalog.json`
- Modify: `docs/wiki/creatures/monsters/README.md`
- Modify: `docs/wiki/creatures/monster-races/README.md`
- Modify: `tools/wiki-monster-database-lib.ts`

**Interfaces:**
- Consumes: the Task 1 specification and Task 2 packet paths.
- Produces: a discoverable wiki summary that distinguishes the completed original database from the planned 225-coordinate fauna-only expansion.

- [x] **Step 1: Add the wiki page and index links**

  Present the nine progressions in compact tables, link the preserved Normal candidates for Grey Wolf, Dire Wolf, Cave Bear, Tunnel Boar, and Burrowing Worm, and label all inherited imagery as candidate/reference-only.

- [x] **Step 2: Verify generated-wiki compatibility**

  Run: `pnpm validate:wiki-monsters && pnpm validate:wiki`

  Expected: PASS; the generated 30-family database remains valid and the separate expansion page is discoverable.

- [x] **Step 3: Run formatting and focused validation**

  Run: `pnpm exec prettier --check docs/superpowers/plans/2026-09-04-fauna-family-expansion.md docs/superpowers/specs/2026-09-04-fauna-family-expansion-design.md docs/wiki/README.md docs/wiki/catalog.json docs/wiki/creatures/monster-races/README.md docs/wiki/creatures/monsters/README.md docs/wiki/creatures/fauna-family-expansion.md assets/enemies/experiments/fauna-family-v1 tools/fauna-family-design.spec.ts tools/wiki-monster-database-lib.ts package.json`

  Expected: PASS.

- [x] **Step 4: Confirm protected assets were not modified**

  Run: `git diff --name-only 61f80eae -- assets/enemies/experiments/family-affinity-v1 | wc -l`

  Expected: `0`.

- [x] **Step 5: Commit and push**

  Run:

  ```bash
  git add docs/superpowers/plans/2026-09-04-fauna-family-expansion.md \
    docs/superpowers/specs/2026-09-04-fauna-family-expansion-design.md \
    docs/wiki/README.md docs/wiki/catalog.json docs/wiki/creatures/monster-races/README.md \
    docs/wiki/creatures/monsters/README.md tools/wiki-monster-database-lib.ts \
    docs/wiki/creatures/fauna-family-expansion.md \
    assets/enemies/experiments/fauna-family-v1 tools/fauna-family-design.spec.ts package.json
  git commit -m "feat(enemies): design fauna family expansion"
  git push
  ```

  Expected: the current `codex/` branch is pushed and the working tree is clean.
