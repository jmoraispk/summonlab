# Enemy Legacy Pack Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the selected 175 legacy enemy candidates, remove ten superseded expansion
attempts, and move the retained raster payload to Git LFS.

**Architecture:** A compact legacy-pack manifest freezes the owner decision and source catalog
hashes without relocating production evidence. The repository asset validator treats each catalog
as the exact selected-image authority and rejects missing, extra, drifted, or non-LFS candidates.

**Tech Stack:** TypeScript, Vitest, JSON, Git LFS, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-06-enemy-legacy-pack-retention-design.md`

## Global Constraints

- Preserve exactly 136 `affinity-expansion-v1` and 39 `affinity-workflow-v1` selected candidates.
- Keep all selected image bytes and existing candidate paths unchanged.
- Keep legacy-pack state separate from approved and runtime state.
- Delete only candidate PNGs not selected by the two source catalogs.
- Do not modify `family-affinity-v1`, fauna assets, realtime combat assets, or skill icons.

---

### Task 1: Legacy pack policy

**Files:**
- Create: `assets/enemies/legacy/affinity-pack-v1/manifest.json`
- Modify: `tools/repository-asset-policy.ts`
- Modify: `tools/repository-asset-policy.spec.ts`

**Interfaces:**
- Consumes: the two existing review catalogs and Git tracked-file/LFS attributes.
- Produces: `findRetainedEnemyPackPathViolations()` and legacy-pack validation in
  `validateRepositoryAssets()`.

- [x] **Step 1: Write a failing unit test**

  Add a test that passes selected paths plus tracked candidate-root PNGs and expects violations for
  duplicate, missing, out-of-root, and unselected paths.

- [x] **Step 2: Run the focused test and verify the expected failure**

  Run: `pnpm exec vitest run tools/repository-asset-policy.spec.ts`

  Expected: fail because `findRetainedEnemyPackPathViolations` is not exported.

- [x] **Step 3: Implement the pure path policy and filesystem validation**

  Read the compact manifest, verify both catalog hashes and exact counts, validate selected image
  paths/hashes/bytes, compare selected paths with tracked PNGs under the declared roots, and require
  the `lfs` filter on all 175 selected images.

- [x] **Step 4: Run the focused test**

  Run: `pnpm exec vitest run tools/repository-asset-policy.spec.ts`

  Expected: all repository asset-policy tests pass.

### Task 2: Retain selected rasters and delete superseded attempts

**Files:**
- Modify: `.gitattributes`
- Modify: `tools/export-enemy-affinity-expansion-review.ts`
- Modify: `assets/enemies/experiments/affinity-expansion-v1/generation-record.md`
- Modify: `assets/enemies/experiments/affinity-expansion-v1/review/evaluation.json`
- Delete: ten unselected PNGs under
  `assets/enemies/experiments/affinity-expansion-v1/candidates/`

**Interfaces:**
- Consumes: the exact selected paths from both source catalogs.
- Produces: two candidate roots containing exactly 175 selected LFS-backed PNGs.

- [x] **Step 1: Add narrow LFS rules**

  Cover only PNGs beneath the two retained legacy candidate roots.

- [x] **Step 2: Delete the ten catalog-unselected expansion PNGs**

  Recompute the set difference immediately before deletion and require an exact count of ten.

- [x] **Step 3: Repair and run the source review check**

  The source check exposed a stale six-affinity contact-sheet assumption left by the prior
  Wood/Metal retirement. Remove the reproducible contact sheet from retained authority, derive
  counts from the current manifest, regenerate compact review metadata, and run:

  `pnpm check:enemy-affinity-expansion-review`

  Expected: 34 species, 136 targets, 136 candidates, zero revisions, and no retained contact-sheet
  artifact.

- [x] **Step 4: Run the repository asset validator**

  Run: `pnpm validate:repository-assets`

  Expected: 175 retained legacy candidates, zero missing/extra images, and LFS coverage for all.

### Task 3: Verification and delivery

**Files:**
- Modify: `docs/superpowers/plans/2026-09-06-enemy-legacy-pack-retention.md`

**Interfaces:**
- Consumes: completed policy, manifest, LFS rules, and candidate cleanup.
- Produces: verified and pushed legacy-pack retention commit.

- [x] **Step 1: Verify selected hashes and counts**

  Run the focused Vitest suite, repository validator, source review checks, Prettier check on changed
  text files, and a Git LFS attribute/object audit.

- [x] **Step 2: Inspect the scoped diff**

  Confirm exactly ten deleted PNGs, 175 LFS-backed selected PNGs, unchanged selected worktree hashes,
  and no changes to excluded enemy or skill-icon roots.

- [x] **Step 3: Mark the plan complete, commit, and push**

  Commit with a concise Conventional Commit subject and push `codex/repository-cleanup` to its
  configured remote.
