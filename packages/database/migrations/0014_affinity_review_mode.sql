alter table summonlab_affinity_workflow_reviews
  add column if not exists review_mode text not null default 'legacy-unverified'
  check (review_mode in ('blind', 'api-unverified', 'legacy-unverified'));

comment on column summonlab_affinity_workflow_reviews.review_mode is
  'Server-derived evidence mode. Only blind records may enter blind-review aggregates.';

create index if not exists summonlab_affinity_workflow_reviews_mode_latest_idx
  on summonlab_affinity_workflow_reviews (
    experiment_id,
    target_id,
    reviewer,
    review_mode,
    reviewed_at desc,
    review_id desc
  );
