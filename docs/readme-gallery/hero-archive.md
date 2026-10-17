# Complete hero archive

Browse **736 named identities**, using small thumbnails of the exact existing raster sources.
Select a portrait to open its immutable original. All pages are in name order, with 24 heroes
per page. In the app, open `/wiki/heroes` to search names and recorded hair or wardrobe details,
filter collections, and move between pages.

| Collection | Identities | Status |
| --- | ---: | --- |
| Approved roster | 200 | Current approved summon portraits; the playable roster is unchanged |
| Historical candidates | 471 | Earlier production identities outside the approved roster |
| Earlier studies and playtests | 62 | Original historical approval labels retained per identity |
| Combat prototypes | 3 | Asha, Toma, and Nessa; outside the summonable roster |
| Total | 736 | Named identities, not image variants or animation frames |

## Browse portraits

[01](hero-archive-01.md) · [02](hero-archive-02.md) · [03](hero-archive-03.md) ·
[04](hero-archive-04.md) · [05](hero-archive-05.md) · [06](hero-archive-06.md) ·
[07](hero-archive-07.md) · [08](hero-archive-08.md) · [09](hero-archive-09.md) ·
[10](hero-archive-10.md) · [11](hero-archive-11.md) · [12](hero-archive-12.md) ·
[13](hero-archive-13.md) · [14](hero-archive-14.md) · [15](hero-archive-15.md) ·
[16](hero-archive-16.md) · [17](hero-archive-17.md) · [18](hero-archive-18.md) ·
[19](hero-archive-19.md) · [20](hero-archive-20.md) · [21](hero-archive-21.md) ·
[22](hero-archive-22.md) · [23](hero-archive-23.md) · [24](hero-archive-24.md) ·
[25](hero-archive-25.md) · [26](hero-archive-26.md) · [27](hero-archive-27.md) ·
[28](hero-archive-28.md) · [29](hero-archive-29.md) · [30](hero-archive-30.md) ·
[31](hero-archive-31.md)

The original [200-hero gallery](heroes.md) preserves catalog order. The
[62-person historical gallery](legacy-heroes.md) preserves alternate portraits and original status
links. Zuri Pell remains ruled out as the remembered heroine. Identification and selection for the
README require the owner's confirmation; appearance in this archive is not approval.

## Sources and reproduction

The durable [inventory](hero-archive.json) records every selected source commit, repository path,
SHA-256, original-image URL, thumbnail hash and dimensions, collection, and status. For all 671
identities from the overnight production collection, it also preserves the bound identity signature,
hair and wardrobe descriptions, target path and Git blob, and portrait/combat variant counts. The
200 approved entries use their current approved runtime portraits; their historical candidate
portrait bindings remain separately recorded. Earlier study labels retain their original meaning.

Search metadata is a reader-facing excerpt normalized to American English. Exact historical
schema literals remain in the immutable source target documents. This archive does not rename
those source identifiers, recompute their identity signatures, or change their original bindings.

The [audit and collection summary](hero-archive-audit.md) describes the complete scan, source
collections, counting rules, and limits. The archive is separate from the canonical wiki document
catalog and does not add a design-document ID or change runtime summon bindings.

Regenerate from reachable Git objects and the local Git LFS cache, without remote image downloads:

```sh
python3 tools/export-hero-archive.py --write
python3 tools/export-hero-archive.py --check
```

Python 3 and Pillow are required. The exporter verifies every original SHA-256 before resizing,
preserves aspect ratios and transparency, and produces WebP images within 240 × 360 pixels. It
never generates new character artwork. SHA-256 bindings cover the originals and committed
thumbnails. Generated gallery pages use relative paths to those same small committed thumbnails;
full originals load only when selected. Missing LFS originals produce an explicit error rather than
silently substituting another image. Pillow/WebP versions may change encoded bytes when re-exporting;
review and commit the corresponding derivative hashes together.
