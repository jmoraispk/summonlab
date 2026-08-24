create table if not exists summonlab_decision_jobs (
  decision_job_id uuid primary key,
  schema_version text not null default 'decision-job-v1'
    check (schema_version = 'decision-job-v1'),
  root_job_id uuid not null,
  parent_job_id uuid,
  replacement_job_id uuid,
  run_id uuid not null references summonlab_engine_runs(run_id) on delete cascade,
  hero_id uuid not null,
  decision_kind text not null
    check (decision_kind in (
      'settlement-action', 'mission-action', 'conversation-response', 'story-expression'
    )),
  status text not null default 'created'
    check (status in (
      'created', 'queued', 'in_progress', 'retry_wait', 'fallback', 'completed',
      'validated', 'applied', 'stale', 'replanned', 'failed'
    )),
  requested_policy text not null check (requested_policy in ('random', 'scripted', 'model')),
  next_attempt_kind text not null default 'primary'
    check (next_attempt_kind in ('primary', 'retry', 'fallback')),
  active_policy text check (active_policy in ('random', 'scripted', 'model')),
  resolution text check (resolution in ('requested', 'fallback')),
  expected_run_version integer not null check (expected_run_version >= 0),
  expected_event_cursor integer not null check (expected_event_cursor > 0),
  decision_game_time timestamptz not null,
  packet_id uuid not null,
  packet_hash text not null check (packet_hash ~ '^[a-f0-9]{64}$'),
  state_hash text not null check (state_hash ~ '^[a-f0-9]{64}$'),
  legal_action_hash text not null check (legal_action_hash ~ '^[a-f0-9]{64}$'),
  prompt_version text not null,
  context_policy_version text not null,
  packet jsonb not null,
  result jsonb,
  failure jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0 and attempt_count <= 16),
  provider_attempt_count integer not null default 0
    check (provider_attempt_count >= 0 and provider_attempt_count <= 4),
  max_provider_attempts integer not null default 2
    check (max_provider_attempts >= 1 and max_provider_attempts <= 4),
  replan_count integer not null default 0 check (replan_count >= 0 and replan_count <= 16),
  max_replans integer not null default 3 check (max_replans >= 0 and max_replans <= 16),
  lease_expires_at timestamptz,
  applied_command_id uuid references summonlab_engine_commands(command_id),
  applied_event_cursor integer check (applied_event_cursor > 0),
  applied_run_version integer check (applied_run_version > 0),
  applied_state_hash text check (applied_state_hash ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, hero_id, packet_hash, requested_policy),
  check ((status = 'in_progress') = (lease_expires_at is not null)),
  check ((status = 'applied') = (applied_command_id is not null)),
  check ((applied_command_id is null) = (applied_at is null)),
  check ((applied_command_id is null) = (applied_event_cursor is null)),
  check ((applied_command_id is null) = (applied_run_version is null)),
  check ((applied_command_id is null) = (applied_state_hash is null))
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'summonlab_decision_jobs_root_fk'
  ) then
    alter table summonlab_decision_jobs
      add constraint summonlab_decision_jobs_root_fk
      foreign key (root_job_id) references summonlab_decision_jobs(decision_job_id)
      deferrable initially deferred;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'summonlab_decision_jobs_parent_fk'
  ) then
    alter table summonlab_decision_jobs
      add constraint summonlab_decision_jobs_parent_fk
      foreign key (parent_job_id) references summonlab_decision_jobs(decision_job_id);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'summonlab_decision_jobs_replacement_fk'
  ) then
    alter table summonlab_decision_jobs
      add constraint summonlab_decision_jobs_replacement_fk
      foreign key (replacement_job_id) references summonlab_decision_jobs(decision_job_id);
  end if;
end
$$;

create table if not exists summonlab_decision_job_attempts (
  decision_job_id uuid not null references summonlab_decision_jobs(decision_job_id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0 and attempt_number <= 16),
  attempt_kind text not null check (attempt_kind in ('primary', 'retry', 'fallback')),
  policy text not null check (policy in ('random', 'scripted', 'model')),
  policy_id text not null
    check (policy_id in ('random-policy-v1', 'scripted-policy-v1', 'model-policy-v1')),
  status text not null check (status in ('in_progress', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  latency_ms integer check (latency_ms >= 0),
  result_hash text check (result_hash ~ '^[a-f0-9]{64}$'),
  failure jsonb,
  primary key (decision_job_id, attempt_number),
  check ((status = 'in_progress') = (completed_at is null)),
  check ((status = 'succeeded') = (result_hash is not null)),
  check ((status = 'failed') = (failure is not null))
);

create table if not exists summonlab_decision_job_transitions (
  decision_job_id uuid not null references summonlab_decision_jobs(decision_job_id) on delete cascade,
  sequence integer not null check (sequence > 0 and sequence <= 64),
  from_status text check (from_status in (
    'created', 'queued', 'in_progress', 'retry_wait', 'fallback', 'completed',
    'validated', 'applied', 'stale', 'replanned', 'failed'
  )),
  to_status text not null check (to_status in (
    'created', 'queued', 'in_progress', 'retry_wait', 'fallback', 'completed',
    'validated', 'applied', 'stale', 'replanned', 'failed'
  )),
  reason text not null check (reason ~ '^[a-z][a-z0-9._-]{1,79}$'),
  detail text,
  occurred_at timestamptz not null default now(),
  primary key (decision_job_id, sequence)
);

create index if not exists summonlab_decision_jobs_dispatchable
  on summonlab_decision_jobs(status, updated_at, decision_job_id)
  where status in ('created', 'retry_wait', 'fallback');

create index if not exists summonlab_decision_jobs_run_created
  on summonlab_decision_jobs(run_id, created_at desc, decision_job_id desc);

comment on table summonlab_decision_jobs is
  'Authoritative packet-bound policy lifecycle. A result has no game effect until atomically validated and applied.';

comment on table summonlab_decision_job_attempts is
  'Bounded requested-policy retries and deterministic fallback attempts; no hidden reasoning is stored.';

comment on table summonlab_decision_job_transitions is
  'Append-only operational lifecycle for retry, stale rejection, replanning, fallback, and application inspection.';
