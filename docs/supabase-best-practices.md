# Supabase / Postgres Best Practices per footMe

## Obiettivo

Questo documento adatta a footMe le linee guida pubblicate da Supabase in **Postgres best practices for AI agents**.

Serve come riferimento quando modifichi:

- migration SQL
- policy RLS
- funzioni Postgres / RPC
- query Supabase dal client mobile
- storage e metadati collegati al dominio applicativo

## Ambito nel repository

Le parti oggi piu' rilevanti sono:

- migration in `supabase/migrations`
- setup client in `apps/mobile/utils/supabase.ts`
- accesso dati nelle feature mobile sotto `apps/mobile/src/features`
- documentazione di supporto in `docs/supabase-setup.md` e `docs/database-schema.md`

## Regole operative da seguire

### 1. Sicurezza prima di tutto: RLS come requisito

Per ogni nuova tabella del dominio applicativo:

- abilita `ROW LEVEL SECURITY`
- aggiungi policy esplicite prima che la tabella venga usata dal client
- non affidarti mai solo ai controlli lato app

Da preferire:

- policy basate su `auth.uid()`
- policy separate per `select`, `insert`, `update`, `delete` quando i vincoli cambiano
- regole esplicite per ownership, membership di club e partecipazione alle conversazioni

Da evitare:

- tabelle accessibili al client senza RLS
- policy troppo generiche con condizioni difficili da verificare
- uso del service role nel client mobile

### 2. Le migration sono append-only e focalizzate

In footMe le migration devono restare:

- incrementali
- ordinate temporalmente
- piccole e leggibili
- concentrate su una responsabilita' chiara

Quindi:

- non riscrivere migration gia' versionate per cambiare la storia
- aggiungi una nuova migration per ogni evoluzione di schema, policy, helper o storage
- mantieni naming chiaro e coerente con quanto gia' presente in `supabase/migrations`

### 3. Usa tipi, vincoli e indici espliciti

Quando aggiungi o modifichi schema:

- preferisci tipi specifici e non generici
- usa chiavi esterne reali
- aggiungi `not null`, `check`, `unique` e default dove servono davvero
- indicizza colonne usate spesso in join, filtri, ownership e ordinamenti

Esempi tipici per footMe:

- foreign key verso `profiles`, `clubs`, `recruiting_ads`, `conversations`
- lookup per `profile_id`, `club_id`, `created_at`, `status`
- colonne usate nelle funzioni di ricerca o nei feed

### 4. Evita overfetching dal client

Le query Supabase usate dall'app mobile devono trasferire solo il necessario.

Da preferire:

- select esplicite
- paginazione per liste che possono crescere
- filtri server-side coerenti con la schermata

Da evitare:

- `select("*")` quando bastano pochi campi
- query non paginate per elenchi di annunci, profili, messaggi o connessioni
- logica di filtro lasciata interamente al client se puo' essere applicata nel database

### 5. Sposta nel database la logica condivisa e sensibile ai dati

Quando una query diventa complessa o ripetuta:

- valuta funzioni SQL / RPC come gia' avviene con gli helper di ricerca
- mantieni la logica vicina ai dati se migliora coerenza, performance o sicurezza

Buoni casi d'uso:

- ricerca profili o annunci
- operazioni multi-step con invarianti di dominio
- controlli di ownership o membership difficili da replicare in ogni query client

Attenzione:

- usa `security definer` solo se davvero necessario e dopo revisione accurata
- limita input/output della funzione al minimo indispensabile

### 6. Transazioni brevi e operazioni idempotenti

Per funzioni RPC, seed e mutation sensibili:

- mantieni le transazioni corte
- riduci lock non necessari
- rendi l'operazione idempotente quando puo' essere richiamata piu' volte

Questo e' particolarmente importante per:

- candidature
- connessioni/networking
- creazione conversazioni
- onboarding iniziale

### 7. Storage e database devono avere responsabilita' chiare

Nel progetto:

- i file vivono in Supabase Storage
- i metadati relazionali restano in Postgres

Quindi:

- non salvare URL hardcoded o metadati duplicati senza motivo
- usa bucket e policy coerenti con ownership e visibilita'
- mantieni i riferimenti ai media dentro tabelle del dominio solo per i dati utili all'app

### 8. I seed devono essere sicuri e opzionali

Per dati demo o bootstrap:

- i seed devono poter essere rieseguiti senza effetti collaterali gravi
- non devono dipendere da segreti nel repository
- devono fallire in modo controllato o degradare in modo sicuro

Il pattern attuale del repo e' corretto: il seed demo inserisce dati dipendenti solo se gli utenti auth esistono gia'.

### 9. Il client mobile usa solo chiavi pubbliche e policy sicure

Per l'app Expo:

- usa solo `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- non introdurre service role key nel client, in `.env.example` o in codice condiviso
- ogni operazione dal mobile deve essere autorizzata da RLS, non da fiducia implicita nel frontend

### 10. Prima di aggiungere SQL, controlla impatto su schema e documentazione

Se cambi il backend Supabase:

- aggiorna le migration
- aggiorna `docs/database-schema.md` se cambia il modello
- aggiorna `docs/supabase-setup.md` se cambia la procedura di bootstrap
- documenta nuove funzioni helper, bucket o vincoli rilevanti

## Come applicarle in footMe

Quando lavori su Supabase o Postgres:

1. definisci prima ownership e regole RLS
2. aggiungi schema e vincoli minimi necessari
3. indicizza le colonne usate da query reali
4. evita query client troppo larghe o non paginate
5. sposta in helper SQL solo la logica che guadagna davvero in coerenza o performance
6. aggiorna la documentazione insieme alla migration

## Checklist rapida per future richieste

- [ ] nuova tabella protetta con RLS prima dell'uso lato client
- [ ] policy esplicite e verificabili
- [ ] migration nuova invece di modificare la storia
- [ ] tipi, vincoli e indici coerenti con le query reali
- [ ] nessun uso del service role nel client mobile
- [ ] query mobile senza overfetching e con paginazione dove serve
- [ ] documentazione aggiornata se cambiano schema, setup o helper SQL

## Riferimenti

- Supabase, **Postgres best practices for AI agents**
- setup del progetto: `docs/supabase-setup.md`
- schema iniziale: `docs/database-schema.md`
- architettura tecnica: `docs/technical-architecture.md`
