# Equipment Image Production Readiness Design

Status: **owner-approved for implementation planning**

Date: 2026-09-01

## Purpose

Prepare one safe, resumable production run for the 161 canonical material Equipment images under
`assets/equipment/experiments/material-equipment-v1`. The production layer must use every currently
available worker up to a total Equipment concurrency of 16, preserve full-set consistency for
Armour, and remain isolated from active monster-image production.

This design turns the existing manifest and allocation template into executable, auditable job
packets. It does not generate, approve, or promote any image by itself.

## Approved decisions

- Equipment production is self-contained under `assets/equipment` and `tools/equipment-*`.
- The active enemy image-production contracts, skill, scheduler, persistence helper, assets, and
  catalogs remain untouched.
- The 161 targets form one logical, resumable production run.
- The runner admits every currently available worker up to 16. It does not reserve capacity or
  voluntarily throttle because unrelated work is active.
- The initial ready queue contains 77 jobs: 56 standalone items and 21 complete Armour sets.
- Each complete Armour set is shown on a featureless charcoal display form.
- A human-accepted, hash-bound full-set receipt unlocks exactly that set's Head, Torso, Legs, and
  Boots jobs.
- The 84 dependent piece jobs use their accepted full-set candidate as the authoritative first
  reference.
- All material studies show Standard craftsmanship (`+0`). Material rank is the only rank-bearing
  visual variable in this wave.
- Candidates, human approvals, approved sources, and runtime exports remain separate states.

## Why the shared monster pipeline is not used

The installed `summonlab-image-production` skill and its supporting contracts are enemy-specific:

- targets require enemy species, affinities, threat, anatomy, and battlefield-duty fields;
- prompt rendering produces character and enemy language;
- candidate, result, and persistence paths are restricted to `assets/enemies/experiments`;
- the Affinity scheduler and journal have stage semantics and target-count limits that do not fit
  this 161-job dependency graph.

Making Equipment appear compatible would pass through some shallow checks while violating the
documented contract and rendering the wrong prompt. Generalizing those shared components while a
monster run is active would also introduce unnecessary collision risk. The Equipment layer may
reuse proven patterns, but it must not import enemy-specific behavior or mutate its files.

## Goals

1. Define one approved Equipment visual profile and exact reference routing.
2. Strictly validate Equipment targets, assignments, results, review receipts, run plans, and run
   events.
3. Materialize the 77 root job packets only after the visual profile is accepted.
4. Materialize each group of four piece packets only after its full-set receipt is verified.
5. Persist candidates and provenance exclusively beneath the existing reserved paths.
6. Support one append-only, replayable run across process and task restarts.
7. Fill available worker capacity up to 16 without an artificial capacity ladder.
8. Stop safely on collisions, partial output, invalid evidence, or repeated technical failures.
9. Make readiness, production, review, and later promotion independently auditable.

## Non-goals

- No generated Equipment image in this readiness implementation.
- No runtime Equipment catalog or application integration.
- No approved-source or runtime-asset promotion.
- No monster-derived Equipment targets.
- No Tools, Accessories, Potions, Food, or craftsmanship variants.
- No modification of shared image-production contracts, the installed production skill, Affinity
  scheduling, or enemy assets.
- No repository process that attempts to create Codex workers itself.
- No automatic human approval or approval inferred from file existence.

## Visual profile

The versioned profile is `equipment-material-visual-profile-v1`.

### Shared style

- Premium realistic painterly dark fantasy.
- Grounded medieval construction and structurally plausible joins, fastenings, grips, and weight.
- Honest surface wear and material response.
- Narrow controlled highlights and restrained local magic.
- Midnight-charcoal presentation ground with cold key light and a restrained warm rim.
- No text, labels, UI, border, frame, logo, watermark, published-character resemblance, or extra
  gear.
- No generic rarity rainbow, gold inflation, oversized silhouettes, full-object glow, or ornament
  used as a substitute for material identity.

Material identity uses one or two physical construction cues plus, where the material calls for it,
one bounded supernatural behavior. Palette alone never satisfies the material criterion.

### Presentation modes

| Mode | Canvas | Composition |
| --- | --- | --- |
| Isolated item or piece | 1024×1024 PNG | One complete object or required pair, neutral three-quarter view, entirely inside an 8% safe margin |
| Complete Armour set | 1024×1536 PNG | One featureless charcoal display form, full body visible, exactly Head, Torso, Legs, and Boots readable together |
| Dependent Armour piece | 1024×1024 PNG | Isolated matching object derived from the accepted complete-set reference |

The display form proves silhouette, coverage, overlap, load, and interaction among the four slots
without introducing a hero identity. Dependent piece jobs preserve the accepted set rather than
redesigning it. `Legs` means the complete paired or lower-body item, and `Boots` means one matching
pair.

### Equipment-class defaults

These are visual authoring defaults, not new gameplay mechanics:

- Sword: practical hand-and-a-half straight sword.
- Dagger: compact single-hand fighting dagger.
- Spear: long two-hand spear with a dominant rank-bearing metal head and subordinate neutral
  seasoned-wood shaft.
- Bow: practical recurved bow.
- Axe: practical one-hand bearded axe.
- Mace: practical one-hand flanged mace.
- Shield: medium heater shield.
- Staff: full-length, wood-led staff with subordinate fittings and no mandatory orb.
- Heavy Armour: metal-dominant articulated protection.
- Light Armour: hide- or scale-dominant mobile protection.
- Robes: cloth-dominant layered clothing.

Secondary materials may be visually necessary, but stay neutral and subordinate; they never assert
a second rank.

### Style reference

The profile may route
`assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png` with SHA-256
`9c726ad578a6a6d8ed510a7e7117443ce471e553d233b36a8c20afedddd1040d` only for painterly finish,
honest wear, material response, lighting, floor, and midnight background. It explicitly forbids
transferring Remy, her body, clothing, hammer, or design.

The reference is currently a candidate. Accepting the Equipment profile authorizes only this narrow
reference route for Equipment experiments; it does not promote the reference or any hero asset.

### Authoring criteria

Every target requires explicit findings for:

1. complete canvas and safe framing;
2. expected object or component count;
3. equipment-class silhouette;
4. structural plausibility;
5. rank-bearing material dominance;
6. material-cue strength;
7. bounded rank behavior;
8. profile style cohesion;
9. negative-constraint safety.

Dependent Armour pieces additionally require exact continuity with their accepted source for
material, silhouette language, palette, trim, fastenings, wear, ornament, and slot boundary.

## Repository layout

Static, generated, and run evidence stay beneath the existing Equipment production root:

```text
assets/equipment/experiments/material-equipment-v1/
  manifest.json
  allocation-plan.json
  visual-profile/
    profile.json
    acceptance.json
  schemas/
    *.schema.json
  targets/<rank>/<material>/<artifact>-v1.json
  assignments/<rank>/<material>/<artifact>-v1.json
  candidates/<rank>/<material>/<artifact>-v1.png
  results/<rank>/<material>/<artifact>-v1.json
  reviews/<rank>/<material>/<artifact>-v1.json
  runs/<run-id>/
    plan.json
    activation.json
    events/<sequence>-<event-id>.json
    reports/<report-id>.json
```

Root targets and assignments are generated only after profile acceptance. Dependent piece packets
do not exist until their source receipt supplies the exact accepted candidate hash.

## Equipment-local components

### Strict contracts

`tools/equipment-image-production-contract.ts` owns strict schemas for:

- visual profile and profile acceptance;
- target and assignment;
- generation attempt and result;
- Armour source-review receipt;
- immutable run plan and activation receipt;
- journal requests and sequenced journal events;
- derived readiness and run reports.

Every repository path is relative POSIX syntax, contained under the Equipment production root, and
validated against the specific artifact role. Schemas reject unknown fields.

### Packet and prompt library

`tools/equipment-image-production-lib.ts`:

- reads and hash-binds the manifest, allocation plan, accepted profile, and applicable full-set
  receipt;
- materializes deterministic targets and assignments;
- renders the exact Equipment prompt for standalone, full-set, and dependent-piece jobs;
- validates ordered reference paths and hashes;
- verifies result structure, prompt hash, attempt linkage, findings, candidate hash, dimensions,
  ownership, and timing;
- proves the 77/84 partition and the 21 four-child review gates.

Assignments permit exactly one candidate and one provenance result. They forbid the manifest,
allocation, profile, reviews, run files, other jobs' outputs, Equipment aggregates, shared
contracts, installed skills, and all enemy assets.

### Equipment persistence

`tools/persist-equipment-image-production-output.ts` accepts only the exact image source returned by
generation and only a destination reserved by the matching assignment. It enforces:

- Equipment-root containment;
- no symbolic-link ancestors;
- supported PNG input or supported near-match normalization;
- declared aspect ratio and exact final dimensions;
- immediate collision recheck;
- `open(..., "wx")` exclusive creation;
- source and retained byte hashes in the returned receipt.

The enemy persistence helper is not changed or called.

### Run controller

One Equipment CLI/library exposes preparation and run-state operations such as export, preflight,
activate, claim-next, record-start, record-terminal, accept-set-source, reconcile, and report. The
implementation may choose concise subcommand names, but every state change uses the same strict
library and append-only evidence.

The controller never invokes image generation or spawns Codex agents. It exclusively claims ready
jobs and emits complete worker packets. The root Codex orchestrator supplies current free worker
slots, starts workers, and records their lifecycle through the controller.

### Worker protocol

Each claimed packet tells one Codex worker to use the general image-generation capability, not the
enemy-specific production skill. The worker:

1. validates its exact Equipment target and assignment with the Equipment CLI;
2. inspects every ordered reference for only its declared purpose;
3. submits the byte-exact Equipment prompt rendered by the CLI;
4. generates and inspects one image with no corrective retry in this v1 material wave;
5. persists only the exact returned source through the Equipment persistence helper;
6. writes only its assigned provenance result;
7. verifies that result with the Equipment CLI; and
8. reports its terminal status and owned paths to the orchestrator.

The worker cannot edit its target, assignment, profile, review evidence, run journal, allocation,
manifest, aggregate, runtime catalog, or another job's output. The orchestrator records lifecycle
events after independently checking the worker's returned evidence.

## Activation and immutable run identity

Activation exclusively creates a run-specific plan and then writes its activation receipt last.
The activation binds:

- run ID and allocation-plan hash;
- manifest hash;
- accepted visual-profile and profile-acceptance hashes;
- contract, renderer, verifier, persistence, and journal versions;
- every initially materialized target and assignment hash;
- all reserved candidate, result, review, and run paths;
- the configured maximum Equipment concurrency of 16.

The reusable allocation template remains regenerable planning evidence. Once activated, the
run-specific plan is immutable and never overwritten.

Preflight scans every reserved worker path. A complete, verified terminal output may be reconciled;
an unexpected or partial candidate/result pair blocks activation or resume.

## Scheduling and concurrency

One logical run uses a dependency-aware ready queue. Rank waves are stable scheduling priority, not
cross-rank gates.

The orchestrator supplies `availableWorkerSlots`, meaning idle slots available for new workers at
that moment. New claims are limited by:

```text
min(
  16 - activeEquipmentWorkers,
  availableWorkerSlots,
  readyUnclaimedJobs
)
```

There is no reserved orchestrator slot, capacity-probe ladder, or voluntary reduction for unrelated
parallel work. Other tasks matter only when they physically consume a worker slot. Provider
capacity is handled as a runtime failure condition, not an activation blocker.

The first ready queue contains all 77 roots. As accepted full-set receipts arrive, each receipt adds
its four children to the same run's ready queue. Review can overlap continued root production, so
accepted sets need not wait for all 77 roots to finish.

## Journal and resume behavior

Run state is derived by replaying exclusively created, monotonically sequenced event files. The
minimum lifecycle distinguishes:

- job claimed;
- claim released before worker start;
- worker started;
- candidate or revise result verified;
- terminal technical failure;
- full-set review accepted or rejected;
- dispatch epoch paused or resumed.

A pre-start claim may be released if agent admission fails and reclaimed later. A started worker is
never expired by time-to-live. Crash reconciliation either verifies the exact candidate/result pair
and appends the correct terminal event, or records an operator-confirmed failure. Partial output is
a blocker and is never silently replaced.

## Review receipts and Armour unlocking

File existence never passes a review gate. An accepted receipt must bind:

- receipt schema and unique receipt ID;
- run, plan, manifest, and visual-profile hashes;
- gate and full-set source target IDs;
- canonical source-result hash;
- exact candidate byte SHA-256;
- decision `accepted`;
- reviewer identity and timestamp.

The controller verifies the source target is a candidate, the stored candidate matches the bound
hash, and the gate owns exactly four declared children. Only then does it materialize those child
targets and assignments, placing the accepted source first in their ordered references.

Rejected receipts remain evidence but unlock nothing. Individual pieces receive separate later
review evidence and are never self-approved by their producing worker.

## Failure policy

- A collision, invalid hash, schema mismatch, path escape, symbolic-link ancestor, or partial output
  stops that operation without a write.
- Workers perform no synchronized retry after provider throttling, capacity failure, timeout, or
  persistence failure.
- Three technical failures in one dispatch epoch pause new claims and drain active workers. The same
  immutable run may resume in a later epoch after backoff or operator review.
- A pre-start admission refusal releases its claim and is not a technical image failure.
- A visual `revise` result is preserved as candidate evidence but does not become approved.
- Existing candidate/result paths are never overwritten. A deliberate later regeneration requires
  a new versioned target and new paths.

## Readiness definition

The run is ready to start only when all of the following are true:

1. the profile and profile acceptance validate and hash-bind every static reference;
2. all Equipment schemas and generated root packets match their deterministic exporters;
3. the run plan and receipt-last activation validate;
4. all 77 root packet references and output reservations pass collision preflight;
5. the Equipment prompt renderer and result verifier pass exact-byte/hash fixtures;
6. persistence passes path-escape, symlink, collision, format, and near-match tests;
7. journal replay, claim release, crash reconciliation, and the three-failure circuit breaker pass;
8. no shared enemy, runtime catalog, installed skill, or unrelated visual-domain file is changed.

Readiness does not require all 84 child packets, because they cannot be truthfully materialized
before their accepted source hashes exist.

## Verification strategy

- Unit tests for every strict schema and invariant.
- RED/GREEN tests for target and assignment generation across representative metal, wood,
  hide/scale, and cloth targets.
- Exact prompt snapshots for standalone, full-set, and dependent-piece modes.
- Hash and reference-order verification tests.
- Filesystem tests for containment, symlink refusal, collision refusal, exclusive writes, and
  partial-output reconciliation.
- Journal replay tests covering claim, release, start, terminal, pause, resume, and crash recovery.
- Review-receipt tests proving that existence, rejection, stale hashes, or a wrong source cannot
  unlock children.
- End-to-end dry activation proving 77 initially ready jobs, 84 gated jobs, 21 gates, 161 total
  jobs, and a maximum Equipment concurrency of 16.
- Existing Equipment manifest checks, wiki validation, TypeScript, lint, and repository tests.

## Delivery sequence

1. Implement strict contracts, the deterministic profile candidate and schemas, the prompt
   renderer, and root-packet generation logic without materializing runnable packets.
2. Present the exact visual profile and hash-bound acceptance artifact for owner review.
3. After profile acceptance, materialize and verify the 77 root target/assignment packets.
4. Implement Equipment persistence and result verification.
5. Implement immutable activation, journal replay, readiness, claiming, review receipts, and
   reconciliation.
6. Run a zero-generation dry activation and concurrency simulation.
7. After readiness passes, start the one logical run with up to 16 available workers.
8. Review complete sets as they arrive; accepted receipts continuously release their four dependent
   pieces.

Each implementation batch remains Equipment-owned, independently reviewable, committed, and pushed.

## Integration boundary

No integration request is needed for the readiness layer because it does not alter shared
contracts, runtime catalogs, or enemy production. A future request to make the generic installed
image-production skill support Equipment would be a separate shared integration project and is not
required to execute this plan.
