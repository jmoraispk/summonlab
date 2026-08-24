create table if not exists summonlab_runtime_metadata (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

comment on table summonlab_runtime_metadata is
  'Versioned runtime metadata. Domain event tables arrive with the deterministic engine.';
