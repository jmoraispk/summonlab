# Two-handed Greatsword v1

Status: **proportion revision pending owner review; standalone item production remains gated**.

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

The original direction board is retained with a `revise` decision because every blade-to-full-hilt
ratio fell below the approved minimum. A museum-grounded proportion contract then authorized one
fresh v2 board and one bounded correction. The correction now passes blade-to-hilt (2.54–2.70),
blade-to-grip (3.31–3.53), blade-share (71.72–72.98%), and pommel-share (4.50–4.81%) checks across
all seven ranks. It remains `revise` because its functional guards span only 19.53–21.93% of total
length against the approved 24–30% range.

No pixel call is currently dispatchable. The seven dedicated item assignments remain
unmaterialized until an owner decision accepts an exact direction-board path and SHA-256. Board
cells will never be cropped into item candidates.

## Proportion review

The contract defines landmarks before measuring: blade runs from functional guard plane to tip;
full hilt runs from guard plane to pommel end; exposed grip excludes guard and pommel; guard width
uses the functional quillon tips. The review records per-rank pixel measurements, derived ratios,
and pass/fail criteria in `reviews/proportions/greatsword-metal-ranks-v2-measurements.json`.

Open `reviews/proportions/index.html` for the v1/v2 comparison, numeric envelope, and owner decision
evidence. The current recommendation is to preserve every v2 trait except functional guard span.

## References

Both inputs are repository-owned direction evidence, not output sources:

- `../rank-first-calibration-2026-09-02/sword-metal-ranks-v1.png` controls rank rhythm, camera,
  spacing, and presentation only. Greatswords must not copy its Sword geometry.
- `../material-vs-class-calibration-2026-09-02/approach-a-steel-material-cohort-v1.png` controls the
  accepted realistic-painterly finish, material response, and studio lighting only.

## Lifecycle

`reference → v1 revise → proportion contract → v2 revise → owner decision → item assignments → item candidates → review`

Promotion, approved masters, runtime derivatives, and content definitions are explicitly outside
this campaign boundary until separately authorized.

## Validation

From the repository root:

```bash
corepack pnpm tsx tools/validate-greatsword-campaign-v1.ts
git diff --check
```
