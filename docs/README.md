# Documentazione ProLink

Indice ragionato. I documenti non hanno tutti lo stesso valore: alcuni sono
**vivi** (aggiornati e vincolanti), altri sono **storici** (utili come
contesto, superati dai fatti). L'etichetta è indicata qui sotto.

## Leggi prima di toccare il codice

| Documento | Stato | A cosa serve |
| --- | --- | --- |
| [`backlog-state.md`](./backlog-state.md) | vivo | Cosa è fatto, cosa è aperto, come si legge una task Freedcamp |
| [`feature-map.md`](./feature-map.md) | vivo | Dove vive un dominio, quali moduli sono legacy, convenzioni di modulo |
| [`verification-playbook.md`](./verification-playbook.md) | vivo | Come si verifica: lint/typecheck/test, QA visuale senza Xcode, QA DB con PGlite, trappole |
| `../.claude/CLAUDE.md` | vivo | Regole operative e design system |

## Regole di prodotto e di stile

| Documento | Stato | A cosa serve |
| --- | --- | --- |
| [`mobile-ux-ui-guidelines.md`](./mobile-ux-ui-guidelines.md) | vivo | Linee guida UX/UI mobile |
| [`mobile-button-system.md`](./mobile-button-system.md) | vivo | Varianti e uso dei bottoni |
| [`react-best-practices.md`](./react-best-practices.md) | vivo | Convenzioni React/hook |
| [`supabase-best-practices.md`](./supabase-best-practices.md) | vivo | Convenzioni query, RLS, RPC |
| [`supabase-setup.md`](./supabase-setup.md) | vivo | Setup ambiente Supabase |
| [`technical-architecture.md`](./technical-architecture.md) | parziale | Stack e scelte di base; la struttura attuale è in `feature-map.md` |
| [`product-requirements.md`](./product-requirements.md) | storico | Visione iniziale del prodotto |

## Dashboard (backlog attivo)

| Documento | Stato | A cosa serve |
| --- | --- | --- |
| [`dashboard-common-contract.md`](./dashboard-common-contract.md) | vivo | DAS-REV-00: contratto normativo di tutte le task Dashboard |
| [`dashboard-recognition-map.md`](./dashboard-recognition-map.md) | storico | Ricognizione repo al 2026-10-09, prima di DAS-REV-01 |
| [`dashboard-rev01-rev02-plan.md`](./dashboard-rev01-rev02-plan.md) | storico | Piano dei primi due pack |
| `dashboard-rev01/02/03/06-delivery.md` | storico | Note di consegna dei soli pack 01, 02, 03, 06 |

> Dalla DAS-REV-07 in poi non ci sono note di consegna in `docs/`. Il *perché*
> di ogni scelta sta nel commento di testa della migrazione corrispondente in
> `supabase/migrations/` e nel messaggio di commit. Sono lunghi apposta.

## Storici — non usarli come stato attuale

| Documento | Perché |
| --- | --- |
| [`implementation-roadmap.md`](./implementation-roadmap.md) | Fotografa il repository di marzo 2026, quando solo Profilo era avviato. Oggi onboarding, profili, rete, ricerca e gran parte della Dashboard sono consegnati. |
| [`mvp-backlog.md`](./mvp-backlog.md) | Backlog MVP iniziale, sostituito da Freedcamp. |
| [`database-schema.md`](./database-schema.md) | Descrive il primo slice di schema. Oggi le migrazioni sono ~157. |

Per lo stato reale: [`backlog-state.md`](./backlog-state.md) e le migrazioni.
