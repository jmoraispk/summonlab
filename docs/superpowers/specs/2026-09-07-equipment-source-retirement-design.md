# Equipment Source Retirement Design

**Status:** Approved in conversation on 2026-09-07.

## Goal

Make the 161 approved Equipment masters the sole retained pixel authority for the completed
material-equipment campaign, remove superseded production attempts and review derivatives, and
move every intentionally retained Equipment PNG to Git LFS.

## Retention boundary

- Keep all 140 approved item masters and 21 approved armour-set references.
- Keep the 280 optimized runtime WebP derivatives and their approved/runtime/content manifests.
- Keep compact material-equipment-v3 manifests, targets, assignments, prompts, results,
  checkpoints, selections, and approval receipts as historical provenance.
- Keep the accepted calibration and v3 direction boards because current provenance binds them.
- Keep the seven-item two-handed Greatsword campaign because it is review-pending, not superseded.
- Delete material-equipment-v1 and material-equipment-v2 completely; both are superseded planning
  campaigns and neither contributed an approved source.
- Delete all completed material-equipment-v3 candidate/revision PNGs and generated review
  PNG/WebP/HTML artifacts. Historical records retain their paths and hashes.
- Retire production-only tooling for the completed v1, v2, and v3 campaigns. Preserve the v3
  schemas/deterministic manifest needed by approved-source validation and the separate Greatsword
  campaign tools.

## Guardrails

- Repository policy rejects tracked retired Equipment campaign paths and v3 review rasters/pages.
- Repository policy requires exactly 161 approved Equipment PNGs with manifest-bound paths, hashes,
  byte counts, dimensions, and Git LFS coverage.
- Approved-source validation reads approved masters directly and requires every historical selected
  candidate raster to be absent.
- Runtime export remains approved-only and continues to expose exactly 140 items with card/detail
  derivatives; full-set references remain non-runtime evidence.
- All retained PNGs below `assets/equipment/` are Git LFS managed.
- Enemy, hero, skill-icon, and gameplay content are untouched.
- This slice changes only the current tree; repository history rewriting remains separately
  coordinated after branch integration.
