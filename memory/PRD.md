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

## User Language
Indonesian (Bahasa Indonesia)

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Backend**: Python FastAPI + MongoDB
- **Auth**: Supabase Google OAuth
- **AI**: Google Gemini API (gemini-2.5-flash) - user-provided keys, stored in localStorage

## Core Features

### Completed Features
1. **Supabase Google Auth** - OAuth login flow (DONE)
2. **5-Step SOAP Wizard** - Anamnesis, Physical Exam, Assessment, Planning, Final SOAP (DONE)
3. **Gemini API Key Setup** - Per-user, deferred validation (DONE)
4. **Whitelist Management** - Bypass mode, email expiry, CRUD (DONE)
5. **Access Denied Page** - Kicks out non-whitelisted users (DONE)
6. **Admin Prompt Editor** - Edit/reset system prompts for anam/oppa/diag/palui (DONE, TESTED)
7. **Rate Limiting** - Max 3 wrong password attempts in 24h (DONE, TESTED)
8. **Reset Timer** - Reset lockout with password, own 3-attempt limit (DONE, TESTED)

### Pending Tasks (P1)
- Data persistence validation (MongoDB is being used - verify restart resilience)
- SOAP document history for reviewing previous sessions
- Export SOAP to PDF

### Future Tasks (P2)
- Log monitor (who logged in, whitelist expiry tracking)

## Key API Endpoints
- `POST /api/whitelist/verify-password` - Admin password verification with rate limiting
- `POST /api/whitelist/reset-timer` - Reset lockout timer
- `GET /api/whitelist/password-status/{client_id}` - Check lockout status
- `GET/POST /api/whitelist/emails` - Whitelist email CRUD
- `DELETE /api/whitelist/emails/{email}` - Remove email
- `GET/POST /api/whitelist/bypass` - Bypass mode settings
- `GET /api/whitelist/check/{email}` - Check if email is whitelisted
- `GET /api/prompts` - Get all system prompts
- `POST /api/prompts` - Update prompt
- `POST /api/prompts/reset/{agent_id}` - Reset prompt to default

## Key Files
- `/app/backend/server.py` - All backend logic
- `/app/frontend/src/App.js` - Monolithic frontend (~2100 lines)
- `/app/frontend/src/lib/supabase.js` - Supabase config

## Testing Status
- Iteration 1 & 2: Basic whitelist features
- Iteration 3: Rate limiting, reset timer, prompt editor - ALL PASSED (23/23 backend, 100% frontend)

## Known Issues
- `App.js` is >2100 lines and needs refactoring into components
- DialogContent missing aria-describedby (accessibility, LOW priority)

## Admin Password
- Password: `buriead`
- Backend-only validation
- 3 wrong attempts = 24h lockout
- Reset timer: same password, 3 reset attempts max
