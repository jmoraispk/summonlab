# 0071 — The approved generated heroes are the summonable roster

**Status:** Accepted

**Date:** 2026-09-05

## Context

Hero visual production produced 200 reviewed one-star identities. Each identity has a selected
full-body summon portrait and a summon-bound combat chibi. The images were promoted out of their
versioned experiments into a stable approved source namespace when the production runs were
retired.

The owner explicitly approved all 200 identities as the heroes that can be summoned. Nineteen
heroes received a later, separately approved chibi correction; the remaining 181 use the completed
five-head regeneration. The roster must therefore bind character data, summon art, and combat art
without copying approval back into the candidate experiments or making either image independently
selectable.

## Decision

- `summonable-heroes-v1` is the finite approved player summon pool and contains exactly 200 heroes.
- Every roster member begins at native 1★. Higher current-star forms remain evolution work; this
  decision does not make 2★–7★ variants directly summonable.
- Every roster entry owns one stable `human-v6` character draft, one approved summon source, and
  one approved combat-chibi source. The character manifest's `artKey` identifies its summon source;
  both runtime images are additionally bound to the exact character-manifest hash.
- The nineteen approved v3 chibi corrections supersede their earlier regenerated chibis. All other
  entries use their five-head regeneration result. An override changes only the selected chibi; it
  does not create another hero.
- Normal player campaign creation and the standalone player summon endpoint select deterministically
  from this pool. A multi-hero selection samples without replacement, so one company cannot contain
  the same identity twice.
- Older procedural generators remain available for laboratories, fixtures, replay compatibility,
  and future authoring. They are not the player summon selector.
- Approved source PNGs are immutable Git LFS masters. The approved catalog records their stable
  paths, hashes, dimensions, source experiment IDs, and approval identity. A compact provenance
  record preserves the hashes of the retired production records. Runtime WebPs are generated
  derivatives, kept in lazy per-hero bundles and checked byte-for-byte against that catalog.

## Operative artifacts

- Approved identity and source binding:
  `assets/heroes/approved/summonable-roster-v1/catalog.json`
- Lazy runtime visual binding:
  `apps/web/static/runtime/summonable-heroes-v1/manifest.json`
- Catalog and repository retention validation: `pnpm validate:repository-assets`
- Runtime export validation:
  `pnpm tsx tools/export-summonable-hero-runtime.ts --check`

## Consequences

The generated heroes are now game identities rather than an interchangeable image collection.
Summoning a roster member yields the approved character draft and its summon portrait; combat
consumers can request that same manifest's `combat-chibi` usage. Re-exporting runtime files cannot
silently reassign art because the source and output hashes are validated.

Adding, removing, replacing, or reapproving a hero requires a new versioned catalog or an explicit
catalog migration. Candidate-generation output alone never changes the summon pool.
