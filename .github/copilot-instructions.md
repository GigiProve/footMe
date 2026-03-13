# Project Guidelines

## Product Source Of Truth

- The product brief lives in [docs/product-requirements.md](../docs/product-requirements.md).
- The phased delivery plan lives in [docs/implementation-roadmap.md](../docs/implementation-roadmap.md).
- The technical architecture lives in [docs/technical-architecture.md](../docs/technical-architecture.md).
- The UX/UI reference for mobile patterns lives in [docs/mobile-ux-ui-guidelines.md](../docs/mobile-ux-ui-guidelines.md).
- The React/React Native engineering guidance lives in [docs/react-best-practices.md](../docs/react-best-practices.md).
- The Supabase/Postgres engineering guidance lives in [docs/supabase-best-practices.md](../docs/supabase-best-practices.md).
- For product explanations and feature planning, use [.github/instructions/project-scope.instructions.md](./instructions/project-scope.instructions.md) before making assumptions.

## Working Rules

- footMe is a mobile-first product for iOS and Android in the current scope.
- Do not assume a web version is part of the current delivery unless the user explicitly asks for it.
- Do not invent undocumented features, roles, constraints, or business rules.
- If requirements are incomplete, ask focused questions and convert uncertainty into explicit decisions.
- When editing React or React Native code, follow [docs/react-best-practices.md](../docs/react-best-practices.md), especially for async loading, hook dependencies, state colocations, and render performance.
- When editing Supabase schema, RLS policies, SQL helpers, or client queries, follow [docs/supabase-best-practices.md](../docs/supabase-best-practices.md), especially for RLS, migrations, indexing, overfetching, and service-role boundaries.

## Planning Guidance

- When asked to break down work, organize it as a company-style delivery plan with phases, epics, deliverables, dependencies, and exit criteria.
- Prefer MVP sequencing before advanced modules such as full social expansion, merchandising, or non-critical automation.
- Keep proposals aligned with the current maturity of the repository.

## Repository State

- The repository is currently documentation-first and may not yet contain implementation code.
- A mobile scaffold now exists under `apps/mobile`, but dependency installation requires Node 20+.
- Do not assume build, test, or run commands exist until local prerequisites are satisfied.
