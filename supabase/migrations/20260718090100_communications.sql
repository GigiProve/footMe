-- Migration: Club broadcast communications — public.communications and
-- public.communication_recipients. One-to-many announcements from a club to
-- its tesserati (players/coaches/staff), surfaced alongside chats in the
-- Messaggi inbox. Authoring (who gets fanned out as a recipient row) is out
-- of scope for this feature slice: no INSERT/UPDATE/DELETE policy exists for
-- authenticated users on either table. Read-state (marking as read) goes
-- exclusively through the security-definer RPCs in
-- 20260718090200_communication_rpcs.sql.
--
-- Mirrors conventions from:
--   20260717090100_club_shortlists.sql (text columns + named check
--                                        constraints, index if not exists,
--                                        set_updated_at trigger)
--   20260619100000_content_tag_states_targets_reports.sql (parent-scoped RLS
--                                        via exists/join)


-- ============================================================
-- TABLE: public.communications
-- ============================================================

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  sender_club_id uuid not null references public.clubs(id) on delete cascade,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  category text not null default 'societa',
  title text not null,
  body text not null,
  audience_label text not null default 'Tutti i tesserati',
  cta_label text,
  cta_url text,
  published_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.communications
  add constraint communications_category_check
  check (category in (
    'societa',
    'squadra',
    'store',
    'eventi'
  ));

create index if not exists communications_sender_published_idx
  on public.communications (sender_club_id, published_at desc);

create trigger set_updated_at_communications
  before update on public.communications
  for each row execute function public.set_updated_at();


-- ============================================================
-- TABLE: public.communication_recipients
-- ============================================================

create table if not exists public.communication_recipients (
  communication_id uuid not null references public.communications(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (communication_id, profile_id)
);

create index if not exists communication_recipients_profile_idx
  on public.communication_recipients (profile_id, read_at);


-- ============================================================
-- RLS: public.communications
--
-- Visible to recipients (their own communication_recipients row) or to the
-- sending club's owner. No insert/update/delete policy: authoring is out of
-- scope for this migration.
-- ============================================================

alter table public.communications enable row level security;

drop policy if exists "recipients and club owner read communications" on public.communications;
create policy "recipients and club owner read communications"
on public.communications
for select
to authenticated
using (
  exists (
    select 1
    from public.communication_recipients r
    where r.communication_id = communications.id
      and r.profile_id = auth.uid()
  )
  or exists (
    select 1
    from public.clubs c
    where c.id = communications.sender_club_id
      and c.owner_profile_id = auth.uid()
  )
);


-- ============================================================
-- RLS: public.communication_recipients
--
-- Visible to the recipient themselves or to the owner of the parent
-- communication's sending club. No insert/update/delete policy: fan-out and
-- read-state writes go exclusively through security-definer RPCs.
-- ============================================================

alter table public.communication_recipients enable row level security;

drop policy if exists "recipient or club owner reads recipient rows" on public.communication_recipients;
create policy "recipient or club owner reads recipient rows"
on public.communication_recipients
for select
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.communications c
    join public.clubs club on club.id = c.sender_club_id
    where c.id = communication_recipients.communication_id
      and club.owner_profile_id = auth.uid()
  )
);
