# Forge component review

This checkpoint isolates summon comprehension, realistic character presentation, enemy visual
language, and the first twenty floors of progression. Start the app with `pnpm dev:app`, then open
`http://localhost:5173/forge` and `http://localhost:5173/forge/enemies`.

## Hero review cohort

The four new identity anchors were generated with built-in image generation using Mara Vey, Remy
Nahl, and Jori Daro only as finish/style references. The prompt template was:

> Original full-body identity anchor for **[manifest-bound name]**, a newly summoned adult hero.
> Preserve the exact age, presentation, height, build, skin, face, nose, eyes, hair, posture,
> signature traits, practical charcoal clothing, and restrained accent from the deterministic
> manifest. Premium photorealistic painterly dark-fantasy key art matching the references' realism,
> polish, framing, and material quality. One person, full body head to toe, neutral three-quarter
> stance, hands visible, midnight-navy background, natural skin and worn-material texture, cold gate
> light and restrained warm resonance rim. No weapon, text, UI, logo, watermark, resemblance,
> sexualization, extra people, or identity changes.

The exact bound subjects are Kavi Nor (`2★`), Kavi Garo (`3★`), Lio Senn (`3★`), and Noa Kest
(`3★`). Source generations remain in the Codex generation cache; review-sized WebP derivatives live
under `assets/heroes/visuals/forge-v1/`.

## Enemy review plates

All four plates used this shared prompt frame:

> Four classic **[family]** enemies for a dark fantasy tower RPG on a neutral charcoal studio void
> with faint stone floor and cool haze. Exactly four distinct adult non-human subjects, each isolated
> in an equal-width presentation zone, full body visible, readable neutral combat-ready pose, clear
> scale progression. Photorealistic cinematic character or wildlife photography with grounded
> anatomy, practical worn materials, natural asymmetry, tactile texture, cold tower fill, and narrow
> warm rim light. No text, labels, frames, logos, watermark, extra creatures, duplicated faces,
> cartoon proportions, glossy armor, or gore.

Family-specific subjects:

- Goblinoids: goblin skirmisher, goblin archer, goblin hexweaver, goblin chieftain.
- Beasts: grey wolf, dire wolf, cave bear, tunnel boar.
- Constructs: clay golem, stone golem, iron sentinel, crystal guardian with restrained amber core.
- Large threats: cave troll, ogoblin brute, hill giant with stone maul, frost giant in fur and iron.

The WebP review plates live under `assets/enemies/review/`. They are not individual runtime assets.

## Focused playtest

1. On `/forge`, summon once with each channel and compare whether its minimum star rank is obvious
   before and after the reveal.
2. Select several heroes and decide whether the dossier explains rarity, personality, and aptitude
   without turning the person into a spreadsheet.
3. On `/forge/enemies`, compare the four plates, then scan Floors 1–20 and identify any enemy family,
   floor jump, or skill test that feels repetitive, misplaced, or visually wrong.
