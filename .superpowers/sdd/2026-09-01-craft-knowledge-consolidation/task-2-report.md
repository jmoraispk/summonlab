# Task 2 report — canonical gathering and knowledge sources

## Result

- Primary implementation commit: `ecce0e54eff1d801fe59f68c74415c1eff20c372` (`docs(skills): establish gathering and knowledge families`)
- The canonical catalog now reconciles to 493 target rows: 258 Martial, 160 Magical, and 75 Craft.

## RED evidence

Before the canonical source edits, the new source-level test failed because Craft still declared the
retired `Beast` and `Lore` families. The focused suite reported:

```text
expected [ 'Alchemy', 'Beast', 'Cooking', … ]
to deeply equal [ 'Alchemy', 'Cooking', …, 'Knowledge' ]
```

The new structural-retirement assertion also failed before its validator implementation, returning
no diagnostics for `Family: **Beast**`, Craft tables listing `Lore`, and `Lore` fixture aptitudes.

## Files and decisions

- Rebuilt `craft-and-life.md` around Gathering and Knowledge; moved the approved rows, merged Calm
  and Feed into Animal Handling, added Beast Speech to Knowledge, and applied every ledger
  prerequisite/effect replacement.
- Added Riding, Pack Bond, Mounted Combat, and Bonded Mount to Martial/Body. Pack Bond now states
  the approved active multi-companion combat command effect.
- Updated index, framework, progression, equipment, roadmap, milestone, and Living Village fixture
  references to the five-family Craft model.
- Added source-validation coverage and validator diagnostics for structural `Beast`/`Lore` family
  declarations in authored documentation and Craft aptitudes.
- Confirmed the Task 1 concrete replacements are semantically consistent: Research Expert for
  Philosopher's Work, Literacy Expert for Runic Foundation, and Cartography Novice for Prospecting.
  No Task 1 mapping changed.

## Verification

- `pnpm exec vitest run tools/skill-taxonomy-lib.spec.ts` — 31 passing tests.
- `pnpm validate:skill-taxonomy` — 520 legacy rows mapped; 493 target rows reconciled.
- `pnpm validate:wiki` — 99 wiki pages and 22 asset references validated.
- `pnpm exec prettier --check $(git diff --name-only -- '*.md' '*.ts')` and `git diff --check` passed
  before the primary commit.

## Self-review

The immutable legacy inventory and generated Task 1 ledger remain untouched. Remaining `Beast` and
`Lore` search hits are historical ledger/inventory fields or ordinary creature/skill names such as
Beast Scale, Beast Whistle, Bind the Beast, and Beast Speech; none declares an active Craft family.
