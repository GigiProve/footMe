create table if not exists public.profile_contacts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  instagram text,
  facebook text,
  email text,
  show_instagram boolean not null default false,
  show_facebook boolean not null default false,
  show_email boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profile_private_contacts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  phone text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profile_contacts enable row level security;
alter table public.profile_private_contacts enable row level security;

create policy "users can read own profile contacts"
on public.profile_contacts
for select
to authenticated
using (public.is_current_user(profile_id));

create policy "users can manage own profile contacts"
on public.profile_contacts
for all
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

create policy "users can read own private contacts"
on public.profile_private_contacts
for select
to authenticated
using (public.is_current_user(profile_id));

create policy "users can manage own private contacts"
on public.profile_private_contacts
for all
to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));

create or replace function public.get_profile_public_contacts(target_profile_id uuid)
returns table (
  instagram text,
  facebook text,
  email text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    case when contact.show_instagram then contact.instagram else null end as instagram,
    case when contact.show_facebook then contact.facebook else null end as facebook,
    case when contact.show_email then contact.email else null end as email
  from public.profile_contacts contact
  where contact.profile_id = target_profile_id;
$$;

revoke all on function public.get_profile_public_contacts(uuid) from public;
grant execute on function public.get_profile_public_contacts(uuid) to authenticated;

insert into public.profile_private_contacts (profile_id, phone)
select profile.id, profile.phone_number
from public.profiles profile
where profile.phone_number is not null
on conflict (profile_id) do update
set phone = excluded.phone;

update public.profiles
set phone_number = null
where phone_number is not null;

drop trigger if exists profile_contacts_set_updated_at on public.profile_contacts;
create trigger profile_contacts_set_updated_at
before update on public.profile_contacts
for each row execute procedure public.set_updated_at();

drop trigger if exists profile_private_contacts_set_updated_at on public.profile_private_contacts;
create trigger profile_private_contacts_set_updated_at
before update on public.profile_private_contacts
for each row execute procedure public.set_updated_at();

alter table public.messages
add column if not exists message_kind text not null default 'text';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_message_kind_check'
  ) then
    alter table public.messages
    add constraint messages_message_kind_check
    check (message_kind in ('text', 'contact_card'));
  end if;
end
$$;

alter table public.messages
add column if not exists shared_contact_name text;

alter table public.messages
add column if not exists shared_contact_phone text;

create or replace function public.get_conversation_messages(target_conversation_id uuid)
returns table (
  message_id uuid,
  body text,
  sent_at timestamptz,
  read_at timestamptz,
  sender_profile_id uuid,
  sender_full_name text,
  message_kind text,
  shared_contact_name text,
  shared_contact_phone text
)
language sql
stable
as $$
  select
    message.id as message_id,
    message.body,
    message.sent_at,
    message.read_at,
    sender_profile.id as sender_profile_id,
    sender_profile.full_name as sender_full_name,
    message.message_kind,
    message.shared_contact_name,
    message.shared_contact_phone
  from public.messages message
  join public.profiles sender_profile on sender_profile.id = message.sender_profile_id
  where message.conversation_id = target_conversation_id
    and exists (
      select 1
      from public.conversation_participants participant
      where participant.conversation_id = target_conversation_id
        and participant.profile_id = auth.uid()
    )
  order by message.sent_at asc;
$$;
