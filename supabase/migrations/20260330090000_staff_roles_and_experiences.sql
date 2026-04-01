alter table public.staff_profiles
add column if not exists staff_roles text[] not null default '{}',
add column if not exists primary_staff_role text,
add column if not exists experience_entries jsonb not null default '[]'::jsonb;

update public.staff_profiles
set
  staff_roles = case
    when coalesce(array_length(staff_roles, 1), 0) = 0 then array[
      case specialization
        when 'fitness_coach'::public.staff_specialization then 'Preparatore atletico'
        when 'goalkeeper_coach'::public.staff_specialization then 'Preparatore dei portieri'
        when 'physiotherapist'::public.staff_specialization then 'Fisioterapista'
        when 'match_analyst'::public.staff_specialization then 'Match analyst'
        when 'team_manager'::public.staff_specialization then 'Team manager'
        else 'Collaboratore tecnico'
      end
    ]
    else staff_roles
  end,
  primary_staff_role = coalesce(
    primary_staff_role,
    case specialization
      when 'fitness_coach'::public.staff_specialization then 'Preparatore atletico'
      when 'goalkeeper_coach'::public.staff_specialization then 'Preparatore dei portieri'
      when 'physiotherapist'::public.staff_specialization then 'Fisioterapista'
      when 'match_analyst'::public.staff_specialization then 'Match analyst'
      when 'team_manager'::public.staff_specialization then 'Team manager'
      else 'Collaboratore tecnico'
    end
  )
where true;
