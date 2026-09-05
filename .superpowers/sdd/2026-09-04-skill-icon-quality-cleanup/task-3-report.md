# Task 3 report: shared-layer revision packets

## Implementation

- Added `tools/export-skill-icon-cleanup-reference-packets.ts`, a deterministic write/check exporter for exactly seven revision-5 shared-layer packet pairs: E, D, C, B, A, and S rarity frames plus charcoal forged stone backing.
- Added `tools/export-skill-icon-cleanup-reference-packets.spec.ts`. It seeds authority files in a temporary root, runs the real exporter, validates each target and assignment through the strict v2 schemas, verifies revisions, profile v3, producer version, retry ceiling, canonical reference order, and disjoint candidate/result paths.
- Added the `export:skill-icon-cleanup-reference-packets` package command.
- Generated the fourteen target/assignment JSON packets under `assets/wiki/skills/icon-production-v1/{targets,assignments}/references`.
- Narrowed the strict v2 image-reference allowance to the single approved seven-frame sheet file. The surrounding mass-production directory remains disallowed.
- Updated existing structural-v2 and revision-validation expectations: the committed v2 target inventory is now 31; the seven v5 jobs are correctly reported as queued with missing result entries until image production begins.

`rarity-frame-f-v5` target and assignment were inspected and remain unchanged. No images were generated; `mass-production-v1` and live wiki assets were untouched.

## TDD evidence

### RED

```text
corepack pnpm vitest run tools/export-skill-icon-cleanup-reference-packets.spec.ts

FAIL Cannot find module './export-skill-icon-cleanup-reference-packets.js'
```

The first exporter test failed for the intended reason: the exporter did not exist.

The first green attempt then exposed two strict-contract mismatches: the selected seven-frame sheet was not an allowed v2 reference path, and the prompt did not use the schema-required opaque-matte phrasing. Both were corrected without broadening authority scope.

A second RED test verified the new reference exception was exact:

```text
expected false, received true for
approved-seven-frame-sheet.png/unrelated.png
```

The allowlist was then changed from a prefix match to one exact file match.

### GREEN

```text
corepack pnpm export:skill-icon-cleanup-reference-packets -- --write
write: 7 packet pairs; 14 written; 0 drifted

corepack pnpm vitest run tools/export-skill-icon-cleanup-reference-packets.spec.ts
Test Files 1 passed (1)
Tests 2 passed (2)

corepack pnpm typecheck:skill-icons
exit 0
```

## Final validation

```text
corepack pnpm vitest run packages/contracts/src/skill-icon-production.spec.ts \
  tools/skill-icon-revision-lib.spec.ts \
  tools/export-skill-icon-cleanup-reference-packets.spec.ts
Test Files 3 passed (3)
Tests 34 passed (34)

corepack pnpm typecheck:skill-icons
exit 0

corepack pnpm export:skill-icon-cleanup-reference-packets -- --check
check: 7 packet pairs; 0 written; 0 drifted

git diff --check
exit 0
```

## Self-review and concerns

- Frame references are exactly Option C, approved seven-frame sheet, then provider-space geometry guide. The backing is intentionally limited to Option C tonal authority and the geometry guide.
- Every assignment declares `summonlab-skill-icon-production-v4`, profile `skill-icon-green-key-role-mask-v3`, revision `5`, and retry ceiling `1`.
- Candidate and result paths are unique across all fourteen outputs and the exporter rejects any collision before writing.
- The current seven `missing result inventory entry` diagnostics are intentional queued-work evidence, not a packet validation failure. Image production is the next authorized stage.

## Commit, push, and clean status

Implementation commit: `a7c6288d0 feat(skills): queue canonical cleanup layers`.

Pushed to `origin/codex/skill-icon-quality-cleanup` (`https://github.com/jmoraispk/summonlab.git`). The implementation working tree was clean before this report artifact was added; this report is committed and pushed immediately after authoring.
