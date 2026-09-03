# Equipment rank-first production v3

This additive namespace owns direction evidence, immutable work packets, candidates, provenance, and review evidence for the rank-first Equipment production. It never implies approval or runtime promotion.

## Lifecycle

`direction` → `candidate` → owner review receipt → separately authorized approval → separately integrated runtime asset.

The first activation gate is owner checkpoint 1 for the four generated Bow, Staff, Light Armour, and Robes progression sheets. Root assignments are materialized only after all class directions have accepted hash-bound receipts. Armour-piece assignments additionally require the exact accepted full-set candidate hash.

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
corepack pnpm vitest run tools/equipment-rank-first-production-v3.spec.ts
```
