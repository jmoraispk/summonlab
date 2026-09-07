# 0068 — Skill rarity frames use the Option C material ladder

**Status:** Accepted

**Date:** 2026-09-01

## Context

The skill catalog already defines seven fixed rarity bands, but it did not define a canonical
visual grammar for the hexagonal skill frame. Several comparison passes exposed two collisions:
F and D both read as warm bronze, while E and C both read as silver. The owner selected the third
revised comparison, referred to as Option C, after reviewing three material-ladder variants.

## Decision

- Option C is the canonical skill rarity-frame comparison authority.
- The material order is F weathered iron, E aged bronze, D tempered blue steel, C moonlit silver,
  B blackened metal with amethyst, A champagne electrum, and S ceremonial antique gold.
- Ornament remains restrained through C. B relies on faceted amethyst rather than added filigree;
  A uses a doubled rim and spear-leaf accents; S retains the strongest ceremonial silhouette and
  should be touched least.
- The hexagonal silhouette and integrated F–S medallion remain constant rank identifiers.
- The first text row is the skill name. The second is bearer-specific mastery and level in the form
  `MASTERY · LV N`.
- Rarity is fixed on the skill definition. Mastery and level are separate hero-skill state and must
  never be inferred from the frame.
- `assets/wiki/skills/icon-production-v2/frames/` is the canonical visual-source root. It contains
  one approved transparent frame layer per rank, bound by the canonical asset manifest.

## Consequences

The wiki and future visual-production work share one explicit material and ornament ladder.
D may remain more chromatic than C, but C must read brighter and more precisely finished; future
polish should mute D before making C or A brighter. Replacing a canonical frame and regenerating
the runtime updates every skill without changing its retained frameless interior.
