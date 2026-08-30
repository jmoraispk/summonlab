create table if not exists summonlab_later_pack_rule_decisions (
  decision_id uuid primary key,
  experiment_id text not null check (experiment_id = 'affinity-workflow-v1'),
  round_id text not null check (round_id = 'final-controlled-v1'),
  mode text not null check (mode = 'human-interactive'),
  actor text not null check (length(btrim(actor)) between 1 and 80),
  proposal_canonical_sha256 text not null check (proposal_canonical_sha256 ~ '^[a-f0-9]{64}$'),
  source_readiness_canonical_sha256 text not null check (source_readiness_canonical_sha256 ~ '^[a-f0-9]{64}$'),
  supersedes_decision_id uuid references summonlab_later_pack_rule_decisions(decision_id) on delete restrict,
  decisions jsonb not null check (jsonb_typeof(decisions) = 'array' and jsonb_array_length(decisions) = 8),
  attestation jsonb not null check (jsonb_typeof(attestation) = 'object'),
  decided_at timestamptz not null default clock_timestamp(),
  check (supersedes_decision_id is null or supersedes_decision_id <> decision_id)
);

create unique index if not exists summonlab_later_pack_rule_decisions_first_actor_idx
  on summonlab_later_pack_rule_decisions (experiment_id, round_id, actor)
  where supersedes_decision_id is null;

create unique index if not exists summonlab_later_pack_rule_decisions_superseded_once_idx
  on summonlab_later_pack_rule_decisions (supersedes_decision_id)
  where supersedes_decision_id is not null;

create index if not exists summonlab_later_pack_rule_decisions_scope_time_idx
  on summonlab_later_pack_rule_decisions (experiment_id, round_id, decided_at, decision_id);

comment on table summonlab_later_pack_rule_decisions is
  'Append-only, server-timestamped human-interactive decisions over the plan-owned later-pack visual rules. These records are evidence inputs, not repository acceptance artifacts.';
