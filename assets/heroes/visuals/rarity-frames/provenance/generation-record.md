# Canonical rarity-frame production record

Status: **approved visual source; not runtime-ready**.

This consolidation preserves 48 byte-identical approved images from the frozen v3 and v4 packets.
No image was opened, normalized, re-saved, cropped, composited, or otherwise transformed while
building this library. Each `provenance/source-map.json` record binds one canonical path to one
unique frozen source path with matching SHA-256 values.

## Source history and rollout

- **Legacy Neutral** retains the v3 corrected neutral comparison sheet and seven v3 high-resolution
  neutral frames. It is the preferred rollout starting family.
- **Neutral** retains the v4 gemless-neutral comparison sheet and v4 individual neutral frames.
- **Fire, Water, Earth, and Wind** retain their v3 affinity comparison sheets and v4 individual
  frame families.
- The old v3/v4 packets are historical production provenance and remain intact in Git history at
  pre-retirement commit `6995b8bce7d52e0ae6ba4120cc14366dd70dbf6e`; this library does not
  change runtime catalogs or engine contracts.

## Current and historical path semantics

Paths under `families/` and `provenance/` are current canonical paths. Paths beginning with
`assets/heroes/visuals/rarity-frames-v3/` or `rarity-frames-v4/`, and relative paths such as
`candidates/`, `references/`, and `prompts/` inside the retained provider and geometry maps, are
Git-history source paths. They are audit identifiers, not current filesystem promises. Recover any
historical source with:

```text
git show 6995b8bce7d52e0ae6ba4120cc14366dd70dbf6e:<historical-path>
```

`provider-source-map.json` and `geometry-report.json` are current canonical provenance files copied
byte-for-byte from the retired v4 packet. Their internal versioned paths intentionally retain the
original production vocabulary.

## Retained provider and source identities

The v3 identifiers below are retained from the historical generation record. The canonical source
map binds each output path and hash to its current destination.

| Retained v3 asset | Provider source identifier |
| --- | --- |
| Legacy Neutral sheet | `exec-e12fde6a-a94a-4331-826f-69e919243067.png` |
| Legacy Neutral rank 1 | `exec-c1a4bddd-a89c-4520-83eb-06946cc57ead.png` |
| Legacy Neutral rank 2 | `exec-076c4c25-f109-4d3d-bcf8-15529be83136.png` |
| Legacy Neutral rank 3 | `exec-b11bb7c2-ca05-4acf-88c6-983587f68ab0.png` |
| Legacy Neutral rank 4 | `exec-0c595714-8235-4bf8-b075-15403e2b855f.png` |
| Legacy Neutral rank 5 | `exec-1674bb4b-b464-437a-88c0-94782fce6428.png` |
| Legacy Neutral rank 6 | `exec-cec8d647-5dd0-4e62-ab69-7e448144bd05.png` |
| Legacy Neutral rank 7 | `exec-52d695b9-75af-4cae-81b4-ba302e3e204e.png` |
| Fire sheet | `exec-28863b40-2753-4258-8c72-f73217f85d4e.png` |
| Water sheet | `exec-e02cc3bd-81c2-4640-bd2b-bafd64d5760c.png` |
| Earth sheet | `exec-2a0ab9ec-937c-4a7d-8bf6-33ceea783b91.png` |
| Wind sheet | `exec-ebdf9db6-be96-47ac-9b2e-79c25a379b77.png` |

Rejected v3 first-pass provider identifiers remain part of the audit trail: rank 4
`exec-51e952f8-1099-4d50-b01b-a81d1d66864b.png`, rank 5
`exec-9f1c9b04-ca14-46ee-94eb-97a1c440efc0.png`, rank 6
`exec-02722975-b580-4618-b841-e9f767507723.png`, and rank 7
`exec-daf0f2db-0370-46d4-919c-ff2f99b7fe40.png`.

The complete retained v4 provider identifiers and prompt bindings live in
`provider-source-map.json`. The v4 correction trail also retains the rejected/retained provider
pairs: Neutral rank 4 `exec-1643557a-573c-4305-a9f3-12b16c7cb9ed.png` →
`exec-a6985d87-35ba-4276-b44c-79181c2ef44e.png`; Neutral rank 7
`exec-0c18b054-befa-4493-a042-e2117805edbd.png` →
`exec-0fed5fa7-c342-4f65-96c8-3d9abf652e6a.png`; Fire rank 4
`exec-c7ea9d37-3344-4965-b86b-bd089eaf3dc8.png` →
`exec-6a03a708-18dd-469f-b8fc-783437042a32.png`; Water rank 4
`exec-db83f6a3-c326-4c33-a2f7-5569feef8489.png` →
`exec-a30b73aa-aade-4d4e-9c7a-e911aac712fc.png`; and Water rank 5
`exec-ff9a4c16-ded2-4df9-b676-d69099cbcbbd.png` →
`exec-0ff7be36-17c7-4b45-9a99-bebdcd868a25.png`. The retained Neutral sheet provider is
`exec-c4cc4220-b634-4d21-972c-76fd972ff964.png`; its rejected cyan-eye predecessor is
`exec-2819247d-8642-4c61-a789-c14741dfc860.png`.

## Final prompt provenance

The stable prompt copies retain the final source-bound prompt for each generated asset. Correction
prompts are canonical for Legacy Neutral ranks 4–7, Neutral ranks 4 and 7, Fire rank 4, Water ranks
4 and 5, and Wind rank 7. Fire, Water, Earth, and Wind ranks 1–2 are byte-identical Neutral
inheritances; their source-map records declare `inheritedFrom: neutral` and do not claim false
affinity prompts.

## Wind rank 7 correction authority

- Superseded v1 provider source: `exec-fa1281a3-8dbb-4569-ac9e-87ea1d384c3c.png`.
- Superseded v1 raw provider SHA-256:
  `d559fec2881e2f350825a2357b34d32d5a75755165c7b3393f9db2b8de16aa02`.
- Superseded v1 normalized SHA-256:
  `14c410353cc93c05d5449558222de5323cd2ea54327a7aef70ef3ae19d571356`.
- Active v2 provider source: `exec-13880ff7-b448-4706-b49c-306087edda4e.png`.
- Active v2 source and canonical SHA-256:
  `84c2ff9c3308cc3566b0efba94f20b7db12fb4abc9da3a6f48743d7a2b79c41b`.
- Current prompt: `provenance/prompts/wind/rank-7.txt`; historical prompt source:
  `prompts/individuals/wind/wind-rank-7-inward-heads-v2-exact.txt` (SHA-256
  `7e53290c7290ea5f842dbaff51ccea1e86c3eb6d570c0264998d7351c039abca`).
- Selection rationale: the v1 heads faced outward, away from the hero opening. The v2 correction
  was selected because both open roars face inward while preserving the seven integrated stars.

## Production invariants

- All sheets are 2172×724 RGB PNGs; all frames are 1024×1536 RGB PNGs.
- The bottom tray and warm-gold star count are integral to the generated frame image.
- Ranks 1–6 require completely closed dragon mouths; rank 7 alone opens both mouths.
- Affinity expression begins at rank 3 and progressively strengthens through rank 7.
- Wind rank 7 is the active v2 correction with both roaring dragon heads facing inward; the
  outward-facing v1 apex remains superseded in canonical provenance.

`manifest.json` identifies approved visual-source status, source identity, source-path immutability,
and the active Wind rank 7 authority while explicitly recording that the library is not
runtime-ready. `checksums.sha256` is ordered by manifest family and rank; the source, provider, and
geometry maps retain the complete byte-level and production provenance.
