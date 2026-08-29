# Affinity image concurrency wave scheduler

The affinity wave scheduler is a collision-safe orchestration and reporting layer for the
`summonlab-image-production` skill. It does **not** spawn agents, call the image tool, update the
review catalog, or update `review/evaluation.json`. The primary agent remains the only dispatcher
and aggregate owner.

The scheduler closes four gaps in the affinity experiment:

- it records requested concurrency separately from the capacity admitted by the running task;
- it prevents an 8-, 12-, or 16-worker stage from silently running as a lower-concurrency stage;
- it gives the orchestrator a bounded dispatch decision and enforces the three-capacity-or-throttle
  stop rule in an append-only event journal;
- it derives candidate, retry, timing, speedup, efficiency, and failure metrics from strict result
  records without inventing metrics when no image job completed.

## Owned evidence

Each run owns a new directory and may never replace an earlier run:

```text
assets/enemies/experiments/affinity-workflow-v1/wave-runs/<run-id>/
├── preflight.json
├── events/
│   └── <event-id>.json
└── report.json
```

Preflight, event, and report files use exclusive creation. Target candidate and result paths are
also checked for collisions before dispatch. Use a new run ID and versioned target outputs for
every measurement; never reuse completed targets.

The reserved exact-concurrency allocation is
`assets/enemies/experiments/affinity-workflow-v1/review/wave-plans/exact-concurrency-final-and-breadth-v1.json`.
It is a strictly validated planning artifact with `executable: false`; it cannot be passed to
`preflight`. It reserves unique 2/4/6/8/12/16 coordinates, records every prerequisite gate, and
includes the 14 additional v4/v5 sentinels needed after the two separate breadth canaries consume
two base targets. Validate it without activating manifests or making image calls:

```bash
pnpm exec tsx tools/affinity-wave-scheduler.ts validate-allocation \
  --allocation assets/enemies/experiments/affinity-workflow-v1/review/wave-plans/exact-concurrency-final-and-breadth-v1.json
```

## Wave plan

Store the plan outside its future run directory. A minimal two-worker canary plan is:

```json
{
  "schemaVersion": "affinity-wave-plan-v1",
  "runId": "canary-final-protocol-01",
  "experimentId": "affinity-workflow-v1",
  "stage": "canary",
  "requestedConcurrency": 2,
  "reservedOrchestratorSlots": 1,
  "requireExactConcurrency": true,
  "runDirectory": "assets/enemies/experiments/affinity-workflow-v1/wave-runs/canary-final-protocol-01",
  "stopRules": {
    "capacityFailureLimit": 3,
    "stopOnOutputCollision": true,
    "retryCapacityFailuresInWave": false
  },
  "dispatchGate": {
    "artifactPath": "assets/enemies/experiments/affinity-workflow-v1/review/gates/<gate>.json",
    "canonicalSha256": "<canonical JSON SHA-256>"
  },
  "jobs": [
    {
      "targetPath": "assets/enemies/experiments/affinity-workflow-v1/targets/<species>/<affinity>.json",
      "assignmentPath": "assets/enemies/experiments/affinity-workflow-v1/assignments/<species>/<affinity>.json"
    },
    {
      "targetPath": "assets/enemies/experiments/affinity-workflow-v1/targets/<species>/<affinity>.json",
      "assignmentPath": "assets/enemies/experiments/affinity-workflow-v1/assignments/<species>/<affinity>.json"
    }
  ]
}
```

The stage fixes the requested worker count: Canary 2, Pilot 4, Controlled 6, Breadth 8, Load 12,
and Scale 16. A plan must contain at least one collision-free target per requested worker.

Every executable wave plan must bind a dispatch-gate artifact by canonical JSON hash. The gate
authorizes exactly one stage, records whether its quality and human prerequisites passed, names
preceding eligible scheduler runs, and cites evidence paths. Legacy plans without that pointer may
still reproduce truthful `blocked-capacity` evidence, but they can never become `ready`; an
otherwise runnable legacy plan becomes `blocked-gate`. The event journal also rejects every event
for a non-ready preflight, so bypassing `next` cannot bypass the gate.

Generic early Canary, Pilot, or Controlled work may explicitly record that no human gate was yet
required. A target under `targets/final-controlled/` is different: preflight recognizes that owned
namespace and requires `humanGateSatisfied: true` even at Canary. Breadth, Load, and Scale gates
also require it unconditionally. This prevents the exact Death Knight canary from bypassing the
informative-v1 activation decision merely because Canary normally precedes later human review.

### Representative 16-job wave

A Scale plan must contain exactly 16 jobs, exactly two targets from each of the eight species, and
affinity counts differing by no more than one. One valid coordinate schedule is:

| Species | Target 1 | Target 2 |
| --- | --- | --- |
| Death Knight | Normal | Wood |
| Elemental | Fire | Metal |
| Grey Wolf | Water | Wind |
| Cave Bear | Normal | Fire |
| Goblin | Wood | Metal |
| Tunnel Boar | Water | Wind |
| Cave Drake | Normal | Wood |
| Tower Basilisk | Fire | Metal |

This yields affinity counts of 3 Normal, 3 Wood, 3 Fire, 3 Metal, 2 Water, and 2 Wind. The
scheduler rejects a Scale plan that omits a species, has other than two targets for a species, or
uses a materially skewed affinity mix.

The files for a future Scale run must be new versioned manifests and assignments. The existing
base targets include completed output paths and are useful here only to illustrate the coordinate
mix; collision preflight correctly refuses to run them again.

## Capacity preflight

First obtain the **effective total slots advertised by the running Codex task**, including the
primary/orchestrator. Do not copy the value from `config.toml`: that file requests a ceiling, while
the current task or account may expose less. Sixteen image workers require at least 17 total slots
because one primary slot stays reserved for orchestration.

Then run:

```bash
pnpm exec tsx tools/affinity-wave-scheduler.ts preflight \
  --plan <repository-relative-plan.json> \
  --available-agent-slots <effective-total-slots>
```

Preflight validates strict target and assignment contracts, ID bindings, ownership bindings,
unique output paths, absence of existing output files, the stage-specific workload shape, and
available capacity. It always records:

- requested concurrency;
- effective total slots supplied by the orchestrator;
- one reserved orchestrator slot;
- admitted worker capacity;
- whether exact concurrency is ready;
- collision paths and the explicit status.

`blocked-capacity` and `blocked-output-collision` are evidence, not permission to degrade or
overwrite. Start a suitably provisioned task or author new versioned targets, then create a new run
instead.

`blocked-gate` means capacity and ownership checks passed but the required hash-bound promotion
artifact was absent, invalid, stale, or authorized a different stage. Resolve the prerequisite and
create a new gate, plan, and run ID; do not mutate the blocked evidence.

## Central dispatch loop

The orchestrator records one `wave-started` event, then asks for the next bounded launch set:

```bash
pnpm exec tsx tools/affinity-wave-scheduler.ts next \
  --preflight assets/enemies/experiments/affinity-workflow-v1/wave-runs/<run-id>/preflight.json
```

For each returned target, the orchestrator chooses a stable worker/task ID and records a
`job-dispatched` event **before** spawning that worker. The serialized event is the target claim;
a second orchestrator cannot record another dispatch for the same target. If spawning is refused,
record a `capacity` worker failure with that target and worker ID. An image worker still receives
only the skill, its target, and its assignment. The worker does not write wave events or shared
aggregates.

Record scheduler observations from a temporary event JSON file:

```bash
pnpm exec tsx tools/affinity-wave-scheduler.ts record-event \
  --preflight assets/enemies/experiments/affinity-workflow-v1/wave-runs/<run-id>/preflight.json \
  --event <event.json>
```

Supported events are:

- `wave-started` and `wave-finished`;
- `job-dispatched` with `targetId` and `workerId`;
- `job-finished` with the same target and worker after its strict result exists;
- `worker-failure` with target, nullable worker, `capacity`, `provider-throttle`, `timeout`,
  `malformed-output`, or `other`, and a concrete detail. `capacity` means Codex agent admission;
  `provider-throttle` means the image backend admitted the worker but refused its image call.

Call `next` before every launch group. It subtracts active workers from admitted capacity and never
returns a target twice. At the third combined agent-capacity or provider-throttle failure it returns
`capacity-stop-rule`; the journal rejects any later dispatch event. Let already-running workers
finish, record their outcomes, record `wave-finished`, and rerun only affected targets later at one
lower stage. Capacity and throttle failures are not retried simultaneously within the same wave.

The journal is serialized with a short-lived lock, every event has an exclusive filename, and a
run rejects duplicate events, unknown targets, changed worker identities, multiple outcomes,
activity beyond admitted capacity, events outside the wave boundary, and a finish while workers
remain active.

## Report

After recording `wave-finished`, run:

```bash
pnpm exec tsx tools/affinity-wave-scheduler.ts report \
  --preflight assets/enemies/experiments/affinity-workflow-v1/wave-runs/<run-id>/preflight.json
```

The exclusive `report.json` records requested, admitted, and measured effective concurrency;
distinct workers; wave and job timings; candidate/revise/failure counts; separate agent-capacity,
provider-throttle, timeout, and malformed-output failures; retry count and rate; generation median
and, with at least ten attempts, p90/p95; summed job time; observed speedup; parallel efficiency;
and result-provenance completeness. The embedded concurrency-stage `throttleCount` contains only
provider throttles; agent-slot failures remain in the scheduler report's `capacityFailureCount`.

The embedded `stageMetrics` object conforms to the existing image-production concurrency-stage
contract only after every target has a terminal outcome and complete timing makes the calculation
meaningful. A capacity-stopped wave retains its capacity evidence but leaves `stageMetrics`, image
timing, speedup, and efficiency null when no image result supports them. Queue delay remains null
unless a future provider exposes an independently bindable backend admission timestamp.

This report is intentionally not merged into `review/evaluation.json` automatically. The
orchestrator and human reviewer must first determine whether the wave is valid, visually
comparable, and eligible for the next ladder stage.

The plan completion checker independently scans scheduler runs before accepting concurrency
evidence. A run is eligible only when its preflight was exact and gate-authorized, its report is
complete with requested concurrency equal to measured effective concurrency, every job was
dispatched and reached a terminal outcome, provenance is complete, and capacity, provider,
timeout, malformed-output, duplicate-ID, path-conflict, missing-result, and integration counts are
zero. Gate prerequisite run IDs must themselves resolve to eligible earlier runs. Legacy v1
measurements may preserve independently valid 2- and 3-worker evidence, but 4, 6, 8, and 12 count
only from eligible scheduler reports.

A final scale recommendation uses schema `affinity-scale-recommendation-v2`. It binds every source
run to both its preflight and report by run ID, repository path, and canonical SHA-256; its declared
level set must exactly equal the eligible scheduler level set. Its Scale endpoint must likewise bind
either an eligible completed 16-worker report or a gate-authorized, collision-free 16-worker
capacity-blocked preflight. Prose or a resolved historical scheduler note cannot substitute for
these artifacts.
