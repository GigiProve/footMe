# Mappa del codice — dove vive cosa

Aggiornata al 2026-11-07. Serve a orientarsi prima di aprire una task: qual è il
modulo canonico di un dominio, quali moduli sono legacy, e quali convenzioni
seguire dentro un modulo.

## Struttura

```
apps/mobile/
  app/                 route Expo Router — file sottili, nessuna logica
  src/features/<dom>/  dominio: screen, componenti, service, hook, tipi, test
  src/ui/              primitive condivise (AppText, Button, ContentModule, …)
  src/components/ui/   campi di form e layout condivisi (Screen, SelectField, …)
  src/theme/tokens.ts  token di design
  src/styles/          font e token derivati
  src/lib/             helper trasversali (supabase, query-client, analytics…)
supabase/migrations/   append-only, ~157 file
docs/                  questa documentazione
```

## Route → modulo

| Route | Modulo | Note |
| --- | --- | --- |
| `app/(auth)/*` | `features/auth` | welcome, sign-in, sign-up, forgot-password |
| `app/(onboarding)/profile.tsx` | `features/onboarding` | un solo entry point, rami per ruolo |
| `app/(tabs)/index.tsx` | `features/feed` | Home |
| `app/content/insights/[type]/[id]` | `features/content-insights` | Dettagli e statistiche di un contenuto (HOM-05), fuori dalle tab; nello stesso modulo la coda eventi `content-events-*` che alimenta `record_content_events` |
| `app/post-compose/*` | `features/post-composer` | Composer Post (HOM-06.1); da HOM-06.2 anche bozze (`?draft_type=&draft_id=`), riga Pubblicazione e autosave server |
| `app/article-compose/*` | `features/article-editor` | Articolo (HOM-06.2): selector modalità, editor canonico (native e imported_text), Collega da un link, Incolla un articolo, Anteprima, `open` per ref. Documento strutturato in `article-document.ts` (mai HTML), parser degli appunti in `article-paste.ts`, renderer unico `ArticleDocumentView` usato anche dal dettaglio. Il composer Media legacy (`MediaPostComposer`) non è più raggiungibile |
| `app/drafts` | `features/publishing` | Bozze e programmati (HOM-06.2), fuori dalle tab. Modulo condiviso Post + Articolo: launcher «+» (`fetch_content_launcher`, `CreateContentSheet`), scheduler unico (`PublicationSheet`), autosave (`use-autosave`, CAS su `content_version`), comandi di lifecycle. Bozze e programmati sono STATI delle righe esistenti (`draft/scheduled/publishing/failed`), worker SQL `run_scheduled_content_sweep` via pg_cron |
| `app/(tabs)/cerca.tsx`, `app/search/*` | `features/search` | profili, società, posizioni, media |
| `app/(tabs)/dashboard/*` | `features/dashboard` | area più grande del repo |
| `app/(tabs)/messages.tsx`, `app/messages/*`, `app/comunicazioni/*` | `features/messaging` | |
| `app/(tabs)/profile/*`, `app/profile/*` | `features/profiles` | master profile + hub di modifica per ruolo |
| `app/notifications.tsx`, `app/notification-preferences.tsx` | `features/notifications` | |
| `app/position*/`, `app/society-position/*` | `features/dashboard/positions` | centro, composer, manage |
| `app/(tabs)/dashboard/my-applications/*` | `features/applications` | candidature inviate (lato persona); `app/applications/*` resta come redirect per i deep link già inviati |
| `app/(tabs)/dashboard/events/index`, `app/event-compose/*` | `features/dashboard/events` | Centro Provini, stage e open day (sezioni In programma/Bozze/Storico con cursore per sezione) e wizard a tre step su una sola route (DAS-REV-28); dominio `selection_events` unico per i tre tipi |
| `app/(tabs)/dashboard/events/[eventId]`, `.../events/request/[participationId]`, `app/event/[publicId]` | `features/dashboard/events/{detail,requests,link}` | Dettaglio canonico con proiezioni pubblica/personale/gestionale, iscrizione e ritiro della persona, decisione manuale della Società, link pubblico in app con ritorno dopo login (DAS-REV-29); partecipazioni in `selection_event_participations` (una per persona ed evento), matrice di disponibilità calcolata dal server in `selection_event_availability` |
| `app/(tabs)/dashboard/events/participants/[eventId]`, `app/event-invite/*` | `features/dashboard/events/{participants,invite}` | Centro Partecipanti a filtro singolo (sette filtri, count e cursore dal server), inviti diretti dal dettaglio o dal profilo con Shortlist come sorgente, accetta/rifiuta del destinatario nel dettaglio, revoca e rimozione (DAS-REV-30); stessa riga `selection_event_participations` con stati INVITED/DECLINED/REVOKED/REMOVED e generazione dell'invito; la preview richieste della 29 è sostituita dal riepilogo a tre righe |
| landing web dell'evento | `features/dashboard/events/landing` | Renderer HTML server-side puro (Fetch API, nessun React) e handler `/event/<public_id>` per un runtime edge qualunque; non è deployato: dominio, hosting e associazioni app sono gate di rilascio (DAS-REV-29) |
| `app/(tabs)/dashboard/groups/*`, `app/group-compose/*` | `features/dashboard/groups` | Centro Gruppi (proiezione amministrativa, ordine Squadre canonico poi Società, ricerca sul nome), dettaglio amministrativo con «Apri conversazione» solo per i partecipanti, wizard a tre step condiviso da Dashboard e Messaggi (DAS-REV-32). Un gruppo è **una** `conversations` di tipo `group` + metadata 1:1 in `society_groups`; ruolo ADMIN/MEMBER su `conversation_participants.member_role`; create atomica `create_society_group` con ricevuta idempotente; avatar privato in `society-group-avatars`. **DAS-REV-33**: gestione e lifecycle in `features/dashboard/groups/manage/` (Info gruppo unica per Messaggi e Dashboard su `app/group-info/[conversationId]?origin=…`, fuori dalle tab; Persone, Aggiungi, Successione; `ArchivedGroupsScreen` su `groups/archived`). Capability calcolate dal server (`society_group_caps`, chiavi Società `groups_manage`/`groups_delete`). `conversation_participants` = membership corrente, storia in `society_group_membership_periods` (chiusa; il client legge solo `society_group_member_access`), finestra di lettura `messages.seq >= access_from_seq`, `message_kind = 'system_event'` scritto solo dal server, tombstone `society_groups.deleted_at`, cessazione automatica al commit quando cade l'ultimo titolo (`society_group_person_maintains`) |
| `app/(tabs)/dashboard/shortlist/*` | `features/dashboard/shortlist` | centro, pool di Position con filtri, scheda «Profilo in shortlist» ed editor di valutazione (DAS-REV-24/25); pool condiviso in `use-shortlist-pool` + `ShortlistPoolList` |
| `app/(tabs)/dashboard/shortlist/list/[listId]`, `app/shortlist/recovery/*` | `features/dashboard/shortlist/custom` | Liste personalizzate: dettaglio, Gestisci lista, Gestisci accesso, Modifica lista con impatto ambito, Elimina, recupero amministrativo del proprietario (DAS-REV-27) |
| stella sul profilo (`app/profile/[id]`) | `features/dashboard/shortlist/profile` | selector Position/CUSTOM, riepilogo membership, azioni, crea e aggiungi, recupero (DAS-REV-26); il form CUSTOM canonico resta `features/shortlist/components/CreateListModal` |
| `app/shortlist/*` | `features/shortlist` | flusso RET-07 ancora usato da Cerca; il profilo usa il flusso DAS-REV-26; `index` e `[listId]` reindirizzano alla tab Dashboard (DAS-REV-27); il form CUSTOM canonico `CreateListModal` vive qui |
| `app/club-*`, `app/team-*`, `app/society-admin/*` | `features/clubs`, `features/teams` | |
| `app/role-link/*` | `features/role-link` | collegamento persona–società |
| `app/representation/*`, `app/assistito-invite/*` | `features/relationships` | procuratore ↔ assistito |
| `app/invite/*`, `app/invitation/*`, `app/*-invite/*` | `features/dashboard/invites`, `.../join-links` | |
| `app/saved/*`, `app/following/*` | `features/saved`, `features/following` | |
| `app/content/*` | `features/content` | contenuti e tag |
| `app/(admin)/*` | `features/admin` | pannello interno |

### Moduli legacy — non costruirci sopra

`features/discovery`, `features/networking`, `features/recruiting`,
`features/home`, e le route `app/(tabs)/network.tsx` e
`app/(tabs)/announcements.tsx` (registrate con `href: null`, quindi fuori dalla
tab bar). La bottom nav attuale è **Home | Cerca | Dashboard | Messaggi | Profilo**.
Il dominio canonico della rete è `features/network`, quello del feed `features/feed`,
quello della ricerca `features/search`.

## Convenzioni dentro un modulo

I moduli recenti (Dashboard, role-link, teams, positions) seguono tutti lo
stesso schema. Replicalo invece di inventare:

| File | Ruolo |
| --- | --- |
| `<nome>-service.ts` | accesso dati: chiamate RPC/PostgREST e mapping riga → modello |
| `<nome>-types.ts` | tipi del dominio |
| `<nome>-presentation.ts` | derivazioni pure per la UI (etichette, stati, raggruppamenti) — qui va la logica testabile |
| `<nome>-keys.ts` | query key React Query, con tutte le dimensioni che la cache deve distinguere |
| `<nome>-routes.ts` | costruzione delle destinazioni: una sola definizione per schermata |
| `<nome>-analytics.ts` | eventi |
| `operation-key.ts` | chiave di idempotenza dei comandi (nonce + impronta del payload) |
| `components/` | componenti del dominio |
| `compose/`, `manage/`, `detail/` | sottoflussi, ciascuno con i propri file omonimi |
| `*.test.ts(x)` | accanto al file che coprono |

Due abitudini da conservare:

- **la logica derivabile sta in `-presentation.ts`**, non nella screen: è ciò
  che rende i test possibili senza render;
- **i file hanno un commento di testa** che cita il paragrafo della task che
  giustifica la scelta (`§24`, `§15`…). Scrivilo anche tu: è il modo in cui
  questo repository tiene traccia del *perché*.

## UI condivisa

**Primitive** — `src/ui/index.ts` esporta: `AppText`, `Button`, `Badge`,
`Card`, `ContentModule`, `SectionCard`, `TabBar`, `SearchField`, `Input`,
`Checkbox`, `Radio`, `Toggle`, `Avatar`, `Divider`, `EmptyState`, `Skeleton`,
`ListItem`, `StatCard`, `ActionSheet`, `BottomSheet`, `ConfirmModal`,
`ModalHeader`, `ScreenHeader`, `TopBar`, `Toast`, `NotificationBadge`,
`HeaderBell`, `icons`. La sidebar sta in `src/ui/sidebar` con un index proprio.

**Campi e layout condivisi** — `src/components/ui`: `Screen`,
`KeyboardAwareForm`, `KeyboardAwareScrollView`, `SelectField`,
`MultiSelectField`, `DatePickerField`, `WheelPickerField`,
`MediaPickerField`, `PhoneInputWithCountryCode`,
`NationalityAutocompleteInput`, `ResidenceCityInput`, i selector di
disponibilità per regione/provincia, e i preview media/video.

**`EditModalShell`** vive in `src/features/profiles/edit-modals/` ma è usata
ben oltre i profili (clubs, content, shortlist): è il guscio standard per la
modifica a schermo intero di una sezione.

Regole di design: [`mobile-ux-ui-guidelines.md`](./mobile-ux-ui-guidelines.md),
[`mobile-button-system.md`](./mobile-button-system.md) e la sezione «Design
system» di `.claude/CLAUDE.md`.

## Database

157 migrazioni in `supabase/migrations`, nome
`YYYYMMDDHHMMSS_<slug>.sql`, **append-only**. Le migrazioni recenti si aprono
con un commento lungo che spiega cosa mancava, quale regola della task lo
chiedeva e perché la soluzione è quella: è la documentazione di dominio più
aggiornata che esiste nel repository.

`docs/database-schema.md` descrive solo il primo slice del marzo 2026 ed è
superato. Per sapere com'è fatto un dominio oggi: parti dalla migrazione più
recente che lo nomina.

Trappole note e ricorrenti sono in
[`verification-playbook.md`](./verification-playbook.md#trappole-ricorrenti-sul-database).
