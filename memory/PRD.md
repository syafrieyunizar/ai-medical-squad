# AI Medical Squad - Product Requirements Document

## Original Problem Statement
Convert a React-based "AI Medical Squad" script (medical data -> SOAP format via Gemini API) into a Single Page Application with full medical documentation workflow.

## User Language: Indonesian (Bahasa Indonesia)

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: Python FastAPI + MongoDB
- **Auth**: Supabase Google OAuth
- **AI**: Google Gemini API (gemini-2.5-flash) - user-provided keys
- **History Storage**: Supabase PostgreSQL (soap_history table)

## Completed Features
1. Supabase Google Auth (DONE)
2. 5-Step SOAP Wizard (DONE)
3. Gemini API Key Setup - per-user, deferred validation (DONE)
4. Whitelist Management - bypass mode, email expiry, CRUD (DONE)
5. Access Denied Page (DONE)
6. Admin Prompt Editor - edit/reset system prompts (DONE, TESTED)
7. Rate Limiting - max 3 wrong password in 24h (DONE, TESTED)
8. Reset Timer - reset lockout with same password (DONE, TESTED)
9. Sticky Input Form - Anamnesis (DONE)
10. Auto-select Vital Signs (DONE)
11. History - last 7 SOAP documents via Supabase (DONE, needs table setup)
12. Profile Modal - Google avatar, Free/Premium (DONE)
13. SMART Assistant - FAB, multi-turn chat, image upload (DONE)
14. Per-user Settings - greeting, autotexts, WA number stored per Google account (DONE)
15. Status Generalis Template - save/load custom format, AI follows saved format (DONE)
16. SMART Improvements - Reset Session button, messages persist on close, **bold** rendering (DONE)

## User Action Required
- Run SQL from `/app/supabase_migration.sql` in Supabase Dashboard > SQL Editor for History feature

## Pending Tasks (P1)
- Export SOAP to PDF

## Future Tasks (P2)
- Log monitor (who logged in, whitelist expiry tracking)

## Key Files
- `/app/backend/server.py` - Backend logic
- `/app/frontend/src/App.js` - Frontend (~2700 lines)
- `/app/frontend/src/lib/supabase.js` - Supabase config
- `/app/supabase_migration.sql` - SQL for soap_history

## Testing: Iterations 1-6 ALL PASSED
## Admin Password: `buriead` (backend-validated, 3 wrong = 24h lockout)
