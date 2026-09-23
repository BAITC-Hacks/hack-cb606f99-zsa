# Server boundary

Only server-side code belongs here. Client Components must not import this folder.

- `ai/` — prompt templates, provider adapters and response parsing.
- `domain/` — scoring and state-transition rules.
- `repositories/` — JSON persistence behind repository interfaces.
- `services/` — application use cases used by Route Handlers.
- `env.ts` — validated server-only environment variables.

Public request and response schemas live in `src/shared`, not in this folder.
