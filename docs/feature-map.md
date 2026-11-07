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
| `app/(tabs)/cerca.tsx`, `app/search/*` | `features/search` | profili, società, posizioni, media |
| `app/(tabs)/dashboard/*` | `features/dashboard` | area più grande del repo |
| `app/(tabs)/messages.tsx`, `app/messages/*`, `app/comunicazioni/*` | `features/messaging` | |
| `app/(tabs)/profile/*`, `app/profile/*` | `features/profiles` | master profile + hub di modifica per ruolo |
| `app/notifications.tsx`, `app/notification-preferences.tsx` | `features/notifications` | |
| `app/position*/`, `app/society-position/*` | `features/dashboard/positions` | centro, composer, manage |
| `app/(tabs)/dashboard/my-applications/*` | `features/applications` | candidature inviate (lato persona); `app/applications/*` resta come redirect per i deep link già inviati |
| `app/(tabs)/dashboard/shortlist/*` | `features/dashboard/shortlist` | centro unificato e vista base del pool (DAS-REV-24) |
| `app/shortlist/*` | `features/shortlist` | dettaglio lista, selector dal profilo, valutazione; `index` reindirizza al centro |
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
