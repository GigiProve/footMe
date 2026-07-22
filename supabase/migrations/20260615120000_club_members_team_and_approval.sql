-- Migration: extend club_members with team assignment, season, currency flag,
-- and a 'pending' status value. Add respond_to_club_membership RPC.

-- New columns
alter table public.club_members
  add column if not exists team_id uuid references public.club_teams(id) on delete set null;

alter table public.club_members
  add column if not exists season text;

alter table public.club_members
  add column if not exists is_current boolean not null default true;

-- Extend status check to include 'pending'
alter table public.club_members
  drop constraint if exists club_members_status_check;

alter table public.club_members
  add constraint club_members_status_check
  check (status in ('pending', 'active', 'rejected', 'removed'));

-- Indexes
create index if not exists club_members_team_idx
  on public.club_members (team_id);

create index if not exists club_members_profile_status_idx
  on public.club_members (profile_id, status);

-- RPC: the linked profile responds to a pending roster assignment.
-- The club admin (via the service layer) inserts the row as status='pending'
-- and sends the 'roster_assignment_pending' notification before calling this.
create or replace function public.respond_to_club_membership(
  p_member_id uuid,
  p_accept    boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current       uuid := auth.uid();
  v_member        public.club_members%rowtype;
  v_club_owner    uuid;
  v_club_name     text;
  v_full_name     text;
  v_action        text;
  v_new_status    text;
begin
  if v_current is null then
    raise exception 'Authentication required';
  end if;

  select * into v_member
  from public.club_members
  where id = p_member_id;

  if not found then
    raise exception 'Richiesta non trovata';
  end if;

  if v_member.profile_id <> v_current then
    raise exception 'Non autorizzato';
  end if;

  if v_member.status <> 'pending' then
    raise exception 'Richiesta già gestita';
  end if;

  v_new_status := case when p_accept then 'active' else 'rejected' end;
  v_action     := case when p_accept then 'accettato' else 'rifiutato' end;

  update public.club_members
  set
    status     = v_new_status,
    updated_at = timezone('utc', now())
  where id = p_member_id;

  -- Notify the club owner
  select c.owner_profile_id, c.name
  into v_club_owner, v_club_name
  from public.clubs c
  where c.id = v_member.club_id;

  select p.full_name into v_full_name
  from public.profiles p
  where p.id = v_current;

  insert into public.notifications (recipient_profile_id, type, title, body, data)
  values (
    v_club_owner,
    'roster_assignment_responded',
    'Risposta alla richiesta di rosa',
    coalesce(v_full_name, 'Un utente') || ' ha ' || v_action || ' di unirsi a ' || coalesce(v_club_name, 'il club'),
    jsonb_build_object(
      'club_id',        v_member.club_id::text,
      'club_member_id', p_member_id::text,
      'team_id',        v_member.team_id::text,
      'accepted',       p_accept
    )
  );
end;
$$;

revoke all on function public.respond_to_club_membership(uuid, boolean) from public;
grant execute on function public.respond_to_club_membership(uuid, boolean) to authenticated;
