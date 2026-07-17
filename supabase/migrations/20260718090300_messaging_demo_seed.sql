-- Migration: Messaggi inbox demo seed data — direct chats, a group chat, and
-- club communications for the four demo accounts introduced in
-- 20260310000000_dev_seed.sql (club.demo@footme.dev, player.demo@footme.dev,
-- coach.demo@footme.dev, staff.demo@footme.dev) and the demo club
-- (slug asd-footme-demo).
--
-- Entirely guarded behind a lookup of those five ids: if any demo user or
-- the demo club is missing (i.e. this is not a freshly-seeded local/dev
-- environment), the block exits immediately and this migration is a no-op —
-- safe to run in prod.
--
-- All conversation/message/communication ids are fixed UUID constants so the
-- inserts are idempotent via ON CONFLICT DO NOTHING (id is the primary key
-- everywhere here); re-running `supabase db reset` never duplicates rows.
--
-- Mirrors conventions from:
--   20260310000000_dev_seed.sql (demo-email lookups, on conflict do
--                                 nothing/update -> no-op in prod)

do $$
declare
  v_club_admin_id uuid;
  v_player_id     uuid;
  v_coach_id      uuid;
  v_staff_id      uuid;
  v_club_id       uuid;

  v_conv_coach_player uuid := 'a0000000-0000-4000-8000-000000000001';
  v_conv_staff_player uuid := 'a0000000-0000-4000-8000-000000000002';
  v_conv_group        uuid := 'a0000000-0000-4000-8000-000000000003';

  v_comm_squadra uuid := 'c0000000-0000-4000-8000-000000000001';
  v_comm_eventi  uuid := 'c0000000-0000-4000-8000-000000000002';
  v_comm_store   uuid := 'c0000000-0000-4000-8000-000000000003';
  v_comm_societa uuid := 'c0000000-0000-4000-8000-000000000004';
begin
  select p.id into v_club_admin_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = 'club.demo@footme.dev';

  select p.id into v_player_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = 'player.demo@footme.dev';

  select p.id into v_coach_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = 'coach.demo@footme.dev';

  select p.id into v_staff_id
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email = 'staff.demo@footme.dev';

  select c.id into v_club_id
  from public.clubs c
  where c.slug = 'asd-footme-demo';

  if v_club_admin_id is null
     or v_player_id is null
     or v_coach_id is null
     or v_staff_id is null
     or v_club_id is null
  then
    raise notice 'Messaging demo seed skipped: demo users/club not found.';
    return;
  end if;

  -- ==========================================================
  -- Accepted connections (required before direct conversations are
  -- meaningful in the product flow, even though the seed inserts the
  -- conversations directly).
  -- ==========================================================

  insert into public.connections (requester_profile_id, addressee_profile_id, status)
  values (v_coach_id, v_player_id, 'accepted')
  on conflict (requester_profile_id, addressee_profile_id) do nothing;

  insert into public.connections (requester_profile_id, addressee_profile_id, status)
  values (v_staff_id, v_player_id, 'accepted')
  on conflict (requester_profile_id, addressee_profile_id) do nothing;

  -- ==========================================================
  -- Conversation 1: coach <-> player (direct), 1-2 messages unread by player
  -- ==========================================================

  insert into public.conversations (id, created_by_profile_id, conversation_type, created_at)
  values (
    v_conv_coach_player,
    v_coach_id,
    'direct',
    timezone('utc', now()) - interval '3 days'
  )
  on conflict (id) do nothing;

  insert into public.conversation_participants (conversation_id, profile_id, joined_at, last_read_at)
  values
    (v_conv_coach_player, v_coach_id, timezone('utc', now()) - interval '3 days', timezone('utc', now())),
    (v_conv_coach_player, v_player_id, timezone('utc', now()) - interval '3 days', timezone('utc', now()) - interval '36 hours')
  on conflict (conversation_id, profile_id) do nothing;

  insert into public.messages (id, conversation_id, sender_profile_id, body, sent_at, read_at)
  values
    (
      'b0000000-0000-4000-8000-000000000001',
      v_conv_coach_player,
      v_coach_id,
      'Ciao Marco, come procede la preparazione?',
      timezone('utc', now()) - interval '3 days',
      timezone('utc', now()) - interval '3 days' + interval '10 minutes'
    ),
    (
      'b0000000-0000-4000-8000-000000000002',
      v_conv_coach_player,
      v_player_id,
      'Tutto bene mister, sto recuperando bene dall''infortunio.',
      timezone('utc', now()) - interval '2 days',
      timezone('utc', now()) - interval '2 days' + interval '5 minutes'
    ),
    (
      'b0000000-0000-4000-8000-000000000003',
      v_conv_coach_player,
      v_coach_id,
      'Perfetto, ti aspetto in campo giovedi.',
      timezone('utc', now()) - interval '1 day',
      null
    ),
    (
      'b0000000-0000-4000-8000-000000000004',
      v_conv_coach_player,
      v_coach_id,
      'Ciao, possiamo sentirci domani per l''allenamento?',
      timezone('utc', now()) - interval '1 hour',
      null
    )
  on conflict (id) do nothing;

  -- ==========================================================
  -- Conversation 2: staff <-> player (direct), older, fully read
  -- ==========================================================

  insert into public.conversations (id, created_by_profile_id, conversation_type, created_at)
  values (
    v_conv_staff_player,
    v_staff_id,
    'direct',
    timezone('utc', now()) - interval '10 days'
  )
  on conflict (id) do nothing;

  insert into public.conversation_participants (conversation_id, profile_id, joined_at, last_read_at)
  values
    (v_conv_staff_player, v_staff_id, timezone('utc', now()) - interval '10 days', timezone('utc', now())),
    (v_conv_staff_player, v_player_id, timezone('utc', now()) - interval '10 days', timezone('utc', now()))
  on conflict (conversation_id, profile_id) do nothing;

  insert into public.messages (id, conversation_id, sender_profile_id, body, sent_at, read_at)
  values
    (
      'b0000000-0000-4000-8000-000000000005',
      v_conv_staff_player,
      v_staff_id,
      'Ciao Marco, ricordati la seduta di fisioterapia di lunedi.',
      timezone('utc', now()) - interval '10 days',
      timezone('utc', now()) - interval '10 days' + interval '20 minutes'
    ),
    (
      'b0000000-0000-4000-8000-000000000006',
      v_conv_staff_player,
      v_player_id,
      'Perfetto, ci sarò.',
      timezone('utc', now()) - interval '9 days',
      timezone('utc', now()) - interval '9 days' + interval '15 minutes'
    ),
    (
      'b0000000-0000-4000-8000-000000000007',
      v_conv_staff_player,
      v_staff_id,
      'Ottimo lavoro in seduta, continua cosi.',
      timezone('utc', now()) - interval '8 days',
      timezone('utc', now()) - interval '8 days' + interval '30 minutes'
    )
  on conflict (id) do nothing;

  -- ==========================================================
  -- Group conversation: "Prima Squadra - ASD FootMe Demo", 5 messages,
  -- 2 unread for player
  -- ==========================================================

  insert into public.conversations (id, created_by_profile_id, conversation_type, title, created_at)
  values (
    v_conv_group,
    v_club_admin_id,
    'group',
    'Prima Squadra – ASD FootMe Demo',
    timezone('utc', now()) - interval '5 days'
  )
  on conflict (id) do nothing;

  insert into public.conversation_participants (conversation_id, profile_id, joined_at, last_read_at)
  values
    (v_conv_group, v_club_admin_id, timezone('utc', now()) - interval '5 days', timezone('utc', now())),
    (v_conv_group, v_coach_id, timezone('utc', now()) - interval '5 days', timezone('utc', now())),
    (v_conv_group, v_staff_id, timezone('utc', now()) - interval '5 days', timezone('utc', now())),
    (v_conv_group, v_player_id, timezone('utc', now()) - interval '5 days', timezone('utc', now()) - interval '2 days' - interval '12 hours')
  on conflict (conversation_id, profile_id) do nothing;

  insert into public.messages (id, conversation_id, sender_profile_id, body, sent_at, read_at)
  values
    (
      'b0000000-0000-4000-8000-000000000010',
      v_conv_group,
      v_club_admin_id,
      'Buongiorno a tutti, aggiorniamo il gruppo squadra.',
      timezone('utc', now()) - interval '5 days',
      null
    ),
    (
      'b0000000-0000-4000-8000-000000000011',
      v_conv_group,
      v_coach_id,
      'Ricevuto, grazie mister.',
      timezone('utc', now()) - interval '4 days',
      null
    ),
    (
      'b0000000-0000-4000-8000-000000000012',
      v_conv_group,
      v_club_admin_id,
      'Ricordo la riunione di venerdi.',
      timezone('utc', now()) - interval '3 days',
      null
    ),
    (
      'b0000000-0000-4000-8000-000000000013',
      v_conv_group,
      v_staff_id,
      'Confermo la mia presenza.',
      timezone('utc', now()) - interval '2 days',
      null
    ),
    (
      'b0000000-0000-4000-8000-000000000014',
      v_conv_group,
      v_club_admin_id,
      'Allenamento confermato alle 17:00',
      timezone('utc', now()) - interval '30 minutes',
      null
    )
  on conflict (id) do nothing;

  -- ==========================================================
  -- Communications from the demo club
  -- ==========================================================

  insert into public.communications (
    id, sender_club_id, created_by_profile_id, category, title, body,
    audience_label, cta_label, cta_url, published_at
  )
  values
    (
      v_comm_squadra,
      v_club_id,
      v_club_admin_id,
      'squadra',
      'Allenamento Prima squadra alle 17:00',
      'Ci alleniamo oggi alle 17:00 presso il Centro Sportivo Comunale. Portare parastinchi e borraccia personale.',
      'Prima squadra',
      null,
      null,
      timezone('utc', now()) - interval '3 hours'
    ),
    (
      v_comm_eventi,
      v_club_id,
      v_club_admin_id,
      'eventi',
      'Biglietti in vendita dalle 11:00',
      'Da domani alle 11:00 saranno disponibili i biglietti per la prossima partita casalinga. Posti limitati.',
      'Tutti i tesserati',
      'Vedi dettagli biglietti',
      'https://footme.dev/demo/biglietti',
      timezone('utc', now()) - interval '20 hours'
    ),
    (
      v_comm_store,
      v_club_id,
      v_club_admin_id,
      'store',
      'Nuova maglia disponibile',
      'La nuova maglia da gara della stagione è ora disponibile nello Store ufficiale della società.',
      'Tutti i tesserati',
      'Apri Store',
      'https://footme.dev/demo/store',
      timezone('utc', now()) - interval '1 day' - interval '4 hours'
    ),
    (
      v_comm_societa,
      v_club_id,
      v_club_admin_id,
      'societa',
      'Comunicazione ufficiale della società',
      'La società comunica l''aggiornamento del regolamento interno, consultabile in segreteria.',
      'Tutti i tesserati',
      null,
      null,
      timezone('utc', now()) - interval '5 days'
    )
  on conflict (id) do nothing;

  insert into public.communication_recipients (communication_id, profile_id, read_at)
  values
    -- squadra: unread for player, read for coach/staff
    (v_comm_squadra, v_player_id, null),
    (v_comm_squadra, v_coach_id, timezone('utc', now()) - interval '2 hours'),
    (v_comm_squadra, v_staff_id, timezone('utc', now()) - interval '2 hours'),
    -- eventi: unread for player, read for coach/staff
    (v_comm_eventi, v_player_id, null),
    (v_comm_eventi, v_coach_id, timezone('utc', now()) - interval '10 hours'),
    (v_comm_eventi, v_staff_id, timezone('utc', now()) - interval '10 hours'),
    -- store: read for everyone
    (v_comm_store, v_player_id, timezone('utc', now()) - interval '1 day'),
    (v_comm_store, v_coach_id, timezone('utc', now()) - interval '1 day'),
    (v_comm_store, v_staff_id, timezone('utc', now()) - interval '1 day'),
    -- societa: read for everyone
    (v_comm_societa, v_player_id, timezone('utc', now()) - interval '4 days'),
    (v_comm_societa, v_coach_id, timezone('utc', now()) - interval '4 days'),
    (v_comm_societa, v_staff_id, timezone('utc', now()) - interval '4 days')
  on conflict (communication_id, profile_id) do nothing;
end;
$$;
