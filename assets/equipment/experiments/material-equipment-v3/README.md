# Equipment rank-first production v3

This additive namespace owns direction evidence, immutable work packets, candidates, provenance, and review evidence for the rank-first Equipment production. It never implies approval or runtime promotion.

## Completed candidate production

Owner-reviewed candidate production closed on 2026-09-03 with all three checkpoints accepted. The
reconciled evidence contains 11 direction sheets, 77 root candidates, 84 Armour-piece candidates,
11 class audits, 28 material audits, and 21 Armour set-and-piece audits. The 161 candidates are all
included in a proposal-only promotion list; none has been copied into an approved or runtime path.

- Checkpoint 1: `checkpoints/checkpoint-1-directions.json` — 4 accepted directions
- Checkpoint 2: `checkpoints/checkpoint-2-roots.json` — 77 accepted roots
- Checkpoint 3: `checkpoints/checkpoint-3-armour-pieces.json` — 84 accepted pieces
- Final root gallery: `reviews/checkpoint-2-final/index.html`
- Final Armour gallery: `reviews/checkpoint-3-final/index.html`
- Candidate closeout: `runs/material-equipment-v3-run-001/candidate-closeout-v1.json`
- Proposal-only promotion list: `reviews/proposed-promotions/candidate-promotion-v1.json`

The immutable run records 161 base and 49 revision assignments, 210 terminal results, 193
successful calls, 17 failed calls, and 36 intentionally withheld calls. Failed and superseded
attempts remain provenance evidence rather than disappearing from the run history.

## Lifecycle

`direction` → `candidate` → owner review receipt → separately authorized approval → separately integrated runtime asset.

The completed lifecycle passed owner checkpoint 1 for the four generated Bow, Staff, Light Armour,
and Robes progression sheets; checkpoint 2 for all roots; and checkpoint 3 for all Armour pieces.
Each piece remains bound to the exact accepted full-set candidate hash.

## Deterministic package

- Manifest: `manifest.json`
- Allocation and gates: `allocation-plan.json`
- 28 material briefs: `direction/material-briefs/`
- 11 class directions: `direction/class-progressions/manifest.json`
- 161 reserved targets: `targets/`
- Contract schemas: `schemas/`

Validate with:

```bash
corepack pnpm tsx tools/export-equipment-rank-first-production-v3.ts --check
corepack pnpm tsc -p tools/tsconfig.equipment-rank-first-v3.json --noEmit
corepack pnpm vitest run tools/equipment-rank-first-production-v3.spec.ts tools/equipment-armour-review.spec.ts tools/equipment-armour-piece-revisions-v3.spec.ts tools/equipment-rank-first-failures-v3.spec.ts
corepack pnpm tsx tools/validate-equipment-rank-first-evidence-v3.ts --phase closeout
corepack pnpm tsx tools/validate-equipment-rank-first-terminal-evidence-v3.ts
```
