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
4. Applica le migration SQL del repository in ordine:
   - `supabase/migrations/20260309_initial_schema.sql`
   - `supabase/migrations/20260309_rls_policies.sql`
   - `supabase/migrations/20260310_search_helpers.sql`
   - `supabase/migrations/20260310_dev_seed.sql`
5. Avvia l'app mobile con `npm run start:mobile` dal root oppure `npm run start` in `apps/mobile`.

## Nota pratica

Il repository non puo' collegarsi automaticamente a un progetto Supabase reale senza le tue credenziali o il project ref corretto. Per questo il setup e' stato reso esplicito e versionato nel repo.

## Dati demo

La migration `20260310_dev_seed.sql` inserisce dati demo solo se nel progetto esistono gia' utenti auth con queste email:

- `club.demo@footme.dev`
- `player.demo@footme.dev`
- `coach.demo@footme.dev`
- `staff.demo@footme.dev`

Se questi utenti non esistono, la migration non fallisce: semplicemente non inserisce i record dipendenti.
