# Two-handed Greatsword v1

Status: **seven dedicated candidates recorded; owner review pending**.

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
ratio fell below the approved minimum. A museum-grounded proportion contract then authorized a
fresh v2 board and one bounded correction. The owner accepted v2 with a named, measured guard-span
exception, and that exact direction hash now anchors seven dedicated standalone renders. Board
cells were not cropped into item candidates.

All seven candidates pass the accepted profile at native resolution: blade-to-hilt 2.58–2.72,
blade-to-grip 3.27–3.68, blade share 72.07–73.13%, guard share 19.16–22.94%, and pommel share
4.41–5.60%. The source renders were uniformly packaged at 90% scale on their own extended studio
backgrounds so every candidate also clears the 5% safe-margin requirement. No pixel call is
currently dispatchable.

## Proportion review

The contract defines landmarks before measuring: blade runs from functional guard plane to tip;
full hilt runs from guard plane to pommel end; exposed grip excludes guard and pommel; guard width
uses the functional quillon tips. Dedicated reviews in `reviews/proportions/items/` bind each exact
candidate hash to the accepted profile, pixel measurements, derived ratios, framing, and pass/fail
criteria.

Open `reviews/items/index.html` for the dedicated-candidate comparison and native-detail links.
Promotion remains blocked until the owner accepts the exact seven candidate paths and hashes.

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
