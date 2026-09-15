# Equipment Source Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retain the 161 approved Equipment masters as the sole LFS-backed source authority while retiring superseded campaigns, duplicate production rasters, review derivatives, and obsolete campaign tooling.

**Architecture:** The frozen approved manifest becomes the validation root. Historical v3 metadata keeps candidate paths and hashes for provenance, but current validation reads approved masters and asserts that selected candidate rasters are absent. Repository policy enforces the retained-path boundary and LFS coverage.

**Tech Stack:** TypeScript 6, Vitest 4, Git LFS, Sharp, deterministic JSON manifests.

**Spec:** `docs/superpowers/specs/2026-09-07-equipment-source-retirement-design.md`

## Global Constraints

- Keep exactly 161 approved masters: 140 items plus 21 armor-set references.
- Keep all 280 runtime WebPs and current content bindings.
- Keep accepted calibration/direction PNGs and the review-pending Greatsword campaign.
- Delete completed/superseded campaign pixels only; retain compact v3 approval provenance.
- Do not touch enemies, heroes, skill icons, or gameplay definitions.
- Do not rewrite Git history in this slice.

---

### Task 1: Lock the approved-only Equipment contract

**Files:**
- Modify: `tools/repository-asset-policy.spec.ts`
- Modify: `tools/equipment-approved-source-promotion.spec.ts`

**Interfaces:**
- Consumes: frozen approved manifest and repository-policy API.
- Produces: failing assertions for retired paths, approved counts/bytes, LFS coverage, and candidate absence.

- [x] **Step 1: Write failing retention tests**

```ts
expect(findRepositoryAssetPathViolations([retiredCandidate])).toContain(
  `Equipment production raster must not be tracked: ${retiredCandidate}`
);
expect(summary.approvedEquipmentImageCount).toBe(161);
expect(validation.retiredCandidateCount).toBe(161);
```

- [x] **Step 2: Run focused tests and confirm RED**

```bash
pnpm exec vitest run tools/repository-asset-policy.spec.ts tools/equipment-approved-source-promotion.spec.ts
```

Expected: policy permits completed campaign rasters, summary omits approved Equipment, and the
approved validator still requires selected candidate bytes.

### Task 2: Retire superseded campaigns and make approved sources authoritative

**Files:**
- Modify: `.gitattributes`
- Modify: `tools/repository-asset-policy.ts`
- Modify: `tools/equipment-approved-source-promotion.ts`
- Modify: `tools/promote-equipment-approved-sources.ts`
- Delete: `assets/equipment/experiments/material-equipment-v1/`
- Delete: `assets/equipment/experiments/material-equipment-v2/`
- Delete: `assets/equipment/experiments/material-equipment-v3/candidates/**/*.png`
- Delete: `assets/equipment/experiments/material-equipment-v3/revisions/**/candidate.png`
- Delete: `assets/equipment/experiments/material-equipment-v3/reviews/**/*.{png,webp,html}`
- Re-index: `assets/equipment/**/*.png` as Git LFS pointers

**Interfaces:**
- Consumes: `EquipmentApprovedSourceManifestV1Schema`, promotion receipt, proposal, and checkpoints.
- Produces: `checkEquipmentApprovedSources()` with `verified`, `totalBytes`, and `retiredCandidateCount`; repository summary fields `approvedEquipmentImageCount` and `approvedEquipmentBytes`.

- [x] **Step 1: Add Equipment PNG LFS coverage**

```gitattributes
assets/equipment/**/*.png filter=lfs diff=lfs merge=lfs -text
```

- [x] **Step 2: Delete superseded and duplicate production pixels**

Delete only the paths enumerated above. Preserve v3 JSON/TXT/Markdown provenance, accepted
direction/calibration boards, references, approved masters, runtime WebPs, and the Greatsword
campaign.

- [x] **Step 3: Validate the frozen approved catalog directly**

For every approved record, verify approved PNG bytes/hash/dimensions, proposal/checkpoint bindings,
and absence of the historical candidate path. Reconstruct the historical promotion-plan hash from
frozen records instead of reading retired candidate bytes.

- [x] **Step 4: Run focused tests and confirm GREEN**

```bash
pnpm exec vitest run tools/repository-asset-policy.spec.ts tools/equipment-approved-source-promotion.spec.ts
```

### Task 3: Retire obsolete campaign machinery and verify runtime integrity

**Files:**
- Delete: completed material-equipment v1/v2/v3 producer/exporter/recorder tools and their tests.
- Delete: `tools/tsconfig.equipment-material-production.json`
- Delete: `tools/tsconfig.equipment-rank-first-v3.json`
- Modify: `tools/tsconfig.equipment-promotion.json`
- Modify: `docs/wiki/mechanics/equipment/README.md`
- Modify: `assets/equipment/README.md`

**Interfaces:**
- Consumes: retained approved validator and runtime exporter.
- Produces: a smaller check-only Equipment maintenance surface with no command that writes into a completed campaign.

- [x] **Step 1: Remove obsolete production-only tools**

Keep approved/runtime/content validators, shared repository I/O, v3 contract/deterministic manifest,
and the active Greatsword campaign tooling. Remove tools whose only purpose is creating or reviewing
the completed material-equipment-v1/v2/v3 campaigns.

- [x] **Step 2: Document the retained lifecycle boundary**

Record that v1/v2 are retired, v3 pixels live only in approved sources, and the Greatsword campaign
remains review-pending.

- [x] **Step 3: Run scoped verification**

```bash
pnpm validate:repository-assets
pnpm validate:equipment-approved-sources
pnpm validate:equipment-runtime-visuals
pnpm validate:equipment-content-bindings
pnpm validate:equipment-integration-report
pnpm exec vitest run tools/equipment-approved-source-contract.spec.ts tools/equipment-approved-source-promotion.spec.ts tools/export-equipment-runtime-visuals.spec.ts tools/validate-equipment-content-bindings.spec.ts tools/export-equipment-integration-report.spec.ts
pnpm --filter @summonlab/web lint
pnpm --filter @summonlab/web typecheck
pnpm --filter @summonlab/web test
pnpm --filter @summonlab/web build
git diff --check
```

- [x] **Step 4: Commit and push the existing cleanup branch**

```bash
git commit -m "chore(equipment): retire superseded production assets"
git push origin codex/fauna-source-retirement
```
