# Canonical hero rarity-frame review evidence

**Reviewed:** 2026-09-01

**Status:** 6/6 family sheets and 42/42 individual frames are present as approved visual sources;
runtime export remains pending.

## Complete-set inventory

| Family | Sheet | Individual frames | Rollout note |
| --- | ---: | ---: | --- |
| Legacy Neutral | 1 | 7 | Preferred starting family |
| Neutral | 1 | 7 | Gemless no-affinity progression |
| Fire | 1 | 7 | Affinity begins at rank 3 |
| Water | 1 | 7 | Affinity begins at rank 3 |
| Earth | 1 | 7 | Affinity begins at rank 3 |
| Wind | 1 | 7 | Corrected inward-facing rank 7 |
| **Total** | **6/6** | **42/42** | **48 approved PNGs** |

Every affinity includes seven individual frames, not only a comparison sheet. Ranks 1–2 remain the
approved byte-identical Neutral frames; affinity expression begins at rank 3.

## File integrity and image shape

- `checksums.sha256` verifies **48/48 hashes** against the canonical files.
- All **6/6 sheets** are 2172×724 8-bit RGB PNGs.
- All **42/42 individual frames** are 1024×1536 8-bit RGB PNGs.
- The canonical manifest records the same dimensions, modes, and hashes for all 48 files.
- Wind rank 7 is the approved inward-facing-heads correction with SHA-256
  `84c2ff9c3308cc3566b0efba94f20b7db12fb4abc9da3a6f48743d7a2b79c41b`.

## Review decision

Legacy Neutral is the preferred starting family for the initial rollout because it retains the
approved comparison direction and seven high-resolution Neutral frames. This preference sets visual
review order only. It does not select a runtime default.

The unversioned review page shows each family as one complete unit: the canonical sheet first,
followed by ranks 1 through 7. It labels the library **Approved visual source** and **Runtime export
pending** so approval cannot be mistaken for engine readiness.

## Runtime-integration boundary

These opaque RGB PNGs preserve approved source pixels. They are not transparent runtime exports and
are not registered in a shared runtime catalog. Transparency, cleanup, runtime sizing, binding, and
any engine, affinity, or catalog contract change require a separate runtime-integration decision.
