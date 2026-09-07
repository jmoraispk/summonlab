# Route-local Village cutouts

These six PNGs are visual-development fixtures for the Living Village lab only: Dara Zev, Mara
Vey, Jori Daro, Kira Toren, Iven Orra, and Remy Nahl. They are absent from the approved
summonable-hero roster and must never be imported by `/play` or used as a fallback for a persistent
Village resident. Canonical playable-hero ownership remains exclusively with
`assets/heroes/approved/summonable-roster-v1/catalog.json` and its runtime derivatives.

The fixtures are alpha-background derivatives of their lab identity anchors. No face, clothing,
pose, or painted character content was regenerated. Background isolation used `rembg`'s
`u2net_human_seg` model with alpha matting and edge decontamination.

| Cutout | Approved source |
| --- | --- |
| `dara-zev.png` | `assets/heroes/visuals/owner-playtest-v1/dara-zev-anchor-v1.png` |
| `mara-vey.png` | `assets/heroes/ember-01-anchor-v1.png` |
| `jori-daro.png` | `assets/heroes/visuals/owner-playtest-v1/jori-daro-anchor-v1.png` |
| `kira-toren.png` | `assets/heroes/visuals/forge-v2/pilot/kira-toren-anchor-v1.png` |
| `iven-orra.png` | `assets/heroes/visuals/forge-v2/pilot/iven-orra-anchor-v1.png` |
| `remy-nahl.png` | `assets/heroes/visuals/hearth-02-anchor-v1.png` |

The repository's existing source and runtime variants are all opaque RGB images; these derivatives
remain route-local until an approved shared transparent export exists.
