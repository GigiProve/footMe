-- Drop and recreate profiles_with_age view to include languages column
DROP VIEW IF EXISTS public.profiles_with_age;

CREATE VIEW public.profiles_with_age
WITH (security_invoker = true) AS
SELECT
  profile.id,
  profile.role,
  profile.full_name,
  profile.birth_date,
  public.calculate_age(profile.birth_date) AS age,
  profile.nationality,
  profile.bio,
  profile.avatar_url,
  profile.region,
  profile.city,
  profile.is_available,
  profile.is_open_to_transfer,
  profile.languages,
  profile.created_at,
  profile.updated_at
FROM public.profiles profile;

GRANT SELECT ON public.profiles_with_age TO anon;
GRANT SELECT ON public.profiles_with_age TO authenticated;
