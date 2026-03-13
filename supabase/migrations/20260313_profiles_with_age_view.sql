create or replace function public.calculate_age(birth_date date)
returns integer
language sql
stable
as $$
  select case
    when birth_date is null then null
    else extract(year from age(current_date, birth_date))::integer
  end;
$$;

create or replace view public.profiles_with_age
with (security_invoker = true) as
select
  profile.id,
  profile.role,
  profile.full_name,
  profile.birth_date,
  public.calculate_age(profile.birth_date) as age,
  profile.nationality,
  profile.bio,
  profile.avatar_url,
  profile.region,
  profile.city,
  profile.is_available,
  profile.is_open_to_transfer,
  profile.created_at,
  profile.updated_at
from public.profiles profile;

grant select on public.profiles_with_age to anon;
grant select on public.profiles_with_age to authenticated;
