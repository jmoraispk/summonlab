# One-pass v2 visual feedback

Review target: `candidates/hero-rarity-progression-integrated-stars-v2.png`

## What worked

- One generation produced a coherent seven-card family rather than seven unrelated compositions.
- The visible star counts are correct from 1 through 7.
- Stars read as seated in the lower metal trays instead of post-composited sprites.
- The warm-white hero openings remain readable against the dark navy review backdrop.
- The 1★–3★ silhouettes remain non-dragon frames, and the later ranks gain dragon anatomy.
- Rank 7 has the strongest sapphire energy and ornament mass.

## What should change in the next prompt

1. Rank 4 drifts into dominant silver, repeating the material discontinuity the owner rejected. The
   next prompt keeps rank 4 in antique warm gold, charcoal, navy enamel, and sapphire; pale metal is
   restricted to specular highlights.
2. Ranks 5 and 6 remain too close. The next prompt makes 5 lean guardian dragons with small folded
   wings and minimal energy, while 6 gains broader elder bodies, a heavier crown, large folded wings,
   denser scales, and stronger—but still contained—blue energy.
3. Rank 7 does not clearly show open roaring mouths at comparison size. The next prompt requires a
   visible jaw gap, teeth, dark mouth cavity, and blue breath light for both dragons.
4. Outer widths, opening widths, and lower baselines vary slightly. The next prompt repeats the
   equal bounding-box, equal tray-height, aligned-baseline constraints.
5. The combined 2172×724 sheet is suitable for direction review, not individual runtime extraction.
   The recovered 1024×1536 originals remain higher-resolution style references only.

## Prompt revision strategy

The v3 prompt changes only the failed visual constraints. It preserves the accepted family, correct
star counts, integrated tray rendering, warm-white openings, and one-pass seven-column composition.
