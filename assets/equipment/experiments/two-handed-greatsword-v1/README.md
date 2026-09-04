# Two-handed Greatsword v1

Status: **direction candidate pending owner review**.

This collision-safe campaign develops Greatsword as a two-handed visual family inside the canonical
`Sword` mechanical class. It does not add another Weapon class, change the approved Equipment v1
catalog, promote source art, export runtime derivatives, or integrate gameplay behavior.

## Item model

- Stable visual-family ID: `greatsword`
- Display name: Greatsword
- Mechanical class: `sword`
- Owner: Equipment
- Slot and handling: main hand, two-handed, Heavy
- Rank-bearing material: metal
- Retained ladder: Bronze F, Iron E, Steel D, Blacksteel C, Skyiron B, Starmetal A, Sunsteel S
- Craftsmanship: Standard is the current authored-art boundary; quality never multiplies visuals
- Acquisition intent: Forged and Dropped instances reuse one authored definition per material
- Set membership: none
- Visual use: direction board followed by dedicated inventory candidates
- Exclusions: a separate class or skill ladder, one-handed use, oversized slab geometry, named
  variants, provenance-specific art, quality-specific art, approval, runtime export, and content
  integration

## Coverage and gates

The campaign has seven material/rank cells and one reference-only rank board:

```text
7 dedicated items + 1 direction board = 8 initial pixel calls
```

The direction board is recorded at its assigned path and no pixel call is currently dispatchable.
Its first call produced the correct designs on the wrong reference-inherited canvas; one bounded
correction restored the assigned 1536×1024 canvas. The seven dedicated item assignments remain
unmaterialized until an owner decision accepts an exact direction-board path and SHA-256. Board
cells will never be cropped into item candidates.

## References

Both inputs are repository-owned direction evidence, not output sources:

- `../rank-first-calibration-2026-09-02/sword-metal-ranks-v1.png` controls rank rhythm, camera,
  spacing, and presentation only. Greatswords must not copy its Sword geometry.
- `../material-vs-class-calibration-2026-09-02/approach-a-steel-material-cohort-v1.png` controls the
  accepted realistic-painterly finish, material response, and studio lighting only.

## Lifecycle

`reference → direction candidate → owner decision → item assignments → item candidates → review`

Promotion, approved masters, runtime derivatives, and content definitions are explicitly outside
this campaign boundary until separately authorized.

## Validation

From the repository root:

```bash
corepack pnpm tsx tools/validate-greatsword-campaign-v1.ts
git diff --check
```
