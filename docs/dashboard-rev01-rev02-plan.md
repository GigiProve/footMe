# ProLink Dashboard — Piano tecnico DAS-REV-01 e DAS-REV-02

**Codice task di origine:** DAS-REV-00 (output di pianificazione)
**Contratto:** [`dashboard-common-contract.md`](./dashboard-common-contract.md) v1.0
**Ricognizione:** [`dashboard-recognition-map.md`](./dashboard-recognition-map.md)
**Data:** 2026-10-09

> Il piano copre **solo** i due pack successivi, come prescritto da CC-22. Non anticipa i
> moduli delle wave successive. Nessuna attività qui elencata è stata eseguita da
> DAS-REV-00.

---

## 0. Confine tra i due pack

| | DAS-REV-01 — Foundation: shell, identity e composizione | DAS-REV-02 — Foundation: priorità, cache e stati |
| --- | --- | --- |
| **Domanda a cui risponde** | *Di chi è questa Dashboard e di cosa è fatta?* | *Quanto sono affidabili i dati che mostra?* |
| **Regole CC principali** | CC-03 (identità), CC-04, CC-05, CC-06, CC-07, CC-08, CC-10, CC-11, CC-12, CC-17 | CC-07 (revoca), CC-09, CC-13, CC-14, CC-18 (eventi di esito), CC-16 (rivalidazione) |
| **Consolida (legacy)** | DAS-01.1, DAS-01.2, DAS-01.3, DAS-03.3.3 | DAS-01.4, DAS-01.5 |
| **Richiede mockup approvato** | Sì (master Foundation) | No — comportamentale, usa i master di REV-01 |
| **Tocca i domini?** | No: solo shell, identity, composizione, registro moduli vuoto o con moduli esistenti | No: solo stati, cache e priorità della Foundation |

**Regola di confine operativa:** se un comportamento è osservabile *senza* una seconda
richiesta di rete o un cambio di autorizzazione, appartiene a REV-01. Se dipende da
tempo, rete, revoca o riconciliazione, appartiene a REV-02.

---

## 1. DAS-REV-01 — Foundation: shell, identity e composizione

### 1.1 Obiettivo

Sostituire il bivio `role === "club_admin" ? ClubDashboard : PersonalDashboard` con una
**Foundation unica** che compone la Dashboard a partire da actor, Dashboard Identity,
capability e scope, su master visuali approvati.

### 1.2 Blocchi verificati (da sciogliere prima dell'implementazione)

| # | Blocco | Perché blocca | Chi decide |
| --- | --- | --- | --- |
| B1 | **Hamburger flottante e `AppSidebar`** (§5.1 della ricognizione) | La shell Dashboard non è definibile finché il menu flottante resta sopra i contenuti; `AppSidebar` è l'unico accesso a Impostazioni, Logout, Rete e Annunci | Prodotto |
| B2 | **`HeaderBell` nell'header Dashboard** (§5.2) | Determina la composizione dell'header del master | Prodotto |
| B3 | **Master visuali Foundation** (DAS-01.3 composizione modulare, DAS-03.1 struttura Società) | CC-20 richiede il confronto con un master approvato; DAS-03.1 è a bassa risoluzione e non consente pixel-perfect | Prodotto / Design |
| B4 | **Policy identità**: quali identità un actor può gestire oltre `club_admin` owner | Determina il modello dati del selector | Prodotto |

B1 e B2 non impediscono di iniziare la parte dati (1.3.A–1.3.C); impediscono di chiudere
la parte visuale.

### 1.3 Attività tecniche

#### A. Modello di identità (CC-03, CC-06)

Nuovo modulo `apps/mobile/src/features/dashboard/identity/`:

- `identity-types.ts` — `DashboardIdentityKind = "person" | "society" | "media"`,
  `DashboardIdentity = { id, kind, name, avatarUrl, isVerified, scope }`,
  `DashboardActor`.
- `identity-mapping.ts` — mappatura **pura** `app_role` → `DashboardIdentityKind`
  (`club_admin → society`, `media → media`, tutto il resto → `person`).
  **Vincolo CC-03:** nessun rename di `app_role`, nessuna migrazione sull'enum.
- `identity-service.ts` — `fetchManageableIdentities(actorProfileId)`. Fonti già
  esistenti: `profiles` (identità personale), `clubs.owner_profile_id` (come oggi fa
  `session-provider.tsx`), e — per gli staff non-owner — lo stesso meccanismo RPC già
  usato da `fetch_my_shortlist_permissions`, che è oggi l'unico punto del progetto capace
  di risolvere il club di uno staff con grant.
- `use-dashboard-identity.ts` — identità corrente, selezione, persistenza.
- Persistenza: AsyncStorage, chiave per actor, seguendo il template di
  `src/features/feed/feed-cache.ts` (prefisso versionato + type guard + try/catch che
  ingoia l'errore). Ripristino **solo** se ancora autorizzata; altrimenti fallback
  personale.

> **Dipendenza aperta (B4):** se l'unica identità organizzativa gestibile resta quella di
> cui l'actor è `owner_profile_id`, il selector multi-identità esiste ma è irraggiungibile
> per la quasi totalità degli utenti. Serve la policy prima di dimensionare il lavoro.

#### B. Capability e scope (CC-07)

- `apps/mobile/src/features/dashboard/capabilities/capability-types.ts` — set di chiavi
  capability della Dashboard, **estendendo il vocabolario esistente** di
  `ClubPermissionKey` (`src/features/shortlist/shortlist-permissions-service.ts`), non
  creandone uno parallelo.
- `use-dashboard-capabilities.ts` — risoluzione per `(actor, identity)`, con `staleTime`
  allineato a `use-shortlist-permissions.ts` (5 min) e non al default globale di 30 s.
- **Server-side:** ogni nuova lettura deve restare coperta da RLS. Se serve una RPC di
  composizione, va scritta con `security definer` e filtro esplicito sull'actor, come le
  RPC Shortlist esistenti (`supabase/migrations/20260717090200_shortlist_rpcs.sql`).
- Sostituire il gating per ruolo di `app/club-admin/_layout.tsx`
  (`profile?.role !== "club_admin"`) **non è in scope REV-01**: va registrato come debito
  per il pack che tocca quelle schermate.

#### C. Registro e contratto dei moduli (CC-08)

- `apps/mobile/src/features/dashboard/modules/module-registry.ts` — registro **statico e
  tipizzato** dei moduli riconosciuti dal client. Esplicitamente **non** un page builder.
- `module-contract.ts` — tipo che copre i concetti CC-08 (id, tipo, versione di schema,
  identità/scope, titolo, stato, conteggi/preview con riferimenti canonici, azioni e
  destinazioni, ordine/prominence, freshness).
- `module-fallback.ts` — modulo sconosciuto ignorato con diagnostica non sensibile;
  payload incompatibile → fallback locale; composizione non interpretabile → fallback
  globale (il Global Error vero e proprio è REV-02).
- **Vincolo CC-21:** REV-01 **non** introduce moduli delle wave successive. Il registro
  nasce con i soli moduli che oggi hanno dati reali: le voci già presenti in
  `ClubDashboard` (Organico, Inviti e richieste, Posizioni aperte, Shortlist,
  Amministratori, Squadre e affiliate, Profilo pubblico), ricomposte come moduli
  autorizzati invece che come menu hardcoded.

#### D. Composizione e architettura informativa (CC-04, CC-07)

- `apps/mobile/src/features/dashboard/DashboardFoundation.tsx` — ordine obbligatorio:
  **autorizzazione e compatibilità → composizione → priorità e presentazione**.
- `app/(tabs)/dashboard.tsx` diventa un route file sottile che rende la Foundation; il
  bivio sul ruolo viene rimosso.
- Sezioni **Da gestire / Azioni rapide / Aree di gestione**, nessuna obbligatoria.
  Nessuna card "Tutto sotto controllo", nessuno spazio vuoto per sezione assente.
- Il riepilogo (CC-09) resta **opzionale** e compatto: 2–4 indicatori in **una** superficie
  leggera. Le tre `StatCard` affiancate di `PersonalDashboard` non sono conformi e vanno
  sostituite dalla resa definita nel master.
- `ClubDashboard.tsx` e `PersonalDashboard.tsx` **non vengono eliminati** finché la
  Foundation non copre le stesse destinazioni: CC-19 vieta di azzerare lavoro precedente
  prima della copertura verificata.

#### E. Componenti condivisi (CC-11)

Da creare **solo se un master approvato li richiede**:

| Componente | Base riusabile |
| --- | --- |
| `DashboardHeader` | `ScreenHeader` |
| `DashboardIdentityRow` | `Avatar` (`square` per i loghi) + `AppText` |
| `DashboardIdentitySheet` ("Dashboard di") | `BottomSheet` |
| `DashboardSectionHeader` | `AppText variant="eyebrow"` del pattern `ContentModule` |
| `DashboardModuleShell` | `ContentModule` (eyebrow → body → action rail 44px) |
| Riga operativa | `ListItem` così com'è |

Da **non** creare: una preview Posizioni nuova — si usa
`src/features/search/positions/PositionPreviewRow.tsx`, già conforme a CC-11 (nessuna
scadenza, descrizione, CTA "Candidati" o score).

#### F. Terminologia (CC-12)

Nelle **sole superfici toccate da REV-01**: "Posizioni aperte" al posto di "Annunci",
"Procuratore", "Tifoso", "Società", "Squadra". Nessuna modifica a rotte
(`app/(tabs)/announcements.tsx`), tabelle (`recruiting_ads`, `saved_ads`), chiavi o dati.
Correggere il `default: return role` di `formatRoleLabel`
(`src/features/home/home-dashboard-service.ts`) perché non esponga l'enum grezzo.

#### G. Accessibilità e responsive (CC-17)

Verifica a 320 / 375 / 390 / 430, safe area iOS e Android, tastiera aperta, nomi lunghi,
Dynamic Type. Tap target ≥ 44 (`sizes.touchTarget` esiste già). Label sulle icone,
ripristino del focus dopo lo sheet identità, contrasto AA.

### 1.4 File previsti

**Nuovi:** `apps/mobile/src/features/dashboard/` (identity, capabilities, modules,
`DashboardFoundation.tsx`, componenti) + test affiancati.
**Modificati:** `app/(tabs)/dashboard.tsx`; `app/(tabs)/_layout.tsx` **solo** dopo la
decisione B1.
**Non toccati:** domini recruiting, messaging, communications, shortlist, saved,
following, search; migrazioni esistenti; token.

### 1.5 Verifica richiesta (sottoinsieme CC-20)

Test 1, 2, 3, 10, 12 della copertura comune, più:

- mappatura `app_role` → `DashboardIdentityKind` (test puro);
- composizione con capability diverse per due actor della stessa Società;
- modulo non autorizzato **assente**, non disabilitato;
- nessun nome di Società sopra contenuti personali in alcuno stato transitorio;
- `npm run lint`, `npm run typecheck`, `npm test` sui path modificati;
- confronto visuale con il master DAS-01.3 / DAS-03.1 ai viewport previsti, con le
  tolleranze concordate (DAS-03.1 è a bassa risoluzione: **nessun pixel-perfect**).

Test **non** applicabili in REV-01, con motivo: 4 (revoca runtime), 6 (stati di errore),
7 (offline), 8 (refresh), 9 (riconciliazione conteggi) — sono il perimetro di REV-02.

---

## 2. DAS-REV-02 — Foundation: priorità, cache e stati

### 2.1 Obiettivo

Rendere affidabile ciò che REV-01 compone: priorità operative deterministiche, cache
corretta per identità, stati di caricamento/errore/empty/offline distinti, revoca gestita.

### 2.2 Dipendenza

**Dipende interamente da DAS-REV-01**: non esiste cache per identità prima che esista
l'identità, né priorità prima che esistano i moduli. Non è parallelizzabile.

### 2.3 Attività tecniche

#### A. Priorità (CC-09)

- `apps/mobile/src/features/dashboard/priority/priority-rules.ts` — **funzioni pure**,
  ranking deterministico e spiegabile. Ogni priorità porta oggetto, motivo e azione.
  1–3 priorità mostrate, con accesso alla gestione completa.
- Esclusioni normative da far rispettare dal tipo: errori API, caricamenti falliti, nuovi
  follower e attività sociali generiche **non sono priorità**.
- Nessun punteggio, percentuale artificiale o etichetta "critica" esposta in UI.
- Prime fonti reali disponibili: candidature da valutare
  (`recruiting-service.getClubApplications`) e inviti/richieste organico
  (`membership-service`). Nessuna priorità inventata su dati che non esistono.

#### B. Punti sicuri e ordinamento stabile (CC-09)

Estrarre il pattern già scritto e testato nel Feed
(`src/features/feed/feed-scroll-rules.ts`, `feed-arrange.ts`) in regole condivise:
riordino consentito solo al caricamento iniziale, al refresh esplicito e alla conclusione
coerente di un'azione. **Eccezione:** le rimozioni per sicurezza hanno effetto immediato.

#### C. Cache e richieste (CC-14)

- `dashboard-keys.ts` sul modello di `src/features/feed/feed-keys.ts`: ogni chiave
  include **actor, Dashboard Identity e contesto di autorizzazione**; le chiavi di modulo
  includono id modulo e versione di schema.
- Cache locale su AsyncStorage con prefisso versionato, sul modello di `feed-cache.ts`:
  un record per `(actor, identity)`, type guard manuali, invalidazione totale su payload
  incompatibile.
- Generazione/versione di richiesta: dopo uno switch di identità, cancellare le richieste
  in volo quando possibile e **in ogni caso ignorare** le risposte obsolete. È il test
  CC-20 n.2 ("rete lenta e risposta precedente tardiva: nessun dato misto").
- Freshness **per dominio**, non un TTL universale: il `staleTime: 30000` globale di
  `src/lib/query-client.ts` non va cambiato per tutta l'app, va sovrascritto per query.
- Logout e cambio account rendono inaccessibili le cache private precedenti: il punto di
  aggancio è `src/features/auth/logout.ts` e l'`onAuthStateChange` di
  `session-provider.tsx`.

#### D. Policy offline per dati organizzativi (CC-14) — **output obbligatorio del pack**

Il contratto richiede esplicitamente a DAS-REV-02 di esplicitare una **durata massima o
altra policy prudente** per l'accesso offline ai dati organizzativi, con limitazioni
quando l'autorizzazione non è più sufficientemente recente. Vanno prodotti: la policy
scritta, la sua implementazione e il test CC-20 n.7. Nessuna promessa di revoca offline
immediata, nessun accesso indefinito.

#### E. Stati (CC-13)

- Separare stato pagina, stato modulo, connettività e refresh.
- Primo caricamento: header + identità nota + skeleton Foundation immediati
  (`src/ui/Skeleton` esiste già ed è citato in 77 file di `src/features`, ma in **nessuna** delle
  due Dashboard attuali). Nessuna pagina bianca, nessun grande spinner centrale.
- Errore locale per modulo con copy e CTA del contratto; gli altri moduli restano
  utilizzabili.
- Global Error solo quando non c'è una Dashboard affidabile da mostrare, conservando
  header e identità. **Nel progetto non esiste alcun `ErrorBoundary`**: il meccanismo va
  creato qui.
- Empty ≠ errore. Oggi `PersonalDashboard` mostra `EmptyState "Nessuna notifica"` anche
  quando la query fallisce: è esattamente il caso che CC-13 vieta.
- Offline: **`@react-native-community/netinfo` non è installato**. Due strade, da
  decidere nel pack con motivazione scritta — (i) riusare l'euristica di
  `src/features/feed/use-feed-connectivity.ts`, che dichiara già i propri limiti nel file;
  (ii) introdurre `netinfo`, che per CC-02 richiede una necessità dimostrata.

#### F. Refresh (CC-14)

Pull-to-refresh che rivaluta **accesso, capability, feature, composizione, priorità e
dati**, non solo i contatori. Unico `RefreshControl` esistente nel progetto:
`src/features/feed/components/FeedList.tsx` — riusarne il pattern.

#### G. Revoca (CC-07)

Revoca di capability → modulo o azione rimossi. Revoca di identità → richieste interrotte,
cache e schermate private inaccessibili, identità rimossa dal selector, fallback sicuro.
Nessun logout globale per una revoca organizzativa. Test CC-20 n.4, inclusa la revoca
*tra rendering e tap*.

#### H. Analytics ed errori (CC-18)

Pochi eventi: apertura, cambio identità, apertura modulo, azione, esito, errore. Naming
sul modello di `src/features/feed/feed-analytics.ts`, parametri minimizzati (tipo modulo,
tipo identità, superficie di origine, categoria tecnica dell'esito, connettività).
Classificazioni tecniche interne per rete / timeout / server / autorizzazione / risorsa
assente / payload incompatibile / rate limit / manutenzione.

> **Da dichiarare nel pack:** `setAnalyticsSink` non è mai chiamato nel progetto, quindi
> `trackEvent` è oggi un no-op. Gli eventi vanno comunque definiti; non vanno dichiarati
> "verificati in produzione".

### 2.4 File previsti

**Nuovi:** `apps/mobile/src/features/dashboard/priority/`, `dashboard-keys.ts`,
`dashboard-cache.ts`, `dashboard-states/` (skeleton, errore locale, Global Error, empty,
offline), `dashboard-analytics.ts` + test affiancati.
**Modificati:** `DashboardFoundation.tsx` (da REV-01); agganci in `logout.ts` /
`session-provider.tsx` per l'invalidazione delle cache private.
**Da valutare con motivazione:** `package.json`, solo se si sceglie `netinfo`.

### 2.5 Verifica richiesta (sottoinsieme CC-20)

Test 2, 4, 5, 6, 7, 8, 9 della copertura comune, più le funzioni pure di priorità e
punti sicuri. Lint, typecheck e test sui path modificati, con comandi ed esiti reali.
Test 11 (form e conflitti) **non applicabile**: la Foundation non contiene form.

---

## 3. Rischi trasversali

| Rischio | Mitigazione |
| --- | --- |
| La Foundation diventa una seconda Home o una directory di card | CC-04: ogni modulo deve avere scopo, informazione utile o prossima azione; registro statico, non page builder |
| Duplicazione dei domini (`DashboardShortlist`, `SearchV2`, secondo editor) | CC-02: prima di ogni nuovo componente/servizio, verifica di compatibilità documentata nella PR |
| Rimozione prematura di `ClubDashboard` / `PersonalDashboard` | CC-19: uscita dal backlog attivo solo dopo copertura verificata |
| Modifica di token globali per esigenze Dashboard | CC-10: nessun token globale cambiato senza verifica e approvazione fuori scope |
| Fixture scambiate per dati reali | CC-21: fixture riconoscibili, isolate, mai in produzione |
| "Nessuna regressione" dichiarata in assoluto | CC-22: indicare superfici verificate, esiti e aree non testate |

---

## 4. Cosa questo piano **non** autorizza

- Nessuna migrazione o modifica di schema (incluso l'enum `app_role`).
- Nessuna concessione di permessi, creazione di membership o pubblicazione di contenuti.
- Nessuna eliminazione di task legacy, documenti o implementazioni esistenti.
- Nessun intervento su Store (resta in DAS-HOLD-01), sul badge Messaggi (§5.4 della
  ricognizione) o su `docs/mobile-ux-ui-guidelines.md` (§5.5): sono debiti registrati,
  non lavoro di questi due pack.
- Nessuna sostituzione dello schema `footme://` (§5.3).
