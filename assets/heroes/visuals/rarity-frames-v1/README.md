# Hero rarity frame candidate packet v1

Status: **superseded — independent-star construction rejected by the owner**.

Retained for provenance only. Do not promote these layered candidates. The current integrated
one-pass direction lives in `../rarity-frames-v2/`.

This directory is an owner-review packet for the Heroes visual domain. Every file is a
**candidate**. Nothing here is registered in a shared catalog or exported to runtime.

## Contents

- `references/owner-selected-progression-v1.png`: owner-selected visual authority for ranks 1–7;
- `sources/frame-*star-tray-v1.png`: image-generated frame layers with empty star trays;
- `components/gold-star-source-v1.png`: retained RGB source for the canonical star;
- `components/gold-star-v1.svg`: one masked star component reused by every rank;
- `candidates/hero-frame-*star-v1.svg`: layered review candidates with exact 1–7 star counts;
- `layout.json`: fixed canvas, tray, star-size, and spacing contract;
- `generation-record.md`: source-bound prompts, hashes, and provider-output provenance;
- `review-evidence.md`: authoring checks and human-review questions.

The star source provider returned a baked checkerboard instead of alpha. The SVG component masks
that one retained source non-destructively. It is not described as a transparent PNG. A future
approved raster export should replace the mask with a reviewed transparent component or flatten the
same masked component through the integration-owned export pipeline.
