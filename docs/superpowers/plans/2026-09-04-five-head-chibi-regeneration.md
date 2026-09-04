# Five-Head Combat Chibi Regeneration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task.

**Goal:** Produce one provenance-complete, five-head combat-chibi candidate for each of the 200 approved one-star heroes and a side-by-side owner review site without promoting any image to runtime.

**Architecture:** Freeze the upstream selected-pair manifest into an immutable experiment-local roster, materialize exclusive per-hero assignments, dispatch one reference-bound generation per assignment, persist exact provider bytes and strict receipts, then derive paginated review and completion evidence. Shared files remain coordinator-owned; image workers own only their assigned candidate and result paths.

**Tech Stack:** Python 3 standard library, Pillow, `unittest`, JSON/JSONL, HTML/CSS/JavaScript, Git LFS, built-in image generation.

**Spec:** `docs/superpowers/specs/2026-09-04-five-head-chibi-regeneration-design.md`

## Global constraints

- Work only on branch `codex/five-head-chibi-regeneration`, rebased on current `origin/main` before
  implementation begins.
- Read and follow `imagegen`, `summonlab-image-production`, and
  `superpowers:subagent-driven-development` before production work.
- Keep every new artifact under
  `assets/heroes/experiments/five-head-chibi-regeneration-001/` except the accepted Heroes wiki and
  decision documentation named by this plan.
- Do not edit the upstream 200-hero experiment, engine contracts, summon tables, shared runtime
  catalogs, or unrelated visual domains.
- Use the selected summon portrait as the only generation reference. The old chibi is review-only.
- Dispatch at most sixteen image producers concurrently. Producers never edit shared files.
- Permit exactly 200 primary calls and at most ten versioned no-output retries. Never retry a valid
  image merely because it is visually imperfect.
- Commit and push each reviewable batch. Never merge or promote without a later owner instruction.
- If an unrelated dirty file exists, leave it unstaged and report it; do not repair or include it.

---

## Task 1: Scaffold the experiment contract

**Files:**

- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/README.md`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/decision.json`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/prompt-template.txt`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/contracts.py`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/tests/test_contracts.py`

- [ ] Write failing contract tests for experiment ID, canvas `1024x1536`, target ratio `5.0`, review
      band `4.5–5.75`, source-manifest hash, prompt version, wave sizes
      `[12,16,16,16,16,16,16,16,16,16,16,16,12]`, primary-call limit `200`, retry limit `10`, and
      candidate-only lifecycle.
- [ ] Run
      `python3 -m unittest assets/heroes/experiments/five-head-chibi-regeneration-001/tests/test_contracts.py`
      and confirm it fails because the contract does not exist.
- [ ] Implement immutable dataclasses, enum values, JSON readers, SHA-256 helpers, relative-path
      confinement, and exclusive-create helpers in `contracts.py`.
- [ ] Copy the canonical generation prompt from the spec byte-for-byte into `prompt-template.txt`.
      Implement only bracket substitution; reject unresolved brackets after rendering.
- [ ] Record the locked values and prompt hash in `decision.json`; explain candidates versus
      approved/runtime state in `README.md`.
- [ ] Re-run the contract test and confirm it passes.
- [ ] Commit and push with `git commit -m "feat(heroes): scaffold five-head chibi production"`.

## Task 2: Freeze and materialize the 200-hero queue

**Files:**

- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/materialize_plan.py`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/tests/test_materialize_plan.py`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/source-roster.json`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/production-plan.json`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-01..wave-13/targets/*.json`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-01..wave-13/assignments/*.json`

- [ ] Write failing tests that reject the wrong upstream hash, duplicate hero IDs, missing source
      hashes, a non-summon generation reference, nonexclusive output paths, noncanonical pilot
      selection, incorrect wave sizes, or any queue count other than 200.
- [ ] Run the materializer test and confirm it fails before implementation.
- [ ] Implement `materialize_plan.py --write` and `--check`. Resolve each selected pair back to its
      source target and exact summon PNG, verify both hashes, copy the character-specific visual
      facts into a target, and render the shared prompt without adding the old chibi as a reference.
- [ ] Select the deterministic twelve-hero stratified pilot defined in the spec. Sort every
      remaining assignment by `designOrdinal` and form twelve later waves.
- [ ] Write `source-roster.json`, `production-plan.json`, targets, and assignments atomically. In
      `--check`, compare generated structure and hashes without rewriting files.
- [ ] Run the tests and
      `python3 assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/materialize_plan.py --check`;
      confirm 200 unique heroes, 13 waves, and zero reference drift.
- [ ] Commit and push with `git commit -m "feat(heroes): materialize five-head chibi queue"`.

## Task 3: Implement collision-safe result persistence

**Files:**

- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/persist_candidate.py`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/write_result.py`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/validate_wave.py`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/tests/test_persistence.py`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/tests/test_validate_wave.py`

- [ ] Write failing tests for exclusive candidate creation, idempotent same-byte resume, conflicting
      overwrite rejection, `1024x1536` PNG validation, exact provider-source and candidate hashes,
      result-to-assignment binding, one primary call per target, one retry at most per failed target,
      and the global retry ceiling.
- [ ] Run both new test modules and confirm they fail.
- [ ] Implement persistence from a returned provider source path to the assignment's candidate path.
      Preserve exact provider PNG bytes; do not postprocess the production candidate.
- [ ] Implement strict result receipts containing target, assignment, prompt, reference, provider
      source, candidate, dimensions, SHA-256, call kind, producer QA, and timestamps.
- [ ] Store producer-QA ratio evidence as an advisory visual estimate with optional `crownY`, `chinY`,
      and `soleY` landmarks. Compute `(soleY - crownY) / (chinY - crownY)` when landmarks exist;
      never label the estimate as an automatic anatomical measurement.
- [ ] Implement `validate_wave.py --wave wave-NN` so a completed assignment requires a candidate and
      matching strict receipt. Reject undeclared files and duplicate ownership.
- [ ] Run all experiment tests and validate an empty wave reports planned work without claiming
      completion.
- [ ] Commit and push with `git commit -m "feat(heroes): add collision-safe chibi persistence"`.

## Task 4: Generate and audit the twelve-hero pilot

**Files:**

- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-01/candidates/*.png`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-01/results/*.json`
- Append: `assets/heroes/experiments/five-head-chibi-regeneration-001/provenance/production-journal.jsonl`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/production-report.json`

- [ ] Spawn twelve image workers, one per pilot assignment. Each worker reads its target and
      assignment, inspects the summon source at original resolution, uses the exact rendered prompt,
      and makes one built-in image-generation call.
- [ ] Have each worker inspect its returned image for ratio, silhouette, anatomy, identity, body
      mass, wardrobe, crop, and prohibited content. Record `pass` or `revise` producer QA without
      making a visual-correction call.
- [ ] Persist each output exclusively and write its strict result receipt. Use a retry only for a
      provider response with no usable image and journal both calls.
- [ ] Run all experiment tests and `validate_wave.py --wave wave-01`; confirm twelve structurally
      valid candidates and no more than twelve primary plus eligible no-output retry calls.
- [ ] Inspect the full pilot as a group. If a systemic prompt failure affects at least three of the
      twelve, stop and amend the prompt contract additively before bulk dispatch. Individual visual
      misses remain review evidence and do not block the queue.
- [ ] Update `production-report.json` with actual counts and pilot observations.
- [ ] Commit and push with `git commit -m "feat(heroes): generate five-head chibi pilot"`.

## Task 5: Generate the remaining 188 candidates in bounded waves

**Files:**

- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-02..wave-13/candidates/*.png`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/waves/wave-02..wave-13/results/*.json`
- Append: `assets/heroes/experiments/five-head-chibi-regeneration-001/provenance/production-journal.jsonl`
- Update: `assets/heroes/experiments/five-head-chibi-regeneration-001/production-report.json`

- [ ] Before each wave, derive the missing queue from strict filesystem evidence. Never regenerate a
      valid completed assignment after resume.
- [ ] For waves 02–12 dispatch at most sixteen exclusive image workers. For wave 13 dispatch twelve.
      Every worker follows the same one-reference, one-primary-call, inspect, persist, and receipt
      protocol as the pilot.
- [ ] If a provider produces no usable image, record the failure and allocate at most one versioned
      retry. Stop dispatch before the cumulative retry count would exceed ten.
- [ ] After each wave, run all experiment tests and `validate_wave.py --wave wave-NN`, update the
      production report, inspect a wave contact sheet, then explicitly stage only that wave and its
      report/journal records.
- [ ] Commit and push every wave using
      `feat(heroes): generate five-head chibi wave NN`.
- [ ] After wave 13, confirm strict evidence reports exactly 200 primary calls, at most ten no-output
      retries, 200 candidates, 200 results, and no duplicate target or output path.

## Task 6: Build the three-way review site

**Files:**

- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/build_review.py`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/tests/test_build_review.py`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/review/review-manifest.json`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/review/index.html`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/review/pages/01.html..10.html`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/review/previews/**/*.{webp,png}`

- [ ] Write failing tests for exactly 200 review records, twenty records per page, correct source and
      candidate hashes, three-image ordering, allowed decisions, local persistence, JSON export,
      producer-QA filtering, and absence of hero-rejection controls.
- [ ] Run the review test and confirm it fails.
- [ ] Implement review derivatives without changing source bytes. Build a responsive three-column
      summon / historical chibi / five-head candidate comparison with `accept-five-head`,
      `revise-five-head`, and `hold`, optional notes, progress, filters, and exported decisions.
- [ ] Rebuild twice and prove deterministic manifests and HTML. Run all experiment tests.
- [ ] Serve from the repository root with
      `python3 -m http.server 4177 --bind 0.0.0.0` and verify the listening address with `ss -ltnp`.
- [ ] Publish the exact collaborator URL
      `http://10.110.24.218:4177/assets/heroes/experiments/five-head-chibi-regeneration-001/review/index.html`.
- [ ] Commit and push with `git commit -m "feat(heroes): add five-head chibi review gallery"`.

## Task 7: Validate, document, and hand off candidates

**Files:**

- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/validate_experiment.py`
- Create: `assets/heroes/experiments/five-head-chibi-regeneration-001/tests/test_validate_experiment.py`
- Generate: `assets/heroes/experiments/five-head-chibi-regeneration-001/completion-report.json`
- Update: `assets/heroes/experiments/five-head-chibi-regeneration-001/README.md`
- Update: `docs/wiki/art/hero-identity-and-evolution.md`

- [ ] Write failing completion tests for every invariant in the spec, including counts, dimensions,
      hashes, source immutability, reference exclusivity, prompt version, call budget, page counts,
      candidate-only state, and forbidden runtime/catalog changes.
- [ ] Implement `validate_experiment.py` and a deterministic completion-report writer. The report
      must distinguish pixel-complete, producer-QA, owner-review, approved-source, and runtime states.
- [ ] Run
      `python3 -m unittest discover assets/heroes/experiments/five-head-chibi-regeneration-001/tests -p 'test_*.py'`,
      `python3 assets/heroes/experiments/five-head-chibi-regeneration-001/scripts/validate_experiment.py`,
      `pnpm exec prettier --check docs/decisions/0070-combat-chibis-target-five-heads.md docs/superpowers/specs/2026-09-04-five-head-chibi-regeneration-design.md docs/superpowers/plans/2026-09-04-five-head-chibi-regeneration.md docs/wiki/art/hero-identity-and-evolution.md`,
      and `pnpm validate:wiki`.
- [ ] Verify the upstream source-manifest and completion-report SHA-256 values remain unchanged.
- [ ] Inspect `git diff --check`, `git status --short`, and the final review site. Stage only Heroes
      domain files.
- [ ] Commit and push with `git commit -m "docs(heroes): complete five-head chibi candidate run"`.
- [ ] Report branch, every batch commit, push destination, validations, call counts, candidate and
      QA counts, review URL, and working-tree state. Ask the owner to review the new candidates;
      do not merge or promote them.

## Execution handoff

Use the saved goal-harness prompt at:

`docs/agent-prompts/heroes/five-head-chibi-regeneration-goal.md`
