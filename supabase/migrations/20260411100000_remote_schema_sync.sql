drop view if exists "public"."pending_club_links";

drop view if exists "public"."profiles_with_age";


  create table "public"."club_affiliations" (
    "club_id" uuid not null,
    "affiliate_club_id" uuid not null,
    "sort_order" integer not null default 0,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."club_affiliations" enable row level security;


  create table "public"."club_follows" (
    "profile_id" uuid not null,
    "club_id" uuid not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."club_follows" enable row level security;


  create table "public"."club_team_profiles" (
    "team_id" uuid not null,
    "competition_name" text,
    "group_name" text,
    "promoted_players_count" integer not null default 0,
    "recent_results" text[] not null default '{}'::text[],
    "media_urls" text[] not null default '{}'::text[],
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."club_team_profiles" enable row level security;

alter table "public"."club_members" add column "team_id" uuid;

alter table "public"."clubs" add column "key_results" text[] not null default '{}'::text[];

alter table "public"."clubs" add column "top_level_reached" text;

alter table "public"."player_profiles" add column "secondary_position" public.player_position;

alter table "public"."profile_private_contacts" add column "phone_country_code" text default '+39'::text;

alter table "public"."profiles" add column "auth_provider" text;

alter table "public"."profiles" add column "onboarding_completed_at" timestamp with time zone;

alter table "public"."recruiting_ads" add column "team_id" uuid;

CREATE INDEX club_affiliations_club_id_idx ON public.club_affiliations USING btree (club_id, sort_order);

CREATE UNIQUE INDEX club_affiliations_pkey ON public.club_affiliations USING btree (club_id, affiliate_club_id);

CREATE INDEX club_follows_club_id_idx ON public.club_follows USING btree (club_id);

CREATE UNIQUE INDEX club_follows_pkey ON public.club_follows USING btree (profile_id, club_id);

CREATE INDEX club_members_team_id_idx ON public.club_members USING btree (team_id);

CREATE UNIQUE INDEX club_team_profiles_pkey ON public.club_team_profiles USING btree (team_id);

CREATE INDEX recruiting_ads_team_id_idx ON public.recruiting_ads USING btree (team_id);

alter table "public"."club_affiliations" add constraint "club_affiliations_pkey" PRIMARY KEY using index "club_affiliations_pkey";

alter table "public"."club_follows" add constraint "club_follows_pkey" PRIMARY KEY using index "club_follows_pkey";

alter table "public"."club_team_profiles" add constraint "club_team_profiles_pkey" PRIMARY KEY using index "club_team_profiles_pkey";

alter table "public"."club_affiliations" add constraint "club_affiliations_affiliate_club_id_fkey" FOREIGN KEY (affiliate_club_id) REFERENCES public.clubs(id) ON DELETE CASCADE not valid;

alter table "public"."club_affiliations" validate constraint "club_affiliations_affiliate_club_id_fkey";

alter table "public"."club_affiliations" add constraint "club_affiliations_club_id_fkey" FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE not valid;

alter table "public"."club_affiliations" validate constraint "club_affiliations_club_id_fkey";

alter table "public"."club_affiliations" add constraint "club_affiliations_not_self" CHECK ((club_id <> affiliate_club_id)) not valid;

alter table "public"."club_affiliations" validate constraint "club_affiliations_not_self";

alter table "public"."club_follows" add constraint "club_follows_club_id_fkey" FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE not valid;

alter table "public"."club_follows" validate constraint "club_follows_club_id_fkey";

alter table "public"."club_follows" add constraint "club_follows_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."club_follows" validate constraint "club_follows_profile_id_fkey";

alter table "public"."club_members" add constraint "club_members_team_id_fkey" FOREIGN KEY (team_id) REFERENCES public.club_teams(id) ON DELETE SET NULL not valid;

alter table "public"."club_members" validate constraint "club_members_team_id_fkey";

alter table "public"."club_team_profiles" add constraint "club_team_profiles_team_id_fkey" FOREIGN KEY (team_id) REFERENCES public.club_teams(id) ON DELETE CASCADE not valid;

alter table "public"."club_team_profiles" validate constraint "club_team_profiles_team_id_fkey";

alter table "public"."recruiting_ads" add constraint "recruiting_ads_team_id_fkey" FOREIGN KEY (team_id) REFERENCES public.club_teams(id) ON DELETE SET NULL not valid;

alter table "public"."recruiting_ads" validate constraint "recruiting_ads_team_id_fkey";

set check_function_bodies = off;

create or replace view "public"."pending_club_links" as  SELECT ce.id AS career_entry_id,
    ce.club_name AS career_club_name,
    ce.player_profile_id,
    p.full_name AS player_name,
    c.id AS candidate_club_id,
    c.name AS candidate_club_name,
    c.city AS candidate_club_city,
    c.region AS candidate_club_region,
        CASE
            WHEN (public.normalize_text(ce.club_name) = c.normalized_name) THEN 'high'::text
            ELSE 'medium'::text
        END AS confidence,
    ce.created_at AS entry_created_at
   FROM ((public.player_career_entries ce
     JOIN public.profiles p ON ((p.id = ce.player_profile_id)))
     CROSS JOIN LATERAL ( SELECT clubs.id,
            clubs.owner_profile_id,
            clubs.name,
            clubs.slug,
            clubs.city,
            clubs.region,
            clubs.category,
            clubs.league,
            clubs.description,
            clubs.logo_url,
            clubs.gallery_urls,
            clubs.created_at,
            clubs.updated_at,
            clubs.founding_year,
            clubs.club_colors,
            clubs.country,
            clubs.headquarters_address,
            clubs.field_address,
            clubs.club_email,
            clubs.club_phone,
            clubs.website_url,
            clubs.normalized_name,
            clubs.verification_status,
            clubs.verified_at,
            clubs.verified_by
           FROM public.clubs
          WHERE (clubs.normalized_name = public.normalize_text(ce.club_name))
         LIMIT 5) c)
  WHERE (ce.club_id IS NULL)
  ORDER BY
        CASE
            WHEN (public.normalize_text(ce.club_name) = c.normalized_name) THEN 0
            ELSE 1
        END, ce.created_at DESC;


create or replace view "public"."profiles_with_age" as  SELECT id,
    role,
    full_name,
    birth_date,
    public.calculate_age(birth_date) AS age,
    nationality,
    bio,
    avatar_url,
    region,
    city,
    is_available,
    is_open_to_transfer,
    languages,
    created_at,
    updated_at
   FROM public.profiles profile;


CREATE OR REPLACE FUNCTION public.save_coach_career_details(p_profile_id uuid, p_coach_profile jsonb DEFAULT '{}'::jsonb, p_career_entries jsonb DEFAULT '[]'::jsonb, p_player_career_entries jsonb DEFAULT '[]'::jsonb, p_director_entries jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  current_profile_id uuid := auth.uid();
begin
  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_user(p_profile_id) then
    raise exception 'Profile not accessible';
  end if;

  insert into public.coach_profiles (
    profile_id,
    licenses,
    coached_clubs,
    coached_categories,
    game_philosophy,
    technical_video_url,
    preferred_regions,
    preferred_provinces,
    availability_type,
    open_to_new_role,
    preferred_formation,
    secondary_formations,
    play_styles,
    current_club,
    contract_end,
    preferred_categories
  )
  select
    p_profile_id,
    coalesce(payload.licenses, '{}'::text[]),
    coalesce(payload.coached_clubs, '{}'::text[]),
    coalesce(payload.coached_categories, '{}'::text[]),
    payload.game_philosophy,
    payload.technical_video_url,
    coalesce(payload.preferred_regions, '{}'::text[]),
    coalesce(payload.preferred_provinces, '{}'::text[]),
    payload.availability_type,
    coalesce(payload.open_to_new_role, false),
    payload.preferred_formation,
    coalesce(payload.secondary_formations, '{}'::text[]),
    coalesce(payload.play_styles, '{}'::text[]),
    payload.current_club,
    payload.contract_end,
    coalesce(payload.preferred_categories, '{}'::text[])
  from jsonb_to_record(coalesce(p_coach_profile, '{}'::jsonb)) as payload(
    licenses text[],
    coached_clubs text[],
    coached_categories text[],
    game_philosophy text,
    technical_video_url text,
    preferred_regions text[],
    preferred_provinces text[],
    availability_type text,
    open_to_new_role boolean,
    preferred_formation text,
    secondary_formations text[],
    play_styles text[],
    current_club text,
    contract_end text,
    preferred_categories text[]
  )
  on conflict (profile_id) do update
  set
    licenses = excluded.licenses,
    coached_clubs = excluded.coached_clubs,
    coached_categories = excluded.coached_categories,
    game_philosophy = excluded.game_philosophy,
    technical_video_url = excluded.technical_video_url,
    preferred_regions = excluded.preferred_regions,
    preferred_provinces = excluded.preferred_provinces,
    availability_type = excluded.availability_type,
    open_to_new_role = excluded.open_to_new_role,
    preferred_formation = excluded.preferred_formation,
    secondary_formations = excluded.secondary_formations,
    play_styles = excluded.play_styles,
    current_club = excluded.current_club,
    contract_end = excluded.contract_end,
    preferred_categories = excluded.preferred_categories,
    updated_at = timezone('utc', now());

  delete from public.coach_career_entries
  where coach_profile_id = p_profile_id;

  insert into public.coach_career_entries (
    id,
    coach_profile_id,
    team_name,
    team_logo_url,
    club_id,
    category,
    role,
    experience_type,
    seasons,
    period_start_month,
    period_start_year,
    period_end_month,
    period_end_year,
    season_details,
    results,
    description,
    sort_order
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    coalesce(entry.team_name, ''),
    entry.team_logo_url,
    entry.club_id,
    entry.category,
    coalesce(entry.role, ''),
    coalesce(entry.experience_type, 'SINGLE_SEASON'),
    coalesce(entry.seasons, '{}'::text[]),
    entry.period_start_month,
    entry.period_start_year,
    entry.period_end_month,
    entry.period_end_year,
    coalesce(entry.season_details, '{}'::jsonb),
    coalesce(entry.results, '[]'::jsonb),
    entry.description,
    coalesce(entry.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_career_entries, '[]'::jsonb)) as entry(
    id uuid,
    team_name text,
    team_logo_url text,
    club_id uuid,
    category text,
    role text,
    experience_type text,
    seasons text[],
    period_start_month text,
    period_start_year integer,
    period_end_month text,
    period_end_year integer,
    season_details jsonb,
    results jsonb,
    description text,
    sort_order integer
  );

  delete from public.coach_player_career_entries
  where coach_profile_id = p_profile_id;

  insert into public.coach_player_career_entries (
    id,
    coach_profile_id,
    team_name,
    team_logo_url,
    season,
    category,
    position,
    appearances,
    goals,
    assists,
    sort_order
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    coalesce(entry.team_name, ''),
    entry.team_logo_url,
    coalesce(entry.season, ''),
    entry.category,
    entry.position,
    coalesce(entry.appearances, 0),
    coalesce(entry.goals, 0),
    coalesce(entry.assists, 0),
    coalesce(entry.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_player_career_entries, '[]'::jsonb)) as entry(
    id uuid,
    team_name text,
    team_logo_url text,
    season text,
    category text,
    position text,
    appearances integer,
    goals integer,
    assists integer,
    sort_order integer
  );

  delete from public.coach_director_career_entries
  where coach_profile_id = p_profile_id;

  insert into public.coach_director_career_entries (
    id,
    coach_profile_id,
    team_name,
    team_logo_url,
    role,
    seasons,
    category,
    description,
    sort_order
  )
  select
    coalesce(entry.id, gen_random_uuid()),
    p_profile_id,
    coalesce(entry.team_name, ''),
    entry.team_logo_url,
    coalesce(entry.role, ''),
    coalesce(entry.seasons, '{}'::text[]),
    entry.category,
    entry.description,
    coalesce(entry.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_director_entries, '[]'::jsonb)) as entry(
    id uuid,
    team_name text,
    team_logo_url text,
    role text,
    seasons text[],
    category text,
    description text,
    sort_order integer
  );
end;
$function$
;

grant delete on table "public"."club_affiliations" to "anon";

grant insert on table "public"."club_affiliations" to "anon";

grant references on table "public"."club_affiliations" to "anon";

grant select on table "public"."club_affiliations" to "anon";

grant trigger on table "public"."club_affiliations" to "anon";

grant truncate on table "public"."club_affiliations" to "anon";

grant update on table "public"."club_affiliations" to "anon";

grant delete on table "public"."club_affiliations" to "authenticated";

grant insert on table "public"."club_affiliations" to "authenticated";

grant references on table "public"."club_affiliations" to "authenticated";

grant select on table "public"."club_affiliations" to "authenticated";

grant trigger on table "public"."club_affiliations" to "authenticated";

grant truncate on table "public"."club_affiliations" to "authenticated";

grant update on table "public"."club_affiliations" to "authenticated";

grant delete on table "public"."club_affiliations" to "service_role";

grant insert on table "public"."club_affiliations" to "service_role";

grant references on table "public"."club_affiliations" to "service_role";

grant select on table "public"."club_affiliations" to "service_role";

grant trigger on table "public"."club_affiliations" to "service_role";

grant truncate on table "public"."club_affiliations" to "service_role";

grant update on table "public"."club_affiliations" to "service_role";

grant delete on table "public"."club_follows" to "anon";

grant insert on table "public"."club_follows" to "anon";

grant references on table "public"."club_follows" to "anon";

grant select on table "public"."club_follows" to "anon";

grant trigger on table "public"."club_follows" to "anon";

grant truncate on table "public"."club_follows" to "anon";

grant update on table "public"."club_follows" to "anon";

grant delete on table "public"."club_follows" to "authenticated";

grant insert on table "public"."club_follows" to "authenticated";

grant references on table "public"."club_follows" to "authenticated";

grant select on table "public"."club_follows" to "authenticated";

grant trigger on table "public"."club_follows" to "authenticated";

grant truncate on table "public"."club_follows" to "authenticated";

grant update on table "public"."club_follows" to "authenticated";

grant delete on table "public"."club_follows" to "service_role";

grant insert on table "public"."club_follows" to "service_role";

grant references on table "public"."club_follows" to "service_role";

grant select on table "public"."club_follows" to "service_role";

grant trigger on table "public"."club_follows" to "service_role";

grant truncate on table "public"."club_follows" to "service_role";

grant update on table "public"."club_follows" to "service_role";

grant delete on table "public"."club_team_profiles" to "anon";

grant insert on table "public"."club_team_profiles" to "anon";

grant references on table "public"."club_team_profiles" to "anon";

grant select on table "public"."club_team_profiles" to "anon";

grant trigger on table "public"."club_team_profiles" to "anon";

grant truncate on table "public"."club_team_profiles" to "anon";

grant update on table "public"."club_team_profiles" to "anon";

grant delete on table "public"."club_team_profiles" to "authenticated";

grant insert on table "public"."club_team_profiles" to "authenticated";

grant references on table "public"."club_team_profiles" to "authenticated";

grant select on table "public"."club_team_profiles" to "authenticated";

grant trigger on table "public"."club_team_profiles" to "authenticated";

grant truncate on table "public"."club_team_profiles" to "authenticated";

grant update on table "public"."club_team_profiles" to "authenticated";

grant delete on table "public"."club_team_profiles" to "service_role";

grant insert on table "public"."club_team_profiles" to "service_role";

grant references on table "public"."club_team_profiles" to "service_role";

grant select on table "public"."club_team_profiles" to "service_role";

grant trigger on table "public"."club_team_profiles" to "service_role";

grant truncate on table "public"."club_team_profiles" to "service_role";

grant update on table "public"."club_team_profiles" to "service_role";


  create policy "club affiliations are readable by authenticated users"
  on "public"."club_affiliations"
  as permissive
  for select
  to authenticated
using (true);



  create policy "club owners can manage affiliations"
  on "public"."club_affiliations"
  as permissive
  for all
  to authenticated
using (public.owns_club(club_id))
with check (public.owns_club(club_id));



  create policy "users can manage own club follows"
  on "public"."club_follows"
  as permissive
  for all
  to authenticated
using (public.is_current_user(profile_id))
with check (public.is_current_user(profile_id));



  create policy "users can read own club follows"
  on "public"."club_follows"
  as permissive
  for select
  to authenticated
using (public.is_current_user(profile_id));



  create policy "Anyone can read team profiles"
  on "public"."club_team_profiles"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Club owner manages team profiles"
  on "public"."club_team_profiles"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.club_teams team
  WHERE ((team.id = club_team_profiles.team_id) AND public.owns_club(team.club_id)))))
with check ((EXISTS ( SELECT 1
   FROM public.club_teams team
  WHERE ((team.id = club_team_profiles.team_id) AND public.owns_club(team.club_id)))));


CREATE TRIGGER set_updated_at_club_team_profiles BEFORE UPDATE ON public.club_team_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

