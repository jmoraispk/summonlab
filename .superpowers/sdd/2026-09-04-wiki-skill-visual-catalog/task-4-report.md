# Task 4 — deterministic skill catalog model

## Status

Implemented the client-safe search/filter/query model in:

- `apps/web/src/lib/components/wiki/skill-visual-catalog-model.ts`
- `apps/web/src/lib/components/wiki/skill-visual-catalog-model.spec.ts`

The model searches all specified visible fields with case-insensitive whitespace normalization,
preserves source order, derives sorted unique dependent options, clears incompatible family/motif
selections, and serializes query keys in the fixed `q`, `domain`, `family`, `motif` order. The page
size constant is 120, covering visible windows of 120, 240, 360, and the final 456 records.

## Verification

```text
corepack pnpm --filter @summonlab/web exec vitest run src/lib/components/wiki/skill-visual-catalog-model.spec.ts
Test Files  1 passed (1)
Tests       6 passed (6)

corepack pnpm --filter @summonlab/web typecheck
svelte-check found 0 errors and 0 warnings

git diff --check
exit 0
```

The brief's direct `pnpm --filter @summonlab/web vitest ...` form is not supported by this
package because `vitest` is not a package script; the equivalent `exec vitest` invocation was used.

## Self-review

- Search excludes target IDs, image paths, provenance paths, rank, and other technical metadata.
- Family options apply only the selected domain; motif options apply the selected domain and family,
  while query text and narrower selections do not perturb option lists.
- Query parsing normalizes whitespace/case for search and removes unknown domain, family, or motif
  values through the same compatibility rules used by the dependent controls.

## Concerns

No blocking concerns. Visible-window slicing remains a component concern as specified by the public
`SKILL_CATALOG_PAGE_SIZE` constant.

## Review fix round 1 — exact URL filter values

Added a regression proving that lowercase/uppercase and whitespace variants of `domain`, `family`,
and `motif` are invalid and cleared. Only `q` receives case-folding and whitespace normalization.
Canonical filter values are now matched exactly during normalization and serialization preserves
the supplied non-empty filter values without trimming.

Verification after the fix:

```text
corepack pnpm --filter @summonlab/web exec vitest run src/lib/components/wiki/skill-visual-catalog-model.spec.ts
Test Files  1 passed (1)
Tests       7 passed (7)

corepack pnpm --filter @summonlab/web typecheck
svelte-check found 0 errors and 0 warnings

git diff --check
exit 0
```
