# Supabase Setup

## Obiettivo

Questo documento collega il repository a un progetto Supabase reale senza bloccare lo sviluppo locale del client mobile.

## Variabili richieste per l'app mobile

Compila `apps/mobile/.env.local` partendo da `apps/mobile/.env.example`.

Variabili richieste:

- `SUPABASE_PROJECT_REF`: reference del progetto Supabase
- `EXPO_PUBLIC_SUPABASE_URL`: URL pubblico del progetto
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: anon key pubblica del progetto

Esempio:

```env
SUPABASE_PROJECT_REF=abcdefghijklmno
EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijklmno.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Procedura consigliata

1. Crea un progetto Supabase dal dashboard.
2. Recupera `Project URL`, `anon public key` e `project ref` dal progetto.
3. Crea `apps/mobile/.env.local` con quei valori.
4. Collega il repository al progetto remoto:
   - `npm run supabase:link`
5. Applica le migration SQL del repository al database remoto:
   - `npm run supabase:db:push`
6. Se devi ricreare il database locale da zero:
   - `npm run supabase:db:reset`

Le migration versionate nel repository sono:

- `supabase/migrations/20260309_initial_schema.sql`
- `supabase/migrations/20260309_rls_policies.sql`
- `supabase/migrations/20260310_search_helpers.sql`
- `supabase/migrations/20260311_networking_helpers.sql`
- `supabase/migrations/20260312_onboarding_profile_fields.sql`
- `supabase/migrations/20260312_profile_media_storage.sql`
- `supabase/migrations/20260313_player_sports_information.sql`
- `supabase/migrations/20260313_profile_contacts_and_contact_cards.sql`
- `supabase/migrations/20260313_public_profile_bio_search.sql`
- `supabase/migrations/20260313_profiles_with_age_view.sql`
- `supabase/migrations/20260313_remote_schema_sync.sql`
- `supabase/migrations/20260310_dev_seed.sql`

`20260313_remote_schema_sync.sql` esiste per riallineare progetti remoti rimasti indietro o aggiornati manualmente fuori ordine. Su database nuovi resta idempotente, mentre su database gia' esistenti evita di dover correggere a mano funzioni e colonne mancanti.

7. Avvia l'app mobile con `npm run start:mobile` dal root oppure `npm run start` in `apps/mobile`.

## Script utili del repository

Dal root puoi usare questi comandi senza richiamare direttamente la CLI:

- `npm run supabase:link`
- `npm run supabase:db:push`
- `npm run supabase:db:reset`
- `npm run supabase:migration:list`

Se la CLI Supabase non e' installata globalmente, questi script usano `npx`.

## Cambio branch

Se cambi branch e il mobile inizia a fallire su salvataggi o query Supabase, la prima verifica da fare e' l'allineamento delle migration.

Procedura rapida:

1. `npm run supabase:migration:list`
2. `npm run supabase:db:push`
3. Ritesta il flusso mobile

Segnali tipici di database fuori sync:

- `column does not exist`
- `relation does not exist`
- errori RLS comparsi dopo il cambio branch
- form che prima salvavano e ora restituiscono sempre errore

## Nota pratica

Il repository non puo' collegarsi automaticamente a un progetto Supabase reale senza le tue credenziali o il project ref corretto. Per questo il setup e' stato reso esplicito e versionato nel repo.

## Dati demo

La migration `20260310_dev_seed.sql` inserisce dati demo solo se nel progetto esistono gia' utenti auth con queste email:

- `club.demo@footme.dev`
- `player.demo@footme.dev`
- `coach.demo@footme.dev`
- `staff.demo@footme.dev`

Se questi utenti non esistono, la migration non fallisce: semplicemente non inserisce i record dipendenti.
