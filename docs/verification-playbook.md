# Playbook di verifica

Come si verifica una modifica in questo repository, e con quali strumenti
quando mancano simulatore e database remoto. Aggiornato al 2026-11-07.

## Set minimo prima di chiudere una task

Esegui il più piccolo insieme che copre davvero la modifica:

```bash
npm run lint
npm run typecheck
npm test -- <percorso del test>     # mirato, non l'intera suite
```

Dalla root. Gli script passano da `scripts/run-node20.sh`, che risolve da solo
una copia di Node 20: **non serve prefissare il PATH** se usi gli script npm.

### Trappola Node

Il `node` di default della macchina è **v16** e fa fallire sia vitest
(`node:util` non esporta `styleText`) sia eslint (`structuredClone is not
defined`). Se invochi vitest o eslint **direttamente** (non via npm script),
prefissa il PATH:

```bash
PATH=$HOME/.local/nodejs/node-v20.20.1-darwin-x64/bin:$PATH npx vitest run <path>
```

`npx tsc --noEmit` gira anche con Node 16, quindi **un typecheck verde non
dimostra che i test siano stati eseguiti davvero**.

Su questa macchina non ci sono `jq` né un `python3` funzionante (Abort trap 6).
Per manipolare JSON, SQL o testo usa uno script `.mjs` con Node 20.
In quegli script, `String.replace` con stringa di sostituzione interpreta `$$`
come `$`: su un file SQL questo rompe silenziosamente i terminatori
`$$;` delle funzioni. Usa `replace(a, () => b)` o `split(a).join(b)`.

## QA visuale senza Xcode

Su questa macchina `xcode-select -p` punta ai CommandLineTools: **niente
`simctl`, niente simulatore iOS**. La verifica visuale si fa con un harness
**react-native-web** costruito a mano, che non vive nel repository ma negli
scratchpad di sessione — copiarne uno è molto più veloce che rifarlo.

L'harness è cinque file: `build.mjs` (esbuild, alias `react-native` →
`react-native-web`, `@app` → `apps/mobile/src`, parametrizzato con `ENTRY=` /
`OUT=`), `stubs.jsx` (expo-router, `useSession`, Ionicons testuali,
`supabase.rpc`/`supabase.from` che leggono `globalThis.__FIXTURE__`,
safe-area, Toast, provider di Dashboard), `entry.jsx` (cornice 393×852, uno
stato per volta via `?state=N`), `fixtures.js`, `serve.mjs` (porta 4599).
Serve un `node_modules` con `esbuild`, `react-native-web`, `react-dom` e
`libpg-query`: quello del repo non basta, react-native-web non è una
dipendenza del progetto.

Trappole che costano tempo ogni volta:

- le fixture devono essere **righe RPC grezze** (snake_case), così gira anche
  il mapper reale e la QA verifica la mappatura, non solo il layout;
- gli hook stub devono restituire un **oggetto costante di modulo**: uno nuovo
  a ogni render fa ciclare gli effetti che lo hanno nelle dipendenze e la
  schermata resta bloccata su un ramo d'errore senza alcun log;
- `useAccessWindow` **scade**: una `access_verified_at` fissa nel passato fa
  mostrare l'errore di autorizzazione invece della lista. Nelle fixture va
  messa a `new Date().toISOString()`;
- per scorrere un form non si sposta la cornice: si scrive sullo `scrollTop`
  del div con `overflow` che react-native-web genera per la `ScrollView`;
- `testID` diventa `data-testid`, quindi gli sheet si aprono con
  `querySelector(...).click()` sul controllo vero;
- un `Modal` di react-native-web esce dalla cornice e si disegna in fondo alla
  pagina: il contenuto è verificabile, la posizione no;
- `@react-native-community/datetimepicker` è distribuito in Flow e va
  redirezionato agli stub (anche in vitest, con `vi.mock`);
- `findAll` di react-test-renderer restituisce **sia** il componente composito
  sia il nodo host: contare i modali aperti senza filtrare
  `typeof node.type === "string"` raddoppia il risultato.

Questa QA ha trovato bug di layout reali più volte: vale la spesa di montarla
quando la task chiede un confronto con il PNG.

## QA su database reale senza Supabase remoto

`@electric-sql/pglite` **esegue tutte le migrazioni del repository** in
locale e permette di chiamare le RPC come utente autenticato: RPC, trigger e
RLS sono testabili senza toccare il remoto. Anche qui il runner (`db.mjs` +
`qa*.mjs`) vive negli scratchpad di sessione.

Il boot deve avere tutto questo, o le migrazioni falliscono a cascata:

- estensioni contrib passate a `PGlite.create({ extensions: … })` e poi
  `create extension`: `pgcrypto`, `pg_trgm`, `unaccent`, `btree_gin`,
  `citext`. Senza `pg_trgm` salta `20260313000001` e con lei venti migrazioni;
- schema `auth` con `auth.users` e `auth.uid()/role()/email()` che leggono
  `current_setting('request.jwt.claim.sub')` — è così che si impersona un
  utente: `select set_config('request.jwt.claim.sub', <uuid>, false)`;
- schema `storage` con `buckets`/`objects` (serve `owner_id`, non solo
  `owner`) e `storage.foldername/filename`;
- schema `extensions` con wrapper verso pgcrypto: `gen_random_bytes`,
  `digest`, `crypt`, `gen_salt`, `gen_random_uuid`.

Limiti e trappole:

- PGlite ha **una sola connessione**: la concorrenza vera non è riproducibile.
  Si verificano le *conseguenze* dei meccanismi — vincolo unique,
  `for update`/`for share`, compare-and-set sulla revisione — forzando i due
  ordini di commit in sequenza, e si **dichiara il limite** nel report;
- metti `process.on('uncaughtException', e => console.error(e.message))` in
  cima: un errore di pglite altrimenti stampa l'intero modulo compilato;
- i reset di fixture che violano un guard di dominio (riaprire una Position
  chiusa) vanno fatti con `alter table … disable trigger all`: non sono azioni
  di dominio e non devono passare dai comandi;
- le righe delle RPC di pagina arrivano in `items` come jsonb con nomi propri
  (`application_id`, non `id`): leggi le chiavi vere prima di asserire.

Per la sola sintassi di una migrazione, senza database: `parse()` di
`libpg-query` sul file intero verifica DDL e dollar-quoting. Non verifica che
le colonne esistano né il flusso plpgsql.

## Verificare lo stato del remoto

```bash
npm run supabase:migration:list     # richiede il link al progetto
```

Senza Docker né psql, con URL e anon key di `apps/mobile/.env.local`:

- colonna esistente: `GET /rest/v1/<tabella>?select=<colonna>&limit=0` → 200 se
  c'è, 400 se manca;
- RPC esistente: `POST /rest/v1/rpc/<fn>` con i **nomi reali** dei parametri a
  null → 400/200 se esiste, 404 `PGRST202` se manca. Chiamarla con `{}` è
  ambiguo.

Al 2026-10-08 tutte le migrazioni fino a `20261010100000` risultavano applicate
sul progetto remoto. Le migrazioni DAS-REV successive sono state scritte e
validate ma **non eseguite**: verifica prima di assumere.

## Trappole ricorrenti sul database

Costate tempo almeno una volta ciascuna:

- **Deriva di schema tra remoto e file.** Lo schema remoto non corrisponde
  sempre alle migrazioni (`recruiting_ads.target_role` è `app_role` in
  produzione e `text` nei file). Un `db reset` locale verde non prova nulla su
  quella colonna.
- **Funzioni ricreate dal file sbagliato.** Rifare un `create or replace`
  copiandolo da una migrazione vecchia invece che dalla definizione più
  recente reintroduce regressioni silenziose. Confronta sempre con l'ultima
  definizione effettiva prima di riemettere una funzione.
- **`revoke ... from public` non chiude `anon`.** Le default privileges di
  Supabase concedono l'execute direttamente ad `anon`. Serve
  `revoke execute ... from anon`, e comunque un check `auth.uid()` nel corpo.
- **RLS filtra righe, non colonne.** Per proteggere singole colonne
  (proprietà, verifica) serve un trigger.
- **`returns table` e `on conflict`.** Una colonna OUT con lo stesso nome di
  una colonna della tabella rende il riferimento ambiguo a runtime: la
  funzione compila e poi esplode (è successo a
  `fetch_my_notification_preferences`). Qualifica sempre.
- **Le RPC su `clubs` devono essere `security invoker`**: la tabella ha policy
  `TO authenticated` e una definer le scavalca.
- **I guard trigger possono bloccare flussi legittimi**: `guard_team_is_active`
  ha rotto la pubblicazione di ogni Position di squadra. Prova il percorso
  felice, non solo quello che il guard deve impedire.
