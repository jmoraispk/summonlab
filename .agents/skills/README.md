# Repository-scoped agent skills

Codex discovers the skill directories in this folder for every task launched from this repository.

The `pixijs*` directories are an unmodified project-local installation of the official
[`pixijs/pixijs-skills`](https://github.com/pixijs/pixijs-skills) collection, pinned to commit
`6aae70d76cf410432dd144029c07a1ad4bb12793` on 2026-09-02. They target PixiJS v8 and are licensed
under the adjacent `PIXIJS_SKILLS_LICENSE`.

Keep the collection pinned and update all of its directories together. The `pixijs` entry skill
routes agents to the narrower skills; a partial update can leave that routing inconsistent.

## Summonlab project skills

- `summonlab-enemy-creation` — designs or revises one enemy family, its T1–T5 forms, affinity
  construction, legacy reconciliation, production boundary, and wiki evidence.
