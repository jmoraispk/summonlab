# Monster Image Single-Checkpoint Goal-Harness Plan

**Status:** owner-approved production plan

> **Historical completion boundary (2026-09-04):** This plan belongs only to the original
> 30-family, 750-coordinate matrix. That matrix is complete and must not be regenerated. The owner
> replaced all prospective legacy-bridge expansion work with eight new fauna families documented in
> [the fauna expansion design](../specs/2026-09-04-fauna-family-expansion-design.md). Any future image
> run must use a new `fauna-family-v1` manifest and may target only its 200 new coordinates. Rodents
> are excluded for a later independent `summonlab-enemy-creation` skill test.

**Objective:** Produce the complete enemy-owned canonical visual matrix—30 families, 150 T1–T5
forms, and 750 individual Normal/Fire/Earth/Wind/Water images—without requesting owner visual
decisions during production. Preserve strict provenance, collision-safe versioning, candidate-only
truth, and zero runtime promotion. Present the first owner visual checkpoint only after the matrix is
pixel-complete at 750/750.

This plan supersedes the intermediate human checkpoint in
[`2026-09-02-monster-image-overnight-goal-harness.md`](./2026-09-02-monster-image-overnight-goal-harness.md).
That earlier plan remains historical provenance for the original two-phase workflow. The production
schemas, ownership boundaries, per-target image protocol, and final quality bar remain authoritative
unless this document explicitly changes them.

## Authoritative inputs

- `assets/enemies/experiments/family-affinity-v1/manifest.json`
- `assets/enemies/experiments/family-affinity-v1/active-sources.json`
- `assets/enemies/experiments/family-affinity-v1/family-replacements/*.json`
- `assets/enemies/experiments/family-affinity-v1/assignments/`
- `assets/enemies/experiments/family-affinity-v1/production-compatibility.json`
- `docs/superpowers/specs/2026-09-01-monster-family-floor-image-production-design.md`
- `docs/superpowers/plans/2026-09-01-monster-family-affinity-production.md`

When generated aggregates disagree with the manifest, immutable targets, assignments, candidates,
or strict result receipts, the manifest-bound evidence wins and the aggregate must be regenerated.

## Owner decision and scope

The owner has directed that visual review occur once, at the end of initial pixel production. This
changes when approval is requested; it does not convert unreviewed candidates into approved art.

The canonical matrix remains fixed at:

```text
30 families × 5 authored forms × 5 affinities = 750 coordinates
```

The affinities are exactly `normal`, `fire`, `earth`, `wind`, and `water`. Dual affinities,
bridge-only legacy classes, skills, engine contracts, unrelated visual domains, and shared runtime
catalogs are outside this run.

The run has three distinct states:

1. **Pixel-complete:** all 750 active coordinates have an exclusive candidate PNG and a verified
   strict result receipt.
2. **Review-complete:** all required owner and label-hidden T3/T5 decisions exist and agree, including
   any post-review revisions.
3. **Runtime:** intentionally out of scope and fixed at `runtimeCount=0`.

The harness objective is pixel completion. It must not fabricate human approval, reinterpret the
owner's scheduling decision as visual acceptance, or promote any image to runtime.

## Baseline at plan approval

On 2026-09-03 the canonical review catalog reports:

| Measure | Count |
| --- | ---: |
| Canonical coordinates | 750 |
| Normal candidates generated | 150 |
| Affinity candidates generated | 36 |
| Total active candidates generated | 186 |
| Approved-review coordinates retained | 108 |
| Runtime coordinates | 0 |
| Active coordinates still requiring pixels | 564 |

The remaining pixel workload is entirely affinity variants:

```text
28 untouched families × 20 affinity variants = 560
Elemental Sovereign × 4 affinity variants      =   4
                                                -----
Total missing affinity pixels                  = 564
```

Deep Ones are already pixel-complete at 25/25. Their eight active T3/T5 affinity blind receipts are
`revise` evidence and must be surfaced at final review, but they do not make the current coordinate
pixel-incomplete. Existing candidates, results, assignments, reviews, and historical revisions remain
immutable.

## Single-checkpoint production policy

No owner visual decision is required between the start of this plan and verified 750/750 pixel
completion. The controller may provide non-blocking progress updates, but it must not request
approval, preference selection, or aesthetic feedback during production.

The only permitted early stop is an unrecoverable provider or contract failure after safe retries and
alternatives are exhausted. Recoverable target failures are recorded and requeued. Individual weak
but technically valid candidates are retained, flagged for final review, and do not halt unrelated
coordinates.

At 750/750, the controller presents one consolidated review experience. The owner first completes
the label-hidden T3/T5 portion, then reveals the named matrix and records approvals or exceptions.
Post-review corrections form a separate bounded revision wave.

## Phase 0 — replace the intermediate approval dependency

The current production contract marks affinity targets `blocked-on-anchor` until their exact Normal
candidate has an ordinary approval receipt. Replace that dependency with a truthful provisional
anchor that permits candidate generation without claiming approval.

### Provisional Normal anchor

Add a canonical affinity anchor kind named `normal-verified-candidate`. It must bind:

- Normal coordinate ID and active version;
- Normal target path and SHA-256;
- Normal candidate path and raw SHA-256;
- Normal result path and SHA-256;
- source packet path and SHA-256 through the Normal target;
- the absence of any implied owner decision;
- `humanReviewPending: true`;
- `runtimeCatalogMutationForbidden: true`.

Add a dispatch status named `planned-provisional-anchor`. It means only that the candidate-generation
gate is open. It must never be rendered as `approved-review`, accepted art, or runtime art.

Existing `normal-approved-review` anchors remain valid and must not be downgraded. Existing review
receipts remain immutable and authoritative.

### Controller activation

Add a controller-only command:

```bash
pnpm activate:family-affinity-provisional-anchors \
  --caller-role integration-controller \
  --all-verified-normal-candidates
```

The command must:

1. acquire the exclusive manifest mutation lock;
2. validate all 150 active Normal targets, assignments, candidates, result receipts, packet hashes,
   prompt hashes, and raw image hashes;
3. skip affinity coordinates already backed by approved Normal anchors;
4. update only blocked canonical affinity targets whose exact Normal chain verifies;
5. write `normal-verified-candidate` evidence into those targets;
6. set target and assignment status to `planned-provisional-anchor`;
7. recompute target, assignment, and manifest hashes;
8. refuse any path collision, stale version, symlink, partial write, bridge coordinate, or runtime
   mutation;
9. emit a deterministic activation report with activated, skipped-approved, already-provisional,
   and rejected counts.

The mutation must use atomic staging and rollback semantics already established by the approved
Normal-anchor activation flow.

### Required contract work

Update only the enemy visual-production surface:

- `tools/family-affinity-production-lib.ts` schemas and validators;
- the provisional activation command and focused tests;
- dispatch and compatibility checks;
- review aggregation and monster-wiki presentation labels;
- production contract/reference documentation;
- this plan's superseded predecessor banner.

Do not change engine contracts, skills gameplay data, unrelated visual domains, or shared runtime
catalogs. If implementation discovers that a shared contract must change, stop before that mutation
and raise an integration request.

### Phase 0 acceptance

Before image dispatch, prove:

- all 150 Normal candidate/result chains verify;
- 600 canonical affinity coordinates are dispatchable through either an approved or provisional
  Normal anchor;
- exactly 564 of those affinity coordinates lack active candidate/result pairs;
- provisional targets remain candidate-only and human-review-pending;
- `runtimeCount=0`;
- all production, compatibility, dispatch, review, wiki, and focused activation tests pass.

Commit and push this contract migration before launching image producers.

## Phase 1 — derive the collision-safe queue

Build the work queue from the active manifest and on-disk evidence, never from remembered counts.

For every canonical coordinate:

1. validate the active target and assignment cross-hashes;
2. treat a coordinate as generated only when both candidate and result exist and strict verification
   passes;
3. exclude all 186 verified active candidates from dispatch;
4. include each of the 564 verified, dispatchable, ungenerated affinity coordinates exactly once;
5. reject duplicate candidate paths, result paths, target IDs, assignment IDs, or coordinate owners;
6. preserve active versions and immutable earlier attempts;
7. group work by family, tier, and affinity for scheduling only.

The controller maintains four queues:

```text
ready          dispatchable active target with no candidate/result pair
in-flight      assigned to exactly one live image producer
complete       candidate/result pair passes strict verification
recovery       provider, artifact, or provenance failure requiring a safe retry or supersession
```

Formal owner-review and blind-review queues are deferred until pixel completion. Existing formal
review evidence remains in place.

## Phase 2 — multi-agent image production

Use up to 18 total agent slots:

| Role | Slots | Ownership |
| --- | ---: | --- |
| Root controller | 1 | Manifest mutations, queue ownership, aggregates, commits, pushes |
| Image producers | 8 initially; up to 12 | One immutable target and one image call at a time |
| Advisory visual auditors | 2–3 | Read-only anatomy, tier, affinity, framing, artifact observations |
| Inventory/validation agent | 1 | Read-only counts, hashes, missing-coordinate reconciliation |
| Recovery capacity | 1–2 | Replacement producer or focused provider/contract diagnosis |

Start at eight concurrent producers. Increase to ten and then twelve after two clean rounds. Reduce
concurrency on provider throttling; never launch synchronized retries.

### Per-target protocol

Every image producer must use `summonlab-image-production` and `imagegen` for exactly one assigned
coordinate:

1. Read the immutable target and assignment completely.
2. Run the sealed candidate-phase dispatch check.
3. Inspect every declared reference at original resolution.
4. Submit the exact rendered prompt byte-for-byte through the image generator.
5. Inspect the returned image at original resolution.
6. Check family identity, exact tier, combat archetype, anatomy, framing, affinity construction,
   environmental response, and visible artifacts.
7. Use at most one correction for a specific visible defect.
8. Persist the chosen PNG exclusively to its versioned candidate path.
9. Create the strict result receipt with source, prompt, producer, candidate, and result hashes.
10. Run the sealed result-phase dispatch check and strict result verifier.
11. Report the coordinate, paths, hashes, correction count, and advisory concerns to the controller.

No producer may overwrite an attempt, edit the manifest, issue review evidence, update aggregates,
self-approve, or mutate runtime catalogs.

### Affinity construction standard

Family identity and tier function outrank a repeated elemental template. Each affinity must change at
least two construction dimensions while preserving the underlying form.

- **Fire:** active combustion, flame tongues, ember shedding, incandescent routing, heat distortion,
  and combustion-driven motion.
- **Earth:** soil and mineral stress, load-bearing seams, grit, dust wakes, detached orbiting stones,
  and altered weight or stance without turning every family into a solid rock Golem.
- **Wind:** partial dissipation where anatomy permits, pressure filaments, directional flow, lifted
  debris, asymmetric wake, and reduced apparent mass.
- **Water:** layered currents, translucency or refraction, droplets and spray, wet material response,
  and flow-driven motion rather than blue glass or an aquatic background alone.

A palette-only, aura-only, background-only, or glow-only treatment fails producer inspection.

## Phase 3 — family-bounded controller loop

Generate through the established six family waves. Within each family, dispatch the 20 affinity
coordinates independently; Elementals require only the four missing Sovereign variants and Deep Ones
require no initial pixels.

After each scheduling round, the controller:

1. recomputes inventory from disk;
2. removes verified coordinates from `ready` even when an agent report was lost;
3. confirms one owner per in-flight coordinate;
4. accepts only complete candidate/result pairs that pass strict verification;
5. records provider or technical failures without inventing candidate receipts;
6. requeues recoverable failures after a real provider-state or assignment change;
7. serializes all aggregate exports after producer writes finish.

After each completed family:

- export its 5×5 contact sheet and summary;
- run production, compatibility, dispatch, review, and wiki checks;
- record advisory audit concerns without creating owner decisions;
- commit a coherent family-bounded binary batch;
- push immediately to `origin/codex/enemies-affinity-wiki`.

The controller may report progress, failures, and counts without asking the owner to decide anything.

## Failure and revision policy before final review

### Provider or persistence failure

If no valid candidate is persisted, retain the coordinate in `recovery`. Retry only after reducing
concurrency, waiting for changed provider state, or assigning a fresh producer. Never fabricate a
result receipt.

### Technical image failure

If the first image has a concrete artifact that the one allowed correction does not fix, record the
generation failure through the existing immutable failure mechanism and allocate a collision-safe
vN+1 attempt. Preserve vN.

### Advisory aesthetic concern

If a technically valid image may have weak tier, archetype, affinity, or counterplay readability,
retain it as the active candidate and flag it for the consolidated final review. Do not stop the
remaining queue and do not create a human decision.

The existing Deep Ones blind `revise` receipts follow this final category until an ordinary owner
decision permits formal reconciliation and any v2 allocation.

## Phase 4 — validation cadence

Before production, after each family, after every recovery allocation, at the end of each wave, and
before the final push, run under the compatibility receipt's sealed runtime:

```bash
pnpm check:family-affinity-production
pnpm check:family-affinity-production-compatibility
pnpm check:family-affinity-dispatch-bundle
pnpm check:family-affinity-review
pnpm validate:wiki-monsters
pnpm validate:wiki
git diff --check
```

Run the target-scoped dispatch command before and after every image operation:

```bash
pnpm check:family-affinity-production-dispatch TARGET ASSIGNMENT --phase candidate
pnpm check:family-affinity-production-dispatch TARGET ASSIGNMENT --phase result
```

At each wave boundary and final completion, also run:

```bash
pnpm test:family-affinity-production
pnpm export:family-affinity-review
pnpm export:wiki-monsters
```

Exports run before their corresponding check commands. Controller mutations and aggregate exports
must remain serialized.

Internal checkpoint evidence records:

- generated / 750;
- remaining / 750;
- runtime / 750;
- ready, in-flight, complete, and recovery counts;
- current provider-failure count;
- advisory concern count;
- last pushed commit;
- clean or dirty worktree state.

These records do not require owner acknowledgement.

## Phase 5 — the single owner checkpoint

Do not request owner visual feedback before strict evidence reports `generatedCount=750`.

At 750/750, build one consolidated browser review experience containing:

- all 30 families;
- five T1–T5 rows per family;
- Normal, Fire, Earth, Wind, and Water columns;
- exact active version and candidate SHA-256;
- full-resolution image links;
- family, tier, affinity, unreviewed, approve, and revise filters;
- a label-hidden T3/T5 pass that must be completed before names are revealed;
- the named matrix after blind review;
- existing formal decisions and advisory flags without presenting them as owner conclusions;
- keyboard-accessible approve, revise, and unreviewed controls;
- browser-local progress persistence;
- a copyable final response containing batch approval or exact exceptions.

The review UI is evidence-only. It cannot write repository receipts or promote assets. The owner
returns the copied response to the controller, which records immutable review receipts through the
controller-owned workflow.

Any rejected coordinate enters a post-750 revision wave. That wave is outside initial pixel
completion and may require a later verification checkpoint after the requested corrections exist.

## Commit, push, and integration policy

- Commit and push the provisional-anchor contract migration first.
- Commit and push each completed family as its own reviewable batch.
- Never mix unrelated pre-existing changes into an enemy batch.
- Rebase on `origin/main` only at a clean batch boundary.
- Use `git push --force-with-lease` only when a clean-boundary rebase rewrites the remote branch.
- Do not push runtime promotion or shared-catalog changes.
- Keep the working branch `codex/enemies-affinity-wiki` unless the root orchestrator explicitly
  chooses another integration branch.
- Request main integration only after the branch is clean, pushed, validated, and the intended batch
  boundary is clear.

## Pixel-completion acceptance criteria

Initial production is complete only when all are true:

- [ ] `coordinateCount=750`
- [ ] `generatedCount=750`
- [ ] all 150 Normal candidates remain present and verified
- [ ] all 600 affinity candidates are present and verified
- [ ] every active coordinate has exactly one current candidate PNG and strict result receipt
- [ ] every candidate, target, assignment, source, reference, prompt, and result hash verifies
- [ ] there are no unresolved in-flight writes, manifest locks, or partial candidate/result pairs
- [ ] 30 current family contact sheets and summaries export successfully
- [ ] the consolidated 750-image review experience exports successfully
- [ ] the wiki reports 30 families, 150 forms, 750 production coordinates, and 40 reconciliations
- [ ] provisional anchors remain clearly marked human-review-pending
- [ ] `runtimeCount=0`
- [ ] the branch is rebased at a clean boundary, fully pushed, and the worktree is clean
- [ ] the owner receives the first visual-decision request only after the preceding checks pass

Review completion and runtime promotion are later milestones. Pixel completion must not be relabeled
as either one.

## Copy-paste goal-harness objective

```text
Generate every missing canonical Summonlab monster image until family-affinity-v1 is pixel-complete at 750/750 verified coordinates. Follow docs/superpowers/plans/2026-09-03-monster-image-single-checkpoint-goal-harness.md exactly. Supersede the intermediate human-review dependency with hash-bound normal-verified-candidate provisional anchors: this authorizes candidate generation only and must never imply visual approval or runtime promotion. Generate all 564 missing Fire/Earth/Wind/Water candidates using individual provenance-bound image-generation calls, collision-safe versioning, family-bounded commits and pushes, and automated advisory audits. Do not request owner visual decisions during production. Stop only for an unrecoverable provider or contract failure after safe alternatives are exhausted, or for verified 750/750 pixel completion. At completion, provide one consolidated owner-review experience covering every family, tier, and affinity. Finish with runtimeCount=0, a clean pushed branch, complete validation evidence, and an explicit integration request.
```
