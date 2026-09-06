# Repository Asset Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove hero generation runs while preserving the exact approved 200-hero roster and its
runtime output.

**Architecture:** The approved catalog becomes the canonical roster authority and points only to
stable approved master paths. A focused validator checks repository retention rules, catalog
integrity, image bytes, and LFS coverage. Runtime WebP assets remain unchanged.

**Tech Stack:** TypeScript, Vitest, Zod contracts, Sharp, Git LFS, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-06-repository-asset-retention-design.md`

## Global Constraints

- Do not modify `codex/skill-icon-quality-cleanup` or rewrite repository history.
- Preserve all 200 approved identities and all 400 approved image byte hashes.
- Keep runtime WebP assets in regular Git.
- Use Node 24.14.1 and pnpm 10.33.0 for verification.

---

### Task 1: Repository asset-policy validator

**Files:**
- Create: `tools/repository-asset-policy.ts`
- Create: `tools/repository-asset-policy.spec.ts`
- Create: `tools/validate-repository-assets.ts`
- Modify: `package.json`
- Modify: `.gitignore`

- [x] Write failing unit tests for forbidden paths and approved hero path constraints.
- [x] Run the focused test and confirm the expected failure.
- [x] Implement the pure policy checks and filesystem-backed validator.
- [x] Add `validate:repository-assets` to the root check sequence.
- [x] Run the focused tests and validator.

### Task 2: Promote approved hero masters

**Files:**
- Create: `assets/heroes/approved/summonable-roster-v1/provenance.json`
- Create: `assets/heroes/approved/summonable-roster-v1/sources/*/*.png`
- Modify: `assets/heroes/approved/summonable-roster-v1/catalog.json`
- Modify: `.gitattributes`

- [x] Capture the current ordered catalog hashes and runtime manifest hash.
- [x] Copy each catalog-selected source to its stable approved path.
- [x] Update catalog paths without changing any content hash, dimensions, byte counts, or identity.
- [x] Replace experiment evidence files with the compact provenance record.
- [x] Add targeted LFS tracking for approved hero PNG masters.
- [x] Run the validator and runtime export check.

### Task 3: Retire the one-off hero production surface

**Files:**
- Delete: `assets/heroes/experiments/`
- Delete: `tools/summonable-hero-roster-lib.ts`
- Delete: `tools/summonable-hero-roster-lib.spec.ts`
- Delete: `tools/promote-summonable-hero-roster.ts`
- Modify: `docs/decisions/0071-generated-heroes-are-the-summonable-roster.md`

- [x] Remove the experiment-coupled catalog generator and its test.
- [x] Remove all hero experiment runs.
- [x] Update the accepted decision to name the catalog validator as the durability gate.
- [x] Confirm no tracked hero experiment path or Python bytecode remains.

### Task 4: Verification and delivery

**Files:**
- Modify: `docs/superpowers/plans/2026-09-06-repository-asset-cleanup.md`

- [x] Run focused catalog, runtime, contract, and repository-policy tests.
- [x] Run the full repository check and distinguish any unchanged baseline failures.
- [x] Compare catalog hashes, runtime hashes, file counts, and tracked sizes with the captured baseline.
- [x] Mark this plan complete, commit all in-scope changes, and push the cleanup branch.

The full repository check passes every gate before `test:family-affinity-production`, where it
reproduces the seven pre-existing environment-bound failures: the installed and tracked skill roots
do not equal the sealed receipt, and `/home/joao/.nvm` is absent. The result remains 297 passing and
7 failing tests in that suite, matching the captured baseline.
