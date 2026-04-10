# AI Medical Squad - PRD (Product Requirements Document)

## Original Problem Statement
Membuat Single Page Application dari kode React "AI Medical Squad" - aplikasi untuk dokter yang membantu membuat catatan SOAP (Subjective, Objective, Assessment, Planning) untuk dokumentasi medis.

## User Personas
1. **Dokter Umum** - Primary user yang membutuhkan dokumentasi SOAP cepat untuk konsultasi
2. **Dokter IGD** - Memerlukan format terstruktur untuk laporan pasien via WhatsApp
3. **Admin** - Mengelola whitelist user yang dapat mengakses aplikasi

## Core Requirements (Static)
- Login dengan Google Authentication (Supabase)
- Setiap user menyimpan API key Gemini mereka sendiri
- 5-Step Wizard untuk SOAP:
  1. Anamnesis (S) - AI mengolah keluhan menjadi narasi terstruktur
  2. Pemeriksaan Fisik (O) - Mode AI dan Manual untuk status generalis
  3. Assessment (A) - Upload foto penunjang, AI memberikan interpretasi dan diagnosis
  4. Planning (P) - Autotext expansion, AI merapikan format terapi
  5. Final SOAP - Generate dokumen lengkap untuk konsultasi
- Settings: Autotext dictionary, greeting template, WhatsApp number
- Copy to clipboard dan Send via WhatsApp
- Whitelist management dengan bypass mode

## What's Been Implemented (Jan 2026)
- [x] Login page dengan Google OAuth (Supabase)
- [x] API Key setup page dengan Sign Out button
- [x] Modern UI dengan desain Organic & Earthy theme
- [x] 5-Step SOAP Wizard dengan navigasi lengkap
- [x] Step 1: Anamnesis dengan AI processing dan saran penggalian
- [x] Step 2: Pemeriksaan Fisik (AI/Manual mode) dengan image upload
- [x] Step 3: Assessment dengan upload penunjang (EKG/Lab/Rontgen)
- [x] Step 4: Planning dengan autotext dan AI formatting
- [x] Step 5: Final SOAP generation dengan WhatsApp sharing
- [x] Settings dialog (greeting, WhatsApp number, autotext)
- [x] New Session reset functionality
- [x] localStorage persistence untuk settings dan API key

### Whitelist Management (Jan 2026)
- [x] Add Whitelist button di login page
- [x] Password modal dengan validasi di backend (password tidak di frontend)
- [x] Whitelist Management modal:
  - [x] Bypass mode toggle dengan durasi (lifetime/custom datetime)
  - [x] Add email ke whitelist dengan durasi (lifetime/custom datetime)
  - [x] List email terdaftar dengan status (active/expired)
  - [x] Delete email dari whitelist
- [x] Access Denied page untuk non-whitelist users
- [x] Whitelist check pada setiap action di main app
- [x] Auto-expire bypass dan whitelist berdasarkan datetime

## Architecture
- **Frontend**: React (CRA with Craco), Tailwind CSS, shadcn/ui components
- **Backend**: FastAPI dengan MongoDB
- **Database**: 
  - Supabase (PostgreSQL for auth)
  - MongoDB (whitelist, bypass settings)
  - localStorage (user settings, API key)
- **AI**: Gemini 2.5 Flash API (user's own key)
- **Auth**: Supabase Google OAuth

## API Endpoints
- `POST /api/whitelist/verify-password` - Verify admin password
- `GET /api/whitelist/emails` - Get all whitelisted emails
- `POST /api/whitelist/emails` - Add email to whitelist
- `DELETE /api/whitelist/emails/{email}` - Remove email
- `GET /api/whitelist/bypass` - Get bypass status
- `POST /api/whitelist/bypass` - Set bypass status
- `GET /api/whitelist/check/{email}` - Check if email is whitelisted

## Prioritized Backlog

### P0 (Critical)
- [x] Complete all 5 SOAP steps
- [x] Google OAuth login
- [x] Whitelist management

### P1 (Important)
- [ ] Persist patient sessions to database
- [ ] History of previous SOAP documents
- [ ] Export to PDF

### P2 (Nice to have)
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Voice input for anamnesis
- [ ] Template presets for common conditions

## Next Tasks
1. Add data persistence to database for patient records
2. Implement SOAP history feature
3. Add PDF export functionality
