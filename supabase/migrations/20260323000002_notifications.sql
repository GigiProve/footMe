-- Notifications table for in-app notifications.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index notifications_recipient_unread
  on public.notifications (recipient_profile_id, is_read, created_at desc);

alter table public.notifications enable row level security;

create policy "users can read own notifications"
  on public.notifications for select to authenticated
  using (recipient_profile_id = auth.uid());

create policy "users can update own notifications"
  on public.notifications for update to authenticated
  using (recipient_profile_id = auth.uid())
  with check (recipient_profile_id = auth.uid());

-- Any authenticated user can create notifications (for self-request flow)
create policy "authenticated can insert notifications"
  on public.notifications for insert to authenticated
  with check (true);
