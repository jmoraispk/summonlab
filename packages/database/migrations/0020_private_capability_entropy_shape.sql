-- Keep private derivation entropy canonical at rest without rewriting legacy rows.
-- NOT VALID preserves pre-constraint receipts while still checking every future write.
-- Databases without historical violations can validate the complete table immediately.
do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'summonlab_proof_runs'::regclass
      and conname = 'summonlab_proof_runs_capability_entropy_shape'
  ) then
    alter table summonlab_proof_runs
      add constraint summonlab_proof_runs_capability_entropy_shape
      check (capability_entropy is null or capability_entropy ~ '^[0-9a-f]{64}$')
      not valid;
  end if;

  if not exists (
    select 1
    from summonlab_proof_runs
    where capability_entropy is not null
      and capability_entropy !~ '^[0-9a-f]{64}$'
  ) and exists (
    select 1
    from pg_constraint
    where conrelid = 'summonlab_proof_runs'::regclass
      and conname = 'summonlab_proof_runs_capability_entropy_shape'
      and not convalidated
  ) then
    alter table summonlab_proof_runs
      validate constraint summonlab_proof_runs_capability_entropy_shape;
  end if;
end
$migration$;
