create table if not exists summonlab_final_controlled_design_risk_decisions (
  decision_id uuid primary key,
  experiment_id text not null check (experiment_id = 'affinity-workflow-v1'),
  scope_id text not null check (scope_id = 'final-controlled-activation-v1'),
  mode text not null check (mode = 'human-interactive'),
  actor text not null check (length(btrim(actor)) between 1 and 80),
  plan_canonical_sha256 text not null check (plan_canonical_sha256 ~ '^[a-f0-9]{64}$'),
  catalog_canonical_sha256 text not null check (catalog_canonical_sha256 ~ '^[a-f0-9]{64}$'),
  execution_snapshot_canonical_sha256 text not null check (execution_snapshot_canonical_sha256 ~ '^[a-f0-9]{64}$'),
  blind_review_collection_canonical_sha256 text not null check (blind_review_collection_canonical_sha256 ~ '^[a-f0-9]{64}$'),
  source_audit_canonical_sha256 text not null check (source_audit_canonical_sha256 ~ '^[a-f0-9]{64}$'),
  supersedes_decision_id uuid references summonlab_final_controlled_design_risk_decisions(decision_id) on delete restrict,
  decisions jsonb not null check (jsonb_typeof(decisions) = 'array' and jsonb_array_length(decisions) = 16),
  attestation jsonb not null check (jsonb_typeof(attestation) = 'object'),
  decided_at timestamptz not null default clock_timestamp(),
  check (supersedes_decision_id is null or supersedes_decision_id <> decision_id)
);

create unique index if not exists summonlab_fc_design_risk_first_actor_idx
  on summonlab_final_controlled_design_risk_decisions (experiment_id, scope_id, actor)
  where supersedes_decision_id is null;

create unique index if not exists summonlab_fc_design_risk_superseded_once_idx
  on summonlab_final_controlled_design_risk_decisions (supersedes_decision_id)
  where supersedes_decision_id is not null;

create index if not exists summonlab_final_controlled_design_risk_decisions_scope_time_idx
  on summonlab_final_controlled_design_risk_decisions (
    experiment_id,
    scope_id,
    decided_at,
    decision_id
  );

comment on table summonlab_final_controlled_design_risk_decisions is
  'Append-only, server-timestamped human-interactive decisions over the exact final-controlled design-risk audit. These records are evidence inputs and never activate manifests by themselves.';
