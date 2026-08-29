# Character Pack 2 image-generation benchmark

Status: **measured authoring benchmark; human approval pending**

Date: **2026-08-29**

Mode: **built-in image generation**

This benchmark replaces the Pack 2 planning allowance with measured Summonlab production data. It
does not promise provider latency, runtime latency, or time to human approval.

## Results

Nearest-rank percentiles are used. “Request” measures one image-generation call, including return
transfer to the Codex image store. “Candidate asset” sums every attempt needed to reach the terminal
authoring candidate. All candidates still require human accept/revise/reject review.

| Asset type | Requests | Candidates | Request median | Request p90 | Request p95 | Candidate median | Candidate p90 | Candidate p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Human full-body anchor | 24 | 18 | 35.2 s | 41.9 s | 42.1 s | 38.2 s | 67.6 s | 80.6 s |
| Human continuity sheet | 7 | 6 | 109.3 s | 138.2 s | 138.2 s | 103.9 s | 264.2 s | 264.2 s |
| Monster family plate | 6 | 6 | 23.6 s | 49.4 s | 49.4 s | 23.6 s | 49.4 s | 49.4 s |
| Individual monster anchor | 1 | 1 | 18.1 s | 18.1 s | 18.1 s | 18.1 s | 18.1 s | 18.1 s |
| Identity-preserving equipment edit | 1 | 1 | 38.3 s | 38.3 s | 38.3 s | 38.3 s | 38.3 s | 38.3 s |
| Evolution variant | 1 | 1 | 35.6 s | 35.6 s | 35.6 s | 35.6 s | 35.6 s | 35.6 s |

The one-sample categories are feasibility observations, not stable percentile estimates. Add more
samples before using their p90 or p95 for capacity planning.

## Acceptance evidence

- Human anchors: 18 terminal authoring candidates from 24 calls; 12 of 18 were first-pass candidates
  and six required correction, for a 66.7% first-pass authoring rate.
- Continuity: six terminal candidates from seven calls; five of six were first-pass candidates, for
  an 83.3% first-pass authoring rate.
- Monster family plates: six terminal candidates from six calls in this run.
- Human acceptance is intentionally not inferred. Every generated bitmap remains `candidate` and
  player-facing summon eligibility remains disabled.
- The built-in path exposes no per-request billed cost, so cost is recorded as unavailable rather
  than guessed.

## Transfer and normalization

Request wall clock includes response transfer into the generated-image store. Project copy, hash,
and validation happen afterward. One returned human anchor was 1023×1537; repeating its Sharp PNG
normalization to 1024×1536 took 128 ms and produced the same 2,043,018-byte output. All other tracked
benchmark assets arrived at target dimensions.

## Product answer

A deterministic human manifest can be drawn on the summon path, but a new premium painted human
cannot responsibly be generated there. The measured full-body request median was about 35 seconds,
and anatomy corrections raised p95 candidate time to about 81 seconds before any human approval.
Continuity work is measured in minutes.

The real-time experience should therefore draw a deterministic manifest from an approved cached
pool and display its already approved premium portrait. Procedural rigs and approved local layers
can react immediately to the draw, equipment, and state. New premium portraits, continuity,
cinematics, and evolution art remain asynchronous authoring work and cannot enter the eligible pool
until review passes.

## Reproduction and sources

- Human catalog: `assets/heroes/visuals/forge-v2/catalog.json`
- Monster catalog: `assets/enemies/review/pack-2/catalog.json`
- Benchmark samples: `assets/benchmarks/pack-two/samples.json`
- Exact gap prompts: `assets/benchmarks/pack-two/generation-record.md`
- Validation: `pnpm validate:pack-two-generation-benchmark`
