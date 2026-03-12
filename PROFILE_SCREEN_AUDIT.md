# Profile Screen Audit

## Schermata analizzata
- File principale: `/home/runner/work/footMe/footMe/apps/mobile/app/(tabs)/profile.tsx`
- Supporti rilevanti:
  - `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/profile-service.ts`
  - `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/profile-form-utils.ts`
  - `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/profile-avatar.ts`

## Componenti attuali identificati prima del redesign
- `Section`
- `Field`
- `BooleanField`
- `PillSelector`
- `BirthDateField`
- `SummaryCard`
- `Button`, `Card`, `Input`, `SelectField`, `DatePickerField`

## Campi visualizzati
### Base profile
- nome e cognome
- data di nascita
- nazionalità
- città
- regione
- bio
- disponibilità
- apertura al trasferimento
- avatar URL

### Player
- ruolo principale e secondario
- piede preferito
- altezza e peso
- categorie preferite
- regioni di interesse
- highlight video
- disponibilità a cambiare squadra
- cronologia stagioni e statistiche

### Coach
- licenze
- squadre allenate
- categorie allenate
- filosofia di gioco
- video tecnico
- aree di interesse
- disponibilità a nuove panchine

### Staff
- specializzazione
- esperienza
- certificazioni
- aree di interesse
- disponibilità a lavorare

### Club admin
- nome club
- città e regione club
- categoria e campionato
- descrizione club
- logo e gallery

## Struttura layout esistente prima del redesign
1. Hero card scura con copy prodotto e badge ruolo
2. Griglia di highlight cards con metriche sintetiche
3. CTA globale `Modifica profilo`
4. Alternanza tra:
   - vista summary con `SummaryCard`
   - form edit con molte sezioni e input inline

## Problemi UX rilevati
- La schermata si apriva con un hero marketing-oriented più vicino a una dashboard che a un profilo personale.
- Le informazioni davvero importanti del profilo non erano immediatamente visibili nell'area above-the-fold.
- L'entry point di modifica era una CTA piena, non una affordance discreta tipo matita come nel pattern LinkedIn mobile.
- La separazione view/edit esisteva a livello logico, ma la UI non la comunicava con sufficiente chiarezza gerarchica.
- Mancava una testata profilo forte con foto, nome e informazioni chiave aggregate.

## Problemi di leggibilità
- Nome, ruolo e contesto sportivo non erano il primo focus visivo.
- Alcuni dati eterogenei erano concentrati nella stessa sezione, aumentando il carico cognitivo.
- Bio, disponibilità e dati anagrafici stavano nello stesso blocco senza sufficiente distinzione.
- Le highlight cards introducevano rumore visivo prima ancora della lettura dei dati completi.

## Problemi di struttura
- `profile.tsx` concentrava layout, stato, validazione, summary rendering ed edit rendering in un unico file molto grande.
- `Section`, `Field` e `SummaryCard` erano helper locali non riusabili fuori dalla schermata.
- La UI summary e la UI edit usavano pattern diversi per presentare informazioni simili.
- Le macro aree richieste dal profilo (personali, sportive, fisiche, contatti) non erano esplicitamente riconoscibili.

## Duplicazioni di logica view/edit
- Le stesse informazioni venivano descritte due volte con strutture diverse: una per `summarySections`, una direttamente nel form edit.
- La semantica dei campi (label + valore) cambiava tra view mode e edit mode, riducendo coerenza percepita.
- I componenti locali riutilizzavano stili ma non un vero modello condiviso di field readonly/editable.

## Miglioramenti proposti
- Introdurre un header profilo stile LinkedIn mobile con:
  - avatar grande
  - nome come informazione principale
  - squadra/categoria/ruolo in righe secondarie
  - icona matita in alto a destra
- Rendere readonly tutti i campi in default mode.
- Mostrare gli input solo in edit mode, mantenendo i valori precompilati.
- Raggruppare i dati per macro aree chiare:
  - Informazioni personali
  - Informazioni sportive
  - Informazioni fisiche
  - Contatti
  - eventuali sezioni specialistiche per carriera e club
- Estrarre componenti riusabili dedicati:
  - `ProfileHeader`
  - `ProfileSection`
  - `ProfileField`
- Spostare il salvataggio in fondo alla pagina per confermare il pattern “prima leggo, poi modifico”.
- Aggiungere affordance accessibili con target tappabili adeguati, label chiare e contrasti coerenti con i token UI esistenti.
