# AI Medical Squad - Product Requirements Document

## Original Problem Statement
Convert a React-based "AI Medical Squad" script (medical data -> SOAP format via Gemini API) into a Single Page Application with:
1. Google Auth login using Supabase
2. Per-user Gemini API keys (gemini-2.5-flash), validated only on AI invocation
3. Modern UI redesign for 5-step wizard
4. Python FastAPI Backend for Whitelist Management System
5. Whitelist features: Protected "Add Whitelist" modal (Password: `buriead`, backend-validated), Bypass mode toggle, email whitelisting with duration/expiry, Access Denied page
6. Protected Admin page inside Whitelist modal to manually edit AI System Prompts
7. Security: Max 3 wrong password attempts in 24h, reset timer with same password (also 3-attempt limit)
8. Sticky input form in Anamnesis step
9. Auto-select on vital signs input click
10. History feature (last 7 patients, stored in Supabase)
11. Profile modal (Google avatar, Free/Premium status)

## User Language
Indonesian (Bahasa Indonesia)

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: Python FastAPI + MongoDB
- **Auth**: Supabase Google OAuth
- **AI**: Google Gemini API (gemini-2.5-flash) - user-provided keys, stored in localStorage
- **History Storage**: Supabase PostgreSQL (soap_history table)

## Core Features

### Completed Features
1. Supabase Google Auth (DONE)
2. 5-Step SOAP Wizard (DONE)
3. Gemini API Key Setup - per-user, deferred validation (DONE)
4. Whitelist Management - bypass mode, email expiry, CRUD (DONE)
5. Access Denied Page (DONE)
6. Admin Prompt Editor - edit/reset system prompts (DONE, TESTED)
7. Rate Limiting - max 3 wrong password in 24h (DONE, TESTED)
8. Reset Timer - reset lockout with password, 3-attempt limit (DONE, TESTED)
9. Sticky Input Form - Anamnesis input sticks to bottom while scrolling (DONE)
10. Auto-select Vital Signs - click on input selects all text (DONE)
11. History - last 7 SOAP documents per user, stored in Supabase (DONE, needs table setup)
12. Profile Modal - Google avatar, name, Free/Premium status (DONE)

### IMPORTANT: User Action Required
The History feature requires a Supabase table. Run the SQL in `/app/supabase_migration.sql` via Supabase Dashboard > SQL Editor.

### Pending Tasks (P1)
- Export SOAP to PDF

### Future Tasks (P2)
- Log monitor (who logged in, whitelist expiry tracking)

## Key API Endpoints
- `POST /api/whitelist/verify-password` - Admin password with rate limiting
- `POST /api/whitelist/reset-timer` - Reset lockout timer
- `GET /api/whitelist/password-status/{client_id}` - Lockout status
- `GET/POST /api/whitelist/emails` - Whitelist email CRUD
- `DELETE /api/whitelist/emails/{email}` - Remove email
- `GET/POST /api/whitelist/bypass` - Bypass mode
- `GET /api/whitelist/check/{email}` - Check whitelist
- `GET /api/prompts` - Get all system prompts
- `POST /api/prompts` - Update prompt
- `POST /api/prompts/reset/{agent_id}` - Reset prompt

## Key Files
- `/app/backend/server.py` - All backend logic
- `/app/frontend/src/App.js` - Frontend (~2300 lines)
- `/app/frontend/src/lib/supabase.js` - Supabase config
- `/app/supabase_migration.sql` - SQL for soap_history table

## Testing Status
- Iteration 3: Rate limiting, reset timer, prompt editor - ALL PASSED
- Iteration 4: Regression + new features verification - ALL PASSED (23/23 backend, 100% frontend)

## Admin Password
- Password: `buriead`
- Backend-only validation
- 3 wrong attempts = 24h lockout
- Reset timer: same password, 3 reset attempts max
