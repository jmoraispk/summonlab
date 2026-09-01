# Hero rarity frame production review packet v3

Status: **approved visual source — frozen by ADR 0066; runtime export pending**.

This packet preserves the prior integrated v3 comparison image and adds a corrected neutral
authority sheet, seven newly generated high-resolution neutral frames, and four affinity progression
studies. Stars are generated as part of each frame's illustrated bottom tray; no source assembles
the stars separately.

## Hard rarity gates

- Rank 1 remains a relatively rectangular forged frame.
- Rank 2 changes through a broader horned silhouette rather than an immediate color jump.
- Material color changes gradually across the progression.
- Ranks 5–7 keep a broad hero opening and a stable outer footprint.
- All dragon mouths at ranks 1–6 are completely closed. Only rank 7 opens both mouths in a roar.
- Every frame uses the same integrated warm-gold star style and contains exactly its rank count.

## Contents

- `candidates/sheets/neutral-progression-v4.png`: corrected seven-rank neutral authority sheet;
- `candidates/highres/neutral-rank-1-v1.png` through `neutral-rank-7-v1.png`: seven newly generated
  1024×1536 neutral frame sources;
- `candidates/sheets/affinity-*-v1.png`: Fire, Water, Earth, and Wind comparison sources with
  neutral ranks 1–2 and gradually increasing affinity expression from ranks 3–7;
- `references/crops/`: rank crops derived from the corrected sheet and used only as generation
  references;
- `prompts/`: exact submitted generation and correction prompts;
- `scripts/`: deterministic crop and prompt preparation helpers;
- `review/index.html`: local visual inspection surface;
- `generation-record.md`: source-bound provider, prompt, hash, and correction provenance;
- `review-evidence.md`: bounded visual inspection results and review questions.

The v3 PNGs listed in `../rarity-frames-freeze-v1/checksums.sha256` are frozen approved visual
sources. They are not transparent runtime exports and are not registered in a shared runtime
catalog. The affinity sheets do not modify or reinterpret shared affinity contracts.
