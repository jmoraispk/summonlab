# Task 3 report — agentic skill workflow

## Scope

Updated only the Task 3 producer/coordinator instructions, their focused static contract test, and
the package validation entrypoint. Accepted inner-frame overlay artifacts were not read, changed, or
recomposed.

## Baseline evidence

Step 1 baseline evidence is recorded in
`.superpowers/sdd/2026-09-06-skill-icon-inner-frame-acceptance/progress.md` under **Task 3 baseline
evaluations**. It established that the old instructions omitted the exact deterministic assembly and
that `repository-workflow.md` still instructed individual generation to use an approved frame and
retain frame ornaments. Per the task brief, no additional baseline agents were dispatched.

## Static RED → GREEN evidence

- RED: Created `tools/summonlab-skill-creation-skill.spec.ts` before the instruction edits. The
  focused test failed because documentation lacked `artworkScale: 0.9`; the stale framed-individual
  workflow was still present.
- GREEN: The same test now requires the frameless artwork layer, `0.9`, `922x922`, `(51,51)`,
  `frame-opening-v3`, final-frame order, aperture coverage, protected-band checks, and absence of
  the old ornament-retention instruction. It passed after the smallest coherent skill edits.

The prescribed `corepack pnpm` command could not run because `corepack` and `pnpm` are absent from
the shell PATH and the system Node is v18.19.1. The focused Vitest command was run directly with the
workspace-installed Vitest under the available Node v22.22.0 runtime; package-script execution is
engine-gated for Node 24.

## Files changed

- `skills/summonlab-skill-icon-production/SKILL.md`
- `skills/summonlab-skill-icon-production/references/review-rubric.md`
- `skills/summonlab-skill-creation/SKILL.md`
- `skills/summonlab-skill-creation/references/repository-workflow.md`
- `tools/summonlab-skill-creation-skill.spec.ts`
- `package.json`

## Verification

- Focused static contract test: passed (1 test).
- `validate:skill-icon-creation-skill` package entrypoint: passed via the cached pnpm runtime
  (with the expected Node 22 versus Node 24 engine warning).
- Producer Python verification suite: passed.
- `tools/tsconfig.skill-icon-production.json` typecheck: passed.
- Prettier check for the modified task files: passed.
- `git diff --check`: passed.

## Self-review

- Producer remains generation-only: it returns a frameless provider layer and is explicitly barred
  from resizing, masking, backing, framing, compositing, or promotion.
- Coordinator receives content, geometry, family, and immediate-parent authorities; a complete
  framed family sheet remains reference-only and cannot authorize individual frame generation or
  cropping.
- Coordinator assembly is bound to scale `0.9`, `922x922`, `(51,51)`, complete aperture coverage,
  aperture extraction, canonical backing, and final canonical frame with
  `compositionProfile: 'frame-opening-v3'`.
- The fail-closed gates cover incomplete aperture coverage, baked frame traces, exterior opacity,
  backing-only components, layer-hash mismatch, non-exact recomposition, protected-band mismatch,
  and final-frame ordering.

## Concerns

No code or instruction conflict remains in the reviewed scope. A fresh isolated forward agent
evaluation was not run because the task explicitly prohibits dispatching additional agents; the
recorded baseline, focused contract test, and instruction-level self-review provide the available
evidence for this task.

## Fix round 1 — role-separated handoff contract

Addressed the Task 3 review findings without touching the deferred Minor or any accepted overlay
artifact.

- The producer skill now requires its output handoff to recite the coordinator-owned `0.9` scale,
  `922x922` size, `(51,51)` offset, aperture extraction and coverage, canonical backing,
  `frame-opening-v3`, final-frame order, and every fail-closed composition gate. It explicitly says
  this is a report-only handoff and grants no resize, masking, backing, framing, compositing, or
  promotion authority to the producer.
- The static contract test is split by role and file. Producer assertions read only its `SKILL.md`
  plus its rubric boundary; coordinator assertions read only the creation skill and repository
  workflow. The creation workflow is also checked for positive no-frame generation constraints and
  for forbidden imperatives that supply a frame for generation, retain/bake ornaments, or generate a
  complete framed individual tile.

### Fix-round RED → GREEN evidence

- RED, Node `v24.14.1`: after writing the role-separated assertions, the focused test failed with
  `expected ... to contain 'artworkScale: 0.9'` in the producer-specific handoff test. The final RED
  run had 1 failed and 2 passed tests, confirming the missing producer handoff rather than a test
  setup error.
- GREEN, Node `v24.14.1`: `corepack pnpm vitest run
  tools/summonlab-skill-creation-skill.spec.ts` passed with 3 tests.
- `python3 -m unittest skills/summonlab-skill-icon-production/scripts/test_verify_result.py` passed;
  `corepack pnpm typecheck:skill-icons`, focused Prettier check, and `git diff --check` also passed
  under Node `v24.14.1`.

## Fix round 2 — literal assembly predicates and local safeguards

Addressed both remaining Task 3 findings without changing the deferred Minor or accepted overlay
artifacts.

- The producer's report-only handoff now states the exact back-to-front order
  `backing → skill-art → rarity-frame`, `rarityFrameIsFinal === true`, and every required literal
  gate predicate or outcome. It explicitly assigns those constraints to the coordinator and denies
  producer execution authority for all assembly operations.
- The coordinator's individual-production block carries the same explicit order and predicates.
  The static test extracts that numbered block and the producer handoff section before asserting
  their role-local requirements. The extracted coordinator block must exactly equal its canonical
  frameless template; five mutations—Attach, Include, Add, Pass, and Use a canonical frame in an
  individual prompt/generation/reference—therefore each fail the structural safeguard.

### Fix-round 2 RED → GREEN evidence

- RED, Node `v24.14.1`: after writing the block-local assertions, the focused suite failed with the
  producer handoff missing `frameless artwork layer` and the coordinator block missing
  `backing → skill-art → rarity-frame` (2 failed, 1 passed).
- GREEN, Node `v24.14.1`: `corepack pnpm vitest run
  tools/summonlab-skill-creation-skill.spec.ts` passed with 3 tests after the literal order and
  predicate edits.
- `python3 -m unittest skills/summonlab-skill-icon-production/scripts/test_verify_result.py` passed
  under the Node `v24.14.1` shell; the focused typecheck, Prettier check, and `git diff --check` are
  recorded with this fix round's final verification.

## Fix round 3 — full coordinator-document negative guard

Addressed the remaining Task 3 finding without changing the deferred Minor or accepted overlay
artifacts.

- The static contract now scans the complete `summonlab-skill-creation` skill and its repository
  workflow, in addition to retaining the exact numbered-block equality check. It groups Markdown
  into directives and rejects a positive frame/crest/rank/border/rail/ornament directive when it
  also carries producer, individual, prompt, imagegen, generation, or reference context, unless the
  directive itself states explicit negative or reference-only semantics.
- The test appends every requested positive imperative outside the canonical block to each document:
  Attach, Include, Add, Use, Supply, Provide, Give, Embed, Render, Compose, Apply, Put, and Place.
  Every mutation is detected. The existing common-mistake sentence was made explicitly negative so
  the guard does not depend on an enclosing heading to infer its meaning.

### Fix-round 3 RED → GREEN evidence

- RED, Node `v24.14.1`: the new scanner initially failed because the legacy common-mistake wording
  said `Giving a framed family sheet ... to individual image generation` without an explicit
  negative predicate. The focused suite reported that directive as an unapproved instruction.
- GREEN, Node `v24.14.1`: after changing the instruction to `Do not give ...`, `corepack pnpm
  vitest run tools/summonlab-skill-creation-skill.spec.ts` passed with 4 tests, including all
  outside-block mutations in both documents.
- The producer Python suite, skill-icon typecheck, Prettier check, and `git diff --check` are
  recorded with this fix round's final verification.

## Fix round 4 — action-scoped negative and reference-only allowances

Addressed the remaining Important finding in the Task 3 static contract without changing skill
prose or accepted assets.

- Added deceptive-clause regressions for every guarded positive action: Attach, Include, Add, Use,
  Supply, Provide, Give, Embed, Render, Compose, Apply, Put, Place, and Generate. Each remains
  forbidden when the directive adds either an unrelated `do not change its color` clause or an
  unrelated `keep the family sheet reference-only` clause.
- Added preservation cases for directly negated actions (`Do not use ...`, `Never attach ...`) and
  a framed family sheet used explicitly `as a reference-only presentation`.
- Replaced the whole-directive blanket exemption with action-local checks. Directive clauses are
  inspected independently; only a negator governing the matched action, a directly omitted frame
  object, or the matched framed content's explicit reference-only use can allow it.

### Fix-round 4 RED → GREEN evidence

- RED, Node `v24.14.1`: after adding the deceptive-clause and preservation regressions first,
  `corepack pnpm vitest run tools/summonlab-skill-creation-skill.spec.ts` failed with 1 failed and 5
  passed tests. The first deceptive directive, `Attach a canonical frame in the individual prompt,
  but do not change its color.`, incorrectly produced `[]` instead of the expected violation.
- GREEN, Node `v24.14.1`: after scoping the exemptions to the action clause,
  `corepack pnpm vitest run tools/summonlab-skill-creation-skill.spec.ts` passed all 6 tests.

### Fix-round 4 files and verification

- Changed `tools/summonlab-skill-creation-skill.spec.ts` and this report only.
- The focused static suite passed 6 tests, `corepack pnpm typecheck:skill-icons` passed, the focused
  Prettier check passed, and `git diff --check` passed under Node `v24.14.1`.
- The Python producer suite was not run because no skill prose changed, matching this fix round's
  conditional verification requirement.

### Fix-round 4 self-review and concerns

- The scan still covers both complete coordinator-facing documents and returns the original full
  directive in violations; only its allowance decision is clause- and action-scoped.
- Direct negation and genuine reference-only family-sheet presentation remain valid, while an
  unrelated negative or reference-only clause cannot license a positive framed-individual action.
- No skill instruction, producer behavior, composition rule, or accepted raster was changed. No
  concerns remain in the requested scope.

## Fix round 5 — exact action-bound exemptions

Addressed the final Important finding in the Task 3 static contract without changing skill prose or
accepted assets.

- Removed the broad rejected-action, negated-frame-object, and reference-only suffix exemptions.
  Every matched guarded action is now allowed only when an immediate negator governs that exact
  action.
- Preserved the one legitimate unnegated use through an exact canonical allowlist sentence:
  `Use a complete framed family sheet as a reference-only presentation for individual lineage
  review.`
- Added coverage for all guarded action forms, including `Generate` and `Giving`, and direct-negation
  pass cases for every guarded form.

### Fix-round 5 RED → GREEN evidence

- RED, Node `v24.14.1`: after adding the three concrete regressions first,
  `npx --yes -p node@24.14.1 -p pnpm@10.33.0 pnpm exec vitest run
  tools/summonlab-skill-creation-skill.spec.ts` failed with 3 failed and 6 passed tests. All three
  false negatives returned `[]`: the later `without ornaments` object, the unpunctuated later framed
  family-sheet reference presentation, and the unpunctuated earlier rejected color change.
- GREEN, Node `v24.14.1`: the same focused command passed all 9 tests after the semantic exemptions
  were removed and the exact canonical family-sheet sentence was allowlisted.

### Fix-round 5 files and verification

- Changed `tools/summonlab-skill-creation-skill.spec.ts` and this report only.
- `pnpm typecheck:skill-icons` passed, the focused Prettier check passed, and `git diff --check`
  passed under Node `v24.14.1`.
- The Python producer suite was not run because no skill prose changed, matching this fix round's
  conditional verification requirement.

### Fix-round 5 self-review and concerns

- The guard now evaluates direct negation at each action match; unrelated earlier or later language
  cannot exempt an unnegated framed-individual action.
- Positive and directly negated cases cover Attach, Include, Add, Use, Supply, Provide, Give,
  Giving, Embed, Render, Compose, Apply, Put, Place, and Generate.
- The reference-only exception is deliberately exact. Any future canonical rewording must update the
  allowlist and its test explicitly rather than weakening action scope. No other concern remains in
  the requested scope.
