-- Migration: fan_tribuna polymorphic tag targets + new post kinds (opinion, photo).
-- Part of RET-04 fan content + tag (Fase 1).
--
-- Source state:
--   fan_tribuna_posts         kind_check named fan_tribuna_posts_kind_check
--                             kind_check_v2 may already exist (drop-if-exists is safe)
--   fan_tribuna_tagged_players surrogate PK id uuid; player_profile_id NOT NULL;
--                             status check widened to v2 by 20260619100000;
--                             inline unique(post_id, player_profile_id) →
--                             auto-named fan_tribuna_tagged_players_post_id_player_profile_id_key
--   fan_tribuna_poll_options  id, post_id, label, sort_order; no target columns yet
--
-- All DDL uses drop-if-exists / if-not-exists for replay safety, mirroring
-- 20260619100000_content_tag_states_targets_reports.sql.


-- ============================================================
-- SECTION A: Widen fan_tribuna_posts.kind + add media columns
-- ============================================================

-- A1. Drop old and any v2 kind check, then add v2 including opinion and photo.
alter table public.fan_tribuna_posts
  drop constraint if exists fan_tribuna_posts_kind_check;
alter table public.fan_tribuna_posts
  drop constraint if exists fan_tribuna_posts_kind_check_v2;

alter table public.fan_tribuna_posts
  add constraint fan_tribuna_posts_kind_check_v2
  check (kind in ('poll', 'proposal', 'formation', 'opinion', 'photo'));

-- A2. Add media columns (all nullable; only photo posts use them).
alter table public.fan_tribuna_posts
  add column if not exists media_url text;

alter table public.fan_tribuna_posts
  add column if not exists media_type text;

alter table public.fan_tribuna_posts
  add column if not exists thumbnail_url text;

-- A3. Named check for media_type.
alter table public.fan_tribuna_posts
  drop constraint if exists fan_tribuna_posts_media_type_check;

alter table public.fan_tribuna_posts
  add constraint fan_tribuna_posts_media_type_check
  check (media_type is null or media_type in ('image', 'video'));


-- ============================================================
-- SECTION B: Polymorphic targets on fan_tribuna_tagged_players
-- ============================================================
--
-- STRICT ORDER — high-risk step. Mirror of Section 2 in 20260619100000.
-- player_profile_id FK to profiles is retained (nullable after step B7)
-- so legacy rows and existing RLS keep working. target_type/target_id
-- are the canonical identity for new rows.

-- B1. Add new columns.
alter table public.fan_tribuna_tagged_players
  add column if not exists target_type text;
alter table public.fan_tribuna_tagged_players
  add column if not exists target_id uuid;

-- B2. Backfill all existing rows (all are profile targets).
update public.fan_tribuna_tagged_players
  set target_type = 'profile',
      target_id   = player_profile_id
  where target_type is null;

-- B3. NOT NULL + default on target_type; named check.
alter table public.fan_tribuna_tagged_players
  alter column target_type set default 'profile',
  alter column target_type set not null;

alter table public.fan_tribuna_tagged_players
  drop constraint if exists fan_tribuna_tagged_players_target_type_check;
alter table public.fan_tribuna_tagged_players
  add constraint fan_tribuna_tagged_players_target_type_check
  check (target_type in ('profile', 'club', 'team'));

-- B4. BEFORE INSERT trigger to auto-fill target_id from player_profile_id when
--     the legacy client omits target_id, preserving backward compatibility.
create or replace function public.fan_tribuna_tagged_players_before_insert()
returns trigger
language plpgsql
as $$
begin
  if new.target_id is null and new.player_profile_id is not null then
    new.target_id := new.player_profile_id;
  end if;
  return new;
end;
$$;

drop trigger if exists fan_tribuna_tagged_players_autofill_target
  on public.fan_tribuna_tagged_players;

create trigger fan_tribuna_tagged_players_autofill_target
  before insert on public.fan_tribuna_tagged_players
  for each row execute function public.fan_tribuna_tagged_players_before_insert();

-- B5. Defensive dedup before creating the unique index:
--     keep the row with the lowest ctid for each (post_id, target_type, target_id)
--     pair, deleting all others. This prevents the subsequent CREATE UNIQUE INDEX
--     from failing if any duplicate rows were inserted before this migration ran.
delete from public.fan_tribuna_tagged_players a
  using public.fan_tribuna_tagged_players b
  where a.post_id    = b.post_id
    and a.target_type = b.target_type
    and a.target_id   = b.target_id
    and a.ctid > b.ctid;

-- B6. Drop the old inline unique on (post_id, player_profile_id).
--     The surrogate PK (id) is untouched — do NOT add a new id column.
alter table public.fan_tribuna_tagged_players
  drop constraint if exists fan_tribuna_tagged_players_post_id_player_profile_id_key;

-- B7. Make player_profile_id and display_name nullable so club/team target rows
--     do not need to supply them.
alter table public.fan_tribuna_tagged_players
  alter column player_profile_id drop not null;
alter table public.fan_tribuna_tagged_players
  alter column display_name drop not null;

-- B8. New unique index on (post_id, target_type, target_id) and reverse-lookup index.
create unique index if not exists fan_tribuna_tagged_players_post_target_uniq
  on public.fan_tribuna_tagged_players (post_id, target_type, target_id);

create index if not exists fan_tribuna_tagged_players_target_idx
  on public.fan_tribuna_tagged_players (target_type, target_id);

-- B9. RLS UPDATE policies so tagged parties can moderate their own tag row.

-- Tagged profile can hide/remove their own tag.
drop policy if exists "tagged profile can moderate own fan tribuna tag"
  on public.fan_tribuna_tagged_players;
create policy "tagged profile can moderate own fan tribuna tag"
  on public.fan_tribuna_tagged_players
  for update
  to authenticated
  using (
    target_type = 'profile'
    and player_profile_id = auth.uid()
  )
  with check (
    target_type = 'profile'
    and player_profile_id = auth.uid()
  );

-- Club owner can moderate a club or team tag on a fan tribuna post.
drop policy if exists "club owner can moderate club or team tag on fan tribuna"
  on public.fan_tribuna_tagged_players;
create policy "club owner can moderate club or team tag on fan tribuna"
  on public.fan_tribuna_tagged_players
  for update
  to authenticated
  using (
    target_type in ('club', 'team')
    and (
      (target_type = 'club'  and public.owns_club(target_id))
      or
      (target_type = 'team'  and exists (
        select 1
        from public.club_teams ct
        where ct.id = target_id
          and public.owns_club(ct.club_id)
      ))
    )
  )
  with check (
    target_type in ('club', 'team')
    and (
      (target_type = 'club'  and public.owns_club(target_id))
      or
      (target_type = 'team'  and exists (
        select 1
        from public.club_teams ct
        where ct.id = target_id
          and public.owns_club(ct.club_id)
      ))
    )
  );


-- ============================================================
-- SECTION C: Optional target columns on fan_tribuna_poll_options
-- ============================================================

-- C1. Add nullable target columns so poll options can reference a taggable entity.
alter table public.fan_tribuna_poll_options
  add column if not exists target_type text;
alter table public.fan_tribuna_poll_options
  add column if not exists target_id uuid;

-- C2. Named check on target_type.
alter table public.fan_tribuna_poll_options
  drop constraint if exists fan_tribuna_poll_options_target_type_check;
alter table public.fan_tribuna_poll_options
  add constraint fan_tribuna_poll_options_target_type_check
  check (target_type is null or target_type in ('profile', 'club', 'team'));
