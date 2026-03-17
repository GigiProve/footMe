insert into public.profiles (id, role, full_name, region, city, is_available)
select auth_user.id, 'club_admin', 'Demo Club Admin', 'Lombardia', 'Milano', true
from auth.users auth_user
where auth_user.email = 'club.demo@footme.dev'
on conflict (id) do update set
  role = excluded.role,
  full_name = excluded.full_name,
  region = excluded.region,
  city = excluded.city,
  is_available = excluded.is_available;

insert into public.profiles (id, role, full_name, region, city, is_available)
select auth_user.id, 'player', 'Marco Rossi', 'Lombardia', 'Bergamo', true
from auth.users auth_user
where auth_user.email = 'player.demo@footme.dev'
on conflict (id) do update set
  role = excluded.role,
  full_name = excluded.full_name,
  region = excluded.region,
  city = excluded.city,
  is_available = excluded.is_available;

insert into public.profiles (id, role, full_name, region, city, is_available)
select auth_user.id, 'coach', 'Luca Bianchi', 'Lazio', 'Roma', true
from auth.users auth_user
where auth_user.email = 'coach.demo@footme.dev'
on conflict (id) do update set
  role = excluded.role,
  full_name = excluded.full_name,
  region = excluded.region,
  city = excluded.city,
  is_available = excluded.is_available;

insert into public.profiles (id, role, full_name, region, city, is_available)
select auth_user.id, 'staff', 'Andrea Verdi', 'Veneto', 'Verona', true
from auth.users auth_user
where auth_user.email = 'staff.demo@footme.dev'
on conflict (id) do update set
  role = excluded.role,
  full_name = excluded.full_name,
  region = excluded.region,
  city = excluded.city,
  is_available = excluded.is_available;

insert into public.player_profiles (profile_id, primary_position, preferred_foot, willing_to_change_club, preferred_categories)
select profile.id, 'forward', 'right', true, array['Eccellenza', 'Promozione']::text[]
from public.profiles profile
join auth.users auth_user on auth_user.id = profile.id
where auth_user.email = 'player.demo@footme.dev'
on conflict (profile_id) do update set
  primary_position = excluded.primary_position,
  preferred_foot = excluded.preferred_foot,
  willing_to_change_club = excluded.willing_to_change_club,
  preferred_categories = excluded.preferred_categories;

insert into public.coach_profiles (profile_id, open_to_new_role, coached_categories)
select profile.id, true, array['Eccellenza', 'Serie D']::text[]
from public.profiles profile
join auth.users auth_user on auth_user.id = profile.id
where auth_user.email = 'coach.demo@footme.dev'
on conflict (profile_id) do update set
  open_to_new_role = excluded.open_to_new_role,
  coached_categories = excluded.coached_categories;

insert into public.staff_profiles (profile_id, specialization, open_to_work)
select profile.id, 'fitness_coach', true
from public.profiles profile
join auth.users auth_user on auth_user.id = profile.id
where auth_user.email = 'staff.demo@footme.dev'
on conflict (profile_id) do update set
  specialization = excluded.specialization,
  open_to_work = excluded.open_to_work;

insert into public.clubs (owner_profile_id, name, slug, city, region, category, league, description)
select profile.id, 'ASD FootMe Demo', 'asd-footme-demo', 'Milano', 'Lombardia', 'Eccellenza', 'Eccellenza Lombardia', 'Societa demo per test recruiting e onboarding.'
from public.profiles profile
join auth.users auth_user on auth_user.id = profile.id
where auth_user.email = 'club.demo@footme.dev'
on conflict (slug) do update set
  owner_profile_id = excluded.owner_profile_id,
  city = excluded.city,
  region = excluded.region,
  category = excluded.category,
  league = excluded.league,
  description = excluded.description;

insert into public.recruiting_ads (club_id, created_by_profile_id, title, role_required, age_min, age_max, category, region, compensation_summary, description, status, published_at)
select club.id, profile.id, 'Cerchiamo attaccante classe 2002', 'forward', 18, 24, 'Eccellenza', 'Lombardia', 'Rimborso spese e bonus presenze', 'Ricerca urgente per rinforzare il reparto offensivo.', 'published', timezone('utc', now())
from public.clubs club
join public.profiles profile on profile.id = club.owner_profile_id
join auth.users auth_user on auth_user.id = profile.id
where auth_user.email = 'club.demo@footme.dev'
  and not exists (
    select 1 from public.recruiting_ads ad where ad.club_id = club.id and ad.title = 'Cerchiamo attaccante classe 2002'
  );