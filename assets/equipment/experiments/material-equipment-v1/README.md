# Material equipment production v1

Status: **planning only**. This directory reserves collision-safe candidate, provenance-result, and
human-review paths for the canonical material Equipment wave. It contains no generated, approved,
or runtime images.

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
state. “One run” means the intended future runner can resume one logical production run; it does not
mean 161 simultaneous workers. Its scheduler intent uses a dependency-aware ready queue with a
configured ceiling of 16 workers and reserves one available task slot for orchestration. It may
probe ceilings of 2, 4, 8, 12, and 16, admitting only what current capacity supports rather than
requiring an exact wave size.

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
Before image production, Equipment needs its own approved visual profile and local job runner with
strict schema reading, reference routing, prompt rendering, exclusive persistence, review receipts,
an append-only run journal, and result verification under this directory. The template must then be
copied into a run-specific immutable plan and authorized by a separate hash-bound activation
artifact. Provider capacity must also be verified. None of that activation state is embedded here.

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
