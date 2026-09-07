# Equipment rank-first production v3

This namespace preserves the compact production provenance and accepted direction evidence for the
completed rank-first Equipment campaign. Approval and runtime authority live elsewhere.

## Completed candidate production

Owner-reviewed candidate production closed on 2026-09-03 with all three checkpoints accepted. Its
161 selected sources were copied byte-for-byte into the approved catalog and exported into the
runtime catalog. The original candidate and revision PNGs, generated audit sheets, thumbnails, and
HTML galleries were retired on 2026-09-07 after their bindings were secured by manifests, hashes,
checkpoint decisions, and approval receipts.

- Checkpoint 1: `checkpoints/checkpoint-1-directions.json` — 4 accepted directions
- Checkpoint 2: `checkpoints/checkpoint-2-roots.json` — 77 accepted roots
- Checkpoint 3: `checkpoints/checkpoint-3-armour-pieces.json` — 84 accepted pieces
- Candidate closeout: `runs/material-equipment-v3-run-001/candidate-closeout-v1.json`
- Proposal-only promotion list: `reviews/proposed-promotions/candidate-promotion-v1.json`
- Approved catalog: `../../approved/material-equipment-v1/manifest.json`

The immutable run records 161 base and 49 revision assignments, 210 terminal results, 193
successful calls, 17 failed calls, and 36 intentionally withheld calls. Those outcomes remain in
the compact provenance records; only the superseded raster payloads were removed.

## Lifecycle

`direction` → `candidate` → owner review receipt → approved source → runtime derivative

The completed lifecycle passed owner checkpoint 1 for the four generated Bow, Staff, Light Armour,
and Robes progression sheets; checkpoint 2 for all roots; and checkpoint 3 for all Armour pieces.
Each approved source remains bound to its accepted historical candidate hash.

## Deterministic package

- Manifest: `manifest.json`
- Allocation and gates: `allocation-plan.json`
- 28 material briefs: `direction/material-briefs/`
- 11 class-direction records: `direction/class-progressions/manifest.json`
- 161 reserved targets: `targets/`
- Contract schemas: `schemas/`

Validate with:

```bash
corepack pnpm validate:equipment-approved-sources
corepack pnpm validate:repository-asset-policy
```
