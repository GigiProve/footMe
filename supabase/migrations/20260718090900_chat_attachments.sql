-- Migration: chat attachments — widen message_kind, private chat-media
-- bucket + storage policies, and rebuild get_conversation_messages() to
-- surface media_url (messages.media_url already existed since
-- 20260309000000_initial_schema.sql, it was just never selected).
--
-- Mirrors conventions from:
--   20260312000001_profile_media_storage.sql (bucket insert + storage.objects
--     policy shape; this bucket is private, unlike profile-media)
--   20260313000002_profile_contacts_and_contact_cards.sql /
--     20260313000005_remote_schema_sync.sql (get_conversation_messages
--     current shape, drop+recreate pattern for a changed return table)


-- ============================================================
-- Widen public.messages.message_kind check
-- ============================================================

alter table public.messages
  drop constraint if exists messages_message_kind_check;

alter table public.messages
  add constraint messages_message_kind_check
  check (message_kind in ('text', 'contact_card', 'image', 'video', 'document'));


-- ============================================================
-- Storage bucket: chat-media (private)
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  26214400, -- 25 MB
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'video/mp4',
    'video/quicktime',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

-- Objects are keyed as <conversation_id>/<file>; (storage.foldername(name))[1]
-- is the conversation id, gated by the same is_conversation_participant()
-- helper used for the messages/conversation_participants RLS policies.

drop policy if exists "chat media readable by participants" on storage.objects;
create policy "chat media readable by participants"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-media'
  and public.is_conversation_participant(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "chat media upload by participants" on storage.objects;
create policy "chat media upload by participants"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-media'
  and public.is_conversation_participant(((storage.foldername(name))[1])::uuid)
  and not public.is_direct_conversation_blocked(((storage.foldername(name))[1])::uuid)
);

-- owner_id (text) is the current storage-api uploader identity column;
-- owner (uuid) is deprecated and can be null on current storage-api
-- versions, so it is not used here to avoid silently blocking legitimate
-- deletes for uploads where it was never populated.
drop policy if exists "chat media delete by uploader" on storage.objects;
create policy "chat media delete by uploader"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-media'
  and owner_id = (auth.uid())::text
);


-- ============================================================
-- Rebuild: public.get_conversation_messages — adds media_url.
-- ============================================================

drop function if exists public.get_conversation_messages(uuid);

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
  shared_contact_phone text,
  media_url text
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
    message.shared_contact_phone,
    message.media_url
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

revoke all on function public.get_conversation_messages(uuid) from public;
grant execute on function public.get_conversation_messages(uuid) to authenticated;
