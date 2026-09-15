# Affinity image concurrency wave scheduler

The affinity wave scheduler is a collision-safe orchestration and reporting layer for the
`summonlab-image-production` skill. It does **not** spawn agents, call the image tool, update the
review catalog, or update `review/evaluation.json`. The primary agent remains the only dispatcher
and aggregate owner.

The scheduler closes four gaps in the affinity experiment:

- it records requested concurrency separately from the capacity admitted by the running task;
- it prevents an 8-, 12-, or 16-worker stage from silently running as a lower-concurrency stage;
- it gives the orchestrator a bounded dispatch decision and enforces configured technical-failure
  stop rules in an append-only event journal;
- it derives candidate, retry, timing, speedup, efficiency, and failure metrics from strict result
  records without inventing metrics when no image job completed.

## Owned evidence

Each run owns a new directory and may never replace an earlier run:

```text
assets/enemies/experiments/affinity-workflow-v1/wave-runs/<run-id>/
├── preflight.json
├── events-v3/
│   └── <sequence>-<event-id>.json
└── report.json
```

Preflight, event, and report files use exclusive creation. Target candidate and result paths are
also checked for collisions before dispatch. Use a new run ID and versioned target outputs for
every measurement; never reuse completed targets.

The current reserved exact-concurrency allocation is
`assets/enemies/experiments/affinity-workflow-v1/review/wave-plans/exact-concurrency-final-and-breadth-v2.json`.
It is a strictly validated planning artifact with `executable: false`; it cannot be passed to
`preflight`. It reserves unique 2/4/6/8/12/16 coordinates, records every prerequisite gate, and
includes the 14 additional v4/v5 sentinels needed after the two separate breadth canaries consume
two base targets. Validate it without activating manifests or making image calls:

```bash
pnpm check:affinity-wave-allocation-v2
```

The 14 future sentinel manifests are derived from passed final-controlled sources and accepted
visual rules. They must exist before the allocation's Load-12 and Scale-16 jobs can be materialized;
they cannot depend on a completed Breadth round because those later stages contain 14 of the 24
Breadth targets. Prepare and publish them without generating an image:

```bash
pnpm report:affinity-concurrency-sentinel-readiness -- --actor <actor>
pnpm activate:affinity-concurrency-sentinels -- \
  --actor <same-actor> \
  --acknowledge-live-sentinel-activation
```

Activation rechecks every prerequisite under an exclusive lock, refuses all path collisions, and
writes a hash-bound 28-manifest receipt last. It does not grant dispatch permission. Breadth-8
promotion still gates Load-12 dispatch, and eligible Load-12 promotion still gates Scale-16.

## Wave plan

Do not hand-author a production plan. Materialize the exact named workload from the reviewed allocation,
its current dispatch gate, and the current target and assignment manifests:

```bash
pnpm materialize:affinity-wave-plan -- \
  --allocation assets/enemies/experiments/affinity-workflow-v1/review/wave-plans/exact-concurrency-final-and-breadth-v2.json \
  --allocation-sha256 88e2525fb10c1cc6f7c8749d461cf3730e0c5d904b2514d500b5c4d3638222f1 \
  --workload <final-canary|final-pilot|final-controlled-a|final-controlled-b|final-controlled-c|breadth-canary|breadth|load|scale> \
  --gate assets/enemies/experiments/affinity-workflow-v1/review/gates/<gate>.json \
  --gate-sha256 <canonical-json-sha256> \
  --run-id <fresh-run-id>
```

The guarded command verifies the reviewed allocation path and hash, exact workload job set, current
gate and every gate evidence binding, current target and assignment manifests, and a valid
activation receipt for any future-sentinel jobs. It refuses an existing run directory and writes
the v2 plan exclusively to
`assets/enemies/experiments/affinity-workflow-v1/review/wave-plans/materialized/<run-id>.json`.
It does not create the run directory, dispatch an agent, or call the image provider. The v2 plan
binds the allocation, gate, optional sentinel receipt, and canonical hash of every manifest.

The following v1 document is a schema illustration for historical plans; new production plans
use the materialized v2 contract:

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
preceding eligible scheduler runs, and binds every source JSON path to its verified canonical
SHA-256. Legacy v1 gates remain readable only as blocked historical evidence: their unverified path
lists can never authorize a fresh or ready preflight. Legacy plans without a gate pointer may
still reproduce truthful `blocked-capacity` evidence, but they can never become `ready`; an
otherwise runnable legacy plan becomes `blocked-gate`. The event journal also rejects every event
for a non-ready preflight, so bypassing `next` cannot bypass the gate.

Gate booleans and evidence paths are not operator inputs. Derive a v2 gate from the current source
artifacts with the guarded writer:

```bash
# Check the initial Normal canary gate without writing.
pnpm check:affinity-dispatch-gate -- --profile normal

# After guarded final activation, publish the final-controlled Canary gate.
pnpm write:affinity-dispatch-gate -- --profile final

# After an eligible Controlled-6 run and passed final round, publish Breadth-8.
pnpm write:affinity-dispatch-gate -- --profile breadth \
  --prerequisite-run <controlled-6-run-id>

# Exact later stages: 4, 6, 12, or 16.
pnpm write:affinity-dispatch-gate -- --profile load --concurrency 16 \
  --prerequisite-run <load-12-run-id>
```

The writer recomputes each profile's fixed evidence chain and publishes with exclusive,
no-overwrite semantics. Final binds the verified activation receipt and all 48 activated
manifests. Breadth binds a passed final-controlled round. Load-12 binds the eligible Breadth-8
promotion, and Scale-16 binds the eligible Load-12 promotion. `--check` is zero-write and exits
nonzero until the exact expected gate already exists.

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
| Gray Wolf | Water | Wind |
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

Status: the legacy event-v2 loop below is retained only as historical behavior and must not be used
for a new concurrency measurement. Its `job-dispatched` event conflates claiming a target with an
admitted worker start. The event-v3 state machine and safe append recorder are implemented and use
`job-claimed`, then `worker-started`, then one terminal outcome. Only `worker-started` contributes
to peak or effective concurrency. Wiring v3 into `next`, the operator CLI, report v4, and completion
eligibility is required before the first live workload; until then, materialization may prepare a
plan but live dispatch remains closed.

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
remain active. The operator submits the stable v1 event-request shape, while the recorder persists
v2 evidence with a lock-assigned contiguous sequence, recording timestamp, and canonical preflight
hash. Replay follows that sequence rather than filesystem order or occurrence-time ties; a v2
preflight rejects legacy, mixed-version, gapped, backdated, or differently bound journals.

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

Report v3 also binds the exact preflight, event journal, target and assignment manifests, result
manifests, and retained candidate
image bytes by repository path and cryptographic hash. Completion does not trust those bindings as
claims: it rereads the journal and manifests, verifies each execution and retained image, rebuilds
the report at its recorded timestamp, and requires canonical equality with the stored report. A
missing, changed, reordered, or hand-authored source therefore makes the run ineligible.

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
measurements may preserve independently valid 2- and 3-worker evidence, but 4, 6, 8, 12, and 16
count only from eligible scheduler reports.

A final scale recommendation uses schema `affinity-scale-recommendation-v3`. It requires one
stage-correct eligible scheduler run at each of 2, 4, 6, 8, and 12 effective workers. A completed
Scale-16 run adds the sixth measured level; otherwise a gate-authorized, collision-free
capacity-blocked Scale-16 preflight must cite an eligible Load-12 predecessor. The recommendation
must select one of the measured levels, and 16 may be selected only from a completed Scale run.
Writing the artifact requires an explicit human-decision acknowledgment plus concrete production
and fallback strategies:

```bash
pnpm check:affinity-scale-recommendation
pnpm finalize:affinity-scale-recommendation -- \
  --acknowledge-human-decision \
  --recommended <2|4|6|8|12|16> \
  --production-strategy "<measured production policy>" \
  --fallback-behavior "<capacity or quality fallback>"
```

Prose, a provisional recommendation, or a resolved historical scheduler note cannot substitute
for the hash-bound artifact.
