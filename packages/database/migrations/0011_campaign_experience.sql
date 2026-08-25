create table if not exists summonlab_campaign_runs (
  run_id uuid primary key references summonlab_proof_runs(run_id) on delete cascade,
  campaign_seed text not null check (char_length(campaign_seed) between 1 and 128),
  control_mode text not null check (control_mode in ('wait', 'countdown')),
  lifecycle text not null default 'active' check (lifecycle in ('active', 'superseded')),
  onboarding_step smallint not null default 0 check (onboarding_step between 0 and 3),
  restarted_from_run_id uuid references summonlab_campaign_runs(run_id) on delete set null,
  heroes jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists summonlab_campaign_runs_recent
  on summonlab_campaign_runs(lifecycle, created_at desc);

comment on table summonlab_campaign_runs is
  'Player-facing campaign journey state. Game truth remains in the engine event stream.';
