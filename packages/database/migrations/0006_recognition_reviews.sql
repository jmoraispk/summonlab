create table if not exists summonlab_visual_recognition_reviews (
  review_id uuid primary key,
  audit_hash char(64) not null check (audit_hash ~ '^[a-f0-9]{64}$'),
  catalog_version text not null,
  character_id uuid not null,
  case_id text not null check (case_id ~ '^[a-z][a-z0-9-]{2,99}$'),
  outcomes jsonb not null check (jsonb_typeof(outcomes) = 'array'),
  verdict text not null check (verdict in ('pass', 'revise')),
  note text not null check (char_length(note) between 1 and 1000),
  reviewer text not null check (char_length(reviewer) between 1 and 80),
  created_at timestamptz not null default now()
);

create index if not exists summonlab_visual_recognition_reviews_audit_case_created_idx
  on summonlab_visual_recognition_reviews (audit_hash, case_id, created_at desc, review_id desc);

comment on table summonlab_visual_recognition_reviews is
  'Append-only human recognition evidence bound to an exact audit hash; never asset approval or game state.';
