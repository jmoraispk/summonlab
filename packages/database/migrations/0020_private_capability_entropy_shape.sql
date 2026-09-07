-- Keep private derivation entropy canonical at rest without rewriting legacy null rows.
alter table summonlab_proof_runs
  add constraint summonlab_proof_runs_capability_entropy_shape
  check (capability_entropy is null or capability_entropy ~ '^[0-9a-f]{64}$');
