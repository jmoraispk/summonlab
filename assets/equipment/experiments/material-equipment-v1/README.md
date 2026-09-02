# Material equipment production v1

Status: **ready for deliberate activation**. The exact visual profile hash
`f773bdaab246314d53a596c11404a9e242826838926ecb8121948b375c267d5a` is owner-accepted, and the
77 root targets plus 77 assignments are materialized and deterministic. No live run, journal,
review receipt, child packet, candidate, result, approved source, runtime export, or generated image
has been created.

The checked [manifest](manifest.json) expands the four material ladders into 161 image targets. The
adjacent [allocation plan](allocation-plan.json) binds every target into one intended, resumable
production run:

- 140 isolated Equipment item images;
- 21 full-set Armour consistency images;
- seven rank waves, each containing 23 targets.

The run begins with 77 ready jobs: 56 standalone items and 21 complete Armour sets. The remaining
84 jobs are the four separated pieces for each set. Rank waves are scheduling priority, not hard
cross-rank gates.

## Armour dependency gate

Every Armour material has exactly one ordered five-target sequence:

1. complete set;
2. Head;
3. Torso;
4. Legs;
5. Boots.

The four pieces declare the complete-set target through `dependsOnTargetId`. A piece may not enter
generation until human review accepts that complete-set candidate as its consistency source. The
source image is production evidence rather than a fifth equippable item.

Weapons, Shield, and Staff do not depend on an Armour source and do not need to match one.

## One-run scheduling intent

The allocation plan is a **non-executable template**, not dispatch authorization or persisted run
state. “One run” means the controller can resume one logical production run; it does not mean 161
simultaneous workers. Its dependency-aware ready queue admits
`min(16 - activeEquipmentWorkers, availableWorkerSlots, readyUnclaimedJobs)`. It reserves no worker
slot and does not voluntarily throttle because unrelated work exists. Unrelated work matters only
when it reduces the root-supplied `availableWorkerSlots` value.

After three technical failures in one dispatch epoch, the run stops new starts, drains active work,
and can resume the same immutable plan later with backoff. It does not launch synchronized retries.
Each future worker owns exactly one candidate and one provenance result. Human review owns review
evidence, and accepting a hash-bound full-set source unlocks exactly its four pieces. Merely finding
a file at the reserved review path never passes the gate.

## Lifecycle boundary

All manifest entries begin as `planned`. Their paths are reservations only:

- `candidates/` is for unapproved generated images;
- `results/` is for generation and persistence provenance;
- `reviews/` is for human review evidence.

The manifest deliberately reserves no approved-source or runtime-export path. Approval and runtime
promotion are later integration actions and must not be inferred from generation success.

## Generation boundary

The current `summonlab-image-production` target contract is enemy-specific and does not accept this
Equipment manifest. Do not dispatch these entries through that contract. The Equipment plan also
forbids writes to `assets/enemies`, the shared image-production contract, and the installed skill.
Equipment now has its own accepted visual profile and local controller with strict schema reading,
reference routing, prompt rendering, exclusive persistence, review receipts, append-only journal,
reconciliation, and result verification. The allocation remains inert until an operator creates a
run-specific immutable plan and receipt-last activation. The controller never calls image
generation and never creates workers.

## Exact operator workflow

The state transition is deliberately one-way and evidence-bound:

```text
profile candidate → exact owner acceptance → 77 root packets
zero-write readiness → immutable activation → claim up to 16
worker generation → result verification → terminal journal event
human full-set receipt → four child packets → continued claims
candidate review remains separate from approval and runtime promotion
```

Run every command from the repository root with Node 24.14.1. Profile export is deterministic
maintenance; acceptance was a one-time owner action and must not be repeated over the existing
exclusive artifact.

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/export-equipment-image-profile.ts
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/export-equipment-image-profile.ts --check

EQUIPMENT_APPROVED_PROFILE_SHA256=f773bdaab246314d53a596c11404a9e242826838926ecb8121948b375c267d5a
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts accept-profile \
    --reviewer owner \
    --acknowledge-profile-sha256 "$EQUIPMENT_APPROVED_PROFILE_SHA256"

PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts check-root-packets
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts report-readiness
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts simulate --available-worker-slots 16
```

The acceptance command above records provenance for the already accepted hash; it is shown so the
workflow is auditable, not as a rerunnable command. `report-readiness`, `simulate`, and `report`
write zero files. The simulation uses in-memory events, unlocks all 84 child jobs in fixtures,
exercises the three-failure pause/resume breaker, and generates zero images.

Activation is the explicit start boundary. Do not run this block until the operator intends to
start the live production run:

```bash
EQUIPMENT_RUN_ID=material-equipment-v1-run-001
EQUIPMENT_RUN_CREATED_AT=2026-09-02T01:00:00.000Z
EQUIPMENT_RUN_ACTIVATED_AT=2026-09-02T01:00:01.000Z
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts activate-run \
    --run-id "$EQUIPMENT_RUN_ID" \
    --created-at "$EQUIPMENT_RUN_CREATED_AT" \
    --activated-at "$EQUIPMENT_RUN_ACTIVATED_AT" \
    --activated-by owner

EQUIPMENT_EPOCH_ID=equipment-epoch-001
EQUIPMENT_CLAIM_REQUESTED_AT=2026-09-02T01:01:00.000Z
EQUIPMENT_CLAIM_RECORDED_AT=2026-09-02T01:01:01.000Z
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts claim-next \
    --run-id "$EQUIPMENT_RUN_ID" \
    --available-worker-slots 16 \
    --epoch-id "$EQUIPMENT_EPOCH_ID" \
    --actor root-orchestrator \
    --requested-at "$EQUIPMENT_CLAIM_REQUESTED_AT" \
    --recorded-at "$EQUIPMENT_CLAIM_RECORDED_AT"
```

For one returned claim, copy its exact IDs and paths into task-specific variables. The worker uses
the general image-generation capability, never the enemy production skill. The exact byte source
returned by generation is persisted before the provenance result:

```bash
EQUIPMENT_TARGET_PATH='replace-with-claim-target-path'
EQUIPMENT_ASSIGNMENT_PATH='replace-with-claim-assignment-path'
EQUIPMENT_TARGET_ID='replace-with-claim-target-id'
EQUIPMENT_WORKER_ID='replace-with-claim-worker-id'
EQUIPMENT_CLAIM_ID='replace-with-claim-id'
EQUIPMENT_CANDIDATE_PATH='replace-with-assignment-candidate-path'
EQUIPMENT_RESULT_PATH='replace-with-assignment-result-path'
EQUIPMENT_RESULT_CANONICAL_SHA256='replace-with-verified-result-canonical-sha256'
EQUIPMENT_SOURCE_IMAGE=/absolute/path/to/exact-imagegen-output.png
EQUIPMENT_RESULT_JSON=/absolute/path/to/worker-result.json

PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts validate-packet \
    --target "$EQUIPMENT_TARGET_PATH" --assignment "$EQUIPMENT_ASSIGNMENT_PATH"
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts render-prompt \
    --target "$EQUIPMENT_TARGET_PATH"
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts record-start \
    --run-id "$EQUIPMENT_RUN_ID" --event-id start-001 --actor root-orchestrator \
    --requested-at 2026-09-02T01:02:00.000Z --recorded-at 2026-09-02T01:02:01.000Z \
    --claim-id "$EQUIPMENT_CLAIM_ID" --target-id "$EQUIPMENT_TARGET_ID" \
    --worker-id "$EQUIPMENT_WORKER_ID"
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/persist-equipment-image-production-output.ts \
    --workspace-root "$PWD" --source "$EQUIPMENT_SOURCE_IMAGE" \
    --destination "$EQUIPMENT_CANDIDATE_PATH" --width 1024 --height 1024 \
    --media-type image/png
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts persist-result \
    --target "$EQUIPMENT_TARGET_PATH" --assignment "$EQUIPMENT_ASSIGNMENT_PATH" \
    < "$EQUIPMENT_RESULT_JSON"
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts verify-result \
    --target "$EQUIPMENT_TARGET_PATH" --assignment "$EQUIPMENT_ASSIGNMENT_PATH" \
    --result "$EQUIPMENT_RESULT_PATH"
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts record-terminal \
    --run-id "$EQUIPMENT_RUN_ID" --event-id terminal-001 --actor root-orchestrator \
    --requested-at 2026-09-02T01:10:00.000Z --recorded-at 2026-09-02T01:10:01.000Z \
    --target-id "$EQUIPMENT_TARGET_ID" --worker-id "$EQUIPMENT_WORKER_ID" \
    --status candidate --result-canonical-sha256 "$EQUIPMENT_RESULT_CANONICAL_SHA256"
```

Use `--height 1536` for a complete Armour set. A human decision on a full set accepts it only as
the four children’s consistency source; it does not approve or promote the candidate:

```bash
EQUIPMENT_GATE_ID='replace-with-claim-gate-id'
EQUIPMENT_CANDIDATE_SHA256='replace-with-human-inspected-candidate-sha256'
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts review-armour-source \
    --run-id "$EQUIPMENT_RUN_ID" --gate-id "$EQUIPMENT_GATE_ID" --reviewer owner \
    --reviewed-at 2026-09-02T01:20:00.000Z \
    --accept-candidate-sha256 "$EQUIPMENT_CANDIDATE_SHA256"
```

After a controller crash, inspect reconciliation first without authorization. A complete verified
pair reports one required append; either partial pair blocks; no output preserves the active worker
regardless of elapsed time. Then explicitly authorize only the reported terminal append:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts reconcile \
    --run-id "$EQUIPMENT_RUN_ID" --target-id "$EQUIPMENT_TARGET_ID" \
    --worker-id "$EQUIPMENT_WORKER_ID" --observed-at 2026-09-02T01:30:00.000Z
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts reconcile \
    --run-id "$EQUIPMENT_RUN_ID" --target-id "$EQUIPMENT_TARGET_ID" \
    --worker-id "$EQUIPMENT_WORKER_ID" --observed-at 2026-09-02T01:30:00.000Z \
    --event-id reconcile-terminal-001 --actor root-orchestrator \
    --requested-at 2026-09-02T01:30:00.000Z --recorded-at 2026-09-02T01:30:01.000Z \
    --acknowledge-terminal yes
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts report \
    --run-id "$EQUIPMENT_RUN_ID" --created-at "$EQUIPMENT_RUN_CREATED_AT" \
    --generated-at 2026-09-02T01:31:00.000Z
```

If no output exists, terminal failure requires an exact target, worker, non-empty reason, event
identity, operator, timestamps, and `--acknowledge-operator-confirmed-failure yes`. Reconciliation
appends that evidence and deletes nothing. Started workers are never expired by elapsed time.

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts reconcile \
    --run-id "$EQUIPMENT_RUN_ID" --target-id "$EQUIPMENT_TARGET_ID" \
    --worker-id "$EQUIPMENT_WORKER_ID" --observed-at 2026-09-02T01:30:00.000Z \
    --event-id operator-confirmed-failure-001 --actor owner \
    --requested-at 2026-09-02T01:30:00.000Z --recorded-at 2026-09-02T01:30:01.000Z \
    --operator-confirmed-failure-reason "Worker process was confirmed lost." \
    --acknowledge-operator-confirmed-failure yes
```

Exactly three technical failures require the next journal event to pause new claims. After active
workers drain and operator review or backoff completes, resume with a new epoch ID:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts pause-epoch \
    --run-id "$EQUIPMENT_RUN_ID" --event-id pause-equipment-epoch-001 \
    --actor root-orchestrator --requested-at 2026-09-02T01:40:00.000Z \
    --recorded-at 2026-09-02T01:40:01.000Z --epoch-id equipment-epoch-001 \
    --reason "Three technical failures; drain active Equipment workers."
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/equipment-image-production.ts resume-epoch \
    --run-id "$EQUIPMENT_RUN_ID" --event-id resume-equipment-epoch-002 \
    --actor root-orchestrator --requested-at 2026-09-02T01:50:00.000Z \
    --recorded-at 2026-09-02T01:50:01.000Z --previous-epoch-id equipment-epoch-001 \
    --epoch-id equipment-epoch-002 --reason "Backoff and operator review completed."
```

Generation produces a candidate, not approval. Full-set source acceptance unlocks matching work,
not runtime use. Candidate review, approved-source promotion, and runtime export remain separate
human-controlled stages outside this readiness workflow.

## Deterministic maintenance

Regenerate the manifest and allocation plan after an accepted Equipment vocabulary change:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/export-equipment-material-production.ts
```

Verify that both committed artifacts match the generator:

```bash
PATH=/home/joao/.nvm/versions/node/v24.14.1/bin:$PATH \
  corepack pnpm tsx tools/export-equipment-material-production.ts --check
```
