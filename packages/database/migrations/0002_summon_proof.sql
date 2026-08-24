create table if not exists summonlab_proof_runs (
  run_id uuid primary key,
  story_envelope_id text not null default 'first-ember-v1'
    check (story_envelope_id = 'first-ember-v1'),
  control_mode text not null
    check (control_mode in ('autonomous', 'random', 'wait', 'countdown')),
  directive text not null default '',
  recipe jsonb not null,
  manifest jsonb not null,
  mind jsonb not null,
  manifest_hash text not null check (manifest_hash ~ '^[a-f0-9]{64}$'),
  first_observation text not null,
  first_line text,
  destination text check (destination in ('kitchen', 'training-ground')),
  story_branch text,
  arrived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((destination is null and first_line is null and story_branch is null)
    or (destination is not null and first_line is not null and story_branch is not null))
);

create table if not exists summonlab_proof_events (
  event_id uuid primary key,
  run_id uuid not null references summonlab_proof_runs(run_id) on delete cascade,
  sequence integer not null check (sequence > 0),
  event_type text not null check (event_type ~ '^[a-z][a-z0-9.]{2,99}$'),
  summary text not null,
  decision_source text not null,
  payload jsonb not null,
  event_hash text not null check (event_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (run_id, sequence)
);

create index if not exists summonlab_proof_events_run_sequence
  on summonlab_proof_events(run_id, sequence);

comment on table summonlab_proof_runs is
  'Phase 1 summon-to-choice proof. Recipe and manifest hash are replay identity truth.';

comment on table summonlab_proof_events is
  'Append-only readable evidence for summon, observation, autonomous choice, branch, and arrival.';
