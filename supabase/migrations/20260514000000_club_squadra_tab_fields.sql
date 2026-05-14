alter table public.clubs
  add column if not exists sports_focus text;

alter table public.club_affiliations
  add column if not exists relationship_label text;
