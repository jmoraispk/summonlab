# Historical Living Village visual packet

These six PNGs are retained wiki evidence from the former Living Village lab: Dara Zev, Mara Vey,
Jori Daro, Kira Toren, Iven Orra, and Remy Nahl. They are separate from the approved summonable-hero
roster and must never be used as a fallback for a persistent Village resident or satisfy a
`village-cutout` runtime lookup.
Canonical playable-hero ownership remains exclusively with
`assets/heroes/approved/summonable-roster-v1/catalog.json` and its runtime derivatives.

The fixtures are alpha-background derivatives of their lab identity anchors. No face, clothing,
pose, or painted character content was regenerated. Background isolation used `rembg`'s
`u2net_human_seg` model with alpha matting and edge decontamination.

| Cutout | Historical source |
| --- | --- |
| `dara-zev.png` | `assets/heroes/visuals/owner-playtest-v1/dara-zev-anchor-v1.png` |
| `mara-vey.png` | `assets/heroes/ember-01-anchor-v1.png` |
| `jori-daro.png` | `assets/heroes/visuals/owner-playtest-v1/jori-daro-anchor-v1.png` |
| `kira-toren.png` | `assets/heroes/visuals/forge-v2/pilot/kira-toren-anchor-v1.png` |
| `iven-orra.png` | `assets/heroes/visuals/forge-v2/pilot/iven-orra-anchor-v1.png` |
| `remy-nahl.png` | `assets/heroes/visuals/hearth-02-anchor-v1.png` |

The source Forge and owner-playtest experiments were retired on 2026-09-07. Their full provenance
remains recoverable from Git history. A later hero migration may promote one of these identities only
through the canonical summonable-hero catalog and the summon, combat-chibi, and Village-cutout visual
trio validation.
