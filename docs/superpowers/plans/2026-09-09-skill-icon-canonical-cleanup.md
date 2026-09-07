# Skill icon canonical cleanup implementation plan

> **For Codex:** Follow `superpowers:executing-plans` and verify each checkpoint before proceeding.

**Goal:** Reduce the skill artwork repository to canonical frameless interiors and reusable
composition authorities while keeping all 457 skills visible in the wiki.

**Architecture:** The v2 catalog and a hash-bound asset manifest own one interior per skill plus
seven frames, one backing, and geometry. The wiki exporter composes those layers and writes a
single v2 runtime catalog. Future approved skills are promoted into this same source set.

**Tech stack:** TypeScript, Vitest, Sharp, SvelteKit static assets, Git LFS

**Spec:** `docs/superpowers/specs/2026-09-09-skill-icon-canonical-cleanup-design.md`

---

- [x] Add failing tests for the 457-record source manifest, deterministic layered composition,
      Reversal Cut inclusion, and lean skill-creation promotion language.
- [x] Move the 456 accepted frameless interiors and the Reversal Cut interior into the v2 source
      root; promote the seven complete frames, backing, and geometry.
- [x] Add and generate the hash-bound canonical asset manifest.
- [x] Replace the v1 wiki exporter/server contract with the unified v2 layered source contract and
      regenerate 457 bounded WebPs.
- [x] Update the skill-creation workflow to generate family sheets on demand and promote approved
      interiors into the ordinary catalog without a permanent overlay.
- [x] Delete superseded asset trees, special-case runtime assets, scripts, tests, and package
      commands.
- [x] Run focused tests, repository validations, typechecks, and the relevant web build.
- [x] Commit and push the rebased branch.
