-- Add spoken languages to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{}';

-- Recreate the view to include the new column
DROP VIEW IF EXISTS public.profiles_with_age;
CREATE OR REPLACE VIEW public.profiles_with_age
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
