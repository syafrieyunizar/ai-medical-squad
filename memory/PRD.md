# AI Medical Squad - PRD (Product Requirements Document)

## Original Problem Statement
Membuat Single Page Application dari kode React "AI Medical Squad" - aplikasi untuk dokter yang membantu membuat catatan SOAP (Subjective, Objective, Assessment, Planning) untuk dokumentasi medis.

## User Personas
1. **Dokter Umum** - Primary user yang membutuhkan dokumentasi SOAP cepat untuk konsultasi
2. **Dokter IGD** - Memerlukan format terstruktur untuk laporan pasien via WhatsApp

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

## What's Been Implemented (Jan 2026)
- [x] Login page dengan Google OAuth (Supabase)
- [x] API Key setup page untuk Gemini API key per user
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

## Architecture
- **Frontend**: React (CRA with Craco), Tailwind CSS, shadcn/ui components
- **Backend**: FastAPI (minimal, Supabase handles auth)
- **Database**: Supabase (PostgreSQL for auth, localStorage for settings)
- **AI**: Gemini 2.5 Flash API (user's own key)
- **Auth**: Supabase Google OAuth

## Prioritized Backlog

### P0 (Critical)
- [x] Complete all 5 SOAP steps
- [x] Google OAuth login

### P1 (Important)
- [ ] Persist patient sessions to Supabase database
- [ ] History of previous SOAP documents
- [ ] Export to PDF

### P2 (Nice to have)
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Voice input for anamnesis
- [ ] Template presets for common conditions

## Next Tasks
1. Configure Supabase Google OAuth provider properly (user needs to set up in Supabase dashboard)
2. Test with real Gemini API key
3. Add data persistence to Supabase database for patient records
