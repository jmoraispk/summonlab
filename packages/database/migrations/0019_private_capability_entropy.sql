-- New v2 summons use this server-only entropy to make hidden learning scores
-- non-derivable from the player-supplied recipe. Existing v2 rows intentionally
-- remain null and continue to use their already-persisted capability profile.
alter table summonlab_proof_runs
  add column if not exists capability_entropy text;
