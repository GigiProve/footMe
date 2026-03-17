create or replace function public.is_current_user(profile_id uuid)
returns boolean
language sql
stable
as $$
  select auth.uid() = profile_id;
$$;

create or replace function public.owns_club(target_club_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.clubs club
    where club.id = target_club_id
      and club.owner_profile_id = auth.uid()
  );
$$;

create or replace function public.is_conversation_participant(target_conversation_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.conversation_participants participant
    where participant.conversation_id = target_conversation_id
      and participant.profile_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.player_profiles enable row level security;
alter table public.player_career_entries enable row level security;
alter table public.coach_profiles enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_staff_members enable row level security;
alter table public.recruiting_ads enable row level security;
alter table public.saved_ads enable row level security;
alter table public.recruiting_applications enable row level security;
alter table public.connections enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles are readable by authenticated users" on public.profiles;
create policy "profiles are readable by authenticated users"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
on public.profiles
for insert
to authenticated
with check (public.is_current_user(id));

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles
for update
to authenticated
using (public.is_current_user(id))
with check (public.is_current_user(id));

drop policy if exists "player profiles are readable by authenticated users" on public.player_profiles;
create policy "player profiles are readable by authenticated users"
on public.player_profiles
for select
to authenticated
using (true);

drop policy if exists "players can manage own player profile" on public.player_profiles;
create policy "players can manage own player profile"
on public.player_profiles
for all
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop policy if exists "player career entries are readable by authenticated users" on public.player_career_entries;
create policy "player career entries are readable by authenticated users"
on public.player_career_entries
for select
to authenticated
using (true);

drop policy if exists "players can manage own career entries" on public.player_career_entries;
create policy "players can manage own career entries"
on public.player_career_entries
for all
to authenticated
using (public.is_current_user(player_profile_id))
with check (public.is_current_user(player_profile_id));

drop policy if exists "coach profiles are readable by authenticated users" on public.coach_profiles;
create policy "coach profiles are readable by authenticated users"
on public.coach_profiles
for select
to authenticated
using (true);

drop policy if exists "coaches can manage own profile" on public.coach_profiles;
create policy "coaches can manage own profile"
on public.coach_profiles
for all
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop policy if exists "staff profiles are readable by authenticated users" on public.staff_profiles;
create policy "staff profiles are readable by authenticated users"
on public.staff_profiles
for select
to authenticated
using (true);

drop policy if exists "staff can manage own profile" on public.staff_profiles;
create policy "staff can manage own profile"
on public.staff_profiles
for all
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop policy if exists "clubs are readable by authenticated users" on public.clubs;
create policy "clubs are readable by authenticated users"
on public.clubs
for select
to authenticated
using (true);

drop policy if exists "club owners can insert clubs" on public.clubs;
create policy "club owners can insert clubs"
on public.clubs
for insert
to authenticated
with check (public.is_current_user(owner_profile_id));

drop policy if exists "club owners can update clubs" on public.clubs;
create policy "club owners can update clubs"
on public.clubs
for update
to authenticated
using (public.is_current_user(owner_profile_id))
with check (public.is_current_user(owner_profile_id));

drop policy if exists "club staff members are readable by authenticated users" on public.club_staff_members;
create policy "club staff members are readable by authenticated users"
on public.club_staff_members
for select
to authenticated
using (true);

drop policy if exists "club owners can manage staff members" on public.club_staff_members;
create policy "club owners can manage staff members"
on public.club_staff_members
for all
to authenticated
using (public.owns_club(club_id))
with check (public.owns_club(club_id));

drop policy if exists "ads are readable by authenticated users" on public.recruiting_ads;
create policy "ads are readable by authenticated users"
on public.recruiting_ads
for select
to authenticated
using (true);

drop policy if exists "club owners can manage ads" on public.recruiting_ads;
create policy "club owners can manage ads"
on public.recruiting_ads
for all
to authenticated
using (public.owns_club(club_id) or public.is_current_user(created_by_profile_id))
with check (public.owns_club(club_id) and public.is_current_user(created_by_profile_id));

drop policy if exists "users manage own saved ads" on public.saved_ads;
create policy "users manage own saved ads"
on public.saved_ads
for all
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

drop policy if exists "application visibility for applicant and club owners" on public.recruiting_applications;
create policy "application visibility for applicant and club owners"
on public.recruiting_applications
for select
to authenticated
using (
  public.is_current_user(applicant_profile_id)
  or exists (
    select 1
    from public.recruiting_ads ad
    where ad.id = recruiting_applications.ad_id
      and public.owns_club(ad.club_id)
  )
);

drop policy if exists "players can create own applications" on public.recruiting_applications;
create policy "players can create own applications"
on public.recruiting_applications
for insert
to authenticated
with check (
  public.is_current_user(applicant_profile_id)
  and public.is_current_user(player_profile_id)
);

drop policy if exists "applicant and club owners can update applications" on public.recruiting_applications;
create policy "applicant and club owners can update applications"
on public.recruiting_applications
for update
to authenticated
using (
  public.is_current_user(applicant_profile_id)
  or exists (
    select 1
    from public.recruiting_ads ad
    where ad.id = recruiting_applications.ad_id
      and public.owns_club(ad.club_id)
  )
)
with check (
  public.is_current_user(applicant_profile_id)
  or exists (
    select 1
    from public.recruiting_ads ad
    where ad.id = recruiting_applications.ad_id
      and public.owns_club(ad.club_id)
  )
);

drop policy if exists "connections are visible to involved users" on public.connections;
create policy "connections are visible to involved users"
on public.connections
for select
to authenticated
using (
  public.is_current_user(requester_profile_id)
  or public.is_current_user(addressee_profile_id)
);

drop policy if exists "users can create connection requests" on public.connections;
create policy "users can create connection requests"
on public.connections
for insert
to authenticated
with check (public.is_current_user(requester_profile_id));

drop policy if exists "users can update own connection requests" on public.connections;
create policy "users can update own connection requests"
on public.connections
for update
to authenticated
using (
  public.is_current_user(requester_profile_id)
  or public.is_current_user(addressee_profile_id)
)
with check (
  public.is_current_user(requester_profile_id)
  or public.is_current_user(addressee_profile_id)
);

drop policy if exists "conversation visibility for participants" on public.conversations;
create policy "conversation visibility for participants"
on public.conversations
for select
to authenticated
using (public.is_conversation_participant(id));

drop policy if exists "authenticated users can create conversations" on public.conversations;
create policy "authenticated users can create conversations"
on public.conversations
for insert
to authenticated
with check (public.is_current_user(created_by_profile_id));

drop policy if exists "participant rows visible to conversation members" on public.conversation_participants;
create policy "participant rows visible to conversation members"
on public.conversation_participants
for select
to authenticated
using (public.is_conversation_participant(conversation_id));

drop policy if exists "users can add themselves as participants" on public.conversation_participants;
create policy "users can add themselves as participants"
on public.conversation_participants
for insert
to authenticated
with check (public.is_current_user(profile_id));

drop policy if exists "messages visible to conversation participants" on public.messages;
create policy "messages visible to conversation participants"
on public.messages
for select
to authenticated
using (public.is_conversation_participant(conversation_id));

drop policy if exists "participants can send messages" on public.messages;
create policy "participants can send messages"
on public.messages
for insert
to authenticated
with check (
  public.is_conversation_participant(conversation_id)
  and public.is_current_user(sender_profile_id)
);

drop policy if exists "participants can update their messages" on public.messages;
create policy "participants can update their messages"
on public.messages
for update
to authenticated
using (
  public.is_conversation_participant(conversation_id)
  and public.is_current_user(sender_profile_id)
)
with check (
  public.is_conversation_participant(conversation_id)
  and public.is_current_user(sender_profile_id)
);