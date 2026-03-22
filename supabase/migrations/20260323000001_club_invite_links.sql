-- Club invite links: shareable tokens for players/staff to join a club.

create table public.club_invite_links (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  member_role text not null,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '30 days'),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.club_invite_links add constraint invite_links_role_check
  check (member_role in ('player', 'staff', 'coach', 'director'));

alter table public.club_invite_links enable row level security;

-- Club owners can fully manage their invite links
create policy "club owners manage invite links"
  on public.club_invite_links for all to authenticated
  using (public.owns_club(club_id))
  with check (public.owns_club(club_id));

-- Authenticated users can read active, non-expired links (needed for joining)
create policy "authenticated can read active invite links"
  on public.club_invite_links for select to authenticated
  using (is_active = true and expires_at > timezone('utc', now()));
