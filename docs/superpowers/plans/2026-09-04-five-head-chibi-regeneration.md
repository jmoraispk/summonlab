# Five-Head Combat Chibi Regeneration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regenerate one provenance-complete, five-head combat-chibi candidate for each of the 200 approved one-star heroes without a pilot, visual-review checkpoint, or runtime promotion.

**Architecture:** Freeze the approved 200-hero selection into an experiment-local roster, materialize one immutable assignment per hero, and dispatch all assignments in thirteen bounded waves. Each image worker generates from the selected summon portrait alone and owns one candidate/result pair; the coordinator owns shared manifests, call journals, validation reports, commits, and pushes.

**Tech Stack:** Python 3 standard library, Pillow, `unittest`, JSON/JSONL, Git LFS, built-in image generation.

**Spec:** `docs/superpowers/specs/2026-09-04-five-head-chibi-regeneration-design.md`

## Global Constraints

- Read `AGENTS.md`, the linked spec, and
  `docs/decisions/0070-combat-chibis-target-five-heads.md` completely before execution.
- Read and follow `superpowers:subagent-driven-development`,
  `superpowers:test-driven-development`, `imagegen`, `summonlab-image-production`, and
  `superpowers:verification-before-completion`. Use `superpowers:systematic-debugging` for unexpected
  failures.
- Fetch and rebase onto current `origin/main` before implementation. Work on
  `codex/five-head-chibi-regeneration`, or a collision-safe `codex/` successor when needed.
- The upstream authority is
  `assets/heroes/experiments/one-star-overnight-200-001/review/review-manifest.json` with SHA-256
  `8ae3ee617fb200018c261cdee7b2e3fb5a2f1d807cea77df2fe75b78464c6fe5` and exactly 200
  `selectedPairs`.
- Keep new production artifacts under
  `assets/heroes/experiments/five-head-chibi-regeneration-001/`. Do not edit the upstream experiment.
- Use each selected summon portrait as the only image-generation reference. Never provide the
  historical chibi to the image generator.
- Every prompt uses the canonical prompt from the spec and targets 5.0 anatomical heads, measured
  skull crown to chin and excluding hair volume.
- Generate exactly one `1024x1536` PNG candidate for every hero. Keep the full figure, both hands,
  all clothing, and both feet visible.
- Preserve source face, adult age, skin, body construction, body mass, limb girth, hairstyle,
  wardrobe, palette, footwear, accessories, tattoos, and markings. Do not add generic thick arms,
  large hands, broad shoulders, barrel torsos, short legs, fat, or muscle.
- No weapons, magic, affinity effects, rarity frames, stars, interface, labels, logos, watermarks, or
  text.
- There is no pilot, visual acceptance gate, owner-review pause, review webpage, ratio-scoring pass,
  automatic visual correction, or approval decision in this run. Proceed through all 200 heroes.
- Make exactly 200 primary generation calls. Only a provider response with no usable image may
  receive one versioned retry, with at most ten retries across the run. Never retry a readable image
  for visual quality.
- Use at most sixteen image workers concurrently. A worker owns only its assigned target's provider
  source, candidate, and result paths and never edits shared files.
- The root coordinator alone writes contracts, source roster, production plan, journal, reports,
  documentation, commits, and pushes.
- Resume from verified artifacts. Never overwrite or regenerate an existing valid assignment.
- Commit and push every completed wave. Explicitly stage only Heroes-domain files. Preserve and
  report unrelated dirty files.
- Keep the user informed at least every 60 seconds while work is running, without asking for routine
  visual feedback.
- Stop only for a hard safety failure, source-authority drift, provider unavailability that exhausts
  the retry budget, or a conflict requiring new authority.
- All outputs remain candidates. Do not alter engine contracts, summon tables, approved-source
  catalogs, shared runtime catalogs, or unrelated visual domains. Do not merge the branch.

## File Map

Create the following focused units under
`assets/heroes/experiments/five-head-chibi-regeneration-001/`:

- `README.md`: scope, commands, lifecycle boundary, and resume instructions.
- `decision.json`: frozen dimensions, prompt version/hash, source-manifest hash, wave sizes, call
  budget, and candidate-only status.
- `prompt-template.txt`: exact canonical generation prompt copied from the spec.
- `source-roster.json`: immutable snapshot of the 200 selected pairs and source hashes.
- `production-plan.json`: all wave/target/assignment mappings and declared paths.
- `scripts/contracts.py`: schemas, constants, hashes, path confinement, and exclusive writes.
- `scripts/materialize_plan.py`: deterministic roster verification and queue materialization.
- `scripts/persist_candidate.py`: exact provider-PNG persistence with collision protection.
- `scripts/write_result.py`: strict generation receipt creation.
- `scripts/validate_wave.py`: one-wave structural and provenance validation.
- `scripts/validate_experiment.py`: whole-run validation and deterministic completion report.
- `tests/test_contracts.py`: frozen contract tests.
- `tests/test_materialize_plan.py`: roster, order, reference, and path tests.
- `tests/test_persistence.py`: exclusive-write and byte/hash tests.
- `tests/test_validate_wave.py`: per-wave completeness and budget tests.
- `tests/test_validate_experiment.py`: whole-run invariant tests.
- `waves/wave-01..wave-13/targets/*.json`: immutable per-hero generation targets.
- `waves/wave-01..wave-13/assignments/*.json`: exclusive per-hero output ownership.
- `waves/wave-01..wave-13/provider-sources/*.png`: exact image-generator outputs.
- `waves/wave-01..wave-13/candidates/*.png`: collision-safe retained candidates.
- `waves/wave-01..wave-13/results/*.json`: strict prompt/reference/output receipts.
- `provenance/production-journal.jsonl`: one append-only record per provider call.
- `production-report.json`: resumable counts by wave and call type.
- `completion-report.json`: deterministic final validation evidence.

---

### Task 1: Build the frozen experiment contract

**Files:**

- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/README.md`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/decision.json`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/prompt-template.txt`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/contracts.py`
- Test: `assets/heroes/experiments/five-head-chibi-regeneration-001/tests/test_contracts.py`

**Interfaces:**

- Consumes: canonical prompt and constants from the linked spec.
- Produces: `load_json(path: Path) -> dict`, `sha256_file(path: Path) -> str`,
  `confine_relative(root: Path, value: str) -> Path`, `exclusive_write(path: Path, data: bytes) ->
  Literal["created", "already-identical"]`, and immutable experiment constants.

- [ ] Write failing tests asserting experiment ID `five-head-chibi-regeneration-001`, dimensions
      `1024x1536`, ratio target `5.0`, prompt version `five-head-v1`, source hash, wave sizes
      `[16,16,16,16,16,16,16,16,16,16,16,16,8]`, primary limit `200`, retry limit `10`, and
      lifecycle `candidate`.
- [ ] Run
      `python3 -m unittest assets/heroes/experiments/five-head-chibi-regeneration-001/tests/test_contracts.py`
      and verify it fails because the contract does not exist.
- [ ] Implement the constants and helper interfaces in `contracts.py`. Reject absolute paths, `..`,
      symlink escapes, occupied paths with different bytes, non-SHA-256 strings, and unsupported
      schema versions.
- [ ] Copy the canonical prompt from the spec byte-for-byte into `prompt-template.txt`. Permit only
      the six named bracket substitutions in the spec and reject any unresolved `[` or `]` after
      rendering.
- [ ] Record every frozen value plus the exact prompt SHA-256 in `decision.json`. Document that the
      run has no pilot or review workflow and produces candidates only.
- [ ] Re-run the contract test and verify it passes.
- [ ] Run `git diff --check`, stage only these files, commit
      `feat(heroes): scaffold five-head chibi regeneration`, and push the branch.

### Task 2: Freeze and materialize all 200 assignments

**Files:**

- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/materialize_plan.py`
- Test: `assets/heroes/experiments/five-head-chibi-regeneration-001/tests/test_materialize_plan.py`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/source-roster.json`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/production-plan.json`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-01..wave-13/targets/*.json`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-01..wave-13/assignments/*.json`

**Interfaces:**

- Consumes: `contracts.py`, upstream review manifest, upstream summon targets, and selected summon
  PNGs.
- Produces: `load_selected_pairs() -> list[SelectedPair]`,
  `build_source_roster(pairs: list[SelectedPair]) -> dict`,
  `build_targets(roster: dict) -> list[dict]`, `build_assignments(targets: list[dict]) -> list[dict]`,
  and CLI modes `--write` and `--check`.

- [ ] Write failing tests that reject an upstream hash mismatch, count other than 200, duplicate hero
      or target IDs, missing/mismatched summon hashes, historical chibis in `generationReferences`,
      unresolved prompt brackets, nonexclusive output paths, incorrect sort order, or incorrect wave
      sizes.
- [ ] Run the materializer tests and verify they fail before implementation.
- [ ] Implement immutable source resolution. For each selected pair, locate its source summon target
      and PNG, verify its recorded hash, copy only declared character facts, and retain the historical
      chibi path/hash as provenance metadata outside `generationReferences`.
- [ ] Sort all records by `(designOrdinal, heroId)`. Allocate the first 192 records to waves 01–12 in
      sixteen-record slices and the final eight to wave 13.
- [ ] Render and hash one exact five-head prompt per hero. Declare exactly one generation reference,
      one provider-source path, one candidate path, and one result path per assignment.
- [ ] Implement atomic `--write` and read-only `--check`. Re-running `--write` with identical content
      is idempotent; conflicting existing content fails closed.
- [ ] Run all tests and
      `python3 assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/materialize_plan.py --check`.
      Verify 200 unique heroes, 200 targets, 200 assignments, thirteen waves, and zero source drift.
- [ ] Run `git diff --check`, stage only the experiment scaffold and materialized queue, commit
      `feat(heroes): materialize five-head chibi queue`, and push.

### Task 3: Implement collision-safe persistence and validation

**Files:**

- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/persist_candidate.py`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/write_result.py`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/validate_wave.py`
- Test: `assets/heroes/experiments/five-head-chibi-regeneration-001/tests/test_persistence.py`
- Test: `assets/heroes/experiments/five-head-chibi-regeneration-001/tests/test_validate_wave.py`

**Interfaces:**

- Consumes: materialized target/assignment JSON and a returned provider PNG.
- Produces: `persist_candidate(assignment_path: Path, source_path: Path) -> PersistedCandidate`,
  `write_result(assignment_path: Path, call_record_path: Path) -> Path`, and
  `validate_wave(wave_id: str) -> WaveValidation`.

- [ ] Write failing tests for readable PNG enforcement, exact `1024x1536` dimensions, provider-source
      preservation, exclusive candidate creation, idempotent same-byte resume, conflicting-byte
      rejection, exact prompt/reference/output hashes, target/assignment binding, call-kind enum,
      one primary call per hero, one retry at most per failed hero, and global retry ceiling ten.
- [ ] Run both test modules and verify they fail.
- [ ] Implement provider-source persistence and copy identical bytes to the declared candidate path.
      Do not resize, crop, recolor, remove the background, or otherwise postprocess the candidate.
- [ ] Implement strict result receipts with schema version, target and assignment hashes, complete
      rendered prompt/hash, sole reference path/hash, provider-source path/hash, candidate path/hash,
      dimensions, MIME type, provider metadata, call ordinal, call kind, and timestamps.
- [ ] Implement `validate_wave.py --wave wave-NN`. A completed assignment requires a readable
      provider source, byte-identical candidate, strict result, matching hashes, and a corresponding
      journal call. Reject missing, undeclared, duplicated, or cross-wave paths.
- [ ] Run all experiment tests and verify an ungenerated wave reports planned work without claiming
      completion.
- [ ] Run `git diff --check`, stage only these scripts/tests, commit
      `feat(heroes): add strict chibi output persistence`, and push.

### Task 4: Generate all 200 five-head chibis

**Files:**

- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-01..wave-13/provider-sources/*.png`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-01..wave-13/candidates/*.png`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-01..wave-13/results/*.json`
- Create/append: `assets/heroes/experiments/five-head-chibi-regeneration-001/provenance/production-journal.jsonl`
- Create/update: `assets/heroes/experiments/five-head-chibi-regeneration-001/production-report.json`

**Interfaces:**

- Consumes: one target and assignment per worker plus the selected summon PNG.
- Produces: one provider-source PNG, byte-identical candidate PNG, strict result JSON, and journal
  record per successful primary call; an additional versioned journal record only for eligible
  provider no-output retries.

- [ ] Before every wave, run the experiment tests, materializer `--check`, and
      `validate_wave.py --wave wave-NN`. Derive unfinished assignments from strict filesystem
      evidence rather than memory.
- [ ] For each unfinished assignment, dispatch one image worker. The worker reads its complete target
      and assignment, inspects the sole summon reference at original resolution, submits the exact
      rendered prompt through the built-in image generator, and returns the provider artifact path
      without editing shared files.
- [ ] Dispatch no more than sixteen workers concurrently. Waves 01–12 contain sixteen assignments;
      wave 13 contains eight. Continue from wave to wave without a pilot gate, visual feedback,
      ratio measurement, prompt change, or owner checkpoint.
- [ ] Immediately journal every call. If the provider returns a usable image, persist it regardless
      of visual quality and write the strict result. Do not request a correction.
- [ ] If the provider returns no usable image, journal `provider-no-output`, allocate one versioned
      retry for that assignment, and retry once. Stop before the total number of retries exceeds ten
      or before any assignment would receive a second retry.
- [ ] After each wave, run `validate_wave.py --wave wave-NN` and all experiment tests. Update
      `production-report.json` from journal and filesystem evidence, proving cumulative target,
      primary-call, retry, provider-source, candidate, and result counts.
- [ ] Explicitly stage only the completed wave, journal, and production report. Commit
      `feat(heroes): generate five-head chibi wave NN` and push before dispatching the next wave.
- [ ] After wave 13, verify exactly 200 primary calls, 200 provider sources, 200 candidates, and 200
      strict results, with no more than ten eligible retries and no duplicate ownership or path.

### Task 5: Produce completion evidence and hand off

**Files:**

- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/validate_experiment.py`
- Test: `assets/heroes/experiments/five-head-chibi-regeneration-001/tests/test_validate_experiment.py`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/completion-report.json`
- Modify: `assets/heroes/experiments/five-head-chibi-regeneration-001/README.md`
- Modify: `docs/wiki/art/hero-identity-and-evolution.md`

**Interfaces:**

- Consumes: decision, roster, plan, targets, assignments, provider sources, candidates, results, and
  journal.
- Produces: `validate_experiment() -> ExperimentValidation`, CLI exit status, and deterministic
  `completion-report.json` with source hashes, inventory counts, call counts, and lifecycle state.

- [ ] Write failing tests for every completion invariant: frozen source hash, 200 unique records at
      every layer, wave sizes, exact prompt version/hash, one summon reference per target, readable
      `1024x1536` PNGs, byte-identical provider/candidate hashes, strict receipts, exactly 200 primary
      calls, at most ten eligible retries, unchanged upstream files, and lifecycle `candidate` with
      zero approvals and zero runtime bindings.
- [ ] Run the completion test and verify it fails before the validator exists.
- [ ] Implement `validate_experiment.py` and deterministic completion-report generation. The command
      exits nonzero on any missing artifact, stale hash, wrong dimension, undeclared path, call-budget
      violation, source drift, approval claim, or runtime binding.
- [ ] Run:

      ```bash
      python3 -m unittest discover assets/heroes/experiments/five-head-chibi-regeneration-001/tests -p 'test_*.py'
      python3 assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/materialize_plan.py --check
      python3 assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/validate_experiment.py
      pnpm exec prettier --check assets/heroes/experiments/five-head-chibi-regeneration-001 docs/decisions/0070-combat-chibis-target-five-heads.md docs/superpowers/specs/2026-09-04-five-head-chibi-regeneration-design.md docs/superpowers/plans/2026-09-04-five-head-chibi-regeneration.md docs/wiki/art/hero-identity-and-evolution.md
      pnpm validate:wiki
      git diff --check
      ```

      Every command must exit zero.
- [ ] Recompute the upstream review-manifest SHA-256 and verify it remains
      `8ae3ee617fb200018c261cdee7b2e3fb5a2f1d807cea77df2fe75b78464c6fe5`.
- [ ] Inspect `git status --short`. Stage only Heroes-domain completion files, commit
      `docs(heroes): complete five-head chibi regeneration`, and push.
- [ ] Report branch, all new commits, push destination, exact validation results, provider-call
      counts, candidate count, completion-report path, and working-tree state. Do not create a review
      site, request owner review, promote candidates, merge the branch, or modify runtime catalogs.

## Completion Definition

The plan is complete only when all of the following are true:

- Exactly 200 approved source heroes are frozen without upstream mutation.
- Exactly 200 five-head prompts reference exactly 200 corresponding summon portraits.
- Exactly 200 primary calls produced 200 readable `1024x1536` provider PNGs and byte-identical
  candidate PNGs.
- No more than ten retries occurred, and every retry followed a journaled provider no-output event.
- Exactly 200 strict result receipts validate against prompts, references, outputs, and assignments.
- All thirteen waves, experiment tests, structural validator, formatting checks, and wiki validation
  pass.
- Every in-scope artifact is committed and pushed.
- All images remain unreviewed, unapproved, unpromoted candidates, and the branch remains unmerged.
