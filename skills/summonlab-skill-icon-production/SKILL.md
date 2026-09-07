---
name: summonlab-skill-icon-production
description: Use when producing or revising one Summonlab skill's frameless icon artwork from an approved manifest-bound visual brief.
---

# Summonlab skill-icon production

Produce one frameless artwork layer for one assigned skill. The reusable backing and rarity frame
are coordinator-owned composition assets and never enter the image-generation prompt.

## Required input

Read [target-schema.md](references/target-schema.md), then validate the target and assignment before
calling imagegen:

```bash
python3 <skill-directory>/scripts/validate_target.py TARGET ASSIGNMENT WORKSPACE_ROOT
```

The target must bind the live unified catalog and geometry guide, plus a temporary on-demand family
sheet when accepted members of its non-null motif lineage exist and the immediate-parent interior
when the skill has a visual parent. Standalone skills omit the family sheet. All references are
purpose-bound and hash-bound.

## Production sequence

1. Submit `exactPrompt` byte-for-byte to the built-in imagegen tool with references in manifest
   order. Request exactly one transparent PNG.
2. If the first result has one bounded visible defect and the assignment allows a retry, make at
   most one image edit using that result. Otherwise stop after the first call.
3. Preserve the selected provider output as the exact temporary candidate. Do not resize, mask,
   crop, add backing, add a frame, or extract pixels from the family sheet.
4. Inspect the candidate full-size and at 96 pixels using
   [review-rubric.md](references/review-rubric.md).
5. Write the result described in [result-schema.md](references/result-schema.md), then run:

   ```bash
   python3 <skill-directory>/scripts/verify_result.py \
     TARGET ASSIGNMENT RESULT WORKSPACE_ROOT --attempt-count ACTUAL_CALLS
   ```

6. Return the candidate path, result path, findings, and the owner decision still required.

## Coordinator handoff

The producer stops at a frameless candidate under `.skill-icon-work/`. After the owner accepts the isolated artwork, the
coordinator composes a temporary review icon as `backing -> interior -> rarity-frame`, with the
rarity frame last, using `pnpm render:skill-icon-review -- ...`. After the owner accepts that
composite, the coordinator:

1. copies the exact accepted 1024px frameless layer byte-for-byte to
   `assets/wiki/skills/icon-production-v2/interiors/<target-slug>.png`;
2. updates the authored motif/visual state when needed and exports `catalog.json`;
3. runs `pnpm export:skill-icon-assets` and `pnpm export:wiki-skill-visual-catalog`;
4. validates the catalog, canonical assets, wiki runtime, and skill-creation skill;
5. deletes the temporary target, assignment, provider output, family sheet, candidate, result, and
   composite review files.

The seven canonical frames, backing, and geometry are reused; a new skill never receives its own
copy. The runtime applies the manifest's identity interior transform, so replacement frames can be
exported later without changing or regenerating the original art.

## Hard boundaries

- Produce only `skill-art`; frame, backing, calibration, reprocess, batch, and contact-sheet jobs
  are outside this skill.
- The exact prompt must contain the required frameless clause and must not request any frame,
  border, crest, letter, backing, UI, text, or scenery.
- A family sheet is lineage context only. Never crop, trace, or enlarge a cell.
- Never write to `assets/wiki/skills/icon-production-v2/` or `apps/web/static/`.
- Never claim owner acceptance, promote shared state, or retain review history after promotion.
- Never exceed one initial generation plus the assignment's zero-or-one retry.

See [example.md](references/example.md) for a complete packet and handoff shape that does not use a
special-case skill.
