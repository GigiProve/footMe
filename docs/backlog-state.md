# Stato del backlog — fonte di verità

**Fonte unica:** progetto Freedcamp *Sviluppo APP* — <https://freedcamp.com/view/3728859/tasks>
**Ultima sincronizzazione:** 2026-11-07 (200 task lette dall'API)

> Questo file è una **fotografia**. Quando lavori su una task, rileggi Freedcamp:
> la descrizione completa della task è la specifica, questo file serve solo a
> capire dove siamo e cosa viene dopo.

## Come leggere Freedcamp

Il plugin `freedcamp` è read-only:

```bash
node ~/.claude/plugins/cache/luigi-local/freedcamp/0.1.1/scripts/fc.js tasks --project 3728859 --all
node ~/.claude/plugins/cache/luigi-local/freedcamp/0.1.1/scripts/fc.js task <id-o-URL>
```

Stati del progetto: `Completed`, `In Progress`, `No Progress` (= da fare).
Usa `status_title`, non i codici numerici.

## Anatomia di una task

Le task recenti (REV-*, DAS-REV-*, HOM-*, MES-*, CER-*) hanno tutte la stessa
struttura, e vanno trattate come un contratto:

1. **Allegato visuale** — un PNG (`<nome task>.png`) con N schermate numerate,
   allegato alla task. È la resa visuale di riferimento.
   Le task più recenti aprono con «IMMAGINE NON PRESENTE SU BANANI»:
   **Banani non è più la fonte di design**, il PNG allegato sì.
2. **§1 Incarico e risultato richiesto** — cosa deve esistere e funzionare.
3. **§2 Materiali e analisi preliminare** — obbligo di mappare il riuso nel
   repository *prima* di scrivere codice, e di non creare un secondo core se
   ne esiste già uno equivalente.
4. **§3 Dipendenze e confini di consegna** — quali task precedenti riusare.
5. Regole funzionali numerate, criteri di accettazione, QA richiesta.

**Precedenza delle fonti**, dichiarata dalle task stesse:
regole testuali della task → permessi/privacy/contratti condivisi → PNG per la
resa visuale. Un refuso nel PNG non autorizza a contraddire le regole.
Un mockup da solo non introduce permessi, entità, stati o contatori nuovi.

Il contratto trasversale della Dashboard è registrato in
[`dashboard-common-contract.md`](./dashboard-common-contract.md) (DAS-REV-00).

## Convenzione dei codici

| Prefisso | Area |
| --- | --- |
| `BUG-nn` | difetti segnalati, quasi tutti su onboarding/registrazione |
| `GEN-Inn` | implementazioni generali trasversali |
| `IR0n` | onboarding/registrazione per ruolo (GIO, ALL, STA, SOC, AGE, DIR, MEDAPP) |
| `REV-ONB-nn` | revisione UI/UX + design system dell'onboarding |
| `PRO <ruolo> - nn` | profili per ruolo (prima versione) |
| `REV-PROF-nn` | revisione UI/UX + design system dei profili |
| `RET-nn` | rete, tag, relazioni, follow/salvati, shortlist v1 |
| `MES-nn` | messaggi e notifiche |
| `CER-nn` | ricerca e discovery |
| `HOM-nn` | home e feed social |
| `DAS-REV-nn` | revisione Dashboard (backlog attivo) |
| `DAS-HOLD-01` | Store — **sospeso**, 5 blocchi, non iniziare senza conferma |

Il messaggio di commit usa il codice task: `DAS-REV-25 - Shortlist Position: aggiunta e valutazione`.

## Stato per area (2026-11-07)

| Area | Fatte | In corso | Aperte |
| --- | ---: | ---: | ---: |
| Generale — BUG | 8 | 1 | 24 |
| Generale — Implementazioni | 7 | 2 | 3 |
| Società — Implementazioni generali | 2 | 0 | 0 |
| LOGIN | 1 | 0 | 0 |
| Onboarding — Registrazione | 10 | 1 | 0 |
| Onboarding — Review UI/UX | 9 | 0 | 0 |
| Profilo | 28 | 0 | 0 |
| Profilo — Review UI/UX | 22 | 0 | 0 |
| Rete | 7 | 0 | 0 |
| Messaggi | 3 | 0 | 3 |
| Cerca | 5 | 0 | 1 |
| Home | 1 | 0 | 16 |
| Dashboard | 26 | 0 | 20 |
| **Totale** | **129** | **4** | **67** |

### Chiuso e consolidato

- **Onboarding** — tutti i ruoli implementati (IR01-IR10) e poi rivisti sul
  design system (REV-ONB-01..09). Il kit master sta in
  `src/features/onboarding/ui/`.
- **Profilo** — tutti i ruoli (Calciatore, Allenatore, Staff, Dirigente,
  Procuratore, Società, Tifoso, Media/Creator) in versione Master Profile +
  hub «Modifica profilo» per sezione (REV-PROF-01..22).
- **Rete** — matrice relazioni, tag, rappresentanza agente↔calciatore,
  follow/salvati, shortlist v1 (RET-01..07).
- **Cerca** — profili, società, posizioni aperte, media (CER-01..05).
- **Dashboard** — foundation, dashboard personale e Società, squadre e
  stagioni, rete societaria, amministratori e ruoli/permessi, Posizioni
  (centro, composer, lifecycle, scadenza), inviti e collegamento
  persona–società, candidature ricevute e lifecycle, core Shortlist
  unificato con centro, pool di Position, valutazione e rimozione
  (DAS-REV-00..25).

### Backlog attivo — Dashboard (in ordine)

| Task | Oggetto |
| --- | --- |
| DAS-REV-26..27 | **Shortlist**: aggiunta dal profilo, liste personalizzate + QA |
| DAS-REV-28..31 | **Eventi**: centro e creazione, landing e iscrizione, inviti e partecipanti, profili/shortlist/lifecycle + QA |
| DAS-REV-32..35 | **Gruppi**: centro e creazione, gestione e lifecycle, integrazione Messaging/Push, UI premium + QA |
| DAS-REV-36..39 | **Comunicazioni**: core/inbox/centro, composer e invio, lettura e condivisione, lifecycle e scheduling + QA |
| DAS-HOLD-01 (5 blocchi) | **Store** — sospeso |
| DAS-REV-40 | Integrazione, migrazione e release QA |

### Backlog attivo — altre aree

- **Home / feed social** — HOM-02..15 praticamente tutto da fare: post
  standard, feed video, creazione post e bozze, like/salvataggi, commenti,
  condivisione, repost, segnalazioni, blocco profilo, ranking e discovery,
  notifiche social. Solo HOM-01 (struttura/spina del feed) è chiusa;
  HOM-01.1 è il consolidamento UI.
- **Messaggi** — MES-03.1 (consolidamento Centro Notifiche, allineato a
  HOM-14), MES-04 (consolidamento messaggistica + identità Società),
  MES-05 (condivisione contatti).
- **Cerca** — CER-06, consolidamento UI/UX, ranking e QA finale.
- **BUG** — 24 aperti, concentrati su registrazione Allenatore, Agente,
  Dirigente, Società e su problemi trasversali (tastiera che copre i campi,
  header coperto dal menù, selettori altezza/peso).
- **Generale** — GEN-I04 (cambio immagine), GEN-I05 (contatti),
  GEN-I06 (verifica numero, in corso), GEN-I10 (cambio nome).

## Nota sulle consegne precedenti

In `docs/` ci sono note di consegna solo per DAS-REV-01, 02, 03 e 06. Dalla
DAS-REV-07 in poi la motivazione delle scelte sta **nell'intestazione in
commento della migrazione** corrispondente (`supabase/migrations/`) e nel
messaggio di commit. Le migrazioni recenti si aprono con decine di righe che
spiegano cosa mancava e perché: leggile prima di toccare quel dominio.
