# Summonable Hero Roster Design

**Status:** Approved in conversation on 2026-09-05

## Outcome

The 200 owner-approved one-star identities from `one-star-overnight-200-001` become the finite
hero pool used by player-facing summons. Every identity has one canonical summon portrait and one
canonical combat chibi. The nineteen approved v3 corrections override their earlier regenerated
chibis; the other 181 use the five-head regeneration outputs.

## Boundaries

- Preserve the immutable experiment outputs as production provenance.
- Record approval in a separate canonical catalog; approval must never mutate a candidate.
- Keep every approved hero at native rarity 1★. Existing evolution support to 6★–7★ is unaffected.
- Preserve legacy procedural character generation for replay compatibility, labs, and tests.
- Route player campaign creation and the standalone player summon endpoint through the finite
  approved pool. Development-only generation routes remain procedural.
- Select deterministically from the campaign or summon seed, and prevent duplicate identities in a
  three-hero starting company.
- Export summon portraits and combat chibis as lazy WebP assets. The 400-image library is not an
  initial page payload.
- Do not modify enemy, item, skill, rarity-frame, or unrelated visual catalogs.

## Canonical identity and replay

Each approved identity receives a stable `human-v6` character draft. The draft's character ID,
manifest, personality, and mind are deterministically derived from its immutable hero slug and the
approved physical manifest. A player seed chooses from those stable drafts; the persisted recipe is
the chosen hero's canonical recipe, so replay regenerates the same named identity rather than a new
procedural approximation.

The existing `artKey` remains the summon portrait binding. Both approved visual assets carry the
same character manifest hash, allowing usage-specific runtime lookup to resolve either the summon
portrait or the combat chibi without introducing a second identity field into engine state.

## Runtime delivery

The approved roster catalog stores exact source paths, byte counts, dimensions, and SHA-256 hashes.
A dedicated exporter verifies those bytes and creates one lazy bundle per hero containing:

- `summon`: 768 px-wide WebP for summoning, dialogue, and roster projections.
- `combat-chibi`: 384 px-wide WebP for combat consumers.

The web resolver searches the established runtime visual manifest first for legacy identities and
then the summonable roster manifest. Existing pages therefore retain compatibility while new
campaign heroes resolve their approved art.

## Acceptance criteria

1. The canonical catalog has exactly 200 unique hero slugs, display names, character IDs, manifest
   hashes, summon assets, and combat-chibi assets.
2. Every source hash and dimension matches the immutable file on disk.
3. Exactly nineteen chibi bindings point at approved `candidate-v3.png` corrections.
4. All 200 manifests are native 1★ and use the `approved-generated-roster` provenance marker.
5. Reusing a seed selects the same hero; a starting company always contains three distinct heroes.
6. Player campaign and standalone summon creation use only catalog heroes.
7. Runtime lookup returns a summon portrait and combat chibi for every catalog manifest hash.
8. Legacy procedural generation and legacy runtime portraits remain valid.
