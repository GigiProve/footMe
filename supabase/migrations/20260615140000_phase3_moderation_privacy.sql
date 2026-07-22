-- Phase 3: admin moderation of reported content tags + representation privacy.
-- All mutations go through security-definer RPCs (admin-gated where relevant),
-- so no new table RLS policies are required. Mirrors existing RPC conventions.

-- -----------------------------------------------------------------------
-- Admin: list reported content tags across the three tag tables.
-- -----------------------------------------------------------------------
create or replace function public.fetch_reported_content_tags()
returns table (
  content_type     text,
  post_id          uuid,
  tagged_profile_id uuid,
  tagged_name      text,
  created_at       timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  return query
    select 'club_media'::text, t.post_id, t.profile_id,
           coalesce(p.full_name, 'Profilo'), t.created_at
    from public.club_media_tagged_profiles t
    join public.profiles p on p.id = t.profile_id
    where t.status = 'reported'
    union all
    select 'fan_tribuna'::text, t.post_id, t.player_profile_id,
           coalesce(p.full_name, t.display_name, 'Profilo'), t.created_at
    from public.fan_tribuna_tagged_players t
    join public.profiles p on p.id = t.player_profile_id
    where t.status = 'reported'
    union all
    select 'media_profile'::text, t.post_id, t.target_id,
           coalesce(p.full_name, 'Profilo'), t.created_at
    from public.media_profile_post_tagged_targets t
    join public.profiles p on p.id = t.target_id
    where t.status = 'reported' and t.target_type = 'profile'
    order by 5 desc;
end;
$$;

-- -----------------------------------------------------------------------
-- Admin: moderate a reported tag — dismiss (back to active) or remove (hidden).
-- -----------------------------------------------------------------------
create or replace function public.moderate_content_tag(
  p_content_type text,
  p_post_id      uuid,
  p_tagged_id    uuid,
  p_dismiss      boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Non autorizzato';
  end if;

  v_status := case when p_dismiss then 'active' else 'hidden' end;

  if p_content_type = 'club_media' then
    update public.club_media_tagged_profiles
      set status = v_status
      where post_id = p_post_id and profile_id = p_tagged_id;
  elsif p_content_type = 'fan_tribuna' then
    update public.fan_tribuna_tagged_players
      set status = v_status
      where post_id = p_post_id and player_profile_id = p_tagged_id;
  elsif p_content_type = 'media_profile' then
    update public.media_profile_post_tagged_targets
      set status = v_status
      where post_id = p_post_id and target_id = p_tagged_id
        and target_type = 'profile';
  else
    raise exception 'Tipo di contenuto non valido';
  end if;
end;
$$;

-- -----------------------------------------------------------------------
-- Privacy: agent or player toggles representation visibility (public/private).
-- -----------------------------------------------------------------------
create or replace function public.set_representation_visibility(
  p_id         uuid,
  p_visibility text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current uuid := auth.uid();
  v_rep     public.agent_representations%rowtype;
begin
  if v_current is null then
    raise exception 'Authentication required';
  end if;

  if p_visibility not in ('public', 'private') then
    raise exception 'Visibilita'' non valida';
  end if;

  select * into v_rep
  from public.agent_representations
  where id = p_id;

  if not found then
    raise exception 'Relazione non trovata';
  end if;

  if v_rep.agent_profile_id <> v_current
     and v_rep.player_profile_id <> v_current then
    raise exception 'Non autorizzato';
  end if;

  update public.agent_representations
  set visibility = p_visibility,
      updated_at = timezone('utc', now())
  where id = p_id;
end;
$$;

revoke all on function public.fetch_reported_content_tags() from public;
grant execute on function public.fetch_reported_content_tags() to authenticated;

revoke all on function public.moderate_content_tag(text, uuid, uuid, boolean) from public;
grant execute on function public.moderate_content_tag(text, uuid, uuid, boolean) to authenticated;

revoke all on function public.set_representation_visibility(uuid, text) from public;
grant execute on function public.set_representation_visibility(uuid, text) to authenticated;
