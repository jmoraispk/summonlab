alter table summonlab_decision_jobs
  add column if not exists provider_request jsonb;

alter table summonlab_decision_jobs
  alter column schema_version set default 'decision-job-v2';

alter table summonlab_decision_jobs
  drop constraint if exists summonlab_decision_jobs_schema_version_check;

alter table summonlab_decision_jobs
  add constraint summonlab_decision_jobs_schema_version_check
  check (schema_version in ('decision-job-v1', 'decision-job-v2'));

alter table summonlab_decision_jobs
  drop constraint if exists summonlab_decision_jobs_provider_request_check;

alter table summonlab_decision_jobs
  add constraint summonlab_decision_jobs_provider_request_check
  check (
    (schema_version = 'decision-job-v1' and provider_request is null)
    or (
      schema_version = 'decision-job-v2'
      and ((requested_policy = 'model') = (provider_request is not null))
    )
  );

comment on column summonlab_decision_jobs.provider_request is
  'Redacted, hash-bound provider request profile. Credentials, raw packet text, and private reasoning are never stored.';
