create table if not exists summonlab_engine_clocks (
  run_id uuid primary key references summonlab_engine_runs(run_id) on delete cascade,
  speed smallint not null default 4 check (speed in (0, 1, 2, 4, 8)),
  anchor_game_time timestamptz not null,
  anchor_real_time timestamptz not null,
  last_caught_up_at timestamptz,
  lease_id uuid,
  lease_owner text,
  lease_expires_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (lease_id is null and lease_owner is null and lease_expires_at is null)
    or
    (lease_id is not null and lease_owner is not null and lease_expires_at is not null)
  )
);

insert into summonlab_engine_clocks (
  run_id, speed, anchor_game_time, anchor_real_time
)
select run_id, 4, simulated_at, updated_at
from summonlab_engine_runs
on conflict (run_id) do nothing;

create index if not exists summonlab_engine_clocks_expired_lease
  on summonlab_engine_clocks(lease_expires_at)
  where lease_id is not null;

comment on table summonlab_engine_clocks is
  'Wall-to-game-time projection and renewable catch-up lease; explicit targets alone enter engine events.';
