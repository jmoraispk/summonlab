# Greatsword Source Promotion Design

**Status:** Approved by the owner in conversation on 2026-09-07.

## Goal

Promote the seven reviewed Bronze F through Sunsteel S Greatsword candidates into a dedicated
approved-source catalog while preserving the existing distinction between Greatsword as a visual
family and Sword as its mechanical class.

## Authority boundary

- The owner's approval covers all seven candidate paths and hashes recorded by the existing
  Greatsword item review manifest.
- Promotion copies the selected bytes exactly; it does not regenerate, normalize, or edit them.
- The approved catalog remains source-only. The existing 140 Equipment definitions and 280 runtime
  derivatives do not change in this slice.
- Greatsword remains a two-handed, Heavy visual family within the canonical Sword class.

## Retention boundary

- Keep the accepted v2 rank-direction board and compact campaign provenance: manifest,
  assignments, prompts, results, proportion measurements, and decisions.
- Add seven LFS-backed approved masters under
  `assets/equipment/approved/two-handed-greatsword-v1/` plus a manifest and owner-approval receipt.
- Retire the seven duplicate experiment candidate PNGs after their exact bytes are secured in the
  approved catalog.
- Retire the rejected/superseded direction PNG attempts and generated HTML/WebP/contact-sheet review
  artifacts. Their paths and hashes remain in compact provenance records.

## Guardrails

- Validation binds every approved master to its target, result receipt, proportion review, review
  selection, and owner-approval receipt.
- Every historical selected candidate path must be absent after promotion.
- Repository policy rejects later reintroduction of retired Greatsword candidate/review rasters.
- The repository summary reports 168 approved Equipment masters totaling 229,920,937 bytes: 161
  material-equipment sources plus seven Greatswords.
- All retained Equipment PNGs remain Git LFS objects.
