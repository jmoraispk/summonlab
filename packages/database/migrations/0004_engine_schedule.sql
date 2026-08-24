create table if not exists summonlab_engine_scheduled_events (
  scheduled_event_id uuid primary key,
  run_id uuid not null references summonlab_engine_runs(run_id) on delete cascade,
  actor_id uuid not null,
  due_game_time timestamptz not null,
  event_kind text not null check (event_kind ~ '^[a-z][a-z0-9.]{2,99}$'),
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'resolved', 'canceled')),
  created_event_id uuid not null references summonlab_engine_events(event_id),
  terminal_event_id uuid references summonlab_engine_events(event_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'pending' and terminal_event_id is null)
    or (status in ('resolved', 'canceled') and terminal_event_id is not null))
);

create index if not exists summonlab_engine_schedule_due
  on summonlab_engine_scheduled_events(run_id, due_game_time, scheduled_event_id)
  where status = 'pending';

comment on table summonlab_engine_scheduled_events is
  'Deterministic due work projected from canonical events; wall time never enters the engine.';
