# AI Medical Squad - Product Requirements Document

## Original Problem Statement
Convert a React-based "AI Medical Squad" script (medical data -> SOAP format via Gemini API) into a Single Page Application with full medical documentation workflow.

## User Language
Indonesian (Bahasa Indonesia)

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: Python FastAPI + MongoDB
- **Auth**: Supabase Google OAuth
- **AI**: Google Gemini API (gemini-2.5-flash) - user-provided keys
- **History Storage**: Supabase PostgreSQL (soap_history table)

## Completed Features
1. Supabase Google Auth (DONE)
2. 5-Step SOAP Wizard - Anamnesis, Physical Exam, Assessment, Planning, Final SOAP (DONE)
3. Gemini API Key Setup - per-user, deferred validation (DONE)
4. Whitelist Management - bypass mode, email expiry, CRUD (DONE)
5. Access Denied Page (DONE)
6. Admin Prompt Editor - edit/reset system prompts for 4 agents (DONE, TESTED)
7. Rate Limiting - max 3 wrong password in 24h (DONE, TESTED)
8. Reset Timer - reset lockout with same password, 3-attempt limit (DONE, TESTED)
9. Sticky Input Form - Anamnesis input sticks to bottom while scrolling (DONE)
10. Auto-select Vital Signs - click on input selects all text (DONE)
11. History - last 7 SOAP documents per user, stored in Supabase (DONE, needs table setup)
12. Profile Modal - Google avatar, name, Free/Premium status (DONE)
13. SMART Assistant - Multi-turn AI chat for ER doctors after SOAP generation (DONE)
    - Yellow WARNING icon below Final SOAP
    - Hover shows "Klik Untuk Menanyakan Apapun!"
    - Multi-turn conversation with full SOAP context
    - Image upload support (EKG, X-ray, photos)
    - Detailed medical system prompt for ER assistance

## IMPORTANT: User Action Required
- History feature requires Supabase table. Run SQL from `/app/supabase_migration.sql` in Supabase Dashboard > SQL Editor.

## Pending Tasks (P1)
- Export SOAP to PDF

## Future Tasks (P2)
- Log monitor (who logged in, whitelist expiry tracking)

## Key API Endpoints
- `POST /api/whitelist/verify-password` - Admin password with rate limiting
- `POST /api/whitelist/reset-timer` - Reset lockout timer
- `GET/POST /api/whitelist/emails` - Whitelist email CRUD
- `DELETE /api/whitelist/emails/{email}` - Remove email
- `GET/POST /api/whitelist/bypass` - Bypass mode
- `GET /api/whitelist/check/{email}` - Check whitelist
- `GET/POST /api/prompts` - System prompts CRUD
- `POST /api/prompts/reset/{agent_id}` - Reset prompt

## Key Files
- `/app/backend/server.py` - All backend logic
- `/app/frontend/src/App.js` - Frontend (~2600 lines)
- `/app/frontend/src/lib/supabase.js` - Supabase config
- `/app/supabase_migration.sql` - SQL for soap_history table

## Testing Status
- Iterations 1-5: ALL PASSED (23/23 backend, 100% frontend)

## Admin Password: `buriead` (backend-validated, 3 wrong = 24h lockout)
