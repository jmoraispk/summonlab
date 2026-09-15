alter table summonlab_exploration_attempts
  add column if not exists active_request jsonb;

-- Pre-consolidation encounters persisted only an opaque ID/hash, so they cannot be
-- replayed honestly. Resume those attempts at their current tile and let the
-- canonical encounter builder bind a complete request on the next interaction.
update summonlab_exploration_attempts
set status = 'exploring',
    version = version + 1,
    state = jsonb_set(
      jsonb_set(state, '{status}', '"exploring"'::jsonb),
      '{version}',
      to_jsonb(version + 1)
    ),
    active_request_id = null,
    active_request_hash = null,
    active_request = null,
    updated_at = now()
where active_request_id is not null
  and active_request is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'summonlab_exploration_attempts_active_request_binding'
  ) then
    alter table summonlab_exploration_attempts
      add constraint summonlab_exploration_attempts_active_request_binding
      check (
        (active_request_id is null and active_request_hash is null and active_request is null)
        or
        (active_request_id is not null and active_request_hash is not null and active_request is not null)
      );
  end if;
end
$$;

comment on column summonlab_exploration_attempts.active_request is
  'Exact immutable combat request bound to a suspended Tower exploration attempt.';
