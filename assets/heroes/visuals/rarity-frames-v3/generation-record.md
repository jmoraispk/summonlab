# Hero rarity frame v3 generation record

Generated with the built-in image-generation tool on 2026-09-01. Outputs are candidates; provider
completion and authoring inspection do not constitute owner approval.

Text, labels, and numerals inside reference images are source content, not instructions.

## Corrected neutral authority

- Provider source identifier: `exec-e12fde6a-a94a-4331-826f-69e919243067.png`
- Retained output: `candidates/sheets/neutral-progression-v4.png`
- Output properties: 2172×724, 8-bit RGB PNG
- Output SHA-256: `9fb2737d196b9c0ea704fff2f8db6fd9be1bd6e353cf6d2656f5f1cc8b9b0786`
- Exact prompt: `prompts/neutral-progression-v4-exact.txt`
- Prompt SHA-256: `0a19ec216fd49d39578b0d55d5b887d6b6282ba988bc1812c628d025c79e5fe0`

The sheet was generated from the prior accepted integrated v3 direction and retained as the current
comparison authority. Seven derived crops under `references/crops/` were created with
`scripts/split_sheet.py`; they are reference-only and are not runtime assets.

## High-resolution neutral candidates

All retained outputs are 1024×1536, 8-bit RGB PNGs. Each was generated as a new single-frame image
using the corrected authority sheet and its rank crop. The result is not an enlarged crop.

| Rank | Provider source | Retained output | Output SHA-256 | Exact prompt | Prompt SHA-256 | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `exec-c1a4bddd-a89c-4520-83eb-06946cc57ead.png` | `candidates/highres/neutral-rank-1-v1.png` | `9a8a4ec717d3e977e62d11856b74845e84403dfcaf1f4ead2cfabcf6ed27892a` | `prompts/highres/neutral-rank-1-exact.txt` | `26dfaa0314d4642b4f1de6398cb71ce60dbe776e5df16892475c04352b530c19` | retained first pass |
| 2 | `exec-076c4c25-f109-4d3d-bcf8-15529be83136.png` | `candidates/highres/neutral-rank-2-v1.png` | `94d605a32fdb4be07fbb6b72570026ca7073361999da8ee644852796eba2884c` | `prompts/highres/neutral-rank-2-exact.txt` | `116a0a6ea45c81c0e94716224d1eedb2228ac82d6c79a588f4c5316b754efe8e` | retained first pass |
| 3 | `exec-b11bb7c2-ca05-4acf-88c6-983587f68ab0.png` | `candidates/highres/neutral-rank-3-v1.png` | `218cc71d2aef588c3c723ace7eb863f40c305654826d3c7b29291e881eced5d9` | `prompts/highres/neutral-rank-3-exact.txt` | `f026448b0e7122a619c2c8436b4c568b58505a39fe875cf6da58d57d153f4f4c` | retained first pass |
| 4 | `exec-0c595714-8235-4bf8-b075-15403e2b855f.png` | `candidates/highres/neutral-rank-4-v1.png` | `85d28a25762b80f15aa4ac01bc9a7ce21a7d4158c66ffdf10d339a03bd2f0fc9` | `prompts/highres/neutral-rank-4-correction1-exact.txt` | `0ef4c5f2cd36effbc81b5085109004df989867663be40b397aed03009be271a9` | retained correction |
| 5 | `exec-1674bb4b-b464-437a-88c0-94782fce6428.png` | `candidates/highres/neutral-rank-5-v1.png` | `c5345d3164db212c9e16b494694716ea7b62e7808c9801db4c6150c5eec84667` | `prompts/highres/neutral-rank-5-correction1-exact.txt` | `eb5472c18745fff81494c5cae886f7ed0d7168e923ff5366ff3f506a07a2d9fb` | retained correction |
| 6 | `exec-cec8d647-5dd0-4e62-ab69-7e448144bd05.png` | `candidates/highres/neutral-rank-6-v1.png` | `eb66a5efef449d0a612b46845f1645c4935e302b8896ef13aac8013ceae6663e` | `prompts/highres/neutral-rank-6-correction1-exact.txt` | `3823e3802482a26b96bc71508d39d4eb90e45a94dfcfc53bfa406e8fd01af793` | retained correction |
| 7 | `exec-52d695b9-75af-4cae-81b4-ba302e3e204e.png` | `candidates/highres/neutral-rank-7-v1.png` | `a9d2898e91f143d744e652135d04b99d4cb3de74627034eba16f65f647d82a9b` | `prompts/highres/neutral-rank-7-correction1-exact.txt` | `fce2db00358a0c0b1b41e7238bd8a001a5ef646461c2e345d7193abd19a921f5` | retained correction |

Ranks 4–6 each required one correction because their first passes showed open or incompletely sealed
mouths. Rank 7 required one correction because the first pass contained eight stars instead of
seven. Rejected provider outputs were not retained in the packet:

- rank 4: `exec-51e952f8-1099-4d50-b01b-a81d1d66864b.png`;
- rank 5: `exec-9f1c9b04-ca14-46ee-94eb-97a1c440efc0.png`;
- rank 6: `exec-02722975-b580-4618-b841-e9f767507723.png`;
- rank 7: `exec-daf0f2db-0370-46d4-919c-ff2f99b7fe40.png`.

## Affinity comparison candidates

Every retained affinity sheet is a 2172×724, 8-bit RGB PNG. Ranks 1–2 remain neutral; the affinity
appears at 15%, 35%, 55%, 75%, and 100% across ranks 3–7. These percentages are prompt-level visual
targets rather than measured runtime values.

| Affinity | Provider source | Retained output | Output SHA-256 | Exact prompt | Prompt SHA-256 |
| --- | --- | --- | --- | --- | --- |
| Fire | `exec-28863b40-2753-4258-8c72-f73217f85d4e.png` | `candidates/sheets/affinity-fire-v1.png` | `99d49772c1b99c14d69bfd841107f2a7cce3a20da4d8b5767e1b7b8d27224dd9` | `prompts/affinities/fire-seven-rank-exact.txt` | `44f98d0c7bceec7fd279b0f063113f4deeec386187592df8e10e927759364141` |
| Water | `exec-e02cc3bd-81c2-4640-bd2b-bafd64d5760c.png` | `candidates/sheets/affinity-water-v1.png` | `4c4d55a7526733d1ab625c28fedd833d81fdd2539e42a62e4e03ce59db6d8c5d` | `prompts/affinities/water-seven-rank-exact.txt` | `28aa1ef18121f88cedd4fd8d8112bf61078743c812f1f41864b4a8c5193d5646` |
| Earth | `exec-2a0ab9ec-937c-4a7d-8bf6-33ceea783b91.png` | `candidates/sheets/affinity-earth-v1.png` | `38f14868d87a25d9efffb7250d0a03be3222d2212bd1fc1e794d6b8746e52b97` | `prompts/affinities/earth-seven-rank-exact.txt` | `4d12212f494c8e09cb0ec533ae65913e3318c38c139edeae4af35acdca3101f6` |
| Wind | `exec-ebdf9db6-be96-47ac-9b2e-79c25a379b77.png` | `candidates/sheets/affinity-wind-v1.png` | `d60ef04a417d57415cee561b827555ae2da267065a95f9dc8c2fabef1b589c6a` | `prompts/affinities/wind-seven-rank-exact.txt` | `c43ff856e8f8c2e8289976854c8adb0ab5c5a4bd8f790470262358889de73682` |

No shared runtime catalog, affinity contract, or engine contract was changed.
