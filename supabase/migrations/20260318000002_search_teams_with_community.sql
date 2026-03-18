-- Search teams from both the clubs table and community-contributed names
-- found in player_career_entries. This lets manually entered team names
-- surface as suggestions for future users without relaxing clubs constraints.

create or replace function public.search_teams(
  p_query text,
  p_limit integer default 5
)
returns table (
  id uuid,
  name text,
  city text,
  logo_url text,
  is_community boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with club_matches as (
    select
      c.id,
      c.name,
      c.city,
      c.logo_url,
      false as is_community
    from public.clubs c
    where c.name ilike '%' || p_query || '%'
    order by c.name
    limit p_limit
  ),
  community_matches as (
    select distinct on (lower(trim(ce.club_name)))
      null::uuid as id,
      trim(ce.club_name) as name,
      null::text as city,
      null::text as logo_url,
      true as is_community
    from public.player_career_entries ce
    where ce.club_id is null
      and ce.club_name ilike '%' || p_query || '%'
      and trim(ce.club_name) <> ''
      -- Exclude names already matched by a real club
      and not exists (
        select 1 from public.clubs c2
        where lower(trim(c2.name)) = lower(trim(ce.club_name))
      )
    order by lower(trim(ce.club_name))
    limit p_limit
  ),
  combined as (
    select * from club_matches
    union all
    select * from community_matches
  )
  select * from combined
  order by is_community, name
  limit p_limit;
$$;

grant execute on function public.search_teams(text, integer) to authenticated;
grant execute on function public.search_teams(text, integer) to anon;
