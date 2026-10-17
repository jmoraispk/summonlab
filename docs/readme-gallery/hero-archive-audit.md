# Hero archive audit · October 17, 2026

The tracked tree and locally reachable Git history contain **736 named hero identities**: 200 approved, 471 additional historical candidates, 62 earlier studies and playtest identities, and three combat prototypes. The [complete gallery](hero-archive.md) publishes one selected portrait for each. The 671 overnight identities have unique IDs and identity signatures; the additional 471 are separate identities from the approved 200.

Asha uses the same base visual as the retained Ocher Braid style reference and is counted once as a named prototype person. Toma and Nessa complete the three-person combat prototype collection. No animation frame, enemy, unnamed figure, or rarity border adds another hero.

Source-tree counts below describe the checkout before the new archive thumbnails were added.
Thumbnails and other runtime derivatives do not create additional named identities. A remote branch
check found only `main` and `codex/public-archive-readme`; both histories are reachable here.

## Source collections

The immutable overnight source snapshot is `ae01c4f5578d260335442534f11fda8b2a0ba615`. The earlier Forge/owner gallery snapshot is `cc2a3427f27948f16fcf6b6226e1e069cd47b5af`. Retained current/prototype bindings are recorded against `634d48644ec41d2a8ff3c9f839b8fec2b2830617`.

| Collection | Image paths / identities | Status and counting treatment |
| --- | --- | --- |
| Approved roster sources | 403 PNG paths / 200 identities | 200 summons, 200 chibis, three Village cutouts; count 200 |
| Approved roster runtime | 403 WebP paths / same 200 | Runtime presentations, not another 200 identities |
| Overnight original candidates | 1,696 PNG paths / 671 identities | Candidate-only history; 471 not in approved roster |
| Overnight review derivatives and evidence | 1,723 path spellings across history | Repeated review presentations, reference shelf, and two unregistered correction attempts; do not add identities |
| Native-star study | 12 portraits / 12 identities | Candidate production; included among the older 35 |
| One-star selection pilot | 12 portraits / 12 identities | Rejected rendering direction; older gallery links alternatives |
| One-star mass wave 1 | 34 path spellings / 16 identity-or-reference designs | 16 summons and 16 chibis, plus two spelling-migration paths; Ocher Braid is a reference |
| One-star mass wave 2 | 34 path spellings / 16 identity-or-reference designs | Same counting rule; overlaps wave 1 and native studies |
| Ultra-realistic progression | 5 path spellings / 4 progression sheets | Four existing identity-or-reference designs, with one spelling migration; no additional named hero |
| Five-head chibi regeneration | 400 paths / 200 existing overnight IDs | Original candidates plus runtime review derivatives; no new identity |
| Five-head chibi revisions | 97 paths / 19 existing overnight IDs | Corrections and derivatives; no new identity |
| Head-height calibration | 8 paths / Aear Soro | Proportion variants of an existing identity |
| Head-height generalization | 9 paths / 3 existing overnight IDs | Aear Soro, Brinen Sorel, Lanor Beleth; last two belong to the overlooked 471 |
| Current-company Village backfill | 7 paths / 3 approved identities | Provider outputs, cutouts, group review; no new identity |
| Forge v1 | 4 anchors / 4 identities | Included in the existing 27 Forge/owner identities |
| Forge v2 | 28 paths / 18 identities | Pilot/cohort anchors, six continuity images, two Remy Esen benchmarks, two group proof images |
| Owner playtest | 3 anchors / 3 identities | Dara Zev, Elian Ro, Jori Daro; included in older gallery |
| Original lab anchors and continuity | Mara Vey and Remy Nahl; four individual paths | Included in older gallery; Mara source anchor remains retained |
| Village lab cutouts | 6 current-style historical asset paths and six former route-local paths / 6 older identities | Moves and cutout variants, not additional identities |
| Hearth roster pair and settlement-scale sheet | 2 group/comparison images | Existing people in comparison/context; not individual portraits |
| Realtime hero source and motion production | 16 historical paths / 3 named people | Owned Asha source plus motion sheets/strips; three people counted separately from animation frames |
| Realtime runtime study | Ready cutouts plus motion atlases, environment, and enemies | Count only Asha, Toma, Nessa; rats and sprout goblin are monsters |
| Spine exploration/transport/decomposition | 10 hero source paths + 7 runtime review images | Asha parts, masks, board, recomposition, transport; no new identity |
| Current rendering style reference | 2 historical path spellings / 1 progression sheet | Ocher spelling migration, one SHA-256; same base visual as Asha |
| Rarity frame collections v1–v4 and current families | 174 historical path spellings | Frames, sheets, normalized references; zero hero identities |
| Docs mockups, evidence, report figures, and screenshots | Located across docs and prototype evidence | Context/comparison/animation evidence; excluded from identity counts |
| Agent summoning concept, tower prototype, title backgrounds, settlement images | Root assets and runtime/player | Concept/world/background imagery; excluded from named hero counts |

The native, pilot, and mass-wave identity unions are the existing 35 older study identities. Forge v1/v2, original lab, and owner-playtest anchors supply the existing 27 older lab identities. The two unions are already browsable in the 62-person gallery and need not be duplicated as new identities.

### Overnight wave breakdown

| Wave | IDs with portraits | Additional IDs outside approved roster | Summon variants | Chibi variants |
| --- | ---: | ---: | ---: | ---: |
| 01 | 25 | 5 | 30 | 36 |
| 02 | 26 | 6 | 31 | 34 |
| 03 | 39 | 19 | 46 | 47 |
| 04 | 144 | 124 | 218 | 143 |
| 05 | 102 | 82 | 153 | 112 |
| 06 | 131 | 111 | 193 | 133 |
| 07 | 49 | 29 | 75 | 54 |
| 08 | 51 | 31 | 69 | 61 |
| 09 | 51 | 31 | 59 | 71 |
| 10 | 53 | 33 | 69 | 62 |
| Total | 671 | 471 | 943 | 753 |

## Audit method, verification, and limits

- Enumerated the complete tracked tree using `git ls-files`: **4,795 tracked raster files**, including all asset roots, runtime folders, documentation, prototype route folders, evidence, and screenshots.
- Enumerated image additions across every locally reachable ref using `git log --all --no-renames --name-only --diff-filter=A` with PNG, WebP, JPEG, GIF, and AVIF pathspecs: **14,356 distinct raster path spellings**. Disabling rename detection matters: the initial rename-aware scan missed 599 historical path spellings.
- Enumerated reachable Git objects and inspected historical tree/manifest/activation bindings. No separately named hero image collection outside the source collections above emerged from the global path audit.
- Parsed the 671 selected portraits' hash-bound target JSON, checked 671 unique signatures, checked image variant SHA-256 values, and verified local availability of every original candidate and every gallery entry.
- Inspected real retained Asha source and Ocher progression images and the 33 new candidate images. Headless Chromium rendered existing source images only; no new artwork was generated.
- Identity counting follows explicit names and identity signatures, not facial similarity. Replacement identities can share quota/body/wardrobe categories. A different correction image remains a variant when the identity ID and bound signature remain the same.
- Global history path totals include spelling migrations, moves, source/runtime copies, and screenshot revisions. They are not unique artwork or identity counts. Per-collection path spelling counts are not additive portrait counts.
- This is exhaustive for the tracked tree and **locally reachable Git refs**. It does not claim access to untracked external generation storage, lost/unreachable commits, deleted remote branches absent from this clone, other repositories, or personal uploads never committed here.
- Screenshots and group sheets were categorized from their paths and manifests/context. They were not all individually inspected for unnamed faces, and no unnamed background figure has been promoted to a named hero identity.
- Public HTTP availability of every image URL was not bulk tested. Local bytes and immutable Git bindings were verified; publication should check representative raw and LFS media links, plus any live gallery rendering.
- Publication checks verify all 736 original source hashes, thumbnail hashes, dimensions, and generated GitHub gallery content. The source audit itself did not change roster approvals.

## Identification review

The inventory preserves the 33 additional candidate IDs whose actual portraits were visually
inspected, along with the unconfirmed search leads Eirar Ulenin, Valu Pellai, Loro Lorar, and
Meiin Sorin. These are search leads rather than an identification, favorite choice, or art approval.
The owner explicitly rejected Zuri Pell as the remembered heroine. No identification is inferred
from hair, skin value, wardrobe, or visual resemblance alone.
