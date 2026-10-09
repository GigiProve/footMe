# DAS-REV-06 — Widget profilo e disponibilità · consegna

**Task:** [#73109731](https://freedcamp.com/view/3728859/tasks/73109731)
**Estende:** [DAS-REV-03](./dashboard-rev03-delivery.md) · DAS-REV-04 · DAS-REV-05 · [Common Contract](./dashboard-common-contract.md)
**Data:** 2026-10-09
**Stato finale: completamento parziale.** Tre cose non eseguite, dichiarate in §8: migrazione mai applicata, QA visuale impossibile, onboarding non riportato sul selector condiviso.

---

## 1. Sintesi

Due pezzi, una sola fonte geografica.

| Cosa | Dove | Perché serviva |
| --- | --- | --- |
| Una configurazione geografica **riconoscibile** | `availability_configured_at` sulle tre tabelle di ruolo | `player_profiles.availability_type` è `not null default 'ITALY'` e l'onboarding parte da `"ITALY"` senza che nessuno lo scelga: un profilo che non ha mai aperto la schermata era indistinguibile da uno che aveva scelto tutta Italia. §15 e §16 chiedono la distinzione; senza, il suggerimento non può né comparire né sparire |
| Una **patch atomica** delle sole aree | `save_profile_availability_areas` | §18 vieta di toccare altro. Le RPC esistenti non lo permettono: `save_player_profile_details` riporta `availability_type` a `'ITALY'` se il payload lo omette e azzera `show_transfer_badge`/`show_regions_badge` con un `coalesce(..., false)`; `save_coach_career_details` e `save_staff_career_details` cancellano le esperienze assenti dal payload |
| Il **selector condiviso** a tre modalità | `features/profiles/availability-areas/` | §4: «Se il selector esiste con layout differente, adeguare il componente condiviso e i suoi adattatori. Non copiarlo in una variante Dashboard indipendente» |
| L'invariante "chi scrive le aree conferma la configurazione" | trigger `*_availability_stamp` | Le aree si scrivono da sei punti. §20 vuole che il segnale si risolva **da qualunque origine**: una regola replicata in sei posti è una regola che il settimo dimentica |

---

## 2. File

### Nuovi

| File | Scopo |
| --- | --- |
| `supabase/migrations/20261017090000_dashboard_profile_availability.sql` | tassonomia provincia→regione, conferma e revisione per ruolo, trigger, due RPC, riscrittura della RPC di overview |
| `features/profiles/availability-areas/availability-areas-model.ts` | modello canonico: tre modalità + "nessuna", selezioni attive, validazioni, ricerca, ordinamento dei chip (funzioni pure) |
| `features/profiles/availability-areas/AvailabilityAreasSelector.tsx` | il selector condiviso dai tre contesti |
| `features/profiles/availability-areas/AvailabilityAreasScreen.tsx` | editor focalizzato "Dove sei disponibile?" |
| `features/profiles/availability-areas/availability-areas-service.ts` | due RPC, query, mutation, invalidazioni |
| `features/profiles/availability-areas/index.ts` | superficie pubblica del modulo |
| `app/profile/availability-areas.tsx` | rotta |
| `features/profiles/availability-areas/availability-areas-model.test.ts` | 27 test |
| `features/profiles/availability-areas/availability-areas-screen.test.tsx` | 14 test |

### Modificati

| File | Modifica |
| --- | --- |
| `features/profiles/profile-form-utils.ts` | `PROVINCE_REGIONS` (107 province → regione) diventa la fonte; `PROVINCE_OPTIONS` è derivato; `normalizeLookupValue` esportato; `getRegionFromProvince` |
| `features/profiles/edit/sections/OpportunitiesScreen.tsx` | il blocco "Zone disponibili" usa il selector condiviso; spariscono le due sotto-schermate picker |
| `features/profiles/edit/sections/ProfileOpportunitiesScreen.tsx` | idem per Allenatore, Staff, Dirigente, Procuratore; sparisce il riepilogo "Zone selezionate"/"Modifica zone" |
| `features/profiles/edit/ProfileEditScaffold.tsx` | `title` opzionale: l'editor delle aree porta il titolo nel contenuto, come il master |
| `features/profiles/profile-analytics.ts` | tre eventi: `profile_area_editor_opened`, `profile_area_saved`, `profile_area_save_failed` |
| `features/dashboard/components/DashboardSuggestion.tsx` | indicazione e beneficio su due righe (§8), icona `location-outline` |
| `features/dashboard/personal/personal-presentation.ts` | `SUGGESTION_COPY` per chiave stabile |
| `features/dashboard/DashboardFoundation.tsx` | il suggerimento prende copy dal registro e destinazione dal backend; chiave sconosciuta → modulo non composto |
| `ui/Checkbox/Checkbox.tsx` | `description` su due righe (la regione sotto la provincia) + target 44pt + `testID` |
| `ui/Radio/Radio.tsx` | target 44pt + `testID` |
| `features/profiles/{agent,director}-edit/sections/*OpportunitiesScreen.tsx` | rimosse le tre opzioni di config del riepilogo, che non esiste più |
| 3 file di test di ruolo | aggiornati al nuovo selector |

---

## 3. Regole effettive di classificazione

| Elemento | Classificazione | Condizione | Dove è decisa |
| --- | --- | --- | --- |
| Ruolo principale / profilo sportivo | **Richiesto** | invariata da DAS-REV-03 | `fetch_dashboard_personal_overview` |
| Aree di disponibilità | **Consigliato** | `availability_configured_at is null` **e** nessun requisito aperto **e** ruolo in (player, coach, staff) | `fetch_dashboard_personal_overview` |

Due cambi rispetto a DAS-REV-03:

1. **La pertinenza non si legge più dalla modalità persistita.** La regola
   precedente trattava `availability_type = 'ITALY'` come configurazione
   valida e, per il Calciatore, non emetteva mai il suggerimento.
2. **Mai richiesto e consigliato insieme.** §8: «Quando viene mostrato il
   gruppo Informazioni richieste, non aggiungere contemporaneamente una
   seconda card di suggerimenti sullo stesso profilo.» È la differenza fra lo
   screen 01 e lo screen 02. La raccomandazione non è *risolta*, solo non
   promossa: resta raggiungibile dai moduli di modifica.

Nessun nuovo livello (Importante, Prioritario), nessuna percentuale, nessuno
score, nessun hub di completezza (§6, §30).

---

## 4. Routing

| Azione | Destinazione |
| --- | --- |
| Completa informazioni, requisito singolo | editor REV-PROF del ruolo (invariato) |
| Più requisiti in moduli diversi | hub `/profile/edit` · `/profile/coach-edit` · `/profile/staff-edit` (invariato) |
| **Imposta aree** | `/profile/availability-areas` |
| Selezione di una modalità | aggiorna il draft nella stessa schermata |
| Salva modifiche dalla Dashboard | persiste e `router.back()` |
| Back senza modifiche | ritorno senza conferma |
| Back con modifiche | `useUnsavedChangesGuard` — «Uscire senza salvare?» / «Continua a modificare» / «Esci senza salvare» |

La destinazione precedente (`/profile/{edit,coach-edit,staff-edit}/opportunities`)
non viene più proposta dalla Dashboard: §19 assegna all'editor focalizzato il
proprio punto di conferma, e il modulo Opportunità salva anche categorie,
provini e il toggle di disponibilità — cioè più di quanto il suggerimento
chieda. Il modulo resta raggiungibile dall'hub, con lo stesso selector dentro.

Nessun URL arbitrario dal payload: il backend emette una chiave stabile e un
href strutturato, e una chiave senza copy non compone il modulo.

---

## 5. Contratto geografico e validazioni

### Modello

Tre modalità mutuamente esclusive, già nel vocabolario persistito:
`PROVINCES` · `REGIONS` · `ITALY`, più **`null` = non configurata**, che prima
non esisteva. `ALL_ITALY` resta il valore legacy di `ITALY`.

### Tassonomia

`public.italian_provinces` (107 righe) è `italian_comuni` deduplicata per
provincia, con i due nomi di regione bilingui ISTAT riportati alla forma
canonica dell'app. Non è una seconda tassonomia: è la stessa fonte, in una
forma interrogabile per area invece che per comune.

Lato client `PROVINCE_REGIONS` è la stessa derivazione e `PROVINCE_OPTIONS` ne
è ricavato. Prima erano due liste indipendenti e **divergevano**: mancava la
provincia di **Aosta**, presente in `italian_comuni` e non selezionabile da
nessuna schermata dell'app. Ora non possono più divergere per costruzione.

### Validazioni

Sia client (`validateAvailabilityAreas`) sia backend
(`save_profile_availability_areas`):

| Regola | Copy |
| --- | --- |
| Modalità riconosciuta | «Seleziona una modalità di disponibilità.» |
| Almeno una provincia nello scope Province | «Seleziona almeno una provincia.» |
| Almeno una regione nello scope Regioni | «Seleziona almeno una regione.» |
| Nessuna selezione specifica in Tutta Italia | — (rifiutato: `availability_areas_hybrid_scope`) |
| Identificativi validi **e del tipo corretto** | «Alcune aree non sono più disponibili. Controlla la selezione.» |
| Nessun duplicato | deduplicato, non segnalato come errore |
| Nessuna combinazione ibrida | `availability_areas_hybrid_scope` |

Gli errori del backend sono codici stabili, non messaggi: un cambio di copy non
è un cambio di contratto.

---

## 6. Salvataggio nei tre contesti (§19)

| Contesto | Chi conferma | Cosa persiste |
| --- | --- | --- |
| **Editor focalizzato** (Dashboard) | `Salva modifiche` della schermata | solo le aree, via `save_profile_availability_areas` |
| **Modifica profilo** | la CTA del modulo Opportunità | il payload del modulo, aree incluse, via le RPC di ruolo esistenti |
| **Onboarding** | la CTA del passo | il payload del wizard (non modificato) |

Nessun doppio salvataggio: il selector è controllato e senza effetti — non
carica, non salva, non naviga.

### Cosa la patch non tocca

`willing_to_change_club`, `open_to_new_role`, `open_to_work`,
`profiles.is_open_to_transfer`, `show_transfer_badge`, `show_regions_badge`,
`available_from`, `preferred_categories`, carriera, contatti. La `update`
elenca tre colonne geografiche più `availability_configured_at` e `updated_at`,
e nient'altro.

### Concorrenza

`availability_revision` è una revisione **della sola disponibilità**: un
salvataggio di carriera non fa fallire un salvataggio di aree che non è in
conflitto con nulla. La guardia sta dentro la `where` dell'`update`, quindi non
c'è finestra fra lettura e scrittura; 0 righe aggiornate con la riga presente =
`availability_areas_conflict`, che il client distingue da un guasto generico e
presenta senza perdere il draft.

### Riconciliazione

Al successo: la configurazione confermata dal backend sostituisce la cache
(`setQueryData`), si invalidano il profilo completo, i tre prefissi Dashboard e
le superfici Posizioni. Il draft locale viene abbandonato a favore del dato
persistito, così «una risposta precedente alla mutation non fa riapparire il
suggerimento appena risolto» (§20).

---

## 7. Migrazione dei dati esistenti (§24)

**Backfill:** `availability_configured_at = coalesce(updated_at, created_at)`
dove esiste almeno un territorio salvato. È l'unico segnale derivato dai dati
che non inventa nulla; §24 vieta di inventare date durante una migrazione.

**Caso ambiguo, dichiarato e lasciato tale:** modalità `ITALY` (o nulla) con
entrambe le liste vuote resta "non configurata". Non viene convertita, non
viene cancellata, `availability_type` non viene toccato. Conseguenza accettata:
a chi aveva davvero scelto "Tutta Italia" senza province il suggerimento
ricompare **una volta**, e sparisce appena riconferma. Costa un tap;
l'alternativa è dichiarare configurato un profilo che non lo è, che è
esattamente quello che §15 vieta.

**Nessun CHECK constraint** di coerenza fra scope e liste sulle tre tabelle,
pur esistendo il precedente di `fan_profiles`: le righe legacy possono già
violarlo (per esempio `availability_type` nullo con liste piene) e un constraint
farebbe fallire percorsi di scrittura estranei a questa task — i tre upsert di
`saveXProfileMedia`, che riscrivono i valori correnti. L'invariante è imposta
nella RPC di scrittura e nel modello client.

**Il trigger è idempotente rispetto ai no-op:** un upsert che riscrive valori
identici non cambia nulla e non stampa nulla.

---

## 8. Controlli NON eseguiti

Dichiarati come tali, non aggirati.

| Controllo | Perché |
| --- | --- |
| **Esecuzione della migrazione** | nessun `psql`, daemon Docker non attivo (il CLI Supabase c'è ed è linkato, ma `db push` scrive sull'ambiente condiviso e non è stato richiesto). La SQL è stata rivista staticamente: bilanciamento di `$$`, parentesi e `begin`/`end`, qualificazione di ogni riferimento dentro le `returns table` (la trappola nota degli OUT param in scope), alias rinominati per evitare parole chiave. **Non è mai stata eseguita.** |
| **Avvio dell'app e screenshot dei sei stati (§29)** | `xcode-select` punta a `/Library/Developer/CommandLineTools`, `simctl` assente; gli unici AVD Android disponibili sono API 24–27, sotto il supporto di Expo SDK 57; 4,5 GB liberi su disco. Inoltre, senza la migrazione applicata le due RPC non esistono. |
| **Confronto visuale con il PNG** | il mockup è stato usato per calibrare copy, ordine, trattamento delle modalità e posizione del suggerimento; non è stato possibile confrontarlo con screenshot reali, per il punto precedente. |
| **Onboarding sul selector condiviso** | vedi §9. |
| **QA funzionale §28** | i casi deterministici e puri sono coperti dai test (§10); quelli che richiedono dati reali, offline, revoca, secondo dispositivo e tastiera richiedono l'app in esecuzione. |

---

## 9. Limitazioni e debito dichiarato

### 9.1 — L'onboarding non usa ancora il selector condiviso

§19 chiede che l'onboarding riusi «il componente e la validazione geografica
con le CTA e il punto di persistenza già previsti dal flusso». I tre passi di
disponibilità (`PlayerAvailabilityStep`, `CoachAvailabilityStep`,
`StaffAvailabilityStep`) sono wizard a quattro schermate interne
(modalità → selezione → riepilogo) approvati da REV-ONB-02/03/04, con un
contatore di passo e un riepilogo che il selector inline non rappresenta.

**Fatto:** la logica di modalità e selezioni attive è la stessa
(`geographic-availability.ts` resta la logica del wizard e condivide il
vocabolario e le regole con `availability-areas-model.ts`).
**Non fatto:** sostituire le quattro schermate con il selector inline.
Richiede una decisione su cosa ne è del riepilogo di REV-ONB-02 §X, che non è
questa task a governare.

### 9.2 — I moduli Opportunità preselezionano ancora Tutta Italia

`normalizeAvailabilityType` coerce qualunque valore non riconosciuto a
`"ITALY"`, quindi dentro il modulo Opportunità un profilo mai configurato vede
"Tutta Italia" selezionata. Nell'editor focalizzato questo non accade:
`availability_configured_at` lo distingue.

Allinearli richiede di portare `availability_configured_at` dentro
`CompleteProfessionalProfile` e di gestire la modalità nulla in uno schermo il
cui modello non la ammette. È delimitato e non blocca il flusso di questa task;
non è stato fatto.

### 9.3 — Il riepilogo "Zone selezionate" è stato rimosso

Nei moduli Opportunità di Allenatore, Staff, Dirigente e Procuratore spariscono
il riepilogo territoriale e il pulsante "Modifica zone". Servivano a rendere
leggibili scelte fatte in una schermata separata; con il selector inline le
scelte sono a schermo, come chip rimovibili. Spariscono con loro le tre opzioni
di config `recapTitle` / `recapActionLabel` / `regionsModeTitle`: la copy delle
tre modalità è ora fissa e condivisa, come §12 richiede, quindi il Dirigente
non ha più la variante "In una o più aree".

### 9.4 — `profiles.is_open_to_transfer` resta duplicato

Il modulo Opportunità del Calciatore scrive sia `willing_to_change_club` sia
`is_open_to_transfer`. È debito preesistente, non toccato: la patch geografica
non scrive nessuno dei due.

---

## 10. Verifiche eseguite

| Controllo | Comando | Esito |
| --- | --- | --- |
| Type checking | `npx tsc --noEmit` (workspace `apps/mobile`) | **passa**, 0 errori |
| Lint | `npm run lint` | **0 errori**, 151 warning — tutti preesistenti (debito `react-hooks` v6 a warn); misurati 151 anche su `HEAD` in un worktree pulito: i file nuovi non ne aggiungono, e i quattro import inutilizzati introdotti dal refactor sono stati rimossi |
| Test | `npx vitest run` | **195 file, 2195 test, tutti verdi** |
| Test mirati nuovi | `npx vitest run src/features/profiles/availability-areas` | 2 file, 41 test verdi |

### Test aggiunti

**Modello (27).** Ordine e copy delle tre modalità; `ALL_ITALY` legacy;
nessuna modalità inventata da un valore assente; selezioni attive per modalità;
Tutta Italia senza liste; dedup; chip e checkbox sullo stesso insieme; le
cinque validazioni; una sola provincia/regione valida; nessun massimo di tre;
aree fuori tassonomia segnalate; regione rifiutata come provincia; confronto
insensibile all'ordine e alle selezioni inattive; `null` ≠ `ITALY`; 107
province e 20 regioni; metadato regione; **presenza di Aosta**; ricerca
insensibile ad accenti e punteggiatura; query vuota = tassonomia intera; chip
ordinati come la tassonomia con i valori legacy in coda.

**Editor (14).** Titolo e sottotitolo del master; nessuna tab; **nessuna
modalità preselezionata su un profilo senza aree**; precaricamento ed
espansione; microcopy; aree non più disponibili segnalate; errore di
caricamento senza vuoto spacciato per dato; CTA disabilitata senza modifiche;
checkbox allineato alle selezioni; rimozione chip = deselezione checkbox;
cambio modalità che conserva il draft e persiste un solo scope; revisione
inviata; modifica invalida non inviata e requisito spiegato; feedback
«Modifiche salvate.» e ritorno; errore che tiene l'editor aperto con le
selezioni intatte; conflitto distinto da un guasto.

**Copy dei suggerimenti (3).** Le quattro stringhe letterali di §8; chiave
sconosciuta senza copy; nessuna promessa di completamento o percentuale.

### Test aggiornati

`staff-edit-screens.test.tsx`, `agent-edit-screens.test.tsx`,
`director-edit-screens.test.tsx`: il riepilogo territoriale non esiste più e i
`testID` delle modalità sono quelli del selector condiviso.

---

## 11. Privacy e analytics

Le due RPC non hanno parametro identità: operano su `auth.uid()`, quindi
«leggere le mancanze o modificare le aree di un'altra PERSON cambiando ID» non
è esprimibile dal client. `profile_availability_areas(uuid)` è
`security definer` e **revocata a `authenticated`**: la chiamano solo le RPC,
che passano `auth.uid()`.

Il DTO dell'editor contiene la sola configurazione geografica: nessuna licenza,
nessun recapito, nessun indirizzo.

Tre eventi nuovi — `profile_area_editor_opened`, `profile_area_saved`,
`profile_area_save_failed` — più `profile_area_mode_changed` già esistente.
Passano modalità (enum), superficie di origine, sezione e **numero** di aree.
Il payload di `trackProfileEvent` è chiuso per costruzione: province, regioni,
coordinate, residenza e recapiti non hanno un campo dove finire.

---

## 12. Allineamento cromatico (§3)

Nessun accent locale introdotto. Il blu usato è `colors.accent` = **#1B4FD8**,
il blu saturo del design system allineato a DAS-REV-04, su CTA primarie, link,
radio e checkbox selezionati, chip selezionate e icona del suggerimento. Il
`accentSoft` #EDF2FE e il bordo `accentSoftBorder` #C9D8FA sono quelli già in
uso per le superfici azzurre tenui. Nessun token è stato ricavato campionando
il PNG.

---

## 13. Copertura dei sei screen master

| Screen | Dove | Stato |
| --- | --- | --- |
| 01 — Informazioni richieste | `DashboardPriority` + `profile_requirements_missing` | implementato; il suggerimento è soppresso quando esiste un requisito |
| 02 — Aree da impostare | modulo `personal_profile_suggestion`, order 30 | implementato, con indicazione e beneficio su due righe |
| 03 — Province specifiche | `AvailabilityAreasSelector`, modalità espansa | implementato: chip rimovibili, ricerca, tassonomia con regione come metadato |
| 04 — Una o più regioni | idem | implementato |
| 05 — Tutta Italia | idem | implementato: nessuna ricerca, nessuna lista, nessuna conferma aggiuntiva |
| 06 — Dopo il salvataggio | toast «Modifiche salvate.» + invalidazioni | implementato |

Verificato per struttura, copy e composizione tramite test a schermo. **Non**
verificato per pixel: vedi §8.
