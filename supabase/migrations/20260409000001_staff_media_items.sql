alter table staff_profiles
  add column if not exists media_items jsonb not null default '[]'::jsonb;
