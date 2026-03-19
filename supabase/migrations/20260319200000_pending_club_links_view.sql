-- View for admin dashboard: identifies player career entries that could be
-- linked to registered clubs based on normalized name matching.
--
-- Uses the same normalization logic as the clubs.normalized_name trigger:
-- NFD normalize → strip diacritics → lowercase → replace non-alnum with hyphens → trim hyphens.

create or replace function public.normalize_text(input text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(
      lower(
        translate(
          normalize(input, NFD),
          U&'\0300\0301\0302\0303\0304\0305\0306\0307\0308\030A\030B\030C\030D\030E\030F'
          || U&'\0310\0311\0312\0313\0314\0315\0316\0317\0318\0319\031A\031B\031C\031D\031E\031F'
          || U&'\0320\0321\0322\0323\0324\0325\0326\0327\0328\0329\032A\032B\032C\032D\032E\032F',
          ''
        )
      ),
      '[^a-z0-9]+', '-', 'g'
    ),
    '^-+|-+$', '', 'g'
  );
$$;

-- The view cross-joins unlinked career entries against clubs with matching
-- normalized names. Each row is a suggested link for admin review.
create or replace view public.pending_club_links as
select
  ce.id as career_entry_id,
  ce.club_name as career_club_name,
  ce.player_profile_id,
  p.full_name as player_name,
  c.id as candidate_club_id,
  c.name as candidate_club_name,
  c.city as candidate_club_city,
  c.region as candidate_club_region,
  case
    when public.normalize_text(ce.club_name) = c.normalized_name then 'high'
    else 'medium'
  end as confidence,
  ce.created_at as entry_created_at
from public.player_career_entries ce
join public.profiles p on p.id = ce.player_profile_id
cross join lateral (
  select *
  from public.clubs
  where normalized_name = public.normalize_text(ce.club_name)
  limit 5
) c
where ce.club_id is null
order by
  case when public.normalize_text(ce.club_name) = c.normalized_name then 0 else 1 end,
  ce.created_at desc;

-- Grant access to the view for authenticated users (RLS on underlying tables
-- already restricts what each user can see — admins have SELECT on all).
grant select on public.pending_club_links to authenticated;
