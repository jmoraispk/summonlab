# Fauna Source Retirement Design

**Status:** Approved in conversation on 2026-09-06.

## Goal

Keep all 200 approved fauna monster visuals while removing their byte-identical experiment raster
copies and making the approved source tree the only retained pixel authority.

## Retention boundary

- Keep all 8 fauna families, 40 forms, and 200 Normal-plus-affinity visual coordinates.
- Keep the 200 approved PNG masters under
  `assets/enemies/approved/fauna-family-v1/sources/` and track them with Git LFS.
- Keep the 200 optimized runtime WebP files and the approved/runtime catalogs.
- Keep compact target, assignment, result, inventory, and approval metadata as historical provenance.
- Delete the 200 byte-identical PNGs under
  `assets/enemies/experiments/fauna-family-v1/candidates/`.
- Delete the obsolete candidate-only review gallery, its duplicate evidence inventory, and the
  exporter/test that can only rebuild them from retired rasters. Keep the authoritative experiment
  inventory and owner-acceptance receipt.
- Historical metadata may retain the retired candidate path and SHA-256, but validators and wiki
  copy must not imply that the candidate raster remains in the current tree.

## Guardrails

- The repository policy rejects any tracked fauna experiment candidate PNG.
- The repository policy requires exactly 200 approved fauna masters, with manifest-bound paths,
  hashes, byte counts, dimensions, and Git LFS coverage.
- Approved/runtime validation reads approved sources directly and does not reconstruct them from
  retired candidates.
- The monster wiki continues to expose 950 visuals and labels fauna candidate rasters as retired.
- The 750 canonical family-affinity images, 175-image legacy pack, equipment assets, and skill-icon
  branch are untouched.
- This slice changes the current tree only; Git history rewriting remains separately coordinated.
