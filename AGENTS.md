# AGENTS.md

## Project Overview

AI Medical Squad is deployed as a single Vercel project with multiple services:

- `frontend/`: React + Vite SPA
- `backend/`: FastAPI service mounted at `/api`
- `Supabase`: authentication, SOAP history, admin data, system prompts, and per-user Oppa template preferences

The current architecture intentionally removes Emergent lock-in. Do not reintroduce platform-specific dependencies unless explicitly requested.

## Repository Layout

- `frontend/`: client application, Vite config, Tailwind config, Supabase browser client
- `backend/`: FastAPI app, admin endpoints, prompt storage, Supabase service-role access
- `supabase_migration.sql`: authoritative SQL migration for required database tables and policies
- `vercel.json`: Vercel Services routing config
- `README.md`: deployment and environment setup

## Frontend Rules

- Keep the frontend on Vite. Do not revert to CRA, `react-scripts`, or `craco`.
- Treat `frontend/package.json` as ESM. Config files in `frontend/` should use ESM syntax or the correct file extension.
- JSX-bearing source files should use `.jsx`.
- Frontend environment variables must use the `VITE_` prefix.
- Prefer loading shared configuration data once during app startup rather than refetching it before every AI action.

## Backend Rules

- Keep backend routes compatible with the current admin panel behavior.
- Supabase is the source of truth for backend persistence.
- Backend-only secrets such as `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the frontend.
- The system prompt registry currently includes:
  - `anam`
  - `oppa`
  - `diag`
  - `palui`
  - `smart`

If a new editable shared prompt is added, update both backend prompt handling and the frontend admin editor.

## Prompt System Rules

- Shared prompts belong in backend storage via the `system_prompts` table.
- Admin-editable prompts should not remain hardcoded in the frontend unless they are only temporary fallbacks.
- User-specific preferences should be stored per account, not only in browser storage.
- `SMART` is treated as a shared/admin-managed prompt.
- Oppa normal template preferences are user-specific and belong in `user_preferences`.

## Supabase And Data Rules

- Schema changes should be reflected in `supabase_migration.sql`.
- Use `auth.users.id` as the basis for per-user data.
- Keep row-level security in mind when introducing user-owned tables.
- Do not move persisted user preferences back to localStorage-only storage if a Supabase-backed path already exists.
- Local storage may be used as a cache or fallback, but not as the only durable source for account-level settings.

## Deployment Rules

- Target deployment is Vercel, using the `Services` framework preset.
- Frontend should be served from `/`.
- FastAPI should remain available under `/api`.
- Keep frontend and backend environment variable responsibilities separate:
  - frontend: `VITE_*`
  - backend: secret and service variables

## Safe Change Checklist

Before shipping changes, verify the following when relevant:

- Vite build assumptions still hold.
- Backend routes still match frontend calls.
- Supabase schema and policies still match the code.
- New editable prompts are wired through admin UI, backend APIs, and persistence.
- Per-user settings remain tied to authenticated users.
- Vercel routing still maps frontend and backend correctly.

## Do Not Do

- Do not reintroduce Emergent-specific deployment assumptions.
- Do not hardcode admin-editable prompts in the frontend as the primary source of truth.
- Do not expose service-role keys or other backend secrets to the client.
- Do not store important per-user medical workflow preferences only in browser storage when Supabase persistence exists.
- Do not change `vercel.json` routes casually; frontend `/` and backend `/api` are intentional.
