-- RPC: Suggest profiles matching a name (for admin autocomplete)
create or replace function public.suggest_profiles_for_club(
  search_name text,
  target_role text default null,
  result_limit integer default 5
)
returns table (
  profile_id uuid,
  full_name text,
  role text,
  region text,
  city text,
  avatar_url text
)
language sql stable security invoker
as $$
  select
    p.id as profile_id,
    p.full_name,
    p.role::text,
    p.region,
    p.city,
    p.avatar_url
  from public.profiles p
  where
    p.full_name ilike '%' || search_name || '%'
    and (target_role is null or p.role::text = target_role)
  order by
    -- Exact prefix matches first
    case when lower(p.full_name) like lower(search_name) || '%' then 0 else 1 end,
    p.full_name asc
  limit result_limit;
$$;

-- RPC: Join a club via an invite token.
-- Handles auto-matching against manual entries and notifies the club admin.
create or replace function public.join_club_via_invite(
  invite_token text
)
returns uuid
language plpgsql security definer
as $$
declare
  v_link record;
  v_member_id uuid;
  v_existing_id uuid;
  v_profile_name text;
  v_club_owner uuid;
  v_club_name text;
begin
  -- Find valid invite link
  select * into v_link
  from public.club_invite_links
  where token = invite_token
    and is_active = true
    and expires_at > timezone('utc', now());

  if v_link is null then
    raise exception 'Link di invito non valido o scaduto';
  end if;

  -- Check if user is already a member of this club
  select id into v_existing_id
  from public.club_members
  where club_id = v_link.club_id
    and profile_id = auth.uid()
    and status = 'active';

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  -- Get the joining user's name
  select full_name into v_profile_name
  from public.profiles where id = auth.uid();

  -- Try to match against a manual entry with the same name and role
  select id into v_existing_id
  from public.club_members
  where club_id = v_link.club_id
    and profile_id is null
    and member_role = v_link.member_role
    and status = 'active'
    and lower(trim(manual_name)) = lower(trim(v_profile_name))
  limit 1;

  if v_existing_id is not null then
    -- Auto-match: link the manual entry to this profile
    update public.club_members
    set profile_id = auth.uid(),
        manual_name = null,
        added_by = 'invite_link',
        updated_at = timezone('utc', now())
    where id = v_existing_id;
    v_member_id := v_existing_id;
  else
    -- Create new member entry
    insert into public.club_members (club_id, profile_id, member_role, added_by, status)
    values (v_link.club_id, auth.uid(), v_link.member_role, 'invite_link', 'active')
    returning id into v_member_id;
  end if;

  -- Notify club admin
  select c.owner_profile_id, c.name
  into v_club_owner, v_club_name
  from public.clubs c where c.id = v_link.club_id;

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    v_club_owner,
    'member_joined',
    'Nuovo membro nella rosa',
    coalesce(v_profile_name, 'Un utente') || ' si e'' collegato a ' || v_club_name || ' come ' || v_link.member_role,
    jsonb_build_object('club_member_id', v_member_id::text, 'profile_id', auth.uid()::text, 'club_id', v_link.club_id::text)
  );

  return v_member_id;
end;
$$;
