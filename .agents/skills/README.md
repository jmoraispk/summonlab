# Repository-scoped agent skills

Codex discovers the skill directories in this folder for every task launched from this repository.

Project-authored skills keep their canonical content under `skills/` and use relative directory
symlinks here so repository discovery cannot drift from the maintained source.

The `pixijs*` directories are an unmodified project-local installation of the official
[`pixijs/pixijs-skills`](https://github.com/pixijs/pixijs-skills) collection, pinned to commit
`6aae70d76cf410432dd144029c07a1ad4bb12793` on 2026-09-02. They target PixiJS v8 and are licensed
under the adjacent `PIXIJS_SKILLS_LICENSE`.

Keep the collection pinned and update all of its directories together. The `pixijs` entry skill
routes agents to the narrower skills; a partial update can leave that routing inconsistent.

## Summonlab project skills

- `summonlab-character-action-creation` — defines and gains approval for a character action's
  five-beat motion contract before animation production when no such contract exists.
- `summonlab-character-animations` — creates or revises coherent spritesheet clips for character
  motion such as idle, run, attack, hit, and defeat sequences.
- `summonlab-enemy-creation` — designs or revises one enemy family, its T1–T5 forms, affinity
  construction, legacy reconciliation, production boundary, and wiki evidence.
- `summonlab-hero-creation` — owns candidate-only paired summon/chibi hero production and is not
  part of the upstream PixiJS collection.
- `summonlab-image-production` — produces one manifest-bound project image with bounded inspection,
  provenance, and collision-safe output ownership.
- `summonlab-item-production` — adds or expands repository items, equipment classes, material
  families, rank ladders, armor, weapons, consumables, loot, and item visuals.
- `summonlab-skill-creation` — creates or revises canonical Domain → Family → Skill branches while
  preserving mechanics and skill-icon catalog consistency.
- `summonlab-skill-icon-production` — produces one assigned manifest-bound skill-icon raster with
  exact prompting, versioned persistence, and bounded correction without promotion.
