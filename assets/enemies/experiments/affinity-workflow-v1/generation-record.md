# Affinity workflow v1 generation record

Status: **controlled and final correction regressions complete; guarded rerun preparation and
capacity scheduler complete; breadth gate closed; human blind review pending**

Date: **2026-08-29**

## Final-controlled activation readiness

The check-only `report:affinity-final-controlled-activation` gate now records explicit blockers without writing files. Current activation remains unauthorized: the 21 original controlled candidates have no blind-review records and no 16-record human resolution ledger exists. Revise results and risk rationale are evidence inputs only and cannot count as blind acceptance. No staged target, activation receipt, live manifest, candidate, or result was created by this work.

Forge now keeps `baseline-v1` and `final-controlled-v1` as exact, non-overlapping review rounds. The final round stays unavailable until all 24 reserved manifests exist and match the rerun plan; media and submitted reviews must belong to the selected round. The exact-concurrency allocation is likewise checked in as `executable: false`: it reserves collision-free work through 16 workers without claiming that unavailable capacity was measured. Only the prior two- and three-worker evidence is currently eligible.

This record summarizes execution evidence. Exact prompts, attempt timestamps, source identifiers,
reference hashes, persistence receipts, dimensions, byte counts, findings, and candidate hashes live
in the per-target JSON files under `results/`. The machine-validated aggregate is
`review/evaluation.json`.

## Current inventory

| Cohort | Manifests | Results | Producer candidates | Revise | Missing |
| --- | ---: | ---: | ---: | ---: | ---: |
| Controlled | 24 | 24 | 21 | 3 | 0 |
| Elemental semantic regression | 6 | 6 | 5 | 1 | 0 |
| Final correction regression | 6 | 6 | 4 | 2 | 0 |
| Breadth | 24 | 0 | 0 | 0 | 24 |
| Total | 60 | 36 | 30 | 6 | 24 |

No candidate is approved or promoted. Producer status is a bounded authoring decision, not human
acceptance.

## Controlled outcomes

| Species | Candidate | Revise | First-attempt candidate | Main finding |
| --- | ---: | ---: | ---: | --- |
| Death Knight | 6 | 0 | 0 | All canonical-v1 first attempts needed framing correction; Metal and several other affinities remain vulnerable to armor-plus-overlay readings. |
| Bound Vanguard Elemental v1 | 6 | 0 | 5 | The original stone anchor biased non-stone variants toward stone, ice, or surface effects despite polished output. |
| Grey Wolf | 5 | 1 | 2 | Fire is visually strong but quarantined for prompt-provenance mismatch; other variants preserve wolf anatomy, with Wood less legible at thumbnail size. |
| Cave Bear | 4 | 2 | 3 | Wood and Wind exhausted the retry ceiling with the far hind paw still occluded; v4 Metal and Water passed framing on their first attempts. |

The controlled workflow threshold of at least 20 first-attempt candidates is not met: the measured
count is 10. Species and affinity recognition thresholds cannot be evaluated until a human submits
blind reviews. The breadth release gate therefore remains closed.

## Elemental semantic regression

A purpose-built neutral Bound Vanguard benchmark replaced the Stone Breaker anatomy bias:

- path: `assets/enemies/review/pack-2/benchmarks/bound-vanguard-neutral-anchor-v1.png`;
- SHA-256: `a934483cc02570e674c16b6c51d0120aeb05029370b8ef0ab0dd9e96727156a1`;
- canvas: `1536×1024` PNG;
- result: five producer candidates and one Fire revise;
- improvement: fixed headless shallow-concave chassis and more load-bearing substance construction;
- remaining concerns: Water can still read as glass/ice, Wind initially read as transparent solid,
  and Fire's corrected construction still violated the strict top margin.

The benchmark was created before the structured per-target result contract covered benchmark
authoring. Its retained bytes and source hash are known, but its exact tool prompt was not persisted
to a repository result record. This is recorded as a provenance limitation and is not repeated for
candidate generation.

## Final correction regression

Six versioned targets tested the final safe-frame-v4 / semantic-v2 workflow against the specific
weaknesses found in the independent audit:

| Target | Status | Attempts | Outcome |
| --- | --- | ---: | --- |
| Fire Grey Wolf v2 | Candidate | 1 | Restored exact canonical prompt provenance while preserving the strong integrated Fire design. |
| Wood Cave Bear v2 | Candidate | 2 | A targeted stance correction produced four independently readable grounded paws. |
| Wind Cave Bear v2 | Revise | 2 | Safe framing and affinity passed, but the far hind paw remained occluded in both attempts. |
| Fire Elemental v3 | Candidate | 1 | Preserved the substance-bodied v2 chassis and contained every combustion extent inside the safe frame. |
| Metal Death Knight v2 | Revise | 2 | Solved ordinary-armor ambiguity through forged ribs, marrow, joints, and core, but the sword entered the bottom safe band. |
| Metal Death Knight v3 | Candidate | 2 | Preserved the forged construction and passed the strict border with a shorter, raised sword and smaller composition. |

The batch used ten model calls and 964,793 ms of summed auditable job time. Four targets became
producer candidates, two stopped honestly at `revise`, and all six retained complete selected-output
provenance. Rejected intermediate images retain their prompt, provider source identifier, timing, and
findings, but not byte-level persistence receipts. There were no collisions, shared-file edits,
throttles, or integration errors. The Wind Bear result is kept as evidence of repeated
target/generator variance rather than accepted with hidden anatomy.

The immutable Grey Wolf and Fire Elemental correction prompts use `approved` and `accepted` to mean
producer-retained designs from earlier runs, not human approval or shared-catalog promotion. Future
manifests use `retained` explicitly; these completed prompt records remain unchanged so their hashes
continue to match the submitted generation requests.

## Workflow iterations

1. `canonical-v1` preserved the initial pilot but caused framing retries.
2. `safe-frame-v2` added an explicit central-84% lock while retaining a terminal line feed.
3. `safe-frame-v3` removed the terminal line feed, but an implementation defect accidentally omitted
   the lock. Completed v3 prompts remain immutable evidence.
4. `safe-frame-v4` restores the lock and keeps the no-terminal-line-feed handoff. Metal and Water
   Cave Bears passed v4 on their first attempts; Wind passed framing after one correction but still
   failed the four-visible-extremities criterion.
5. Corrective edit provenance now separates ordered manifest reference provenance from the exact
   preceding generated-image path and hash.

The complete failure classification and resolution history is in `review/evaluation.json`.

## Reproducible review artifacts

- `review/contact-sheet.png` is a deterministic `1920×1080` blind sheet containing all 24
  controlled outputs in an opaque hash-derived order. It contains 21 producer candidates and three
  inspectable revision records, carries no species or affinity labels, and has SHA-256
  `070e516c3fbdf9633f076015518cbd794da26a55f7c8676758904bc7e010de7c`.
- `dry-runs/goblin-normal-envelope-preflight-v2.json` proves that a fresh bounded agent could execute
  target validation, reference routing, canonical prompt rendering, and output ownership from the
  installed skill, one target, and a dedicated `dryRun: true` envelope without making an image call.
- Review mode is now server-derived. Label-visible inspection cannot submit review evidence; API and
  pre-migration records remain explicitly unverified and are excluded from blind-review export.
- `pnpm report:affinity-gate` reports current, maximum attainable, and required values without
  mutating evidence. It currently proves the v1 cohort cannot pass review alone: first-attempt
  candidates max at 10/20, species-review capacity at 21/23, and meaningful non-Normal acceptance
  capacity at 17/20.
- `review/final-controlled-rerun-plan.json` reserves 24 collision-free v3/v4 coordinates and eight
  balanced three-worker fallback waves. The preparer has validated a temporary 48-manifest preview:
  24 targets, 24 assignments, 24 distinct canonical prompts, 53 purpose-routed references, and zero
  live experiment writes. The audited plan retains eight blocking and eight nonblocking pending
  design risks; it is not authorization to skip the informative v1 review or the breadth gate.
- `review/wave-plans/pilot-current-task-capacity-v1.json` and its immutable `preflight.json` record
  an exact four-worker Pilot request against four total task slots. With one orchestrator reserved,
  only three workers were admitted, so the scheduler stopped before dispatch with zero path
  collisions and zero image calls.
- `pnpm check:affinity-plan-completion` derives the experiment state from strict live evidence and
  remains nonzero until all nine sections—including final results, human blind review, breadth,
  measured concurrency, accepted visual rules, and the final scale recommendation—are complete.

## Timing and concurrency

- Individual model image calls were commonly 15–48 seconds.
- Complete audited jobs commonly took roughly 91–279 seconds, including task startup, references,
  inspection, a possible correction, persistence, result writing, and verification.
- Two-worker Death Knight canary speedup: 1.563×; parallel efficiency: 0.7815.
- Three-worker partial pilot speedup: 2.502×; parallel efficiency: 0.834.
- Six-target Elemental regression, executed in two three-worker scheduler waves: 1.8498× observed
  effective speedup over summed job time; full provenance and no capacity errors.
- Final three-worker v4 Bear wave: 1.838× observed effective speedup; full provenance and no
  capacity errors.
- Final correction regression: six targets, ten model calls, four candidates, two revise outcomes,
  and 964.793 seconds of summed audited job time under a dynamic ceiling of three image workers.

The active task exposes four total agent slots, so three image workers is the measured safe ceiling
when orchestration is reserved. The new exact-concurrency scheduler consequently rejected the
four-worker Pilot at preflight instead of relabeling a three-worker run. Local configuration
requests 16, but configuration alone does not prove provisioned capacity. The 4-, 6-, 8-, 12-, and
16-worker exact ladder remains pending a task that actually exposes the requested slots.

## Review and continuation

Run the application with:

```bash
pnpm dev
```

Then open `/forge/enemies/affinity-workflow` for labeled inspection or
`/forge/enemies/affinity-workflow?mode=blind` for server-stripped blind review. Reviews are
append-only, bound to the exact candidate hash, and never promote assets.

After one reviewer completes the blind set, export their latest hash-bound decisions with:

```bash
pnpm export:affinity-review-evidence --reviewer <reviewer-name>
pnpm sync:affinity-review
pnpm report:affinity-gate
pnpm finalize:affinity-evaluation
```

The finalization command refuses to pass an incomplete or unattainable gate. Re-evaluate the
controlled thresholds before dispatching any breadth image generation. The 60- and 600-manifest
Goblin independence audits are already deterministic and require no image calls. A coherent
versioned final-protocol controlled rerun and subsequent human blind review remain required;
producer self-inspection cannot supply recognition or acceptance decisions.

Preparatory and completion checks are available without image calls:

```bash
pnpm prepare:affinity-final-controlled-rerun
pnpm check:affinity-plan-completion
```

The first command validates that preview generation remains possible while live activation stays
blocked. The second is expected to exit nonzero until the remaining human, image, breadth, capacity,
and decision evidence exists.
