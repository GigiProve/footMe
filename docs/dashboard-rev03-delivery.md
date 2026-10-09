# DAS-REV-03 — Dashboard personale: overview e priorità · consegna

**Task:** [#73091540](https://freedcamp.com/view/3728859/tasks/73091540)
**Estende:** [DAS-REV-01](./dashboard-rev01-delivery.md) · [DAS-REV-02](./dashboard-rev02-delivery.md) · [Common Contract](./dashboard-common-contract.md)
**Consolida:** DAS-02.1 (Panoramica Dashboard Personale) · DAS-02.5 (Aggiornamenti e scadenze)
**Data:** 2026-10-09
**Stato finale: completamento parziale.** Due blocchi di dominio dichiarati in §9 e la validazione visuale non eseguita (§8).

---

## 1. Sintesi

Una sola composizione personale sopra la Foundation, condivisa da Calciatore,
Allenatore e Staff tecnico: stessi moduli, stessi componenti, stesso ordine.
Cambiano i dati, i requisiti canonici del ruolo e le destinazioni di modifica
profilo — non la pagina.

I sei telefoni del mockup sono stati dello stesso container, non sei route.

Quattro cose che prima non esistevano:

| Cosa | Dove vive | Perché serviva |
| --- | --- | --- |
| Scadenza canonica dell'opportunità | `recruiting_ads.application_deadline_at` (+ fuso) | `deadline date` è una data locale senza cutoff: §14 vieta di assumerne mezzanotte |
| Eventi professionali della candidatura | `recruiting_application_events` + trigger | §11 vieta di usare `updated_at` come data di un aggiornamento |
| Finestre configurabili senza release | `dashboard_policies` | §11 e §15 le vogliono centrali e modificabili lato backend |
| Le mie candidature + dettaglio Application | `features/applications/`, `app/applications/` | la row della Dashboard deve aprire la candidatura per ID, e nel progetto non esisteva nessuna delle due superfici |

Due riallineamenti rispetto a DAS-REV-02, entrambi richiesti dal testo della
task:

- **`availability_required` esce da "Da gestire".** §19 dichiara le aree
  geografiche facoltative e vieta di chiamarle Informazioni richieste o Da
  gestire. Il tipo è stato rimosso dal registro delle priorità e sostituito dal
  modulo `personal_profile_suggestion`, in fondo alla composizione.
- **"Informazioni richieste" nasce come priorità vera**, legata al ruolo
  principale canonico del ruolo, che è obbligatorio e realmente mancabile.

---

## 2. File

### Nuovi

| File | Scopo |
| --- | --- |
| `supabase/migrations/20261014090000_dashboard_personal_overview.sql` | policy table, scadenza canonica, eventi candidatura, trigger di cutoff, action state, due RPC personali |
| `features/dashboard/personal/personal-presentation.ts` | budget dei segnali, formattazione scadenze e aggiornamenti, dedup, aggregazione requisiti (funzioni pure) |
| `features/dashboard/personal/use-toggle-saved-ad.ts` | bookmark della preview Salvate, optimistic + rollback, invalidazione dei segnali |
| `features/dashboard/components/DashboardSuggestion.tsx` | suggerimento facoltativo del profilo (§19) |
| `features/applications/applications-service.ts` | lista e dettaglio delle proprie candidature |
| `features/applications/MyApplicationsScreen.tsx` | "Le mie candidature" |
| `features/applications/ApplicationDetailScreen.tsx` | dettaglio candidatura con percorso degli eventi |
| `app/applications/index.tsx`, `app/applications/[id].tsx` | route |
| `features/dashboard/personal/personal-presentation.test.ts` | 24 test |
| `features/dashboard/personal/personal-priorities.test.ts` | 12 test |
| `features/dashboard/adapters/personal-adapter.test.ts` | 6 test |

### Modificati

| File | Modifica |
| --- | --- |
| `adapters/personal-adapter.ts` | riscritto sulle due RPC; nuovo payload con segnali, requisiti, aggiornamenti, suggerimento, policy |
| `modules/module-registry.ts` | due moduli personali nuovi, ordine §6 |
| `modules/dashboard-features.ts` | `personal_profile_requirements`, `personal_recent_updates`, `personal_event_registrations` (bloccata) |
| `priority/priority-registry.ts` | `saved_deadline` e `profile_requirements_missing`; rimosso `availability_required` |
| `priority/priority-types.ts` | `payload` del segnale, `presentation` del tipo |
| `components/DashboardPriority.tsx` | trattamento `row` a gruppo con divider, icona, accesso contestuale "Vedi tutte" |
| `components/DashboardEntityRow.tsx` | `statusPlacement: "trailing"` per lo stato in colonna destra |
| `components/DashboardSection.tsx` | `children` opzionale (modulo ridotto al solo accesso, §12) |
| `cache/dashboard-cache.ts`, `cache/use-dashboard-cache.ts` | `scope`, per due provider sulla stessa identità |
| `DashboardFoundation.tsx` | composizione personale, dedup, budget, routing, bookmark, riepilogo tappabile |
| `search/position-detail-service.ts`, `search/components/PositionDetailScreen.tsx` | cutoff canonico e CTA dell'action type reale (§17) |

---

## 3. Copertura di DAS-02.1 e DAS-02.5

| Requisito legacy | Dove | Nota |
| --- | --- | --- |
| DAS-02.1 — riepilogo a due metriche | `buildPersonalSummary` | conteggi dal dominio, non dalla lunghezza delle preview |
| DAS-02.1 — azione rapida Cerca posizioni | `buildQuickActions` | ora apre CER-04 (`/search/positions`), non la home di Cerca |
| DAS-02.1 — preview candidature e salvate | `ModuleRenderer` | row con ruolo, società, squadra, categoria utile, stato |
| DAS-02.1 — "Da controllare" | sostituito da **Da gestire** | riallineamento §2.1 |
| DAS-02.1 — hub "Informazioni del profilo" | **non ricreato** | §2.7: si riusano i moduli REV-PROF |
| DAS-02.5 — aggiornamenti recenti | modulo `personal_recent_updates` | da eventi reali, non da `updated_at` |
| DAS-02.5 — scadenze reali | `saved_deadline` | promozione server-side, finestra configurabile |
| DAS-02.5 — adeguamento del dettaglio | `PositionDetailScreen` | cutoff con anno e, quando rilevante, ora e fuso |

---

## 4. Regole effettive

| Regola | Valore | Dove è configurata |
| --- | --- | --- |
| Finestra di promozione delle scadenze | **7 giorni** (default V1) | `dashboard_policies.deadline_promotion_window_days` — modificabile senza release |
| Recency degli aggiornamenti | **7 giorni** dall'ultimo evento | `dashboard_policies.application_update_recency_days` |
| Scadenze promosse | massimo **2**, ordinate per cutoff più vicino poi id | cap nella RPC, non nel client |
| Budget dei segnali in evidenza | **3** (Foundation) | scadenze e requisiti per primi; aggiornamenti sui posti residui, max 2 |
| Preview candidature / salvate | massimo **3** | cap nella RPC |
| Requisiti obbligatori | **1 elemento aggregato** | `aggregateRequirements` |
| Suggerimento facoltativo | massimo **1** | modulo dedicato |

### Requisito obbligatorio per ruolo

Il solo requisito canonico oggi obbligatorio **e realmente mancabile** è il
ruolo principale. Non ne sono stati inventati altri (§13).

| Ruolo | Condizione | Destinazione |
| --- | --- | --- |
| Calciatore | riga `player_profiles` assente (`primary_position` è NOT NULL) | `/profile/edit/technical` |
| Allenatore | `coach_profiles.primary_role` vuoto | `/profile/coach-edit/technical` |
| Staff | `staff_profiles.primary_staff_role` vuoto | `/profile/staff-edit/professional` |

Il meccanismo di aggregazione di più requisiti è implementato e testato, ma il
modello oggi ne produce al massimo uno per ruolo.

### Eligibility di una scadenza (§15)

Tutte e otto le condizioni sono valutate in `fetch_dashboard_personal_overview`
e in `dashboard_position_action_state`, con il riferimento temporale del
database:

1. risorsa esistente e `status = 'published'`;
2. presente in `saved_ads` della PERSON;
3. `application_deadline_at` non nullo (la `deadline date` legacy è ambigua e
   non viene mai promossa);
4. cutoff non ancora superato;
5. cutoff entro la finestra configurata;
6. opportunità ancora aperta;
7. PERSON autorizzata all'azione;
8. nessuna candidatura già inviata (`status <> 'withdrawn'`).

---

## 5. Mapping delle route

| Elemento | Destinazione |
| --- | --- |
| Metrica "Candidature attive" | `/applications?filter=active` |
| Metrica "Posizioni salvate" | `/saved?filter=position` |
| Row candidatura | `/applications/[id]` |
| "Vedi tutte" candidature | `/applications` |
| Row aggiornamento recente | `/applications/[id]` |
| Row posizione salvata | `/position/[id]` |
| "Vedi tutte" salvate | `/saved?filter=position` |
| "Vedi opportunità" (scadenza) | `/position/[id]` |
| "Vedi tutte le opportunità salvate" | `/saved?filter=position` |
| "Completa informazioni" | modulo REV-PROF del ruolo (tabella §4) |
| "Imposta aree" | `/profile/{edit,coach-edit,staff-edit}/opportunities` |
| "Cerca posizioni" | `/search/positions` (CER-04) |

---

## 6. Contratti backend

### `fetch_dashboard_personal_overview()`

Nessun parametro di identità: opera solo su `auth.uid()`, così una richiesta
con il `person_id` di un altro utente non è esprimibile (§22).

Restituisce: due conteggi, preview candidature (≤3), aggiornamenti recenti
(≤2), segnali prioritari (≤2 scadenze + ≤1 requisito), totale dei segnali,
totale delle scadenze eleggibili, requisiti, suggerimento facoltativo, le
finestre effettivamente applicate, `access_verified_at` e `data_revision`.

### `fetch_dashboard_personal_saved_positions()`

Provider **indipendente**: §22 chiede che l'errore delle Posizioni salvate
resti locale al modulo mentre riepilogo, candidature e aggiornamenti restano
utilizzabili. Il payload non contiene scadenza, descrizione, requisiti, numero
di candidati o punteggio (§10).

### `dashboard_position_action_state(p_ad_id)`

Una sola definizione di eligibility, usata dalla Dashboard e dal dettaglio.
`action_type` è `apply` o `none`; `register` è nel vocabolario e non viene mai
emesso (vedi §9).

### Trigger

- `recruiting_applications_log_event` — registra le transizioni di stato. Senza
  backfill: §27 vieta di inventare date durante una migrazione, quindi le
  candidature già transitate non hanno eventi e non compaiono in Aggiornamenti
  recenti.
- `recruiting_applications_submission_window` — rivalida pubblicazione e cutoff
  all'invio, così un dettaglio aperto prima della scadenza e inviato dopo
  riceve l'errore di dominio invece di una falsa conferma (§17).

---

## 7. Verifiche eseguite

| Controllo | Comando | Esito |
| --- | --- | --- |
| Type checking | `npm run typecheck` (workspace `apps/mobile`) | **passa**, 0 errori |
| Lint | `npm run lint` | **0 errori**, 149 warning — tutti preesistenti (debito `react-hooks` v6 a warn); i file nuovi non ne aggiungono |
| Test | `npm test` | **188 file, 2089 test, tutti verdi** |
| Test mirati nuovi | `npm test -- src/features/dashboard` | 12 file, 164 test verdi |

Test aggiunti: budget dei segnali; confini di cutoff e fuso; etichette
relative su giorni di calendario; `hasSignificantUpdate`; deduplicazione e
stato "collassato" senza falso empty; aggregazione dei requisiti; ordinamento
delle scadenze e spareggio deterministico; dedup di eventi duplicati; assenza
di `availability_required` dal registro; presentazione row/card; mapping
dell'adapter e rifiuto di una cache di schema vecchio.

Test aggiornati: `composition.test.ts` (ordine personale §6),
`dashboard-components.test.tsx` (`presentation`),
`position-detail-service.test.ts` (mock della RPC di action state).

---

## 8. Controlli NON eseguiti

Dichiarati come tali, non aggirati.

| Controllo | Perché |
| --- | --- |
| **Esecuzione della migrazione** | nessun Supabase CLI, nessun `psql`, daemon Docker non attivo sulla macchina. La SQL è stata rivista staticamente (bilanciamento dei blocchi, ordine delle colonne di `returns table`, assenza di riferimenti ambigui agli OUT param) ma **non è mai stata eseguita**. |
| **Push su remoto** | non eseguito: è un'azione sull'ambiente condiviso e non è stata richiesta. |
| **Avvio dell'app e screenshot dei sei stati** | nessun Xcode installato (`xcode-select` punta ai Command Line Tools, `simctl` assente). Gli unici AVD Android disponibili sono API 24/27, sotto il supporto di Expo Go per SDK 57. Inoltre, senza la migrazione applicata le due RPC non esistono: l'app mostrerebbe lo stato di errore, non i sei master. |
| **Confronto visuale con il PNG** | il mockup è stato fornito in conversazione e usato per calibrare ordine, trattamento delle row, copy e gerarchia (vedi §10). Non è stato possibile confrontarlo con screenshot reali, per il punto precedente. |
| **QA funzionale §28 (54 casi)** | i casi deterministici e puri sono coperti dai test; quelli che richiedono dati reali, timezone del dispositivo, offline e revoca richiedono l'app in esecuzione. |

Il PNG **non è allegato alla task Freedcamp** (`files_count: 0`) e la
descrizione dichiara che non è su Banani. È arrivato come immagine in
conversazione.

---

## 9. Dipendenze mancanti e blocchi dichiarati

### 9.1 — Allenatori e Staff non possono candidarsi (blocco di dominio)

`recruiting_applications.player_profile_id` è **NOT NULL** e referenzia
`player_profiles`: solo un Calciatore con profilo sportivo può creare una
candidatura, anche se `recruiting_ads.target_role` contempla già `coach` e
`staff`.

Conseguenze reali, non nascoste:

- "Le tue candidature" e "Aggiornamenti recenti" restano legittimamente vuoti
  per Allenatore e Staff;
- nessuna scadenza viene promossa per quei ruoli, perché la condizione 7 di §15
  (PERSON autorizzata all'azione) è falsa;
- il dettaglio di una posizione mostra «La candidatura è disponibile per i
  profili calciatore» invece di una CTA che fallirebbe.

Gli screen 02 e 03 del mockup sono quindi riproducibili nella **composizione e
nel layout**, non nei dati. Rendere `player_profile_id` nullable cambierebbe
ownership e lifecycle dell'entità Application e toccherebbe il flusso di
valutazione lato Società: §17 chiede di segnalare il blocco, non di risolverlo
inventando un flusso. **Decisione richiesta.**

### 9.2 — Provini e iscrizioni non esistono (integrazione dichiarata)

Nessuna tabella di evento, nessuna iscrizione, nessun termine di registrazione.
L'integrazione è dichiarata e protetta dal meccanismo esistente:
`personal_event_registrations` in `dashboard-features.ts` è `available: false`
con motivo e owner (pack DAS-REV-28–31).

Perciò `action_type` non emette mai `register`, nessuna CTA "Iscriviti" viene
disegnata in produzione, e la scadenza promossa oggi è quella delle Posizioni
con `application_deadline_at`. Il layout del gruppo e la formattazione
`Iscrizioni entro il …` sono implementati e coperti da test con fixture
isolate.

### 9.3 — Nessuna opportunità ha ancora una scadenza canonica

`application_deadline_at` è nuova e nullable: nessun annuncio esistente la
valorizza, e §27 vieta di inventarla durante la migrazione. Finché non viene
popolata (composer Posizioni della Società, pack editoriale), "Da gestire"
mostrerà solo i requisiti obbligatori. È il comportamento corretto — §13 vieta
di mostrare la sezione senza elementi eleggibili.

---

## 10. Scostamenti dal mockup, dichiarati

| Punto | Mockup | Scelta | Perché |
| --- | --- | --- | --- |
| Gruppo scadenze | due superfici azzurre apparentemente separate | **una** superficie con divider fra le righe | §16: «un gruppo compatto, con divider tra elementi». §2: il testo prevale sulle incongruenze dell'immagine |
| Copy della scadenza | "Iscrizioni entro il 15 settembre" | "Candidature entro il …" quando l'azione è una candidatura | §17 vieta di scegliere il testo arbitrariamente: il verbo viene dall'action type. "Iscrizioni" resta per `register` |
| Categoria nelle row | assente | mostrata solo se **diversa** dal nome squadra | §9 la vuole «quando utile»: "Varese Calcio · Primavera · Primavera" non lo è |
| Stato della row | in colonna a destra | implementato con `statusPlacement="trailing"`, limitato ai moduli personali | la Dashboard Società resta sul trattamento DAS-REV-01 (§5: riutilizzare integralmente la Foundation) |
| Dati di esempio | logo squadre, "Dati di esempio" in calce | non riprodotti | §25 li esclude esplicitamente dall'app |

---

## 11. Confini con DAS-REV-04 / 05 / 06

Cosa è stato fatto **al minimo** e che cosa resta ai pack successivi.

| Pack | Già disponibile come base | Non implementato qui |
| --- | --- | --- |
| **DAS-REV-04 — Widget Candidature** | `features/applications/` (lista + dettaglio + servizio), preview e conteggi della Dashboard, routing tipizzato | ritiro, filtri avanzati, storico, valutazione, ordinamenti alternativi, contesto "Concluse" |
| **DAS-REV-05 — Widget Posizioni salvate** | provider indipendente, bookmark con rollback, stato "Non più disponibile" sulla row | tab Disponibili / Non più disponibili, lifecycle completo delle risorse salvate non più visibili |
| **DAS-REV-06 — Widget profilo e disponibilità** | `profile_requirements_missing`, `personal_profile_suggestion`, destinazioni REV-PROF per ruolo | catalogo completo dei requisiti per ruolo, segnali di profilo oltre il ruolo principale |

Nessuna seconda implementazione prevista: i pack successivi estendono questi
moduli.

---

## 12. Privacy e analytics

- I DTO Dashboard non contengono note private della Società, valutazioni
  interne, contatti privati, numero licenza, indirizzi completi o campi profilo
  non necessari. La località della posizione salvata è città e regione della
  Società, che sono pubbliche.
- Le due RPC non accettano un id di identità: operano su `auth.uid()`.
- Gli eventi analytics riutilizzano quelli della Foundation
  (`trackModuleAction`, `trackPriorityImpression`, `trackPriorityTap`,
  `trackDashboardModuleError`…). **Nessun id persistente di persona, società,
  candidatura o opportunità è stato aggiunto ai payload**: §26 lo vieta senza
  una policy esplicita, e la vecchia richiesta di ID nelle analytics non
  prevale sul Common Contract.
- Nessuna notifica, push o messaggio viene generato perché la Dashboard mostra
  un reminder.

---

## 13. Rollout e rollback

Tutte le estensioni sono additive e nullable. Rollback della migrazione:
droppare le due RPC, `dashboard_position_action_state`, i due trigger e le loro
funzioni, `recruiting_application_events`, `dashboard_policies` e le due colonne
di `recruiting_ads`. Nessun dato preesistente viene modificato, quindi il
rollback non perde nulla; il client tornerebbe però a una Dashboard personale
in errore finché non si ripristina anche l'adapter.

La chiave della cache Dashboard cambia (nuovo segmento `scope`): i record
esistenti risultano assenti e vengono semplicemente ricaricati.

---

## 14. Regressioni note

Nessuna osservata nelle superfici testate (2089 test verdi). Le superfici
effettivamente toccate oltre alla Dashboard sono il dettaglio Posizione
(`PositionDetailScreen`, nuova CTA e nuovo cutoff) e la riga condivisa
`DashboardEntityRow` (nuova prop opzionale, default invariato). Non è stata
verificata a runtime nessuna superficie, per i motivi di §8.
