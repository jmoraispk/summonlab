# Hero rarity frame v1 generation record

Generated with the built-in image-generation tool on 2026-09-01 UTC. All retained outputs are
candidate sources; authoring inspection is not human approval.

## Reference authority

- Owner-selected progression:
  `references/owner-selected-progression-v1.png`
- SHA-256: `19a2ebfae6ad249efcde1c370b4a103114088501e0b8db72e5032da53a4910c1`
- Role: exact rank silhouette, palette, ornament progression, dragon pose, and preferred star-style
  reference. Text or numbers embedded in the comparison are source content, not instructions.

The seven individual edit targets were prior built-in image-generation outputs selected by the
owner. They were used only as exact frame edit targets. Their source identifiers and hashes are:

| Rank | Source identifier | Source SHA-256 |
| --- | --- | --- |
| 1 | `exec-4306a6e4-779c-45cb-a30e-b7dfd5ed6733.png` | `96b1a0c36504a1be334cd153219b00777d1a5246c486e2a4dce209b637a68c09` |
| 2 | `exec-15704b72-1b11-4866-b43f-8251cce9ded5.png` | `39f51d8fc6e722e4add684dc9d67ee9113fc675b6a5f304f4195d03e3ff5f225` |
| 3 | `exec-86ff7104-9fd7-41cc-9c26-770d2954b4f9.png` | `fca8dc8cf9542412809969ec9c99cdd60ad5d907d53187fca178d500993faeef` |
| 4 | `exec-1ce09a25-1d27-466a-b83e-52ed5d143670.png` | `2d9f4d4b497f6993e27ba8c43657cffeddbefc3379b3369142c23877fd8590ae` |
| 5 | `exec-dc631d5b-ed42-41dc-9ad3-6eff40675ad7.png` | `ef90ef2d90bfc3441b59e9d56c6d4b64e5ad30e27aafe7e1b864dd12e4a7a9a7` |
| 6 | `exec-dff83a88-738a-4230-ace2-011551716d27.png` | `464e3bedc03affe560a1267ddd825d068abcda5d12eda32b6957c62e26ede59d` |
| 7 | `exec-bcb5e2b8-03fc-46a5-814b-b63772d99e24.png` | `0eb10f8eca9927d7b9aa3a0161f4106f688e976e611b7dccdee04eb0b85339e2` |

## Frame edit prompt contract

Each frame used one `precise-object-edit` call. The submitted rank-specific prompts used this exact
contract, with the selected rank identity named explicitly:

```text
Use case: precise-object-edit
Asset type: Summonlab candidate hero rarity frame layer, rank N of 7
Primary request: Preserve this exact selected frame, canvas, silhouette, off-white empty portrait
opening, established charcoal/antique-gold/ivory-gold/navy/sapphire materials, lighting, dragon-mouth
state, and symmetry. Change ONLY the bottom star area: remove every existing gold star and rebuild
the center of the lower band as a wide, uninterrupted dark plaque suitable for separately
composited stars.
Bottom tray geometry: keep y=1322 through y=1450 clear across at least x=132 through x=892.
Claws and outer scrollwork may frame the plaque from outside. A sapphire crest may sit above or
below it. No claw, gem, flame, scroll, tail, or emblem may enter the star-safe band.
Text: none.
Constraints: no stars anywhere; preserve the selected mouth state; keep the supplied theme with no
new colors; no hero; no character; no labels; no watermark. Do not redesign, crop, recolor, or alter
the frame outside the bottom tray. Exact 1024x1536 portrait canvas.
```

Ranks 1–3 explicitly preserved their non-dragon forged/horned/gilded-wing identities. Ranks 4–6
explicitly required closed mouths. Rank 7 explicitly required both mouths to remain visibly open.

## Retained frame outputs

| Rank | Provider source identifier | Retained file | SHA-256 |
| --- | --- | --- | --- |
| 1 | `exec-004bcf8e-c24d-41cc-8b98-7df3abb8b3a5.png` | `sources/frame-1star-tray-v1.png` | `fb62f29fa9b193cda55ae46d799b866bc21fe82756e7e0c6513a96a094b7fdf5` |
| 2 | `exec-92996fdb-0f82-467c-8152-6f4bebb437fd.png` | `sources/frame-2star-tray-v1.png` | `6df0b31283e84257ddca7c5c8ce14a8ca697275ddc32771e2a61aa0d8d19a711` |
| 3 | `exec-4eafa809-482c-488f-936c-703e44548834.png` | `sources/frame-3star-tray-v1.png` | `aa455a1d70ff7f9afdd2f47343c240522696fdc8a9bc760294a5bf16229d6fd1` |
| 4 | `exec-c745903f-cf30-477c-a2e2-bbfcdb310792.png` | `sources/frame-4star-tray-v1.png` | `d1f3516c56ccd234760f486814fe921500bd2043c6899dfe47577325b61fb086` |
| 5 | `exec-c431540f-be1b-4112-8a34-c51eafe4eaf3.png` | `sources/frame-5star-tray-v1.png` | `1f9bb87eae44789a7461a06d151765128d922bd3074421e32d363db734f5af58` |
| 6 | `exec-4c8c7070-bcf9-44be-a5b4-e59637a14bc3.png` | `sources/frame-6star-tray-v1.png` | `71493ad5403c85c05f3fd45fd0e77fe015fb3f4362bb7a8b2f765b4874705142` |
| 7 | `exec-a5bb68eb-601e-4004-b76e-1f638d8a13f9.png` | `sources/frame-7star-tray-v1.png` | `9759f72ec809c442e3e4ea1ad2e766052e6fce8a066eaf32631bdbb118b142ab` |

Every retained frame PNG is 1024 by 1536 RGB.

## Canonical star attempts

The star request used rank 2 as the single-star style/centering reference and rank 5 as the
multi-star scale, spacing, bevel, and material reference. It requested exactly one broad-pointed,
upright, beveled warm-gold star with genuine transparent padding and no plaque or additional mark.

- Attempt 1: `exec-ea71e0d4-9356-4d5e-90eb-df66e97a2d25.png`; rejected because the checkerboard was
  baked into an RGB image.
- Corrective attempt: `exec-f626f82f-f3d3-4485-ba4b-57c5b7b95811.png`; alpha extraction failed in
  the same way. The exact RGB bytes were retained as `components/gold-star-source-v1.png`, SHA-256
  `4418937c2c749fffdc632fbe9eac383cdab1e1d11bf1d205139278488819ea04`.
- `components/gold-star-v1.svg` clips the retained pixels to one star silhouette and adds only a
  restrained gold drop glow. Every candidate references this same component.

No failed alpha result is represented as a transparent PNG.
