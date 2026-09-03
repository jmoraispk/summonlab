# One-star overnight 200-pair execution plan

Execution plan ID: `heroes.one-star-overnight-200-execution-v1`

Status: **active production; roster frozen, calibration passed, wave 01 active**

Creative authority:
[`one-star-overnight-200-plan.md`](one-star-overnight-200-plan.md)

## Harness-ready goal objective

> Produce and deliver 200 completely new, candidate-only Summonlab 1★ hero pairs according to
> `assets/heroes/planning/one-star-overnight-200-plan.md`. Use subagent-driven, manifest-bound
> production with exactly 100 men and 100 women, the approved body/hair/wardrobe/personality quotas,
> one full-resolution semi-realistic painted summon portrait per hero, and one body-faithful chibi
> derived from that exact summon. Exclude every identity reviewed in mass waves 001 and 002. Preserve
> exact prompts, references, hashes, inspection evidence, and collision-safe ownership. Publish only
> complete pairs to a paginated, lazy-loaded, pair-first review page served on `0.0.0.0` with a
> `10.110.24.218` collaborator URL. Validate, commit, and push each 20-pair wave. Continue until 200
> complete pairs and the final report/page are delivered, unless repeated external provider capacity
> failure creates a genuine harness-level blocker. Do not modify engine contracts, summon tables,
> shared runtime catalogs, affinities, unrelated visual domains, or promote any candidate to runtime.

Do not set a small goal token budget. The work includes 400 base image calls, bounded correction,
inspection, persistence, ten validation checkpoints, and final review assembly.

## Why this is subagent-driven

The work graph has 400 source-dependent but mostly independent image jobs:

```text
200 frozen hero manifests
        |
        +--> 200 summon jobs
                 |
                 +--> 200 chibi jobs, each bound to its exact summon hash
                              |
                              +--> normalized previews + pair review
```

One serial producer would leave too much work vulnerable to interruption. Subagents allow parallel
generation while the root coordinator retains all shared-state ownership. A producer handles exactly
one image assignment per turn; it never owns a whole wave or edits aggregates.

## Agent topology

- **Root coordinator:** owns the branch, roster plan, shared reports, wave journals, review page,
  validation, commits, pushes, and final handoff.
- **Twelve image producers:** each receives one immutable target and one matching assignment, writes
  only its unique candidate and result paths, performs bounded inspection, and reports status.
- **Two rotating inspectors:** compare completed summon/chibi pairs for style, anatomy, duplication,
  and manifest drift without rewriting producer outputs.
- **Spare capacity:** retained for a targeted correction, provider-failure reassignment, or validator
  work rather than saturating every available agent slot.

The coordinator may reuse an idle producer for the next one-image assignment. It does not give two
live agents the same hero ID or output path.

## Repository and branch setup

1. Fetch and rebase on current `origin/main`.
2. Confirm the worktree is clean.
3. Create and push `codex/heroes-one-star-200` from the approved Heroes planning branch.
4. Create only the new experiment root:
   `assets/heroes/experiments/one-star-overnight-200-001/`.
5. Do not alter the current frames, reviewed wave assets, runtime visual catalog, engine, or other
   visual domains.

## Phase 0 — build the production envelope

Before calling image generation, implement the experiment-local orchestration surface beneath the
new Heroes experiment root:

- `schemas/hero-one-star-image-target-v1.schema.json`;
- `schemas/hero-one-star-image-assignment-v1.schema.json`;
- `schemas/hero-one-star-image-result-v1.schema.json`;
- `scripts/build_roster_plan.py`;
- `scripts/validate_preflight.py`;
- `scripts/persist_candidate.py`;
- `scripts/write_result.py`;
- `scripts/validate_wave.py`;
- `scripts/build_review.py`;
- unit tests for quota arithmetic, canonical hashing, path ownership, collisions, symlink rejection,
  exclusive creation, result validation, and resume behavior.

The existing affinity production machine validators are enemy-root-specific and must not be
misrepresented as authorizing Heroes work. The Heroes-local envelope follows the same safety model:
immutable target, hash-bound assignment, one image per job, `retryCeiling` of zero or one,
exclusive-create candidate/result outputs, and no producer access to shared files.

### Target contract

Each immutable image target contains:

- experiment, wave, hero, asset, and candidate-version IDs;
- image kind: `summon` or `combat-chibi`;
- full physical manifest and compact character kernel;
- native/current star state fixed at 1★;
- exact style and identity references with hashes and purposes;
- canonical rendered prompt and prompt hash;
- objective acceptance criteria;
- required canvas, composition, and negative constraints;
- unique candidate and result paths;
- for chibis, the exact accepted summon candidate path and SHA-256.

### Assignment contract

Each assignment binds:

- target ID and canonical target hash;
- one producer ID;
- the exact two permitted output paths;
- forbidden aggregate, review, wiki, catalog, and repository-history paths;
- `retryCeiling: 0 | 1`;
- one-image completion and candidate-only rules.

### Result contract

Each result records:

- target, assignment, prompt, reference, and candidate hashes;
- actual source output path returned by image generation;
- timestamps and attempt count;
- dimensions, media type, byte count, and retained output hash;
- criterion-bound inspection outcomes;
- `candidate`, `revise`, or `failed` status;
- provider-failure classification when applicable;
- attestations that shared files were untouched and no promotion occurred.

## Phase 1 — materialize and freeze the roster

1. Generate 200 active and 20 reserve design manifests from a fixed planning seed.
2. Enforce every approved quota before generation:
   - 100 men and 100 women;
   - per gender: 3 extreme bodybuilders, 17 clearly muscular, 20 conditioned, 10 ordinary/average,
     15 sturdy, 15 soft, 10 plus-size, and 10 healthy slight/lanky;
   - approved height, age, skin, hair-color, hair-silhouette, wardrobe, palette, accessory, tattoo,
     coolness-anchor, and character-kernel totals;
   - at least 100 deliberate haircut accents;
   - no reviewed identity or duplicate name/signature combination.
3. Materialize character kernels independently from physiology and phenotype.
4. Render and freeze all 200 summon prompts.
5. Create summon assignments with absent, unique outputs.
6. Run preflight and commit/push the roster-plan checkpoint before the first paid generation call.

## Phase 2 — eight-pair calibration

Choose four men and four women spanning slight, soft, average, plus-size, conditioned, clearly
muscular, and extreme-bodybuilder construction, with both natural and dyed hair.

1. Dispatch eight summon jobs.
2. Collect and verify all candidate/result pairs.
3. Create eight chibi targets bound to the exact summon hashes.
4. Dispatch eight chibi jobs.
5. Inspect the eight finished pairs for:
   - painted rather than photographic rendering;
   - distinct people, clothes, hair, and character kernels;
   - standard 2.75–3.1-head chibi treatment;
   - body, arm, hand, hair, wardrobe, and age continuity;
   - restrained expression with strong personality expressed elsewhere;
   - no weapon, affinity cue, magic, frame, star, UI, or text.
6. Correct at most one defect per failed image. If a prompt-family problem is systemic, revise only
   the still-unsubmitted target versions and preserve all attempt evidence.
7. Commit and push the calibration checkpoint.

Calibration is an authoring gate, not human approval. Passing images remain candidates.

Calibration closed with eight effective candidate pairs. Two original slots exhausted their single
correction and remain quarantined: Fenel Esho for an incorrect ring count and Yasu Coro for a chibi
ratio outside the locked range. An exact search proved that substituting untouched frozen reserve
packets would require replacing at least fifteen otherwise-valid active packets. The coordinator
therefore used two append-only quota-slot activations: Wenyn Amarun inherited Fenel's complete quota
coordinate vector, and Rao Esheth inherited Yasu's. The reserve identities and kernels remain their
own, the failed candidates remain immutable evidence, and the effective 200-hero roster retains the
frozen quota summary byte-for-byte. This documented fallback is the precedent for any later reserve
activation that cannot preserve quotas through a small untouched-packet swap.

## Phase 3 — ten production waves

Produce ten waves of 20 complete pairs. The eight calibration pairs count inside wave 01.

For each wave:

1. **Claim:** coordinator selects the next planned hero IDs whose outputs are absent.
2. **Summon dispatch:** keep up to 12 one-image summon jobs active.
3. **Collect:** verify target/assignment/result bindings and exact candidate hashes.
4. **Chibi materialization:** coordinator creates chibi targets only for valid summons, binding each
   exact summon hash as the sole identity/anatomy reference.
5. **Chibi dispatch:** keep up to 12 one-image chibi jobs active.
6. **Pair inspection:** inspectors score body continuity, hair translation, distinctness, rendering
   register, completeness, and 1★ constraints.
7. **Bounded correction:** coordinator may issue one source-bound correction assignment when exactly
   one correctable defect blocks candidacy.
8. **Quarantine/reserve:** after the retry ceiling, quarantine the failed target and activate the next
   unused reserve manifest while preserving quota totals.
9. **Review derivatives:** create fixed-canvas compressed WebP previews without altering original
   candidate bytes.
10. **Wave validation:** verify 20 complete pairs, hashes, provenance, ownership, quotas, and URLs.
11. **Checkpoint:** update the append-only production journal, commit with a concise Conventional
    Commit subject, and push the branch.

The next wave does not wait for subjective human review. It waits only for objective authoring,
provenance, and collision-safety gates.

## Correction and provider limits

- Base budget: 400 image calls.
- Global correction budget: at most 60 additional calls.
- Per-image retry ceiling: at most one.
- A correction must use the exact preceding output as its source, preserve passing traits, and name
  one defect. It cannot become an untracked redesign.
- Provider throttles, timeouts, capacity failures, malformed output, and persistence failures are
  classified separately.
- Do not launch synchronized retries after throttling. Requeue with staggered dispatch and reduced
  active concurrency.
- A failed image never appears on the main review page. Its target, attempts, and evidence remain in
  quarantine.

## Resume behavior for the goal loop

At the beginning of every harness continuation:

1. read the creative plan, execution plan, roster plan, append-only journal, and production report;
2. verify branch, worktree, remote state, existing candidates/results, and their hashes;
3. list live agents and reconcile their assigned IDs with the journal;
4. never redispatch an assignment with an existing candidate or result path;
5. mark verified complete jobs, requeue only valid no-output failures, and activate reserves only
   through the coordinator;
6. fill available producer lanes, wait for results, validate, checkpoint each 20-pair boundary, and
   continue automatically;
7. keep the user-facing commentary focused on completed wave counts, failures requiring attention,
   and meaningful visual findings rather than per-call noise.

Stopping because one generation is slow, one candidate fails, or a wave is incomplete is not goal
completion. External provider failure becomes a blocker only when safe staggered retries and reduced
concurrency repeatedly fail and the harness cannot make meaningful progress.

## Phase 4 — morning review surface

Build one static review application inside the experiment:

- reference shelf for reviewed Keeps, visually separate and excluded from the 200 count;
- 20 always-paired candidates per page;
- compressed lazy-loaded previews; full-resolution originals open on click;
- decisions: `Keep`, `Pass`, `Revise summon`, `Revise chibi`, `Revise both`, `Undecided`;
- optional note per hero;
- decision and wave filters;
- hidden-by-default target brief for diagnosing manifest drift;
- persistent local storage plus downloadable versioned JSON;
- completion counts and a quarantine/report page;
- no control that separates summon from chibi during ordinary review.

Browser-test at desktop and narrow widths. Verify all 400 preview images lazily resolve, every source
link returns 200, decisions persist after reload, and export contains exactly 200 hero records.

Serve through a persistent user service bound to `0.0.0.0` on a verified free port. Publish only the
equivalent `http://10.110.24.218:<port>/...` URL.

## Phase 5 — final validation and delivery

Completion requires all of the following:

- 200 complete new hero pairs, excluding reviewed wave identities;
- exact 100/100 gender and all other quota totals;
- 200 character kernels and 400 hash-bound candidate results;
- no output collisions, unverified overwrites, missing provenance, or shared-file producer edits;
- no candidate described as approved or written into a runtime catalog;
- all original candidates plus normalized previews retained;
- aggregate production report with attempts, corrections, quarantine, reserves, provider failures,
  and wall-clock measurements;
- pair-first review page with zero broken assets and valid decision export;
- Heroes experiment validator, wiki validator, formatting, browser, and repository-scope checks pass;
- every 20-pair batch committed and pushed;
- branch rebased on current main before final delivery, with post-rebase validation rerun;
- clean working tree and remote branch hash matching local HEAD.

Final handoff reports the branch, all wave commits, final commit, completed-pair count, correction and
quarantine counts, validation results, persistent IP-based review URL, clean-tree state, and any
integration request. Do not merge or promote assets without explicit owner approval.

## Expected duration and uncertainty

At 12 active production lanes, 400 base calls plus inspection, corrections, persistence, and ten
commits is suitable for an overnight goal loop. Provider latency and throttling are external
variables, so the process optimizes for durable complete waves rather than an unverified all-or-none
deadline. If the provider cannot sustain the target, the morning result still contains every
completed, validated pair and an exact resumable shortfall report.
