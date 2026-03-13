# Experiences save analysis

## Root cause

Il mancato salvataggio delle esperienze calcistiche era causato dal flusso di persistenza in `updateCompleteProfessionalProfile`.

Il codice:

1. faceva `insert` delle nuove esperienze senza `id`
2. subito dopo rileggeva tutti gli `id` presenti in `player_career_entries`
3. costruiva `removableIds` usando solo gli `id` già presenti nel payload UI (`currentIds`)

Le nuove esperienze appena inserite non avevano ancora un `id` lato form, quindi non comparivano in `currentIds`. Di conseguenza venivano considerate "da rimuovere" e cancellate nella delete finale dello stesso save.

Effetti osservabili:

- il save sembrava riuscire
- la UI faceva refresh correttamente
- al reload profilo le nuove esperienze risultavano sparite
- nei save misti (update + new + delete) le nuove entry potevano essere eliminate subito dopo l'inserimento

## File coinvolti

- `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/profile-service.ts`
- `/home/runner/work/footMe/footMe/apps/mobile/app/(tabs)/profile.tsx`
- `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/player-sports.ts`
- `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/player-sports-section.tsx`
- `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/profile-service-update.test.ts`
- `/home/runner/work/footMe/footMe/apps/mobile/src/features/profiles/player-sports-section.test.tsx`

## Bug trovati

### 1. Delete-after-insert sulle nuove esperienze

**Severità:** alta

Nel save player il servizio inseriva prima le nuove entry e cancellava dopo gli elementi non presenti in `currentIds`. Poiché `currentIds` conteneva solo gli `id` già esistenti, le nuove righe appena inserite venivano eliminate.

### 2. Mapping di persistenza duplicato e fragile

**Severità:** media

La serializzazione verso `player_career_entries` era duplicata tra ramo `existingEntries` e ramo `newEntries`, aumentando il rischio di mismatch futuri su campi come:

- `club_id`
- `competition_name`
- `team_logo_url`
- `minutes_played`
- `sort_order`

### 3. Gerarchia readonly poco coerente con la priorità prodotto

**Severità:** media UX

In view mode le esperienze vivevano dentro "Informazioni sportive" e dopo altre sezioni del profilo, riducendo la loro visibilità per scouting e lettura rapida.

### 4. Experience card troppo estesa verticalmente

**Severità:** media UX

La card usava timeline verticale, dot decorativo, tabella statistiche a 3 colonne e spaziature ampie. Questo rendeva ogni esperienza troppo alta e meno scansionabile su mobile.

## Fix proposto

### Persistenza

Nel servizio di salvataggio:

- recuperare gli `id` persistiti **prima** di cancellare e inserire
- calcolare le entry da rimuovere lato database, dentro una singola transazione SQL
- fare `upsert` delle entry esistenti
- fare `delete` solo delle entry realmente rimosse
- fare `insert` delle nuove entry **dopo** il calcolo dei removals

In aggiunta:

- centralizzare il mapping del payload verso il layer di persistenza
- preservare in modo uniforme `team_logo_url`, `competition_name`, `club_id`, `minutes_played`, `sort_order`

### UX readonly

Nel profilo readonly:

1. Header profilo
2. Informazioni personali
3. Esperienze calcistiche
4. Presentazione / preferenze / altre sezioni
5. Contatti

### Experience card

Refactor compatto:

- logo ridotto ma sempre visibile
- nome squadra come headline
- categoria + stagione su riga secondaria
- statistiche in riga compatta: `18 presenze • 6 gol • 3 assist`
- badge più compatti
- rimozione della timeline verticale per ridurre altezza e rumore visivo

## Rischi di regressione

### Bassi

- perdita di `team_logo_url` o statistiche numeriche: coperto dal nuovo test sul payload di persistenza
- regressione del layout compatto: coperta dal test della card con riga statistiche inline

### Medi

- il salvataggio completo del profilo resta multi-step per le sezioni non player (profilo base, contatti, ecc.), ma la parte critica `player_profiles + player_career_entries` ora è atomica lato Postgres tramite RPC
- restano warning non bloccanti di lint in file non correlati (`Array<T>` vs `T[]`)

## Fix implementato

- Introdotto `toPlayerCareerEntryRpcPayload` per unificare il mapping inviato al RPC
- Introdotto il nuovo RPC atomico `public.save_player_profile_details(...)` per gestire in un'unica transazione:
  - upsert di `player_profiles`
  - delete delle esperienze rimosse
  - upsert delle esperienze esistenti
  - insert delle nuove esperienze
- Aggiornato il client mobile per usare il nuovo RPC invece di orchestrare create/update/delete separati
- Riposizionata la sezione esperienze sotto "Informazioni personali" in readonly
- Uniformata la card esperienze con layout compatto e leggibile
