# Reversal Cut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved Reversal Cut skill with honest net-new provenance, a v1-bound post-v1
icon authority, and a reviewable revised guard-flow calibration candidate.

**Architecture:** Preserve the completed 456-skill v1 catalog and mass-production evidence byte for
byte. Extend canonical taxonomy validation with a separate net-new ledger, then derive a 457-skill
v2 catalog from hash-bound v1 inputs plus one authored overlay. Run the existing strict raster
producer for a revised family plate, stopping before promotion or individual generation.

**Tech Stack:** TypeScript, Zod, Vitest, Markdown/JSON authorities, Python producer verifier,
built-in image generation

**Spec:** `docs/decisions/2026-09-04-reversal-cut.md`

## Global Constraints

- Preserve `Domain → Family → Skill`; Equipment remains an optional label.
- Do not edit the completed `icon-production-v1` catalog, motif map, visual specs, or mass run.
- Do not fabricate legacy provenance for Reversal Cut.
- Generate only manifest-bound candidates; never self-promote or call candidate art approved.
- Keep the individual icon blocked until the revised plate and Mirrored Edge master are approved.

---

### Task 1: Net-new taxonomy provenance

**Files:**
- Modify: `docs/wiki/mechanics/skills/martial-blade.md`
- Modify: `docs/wiki/mechanics/skills/README.md`
- Create: `docs/wiki/mechanics/skills/net-new-v1.json`
- Modify: `tools/skill-taxonomy-lib.ts`
- Modify: `tools/validate-skill-taxonomy.ts`
- Test: `tools/skill-taxonomy-lib.spec.ts`

- [ ] Write failing tests for valid, missing, duplicate, and legacy-conflicting net-new provenance.
- [ ] Run the focused taxonomy tests and confirm the new expectations fail.
- [ ] Add the canonical row and minimal ledger validation.
- [ ] Run taxonomy and wiki validation.

### Task 2: Post-v1 icon catalog overlay

**Files:**
- Create: `docs/superpowers/specs/2026-09-04-skill-icon-motif-overlay-v2.md`
- Create: `assets/wiki/skills/icon-production-v2/overlay.json`
- Create: `tools/export-skill-icon-production-v2.ts`
- Create: `tools/export-skill-icon-production-v2.spec.ts`
- Modify: `tools/tsconfig.skill-icon-production.json`
- Modify: `package.json`
- Generate: `assets/wiki/skills/icon-production-v2/{motif-map,visual-specs,catalog}.json`

- [ ] Write failing composition and repository integration tests.
- [ ] Implement hash-bound append-only composition from the frozen v1 authority.
- [ ] Export and check the 457-skill v2 catalog while rechecking v1 unchanged.

### Task 3: Revised guard-flow calibration packet

**Files:**
- Create: `assets/wiki/skills/icon-production-v2/reversal-cut-v1/manifest.json`
- Create: `assets/wiki/skills/icon-production-v1/targets/calibration/blade-guard-flow-reversal-cut-v1.json`
- Create: `assets/wiki/skills/icon-production-v1/assignments/calibration/blade-guard-flow-reversal-cut-v1.json`

- [ ] Freeze exact prompt, references, outputs, hashes, and ownership.
- [ ] Commit coordinator-owned inputs so producer output is isolated.
- [ ] Validate the packet and inspect each declared reference at full resolution.

### Task 4: Produce and verify the family candidate

**Files:**
- Create only: assigned calibration candidate and result paths.
- Create after producer verification: additive completion evidence and checker.

- [ ] Submit the exact prompt once with references in manifest order.
- [ ] Persist exact provider bytes with the repository helper.
- [ ] Inspect full size and at 96 pixels; verify the structured result.
- [ ] Add and test a read-only v2 run checker.
- [ ] Re-run taxonomy, wiki, v1, v2, type, and focused test gates.
- [ ] Commit and push all in-scope changes, leaving owner review and promotion pending.
