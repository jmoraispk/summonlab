create table if not exists summonlab_playtest_consents (
  consent_id uuid primary key,
  notice_version text not null,
  analytics_version text not null,
  status text not null check (status in ('granted', 'withdrawn', 'expired')),
  withdrawal_token_hash text unique check (
    withdrawal_token_hash is null or withdrawal_token_hash ~ '^[a-f0-9]{64}$'
  ),
  accepted_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > accepted_at),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (status = 'granted' and withdrawal_token_hash is not null and withdrawn_at is null)
    or (status in ('withdrawn', 'expired') and withdrawal_token_hash is null and withdrawn_at is not null)
  )
);

create table if not exists summonlab_playtest_sessions (
  session_id uuid primary key,
  consent_id uuid not null references summonlab_playtest_consents(consent_id) on delete cascade,
  started_at timestamptz not null,
  last_event_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (last_event_at >= started_at)
);

create index if not exists summonlab_playtest_sessions_consent
  on summonlab_playtest_sessions(consent_id, started_at);

create table if not exists summonlab_playtest_events (
  event_id uuid primary key,
  consent_id uuid not null references summonlab_playtest_consents(consent_id) on delete cascade,
  session_id uuid not null references summonlab_playtest_sessions(session_id) on delete cascade,
  run_id uuid,
  event_type text not null check (event_type in (
    'route_viewed',
    'campaign_started',
    'onboarding_step_completed',
    'hearth_entered',
    'pause_opened',
    'campaign_restarted',
    'reconnect_completed'
  )),
  route text not null check (route in ('title', 'onboarding', 'hearth', 'replay')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  payload jsonb not null
);

create index if not exists summonlab_playtest_events_aggregate
  on summonlab_playtest_events(event_type, session_id);

comment on table summonlab_playtest_consents is
  'Capability-bound, expiring consent. Declines stay on device and never enter this table.';
comment on table summonlab_playtest_events is
  'Strictly allowlisted presentation analytics; never canonical game truth or raw player text.';
