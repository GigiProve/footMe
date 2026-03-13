create extension if not exists pg_trgm;

alter type public.player_position add value if not exists 'center_back';
alter type public.player_position add value if not exists 'right_back';
alter type public.player_position add value if not exists 'left_back';
alter type public.player_position add value if not exists 'defensive_midfielder';
alter type public.player_position add value if not exists 'central_midfielder';
alter type public.player_position add value if not exists 'attacking_midfielder';
alter type public.player_position add value if not exists 'right_winger';
alter type public.player_position add value if not exists 'left_winger';
alter type public.player_position add value if not exists 'striker';

alter table public.player_career_entries
add column if not exists club_id uuid references public.clubs(id) on delete set null,
add column if not exists team_logo_url text;

create index if not exists player_career_entries_club_id_idx
on public.player_career_entries (club_id);

create index if not exists clubs_name_search_idx
on public.clubs using gin (name gin_trgm_ops);
