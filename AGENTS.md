# Repository Guidelines

## Project Structure & Module Organization

This repository uses npm workspaces. The active app lives in `apps/mobile`, a React Native + Expo project with Expo Router screens under `apps/mobile/app` and feature code under `apps/mobile/src/features`. Shared UI primitives live in `apps/mobile/src/ui`, reusable helpers in `apps/mobile/src/lib`, and design tokens in `apps/mobile/src/styles` and `apps/mobile/src/theme`. Tests usually sit next to the code they cover as `*.test.ts` or `*.test.tsx`. Database changes belong in `supabase/migrations`; setup notes and product/architecture docs live in `docs/`.

Start from `docs/README.md`: it labels each document as live or historical. The three that matter before touching code are `docs/backlog-state.md` (what is done and what is next), `docs/feature-map.md` (where a domain lives and which modules are legacy) and `docs/verification-playbook.md` (how to verify, and the traps).

## Build, Test, and Development Commands

- `npm install`: install workspace dependencies from the repo root.
- `npm run dev:mobile` or `npm start`: start the Expo app.
- `npm run start:mobile:clear`: restart Expo with a cleared cache.
- `npm run lint`: run ESLint for the mobile workspace.
- `npm run typecheck`: run TypeScript with `--noEmit`.
- `npm test`: run the Vitest suite once.
- `npm run supabase:db:push`: apply local migrations.
- `npm run supabase:db:reset`: rebuild the local Supabase database from migrations and seed data.

Use Node `>=20.11.0` and npm `>=10`, matching the root `package.json`.

## Coding Style & Naming Conventions

Use TypeScript, 2-space indentation, semicolons, and double quotes, matching the existing source. Prefer functional React components and keep feature logic close to the screen or component that uses it. Treat `react-hooks/exhaustive-deps` as mandatory. Avoid new cross-feature barrel files; import feature modules directly. Use `PascalCase` for components (`PlayerSearchCard.tsx`), `camelCase` for helpers (`slugify.ts`), and descriptive service files such as `profile-service.ts`.

## Testing Guidelines

Vitest is the test runner for unit and component tests. Name tests `*.test.ts` or `*.test.tsx` and keep them beside the implementation. Focus coverage on feature services, form logic, and reusable UI behavior. Run `npm test` before opening a PR; add targeted tests when changing onboarding, auth, messaging, profiles, or Supabase-facing services.

## Commit & Pull Request Guidelines

Commits are named after the Freedcamp task they close, e.g. `DAS-REV-23 - Lifecycle e permessi Candidature`. Older history used Conventional Commits (`feat(onboarding): ...`); follow the task-code form for new work. 
## Security & Configuration Tips

Do not commit secrets. Use `apps/mobile/.env.example` as the template for local environment variables. Review Supabase migrations carefully before pushing, and keep documentation in `docs/` updated when workflows or schema assumptions change.
