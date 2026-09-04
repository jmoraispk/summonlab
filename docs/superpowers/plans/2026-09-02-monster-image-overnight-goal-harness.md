# Monster Image Overnight Goal-Harness Plan

**Objective:** Produce the complete enemy-owned canonical visual matrix—30 families, 150 T1–T5 forms, and 750 individual Normal/Fire/Earth/Wind/Water images—with strict provenance, bounded revisions, human review gates, and no runtime promotion.

**Authoritative inputs:**

- `assets/enemies/experiments/family-affinity-v1/manifest.json`
- `assets/enemies/experiments/family-affinity-v1/family-replacements/*.json`
- `assets/enemies/experiments/family-affinity-v1/assignments/`
- `docs/superpowers/specs/2026-09-01-monster-family-floor-image-production-design.md`
- `docs/superpowers/plans/2026-09-01-monster-family-affinity-production.md`

This is the operational plan for persistent image production. The longer implementation plan remains the source for schemas, ownership, review contracts, and wiki integration.

## Scope and completion states

The canonical matrix is fixed at:

```text
30 families × 5 authored forms × 5 affinities = 750 coordinates
```

The affinities are exactly `normal`, `fire`, `earth`, `wind`, and `water`. Dual affinities, bridge-only legacy classes, skills, engine contracts, unrelated visuals, and shared runtime catalogs are outside this run.

Three milestones must remain distinct:

1. **Pixel-complete:** all 750 active canonical coordinates have an exclusive candidate PNG and a verified strict result receipt.
2. **Review-complete:** all 750 active candidates have the required human review evidence; T3 and T5 also have label-hidden blind review evidence.
3. **Runtime:** intentionally out of scope. This run must finish with `runtimeCount=0`.

“Generate all monsters” means pixel-complete. It does not authorize producers to self-approve, fabricate human review, or promote candidates to runtime.

## Baseline at plan creation

On 2026-09-02 the canonical catalog reports:

| Measure | Count |
| --- | ---: |
| Canonical coordinates | 750 |
| Active generated coordinates | 20 |
| Approved-review coordinates | 8 |
| Runtime coordinates | 0 |
| Active coordinates still requiring pixels | 730 |

The 20 generated coordinates are Elementals T1–T4 across all five affinities. The accepted Wisp calibration is the affinity material-and-motion standard. The four recalibrated Elemental Spirit v2 variants are candidate-only and awaiting owner review. Elemental Warden and Elemental Colossus affinity candidates also remain reviewable candidates. Elemental Sovereign and every non-Elemental canonical form remain ungenerated.

The missing 730 pixels break down as:

```text
146 Normal anchors
584 affinity variants (146 × Fire/Earth/Wind/Water)
```

## Non-negotiable human gate

Affinity targets are contractually blocked until the corresponding Normal candidate is independently approved. T3 and T5 Normal candidates additionally require a label-hidden human review before activation. Consequently, a single fully unattended night cannot validly generate all remaining 730 pixels unless the required human decisions arrive during the run.

The persistent goal therefore runs in two production nights or two continuous phases separated by a human checkpoint:

- **Phase A:** generate and package all 146 missing Normal anchors for review.
- **Human checkpoint:** record ordinary decisions for all 146 Normals and blind decisions for the 59 missing T3/T5 Normals; revise failures; activate only approved anchors.
- **Phase B:** generate all 584 newly unblocked affinity variants.

The harness should remain active across this checkpoint, but it must report `waiting-for-human-review`, preserve the exact queue, and resume without replanning once valid receipts exist. It must not mark the goal blocked merely because the expected review checkpoint has not happened yet.

## Multi-agent topology

Use up to 18 concurrent slots with exclusive roles:

| Role | Slots | Ownership |
| --- | ---: | --- |
| Root controller | 1 | Manifest mutations, allocations, review assignments, activation, exports, commits, pushes |
| Image producers | 4 initially; ramp to 8–12 | Exactly one assigned target’s candidate PNG and result receipt at a time |
| Visual audit agents | 2–4 | Read-only anatomy, tier, affinity, framing, and artifact checks; no approval receipts |
| Validation/inventory agent | 1 | Read-only counts, missing-coordinate queue, hashes, contact-sheet inspection |
| Spare/recovery capacity | 0–2 | Replacement producer or focused failure diagnosis |

Start with four producers. After two rounds complete without capacity or throttling errors, increase to six, then eight, then at most twelve. If the provider throttles, reduce concurrency and requeue failed targets after a real cooldown or provider-state change; never launch synchronized retries.

Only the controller may write the manifest, allocations, review assignments, review catalog, contact sheets, wiki exports, or other aggregates. Producers never edit shared catalogs. Every producer must use `imagegen` with `summonlab-image-production`, and every target gets its own generation call.

## Per-target production protocol

For each coordinate, the assigned producer must:

1. Read its immutable target and assignment completely.
2. Run the sealed preflight; proceed only on `planned`, `dryRun=false`, valid hashes, and declared references.
3. Inspect every declared reference at original resolution.
4. Submit the exact rendered first prompt byte-for-byte through the built-in image generator.
5. Inspect the returned image at original resolution against species anatomy, tier duty, affinity material/motion, silhouette, framing, and artifact gates.
6. Use at most one correction when it can fix a specific visible defect without changing the target identity.
7. Persist the chosen PNG exclusively to the target’s candidate path; never overwrite an existing candidate.
8. Create the strict result receipt with exact prompt, reference, output, and SHA-256 provenance.
9. Run strict verification. A coordinate counts as generated only when candidate and result both verify.
10. Report the coordinate, candidate path, result path, hashes, correction count, and any review concerns to the controller.

When a retained candidate fails review, the controller records immutable `revise` evidence, allocates vN+1, and assigns a new producer. No producer may overwrite vN or self-promote its work.

## Phase A — generate the 146 missing Normal anchors

Produce Normals family by family in six waves. Within a family, generate T1–T5 in parallel only after confirming five collision-free assignments. Preserve qualitative escalation: T3 must be a Specialist pivot and T5 must be a purpose-authored Sovereign boss, not merely a larger T4.

| Wave | Families | Missing Normals |
| --- | --- | ---: |
| A1 | Goblins, Orcs, Giants, Trolls, Dragons | 25 |
| A2 | Skeletons, Rotwalkers, Wraiths, Vampires, Mummies | 25 |
| A3 | Demons, Celestials, Harpies, Minotaurs, Nagas | 25 |
| A4 | Lizardfolk, Insectoids, Arachnids, Slimes, Golems | 25 |
| A5 | Elementals, Treants, Fungalfolk, Deep Ones, Werebeasts | 21 |
| A6 | Gargoyles, Djinn, Fae, Void Horrors, Doppelgangers | 25 |

Wave A5 has 21 because Elementals T1–T4 Normal anchors already exist; only Elemental Sovereign Normal remains.

After each family’s five Normals:

- issue ordinary owner-review assignments;
- issue blind owner-review assignments for T3 and T5;
- export that family’s contact sheet and summary;
- run the production, review, and wiki checks;
- commit and push the family-bounded batch.

Advisory visual-audit agents may identify likely revisions while Phase A continues, but only a human assignee may author approval/revision receipts.

## Human checkpoint — approve, revise, and activate anchors

The controller presents six wave contact-sheet sets rather than 146 isolated paths. The owner reviews family identity, T1–T5 escalation, combat readability, anatomy, and composition; T3/T5 blind sheets hide labels as required.

For each failed Normal:

1. record `revise` or `reject` with category-specific notes;
2. allocate vN+1;
3. generate one revised candidate with at most one correction;
4. repeat independent review.

For each fully approved Normal, activate its four affinity assignments with the controller-only command:

```bash
pnpm activate:family-affinity-normal-anchors \
  --caller-role integration-controller \
  --normal-coordinate <family>/<form>/normal
```

Multiple `--normal-coordinate` flags may be passed in one controlled activation. Before Phase B begins, prove that all 146 newly required anchors are active and that the missing affinity queue is exactly 584.

## Phase B — generate the 584 affinity variants

Run the same six family waves. As soon as one family’s five Normal anchors are active, its 20 affinity targets may enter the producer queue; do not wait for a global all-family activation.

For every form, generate four separate full-resolution images. They must preserve the approved Normal’s identity while making affinity substance, motion, silhouette behavior, damage history, equipment response, and environmental wake meaningfully different. A tint-only result fails.

Use the accepted Wisp language as calibration:

- **Fire:** active flame tongues, incandescent fracture/energy, ember shedding, heat distortion, and combustion-driven motion.
- **Wind:** partial dissipation, directional pressure filaments, lifted debris, asymmetric airflow, and reduced solid mass where anatomy permits.
- **Water:** layered currents, translucency/refraction, droplets or spray, wet material response, and flow-driven motion rather than blue glass.
- **Earth:** flowing soil/mineral spell-matter, grit, dust wakes, and detached orbiting stones; avoid turning every creature into a uniform solid rock statue.

Family identity and tier function outrank a repeated elemental template. The affinity must transform at least two construction dimensions while preserving recognition of the underlying form.

After every completed family of 20 variants:

- issue the required owner-review assignments;
- issue blind assignments for T3/T5 variants;
- export the family contact sheet and summary;
- validate counts and provenance;
- commit and push a family-bounded binary batch.

Owner review of Phase B may happen after pixel completion because no further candidate coordinates depend on affinity approval. Candidate-only status remains explicit until those decisions are recorded.

## Controller loop and collision safety

The controller maintains four queues derived from the manifest and strict evidence, never from memory:

```text
ready          active target, no candidate/result, all gates satisfied
in-flight      assigned to exactly one live producer
review-needed  verified candidate/result, missing required review evidence
revision       immutable revise/reject receipt exists; vN+1 not yet completed
```

At every scheduling pass:

1. Recompute inventory from disk.
2. Remove completed coordinates from `ready` even if an agent report was lost.
3. Confirm no duplicate target ownership before dispatch.
4. Dispatch one coordinate per producer.
5. Integrate only complete candidate/result pairs that pass strict verification.
6. Export aggregates serially after producers finish writing; never run controller mutations in parallel.
7. Commit only coherent, validated family batches and push immediately.

Provider failures create no fake receipts. Preserve the target in the retry queue with the exact error. Retry only after reducing concurrency, waiting for changed provider state, or assigning a fresh producer. Contract, hash, path, or provenance failures require diagnosis before retry.

## Validation and checkpoints

At the start, after each family batch, after either human checkpoint, and at final completion, run serially:

```bash
pnpm check:family-affinity-production
pnpm check:family-affinity-production-compatibility
pnpm check:family-affinity-dispatch-bundle
pnpm check:family-affinity-review
pnpm validate:wiki-monsters
pnpm validate:wiki
git diff --check
```

Run `pnpm check:family-affinity-production-dispatch TARGET ASSIGNMENT --phase candidate`
before each generation and repeat it with `--phase result` before accepting that target's result
receipt. This command is target-scoped and must not be invoked without its two paths.

At the end of each wave and before the final push, also run:

```bash
pnpm test:family-affinity-production
pnpm export:family-affinity-review
pnpm export:wiki-monsters
```

Run exports before their corresponding `--check` commands. Do not run controller-mutating commands concurrently because the manifest uses an exclusive mutation lock.

Each checkpoint report records:

- generated / 750;
- approved-review / 750;
- runtime / 750 (must remain zero);
- missing Normals;
- blocked affinity targets;
- ready affinity targets;
- revision queue;
- active producer count and provider failures;
- last pushed commit and clean/dirty worktree state.

## Commit and rebase policy

- Commit and push after each coherent family batch; never accumulate the full binary set in one commit.
- Use concise subjects such as `feat(enemies): generate goblin normal forms` and `feat(enemies): generate goblin affinity variants`.
- Rebase on `origin/main` only at a clean batch boundary. Never rebase while producers own uncommitted outputs.
- If a rebase rewrites the branch, use `git push --force-with-lease`, never an unconditional force push.
- Never include unrelated pre-existing changes.

## Final acceptance criteria

Pixel production is complete only when all are true:

- [ ] `coordinateCount=750`
- [ ] `generatedCount=750`
- [ ] every active coordinate has exactly one current candidate PNG and strict result receipt
- [ ] all candidate, target, assignment, source, reference, prompt, and result hashes verify
- [ ] there are no unresolved in-flight writes or manifest locks
- [ ] 30 current family contact sheets and summaries export successfully
- [ ] the wiki reports 30 families, 150 forms, 750 production coordinates, and 40 reconciliations
- [ ] `runtimeCount=0`
- [ ] the branch is rebased at a clean boundary, fully pushed, and the worktree is clean

Review completion is a later milestone unless the owner supplies all required decisions during the run. Runtime promotion requires a separate integration request.

## Copy-paste goal-harness objective

```text
Generate every missing canonical Summonlab monster image until the family-affinity-v1 matrix is pixel-complete at 750/750 verified coordinates. Follow docs/superpowers/plans/2026-09-02-monster-image-overnight-goal-harness.md exactly. Use many collision-safe image-producer subagents, one target and one image-generation call at a time, with summonlab-image-production provenance and no self-approval or runtime promotion. Generate the 146 missing Normal anchors first; package ordinary and T3/T5 blind human-review assignments and preserve the queue while waiting for valid human receipts. After the controller activates approved anchors, generate all 584 newly unblocked Fire/Earth/Wind/Water variants. A tint-only variant fails. Validate, commit, and push family-bounded batches; keep aggregates controller-owned and serialized; rebase only at clean batch boundaries. Do not stop for recoverable individual failures: record and requeue them under the plan. Stop only at the required human-review checkpoint, an actual unrecoverable contract/provider blocker, or verified 750/750 completion. Finish with runtimeCount=0, a clean pushed branch, full validation evidence, and an explicit owner review handoff.
```
