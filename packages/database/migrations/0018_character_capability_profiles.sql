alter table summonlab_proof_runs
  add column if not exists capability_profile jsonb;

alter table summonlab_proof_runs
  add column if not exists character_schema_version text not null default 'character-v1';
