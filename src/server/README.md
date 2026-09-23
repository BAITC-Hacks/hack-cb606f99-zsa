# Server boundary

Only server-side code belongs here. Client Components must not import this folder.

- `ai/` — prompt templates, provider adapters and response parsing.
- `domain/` — deterministic readiness scoring and explanations.
- `repositories/` — JSON persistence behind repository interfaces.
- `services/` — application use cases, confirmation and state-transition rules.
- `env.ts` — validated server-only environment variables.
- `bootstrap.ts` — server-only composition root for repository, platform and AI services.
- `http.ts` — bounded JSON requests and consistent error responses.

Public request and response schemas live in `src/shared`, not in this folder.

Services receive their dependencies explicitly. Domain, storage and AI tests run without Next.js or live API credentials. JSON transactions use an exclusive filesystem lock and atomic rename. AI never writes data, confirms fields, publishes tasks, or chooses teams. This is a local demo backend without authentication; see `docs/API.md` and the root README for integration and deployment limitations.
