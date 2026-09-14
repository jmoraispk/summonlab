create table if not exists summonlab_exploration_attempts (
  attempt_id uuid primary key,
  run_id uuid not null references summonlab_proof_runs(run_id) on delete cascade,
  floor_id text not null,
  content_version text not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('exploring', 'encounter', 'returning', 'extracted', 'defeated')),
  version integer not null check (version >= 0),
  state jsonb not null,
  active_request_id uuid,
  active_request_hash text check (active_request_hash is null or active_request_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((active_request_id is null) = (active_request_hash is null)),
  check ((status = 'encounter') = (active_request_id is not null))
);

create unique index if not exists summonlab_exploration_attempts_one_active_per_run
  on summonlab_exploration_attempts(run_id)
  where status in ('exploring', 'encounter', 'returning');

create table if not exists summonlab_exploration_receipts (
  receipt_id uuid primary key,
  attempt_id uuid not null references summonlab_exploration_attempts(attempt_id) on delete cascade,
  request_id uuid not null,
  receipt_hash text not null check (receipt_hash ~ '^[a-f0-9]{64}$'),
  outcome text not null check (outcome in ('victory', 'defeat')),
  created_at timestamptz not null default now(),
  unique (attempt_id, request_id)
);

comment on table summonlab_exploration_attempts is
  'One authoritative Tower exploration attempt bound to the singleton campaign run.';

comment on table summonlab_exploration_receipts is
  'Idempotent encounter settlements for authoritative Tower exploration attempts.';
