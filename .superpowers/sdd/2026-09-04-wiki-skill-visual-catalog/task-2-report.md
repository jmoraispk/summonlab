# Task 2 — publish and validate browser derivatives

## Inventory and byte budget

- Sources consumed: 456 canonical/mass-production skill pairs.
- WebP derivatives: 456 under `apps/web/static/wiki-media/skills/visual-catalog-v1/icons/`.
- Managed files: 457 total (456 WebPs plus `manifest.json`).
- Derivative geometry: every manifest record is 512×512 RGBA WebP.
- Asset bytes: 38,597,676 total, versus the 44,040,192-byte limit.
- Largest derivative: `icons/martial-shield-the-last-wall.db81a70bf74b.webp`, 112,372 bytes,
  versus the 133,120-byte per-asset limit.
- Manifest bytes: 276,654; complete managed tree: 38,874,330 bytes.

## Validation evidence

Export:

```text
corepack pnpm export:wiki-skill-visual-catalog
exit 0
```

Deterministic zero-write proof (the exact required command sequence):

```text
git status --short > /tmp/summonlab-skill-catalog-before.txt
corepack pnpm validate:wiki-skill-visual-catalog
git status --short > /tmp/summonlab-skill-catalog-after.txt
diff -u /tmp/summonlab-skill-catalog-before.txt /tmp/summonlab-skill-catalog-after.txt
```

The check exited 0 and the final `diff` produced no output. Both status snapshots were 72 bytes and
identical.

Focused regression suite:

```text
corepack pnpm vitest run tools/wiki-skill-visual-catalog-lib.spec.ts
Test Files  1 passed (1)
Tests       7 passed (7)
```

Type and whitespace checks:

```text
corepack pnpm tsc -p tools/tsconfig.skill-icon-production.json --noEmit
exit 0
git diff --check
exit 0
```

Independent inventory measurements confirmed 456 `.webp` files, 38,597,676 aggregate derivative
bytes, and a 112,372-byte maximum.

## Representative delivery-fidelity inspection

Inspected visually at 512×512, with decoded alpha/bounds checked independently, one derivative for
each rarity and one for each Domain:

- F / Martial: `icons/martial-blade-swordsmanship.2f05cdcb68ee.webp`
- E / Martial: `icons/martial-blade-piercing-thrust.050f8589938f.webp`
- D / Martial: `icons/martial-blade-crescent-sweep.3afd78dd7254.webp`
- C / Martial: `icons/martial-blade-rising-moon.5068e51a2db1.webp`
- B / Martial: `icons/martial-blade-severing-intent.4e54405ea333.webp`
- A / Martial: `icons/martial-blade-void-cut.6028dba29059.webp`
- S / Martial: `icons/martial-blade-one-blade-one-world.af6eccdff56f.webp`
- Craft: `icons/craft-forging-ore-sense.7cb7a186c4ed.webp`
- Magical: `icons/magical-elemental-ember.dc06e2839325.webp`

All inspected derivatives retained centered solid content and complete visible frames. All four
corner alpha samples were 0, and each decoded image had 4 channels at 512×512, confirming the
transparent exterior survived WebP encoding. No inspected derivative displayed a checkerboard
background. Existing art-quality defects, if any, remain assigned to the separate cleanup issue.

## Files changed

- `package.json` — added `export:wiki-skill-visual-catalog` and
  `validate:wiki-skill-visual-catalog`.
- `apps/web/static/wiki-media/skills/visual-catalog-v1/manifest.json`.
- `apps/web/static/wiki-media/skills/visual-catalog-v1/icons/` — 456 generated WebPs.
- `.superpowers/sdd/2026-09-04-wiki-skill-visual-catalog/task-2-report.md`.

## Concerns

- No blocking delivery concerns. This task publishes the approved Task 1 derivatives only; source
  art defects were not edited and should be handled by the separate cleanup issue.

## Review fix round 1 — repository Prettier configuration

### Root cause

The first publication hard-coded `printWidth: 100` and `tabWidth: 2` in `formatManifest`, bypassing
the repository `prettier.config.js` (`useTabs: true`). The generated manifest therefore passed the
exporter’s own check but failed the repository’s explicit Prettier check.

### RED/GREEN evidence

1. Added `formats the generated manifest with the resolved repository Prettier config` to the
   focused exporter suite. Before the implementation change it failed as intended, with the
   expected tab-indented output versus the two-space manifest:

   ```text
   Test Files  1 failed (1)
   Tests       1 failed | 7 skipped (8)
   AssertionError: expected '{\\n  "schemaVersion"...' to be '{\\n\\t"schemaVersion"...'
   ```

2. Updated the exporter to call Prettier’s `resolveConfig` with `useCache: false`, using the
   repository manifest path derived from the exporter location, and to pass the resolved options
   (plus `filepath` and `parser: 'json'`) to `format`. Write and check now share the same source of
   formatting truth, including when test fixtures use a temporary output workspace.

3. GREEN and publication verification:

   ```text
   corepack pnpm vitest run tools/wiki-skill-visual-catalog-lib.spec.ts
   Test Files  1 passed (1)
   Tests       8 passed (8)

   corepack pnpm tsc -p tools/tsconfig.skill-icon-production.json --noEmit
   exit 0

   corepack pnpm prettier --check apps/web/static/wiki-media/skills/visual-catalog-v1/manifest.json
   Checking formatting...
   All matched files use Prettier code style!

   corepack pnpm validate:wiki-skill-visual-catalog
   exit 0

   git diff --check
   exit 0
   ```

4. Recomputed SHA-256 sums for all 456 WebPs before and after regeneration; the sorted hash files
   were byte-identical (`webp_hashes_identical`). Only the generated manifest changed formatting.

5. Repeated the deterministic zero-write proof after regeneration: validation exited 0 and the
   before/after `git status --short` diff produced no output.

### Files changed in this fix round

- `tools/wiki-skill-visual-catalog-lib.ts`
- `tools/wiki-skill-visual-catalog-lib.spec.ts`
- `apps/web/static/wiki-media/skills/visual-catalog-v1/manifest.json`
- `.superpowers/sdd/2026-09-04-wiki-skill-visual-catalog/task-2-report.md`
