# Greatsword Source Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote seven reviewed Greatsword candidates into a hash-bound approved catalog and retire their superseded campaign pixels without changing runtime or gameplay content.

**Architecture:** A dedicated source-only Greatsword manifest and owner-approval receipt become the authority for seven approved masters. The existing campaign validator is extended to verify the frozen candidate/result/proportion chain against approved bytes and require historical candidate paths to be absent; repository policy aggregates both Equipment catalogs.

**Tech Stack:** TypeScript 6, Zod, Vitest 4, Sharp, Git LFS, deterministic JSON.

**Spec:** `docs/superpowers/specs/2026-09-07-greatsword-source-promotion-design.md`

## Global Constraints

- Promote exactly seven candidates in `F, E, D, C, B, A, S` order.
- Preserve Greatsword as visual family `greatsword`, mechanical class `sword`, two-handed, Heavy.
- Keep runtime at 140 bundles and 280 derivatives.
- Preserve compact campaign provenance and the accepted v2 direction board.
- Delete duplicate selected candidates and superseded/generated review rasters only after approved
  hashes and byte counts are recorded.
- Do not touch hero, enemy, skill-icon, or gameplay files.

---

### Task 1: Lock the approved Greatsword contract

**Files:**
- Modify: `tools/validate-greatsword-campaign-v1.spec.ts`
- Modify: `tools/repository-asset-policy.spec.ts`

**Interfaces:**
- Consumes: existing Greatsword campaign manifest, review manifest, results, and proportion reviews.
- Produces: failing expectations for seven approved sources, seven absent historical candidates,
  retired review paths, and the 168-source aggregate Equipment summary.

- [x] **Step 1: Write failing approved-source tests**

Assert that `validateGreatswordCampaignFiles()` reports `approved-sources-recorded`, seven approved
sources, and seven retired candidates. Assert that repository policy rejects Greatsword candidate
and generated review paths and reports 168 approved Equipment images totaling 229,920,937 bytes.

- [x] **Step 2: Run the focused tests and confirm RED**

```bash
pnpm exec vitest run tools/validate-greatsword-campaign-v1.spec.ts tools/repository-asset-policy.spec.ts
```

Expected: the campaign still reports review-pending and repository policy still reports only the
161-source material catalog.

### Task 2: Promote exact source bytes and retire duplicate pixels

**Files:**
- Create: `assets/equipment/approved/two-handed-greatsword-v1/manifest.json`
- Create: `assets/equipment/approved/two-handed-greatsword-v1/receipts/owner-approval-v1.json`
- Move: seven `assets/equipment/experiments/two-handed-greatsword-v1/candidates/**/greatsword-v1.png`
  files to `assets/equipment/approved/two-handed-greatsword-v1/items/**/greatsword.png`
- Delete: superseded Greatsword direction PNG attempts and generated review PNG/WebP/HTML files.

**Interfaces:**
- Consumes: exact review-manifest candidate paths/hashes and item result byte counts.
- Produces: seven immutable LFS-backed approved masters and a receipt binding the owner's all-seven
  acceptance.

- [x] **Step 1: Create the owner-approval receipt and approved manifest**

Record each target, rank, material, historical candidate path/hash, result path, proportion-review
path, approved path, dimensions, and byte count. Bind the manifest to the canonical receipt hash.

- [x] **Step 2: Move exact selected bytes into approved paths**

Use collision-safe rank/material destinations and verify every pre/post SHA-256 is identical.

- [x] **Step 3: Delete review-only and superseded rasters**

Keep `direction/greatsword-metal-ranks-v2.png`; remove the rejected v1 board, direction revision
PNGs, candidate duplicates, contact sheet, review thumbnails, and HTML review pages.

### Task 3: Validate the approved-only lifecycle

**Files:**
- Modify: `tools/validate-greatsword-campaign-v1.ts`
- Modify: `tools/repository-asset-policy.ts`
- Modify: `assets/equipment/experiments/two-handed-greatsword-v1/README.md`
- Modify: `assets/equipment/README.md`
- Modify: `docs/wiki/mechanics/equipment/weapons.md`

**Interfaces:**
- Consumes: the approved manifest/receipt and retained compact campaign records.
- Produces: approved-source validation, aggregate repository counts, and current lifecycle docs.

- [x] **Step 1: Extend Greatsword validation**

Validate schemas, canonical receipt binding, exact source hashes/dimensions, result and proportion
review bindings, LFS-ready approved layout, and absence of historical candidate paths.

- [x] **Step 2: Extend repository retention policy**

Reject tracked Greatsword candidate/revision/review rasters, invoke the approved validator, and sum
the seven sources into the Equipment totals.

- [x] **Step 3: Update lifecycle documentation**

Record that source promotion is complete while runtime/content/acquisition remain deferred.

- [x] **Step 4: Run focused tests and confirm GREEN**

```bash
pnpm exec vitest run tools/validate-greatsword-campaign-v1.spec.ts tools/repository-asset-policy.spec.ts
pnpm validate:repository-assets
pnpm validate:equipment-approved-sources
pnpm validate:equipment-runtime-visuals
```

### Task 4: Verify and deliver

**Files:**
- Modify: `docs/superpowers/plans/2026-09-07-greatsword-source-promotion.md`

**Interfaces:**
- Consumes: completed promotion and validation results.
- Produces: committed and pushed promotion with a clean worktree.

- [x] **Step 1: Run scoped typecheck, formatting, web tests, and build**

```bash
pnpm exec tsc -p tools/tsconfig.equipment-promotion.json --noEmit
pnpm --filter @summonlab/web test
pnpm --filter @summonlab/web build
pnpm format:check
git diff --check
```

- [x] **Step 2: Commit and push**

```bash
git commit -m "feat(equipment): approve greatsword source set"
git push origin codex/fauna-source-retirement
```
