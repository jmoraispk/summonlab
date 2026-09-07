create table if not exists summonlab_combat_decision_windows (
  window_id uuid primary key,
  run_id uuid not null references summonlab_engine_runs(run_id) on delete cascade,
  attempt_id uuid not null,
  tick integer not null check (tick >= 0),
  snapshot_hash text not null check (snapshot_hash ~ '^[a-f0-9]{64}$'),
  expected_run_version integer not null check (expected_run_version >= 0),
  expected_event_cursor integer not null check (expected_event_cursor > 0),
  status text not null default 'collecting'
    check (status in ('collecting', 'ready', 'applied', 'stale', 'failed')),
  snapshot jsonb not null,
  choice_batch jsonb,
  batch_hash text check (batch_hash ~ '^[a-f0-9]{64}$'),
  applied_event_cursor integer check (applied_event_cursor > 0),
  applied_command_id uuid,
  applied_event_id uuid,
  ready_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, attempt_id, tick, snapshot_hash),
  check (status not in ('ready', 'applied') or choice_batch is not null),
  check ((choice_batch is null) = (batch_hash is null)),
  check ((status = 'applied') = (applied_event_cursor is not null)),
  check ((applied_event_cursor is null) = (applied_at is null))
);

alter table summonlab_combat_decision_windows
  add column if not exists applied_command_id uuid,
  add column if not exists applied_event_id uuid;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'summonlab_combat_windows_applied_command_fk'
  ) then
    alter table summonlab_combat_decision_windows
      add constraint summonlab_combat_windows_applied_command_fk
      foreign key (applied_command_id) references summonlab_engine_commands(command_id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'summonlab_combat_windows_applied_event_fk'
  ) then
    alter table summonlab_combat_decision_windows
      add constraint summonlab_combat_windows_applied_event_fk
      foreign key (applied_event_id) references summonlab_engine_events(event_id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'summonlab_combat_windows_applied_receipt_check'
  ) then
    alter table summonlab_combat_decision_windows
      add constraint summonlab_combat_windows_applied_receipt_check check (
        (status = 'applied') = (
          applied_event_cursor is not null
          and applied_command_id is not null
          and applied_event_id is not null
        )
      );
  end if;
end
$migration$;

alter table summonlab_decision_jobs
  add column if not exists window_id uuid,
  add column if not exists actor_view_hash text,
  add column if not exists deterministic_fallback jsonb;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'summonlab_decision_jobs_window_fk'
  ) then
    alter table summonlab_decision_jobs
      add constraint summonlab_decision_jobs_window_fk
      foreign key (window_id) references summonlab_combat_decision_windows(window_id)
      on delete cascade;
  end if;
end
$migration$;

alter table summonlab_decision_jobs
  drop constraint if exists summonlab_decision_jobs_schema_version_check,
  drop constraint if exists summonlab_decision_jobs_decision_kind_check,
  drop constraint if exists summonlab_decision_jobs_provider_request_check,
  drop constraint if exists summonlab_decision_jobs_combat_binding_check;

alter table summonlab_decision_jobs
  add constraint summonlab_decision_jobs_schema_version_check
    check (schema_version in ('decision-job-v1', 'decision-job-v2', 'decision-job-v3')),
  add constraint summonlab_decision_jobs_decision_kind_check
    check (decision_kind in (
      'settlement-action', 'mission-action', 'conversation-response', 'story-expression',
      'combat-action'
    )),
  add constraint summonlab_decision_jobs_provider_request_check
    check (
      (schema_version = 'decision-job-v1' and provider_request is null)
      or (
        schema_version = 'decision-job-v2'
        and ((requested_policy = 'model') = (provider_request is not null))
      )
      or schema_version = 'decision-job-v3'
    ),
  add constraint summonlab_decision_jobs_combat_binding_check
    check (
      (schema_version in ('decision-job-v1', 'decision-job-v2')
        and decision_kind in (
          'settlement-action', 'mission-action', 'conversation-response', 'story-expression'
        )
        and window_id is null and actor_view_hash is null and deterministic_fallback is null)
      or
      (schema_version = 'decision-job-v3' and decision_kind = 'combat-action'
        and window_id is not null and actor_view_hash ~ '^[a-f0-9]{64}$'
        and deterministic_fallback is not null)
    );

create unique index if not exists summonlab_decision_jobs_window_actor
  on summonlab_decision_jobs(window_id, hero_id)
  where window_id is not null;

create index if not exists summonlab_combat_decision_windows_run_status
  on summonlab_combat_decision_windows(run_id, status, created_at, window_id);

alter table summonlab_engine_events
  drop constraint if exists summonlab_engine_events_event_type_check;

alter table summonlab_engine_events
  add constraint summonlab_engine_events_event_type_check
  check (
    event_type ~ '^[a-z][a-z0-9.]{2,99}$'
    or event_type = 'mission.combat.choice-batch.applied'
  );

comment on table summonlab_combat_decision_windows is
  'One frozen readiness cohort. Actor jobs may finish in any order; only a bound complete batch becomes ready.';

comment on column summonlab_decision_jobs.actor_view_hash is
  'Exact private-safe actor view binding for decision-job-v3 combat jobs.';

comment on column summonlab_decision_jobs.deterministic_fallback is
  'Precomputed legal engine fallback used only after bounded requested-policy attempts are exhausted.';
