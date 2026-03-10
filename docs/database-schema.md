# footMe Initial Database Model

## Obiettivo

Questo schema copre il primo slice tecnico richiesto per utenti, profili, club, annunci, candidature e messaggi.

File SQL di riferimento:

- `supabase/migrations/20260309_initial_schema.sql`
- `supabase/migrations/20260309_rls_policies.sql`
- `supabase/migrations/20260310_search_helpers.sql`
- `supabase/migrations/20260310_dev_seed.sql`

## Entita' principali

- `profiles`: anagrafica comune per tutti gli utenti applicativi collegata a `auth.users`
- `player_profiles`: estensione del profilo per calciatori
- `coach_profiles`: estensione del profilo per allenatori
- `staff_profiles`: estensione del profilo per staff tecnico
- `clubs`: pagina societa' e dati club
- `club_staff_members`: collegamento tra club e membri staff
- `player_career_entries`: cronologia carriera sportiva del giocatore
- `recruiting_ads`: annunci di ricerca pubblicati dai club
- `saved_ads`: annunci salvati dagli utenti
- `recruiting_applications`: candidature dei giocatori agli annunci
- `connections`: relazioni di networking tra profili
- `conversations`: conversazioni private
- `conversation_participants`: partecipanti alle conversazioni
- `messages`: messaggi scambiati nelle conversazioni

## Scelte di modellazione

- L'identita' autenticata resta in `auth.users`; il dominio applicativo vive in `public.profiles` e tabelle collegate.
- I profili sono separati per ruolo per evitare una tabella unica troppo sparsa e fragile.
- I club hanno una tabella dedicata per permettere ownership, pagina pubblica e gestione recruiting.
- Le candidature referenziano sia il profilo utente sia il profilo giocatore per semplificare ricerca e validazione.
- La messaggistica usa `conversations` e `conversation_participants` per restare estendibile oltre il semplice 1:1.

## Passi successivi sul database

- definire viste o funzioni per ricerca e feed
- introdurre notifiche e audit trail
- modellare shop e ordini in una migration successiva

## Sicurezza iniziale

- Le tabelle del dominio applicativo sono protette con RLS per profili, club, annunci, candidature, connessioni e messaggi.
- I profili sono leggibili dagli utenti autenticati, ma scrivibili solo dal proprietario del record.
- Club e annunci sono modificabili solo dal profilo proprietario o dal creatore autorizzato.
- Conversazioni e messaggi sono visibili solo ai partecipanti.

## Onboarding applicativo

- Il primo accesso autenticato senza record in `profiles` viene considerato `needsOnboarding` dal client mobile.
- L'onboarding iniziale crea il record in `profiles` e una delle strutture minime collegate: `player_profiles`, `coach_profiles`, `staff_profiles` o `clubs`.

## Seed e helper di ricerca

- `20260310_dev_seed.sql` aggiunge dati demo se gli utenti auth demo esistono gia' nel progetto.
- `20260310_search_helpers.sql` aggiunge `search_profiles(...)` e `search_recruiting_ads(...)` per supportare le prime schermate di discovery e recruiting.
