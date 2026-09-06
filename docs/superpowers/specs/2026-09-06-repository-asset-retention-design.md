# Repository Asset Retention Design

**Status:** Approved in conversation on 2026-09-06.

## Goal

Keep the repository focused on runnable code, canonical metadata, approved visual masters, and
deployable runtime assets. Bulk generation runs, rejected candidates, and reproducible review
outputs must not remain in the primary Git history.

## Storage boundaries

- Regular Git contains code, tests, documentation, compact manifests and receipts, and optimized
  runtime assets.
- Git LFS contains irreplaceable approved or source-authority raster masters.
- Full experiment runs belong outside the repository. Their durable record is the experiment ID,
  approval decision, content hashes, and any selected assets promoted into an approved namespace.
- Generated contact sheets, screenshots, thumbnails, and other reproducible derivatives are not
  source authorities.

## First cleanup slice

The first slice cleans the hero asset family without changing runtime identity or pixels:

1. Move the 200 approved summon portraits and 200 approved combat chibis from experiment folders
   into `assets/heroes/approved/summonable-roster-v1/sources/<hero-id>/`.
2. Preserve their existing hashes, dimensions, asset keys, experiment IDs, and approval ID in the
   canonical catalog.
3. Replace four bulky experiment-file evidence dependencies with one compact approval provenance
   record.
4. Treat the checked-in approved catalog as the canonical roster rather than retaining a one-off
   generator coupled to deleted experiments.
5. Remove every path under `assets/heroes/experiments/`, including generated Python bytecode.
6. Track the promoted PNG masters with Git LFS. Keep their optimized runtime WebP derivatives in
   regular Git so application builds do not require source-master hydration.

## Guardrails

A repository policy validator must reject:

- tracked files under `assets/heroes/experiments/`;
- tracked Python bytecode or `__pycache__` paths;
- summonable catalog visual paths outside the approved source root;
- duplicate or missing approved visual paths;
- catalog paths whose bytes, dimensions, or SHA-256 hashes do not match the catalog;
- approved hero PNGs that are not covered by the `lfs` Git attribute.

The validator must run from the root `check` command. It validates the committed catalog and source
assets; it does not rebuild approved identity from discarded experiments.

## Deferred cleanup

Enemy and equipment experiment removal remains a later slice because their active production
validators still consume experiment manifests. Historical screenshot pruning also remains separate
because several development routes intentionally import design-proposal images. The
`codex/skill-icon-quality-cleanup` branch and the current skill-icon tree are explicitly out of
scope for this slice.

## History migration

This commit reduces the current tree. Removing the old blobs from existing clones and GitHub storage
requires a separately coordinated history rewrite after all active asset branches are merged. That
rewrite is not part of this slice.
