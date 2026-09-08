create table if not exists summonlab_affinity_workflow_reviews (
  review_id uuid primary key,
  experiment_id text not null check (experiment_id = 'affinity-workflow-v1'),
  target_id text not null check (target_id ~ '^[a-z][a-z0-9-]{1,79}$'),
  candidate_content_hash char(64) not null check (candidate_content_hash ~ '^[a-f0-9]{64}$'),
  reviewer text not null check (char_length(reviewer) between 1 and 80),
  identified_species_id text not null check (identified_species_id in (
    'death-knight',
    'elemental',
    'gray-wolf',
    'cave-bear',
    'goblin',
    'tunnel-boar',
    'cave-drake',
    'tower-basilisk'
  )),
  identified_affinity text not null check (identified_affinity in (
    'normal',
    'wood',
    'fire',
    'metal',
    'water',
    'wind'
  )),
  species_identity_score smallint not null check (species_identity_score between 1 and 5),
  affinity_readability_score smallint not null check (affinity_readability_score between 1 and 5),
  silhouette_and_duty_score smallint not null check (silhouette_and_duty_score between 1 and 5),
  material_credibility_score smallint not null check (material_credibility_score between 1 and 5),
  anatomy_and_ground_contact_score smallint not null check (anatomy_and_ground_contact_score between 1 and 5),
  affinity_integration_score smallint not null check (affinity_integration_score between 1 and 5),
  style_cohesion_score smallint not null check (style_cohesion_score between 1 and 5),
  verdict text not null check (verdict in ('candidate', 'revise')),
  note text not null check (char_length(note) between 1 and 1000),
  reviewed_at timestamptz not null default now()
);

create index if not exists summonlab_affinity_workflow_reviews_latest_idx
  on summonlab_affinity_workflow_reviews (
    experiment_id,
    target_id,
    reviewer,
    reviewed_at desc,
    review_id desc
  );

comment on table summonlab_affinity_workflow_reviews is
  'Append-only blind affinity-workflow evidence bound to an exact candidate hash; never asset promotion or game state.';
