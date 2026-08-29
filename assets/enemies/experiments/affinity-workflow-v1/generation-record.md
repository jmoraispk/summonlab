# Affinity workflow v1 generation record

Status: **controlled matrix complete; breadth gate closed; human blind review pending**

Date: **2026-08-29**

This record summarizes execution evidence. Exact prompts, attempt timestamps, source identifiers,
reference hashes, persistence receipts, dimensions, byte counts, findings, and candidate hashes live
in the per-target JSON files under `results/`. The machine-validated aggregate is
`review/evaluation.json`.

## Current inventory

| Cohort | Manifests | Results | Producer candidates | Revise | Missing |
| --- | ---: | ---: | ---: | ---: | ---: |
| Controlled | 24 | 24 | 21 | 3 | 0 |
| Elemental semantic regression | 6 | 6 | 5 | 1 | 0 |
| Breadth | 24 | 0 | 0 | 0 | 24 |
| Total | 54 | 30 | 26 | 4 | 24 |

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

The active task exposes four total agent slots, so three image workers is the measured safe ceiling
when orchestration is reserved. Local configuration requests 16, but configuration alone does not
prove provisioned capacity. The 8-, 12-, and 16-worker ladder remains pending a task that actually
exposes those slots.

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
pnpm export:affinity-review-evidence -- --reviewer <reviewer-name>
pnpm sync:affinity-review
```

Re-evaluate the controlled thresholds before dispatching any breadth image generation. The 60- and
600-manifest Goblin independence audits are already deterministic and require no image calls.
