# DAS-REV-02 — Foundation: priorità, cache e stati · consegna

**Task:** [#73073129](https://freedcamp.com/view/3728859/tasks/73073129)
**Estende:** [DAS-REV-01](./dashboard-rev01-delivery.md) · [Common Contract](./dashboard-common-contract.md)
**Consolida:** DAS-01.4 (priorità e ordinamento) · DAS-01.5 (stati globali)
**Data:** 2026-10-09

---

## 1. Sintesi

La Foundation di DAS-REV-01 sapeva **di chi** è la Dashboard e **di cosa** è
fatta. DAS-REV-02 aggiunge la domanda mancante: **quanto sono affidabili i dati
che mostra**.

Gli otto master della tavola sono stati dello stesso container. Non esiste un
ramo che renda "una Dashboard diversa": esistono uno stato di pagina derivato
da `state/dashboard-state.ts` e quattro superfici che quello stato sceglie.

Quattro sistemi nuovi, tutti condivisi fra personale, Società e Media:

| Sistema | Dove vive | Che cosa garantisce |
| --- | --- | --- |
| Registro e ranking delle priorità | `priority/` | ordine deterministico, aggregazione stabile, max 3 visibili, max 1 modulo promosso |
| Modello degli stati | `state/` | page / module / connection / refresh / access / data separati e non combinabili a caso |
| Cache e freschezza | `cache/` | isolamento per actor+identità+scope+versioni, finestra offline finita |
| Policy di retry | `state/retry-policy.ts` | timeout, backoff, budget, categorie che non si ritentano |

---

## 2. File

### Nuovi

| File | Scopo |
| --- | --- |
| `priority/priority-types.ts` | contratto del registro e del segnale operativo, `PRIORITY_RULES_VERSION` |
| `priority/priority-registry.ts` | i tre tipi di priorità e le loro regole di risoluzione |
| `priority/priority-ranking.ts` | comparatore, dedup, eligibility, limite visuale, promozione |
| `priority/module-order.ts` | ordine base, promozione, momenti sicuri (funzioni pure) |
| `priority/use-dashboard-order.ts` | ordine applicato e ordine in attesa |
| `state/dashboard-state.ts` | modello degli stati e derivazione dello stato di pagina |
| `state/error-classification.ts` | dieci categorie interne, classi `DashboardTimeoutError` / `DashboardPayloadError` |
| `state/retry-policy.ts` | timeout, backoff, budget, `withTimeout` |
| `state/use-dashboard-connection.ts` | stato di connessione derivato dagli esiti |
| `state/use-access-window.ts` | tick della finestra di accesso organizzativa |
| `cache/freshness-policy.ts` | stale, scadenza rigida, finestra di accesso, retention |
| `cache/dashboard-cache.ts` | chiave, lettura con verdetto, scrittura, pulizia |
| `cache/use-dashboard-cache.ts` | idratazione e scrittura, isolate per contesto |
| `adapters/society-adapter.ts` | riepilogo, segnali e preview Società (estratto da `identity/identity-service.ts`) |
| `adapters/positions-adapter.ts` | provider indipendente delle Posizioni aperte |
| `supabase/migrations/20261013090000_dashboard_priority_states.sql` | `fetch_dashboard_society_overview` riscritta + `fetch_dashboard_society_positions` |

Test affiancati: `priority-ranking.test.ts`, `module-order.test.ts`,
`dashboard-state.test.ts`, `freshness-policy.test.ts`,
`dashboard-cache.test.ts`, `components/dashboard-states.test.tsx`.

### Modificati

| File | Perché |
| --- | --- |
| `DashboardFoundation.tsx` | orchestrazione: cache, connessione, ranking, ordine, stato di pagina, snackbar |
| `components/DashboardStates.tsx` | aggiunti Global Empty, Global Offline, indicatore offline; skeleton fuori dalla sequenza screen reader |
| `components/DashboardSection.tsx` | errore di modulo del master 04, feedback "dati non aggiornati" |
| `components/DashboardPriority.tsx` | contratto allineato al ranking, icone per tipo, label accessibile completa |
| `components/DashboardEntityRow.tsx` | tile con icona per le Posizioni (non sono persone) |
| `modules/module-registry.ts` | nuovo modulo `society_positions`, ordine base ribasato, flag `countsAsContent` |
| `dashboard-analytics.ts` | 14 eventi DAS-REV-02 |
| `adapters/personal-adapter.ts` | type guard per il riuso da cache |
| `identity/identity-service.ts` | ridotto alle sole identità |
| `ui/Toast/ToastProvider.tsx` | azione inline e deduplicazione per `id` |
| `features/auth/logout.ts` + 2 call site | pulizia immediata delle cache private dell'actor |
| `src/test/async-storage.ts` | `getAllKeys` / `multiRemove` per testare la pulizia |

### Riusato senza duplicare

`Screen`, `AppText`, `Button`, `Skeleton`, `ToastProvider`, `RefreshControl`,
`DashboardSection`, `DashboardSummary`, `DashboardQuickActions`,
`DashboardAreaRow`, `DashboardIdentityRow`, `DashboardIdentitySheet`,
`composeDashboard`, `MODULE_REGISTRY`, `dashboard-features`, `DASHBOARD_QK`,
`useDashboardIdentity`, `getPlayerPositionLabel`, `APPLICATION_STATUS_LABELS`,
`dashboard_club_capabilities`.

Nessun `DashboardV2`, nessun secondo store globale, nessuna snackbar dedicata
alla Dashboard, nessun sistema separato per Società e Media.

---

## 3. Copertura di DAS-01.4 e DAS-01.5

| Legacy | Dove è coperta |
| --- | --- |
| DAS-01.4 — priorità e ordinamento dinamico | `priority/` per intero: registro versionato, comparatore a sei criteri, aggregazione per chiave stabile, limite di tre, promozione di un solo modulo, momenti sicuri |
| DAS-01.5 — stati globali | `state/dashboard-state.ts` + `components/DashboardStates.tsx`: initial / ready / empty / unavailable, con connessione, refresh, accesso e freschezza come dimensioni separate |

Le due task legacy **non** sono state archiviate: §2 lo esclude dallo scope.

---

## 4. Regole effettive

### 4.1 Ranking (`comparePriorities`)

1. livello operativo (`normal` < `relevant` < `attention` < `critical`);
2. a parità di livello, azione prima di informazione;
3. impatto (0–100, dal tipo o sovrascritto dal dominio);
4. prossimità di una scadenza reale — **una scadenza assente vale infinito**,
   quindi non sembra mai imminente;
5. recency dell'evento operativo;
6. chiave stabile, come spareggio finale.

Nessuna regola assegna `critical`: il livello esiste nel tipo perché la task lo
nomina, ma §8 vieta di introdurlo senza un caso di dominio giustificato.

### 4.2 Aggregazione

Chiave = `<tipo>:<identità>:<risorsa>`, costruita nel database. Non deriva dal
testo né dal conteggio: cinque candidature che diventano due restano la stessa
priorità. La deduplicazione tiene **una** occorrenza per chiave, quella con la
revisione più alta; i conteggi non si sommano mai.

`occurred_at` è il `created_at` della candidatura da gestire più recente, non
`now()`: se il conteggio scende, il massimo residuo non può aumentare, quindi
la sola variazione del conteggio non riporta la priorità in cima.

### 4.3 Risoluzione

| Tipo | Condizione canonica |
| --- | --- |
| `new_applications` | le candidature `submitted` della Posizione scendono a zero |
| `publication_failed` | il dominio editoriale conferma una transizione che elimina il fallimento |
| `availability_required` | il dominio conferma il completamento dei requisiti |

Aprire la Dashboard, toccare "Valuta candidature" o leggere una notifica **non**
risolve nulla. Non esiste una X universale, una checklist o un "Completato".

### 4.4 Promozione

Zero oppure **un solo** modulo promosso: il primo del ranking che richiede
un'azione, dichiara un modulo e il cui modulo è nella composizione. Gli altri
conservano l'ordine relativo — `applyPromotion` sposta un elemento, non
riordina.

Ordine base dello scenario sportivo: `society_positions` (10) →
`society_applications` (20) → `society_drafts` (30) →
`society_recent_content` (40) → `society_areas` (50).

### 4.5 Momenti sicuri

Si applica un ordine nuovo al primo caricamento utile, al cambio identità, al
completamento di un refresh e al ritorno da un'azione confermata — **e solo se
l'utente non sta interagendo**. Durante lo scroll l'ordine resta pending.

Le **rimozioni** sono immediate e non attendono nulla: l'ordine mostrato è
sempre `applicato ∩ proposto`, quindi un modulo sparito dalla composizione non
può comparire, qualunque sia lo stato di interazione.

---

## 5. Modello degli stati

| Dimensione | Valori |
| --- | --- |
| pagina | `initial` · `ready` · `empty` · `unavailable` |
| modulo | `loading` · `loaded` · `empty` · `error` |
| connessione | `online` · `offline` · `unknown` |
| refresh | `idle` · `running` · `failed` |
| accesso | `valid` · `revalidate` · `revoked` |
| dato | `absent` · `fresh` · `stale_usable` · `unusable` |

**Global Error** quando non resta una Dashboard affidabile: composizione non
interpretabile, nessuna cache consentita, nessun modulo utile dopo i
fallimenti.

**Global Empty** quando tutti i moduli *che portano contenuto* hanno risposto
in modo valido e sono vuoti. "Aree di gestione" è marcato
`countsAsContent: false` perché è navigazione: contarlo renderebbe il master 08
irraggiungibile per qualunque Società autorizzata.

**Global Offline** = connessione `offline` **e** pagina `unavailable`. Stessa
superficie del Global Error, copy diversa.

Un errore di modulo non diventa mai errore di pagina. Sono combinazioni valide
e tutte presenti nei master: pronta + offline (05), pronta + refresh fallito
(06), pronta + un modulo in errore (04).

---

## 6. Policy adottate

| Policy | Valore | Note |
| --- | --- | --- |
| stale — operativi (priorità, summary, candidature, posizioni) | 60 s | default V1 della task |
| stale — gestionali (Squadre) | 5 min | |
| stale — presentazione (nome, logo) | 15 min | |
| scadenza rigida — operativi e gestionali | 15 min | oltre, il payload non è mostrabile |
| scadenza rigida — presentazione | 24 h | |
| **finestra di accesso offline SOCIETY/MEDIA** | **15 min** dall'ultima verifica server-side riuscita | decisione V1 di questo consolidamento |
| retention su disco | 24 h dall'ultimo fetch valido | ≠ 24 h di visualizzazione |
| timeout — accesso/composizione | 10 s per tentativo | |
| timeout — dati modulo | 15 s per tentativo | |
| retry automatici | 1 massimo | |
| backoff | 1 s iniziale + jitter ≤ 300 ms | |
| budget di ciclo | 30 s, retry inclusi | prevale sul tentativo residuo |
| mai ritentate | offline, authorization, not_found, unsupported_payload, maintenance, rate_limit | |

Il valore effettivo di mostrabilità è sempre il **minimo** fra scadenza del
dato e finestra di accesso: un payload fresco di 30 secondi non si mostra se la
verifica di accesso ne ha venti di minuti.

Un orologio arretrato produce un'età negativa e invalida il record: accorcia la
finestra, non la prolunga.

`fetchedAt` e `accessVerifiedAt` si aggiornano **solo** dopo un risultato valido
della fonte. `useDashboardCache` non espone un modo per scrivere senza payload,
quindi una lettura, un retry fallito o un ritorno in foreground non possono
rinnovarli.

---

## 7. Contratti backend

### `fetch_dashboard_society_overview(uuid)` — riscritta

Rimosse: `priority_ad_id`, `priority_ad_title`, `priority_new_applications`
(una sola priorità cablata, incompatibile con §7–§9).

Aggiunte: `applications_to_handle_count`, `priority_signals` (array jsonb di
segnali normalizzati), `priority_total_count`, `access_verified_at`,
`data_revision`.

Spostata fuori: la preview delle Posizioni.

### `fetch_dashboard_society_positions(uuid)` — nuova

Provider indipendente del modulo "Posizioni aperte", con la stessa capability
`positions_view` del conteggio. Esiste perché il master 04 richiede che il suo
fallimento resti locale: con una RPC sola quel caso non sarebbe rappresentabile
— un fallimento spegnerebbe l'intera pagina. Il **conteggio** resta nel
riepilogo, così da restare noto anche quando la lista fallisce.

Entrambe `security definer` con filtro esplicito sull'actor, `revoke from
public`, `grant to authenticated`. Nessuna tabella, colonna o policy nuova;
nessun permesso concesso.

---

## 8. Gestione di switch, revoche e mutazioni

- **Query key** per actor + identità: una risposta tardiva di B atterra nella
  cache di B e non può comparire sotto l'header di C.
- **Chiave di cache** per actor + identità + tipo + fingerprint delle
  capability + versione di schema + versione delle regole: un record di altro
  contesto non viene *filtrato dopo*, semplicemente non si trova.
- **`data_revision`**: una risposta con revisione più vecchia non viene
  applicata né scritta in cache. Protegge le risposte fuori ordine **dentro** la
  stessa identità.
- **Revoca di capability**: cambia il fingerprint, quindi la cache precedente è
  irraggiungibile; `isPriorityEligible` ricontrolla le capability prima del
  ranking, così una priorità scritta in cache quando il permesso esisteva non
  può riapparire.
- **Logout e cambio account**: `clearDashboardCache` rimuove subito i record
  dell'actor, prima del `signOut`. `queryClient.clear()` da solo svuotava la
  memoria ma non AsyncStorage.
- **Finestra di accesso scaduta a pagina aperta**: `useAccessWindow` ticchetta
  ogni 30 s e azzera `societyData`, portando la pagina a `unavailable`.

---

## 9. Analytics

Quattordici eventi (`dashboard_load_started`, `dashboard_first_useful_render`,
`dashboard_load_failed`, `dashboard_refresh`, `dashboard_module_error`,
`dashboard_module_retry`, `dashboard_offline`, `dashboard_cache_unusable`,
`dashboard_empty`, `dashboard_priority_impression`, `dashboard_priority_tap`,
`dashboard_priority_removed`, `dashboard_module_promoted`,
`dashboard_order_applied`).

Parametri: enum, posizioni, durate, versioni. **Nessun** nome, recapito,
titolo, testo di candidatura, contenuto editoriale o id di persona/risorsa. Le
chiavi di priorità incorporano l'id della risorsa, per questo gli eventi
ricevono `typeId` e non la chiave.

Impression deduplicate per contesto. `hidden_by_limit` e `permission_revoked`
sono motivi di rimozione **distinti** da `resolved`.

> **Stato reale, da non travisare:** `setAnalyticsSink` non è mai chiamato nel
> progetto, quindi `trackEvent` è oggi un no-op. Gli eventi sono definiti e
> invocati; **nessuno è stato osservato su un sink reale**.

---

## 10. Verifiche eseguite

| Comando | Ambiente | Esito |
| --- | --- | --- |
| `npm run typecheck` | node 20 via `scripts/run-node20.sh` | ✅ nessun errore |
| `npm test -- --run` | vitest 4.1.11 | ✅ **2048 test, 185 file** |
| `npm test -- --run src/features/dashboard` | vitest | ✅ **123 test, 9 file** |
| `npm run lint` | eslint | ✅ 0 errori (warning preesistenti altrove, nessuno sui file toccati) |

### Test unitari aggiunti (§36)

- comparatore deterministico e tutti e sei gli spareggi, verificato anche
  invertendo l'ordine di input;
- aggregazione e deduplicazione cross-source;
- limite di tre e unicità del modulo principale (QA-06);
- risoluzione parziale e completa senza cambio di chiave (QA-03, QA-04);
- eligibility applicata **prima** del ranking (QA-13);
- freschezza per provider, scadenza rigida, finestra di accesso (QA-25, QA-26,
  QA-29);
- mancato rinnovo dei timestamp su lettura di cache (QA-25);
- transizioni di pagina con connessione separata, incluso «un 500 non è
  offline» (§17);
- isolamento della cache per actor, identità e scope (QA-20, QA-21, QA-24);
- cache corrotta e retention (QA-33, QA-34);
- scelta del momento sicuro e immediatezza delle rimozioni.

Tutti con orologio controllato: nessun test dipende da attese reali.

### Test di rendering degli stati

`components/dashboard-states.test.tsx` verifica le copy prescritte e la
struttura dei master 03, 04, 05, 07 e 08 — skeleton senza testo di dominio e
fuori dalla sequenza screen reader, retry locale, indicatore offline senza
azione, errore generale senza CTA di creazione, empty senza pulsante quando la
capability manca.

**Non sono un confronto visuale.** Uno snapshot di markup non dimostra
tipografia, spacing, allineamento, colore, radius o densità.

---

## 11. Controlli NON eseguiti

Elencati con il motivo, come richiede §38. Nessuno di questi è stato dichiarato
superato.

| Controllo | Motivo |
| --- | --- |
| **Validazione visuale (§37): app avviata e otto screenshot** | Nessun toolchain iOS sulla macchina: `xcode-select -p` → `/Library/Developer/CommandLineTools`, `xcrun simctl` non disponibile. Gli AVD Android presenti sono API 24/27, sotto il minimo pratico di Expo SDK 57 con Expo Go. `react-native-web` non è installato, quindi nemmeno il target web è percorribile. |
| Confronto a 320 / 375 / 393 / 430, Dynamic Type, reduced motion | Dipende dal punto sopra. I vincoli sono implementati (`numberOfLines`, `flexShrink`, tap target ≥ 44 via `sizes.touchTarget`, nessuna larghezza fissa) ma **non osservati a schermo**. |
| **Migrazione applicata e provata** | Nessun `psql`, nessuna CLI `supabase`, nessun Docker attivo sulla macchina. La migrazione è stata rivista a mano (13 colonne nel `return table` e nei due rami di `return query`, `drop` prima del `create` per il cambio di firma, `stable` preservato usando `v_now` invece di `clock_timestamp()`), ma **non è stata eseguita**. |
| Verifica sui domini reali (QA-11, QA-12, QA-22, QA-44, QA-45) | Richiedono backend, credenziali e dati di dominio. |
| Analytics su sink reale | `setAnalyticsSink` non è mai chiamato nel progetto. |

**Attenzione nota dal progetto:** lo schema remoto ha già mostrato deriva
rispetto alle migrazioni (`recruiting_ads.target_role` è `app_role` in
produzione e `text` nei file). Questa migrazione non tocca `target_role`, ma la
verifica su remoto resta necessaria prima del rilascio.

---

## 12. Integrazioni escluse dalla produzione

| Funzione | Stato | Proprietario |
| --- | --- | --- |
| `society_scheduled_content` | contratto pronto (colonna `scheduled_count`, tipo `publication_failed` nel registro), `available: false` | pack editoriale Società |
| `society_invites` | contratto pronto, `available: false` — `/club-admin/invites` è gated sul ruolo, non sulla capability | pack Inviti |

Il tipo `publication_failed` è nel registro con tutte le sue regole, ma
`isPriorityEligible` lo esclude finché la feature è `false`: il contratto esiste,
il dominio no, e la Dashboard non lo simula. Non è stato implementato nulla di
HOM-06.2 per mostrare una priorità editoriale.

"Vedi tutte le attività" **non** esiste: §9 lo consente solo con una
destinazione funzionante e autorizzata, e nessun Task Center è stato creato.

---

## 13. Scostamenti dal mockup, dichiarati

§2 stabilisce che «le specifiche testuali prevalgono su eventuali incongruenze
accidentali del mockup».

1. **Modulo "Posizioni aperte" nello screen 01.** La miniatura 01 passa dalla
   preview Candidature direttamente ad "Aree di gestione". §11 richiede però
   che la promozione **riordini**, mantenendo «gli altri nel loro ordine
   relativo» — non che rimuova un modulo. L'implementazione lascia quindi
   "Posizioni aperte" dopo le Candidature promosse.
2. **"Posizioni aperte" compare come modulo e come riga di "Aree di
   gestione".** È ciò che mostra il master 01 (riepilogo "3 Posizioni aperte" +
   riga "Posizioni aperte 3"). Hanno scopi diversi — preview di ciò che è
   aperto contro scorciatoia gestionale con totale — e §11 vieta la ripetizione
   del *messaggio numerico* su riepilogo, priorità e preview, condizione
   rispettata: la priorità dice 5 da gestire, il riepilogo 27 totali, la
   preview due righe.
3. **Snackbar del master 06.** Estesa la `ToastProvider` esistente con
   un'azione inline e una durata più lunga, invece di creare una seconda
   snackbar: §28 lo chiede esplicitamente.

---

## 14. Rollout e rollback

- Nessun flag di rollout nuovo: `dashboard-features` resta l'unico interruttore,
  e governa disponibilità di destinazione, non autorizzazione.
- Versioni esplicite: `DASHBOARD_CACHE_SCHEMA_VERSION` e
  `PRIORITY_RULES_VERSION` entrano nella chiave di cache. Un rollback della UI
  trova chiavi diverse e **non** riusa record scritti da questa versione; non
  può quindi ripristinare cache prive di isolamento né bypassare revoche.
- Migrazione non distruttiva: nessuna riga toccata, nessuna colonna rimossa da
  una tabella, nessun permesso concesso. Il rollback è il ripristino della
  definizione precedente della RPC più un `drop` della nuova funzione.

---

## 15. Limiti residui

1. **Nessun rilevamento proattivo della connessione.** Senza
   `@react-native-community/netinfo` lo stato parte da `unknown` e diventa
   `offline` solo dopo un fallimento di trasporto. La distinzione richiesta
   dalla task — connettività ≠ raggiungibilità del server — è comunque
   rispettata, perché uno status HTTP dimostra che una risposta è arrivata. Il
   costo: nessun avviso prima della prima richiesta e nessun "sei tornato
   online" istantaneo. Introdurre la dipendenza resta un'attività dedicata, con
   la necessità da dimostrare (CC-02).
2. **`withTimeout` non annulla la richiesta sottostante.** `supabase-js` non
   espone un `AbortSignal` su `rpc()`: il budget impedisce alla UI di restare in
   loading, non alla richiesta di concludersi. Le risposte tardive sono
   comunque scartate dalla guardia di revisione.
3. **Il ranking è calcolato nel client su segnali già filtrati server-side.**
   §8 consente «backend o servizio condiviso autorevole»; eligibility, conteggi
   e aggregazione sono nel database, la comparazione è nel client ed è una
   funzione pura e versionata. Non esistono due algoritmi diversi.
4. **Nessuna infrastruttura realtime introdotta.** L'allineamento avviene al
   refresh, al ritorno in foreground e alla riconnessione. La Dashboard non
   dichiara aggiornamenti realtime perché non li implementa.
5. **QA visuale e migrazione non eseguite** (§11 di questo documento).

---

## 16. Regressioni

Verificate per via automatica (typecheck, lint, 2048 test): shell e selector di
DAS-REV-01, composizione per capability, risoluzione dell'identità, componenti
condivisi, `ToastProvider` e i suoi consumatori, `logout` e i suoi due call
site.

**Non verificate a runtime**, perché l'app non è stata avviata: navigazione
reale verso Posizioni e Candidature, creazione posizione, gestione candidature,
`/club-admin`, Centro Notifiche, identità di Home / Messaggi / Profilo,
sessioni fra account diversi.

Nessuna conferma assoluta di assenza di regressioni: solo le superfici
effettivamente verificate, con il mezzo indicato.
