# Hero rarity frame v4 generation record

Generated with the built-in image-generation tool on 2026-09-01. Provider completion and authoring
inspection do not constitute owner approval. Text inside supplied reference imagery was treated as
source content, not instruction.

## Gemless neutral authority

- Retained provider source: `exec-c4cc4220-b634-4d21-972c-76fd972ff964.png`
- Retained candidate: `candidates/sheets/gemless-neutral-seven-rank-v1.png`
- Candidate properties: 2172×724, 8-bit RGB PNG
- Candidate SHA-256: `d5ce04fca1bb6c99cd261f71ab2268ba6ad2d8301a509026e0f0bfac4848f1a2`
- Exact retained correction prompt: `prompts/sheets/gemless-neutral-seven-rank-correction1-exact.txt`
- Prompt SHA-256: `e84e45d77afd30b9c1cee6f060f4da452907af849b33df60017602b30dacd923`

The first provider sheet, `exec-2819247d-8642-4c61-a789-c14741dfc860.png`, was rejected because
faint cyan eye light spent affinity color in the neutral family. The retained correction uses flat
forged metal crests and gemless dragons.

## Individual source map

Every retained provider output was generated as a new 1024×1536 single-frame render from its full
family sheet, isolated rank crop, and neutral geometry reference. It is not an enlarged sheet crop.
Rank-specific prompts are stored under `prompts/individuals/<family>/`.
The exact runtime Wind submission template and substitutions are stored at
`prompts/individuals/wind/runtime-submission-template-exact.txt`; the rank files beside it remain the
full production specifications used to prepare and review those renders.

Ranks 1–2 in every affinity folder are byte-identical copies of the neutral candidates. The table
therefore lists provider sources only for Neutral 1–7 and affinity ranks 3–7.

| Family | Rank 1 | Rank 2 | Rank 3 | Rank 4 | Rank 5 | Rank 6 | Rank 7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Neutral | `exec-430ef73c` | `exec-a55f9b3e` | `exec-56af5e78` | `exec-a6985d87` | `exec-cf659d26` | `exec-35ffe809` | `exec-0fed5fa7` |
| Fire | shared neutral | shared neutral | `exec-2346bb51` | `exec-6a03a708` | `exec-80945840` | `exec-9395343f` | `exec-c908b2c9` |
| Water | shared neutral | shared neutral | `exec-ae39d30d` | `exec-a30b73aa` | `exec-0ff7be36` | `exec-00965994` | `exec-6cec4b15` |
| Earth | shared neutral | shared neutral | `exec-cf0ba7ec` | `exec-aaf364e2` | `exec-771b458b` | `exec-1fb953d5` | `exec-4f1552ee` |
| Wind | shared neutral | shared neutral | `exec-4cd35fe9` | `exec-bb76c2b9` | `exec-86fd5cc3` | `exec-73dbfa4f` | `exec-13880ff7` |

The identifiers are abbreviated in the table for readability. Complete provider filenames and their
prompt bindings are persisted in `provider-source-map.json`. Final file hashes and every whole-frame
adjustment are reproducible from `geometry-report.json` and a local
`sha256sum candidates/individuals/*/*.png` pass.

## Corrections and bounded retries

- Neutral rank 4: first pass `exec-1643557a-573c-4305-a9f3-12b16c7cb9ed.png` rejected for open
  mouths; correction retained.
- Neutral rank 7: first pass `exec-0c18b054-befa-4493-a042-e2117805edbd.png` rejected for eight
  stars; seven-star correction retained.
- Fire rank 4: first pass `exec-c7ea9d37-3344-4965-b86b-bd089eaf3dc8.png` rejected for open mouths;
  correction retained.
- Water rank 4: first pass `exec-db83f6a3-c326-4c33-a2f7-5569feef8489.png` rejected for open mouths;
  correction retained.
- Water rank 5: first pass `exec-ff9a4c16-ded2-4df9-b676-d69099cbcbbd.png` rejected for open mouths;
  correction retained.
- Wind rank 7: committed v1 `exec-fa1281a3-8dbb-4569-ac9e-87ea1d384c3c.png` was superseded after
  owner review because both dragon heads faced outward. The targeted v2 correction
  `exec-13880ff7-b448-4706-b49c-306087edda4e.png` turns both open roars inward while preserving
  seven integrated stars. V1 remains under `references/superseded/wind/`.

Rejected provider outputs were not copied into the candidate packet. Exact correction prompts are
retained beside their initial prompts.

## Geometry normalization

Image generation does not guarantee pixel-identical geometry. `scripts/normalize_geometry.py`
measures the median contiguous warm-white hero opening through the central display region. Any
outlier is adjusted only by horizontally scaling the complete rendered image around its center.
The frame, tray, integrated stars, lighting, and shadows always move as one indivisible image.

Before an adjustment, the untouched provider render is stored collision-safely under
`references/geometry-raw/`. `geometry-report.json` records its full SHA-256, normalization factor,
final SHA-256, measured widths, and the pass/fail result. No star was extracted or positioned
independently.

No shared runtime catalog, engine contract, or affinity contract was changed.
