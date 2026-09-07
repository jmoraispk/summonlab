# Hero legacy retirement design

## Decision

Retire the superseded hero Forge and early experiment material while preserving the canonical hero roster, rarity-frame system, and realtime-combat study.

## Retained assets

- The complete 200-hero approved summonable roster and its 400 source images.
- All rarity-frame material. The image set is exactly 48 PNGs: 42 individual frames (7 rarities × 6 affinity families) plus 6 family comparison sheets. The remaining 49 files are manifests, prompts, reports, checksums, notes, and the review page.
- The realtime-combat study, except for four explicitly superseded motion-sheet sources. Current strips, support records, and later motion sheets remain authoritative.
- The current hero-rendering style reference.
- Approved route-local Village cutouts already derived from the six-person lab sources. Their original experimental inputs may be recovered from Git history.
- The approved Ember anchor outside the retired visual-experiment tree.

## Retired assets and surfaces

- `assets/heroes/visuals/forge-v1/**`
- `assets/heroes/visuals/forge-v2/**`
- `assets/heroes/visuals/owner-playtest-v1/**`
- The early root-level hero catalog, audit, continuity, roster-pair, and settlement-scale experiments.
- The four superseded motion sheets named in the implementation plan.
- The derived `apps/web/static/runtime/visual-catalog-v1/**` bundle.
- Hero Forge and Visual Lab routes, APIs, validators, and historical Pack 2 documents whose sole purpose was reviewing those retired experiments.

Enemy Forge pages and retained enemy packs are outside this retirement and remain available.

## Consumer migration

Village and wiki fixtures must use the retained route-local approved cutouts instead of importing retired source portraits. Links to retired hero review routes should point to the current hero wiki. No live build may depend on a retired path.

## Git LFS policy

Every retained PNG under `assets/heroes/visuals/**` is stored through Git LFS. Existing history is not rewritten; this policy applies to the rebased branch tip and future commits. The newly merged approved skill reference is normalized to its already-declared LFS rule as part of the same repository hygiene pass.

## Enforcement

The repository asset validator rejects reintroduction of retired paths and verifies that every retained hero-visual PNG is tracked by LFS. Canonical roster, fauna, equipment, and enemy-pack checks remain unchanged.
