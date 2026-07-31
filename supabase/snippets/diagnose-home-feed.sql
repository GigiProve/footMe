-- ============================================================
-- Diagnostica: da dove arriva "operator does not exist: app_role = text"
--
-- Da incollare nel SQL Editor di Supabase (progetto remoto).
-- È tutto in una transazione che termina con ROLLBACK: non scrive nulla.
--
-- Chiama a una a una le sei RPC della Home impersonando un utente reale e, per
-- ognuna che fallisce, stampa messaggio + dettaglio + CONTEXT. Il CONTEXT è la
-- parte che serve: nomina la funzione e la riga esatta dello statement che non
-- riesce a pianificare.
-- ============================================================

do $diag$
declare
  v_uid   uuid;
  v_role  text;
  v_msg   text;
  v_det   text;
  v_ctx   text;
  v_n     int;
begin
  -- Un profilo reale qualsiasi. Per usare il TUO, sostituisci con:
  --   v_uid := '<il tuo profiles.id>'::uuid;
  select p.id, p.role::text into v_uid, v_role
  from public.profiles p
  order by p.updated_at desc nulls last
  limit 1;

  if v_uid is null then
    raise notice 'Nessun profilo in tabella: impossibile diagnosticare.';
    return;
  end if;

  raise notice '--- utente di prova: % (ruolo %) ---', v_uid, v_role;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid::text, 'role', 'authenticated')::text, true);

  -- 1) la spina, tab Per te
  begin
    select count(*) into v_n
    from public.fetch_home_feed_page('per_te', null, null, null, null, 0, 10);
    raise notice 'OK   fetch_home_feed_page(per_te)  -> % righe', v_n;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_det = pg_exception_detail,
                            v_ctx = pg_exception_context;
    raise notice 'FAIL fetch_home_feed_page(per_te)';
    raise notice '     messaggio: %', v_msg;
    raise notice '     dettaglio: %', coalesce(v_det, '-');
    raise notice '     context:   %', v_ctx;
  end;

  -- 2) la spina, tab Seguiti
  begin
    select count(*) into v_n
    from public.fetch_home_feed_page('seguiti', null, null, null, null, 0, 10);
    raise notice 'OK   fetch_home_feed_page(seguiti) -> % righe', v_n;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_ctx = pg_exception_context;
    raise notice 'FAIL fetch_home_feed_page(seguiti): %', v_msg;
    raise notice '     context: %', v_ctx;
  end;

  -- 3) profili suggeriti
  begin
    select count(*) into v_n from public.fetch_home_suggested_profiles(6);
    raise notice 'OK   fetch_home_suggested_profiles -> % righe', v_n;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_ctx = pg_exception_context;
    raise notice 'FAIL fetch_home_suggested_profiles: %', v_msg;
    raise notice '     context: %', v_ctx;
  end;

  -- 4) società suggerite
  begin
    select count(*) into v_n from public.fetch_home_suggested_clubs(6);
    raise notice 'OK   fetch_home_suggested_clubs -> % righe', v_n;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_ctx = pg_exception_context;
    raise notice 'FAIL fetch_home_suggested_clubs: %', v_msg;
    raise notice '     context: %', v_ctx;
  end;

  -- 5) nuovi contenuti
  begin
    select count(*) into v_n
    from public.fetch_home_feed_updates('per_te', now() - interval '1 day');
    raise notice 'OK   fetch_home_feed_updates -> % righe', v_n;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_ctx = pg_exception_context;
    raise notice 'FAIL fetch_home_feed_updates: %', v_msg;
    raise notice '     context: %', v_ctx;
  end;

  -- 6) stato dei seguiti
  begin
    select count(*) into v_n from public.fetch_home_following_state();
    raise notice 'OK   fetch_home_following_state -> % righe', v_n;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_ctx = pg_exception_context;
    raise notice 'FAIL fetch_home_following_state: %', v_msg;
    raise notice '     context: %', v_ctx;
  end;

  -- 7) modulo di primo accesso (questa scrive: la transazione fa rollback)
  begin
    select count(*) into v_n from public.fetch_my_feed_intro();
    raise notice 'OK   fetch_my_feed_intro -> % righe', v_n;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_ctx = pg_exception_context;
    raise notice 'FAIL fetch_my_feed_intro: %', v_msg;
    raise notice '     context: %', v_ctx;
  end;

  -- 8) le viste su cui poggia la spina, isolate
  begin
    select count(*) into v_n from public.feed_content_index;
    raise notice 'OK   feed_content_index -> % righe', v_n;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_ctx = pg_exception_context;
    raise notice 'FAIL feed_content_index: %', v_msg;
    raise notice '     context: %', v_ctx;
  end;

  begin
    select count(*) into v_n from public.media_content_engagement;
    raise notice 'OK   media_content_engagement -> % righe', v_n;
  exception when others then
    get stacked diagnostics v_msg = message_text, v_ctx = pg_exception_context;
    raise notice 'FAIL media_content_engagement: %', v_msg;
    raise notice '     context: %', v_ctx;
  end;
end
$diag$;

-- Stato delle versioni in remoto: serve a escludere disallineamenti.
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as argomenti
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'footme_feed%' or p.proname like 'fetch_home%')
order by p.proname, argomenti;
