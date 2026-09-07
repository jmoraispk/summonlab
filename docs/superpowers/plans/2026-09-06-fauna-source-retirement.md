# Fauna Source Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retain the 200 approved fauna masters as LFS-backed source authority and remove their 200 duplicate experiment rasters.

**Architecture:** Preserve immutable production metadata and runtime WebPs, but move all live pixel validation to the approved manifest/source tree. Repository policy owns retention enforcement; the wiki exporter truthfully distinguishes historical candidate records from retained approved pixels.

**Tech Stack:** TypeScript 6, Vitest 4, Git LFS, Sharp, generated Markdown wiki.

**Spec:** `docs/superpowers/specs/2026-09-06-fauna-source-retirement-design.md`

## Global Constraints

- Keep exactly 8 fauna families, 40 forms, and 200 approved/runtime coordinates.
- Delete only fauna experiment candidate PNGs; preserve provenance JSON and approved/runtime assets.
- Retire the obsolete candidate-only gallery/exporter while preserving the authoritative experiment
  inventory and owner-acceptance receipt.
- Do not touch the 750 canonical family-affinity images, the 175-image legacy pack, equipment, or skill icons.
- Do not rewrite Git history in this slice.

---

### Task 1: Lock the approved-only retention contract

**Files:**
- Modify: `tools/repository-asset-policy.spec.ts`
- Modify: `tools/fauna-family-promotion.spec.ts`
- Modify: `tools/wiki-fauna-integration.spec.ts`

**Interfaces:**
- Consumes: existing fauna approved manifest and repository-policy API.
- Produces: failing assertions for candidate retirement, approved-source LFS coverage, and truthful wiki state.

- [x] **Step 1: Write failing retention tests**

```ts
expect(findRepositoryAssetPathViolations([retiredCandidate])).toContain(
  `Fauna experiment candidate raster must not be tracked: ${retiredCandidate}`
);
expect(summary.approvedFaunaImageCount).toBe(200);
expect(faunaCoordinates.every(({ candidateExists }) => !candidateExists)).toBe(true);
```

- [x] **Step 2: Run the focused tests and confirm RED**

```bash
pnpm exec vitest run tools/repository-asset-policy.spec.ts tools/fauna-family-promotion.spec.ts tools/wiki-fauna-integration.spec.ts
```

Expected: failures show that candidate PNGs are still allowed/present, the summary omits approved fauna, and wiki coordinates still claim candidate pixels exist.

### Task 2: Retire duplicate pixels and move authority to approved sources

**Files:**
- Modify: `.gitattributes`
- Modify: `tools/repository-asset-policy.ts`
- Modify: `tools/fauna-family-promotion.ts`
- Delete: `assets/enemies/experiments/fauna-family-v1/candidates/**/*.png`
- Re-index: `assets/enemies/approved/fauna-family-v1/sources/**/*.png` as Git LFS pointers

**Interfaces:**
- Consumes: `fauna-family-approved-manifest-v1` and `fauna-family-runtime-catalog-v1`.
- Produces: `validateRepositoryAssets()` summary fields `approvedFaunaImageCount` and `approvedFaunaBytes`; approved-only promotion validation.

- [x] **Step 1: Add approved fauna LFS coverage and policy validation**

```gitattributes
assets/enemies/approved/fauna-family-v1/sources/**/*.png filter=lfs diff=lfs merge=lfs -text
```

- [x] **Step 2: Delete only byte-identical candidate PNGs and renormalize approved masters**

```bash
git rm -r assets/enemies/experiments/fauna-family-v1/candidates
git add --renormalize assets/enemies/approved/fauna-family-v1/sources
```

- [x] **Step 3: Validate approved pixels directly from the approved manifest**

```ts
const bytes = await readFile(resolve(workspaceRoot, record.approved.path));
if (sha256(bytes) !== record.approved.sha256) violations.push('approved fauna hash mismatch');
```

- [x] **Step 4: Run the focused tests and confirm GREEN**

```bash
pnpm exec vitest run tools/repository-asset-policy.spec.ts tools/fauna-family-promotion.spec.ts
```

### Task 3: Publish truthful wiki provenance and verify the slice

**Files:**
- Modify: `tools/wiki-fauna-integration.ts`
- Modify: `tools/wiki-monster-database-lib.ts`
- Regenerate: `docs/wiki/creatures/monsters/*.md`
- Delete: `docs/evidence/fauna-family-v1/index.html`
- Delete: `docs/evidence/fauna-family-v1/inventory.json`
- Delete: `tools/export-fauna-family-handoff.ts`
- Delete: `tools/export-fauna-family-handoff.spec.ts`
- Modify: `package.json`
- Modify: `tools/tsconfig.family-affinity-production.json`

**Interfaces:**
- Consumes: approved/runtime fauna records with historical candidate path/hash metadata.
- Produces: runtime wiki coordinates whose approved pixels exist and whose candidate rasters are explicitly retired.

- [x] **Step 1: Mark fauna candidate pixels absent while retaining historical paths**

```ts
candidatePath: approved.candidate.path,
candidateExists: false
```

- [x] **Step 2: Regenerate the monster wiki**

```bash
pnpm export:wiki-monsters
```

- [x] **Step 3: Retire the obsolete candidate-only review path**

Remove the gallery/exporter and its duplicate evidence inventory now that approved sources are the
sole retained pixel authority. Preserve `assets/enemies/experiments/fauna-family-v1/inventory.json`
and `docs/evidence/fauna-family-v1/owner-acceptance.md`.

- [x] **Step 4: Run full scoped verification**

```bash
pnpm validate:repository-assets
pnpm validate:wiki-monsters
pnpm validate:wiki-monster-visuals
pnpm validate:fauna-family-design
pnpm test:family-affinity-production
pnpm --filter @summonlab/web test:unit
pnpm --filter @summonlab/web lint
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web build
```

- [x] **Step 5: Inspect, commit, and push the isolated branch**

```bash
git diff --check
git status --short
git commit -m "chore(enemies): retire duplicate fauna candidates"
git push -u origin codex/fauna-source-retirement
```
