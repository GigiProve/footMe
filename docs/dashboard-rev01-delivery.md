# DAS-REV-01 — Consegna della Foundation

**Task:** #73017093 — Foundation: shell, identity e composizione
**Contratto:** [`dashboard-common-contract.md`](./dashboard-common-contract.md) v1.0
**Piano:** [`dashboard-rev01-rev02-plan.md`](./dashboard-rev01-rev02-plan.md)
**Data:** 2026-10-09

> ## Consegna parziale
>
> §29.18 impone di non chiudere la task quando un controllo richiesto è
> bloccato. **Due controlli obbligatori non sono stati eseguiti**: la
> validazione visuale contro il master (§27) e qualunque verifica della
> migrazione su un database. I motivi precisi sono in §6 di questo documento.
> Codice e test sono completi e verdi; l'integrazione backend non è provata.

---

## 1. Risultato implementato

La Dashboard passa da **due schermate scelte da un `if` sul ruolo** a **una
Foundation che compone moduli in base all'identità gestita e alle capability
reali**.

Prima:

```
app/(tabs)/dashboard.tsx
  └─ profile?.role === "club_admin" ? <ClubDashboard /> : <PersonalDashboard />
```

Ora:

```
app/(tabs)/dashboard.tsx
  └─ <DashboardIdentityProvider>      actor → identità eleggibili → capability
       └─ <DashboardFoundation />     composizione → riepilogo, priorità, moduli
```

Implementato: identità operativa locale alla Dashboard, selector "Dashboard
di", cambio contesto con isolamento delle richieste, registry dei moduli,
valutazione capability ALL/ANY, conteggi filtrati server-side, stati di
caricamento / errore locale / errore globale / empty / nessuna identità.

---

## 2. File

### Backend

| File | Scopo |
| --- | --- |
| `supabase/migrations/20261012090000_dashboard_foundation.sql` | Gruppo permessi `dashboard_*`; `dashboard_club_capabilities()`; `fetch_dashboard_identities()`; `fetch_dashboard_society_overview()` |

Nessuna tabella creata, nessun dato modificato, nessuna policy esistente resa
più permissiva. Rollback: drop delle tre funzioni e re-add del CHECK con la
sola lista `shortlist_*` + `notif_*`.

### Client — `apps/mobile/src/features/dashboard/`

| File | Scopo |
| --- | --- |
| `dashboard-types.ts` | `DashboardIdentity`, kind PERSON/SOCIETY/MEDIA, capability, helper ALL/ANY |
| `dashboard-keys.ts` | Query key che includono **actor + identità** |
| `dashboard-analytics.ts` | Eventi `dashboard_*` a proprietà minimizzate |
| `identity/identity-service.ts` | RPC identità e overview; scarto di kind/capability sconosciuti |
| `identity/identity-resolver.ts` | Default, fallback, presentazione del contesto — **puro** |
| `identity/identity-preference.ts` | Ultima identità per utente su AsyncStorage |
| `identity/DashboardIdentityProvider.tsx` | Contesto, `contextToken`, switch |
| `identity/use-dashboard-identity.ts` | Hook di accesso |
| `modules/module-registry.ts` | Registro statico e tipizzato dei moduli |
| `modules/composition.ts` | Eleggibilità e azioni rapide — **puro** |
| `modules/dashboard-features.ts` | Disponibilità reale delle destinazioni |
| `adapters/personal-adapter.ts` | Candidature, salvati, condizione disponibilità |
| `components/*` | 7 componenti visuali della Foundation |
| `DashboardFoundation.tsx` | Container unico |

**Modificato:** `apps/mobile/app/(tabs)/dashboard.tsx` (13 → 21 righe, monta
provider + Foundation).

**Non toccati:** `ClubDashboard.tsx` e `PersonalDashboard.tsx` restano nel
repository. CC-19 vieta di azzerare lavoro precedente prima della copertura
verificata — e quella copertura richiede la validazione che non ho potuto fare.

---

## 3. Struttura di identità, scope e composizione

**Identità** (`fetch_dashboard_identities`): l'identità personale dell'actor —
kind `media` se `profiles.role = 'media'`, altrimenti `person` — più le Società
di cui è owner o membro attivo con almeno un grant `dashboard_*`.
`club_affiliations` **non è interrogata**: un'affiliata resta autonoma e
l'ownership non si trasferisce. Follow e rapporti sportivi non compaiono.

**Capability**: owner → tutte le otto chiavi implicitamente, come
`owns_club()`. Membro → le sole chiavi concesse, e solo finché
`club_members.status = 'active'`, così rimuovere un membro revoca l'accesso
senza ripulire i grant.

**Composizione**: ordine `accesso → dominio → capability → feature → dati →
rendering`. Un modulo non autorizzato è **assente**. Le azioni sono autorizzate
separatamente dalla lettura.

**Isolamento**: ogni query key contiene actor e identità, quindi una risposta
tardiva di B atterra nella cache di B e non può comparire dentro C. Il
`contextToken` cambia a ogni switch e azzera lo scroll. Il provider è `key`-ato
sull'actor: al cambio account React smonta tutto, e non resta stato del
precedente nemmeno per un frame.

---

## 4. Scostamenti dal master, con motivazione

Tutti derivano da §7 e CC-01: la regola testuale prevale sull'incongruenza del
mockup, e il dominio prevale sulla label disegnata.

| Master | Implementato | Perché |
| --- | --- | --- |
| Stati "Nuova" / "In valutazione" | "Inviata" / "In lettura" | §7 impone le label canoniche del dominio. Sono `APPLICATION_STATUS_LABELS` in `recruiting-service.ts`; inventare un lifecycle Dashboard è vietato |
| "1 Programmato" (screen 03) | metrica assente | `club_media_posts.status` ammette solo draft/published/archived. §4 vieta il dato finto |
| "Pubblicazione non riuscita" | priorità assente | Nessuno stato `failed` nel dominio |
| "Nuovo post" + "Nuovo articolo" | un solo "Nuovo contenuto" | Il composer Società è uno (`/(tabs)/profile?compose=club`). Due pulsanti alla stessa destinazione sono la duplicazione che CC-11 vieta |
| "Invita persona" | azione assente | Il flusso Inviti è gated su `role === 'club_admin'`, non su capability: un membro autorizzato troverebbe una destinazione che lo rifiuta |
| 3 identità (screen 04) | fino a 2 per un actor reale | Un profilo ha un solo `role`: `person` e `media` si escludono. Il selector gestisce N identità; i 3 record del master richiedono fixture |
| metadata ~13pt | `meta` = 12.5pt | È il token canonico del design system. CC-10 chiede di usare i token esistenti, non di hardcodare |

---

## 5. Decisione di prodotto richiesta — lettura delle candidature

**Il punto.** La policy RLS di `recruiting_applications` è owner-only
(`owns_club`). Un membro con grant `applications_view` avrebbe quindi conteggi
pieni e lista vuota — l'incoerenza che §20 vieta esplicitamente.

**Cosa ho fatto.** Conteggi *e* preview arrivano dalla stessa RPC
`SECURITY DEFINER`, sbarrati dalla stessa capability, proiettati sui soli campi
della preview. La policy esistente **non** è stata allargata (§22): resta
owner-only per l'accesso diretto alla tabella.

**Cosa resta da decidere.** Questo significa che un membro con grant
`applications_view` vede nome e avatar dei candidati. È una decisione di
autorizzazione, non tecnica, e il grant lo concede l'owner della Società.
L'alternativa è limitare la Dashboard Società ai soli owner in v1, rinunciando
al caso d'uso multi-amministratore che il master 02/03 presuppone.

**Non l'ho decisa io.** Serve approvazione prima del rilascio.

---

## 6. Controlli: eseguiti, falliti, bloccati

### Eseguiti

| Comando | Esito |
| --- | --- |
| `npm run typecheck` | **Pulito**, zero errori |
| `npm run lint` | 142 warning, **tutti preesistenti**. Zero nel codice nuovo (verificato con `grep -c "features/dashboard"` → 0). Baseline prima della task: 142 |
| `npm test` | **179 file, 1969 test, tutti verdi.** Prima della task: 178 file, 1954 test |
| Test nuovi | 44: 29 sulle funzioni pure (eleggibilità, ALL/ANY, default/fallback, presentazione), 15 di montaggio reale dei componenti |

I test di montaggio esistono perché il typecheck non vede un uso sbagliato di
un'API runtime: avevo usato `Skeleton` come componente quando è un oggetto di
sottocomponenti, e solo il montaggio lo prova.

### Bloccati — con il motivo preciso

| Controllo | Blocco |
| --- | --- |
| **Validazione visuale §27** (avvio app, 4 screenshot a 393×852, confronto col master) | `xcode-select -p` → `/Library/Developer/CommandLineTools`: non c'è Xcode completo. `xcrun simctl list devices available` non elenca **alcun** iPhone. Nessun simulatore su questa macchina |
| **Verifica della migrazione** | Docker non in esecuzione (`Cannot connect to the Docker daemon`), quindi niente Supabase locale. Il progetto linkato è il **remoto** `gwvkjbiuetjltrpugdxo` (FootMe): applicarvi la migrazione è una modifica a un database condiviso, che non eseguo senza richiesta esplicita |

**Conseguenze da non sottovalutare.** Le quattro RPC non sono mai state
eseguite. Il SQL è scritto seguendo i pattern delle migrazioni esistenti ed è
rivisto, ma **non è compilato né testato**: errori di sintassi, di tipo o di
`group by` sono possibili. Il client non ha mai ricevuto una risposta reale
dalle RPC: il mapping dei payload è coperto dai tipi, non dall'evidenza.

### Non eseguito, per scelta motivata

Confronto pixel con il master: senza app avviata sarebbe una dichiarazione
senza prova. §27 lo vieta esplicitamente.

---

## 7. Regressioni

Verificato **entro** le superfici coperte dalla suite: 1969 test verdi, nessuno
preesistente rotto, incluse le suite di recruiting, messaging, shortlist,
profili e search.

**Non verificato**, e quindi non dichiarato privo di regressioni: comportamento
runtime della Dashboard Società precedente (il suo container non è più montato
dalla route), navigazione reale e back, autenticazione e membership su dati
veri, composer Post/Articolo, identità di Messaggi/Home/Profilo dopo uno switch.
Tutto ciò richiede l'app avviata.

---

## 8. Consegne a DAS-REV-02

Già pronto: query key per actor + identità, `contextToken` per le risposte
obsolete, pull-to-refresh che rivaluta accesso e capability, errore locale per
modulo con retry, errore globale, empty distinto dall'errore.

Da fare in REV-02: cache persistente per identità (il template è
`features/feed/feed-cache.ts`), policy di scadenza per l'accesso offline ai dati
organizzativi — **richiesta esplicitamente da CC-14** —, ranking dinamico delle
priorità e safe point, freshness per dominio, offline (`netinfo` non è
installato: o si riusa l'euristica del Feed o se ne motiva l'introduzione).

Debiti registrati, non risolti qui: `society_scheduled_content` e
`society_invites` in `dashboard-features.ts`, ciascuno con motivo e pack
responsabile; il gating per ruolo di `app/club-admin/_layout.tsx`, che resta su
`role === 'club_admin'` invece che su capability.
