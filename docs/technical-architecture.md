# footMe Technical Architecture

## Stack scelto

### Mobile client

- React Native con Expo
- TypeScript
- Expo Router per la navigazione
- React Hook Form e Zod per form e validazione
- TanStack Query per server state e caching

### Backend platform

- Supabase Auth per autenticazione
- Supabase Postgres per dati relazionali
- Supabase Storage per immagini, media e documenti
- Supabase Realtime per presenza, chat e aggiornamenti near real-time
- Supabase Edge Functions per logica server-side mirata

### Servizi integrati previsti

- Expo Notifications per push notifications
- Stripe per pagamenti shop in fase successiva
- PostHog o strumento equivalente per product analytics in fase successiva

## Motivazioni della scelta

- Expo accelera la delivery iOS e Android con un unico codebase mobile-first.
- TypeScript riduce il rischio su un dominio con molti ruoli, campi profilo e workflow.
- Supabase permette di partire velocemente con auth, database, storage e realtime senza costruire subito un backend custom completo.
- Il dominio iniziale dell'MVP e' piu' orientato a CRUD, ricerca, notifiche e matching che a logiche backend fortemente custom.
- La web app resta fuori scope, ma il modello dati e il backend restano riutilizzabili se verra' aggiunta in futuro.

## Decisioni architetturali

### Struttura repository

- `apps/mobile`: applicazione mobile Expo
- `packages/config`: configurazioni condivise riusabili nel monorepo
- `docs`: documentazione prodotto, roadmap e architettura

### Moduli iniziali applicativi

- auth
- profiles
- clubs
- recruiting
- search
- networking
- messaging
- notifications

### Modello dati iniziale ad alto livello

Entita' core da modellare per l'MVP:

- user
- player_profile
- coach_profile
- staff_profile
- club_profile
- player_career_entry
- recruiting_ad
- recruiting_application
- connection
- conversation
- message
- notification

## Scaffold deciso

### Root workspace

- npm workspaces
- script condivisi per mobile development, lint e typecheck
- configurazione TypeScript base condivisa

### Mobile app

- `app/` per route Expo Router
- `src/components` per componenti UI e layout
- `src/features` per moduli funzionali per dominio
- `src/lib` per client e integrazioni esterne
- `src/theme` per token UI e tema applicativo

## Prerequisiti locali

- Node.js 20 o superiore
- npm 10 o superiore
- Xcode CLI gia' attiva per iOS
- Android Studio per emulatori Android

## Nota operativa

L'ambiente corrente del repository ha Node 16, quindi lo scaffold e' stato preparato a livello file e struttura, ma l'installazione delle dipendenze va eseguita dopo l'upgrade di Node.
