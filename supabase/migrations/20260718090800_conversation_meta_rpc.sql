-- Migration: fetch_direct_conversation_meta() — single RPC that drives the
-- MES-02 chat header, relationship banners, and candidacy context card.
--
-- Deliberately does NOT expose blocked_by_other (only blocked_by_me): being
-- blocked stays invisible to the blocked party, per the MES-02 decision that
-- their message sends just fail silently via RLS.
--
-- "Club identity": when the other participant is a club_admin who owns a
-- club, chat "with the club" surfaces that club's name/category (oldest
-- club by created_at if the owner somehow owns more than one — fine for
-- MVP). mutual_follow is club-aware: if the counterpart owns a club, the
-- viewer's "I follow" side is also satisfied by following that club.
--
-- Mirrors conventions from:
--   20260718090000_conversation_types.sql (other-participant lateral join shape)
--   20260717090200_shortlist_rpcs.sql / 20260615120100_agent_representations.sql
--     (security definer RPC scaffolding: v_uid/auth check, revoke+grant)


create or replace function public.fetch_direct_conversation_meta(
  target_conversation_id uuid
)
returns table (
  other_profile_id       uuid,
  other_full_name        text,
  other_avatar_url       text,
  other_role             public.app_role,
  other_primary_position public.player_position,
  club_id                uuid,
  club_name              text,
  club_category          text,
  mutual_follow          boolean,
  representation_active  boolean,
  representation_type    text,
  roster_linked          boolean,
  shortlisted            boolean,
  i_have_sent            boolean,
  other_has_sent         boolean,
  blocked_by_me          boolean,
  archived               boolean,
  application_id         uuid,
  application_status     text,
  ad_id                  uuid,
  ad_title               text,
  applicant_full_name    text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.conversations conversation
    join public.conversation_participants participant
      on participant.conversation_id = conversation.id
     and participant.profile_id = v_uid
    where conversation.id = target_conversation_id
      and conversation.conversation_type = 'direct'
  ) then
    raise exception 'Conversazione non trovata';
  end if;

  return query
  with target as (
    select
      conversation.id,
      conversation.context_application_id
    from public.conversations conversation
    where conversation.id = target_conversation_id
  ),
  other as (
    select participant.profile_id as id
    from public.conversation_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.profile_id <> v_uid
    limit 1
  ),
  other_club as (
    select club.id, club.name, club.category
    from other
    join public.profiles other_profile_check
      on other_profile_check.id = other.id
     and other_profile_check.role = 'club_admin'
    join public.clubs club
      on club.owner_profile_id = other.id
    order by club.created_at
    limit 1
  )
  select
    other_profile.id                                                        as other_profile_id,
    other_profile.full_name                                                 as other_full_name,
    other_profile.avatar_url                                                as other_avatar_url,
    other_profile.role                                                      as other_role,
    other_player.primary_position                                           as other_primary_position,
    other_club.id                                                           as club_id,
    other_club.name                                                         as club_name,
    other_club.category                                                     as club_category,
    (
      (
        exists (
          select 1 from public.profile_follows f
          where f.follower_profile_id = v_uid and f.followed_profile_id = other.id
        )
        or exists (
          select 1 from public.club_follows cf
          where cf.profile_id = v_uid and cf.club_id = other_club.id
        )
      )
      and exists (
        select 1 from public.profile_follows f2
        where f2.follower_profile_id = other.id and f2.followed_profile_id = v_uid
      )
    )                                                                        as mutual_follow,
    (rep.viewer_is_agent is not null)                                       as representation_active,
    case
      when rep.viewer_is_agent is null then null
      when rep.viewer_is_agent then 'agent'
      else 'player'
    end                                                                      as representation_type,
    (
      exists (
        select 1
        from public.club_members member
        join public.clubs my_club on my_club.id = member.club_id
        where member.status = 'active'
          and member.profile_id = v_uid
          and my_club.owner_profile_id = other.id
      )
      or exists (
        select 1
        from public.club_members member
        join public.clubs other_owned_club on other_owned_club.id = member.club_id
        where member.status = 'active'
          and member.profile_id = other.id
          and other_owned_club.owner_profile_id = v_uid
      )
    )                                                                        as roster_linked,
    (
      exists (
        select 1
        from public.club_shortlist_entries entry
        join public.club_shortlists list on list.id = entry.shortlist_id
        join public.clubs my_club on my_club.id = list.club_id
        where my_club.owner_profile_id = v_uid
          and entry.player_profile_id = other.id
      )
      or exists (
        select 1
        from public.club_shortlist_entries entry
        join public.club_shortlists list on list.id = entry.shortlist_id
        join public.clubs other_owned_club on other_owned_club.id = list.club_id
        where other_owned_club.owner_profile_id = other.id
          and entry.player_profile_id = v_uid
      )
    )                                                                        as shortlisted,
    exists (
      select 1 from public.messages message
      where message.conversation_id = target_conversation_id
        and message.sender_profile_id = v_uid
    )                                                                        as i_have_sent,
    exists (
      select 1 from public.messages message
      where message.conversation_id = target_conversation_id
        and message.sender_profile_id = other.id
    )                                                                        as other_has_sent,
    exists (
      select 1 from public.user_blocks block_row
      where block_row.blocker_profile_id = v_uid
        and block_row.blocked_profile_id = other.id
    )                                                                        as blocked_by_me,
    (my_participant.archived_at is not null)                                 as archived,
    application.id                                                          as application_id,
    application.status::text                                                as application_status,
    ad.id                                                                    as ad_id,
    ad.title                                                                 as ad_title,
    applicant.full_name                                                     as applicant_full_name
  from target
  join other on true
  join public.profiles other_profile on other_profile.id = other.id
  left join public.player_profiles other_player on other_player.profile_id = other.id
  left join other_club on true
  left join lateral (
    select (arep.agent_profile_id = v_uid) as viewer_is_agent
    from public.agent_representations arep
    where arep.status = 'accepted'
      and (
        (arep.agent_profile_id = v_uid and arep.player_profile_id = other.id)
        or (arep.agent_profile_id = other.id and arep.player_profile_id = v_uid)
      )
    limit 1
  ) rep on true
  join public.conversation_participants my_participant
    on my_participant.conversation_id = target_conversation_id
   and my_participant.profile_id = v_uid
  left join public.recruiting_applications application on application.id = target.context_application_id
  left join public.recruiting_ads ad on ad.id = application.ad_id
  left join public.profiles applicant on applicant.id = application.applicant_profile_id;
end;
$$;

revoke all on function public.fetch_direct_conversation_meta(uuid) from public;
grant execute on function public.fetch_direct_conversation_meta(uuid) to authenticated;
