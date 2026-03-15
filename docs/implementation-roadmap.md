# footMe Implementation Roadmap

## Obiettivo del piano

Questo piano divide il lavoro in fasi come in un contesto aziendale, con obiettivi, task, dipendenze e risultati attesi. Il focus iniziale e' la consegna di una prima versione mobile iOS e Android, lasciando la versione web fuori scope.

## Stato aggiornato del repository - 14 marzo 2026

### Fase attuale

Considerando lo stato reale di avanzamento condiviso dal team, il repository va trattato come una base tecnica con **una sola area semi-avanzata: Profilo**. Le altre sezioni mobile esistono soprattutto come **scaffolding di navigazione, layout e primi wiring**, ma **non sono ancora da considerare funzionanti come feature MVP**.

In pratica:

- **Fase 0**: sostanzialmente completata a livello documentale
- **Fase 1**: completata nella parte di scaffolding tecnico, design system e base Supabase
- **Fase 2**: avviata davvero solo sul dominio profilo, oggi la parte piu' matura
- **Fase 3**: da considerare ancora da implementare operativamente
- **Fase 4**: da considerare ancora da implementare operativamente
- **Fase 5**: non avviata
- **Fase 6**: eventuali parti presenti non vanno considerate pronte; resta successiva al recruiting core
- **Fasi 7-9**: ancora da impostare come hardening, retention e release

### Evidenze principali nel repository

- app mobile con tab `Home`, `Profilo`, `Rete`, `Messaggi`, `Annunci`: `apps/mobile/app/(tabs)/_layout.tsx`
- area profilo/onboarding nettamente piu' sviluppata delle altre: `apps/mobile/app/(onboarding)/profile.tsx`, `apps/mobile/app/(tabs)/profile.tsx`, `apps/mobile/src/features/profiles/*`
- Home, Rete, Messaggi e Annunci hanno gia' struttura route/UI ma non vanno trattate come feature chiuse: `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/(tabs)/network.tsx`, `apps/mobile/app/(tabs)/messages.tsx`, `apps/mobile/app/(tabs)/announcements.tsx`
- backend Supabase gia' strutturato con migrazioni per profili, recruiting, networking, messaging, media e helper di ricerca: `supabase/migrations/*.sql`

### Gap da chiudere delle fasi precedenti prima di aprire nuove fasi

- **Fase 0**
  - formalizzare meglio vincoli legali e operativi ancora aperti: privacy policy, gestione minori, moderazione contenuti e ambienti staging/production
- **Fase 1**
  - rendere esplicita la pipeline CI/CD e la strategia ambienti, oggi non ancora documentate come deliverable realmente chiusi
  - gli analytics events base previsti in fase 1 non risultano ancora implementati
- **Fase 2**
  - completare e stabilizzare profilo, onboarding e auth prima di estendere le altre aree
  - manca evidenza di reset password e verifica email o telefono nel flusso auth
  - la moderazione base dei media non risulta ancora implementata
  - la pagina societa' resta da completare come esperienza reale, non solo come struttura dati/UI
- **Fase 3**
  - Annunci va trattata come area da costruire davvero in MVP: creazione, modifica, chiusura, candidatura e dashboard club
  - le notifiche recruiting previste non risultano ancora presenti
- **Fase 4**
  - Rete e Messaggi vanno trattate come aree da costruire davvero in MVP: connessioni, inbox, conversazioni e privacy
  - il concetto di `blocked` esiste nel modello dati, ma manca una UX esplicita per gestione blocco utente

### Sequenza aggiornata consigliata

Dato lo stato reale del codice, la sequenza piu' corretta non e' aprire subito il feed sociale, ma:

1. completare e stabilizzare **Profilo/Auth/Onboarding**
2. implementare davvero **Recruiting e Annunci**
3. implementare davvero **Networking e Messaggistica base**
4. completare **Ricerca e scoperta** a supporto del recruiting
5. fare **hardening MVP e beta readiness**
6. passare solo dopo a **fase 5** feed sociale
7. lasciare **fase 8** shop al post-MVP

## Fase 0 - Product Discovery e Project Setup

### Obiettivo

Trasformare la visione del prodotto in requisiti validati, backlog iniziale e decisioni tecniche condivise.

### Task

- Definire MVP, post-MVP e non-goal della prima release
- Formalizzare user personas: giocatore, allenatore, staff, societa'
- Mappare le user journey principali per ogni categoria utente
- Definire metriche di successo iniziali del prodotto
- Identificare vincoli normativi: privacy, gestione media, minori, pagamenti
- Scegliere stack mobile, backend, database, storage media e push notifications
- Definire ambienti: local, staging, production
- Creare repository standards: branching, PR flow, issue templates, Definition of Done

### Deliverable

- PRD validato
- backlog epics iniziale
- architettura high-level
- piano release MVP

### Exit criteria

- scope MVP approvato
- stack tecnico approvato
- backlog di fase 1 pronto

## Fase 1 - Fondazioni Tecniche e Design System

### Obiettivo

Costruire la base tecnica e UX per permettere sviluppo parallelo del team.

### Task

- Inizializzare app mobile condivisa per iOS e Android
- Configurare autenticazione, gestione sessione e ruoli utente
- Configurare backend base, database, object storage e logging
- Configurare CI/CD per build, test e distribuzioni interne
- Definire design system: colori, tipografia, componenti, spacing, icone
- Progettare navigazione globale e information architecture
- Definire modelli dati iniziali per utenti, club, post, annunci, messaggi
- Preparare analytics events base

### Deliverable

- skeleton app navigabile
- infrastruttura backend iniziale
- design system versionato
- schema dati iniziale

### Exit criteria

- login e onboarding tecnico funzionanti in ambiente dev
- pipeline base attiva
- libreria componenti pronta per feature teams

## Fase 2 - Identity, Onboarding e Profili Professionali

### Obiettivo

Consentire registrazione e costruzione dell'identita' professionale per tutti i tipi di utente.

### Task

- Progettare onboarding differenziato per calciatori, allenatori, staff e societa'
- Implementare registrazione, login, reset password e verifica email o telefono
- Implementare profilo giocatore con dati anagrafici, atletici e media
- Implementare sezione carriera e statistiche multistagione
- Implementare profilo allenatore con licenze, filosofia e storico squadre
- Implementare profilo staff tecnico con specializzazione e disponibilita'
- Implementare pagina ufficiale societa' con dati club, staff e rosa
- Implementare upload e moderazione base di foto e video

### Deliverable

- onboarding completo per tutti i ruoli
- profili pubblici e modificabili
- sezione carriera dei giocatori

### Exit criteria

- un utente per ciascun ruolo puo' registrarsi e completare il proprio profilo
- upload media e salvataggio dati funzionanti

## Fase 3 - Recruiting e Annunci

### Obiettivo

Abilitare il primo motore di matching tra societa' e talenti.

### Task

- Implementare creazione, modifica e chiusura annunci per societa'
- Implementare struttura annunci con ruolo, eta', categoria, regione, benefit e descrizione
- Implementare candidatura del giocatore agli annunci
- Implementare salvataggio annunci e storico candidature
- Implementare viste dedicate per annunci attivi, salvati e candidati
- Definire ranking iniziale per suggerimenti pertinenti
- Integrare notifiche per nuovi annunci e nuove candidature

### Deliverable

- modulo annunci completo
- candidatura utente funzionante
- notifiche recruiting base

### Exit criteria

- una societa' puo' pubblicare un annuncio
- un giocatore puo' candidarsi con il proprio profilo

## Fase 4 - Networking, Connessioni e Messaggistica

### Obiettivo

Portare il prodotto da directory professionale a rete attiva di contatti.

### Task

- Implementare richieste di collegamento e gestione contatti
- Implementare rubrica contatti e suggerimenti di networking
- Implementare chat privata 1:1 tra utenti autorizzati
- Definire regole di privacy e blocco utenti
- Implementare inbox, unread counts e stato messaggi
- Integrare notifiche push per messaggi e connessioni

### Deliverable

- rete di collegamenti
- messaggistica privata base
- notifiche networking

### Exit criteria

- due utenti possono collegarsi e scambiarsi messaggi

## Fase 5 - Feed Sociale e Contenuti

### Obiettivo

Abilitare visibilita' continua e attivita' sociale nella piattaforma.

### Task

- Implementare creazione post con foto, video e testo
- Supportare highlights, aggiornamenti sportivi e risultati partita
- Costruire feed personalizzato con contenuti dei contatti e delle squadre seguite
- Integrare annunci di mercato nel feed con regole di priorita'
- Implementare interazioni base: like, commenti, salvataggi, condivisione interna se prevista
- Definire linee guida di moderazione contenuti

### Deliverable

- feed iniziale
- pubblicazione contenuti
- modello di engagement base

### Exit criteria

- gli utenti possono pubblicare contenuti e visualizzare un feed coerente

## Fase 6 - Ricerca Avanzata e Scoperta

### Obiettivo

Rendere efficiente la scoperta di profili e opportunita'.

### Task

- Implementare motore di ricerca per giocatori
- Implementare filtri per ruolo, eta', altezza, piede, categoria, regione e disponibilita'
- Implementare ricerca allenatori con filtri su licenza, esperienza e categoria allenata
- Implementare ricerca squadre con filtri geografici e di campionato
- Progettare risultati, sorting e salvataggio ricerche
- Integrare suggerimenti e profili simili

### Deliverable

- ricerca globale
- filtri per categoria utente
- UX di scoperta ottimizzata

### Exit criteria

- scouting e recruiting sono eseguibili tramite ricerca e filtri

## Fase 7 - Notifiche, Attivazione e Retention

### Obiettivo

Migliorare reattivita' e coinvolgimento della piattaforma.

### Task

- Implementare centro notifiche in app
- Implementare notifiche per visite profilo, messaggi, interesse societa' e nuovi annunci
- Definire frequenza, preferenze e opt-in utente
- Tracciare eventi chiave per funnel e retention
- Costruire dashboard analytics di prodotto

### Deliverable

- sistema notifiche end-to-end
- basi dati analytics

### Exit criteria

- eventi critici notificati correttamente
- metriche base osservabili in staging

## Fase 8 - Shop e Merchandising

### Obiettivo

Aprire una linea di ricavi per i club con e-commerce leggero integrato.

### Task

- Definire dominio shop per le societa'
- Implementare catalogo prodotti, immagini, prezzi e disponibilita'
- Implementare carrello e checkout
- Integrare provider di pagamento online
- Implementare gestione ordini lato club
- Definire policy di reso, fiscalita' e supporto clienti

### Deliverable

- shop club funzionante
- pagamenti online attivi
- gestione ordini base

### Exit criteria

- un club puo' vendere merchandising e ricevere ordini

## Fase 9 - Qualita', Sicurezza e Release

### Obiettivo

Portare il prodotto a un livello di qualita' adatto alla pubblicazione mobile.

### Task

- Scrivere test unitari, integrazione ed end-to-end sui flussi core
- Eseguire hardening sicurezza su auth, media upload, chat e pagamenti
- Implementare ruoli, autorizzazioni e audit log essenziali
- Verificare performance, crash reporting e osservabilita'
- Eseguire beta test con utenti pilota
- Preparare store listing, policy privacy, supporto e release checklist

### Deliverable

- release candidate mobile
- checklist compliance e go-live
- piano supporto post-lancio

### Exit criteria

- test critici verdi
- beta validata
- build pronta per submission su store

## Epics iniziali consigliate

- Epic 1: Platform foundation
- Epic 2: Multi-role identity and onboarding
- Epic 3: Player career and statistics
- Epic 4: Club pages and recruiting ads
- Epic 5: Networking and messaging
- Epic 6: Feed and media content
- Epic 7: Search and discovery
- Epic 8: Notifications and analytics
- Epic 9: Shop and payments
- Epic 10: QA, security and release

## Priorita' MVP consigliata

Per una prima release credibile, la priorita' suggerita e':

1. chiusura dei gap su onboarding, profili professionali e auth
2. completamento recruiting core: gestione annunci, candidature e stati operativi
3. completamento networking base e messaggi con notifiche essenziali
4. ricerca avanzata essenziale per profili e opportunita'
5. hardening di qualita', sicurezza e beta readiness

Feed social completo, shop e parte avanzata analytics possono entrare dopo il primo MVP se servono per ridurre rischio e time-to-market.

## Prossimi passi prima di iniziare nuove implementazioni

### 1. Chiudere il dominio Profilo prima di usarlo come base per tutto il resto

- aggiungere reset password e definire chiaramente la verifica account
- definire la moderazione minima dei media gia' caricabili
- chiudere i flussi di onboarding multi-ruolo con salvataggi affidabili e profilo pubblico coerente

### 2. Costruire davvero Recruiting e Annunci come prima area nuova dopo Profilo

- creare il flusso club: crea annuncio, modifica, chiudi, vedi candidature
- creare il flusso player: esplora annunci, salva, candidati, controlla stato candidatura
- aggiungere stati vuoti, error handling e test dei casi core

### 3. Costruire Networking e Messaggi solo dopo che Recruiting funziona

- richieste di collegamento
- lista connessioni
- chat privata 1:1 affidabile
- regole privacy e blocco utente minime

### 4. Portare Ricerca come acceleratore del core MVP, non come anticipo di fase

- estendere i filtri ricerca per ruolo, disponibilita', categoria e geografia in modo coerente col recruiting
- completare la UX risultati/stati vuoti e preparare sorting e suggerimenti minimi
- verificare che ricerca profili e annunci supporti davvero scouting e candidatura

### 5. Preparare il passaggio a beta interna

- stabilizzare i flussi core end-to-end
- rendere espliciti ambienti, pipeline e checklist di rilascio
- chiudere i punti aperti di compliance minima e supporto operativo

Solo dopo questi step ha senso aprire il lavoro sul feed sociale, per evitare di espandere il perimetro prima che il core MVP sia davvero solido.
