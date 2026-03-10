# footMe MVP Backlog

## Scopo del backlog

Questo backlog traduce il piano di alto livello in lavoro operativo per la prima release MVP mobile di footMe.

Principi di priorita':

- mobile first su iOS e Android
- web fuori scope per l'MVP
- priorita' a identita' professionale, recruiting e networking base
- feed social avanzato, shop e analytics evolute posticipati dopo il core MVP

## Release target MVP

L'MVP deve permettere a:

- un calciatore di creare il proprio profilo professionale e candidarsi a un annuncio
- una societa' di creare la propria pagina e pubblicare annunci di ricerca
- utenti selezionati di cercarsi, connettersi e scambiarsi messaggi privati base

## Epic MVP

### EPIC 0 - Discovery, governance e setup

Obiettivo: trasformare i requisiti in un backlog eseguibile e in una base di progetto condivisa.

Task:

- T0.1 Definire perimetro MVP e post-MVP
- T0.2 Formalizzare personas e user journey principali
- T0.3 Definire stack tecnico mobile, backend, database e media storage
- T0.4 Definire standard di repository, branching, PR e Definition of Done
- T0.5 Definire ambienti dev, staging e production
- T0.6 Definire vincoli legali iniziali: privacy, media, minori, pagamenti

Dipendenze:

- nessuna

Acceptance criteria:

- scope MVP approvato
- stack tecnico approvato
- backlog fase 1 pronto

### EPIC 1 - Fondazioni applicative

Obiettivo: predisporre base tecnica e UI foundation per lo sviluppo feature.

Task:

- T1.1 Inizializzare workspace app mobile
- T1.2 Configurare navigazione principale
- T1.3 Configurare autenticazione e sessione base
- T1.4 Configurare backend, database e storage file
- T1.5 Configurare CI/CD iniziale
- T1.6 Definire design system e componenti base
- T1.7 Modellare entita' core: user, profile, club, ad, application, connection, message

Dipendenze:

- EPIC 0 completata o sufficientemente definita

Acceptance criteria:

- app avviabile in locale
- ambienti tecnici creati
- navigazione e auth stub funzionanti

### EPIC 2 - Onboarding e profili professionali

Obiettivo: permettere ai diversi ruoli di registrarsi e costruire il proprio profilo.

Task:

- T2.1 Progettare onboarding per ruolo utente
- T2.2 Implementare registrazione e login
- T2.3 Implementare profilo calciatore
- T2.4 Implementare carriera sportiva e statistiche per stagione
- T2.5 Implementare profilo allenatore
- T2.6 Implementare profilo staff tecnico
- T2.7 Implementare pagina societa'
- T2.8 Implementare upload media base

Dipendenze:

- EPIC 1

Acceptance criteria:

- ciascun ruolo puo' creare e aggiornare il proprio profilo
- il giocatore puo' inserire piu' stagioni nella carriera
- le immagini profilo e i media base sono caricabili

### EPIC 3 - Recruiting e candidature

Obiettivo: attivare il flusso core tra societa' e giocatori.

Task:

- T3.1 Implementare creazione e modifica annunci societa'
- T3.2 Implementare dettaglio annuncio con metadati recruiting
- T3.3 Implementare candidatura giocatore all'annuncio
- T3.4 Implementare salvataggio annunci
- T3.5 Implementare dashboard societa' per annunci e candidature
- T3.6 Implementare notifiche in-app per annunci e candidature

Dipendenze:

- EPIC 2

Acceptance criteria:

- una societa' pubblica un annuncio
- un giocatore si candida con il proprio profilo
- la societa' vede la candidatura ricevuta

### EPIC 4 - Ricerca e scoperta

Obiettivo: consentire scouting e ricerca rapida di utenti e societa'.

Task:

- T4.1 Implementare ricerca giocatori
- T4.2 Implementare filtri giocatore per ruolo, eta', categoria, regione e disponibilita'
- T4.3 Implementare ricerca allenatori e staff
- T4.4 Implementare ricerca societa'
- T4.5 Implementare risultati con ordinamento e stato vuoto

Dipendenze:

- EPIC 2
- EPIC 3 parziale per i casi legati agli annunci

Acceptance criteria:

- gli utenti trovano profili e societa' con filtri essenziali
- la ricerca supporta il recruiting MVP

### EPIC 5 - Networking e messaggistica base

Obiettivo: abilitare il contatto diretto tra utenti rilevanti.

Task:

- T5.1 Implementare richieste di collegamento
- T5.2 Implementare lista connessioni
- T5.3 Implementare messaggistica privata 1:1
- T5.4 Implementare unread count e stato conversazioni
- T5.5 Implementare regole base di privacy e blocco

Dipendenze:

- EPIC 2

Acceptance criteria:

- due utenti possono collegarsi
- due utenti collegati possono scambiarsi messaggi

### EPIC 6 - Qualita', sicurezza e pre-release MVP

Obiettivo: rendere il prodotto distribuibile in beta e pronto per una prima validazione reale.

Task:

- T6.1 Scrivere test dei flussi core
- T6.2 Introdurre error handling e osservabilita' minima
- T6.3 Verificare autorizzazioni e protezione dati sensibili
- T6.4 Preparare build beta iOS e Android
- T6.5 Preparare checklist di go-live e feedback beta

Dipendenze:

- EPIC 1, EPIC 2, EPIC 3, EPIC 4, EPIC 5

Acceptance criteria:

- build beta installabile
- flussi critici testati
- feedback pilota raccoglibile

## Sequenza di esecuzione consigliata

1. EPIC 0
2. EPIC 1
3. EPIC 2
4. EPIC 3
5. EPIC 4
6. EPIC 5
7. EPIC 6

## Sprint 0 suggerito

Obiettivo: portare il progetto da documentazione a base tecnica pronta.

Task da avviare subito:

- S0-1 Scegliere stack mobile e backend
- S0-2 Definire architettura high-level e modello dati iniziale
- S0-3 Inizializzare repository applicativo
- S0-4 Configurare ambienti e segreti
- S0-5 Definire navigazione principale e design primitives
- S0-6 Creare backlog issue-based per EPIC 1 ed EPIC 2

Deliverable Sprint 0:

- decisione stack
- progetto scaffoldato
- primi documenti tecnici
- backlog pronto per sviluppo feature

## Decisioni ancora aperte

Prima di partire con implementazione vera, serve chiudere almeno queste decisioni:

- stack mobile: React Native, Flutter o altro
- backend: Firebase, Supabase, custom backend o altro
- strategia autenticazione: email, telefono, social login
- hosting media e video highlights
- policy moderazione contenuti e gestione minori
- perimetro esatto dell'MVP rispetto a feed e notifiche
