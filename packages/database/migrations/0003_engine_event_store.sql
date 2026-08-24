create table if not exists summonlab_engine_runs (
  run_id uuid primary key references summonlab_proof_runs(run_id) on delete cascade,
  seed text not null,
  content_version text not null,
  status text not null check (status in ('active', 'game_over', 'archived')),
  version integer not null check (version >= 0),
  event_cursor integer not null check (event_cursor > 0),
  entropy_cursor integer not null check (entropy_cursor >= 0),
  simulated_at timestamptz not null,
  state_hash text not null check (state_hash ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz not null default now()
);

create table if not exists summonlab_engine_commands (
  command_id uuid primary key,
  run_id uuid not null references summonlab_engine_runs(run_id) on delete cascade,
  expected_version integer not null check (expected_version >= 0),
  command_type text not null check (command_type ~ '^[a-z][a-z0-9.]{2,99}$'),
  command jsonb not null,
  correlation_id uuid not null,
  accepted_sequence integer not null check (accepted_sequence > 0),
  created_at timestamptz not null default now(),
  unique (run_id, accepted_sequence)
);

create table if not exists summonlab_engine_events (
  event_id uuid primary key,
  run_id uuid not null references summonlab_engine_runs(run_id) on delete cascade,
  sequence integer not null check (sequence > 0),
  schema_version integer not null check (schema_version > 0),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9.]{2,99}$'),
  simulated_at timestamptz not null,
  actor_id uuid,
  command_id uuid not null,
  causation_id uuid,
  correlation_id uuid not null,
  source jsonb not null,
  seed_cursor integer not null check (seed_cursor >= 0),
  before_state_hash text not null check (before_state_hash ~ '^[a-f0-9]{64}$'),
  after_state_hash text not null check (after_state_hash ~ '^[a-f0-9]{64}$'),
  content_version text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (run_id, sequence),
  unique (run_id, command_id)
);

create table if not exists summonlab_engine_snapshots (
  run_id uuid not null references summonlab_engine_runs(run_id) on delete cascade,
  event_cursor integer not null check (event_cursor > 0),
  version integer not null check (version >= 0),
  state jsonb not null,
  state_hash text not null check (state_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  primary key (run_id, event_cursor)
);

create index if not exists summonlab_engine_events_run_sequence
  on summonlab_engine_events(run_id, sequence);

create index if not exists summonlab_engine_snapshots_run_cursor
  on summonlab_engine_snapshots(run_id, event_cursor desc);

comment on table summonlab_engine_events is
  'Canonical append-only engine stream. Exact replay verifies the hash chain.';

comment on table summonlab_engine_snapshots is
  'Materialized engine state after each accepted event for fast reads and concurrency checks.';
