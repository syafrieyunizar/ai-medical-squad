# AI Medical Squad

Repo ini sudah dirapikan agar bisa dideploy ke Vercel dengan arsitektur:

- `frontend/`: React + Vite
- `backend/`: FastAPI sebagai Vercel service di route `/api`
- `Supabase`: auth, penyimpanan riwayat SOAP, whitelist, bypass, password attempts, dan system prompts

## Environment Variables

Frontend (`frontend/.env` atau Vercel Project Environment Variables):

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_BACKEND_URL=
```

Catatan:
- Kosongkan `VITE_BACKEND_URL` di Vercel agar frontend memanggil backend relatif ke `/api`.
- Untuk local dev terpisah, isi misalnya `http://localhost:8000`.

Backend (`backend/.env` atau Vercel Project Environment Variables):

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_PASSWORD=buriead
CORS_ORIGINS=*
```

## Setup Supabase

1. Buka Supabase SQL Editor.
2. Jalankan isi file `supabase_migration.sql`.
3. Pastikan Supabase Auth aktif karena tabel `soap_history` mereferensi `auth.users`.

## Deploy ke Vercel

1. Import repo ini ke Vercel.
2. Di Project Settings, set Framework Preset ke `Services`.
3. Tambahkan seluruh environment variables frontend dan backend.
4. Deploy.

## Local Development

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload
```
