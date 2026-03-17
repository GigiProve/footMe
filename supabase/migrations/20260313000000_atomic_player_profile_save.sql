create or replace function public.save_player_profile_details(
  p_profile_id uuid,
  p_player_profile jsonb,
  p_career_entries jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile_id uuid := auth.uid();
begin
  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_user(p_profile_id) then
    raise exception 'Profile not accessible';
  end if;

  insert into public.player_profiles (
    profile_id,
    preferred_foot,
    height_cm,
    weight_kg,
    primary_position,
    secondary_position,
    willing_to_change_club,
    transfer_regions,
    preferred_categories,
    highlight_video_url
  )
  select
    p_profile_id,
    payload.preferred_foot,
    payload.height_cm,
    payload.weight_kg,
    coalesce(payload.primary_position, 'central_midfielder'::public.player_position),
    payload.secondary_position,
    coalesce(payload.willing_to_change_club, false),
    coalesce(payload.transfer_regions, '{}'::text[]),
    coalesce(payload.preferred_categories, '{}'::text[]),
    payload.highlight_video_url
  from jsonb_to_record(coalesce(p_player_profile, '{}'::jsonb)) as payload(
    preferred_foot public.preferred_foot,
    height_cm integer,
    weight_kg integer,
    primary_position public.player_position,
    secondary_position public.player_position,
    willing_to_change_club boolean,
    transfer_regions text[],
    preferred_categories text[],
    highlight_video_url text
  )
  on conflict (profile_id) do update
  set
    preferred_foot = excluded.preferred_foot,
    height_cm = excluded.height_cm,
    weight_kg = excluded.weight_kg,
    primary_position = excluded.primary_position,
    secondary_position = excluded.secondary_position,
    willing_to_change_club = excluded.willing_to_change_club,
    transfer_regions = excluded.transfer_regions,
    preferred_categories = excluded.preferred_categories,
    highlight_video_url = excluded.highlight_video_url,
    updated_at = timezone('utc', now());

  with provided_entries as (
    select *
    from jsonb_to_recordset(coalesce(p_career_entries, '[]'::jsonb)) as entry(
      id uuid,
      appearances integer,
      assists integer,
      awards text,
      club_id uuid,
      club_name text,
      competition_name text,
      goals integer,
      minutes_played integer,
      season_label text,
      sort_order integer,
      team_logo_url text
    )
  )
  delete from public.player_career_entries career
  where career.player_profile_id = p_profile_id
    and not exists (
      select 1
      from provided_entries entry
      where entry.id is not null
        and entry.id = career.id
    );

  with provided_entries as (
    select *
    from jsonb_to_recordset(coalesce(p_career_entries, '[]'::jsonb)) as entry(
      id uuid,
      appearances integer,
      assists integer,
      awards text,
      club_id uuid,
      club_name text,
      competition_name text,
      goals integer,
      minutes_played integer,
      season_label text,
      sort_order integer,
      team_logo_url text
    )
  )
  insert into public.player_career_entries (
    id,
    player_profile_id,
    season_label,
    club_name,
    competition_name,
    appearances,
    goals,
    assists,
    minutes_played,
    awards,
    sort_order,
    club_id,
    team_logo_url
  )
  select
    entry.id,
    p_profile_id,
    entry.season_label,
    entry.club_name,
    entry.competition_name,
    coalesce(entry.appearances, 0),
    coalesce(entry.goals, 0),
    coalesce(entry.assists, 0),
    coalesce(entry.minutes_played, 0),
    entry.awards,
    coalesce(entry.sort_order, 0),
    entry.club_id,
    entry.team_logo_url
  from provided_entries entry
  where entry.id is not null
  on conflict (id) do update
  set
    player_profile_id = excluded.player_profile_id,
    season_label = excluded.season_label,
    club_name = excluded.club_name,
    competition_name = excluded.competition_name,
    appearances = excluded.appearances,
    goals = excluded.goals,
    assists = excluded.assists,
    minutes_played = excluded.minutes_played,
    awards = excluded.awards,
    sort_order = excluded.sort_order,
    club_id = excluded.club_id,
    team_logo_url = excluded.team_logo_url;

  with provided_entries as (
    select *
    from jsonb_to_recordset(coalesce(p_career_entries, '[]'::jsonb)) as entry(
      id uuid,
      appearances integer,
      assists integer,
      awards text,
      club_id uuid,
      club_name text,
      competition_name text,
      goals integer,
      minutes_played integer,
      season_label text,
      sort_order integer,
      team_logo_url text
    )
  )
  insert into public.player_career_entries (
    player_profile_id,
    season_label,
    club_name,
    competition_name,
    appearances,
    goals,
    assists,
    minutes_played,
    awards,
    sort_order,
    club_id,
    team_logo_url
  )
  select
    p_profile_id,
    entry.season_label,
    entry.club_name,
    entry.competition_name,
    coalesce(entry.appearances, 0),
    coalesce(entry.goals, 0),
    coalesce(entry.assists, 0),
    coalesce(entry.minutes_played, 0),
    entry.awards,
    coalesce(entry.sort_order, 0),
    entry.club_id,
    entry.team_logo_url
  from provided_entries entry
  where entry.id is null;
end;
$$;

revoke all on function public.save_player_profile_details(uuid, jsonb, jsonb) from public;
grant execute on function public.save_player_profile_details(uuid, jsonb, jsonb) to authenticated;
