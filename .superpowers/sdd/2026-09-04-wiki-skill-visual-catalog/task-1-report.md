# Task 1 — deterministic derivative exporter

## Implementation summary

- Added `tools/wiki-skill-visual-catalog-lib.ts`, a deterministic Sharp exporter for the completed
  456-record skill mass-production authority. It validates canonical/mass schema, inventory, unique
  IDs, matched identity fields, safe regular source paths, hashes, 1024px RGBA sources, and the
  exact 512px alpha WebP derivative contract. Encoding is bounded to 12 workers and records stable
  source/derivative hashes in a Prettier-formatted, timestamp-free manifest.
- Added atomic staging/backup publication and a read-only check path that compares the formatted
  manifest, managed inventory, and exact WebP bytes without repair.
- Added the strict `--write` / `--check` CLI and registered the library, test, and CLI in the focused
  TypeScript project.
- The public `buildWikiSkillVisualCatalog(workspaceRoot?)` enforces exactly 456 canonical and mass
  records. Per coordinator ruling, the test-only lower-level
  `buildWikiSkillVisualCatalogFromAuthorities(...)` takes explicit authority paths and an explicit
  expected count so two-record fixtures exercise the same validation/generation path without an
  environment or path-based production exception.

## RED/GREEN evidence

1. Initial RED:

   ```text
   corepack pnpm vitest run tools/wiki-skill-visual-catalog-lib.spec.ts
   Error: Cannot find module './wiki-skill-visual-catalog-lib.js'
   ```

2. Regression RED for nullable canonical `motifFamily` / `mapEntryId` fallback:

   ```text
   Invalid canonical motif family
   ```

   The accepted canonical catalog has 20 records with `motifFamily: null`; their `mapEntryId` is
   the authoritative motif family. The normalizer now uses that field only when `motifFamily` is
   null, then validates it against the mass record.

3. Regression RED for the canonical catalog schema:

   ```text
   promise resolved instead of rejecting
   ```

   The implementation now requires `skill-icon-catalog-v1` before reading records.

4. GREEN:

   ```text
   corepack pnpm vitest run tools/wiki-skill-visual-catalog-lib.spec.ts
   Test Files  1 passed (1)
   Tests  3 passed (3)

   corepack pnpm tsc -p tools/tsconfig.skill-icon-production.json --noEmit
   exit 0

   git diff --check
   exit 0

   corepack pnpm tsx -e "...buildWikiSkillVisualCatalog()..."
   {"skillCount":456,"assetCount":456,"totalBytes":38597676,"maximumAssetBytes":133120}
   ```

## Files changed

- `tools/wiki-skill-visual-catalog-lib.ts`
- `tools/wiki-skill-visual-catalog-lib.spec.ts`
- `tools/export-wiki-skill-visual-catalog.ts`
- `tools/tsconfig.skill-icon-production.json`
- `.superpowers/sdd/2026-09-04-wiki-skill-visual-catalog/task-1-report.md`

## Self-review

- Confirmed production entrypoint locks both inventories at 456 while test fixtures use an explicit,
  non-inferred count seam.
- Confirmed the actual current authority produces 456 WebPs in memory, with 38,597,676 total image
  bytes; Task 1 intentionally does not publish those files.
- Confirmed test coverage for deterministic buffers/manifest, source-hash drift, duplicate/missing
  IDs, invalid schema, 1023px and RGB inputs, unexpected output, derivative drift, and stale
  manifest.
- Confirmed staging uses exclusive writes and manifest fsync; install rolls the managed root through
  a sibling backup and restores it if staging rename fails. Check mode has no mutating filesystem
  calls.

## Concerns

- No blocking concerns. The generated 456-file runtime directory is deliberately deferred to Task 2.
