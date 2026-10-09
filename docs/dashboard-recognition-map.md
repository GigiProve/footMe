# ProLink Dashboard — Ricognizione e mappatura CC → implementazione

**Codice task:** DAS-REV-00 (output di ricognizione)
**Contratto di riferimento:** [`dashboard-common-contract.md`](./dashboard-common-contract.md) v1.0
**Data ricognizione:** 2026-10-09
**Commit di riferimento:** `041ac8f` (`main`, working tree pulito all'avvio)

> Questo documento descrive **lo stato verificato del repository**, non lo stato
> desiderato. Dove una regola del contratto non ha riscontro nel codice, è segnata come
> assente e assegnata a un pack. Nessuna funzionalità, permission o dato è stato
> modificato per produrre questa ricognizione.
>
> Convenzione degli stati, come richiesto da CC-01:
> **Presente** = codice verificato nel repository · **Parziale** = esiste qualcosa di
> compatibile ma non copre la regola · **Assente** = nessun riscontro ·
> **Non verificabile** = dipende da ambienti, backend o documenti esterni al repository.

---

## 1. Sintesi della ricognizione

La Dashboard **esiste già**, ma come *due schermate separate selezionate da un `if` sul
ruolo*, non come una Foundation che compone moduli.

```
apps/mobile/app/(tabs)/dashboard.tsx        (13 righe)
  └─ profile?.role === "club_admin"
       ? <ClubDashboard />                   src/features/clubs/components/ClubDashboard.tsx   (286 righe)
       : <PersonalDashboard />               src/features/home/components/PersonalDashboard.tsx (121 righe)
```

Conseguenze verificate:

- `ClubDashboard` è un **menu statico hardcoded** (`MENU_ITEMS`, `HIGHLIGHTED_MENU_ITEM`,
  `MENU_ITEMS_AFTER`): nessuna composizione, nessuna capability, nessun dato operativo.
- `PersonalDashboard` è un **riepilogo + notifiche recenti**: tre `StatCard` affiancate e
  le ultime 5 notifiche. Nessuna sezione "Da gestire", nessuna azione rapida.
- Non esiste il concetto di **Dashboard Identity**: `grep` su `dashboardIdentity`,
  `dashboard_identity`, `switchIdentity`, `actor` non produce alcun risultato applicativo.
- Non esiste un **registro di moduli** né un contratto modulo (CC-08).
- Lo stato dei dati è gestito da TanStack Query con default globali
  (`src/lib/query-client.ts`: `staleTime: 30000`, `retry: 1`); le query key della
  Dashboard sono costruite inline nei componenti.

La maturità richiesta dal contratto **esiste già altrove nel repository**: il dominio
**Feed / Home** (`src/features/feed/`) implementa cache locale versionata, query key
centralizzate, ripristino di scroll, punti sicuri di riordino, skeleton, analytics ed
euristica offline. È il riferimento interno naturale per DAS-REV-02 e va riusato invece
di essere reinventato.

### Stato per area

| Area | Stato | Nota sintetica |
| --- | --- | --- |
| Shell e bottom navigation | **Presente** | Le 5 voci canoniche ci sono già |
| Hamburger / secondo menu | **Presente — in conflitto** | `AppSidebar` + pulsante flottante, vietati da CC-05 |
| Dashboard Identity | **Assente** | Nessun selector, nessun actor/identità gestita |
| Capability e scope | **Parziale** | Esiste solo per Shortlist, via RPC |
| Composizione modulare | **Assente** | Due schermate hardcoded per ruolo |
| Riepilogo e priorità | **Parziale / non conforme** | 3 StatCard, nessuna priorità operativa |
| Loading / empty / error / offline | **Parziale** | Primitive presenti, non usate in Dashboard |
| Cache e refresh | **Parziale** | Nessuna chiave per identità, nessun pull-to-refresh |
| Design system | **Presente** | Token completi e coerenti |
| Terminologia | **Parziale** | "Annunci" ancora prevalente su "Posizioni aperte" |
| Analytics | **Parziale** | Sink esiste, nessun sink registrato, zero eventi Dashboard |
| Deep link | **Presente** | Schema reale `footme://`, nome prodotto ProLink |

---

## 2. Componenti, token, servizi, modelli e route riutilizzabili

### 2.1 Design system — riutilizzabile così com'è

| Elemento | Percorso | Nota |
| --- | --- | --- |
| Token (source of truth) | `apps/mobile/src/styles/tokens/` | `colors`, `radius`, `shadows`, `sizes`, `spacing`, `textVariants`, `typography`, `zIndex` |
| Re-export | `apps/mobile/src/theme/tokens.ts` | `export * from "../styles/tokens"` |
| Blu PROLINK | `src/styles/tokens/colors.ts` | `accent #1B4FD8`, `accentStrong #1540AE`, `accentSoft #EDF2FE` |
| Superfici | idem | `background #F4F6FA`, `surface #FFFFFF`, `surfaceMuted #F4F6FA` |
| Hairline | idem | `border #E3E8EF` (cornice modulo), `divider #F0F3F7` (righe interne) |
| Stati | idem | `success #0FA36B`, `warning #F2A93B`, `danger #E23D3D` |
| Scala tipografica | `src/styles/tokens/typography.ts` | 9→34, mezzi punti voluti; Mulish 900/800 solo display |
| Varianti testo | `src/styles/tokens/textVariants.ts` | usate da `AppText` |
| Tap target | `src/styles/tokens/sizes.ts` | `touchTarget: 44`, `tabBarHeight: 72`, `actionRail: 44` |

**Copertura di CC-10 rispetto ai riferimenti dimensionali indicativi:** tutti i valori
richiesti (24–28, 17–20, 15–17, 14–16, 13+) esistono già in `typography.fontSize`;
`spacing[20]` e `spacing[24]` coprono il padding orizzontale. **Nessun nuovo token è
necessario per la Foundation**: serve solo la mappatura variante → ruolo nel master
DAS-REV-01.

### 2.2 Primitive UI condivise — `apps/mobile/src/ui/index.ts`

Direttamente utili alla Dashboard:

| Componente | Uso previsto dal contratto |
| --- | --- |
| `ContentModule` | contenitore canonico (eyebrow → body → action rail 44px) — base del modulo CC-08 |
| `ScreenHeader` | header "Dashboard" (CC-05) |
| `ListItem` | riga operativa con `left` / `right` / `showDivider` (CC-11) |
| `SectionCard`, `Card`, `Divider` | raggruppamento e hairline (CC-10) |
| `BottomSheet` | sheet "Dashboard di" (CC-06) |
| `ActionSheet`, `ConfirmModal` | menu e conferme distruttive (CC-15) |
| `EmptyState` | empty di modulo e globale (CC-13) |
| `Skeleton` | skeleton Foundation e di modulo (CC-13) — già diffuso nelle feature |
| `Avatar` (`square` per i loghi) | identity row (CC-06) |
| `Badge`, `ChipGroup`, `Button` (`chipAction`) | chip e azioni (CC-11) |
| `StatCard` | **da rivedere**: oggi è una card per numero, CC-09 chiede una superficie leggera |
| `HeaderBell` | **da non portare in Dashboard**: CC-05 vieta la campanella nell'header Dashboard |
| `TabBar`, `TopBar`, `Toast`, `Toggle`, `Input`, `SearchField` | disponibili, fuori dal perimetro Foundation |

Altre primitive: `apps/mobile/src/components/ui/screen.tsx` (`Screen`, padding 20/24),
`keyboard-aware-form.tsx` (`KeyboardAwareForm`, usata da entrambe le Dashboard attuali).

### 2.3 Dominio Feed — il riferimento interno per DAS-REV-02

| File | Cosa fornisce |
| --- | --- |
| `src/features/feed/feed-keys.ts` | query key centralizzate; documenta perché `asOf` **non** sta nella key |
| `src/features/feed/feed-cache.ts` | cache AsyncStorage versionata (`@footme/feed/v1/`), un record per profilo, type guard manuali, invalidazione totale su payload incompatibile |
| `src/features/feed/feed-scroll-rules.ts` | funzioni pure per il ripristino di scroll (CC-05 "contesto di ritorno") |
| `src/features/feed/use-feed-connectivity.ts` | euristica offline **senza** `netinfo`, con limiti dichiarati nel file |
| `src/features/feed/feed-analytics.ts` | naming convention analytics esistente (CC-18) |
| `src/features/feed/components/skeletons/` | skeleton progressivi |
| `src/features/feed/components/FeedList.tsx` | **unico** `RefreshControl` del progetto |

### 2.4 Servizi e modelli di dominio riutilizzabili

| Dominio | Percorsi | Note per la Dashboard |
| --- | --- | --- |
| Sessione | `src/features/auth/session-provider.tsx`, `use-session.ts` | `AppProfile` = `{ id, full_name, role, avatar_url, region, city, is_admin, club_id, club_name }`. `club_id` risolto **solo** per `role === "club_admin"` da `clubs.owner_profile_id` |
| Società | `src/features/clubs/club-service.ts` (`fetchPublicClubProfile`) | fonte del nome/logo per l'identity row |
| Organico | `src/features/clubs/membership-service.ts`, `membership-types.ts` | `ClubMember`, `MemberRole`, `MemberStatus`, `AddedBy` |
| Squadre | `src/features/clubs/team-service.ts` | `ClubTeam`, `TeamType`, `club_team_profiles` |
| Capability Shortlist | `src/features/shortlist/shortlist-permissions-service.ts`, `use-shortlist-permissions.ts` | RPC `fetch_my_shortlist_permissions`; **unico** punto del progetto che risolve il club per uno staff non-owner |
| Posizioni / Candidature | `src/features/recruiting/recruiting-service.ts` | `getClubAds`, `getPublishedAds`, `getClubApplications`, `updateApplicationStatus`, `APPLICATION_STATUS_LABELS`, `createRecruitingAd`, `applyToRecruitingAd`, `toggleSavedAd` |
| Preview posizione canonica | `src/features/search/positions/PositionPreviewRow.tsx` | **conforme a CC-11**: nessuna scadenza, nessuna descrizione, nessun CTA "Candidati", nessuno score |
| Messaggi | `src/features/messaging/messaging-service.ts` (`fetchInboxConversations`) | aggregatore unread conversazioni |
| Comunicazioni | `src/features/messaging/communications-service.ts` | `CommunicationSummary`, categorie `societa / squadra / store / eventi`, `markCommunicationRead` — entità distinta, come richiede CC-03 |
| Notifiche | `src/features/clubs/notification-service.ts` (`getUnreadCount`, `fetchNotifications`), `src/features/notifications/` | aggregatore campanella |
| Salvati / Follow / Shortlist | `src/features/saved/`, `src/features/following/`, `src/features/shortlist/` | domini globali da riusare, non da duplicare |
| Analytics | `src/lib/analytics.ts` | `trackEvent` + `setAnalyticsSink`; nessun vendor, nessun sink registrato |
| Query client | `src/lib/query-client.ts` | default globali |

### 2.5 Route esistenti raggiungibili dalla Dashboard (tutte verificate)

`/(tabs)/dashboard` · `/(tabs)/announcements` (tab nascosta, `href: null`) ·
`/club-admin/roster` · `/club-admin/invites` · `/club-admin/teams` ·
`/club-admin/affiliates` · `/club-admin/permissions` · `/club-admin/permissions/[memberId]` ·
`/shortlist` · `/shortlist/[listId]` · `/shortlist/entry/[entryId]` · `/club/[id]` ·
`/club/team/[id]` · `/notifications` · `/comunicazioni/[communicationId]` ·
`/content/[type]/[id]` · `/position/[id]` · `/saved` · `/following` ·
`/representation/*` · `/profile/society-edit` e gli altri editor REV-PROF.

### 2.6 Modello dati rilevante (Supabase, 134 migrazioni)

- `public.app_role` = `player · coach · staff · club_admin · agent · director · admin ·
  fan · media` (enum unico, cresciuto per `ALTER TYPE ADD VALUE`).
- Società e struttura: `clubs`, `club_members`, `club_teams`, `club_team_profiles`,
  `club_affiliations`, `club_invite_links`, `club_staff_members`, `club_season_entries`.
- Permessi: `club_member_permissions` (migrazione `20260717090000_club_member_permissions.sql`,
  chiavi notifiche aggiunte da `20260719090300_club_member_permissions_notif_keys.sql`).
- Recruiting: `recruiting_ads`, `recruiting_applications`, `saved_ads`.
- Messaggistica e comunicazioni: `conversations`, `conversation_participants`, `messages`,
  `communications`, `communication_recipients`.
- Notifiche: `notifications`, `notification_preferences`.
- Salvati / follow: `saved_profiles`, `saved_clubs`, `saved_teams`, `saved_ads`,
  `saved_club_media`, `saved_fan_media`, `saved_media_profile_posts`, `profile_follows`,
  `club_follows`.
- Shortlist: `club_shortlists`, `club_shortlist_entries`.

**Non esiste** alcuna tabella o enum che rappresenti PERSON / SOCIETY / MEDIA come
*tipo di identità*, né una tabella di composizione/moduli Dashboard.

---

## 3. Mappatura regola CC → implementazione esistente → pack destinatario

| Regola | Stato | Evidenza nel repository | Gap e pack destinatario |
| --- | --- | --- | --- |
| **CC-01** Gerarchia delle fonti | **Assente** (metodo) | Nessun registro di contratto nel repo prima di questa task | Registrato ora in `docs/dashboard-common-contract.md`. Nessun pack |
| **CC-02** Continuità | **Parziale** | Domini esistenti e funzionanti: recruiting, messaging, shortlist, saved, following, search | Rischio concreto di duplicazione nei pack: vincolo da ribadire in ogni task. Tutti i pack |
| **CC-03** Identità PERSON/SOCIETY/MEDIA | **Assente** | `app_role` è un enum piatto; `session-provider.tsx` espone un solo `role` | Serve una **mappatura** ruolo → tipo di identità, senza rinominare l'enum. **DAS-REV-01** |
| **CC-03** Actor vs identità gestita | **Assente** | Nessun riferimento ad `actor` nel codice applicativo | **DAS-REV-01** |
| **CC-03** Dashboard non replica Modifica profilo | **Presente** | `ClubDashboard` rimanda a `/club/[id]`; editor REV-PROF in `app/profile/*-edit` | Da verificare la rotta corretta verso REV-PROF-17/18. **DAS-REV-01** |
| **CC-03** Società / Squadra / affiliate | **Presente** | `clubs`, `club_teams`, `club_affiliations`, `team-service.ts`; `/club-admin/teams` e `/club-admin/affiliates` separati | Modello corretto. Nessuna Dashboard autonoma di Squadra: regola da proteggere nei pack Organico |
| **CC-03** Cerca/Salvati/Follow/Shortlist | **Presente** | `src/features/search/`, `saved/`, `following/`, `shortlist/` | La Dashboard non deve creare indici paralleli. Pack di modulo |
| **CC-03** POST/ARTICLE in HOM | **Parziale** | `src/features/content/content-publisher-service.ts`; nessun composer Dashboard | Widget "Bozze e programmati" assente. Pack editoriale |
| **CC-03** Communication ≠ Message | **Presente** | `communications-service.ts` separato da `messaging-service.ts`; tabelle distinte | Conforme |
| **CC-03** Nessun doppio unread | **Non conforme** | `app/(tabs)/_layout.tsx` somma conversazioni non lette **e** comunicazioni non lette in un unico badge Messaggi | Da decidere nel pack MES/Comunicazioni, fuori dalla Foundation |
| **CC-04** Da gestire / Azioni rapide / Aree | **Assente** | `ClubDashboard` ha solo "aree di gestione"; `PersonalDashboard` solo riepilogo + notifiche | Struttura informativa da costruire. **DAS-REV-01** (struttura) + **DAS-REV-02** (priorità) |
| **CC-04** "Da controllare" non duplica "Da gestire" | **Attenzione** | Stringa `"Da gestire"` presente in `app/(tabs)/network.tsx:132` (tab nascosta) | Verificare che non diventi una seconda lista. **DAS-REV-01** |
| **CC-05** Bottom nav canonica | **Presente** | `app/(tabs)/_layout.tsx`: Home · Cerca · Dashboard · Messaggi · Profilo; `network` e `announcements` con `href: null` | Conforme |
| **CC-05** Header "Dashboard", niente campanella | **Non conforme** | `PersonalDashboard` e `ClubDashboard` mostrano entrambe `HeaderBell` → `/notifications` | Rimozione o decisione esplicita. **DAS-REV-01** |
| **CC-05** Niente hamburger flottante | **Non conforme** | `app/(tabs)/_layout.tsx` renderizza un pulsante flottante (`menu-outline`, `zIndex.sticky`) su tutte le tab tranne Home, che apre `AppSidebar` (`src/ui/sidebar/AppSidebar.tsx`) | **Conflitto aperto — vedi §5.1** |
| **CC-05** Contesto di ritorno | **Parziale** | Pattern completo solo nel Feed (`use-feed-scroll-restore.ts`, `feed-scroll-rules.ts`) | Da estendere alla Dashboard. **DAS-REV-02** |
| **CC-06** Dashboard Identity | **Assente** | Nessun selector; `dashboard.tsx` sceglie con un `if` sul ruolo | Intera regola da implementare. **DAS-REV-01** |
| **CC-06** Persistenza ultima scelta + fallback | **Assente** | Esiste solo `src/features/auth/last-account.ts` (ultimo account, non identità) | **DAS-REV-01** |
| **CC-07** Composizione unica | **Assente** | Due componenti hardcoded per ruolo | **DAS-REV-01** |
| **CC-07** Capability | **Parziale** | `fetch_my_shortlist_permissions` + `club_member_permissions` coprono solo Shortlist e notifiche club; `app/club-admin/_layout.tsx` gating su `role !== "club_admin"` | Modello capability generale da definire. **DAS-REV-01** (contratto) + **DAS-REV-02** (revoca) |
| **CC-07** Modulo non autorizzato = assente | **Non verificabile sulla Dashboard** | Nessun modulo autorizzativo in Dashboard oggi | **DAS-REV-01** |
| **CC-07** Validazione server-side | **Presente (impianto)** | RLS attiva su tutte le migrazioni; RPC per logica condivisa | Da verificare per ogni nuova lettura. Tutti i pack |
| **CC-08** Registro moduli | **Assente** | Nessun registro, nessun tipo modulo, nessuna versione di schema | **DAS-REV-01** |
| **CC-08** Conteggi reali | **Parziale / a rischio** | `home-dashboard-service.ts` calcola conteggi con `count: "exact", head: true` — corretto; ma `publishedAdsCount` usa `head: false` con select completo | Da ripulire nel pack Posizioni |
| **CC-09** Riepilogo 2–4 indicatori compatti | **Non conforme** | `PersonalDashboard` usa 3 `StatCard` affiancate (una card per numero) | **DAS-REV-01** (resa) |
| **CC-09** Priorità con oggetto/motivo/azione | **Assente** | Nessun concetto di priorità | **DAS-REV-02** |
| **CC-09** Ordinamento stabile / punti sicuri | **Assente in Dashboard, presente nel Feed** | `feed-scroll-rules.ts`, `feed-arrange.ts` | Da estrarre/riusare. **DAS-REV-02** |
| **CC-10** Design system esistente | **Presente** | `src/styles/tokens/*` completi e coerenti | Nessun nuovo token atteso. **DAS-REV-01** mappa varianti → ruoli |
| **CC-10** Niente ombre / card annidate | **Presente come regola** | `.claude/CLAUDE.md` §Design system: "Flat design: elevation è `colors.border`" | Da rispettare nei master |
| **CC-11** Set componenti condiviso | **Presente in gran parte** | vedi §2.2 | Mancano: identity row, section header dedicato, stato Global Error. **DAS-REV-01** |
| **CC-11** Preview Posizioni canonica | **Presente** | `PositionPreviewRow.tsx` non espone scadenza, descrizione, CTA "Candidati" né score | Riusare, non riscrivere |
| **CC-11** Griglie Media REV-PROF | **Presente** | regole già applicate nei profili | Nessuna azione Foundation |
| **CC-12** Procuratore ≠ Agente | **Sostanzialmente conforme** | `home-dashboard-service.ts` usa "Procuratore"; `"Agente"` resta solo come valore di tassonomia storica (`agent-career-taxonomy.ts:20`), documentato in `director-previous-roles.ts:25` | Conforme con nota |
| **CC-12** Tifoso ≠ Appassionato | **Sostanzialmente conforme** | "Appassionato" solo in commenti e compatibilità dati legacy (`fan-master-profile.ts`, `profile-service.ts`) | Conforme con nota |
| **CC-12** "Posizioni aperte" ≠ "Annunci" | **Non conforme** | 47 occorrenze di `Annunci/annunci` contro 7 di `Posizioni aperte` nel client; la rotta è `app/(tabs)/announcements.tsx`; `AppSidebar` etichetta la voce "Annunci" | Allineare **le superfici revisionate**, senza toccare rotte o dati. Pack Posizioni aperte |
| **CC-12** Salvare identificativi, non label | **Presente** | tassonomie con id in onboarding e profili | Conforme |
| **CC-12** Niente enum grezzi in UI | **Parziale** | `formatRoleLabel` in `home-dashboard-service.ts` ha `default: return role` → può esporre l'enum | Correggere nel pack che tocca il riepilogo. **DAS-REV-01** |
| **CC-13** Skeleton Foundation | **Assente in Dashboard** | `Skeleton` esiste ed è citato in 77 file di `src/features`; **nessuno** dei due componenti Dashboard lo usa | **DAS-REV-02** |
| **CC-13** Errore locale per modulo | **Assente** | Nessuna gestione `isError` nelle due Dashboard: le query falliscono in silenzio e la UI mostra zero/vuoto | **DAS-REV-02** |
| **CC-13** Global Error | **Assente** | Nessun `ErrorBoundary` nel progetto (`grep` su `ErrorBoundary`/`componentDidCatch`: 0 risultati) | **DAS-REV-02** |
| **CC-13** Empty ≠ errore | **Non conforme** | `PersonalDashboard` mostra `EmptyState "Nessuna notifica"` anche quando la query fallisce | **DAS-REV-02** |
| **CC-13** Offline | **Parziale** | Solo nel Feed, per inferenza; `@react-native-community/netinfo` **non è installato** (verificato in `package.json`) | **DAS-REV-02** deve decidere: riuso dell'euristica o introduzione motivata di netinfo |
| **CC-14** Chiavi di cache per identità | **Non conforme** | Chiavi attuali: `["home-dashboard", userId, userEmail]`, `["notifications-unread", profileId]`, `["club-public-profile", clubId]` — nessuna include una Dashboard Identity | **DAS-REV-02** |
| **CC-14** Richieste annullate/ignorate dopo switch | **Assente** | Non esiste lo switch | **DAS-REV-02** |
| **CC-14** Pull-to-refresh | **Assente in Dashboard** | `RefreshControl` presente solo in `FeedList.tsx` | **DAS-REV-02** |
| **CC-14** Freshness per dominio | **Non conforme** | `staleTime: 30000` globale in `query-client.ts`; eccezione isolata: `use-shortlist-permissions.ts` (`staleTime: 5 min`) | **DAS-REV-02** |
| **CC-14** Policy offline per dati organizzativi | **Assente** | Nessuna policy di retention né di scadenza dell'autorizzazione | **DAS-REV-02 — richiesto esplicitamente dal contratto** |
| **CC-15** Form e salvataggio | **Presente (pattern)** | `KeyboardAwareForm`, `EditModalShell`, `ConfirmModal`, `profile-edit-helpers.ts` | Riuso nei pack di modulo, non nella Foundation |
| **CC-16** Routing canonico | **Presente** | `ClubDashboard` naviga a risorse reali, non a copie | Conforme |
| **CC-16** Rivalidazione da deep link | **Parziale** | `app/assistito-invite/[token].tsx` e `usePendingAssistitoInvite` gestiscono token e autorizzazione | Da estendere alle destinazioni Dashboard. Pack di modulo |
| **CC-16** Schema `footme://` | **Confermato come reale** | `apps/mobile/app.json`: `"scheme": "footme"`, `"slug": "footme"`, bundle `com.footme.mobile`, nome prodotto `ProLink` | **Non è un residuo da sostituire**: è lo schema attivo. Vedi §5.3 |
| **CC-17** Larghezze 320/375/390/430 | **Non verificabile da codice** | Layout a colonna singola con `Screen` + safe area; nessun test di viewport nel repo | Verifica richiesta in **DAS-REV-01** |
| **CC-17** Tap target 44×44 | **Presente come token** | `sizes.touchTarget = 44`, usato dal pulsante menu e dai componenti condivisi | Da verificare per riga e azione secondaria. **DAS-REV-01** |
| **CC-17** Contrasto AA | **Non verificato** | Nessun test di contrasto nel repository | **DAS-REV-01** |
| **CC-17** Screen reader / focus | **Parziale** | `accessibilityRole` / `accessibilityLabel` usati in modo diffuso ma non sistematico; nessun ripristino di focus dopo sheet | **DAS-REV-01** |
| **CC-18** Naming convention analytics | **Presente** | `src/lib/analytics.ts` + `src/features/feed/feed-analytics.ts` | Eventi Dashboard da definire. **DAS-REV-01/02** |
| **CC-18** Nessun sink attivo | **Stato di fatto** | `setAnalyticsSink` mai chiamato: `trackEvent` è un no-op in produzione | Non è un bug della Dashboard; da dichiarare nei pack |
| **CC-18** Protezione server-side dei campi privati | **Presente (impianto)** | RLS + RPC | Verifica per nuova lettura. Tutti i pack |
| **CC-19** Tracciabilità backlog | **Fuori repository** | Le 77 task legacy e il Piano consolidato vivono nel task tracker e in `DAS_Audit_globale_completo.xlsx` | **Non verificabile dal repository.** Nessuna task è stata eliminata |
| **CC-19** Store in DAS-HOLD-01 | **Coerente** | Nessuna implementazione Store nel client; `notif_store_orders` esiste solo come chiave di permesso notifiche | Non implementare indirettamente |
| **CC-20** Test condivisi | **Parziale** | 175 file di test (Vitest) accanto al codice; **zero** test su `ClubDashboard`, `PersonalDashboard`, `home-dashboard-service` | **DAS-REV-01/02** |
| **CC-21** Riferimenti visuali | **Non verificabile** | DAS-01.3, DAS-03.1, DAS-03.11.5 sono file esterni al repository | Dipendenza di **DAS-REV-01** |

---

## 4. Dipendenze — disponibili, non implementate, non verificabili

### Disponibili e utilizzabili subito

- Design system completo (`src/styles/tokens/`) e primitive UI (`src/ui/`).
- Domini funzionanti: recruiting, messaging, communications, notifications, shortlist,
  saved, following, search, clubs/teams/affiliations.
- Pattern di riferimento interno: `src/features/feed/` (cache, key, scroll, offline,
  analytics, skeleton).
- Impianto autorizzativo server-side: RLS su 134 migrazioni + RPC
  `fetch_my_shortlist_permissions`.
- Toolchain di verifica: `npm run lint`, `npm run typecheck`, `npm test` (Vitest, 175 file).

### Esistenti ma **non implementate** rispetto al contratto

- Dashboard Identity, selector, persistenza e fallback (CC-06).
- Registro e contratto dei moduli (CC-08).
- Capability generali oltre Shortlist, e revoca runtime (CC-07).
- Priorità operative e punti sicuri di riordino (CC-09).
- Stati loading / error locale / Global Error / empty distinti in Dashboard (CC-13).
- Chiavi di cache per identità, cancellazione richieste dopo switch, pull-to-refresh,
  freshness per dominio, policy offline per dati organizzativi (CC-14).

### Non verificabili dal repository

- Mockup DAS-01.3, DAS-03.1, DAS-03.11.5 e il pacchetto mockup citato da CC-21.
- Il foglio "Piano consolidato" di `DAS_Audit_globale_completo.xlsx` e le 77 task legacy.
- Il video della Dashboard Società usato come riferimento di audit.
- Le versioni approvate di REV-PROF-17, REV-PROF-18, HOM-06.1, HOM-06.2, CER-06: il codice
  contiene riferimenti a CER-05 e REV-PROF nei commenti, **non** la prova che le versioni
  citate dal contratto siano quelle implementate.
- Lo stato di rilascio: nessuna informazione di build o distribuzione nel repository.

---

## 5. Conflitti aperti e decisioni di prodotto richieste

> Come prescritto da CC-01, questi punti **non** sono stati risolti unilateralmente.

### 5.1 Hamburger flottante e `AppSidebar` — decisione richiesta

**Evidenza.** `app/(tabs)/_layout.tsx` renderizza un pulsante flottante circolare
(`menu-outline`, 44×44, `zIndex.sticky`) sopra il contenuto di **tutte le tab tranne
Home**, Dashboard inclusa. Apre `AppSidebar` (`src/ui/sidebar/AppSidebar.tsx`), un drawer
con: Profilo, I miei contenuti, Annunci, Rete, Messaggi, Shortlist, Impostazioni, Logout.

**Conflitto.** CC-05 vieta esplicitamente sia il gear/hamburger flottante sopra i
contenuti sia un secondo menu di navigazione. Il contratto ipotizza però che gli elementi
osservati nel video possano essere strumenti di sviluppo e chiede di **non eliminare alla
cieca** funzionalità necessarie alla build tecnica.

**Verifica eseguita.** `AppSidebar` **non** è uno strumento di sviluppo: è codice di
produzione, coperto da test (`AppSidebar.test.tsx`), ed è l'**unico** punto di accesso
nella shell a `/settings`, al logout, alla tab nascosta `/(tabs)/network` e a
`/(tabs)/announcements` (entrambe con `href: null` nel tab layout).

**Decisione richiesta (non presa qui).** Opzioni mutuamente esclusive:

- **A** — rimuovere il pulsante flottante **solo** nello stack Dashboard, lasciandolo
  nelle altre tab; serve una destinazione alternativa per Impostazioni e Logout dalla
  Dashboard.
- **B** — rimuovere hamburger e sidebar dall'intera shell e ricollocarne le voci
  (Impostazioni e Logout in Profilo, Rete e Annunci nelle aree canoniche); impatto fuori
  dal perimetro Dashboard, quindi fuori scope DAS-REV-01.
- **C** — deroga esplicita al CC-05 per la fase di transizione, con regola, modifica e
  approvazione registrate nel changelog del contratto.

**Blocco:** DAS-REV-01 non può definire la shell Dashboard senza questa decisione.

### 5.2 `HeaderBell` nell'header Dashboard — decisione richiesta

Entrambe le Dashboard attuali mostrano la campanella con conteggio non letto. CC-05 dice
che le funzioni globali già previste in altre aree restano in quelle aree e che l'header
Dashboard non aggiunge la campanella. Rimuoverla cambia un percorso oggi funzionante verso
`/notifications`. **Decisione richiesta** prima dei master DAS-REV-01.

### 5.3 `footme://` — nessuna sostituzione, chiarimento necessario

CC-16 parla di "presenza legacy di `footme://`". La verifica mostra che non è un residuo:
è lo schema **attivo** dichiarato in `app.json` (`"scheme": "footme"`), insieme a
`"slug": "footme"` e ai bundle identifier `com.footme.mobile`. Il nome prodotto è
`ProLink`. Cambiarlo significa rinominare bundle id e schema, cioè rompere i deep link
esistenti e richiedere una nuova identità applicativa sugli store.

**Raccomandazione (da approvare):** nessuna modifica nella Foundation; la questione resta
aperta per un pack dedicato con strategia di compatibilità. Nessun dominio PROLINK
inventato va introdotto.

### 5.4 Badge Messaggi che somma conversazioni e comunicazioni

`app/(tabs)/_layout.tsx` calcola `unreadThreadsCount` sommando le conversazioni con
`unread_count > 0` e le comunicazioni con `is_read === false`. CC-03 chiede aggregatori
distinti per Messaggi e Comunicazioni. È un comportamento **fuori dal perimetro
Foundation**: va registrato come debito e assegnato al pack MES/Comunicazioni, non
modificato da DAS-REV-01.

### 5.5 Documentazione di design non allineata al codice

`docs/mobile-ux-ui-guidelines.md` descrive una palette che **non esiste più**:
`accent #0D7A43` (verde), `background #F5F2E9`, `hero #C96E3D`, e indica
`apps/mobile/src/theme/tokens.ts` come file di colori. Il codice attuale usa
`accent #1B4FD8` (blu), `background #F4F6FA`, `hero #0C1B2A`, con i token in
`apps/mobile/src/styles/tokens/`.

Il riferimento normativo corretto per CC-10 è il **codice** (`src/styles/tokens/`) più la
sezione "Design system (ProLink UI Upgrade)" di `.claude/CLAUDE.md`. Aggiornare
`mobile-ux-ui-guidelines.md` è necessario ma **fuori scope DAS-REV-00**: questa task non
modifica documentazione non pertinente alla Dashboard.

### 5.6 Terminologia "Annunci" — perimetro della correzione

CC-12 impone "Posizioni aperte" per l'area operativa, ma CC-12 vieta anche la sostituzione
indiscriminata di stringhe e identificativi storici. Il repository ha la rotta
`app/(tabs)/announcements.tsx`, le tabelle `recruiting_ads` / `saved_ads`, e 47 occorrenze
testuali di "Annunci". **Regola proposta (da confermare):** rinominare solo le **label
visibili delle superfici revisionate da un pack**, mai rotte, tabelle, chiavi o campi.

---

## 6. Controlli eseguiti e limitazioni

**Eseguito**

- Ricognizione statica del repository al commit `041ac8f`, branch `main`, working tree
  pulito all'avvio.
- Lettura diretta dei file citati; conteggi ottenuti con `grep` / `find` / `wc` e
  riportati come misurati.
- Verifica dell'esistenza di ogni rotta citata nella tabella §2.5.
- Verifica negativa esplicita per: `ErrorBoundary`, `netinfo`, `dashboardIdentity`,
  `actor`, `RefreshControl` fuori dal Feed.

**Non eseguito, con motivo**

- `npm run lint`, `npm run typecheck`, `npm test`, build: **non pertinenti**. Questa
  assegnazione modifica solo file Markdown in `docs/` e non tocca codice applicativo,
  configurazione o migrazioni. Non sono stati eseguiti e **non** vengono dichiarati
  superati.
- Screenshot e confronto visuale: non richiesti da CC-22 per un'assegnazione documentale;
  non esiste ancora l'interfaccia da confrontare.
- Verifica runtime di RLS, capability e comportamento offline: richiede un ambiente
  Supabase attivo, non disponibile in questa assegnazione.
- Verifica dei mockup e del Piano consolidato: file esterni al repository.

**Limitazioni della ricognizione**

- Lo stato "Presente" significa *codice verificato nel repository*, **non** verificato in
  esecuzione, **non** coperto da test, **non** rilasciato.
- Il comportamento a runtime delle RPC e delle policy RLS è stato dedotto dalle migrazioni,
  non osservato.
- Le occorrenze testuali (es. 47 "Annunci") includono commenti e stringhe non visibili
  all'utente: il perimetro esatto va ristretto nel pack che eseguirà la correzione.
