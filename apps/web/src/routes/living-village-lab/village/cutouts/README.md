# Route-local Village cutouts

These six PNGs are alpha-background derivatives of the approved identity anchors used by the
Living Village prototype. No face, clothing, pose, or painted character content was regenerated.
Background isolation used `rembg`'s `u2net_human_seg` model with alpha matting and edge
decontamination.

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
