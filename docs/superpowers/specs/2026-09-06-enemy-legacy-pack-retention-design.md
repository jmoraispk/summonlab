# Enemy Legacy Pack Retention Design

**Status:** Approved in conversation on 2026-09-06.

## Goal

Retain the 175 currently selected images from `affinity-expansion-v1` and
`affinity-workflow-v1` as one intentional legacy enemy pack while removing only superseded image
attempts from those two candidate roots.

## Pack boundary

The pack contains exactly the entries selected by the two existing review catalogs:

| Source experiment | Selected images | State |
| --- | ---: | --- |
| `affinity-expansion-v1` | 136 | Candidate/reference |
| `affinity-workflow-v1` | 39 | Candidate/reference |
| **Total** | **175** | **Retained legacy pack** |

The owner decision changes repository retention, not production state. These images remain
candidate/reference art: they are not approved, promoted, or runtime assets.

## Storage and authority

- Keep the existing candidate paths so production receipts, review tools, and wiki evidence do not
  need path rewrites.
- Add a compact manifest under `assets/enemies/legacy/affinity-pack-v1/` that freezes the two source
  catalog hashes, selected counts, aggregate byte count, and owner retention decision.
- Track the 175 selected PNGs through Git LFS because they are intentionally retained raster
  masters and are not cheaply reproducible.
- Keep JSON manifests, results, review catalogs, and other compact provenance in regular Git.
- Do not use Git LFS to preserve superseded attempts.

## Cleanup boundary

The expansion candidate root currently contains ten PNGs that are not selected by its review
catalog. Delete those ten superseded attempts, totaling 23,255,037 bytes. The workflow candidate
root contains exactly its 39 selected entries and needs no image deletion.

This slice does not alter `family-affinity-v1`, the fauna family, the realtime combat study, runtime
assets, or the skill-icon branch. Their retention and cleanup decisions remain separate.

## Guardrails

The repository asset validator must reject:

- a missing, duplicate, or untracked selected legacy candidate;
- a selected candidate outside its declared source root;
- an unselected tracked PNG under either legacy candidate root;
- candidate bytes whose SHA-256 differs from the source catalog;
- source catalog bytes whose SHA-256 differs from the legacy-pack manifest;
- a selected legacy PNG that is not covered by the `lfs` Git attribute;
- a pack total other than 136 expansion + 39 workflow = 175.
