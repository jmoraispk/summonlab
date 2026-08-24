create table if not exists summonlab_visual_asset_reviews (
  review_id uuid primary key,
  asset_key text not null check (asset_key ~ '^[a-z][a-z0-9-]{2,99}$'),
  catalog_version text not null,
  asset_content_hash char(64) not null check (asset_content_hash ~ '^[a-f0-9]{64}$'),
  verdict text not null check (verdict in ('approved', 'revise')),
  note text not null check (char_length(note) between 1 and 1000),
  reviewer text not null check (char_length(reviewer) between 1 and 80),
  created_at timestamptz not null default now()
);

create index if not exists summonlab_visual_asset_reviews_catalog_asset_created_idx
  on summonlab_visual_asset_reviews (catalog_version, asset_key, created_at desc, review_id desc);

comment on table summonlab_visual_asset_reviews is
  'Append-only human art decisions bound to exact catalog and asset hashes; never game state.';
