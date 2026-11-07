# ProLink

The new footballers' portal.

## Stack iniziale

- Mobile: React Native con Expo e TypeScript
- Backend: Supabase
- Repository structure: npm workspaces con app mobile in `apps/mobile`

## Quickstart

Prerequisiti:

- Node.js 20+
- npm 10+

Bootstrap locale:

```bash
npm install
npm run dev:mobile
```

Documenti di riferimento:

Parti da [`docs/README.md`](docs/README.md), che indicizza tutto e segnala cosa è
aggiornato e cosa è storico. I tre documenti da leggere prima di toccare il
codice:

- [`docs/backlog-state.md`](docs/backlog-state.md) - stato del backlog e come si legge una task
- [`docs/feature-map.md`](docs/feature-map.md) - dove vive ogni dominio e convenzioni di modulo
- [`docs/verification-playbook.md`](docs/verification-playbook.md) - come si verifica una modifica
