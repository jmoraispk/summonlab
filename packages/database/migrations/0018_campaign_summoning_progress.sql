alter table summonlab_campaign_runs
  add column if not exists summoned_hero_count smallint;

update summonlab_campaign_runs
set summoned_hero_count = case when onboarding_step >= 2 then 3 else 0 end
where summoned_hero_count is null;

alter table summonlab_campaign_runs
  alter column summoned_hero_count set default 0,
  alter column summoned_hero_count set not null;

alter table summonlab_campaign_runs
  drop constraint if exists summonlab_campaign_runs_summoned_hero_count_check;

alter table summonlab_campaign_runs
  add constraint summonlab_campaign_runs_summoned_hero_count_check
  check (summoned_hero_count between 0 and 3);

comment on column summonlab_campaign_runs.summoned_hero_count is
  'Number of deterministic campaign candidates committed as Village residents, in ordinal order.';
