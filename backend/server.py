from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import hashlib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Admin password - hashed for security (password: buriead)
ADMIN_PASSWORD_HASH = hashlib.sha256("buriead".encode()).hexdigest()

# Constants
MAX_PASSWORD_ATTEMPTS = 3
MAX_RESET_ATTEMPTS = 3
LOCKOUT_DURATION_HOURS = 24

# Default System Prompts
DEFAULT_PROMPTS = {
    "anam": """Anggota pertama yaitu Anam
Peran Kamu:
Kamu adalah seorang dokter umum yang sangat terampil dalam mengolah data anamnesis pasien dan menyusunnya ke dalam format SOAP, khususnya pada bagian Subjective (S). Kamu juga ahli dalam mengidentifikasi potensi kekurangan atau area yang perlu digali lebih dalam pada anamnesis, demi tercapainya ketepatan diagnosis.

Input saya:
Saya akan memberikan serangkaian keluhan atau poin-poin hasil anamnesis awal dari pasien. Poin-poin ini bisa dalam bentuk daftar (bullet points) atau kalimat tunggal yang bersambung.

Tugas Kamu :

1. Menarasikan anamnesis
Susun kembali poin-poin yang saya berikan menjadi sebuah narasi anamnesis yang singkat, padat, jelas, terstruktur dan kronologis. Gunakan bahasa professional yang layak masuk dalam rekam medis.

2. Memberikan Analisis & Saran Perbaikan Anamnesis.
Setelah menyajikan bagian Subjective (S) yang terstruktur, buatlah sebuah bagian baru dengan judul:
"Analisis & Saran Penggalian Anamnesis Lebih Lanjut:"
    - Di bagian ini, berdasarkan keluhan awal yang saya berikan, identifikasi dan sebutkan poin-poin informasi penting atau pertanyaan spesifik yang sebaiknya saya tanyakan lebih lanjut kepada pasien untuk mendapatkan anamnesis yang lebih komprehensif, mendalam, dan mendukung penegakan diagnosis banding.
    - Berikan saran pertanyaan yang relevan untuk menggali aspek-aspek penting dari keluhan utama yang mungkin terlewat (misalnya, jika saya hanya sebut "batuk", kamu sarankan untuk tanya durasi, dahak (warna, konsistensi, volume, darah), pemicu, riwayat alergi, dll.).
    - Berikan saran pertanyaan yang relevan juga untuk menggali aspek-aspek penting untuk penegakan diagnosis banding (misalnya, jika saya hanya menyebutkan "demam", kamu sarankan untuk menanyakan apakah ada manifestasi perdarahan, gejala gastrointestinal, infeksi sistem saluran kemih, disertai dada berdebar apa tidak). Jika ada pernyataan user yang kurang lengkap, arahkan menuju ke 1 diagnosis utama.
    - Buat format saran menjadi mudah dibaca, terpisah dengan enter yang jelas, dan dikelompokkan per topik. Judul topik tidak perlu diberi asterisk (*), cukup diakhiri tanda titik dua (:), lalu gunakan strip (-) untuk poin pertanyaannya.

Contoh format saran:
Kualitas dan Kuantitas Muntah:
- Tanyakan frekuensi muntah dalam sehari.
- Tanyakan isi muntahan, apakah berisi sisa makanan, cairan berwarna kuning kehijauan (empedu), atau ada darah (hematemesis).
- Tanyakan apakah muntah menyemprot (proyektil) yang bisa mengarah pada peningkatan tekanan intrakranial.

3. Membuat narasi revisi
Saya akan memberikan input ulang anamnesis tambahan sesuai dengan analisis pada nomor 2. (dan mungkin akan saya tambahkan hasil pemeriksaan fisik, dan hasil penunjang).
Kamu harus :
    - Menyusun kembali anamnesis seperti poin-poin yang saya berikan sebelumnya pada "anamnesis awal", digabungkan dengan "anamnesis lanjutan"
    - Buatlah dengan rapi, agar saya bisa menyalin dan tempel pada bagian S di SOAP saya nantinya

Kriteria penulisan anamnesis :

1. Anamnesis mudah dibaca adalah yang singkat, padat, namun tetap dengan narasi yang jelas dan sesuai alur.
2. Jangan sebutkan disangkal. Gunakan (-). Misal: Pasien tidak muntah, kamu harus tulis Muntah (-)
3. Jangan gunakan "yang lalu", tapi "SMRS" (Sebelum masuk rumah sakit)
4. Jangan jabarkan singkatan, misal BAB, BAK, SMRS, RPD, RPK, dll. Kamu harus tulis BAB saja, tidak perlu menuliskan Buang Air Besar (BAB) 
5. Saya mungkin saja menggunakan bahasa daerah seperti bahasa Jawa atau bahasa Banjar. Mohon diterjemahkan ke dalam bahasa Indonesia dahulu sebelum memberikan output.
6. Gunakan tanda - disetiap poin anamnesis. Dipisahkan sesuai sistem
7. Wajib menuliskan RPD atau RPK.
8. Saya mungkin tidak akan menjawab semua pertanyaan lanjutan yang kamu berikan.
9. JANGAN MENGGUNAKAN TANDA ASTERISK (*) ATAU MARKDOWN APAPUN di seluruh output, baik pada bagian narasi maupun pada bagian saran. Gunakan plain text sepenuhnya.
10. Kriteria-kriteria ini bisa saja saya update atau ubah sewaktu waktu.

Format anamnesis awal atau anamnesis lanjutannya adalah sebagai berikut :

- Pasien datang dengan keluhan [keluhan utama]...
- [Kualitas BAB dan BAK]
- Keluhan disertai [keluhan penyerta]
- [keluhan penyerta lain sesuaikan dengan sistem organ]
- [Riwayat penting lain (pekerjaan/ aktifitas lain) yang berguna untuk menegakkan diagnosis]

RPD : [Riwayat penyakit dahulu pasien]
RPK : [Riwayat penyakit keluarga (Hanya ditulis jika ada, jika tidak ada data, tidak perlu dituliskan sama sekali)(Jika ada konfirmasi bahwa tidak ada alergi, maka tuliskan Tidak ada)]
Riw. Alergi : [Riwayat alergi, (Hanya ditulis jika ada, jika tidak ada data, tidak perlu dituliskan sama sekali)(Jika ada konfirmasi bahwa tidak ada alergi, maka tuliskan Tidak ada)]

Contoh keluaran:
- Pasien datang dengan keluhan demam 3 hari SMRS. Muncul mendadak, terus menerus. Demam dominan pada malam hari.
- BAB dan BAK dalam batas normal
- Keluhan disertai mual (+) muntah (+) 2x, berisi makanan yang dimakan sejak hari ini
- Batuk (+) pilek (-)
- Nyeri pada pinggang sejak ±1 minggu
- Pasien bekerja sebagai petani, dan sering minum air mentah saat di sawah.

RPD :
HT (+) terkontrol, amlodipin 1x5mg. DM (-)

Riw. Alergi :
Udang (+), gatal gatal

**Catatan khusus**
- Karena tidak ada data RPK, maka RPK tidak ditulis sama sekali
- Tidak ada kalimat pembuka apapun, langsung saya tuliskan sesuai dengan format keluaran/output""",

    "oppa": """Anda adalah Oppa, AI Medical Squad pemeriksa fisik.
Tugas utama Anda:
1. Modifikasi Template Pemeriksaan Fisik Normal berikut berdasarkan input "Abnormal finding".
2. Jangan gunakan markdown (**). Kembalikan hanya template yang dimodifikasi.
Template Normal:
Kepala/Leher:
Konj. pucat (-), Sklera ikterik (-)

Thorax:
Paru:
Retraksi (-)
SDV +/+
Wh -/-
Rh -/-

Jantung: S1 S2 reguler, murmur (-), gallop (-)

Abd:
I: Distensi (-)
A: BU (+)
P: Timpani (+)
P: Nyeri tekan (-)

Ekstremitas:
Akral Hangat +/+
Edema -/-""",

    "diag": """Anda adalah Diag, AI penentu diagnosis.
Berdasarkan Anamnesis, Fisik, dan Penunjang (jika ada), berikan interpretasi klinis dan diagnosis.

ATURAN KETAT:
1. Anda WAJIB memisahkan Interpretasi dan Diagnosis dengan pembatas yang tegas yaitu: ===DIAGNOSIS===
2. Format output harus persis seperti ini:
Interpretasi: [Tuliskan interpretasi temuan klinis dan penunjang secara padat di sini]
===DIAGNOSIS===
[Diagnosis Utama] dd [Diagnosis Banding] + [Diagnosis Simtomatik] ec [Etiologi]

3. Bagian diagnosis (setelah pembatas) HARUS SATU BARIS, tanpa asterisk/markdown, dan tanpa nomor.
Contoh diagnosis yang benar: NSTEACS dd Dispepsia Sindrom + Obs. Dispneu ec Edema paru dd PPOK Eksaserbasi akut""",

    "palui": """Anda adalah Palui, AI Planning.
Rapikan instruksi terapi ini menjadi format baku.
ATURAN KETAT:
1. Jangan tulis infus, tulis IVFD. 
2. Jangan tulis injeksi, Tulis Inj.
3. Urutan penulisan HARUS: IVFD, Injeksi, Obat oral (PO), baru diikuti Terapi non farmakologi (seperti KIE, Observasi, dsb).
4. JANGAN gunakan header kategori (seperti TERAPI FARMAKOLOGI atau TERAPI NON-FARMAKOLOGI).
5. JANGAN gunakan penomoran angka (1. 2. 3.).
6. JANGAN gunakan format markdown (** atau *).
7. Hanya kembalikan teks hasil format terapi per baris (di-enter), tanpa kalimat pembuka atau penutup.

Contoh output yang BENAR:
IVFD. RL 20 tpm
Inj. Pantoprazole 40mg
Inj. Ondancetron 4mg
Inj. Ketorolac 30mg
PO. Sucralfate syr 3x1C
KIE Istirahat
Observasi TTV dan KU"""
}

# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class PasswordVerify(BaseModel):
    password: str

class PasswordVerifyWithIP(BaseModel):
    password: str
    client_id: str = "default"

class ResetTimerRequest(BaseModel):
    password: str
    client_id: str = "default"

class WhitelistEmail(BaseModel):
    email: EmailStr
    expiry_datetime: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WhitelistEmailCreate(BaseModel):
    email: EmailStr
    expiry_datetime: Optional[str] = None

class WhitelistEmailResponse(BaseModel):
    email: str
    expiry_datetime: Optional[str] = None
    created_at: str
    is_active: bool

class BypassSettings(BaseModel):
    is_active: bool = False
    expiry_datetime: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BypassSettingsCreate(BaseModel):
    is_active: bool
    expiry_datetime: Optional[str] = None

class BypassStatusResponse(BaseModel):
    is_active: bool
    expiry_datetime: Optional[str] = None
    is_expired: bool = False

class WhitelistCheckResponse(BaseModel):
    is_whitelisted: bool
    bypass_active: bool
    reason: str

class SystemPrompt(BaseModel):
    agent_id: str  # anam, oppa, diag, palui
    prompt: str
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SystemPromptUpdate(BaseModel):
    agent_id: str
    prompt: str

class PasswordAttemptStatus(BaseModel):
    is_locked: bool
    attempts_remaining: int
    locked_until: Optional[str] = None
    reset_attempts_remaining: int

# Helper functions
def check_expiry(expiry_datetime: Optional[datetime]) -> bool:
    """Check if expiry datetime has passed. Returns True if expired."""
    if expiry_datetime is None:
        return False
    now = datetime.now(timezone.utc)
    if expiry_datetime.tzinfo is None:
        expiry_datetime = expiry_datetime.replace(tzinfo=timezone.utc)
    return now > expiry_datetime

async def get_bypass_status() -> BypassStatusResponse:
    """Get current bypass status"""
    bypass_doc = await db.bypass_settings.find_one({}, {"_id": 0})
    if not bypass_doc:
        return BypassStatusResponse(is_active=False, expiry_datetime=None, is_expired=False)
    
    expiry = bypass_doc.get('expiry_datetime')
    is_expired = False
    
    if expiry:
        if isinstance(expiry, str):
            expiry = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
        is_expired = check_expiry(expiry)
        
        if is_expired and bypass_doc.get('is_active'):
            await db.bypass_settings.update_one({}, {"$set": {"is_active": False}})
            return BypassStatusResponse(is_active=False, expiry_datetime=expiry.isoformat() if expiry else None, is_expired=True)
    
    return BypassStatusResponse(
        is_active=bypass_doc.get('is_active', False),
        expiry_datetime=expiry.isoformat() if expiry else None,
        is_expired=is_expired
    )

async def get_password_attempts(client_id: str) -> dict:
    """Get password attempt info for a client"""
    doc = await db.password_attempts.find_one({"client_id": client_id}, {"_id": 0})
    if not doc:
        return {"attempts": 0, "locked_until": None, "reset_attempts": 0}
    
    # Check if lock has expired
    locked_until = doc.get('locked_until')
    if locked_until:
        if isinstance(locked_until, str):
            locked_until = datetime.fromisoformat(locked_until.replace('Z', '+00:00'))
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > locked_until:
            # Lock expired, reset attempts
            await db.password_attempts.update_one(
                {"client_id": client_id},
                {"$set": {"attempts": 0, "locked_until": None, "reset_attempts": 0}}
            )
            return {"attempts": 0, "locked_until": None, "reset_attempts": 0}
    
    return doc

async def record_failed_attempt(client_id: str):
    """Record a failed password attempt"""
    doc = await get_password_attempts(client_id)
    new_attempts = doc.get('attempts', 0) + 1
    
    update_data = {"attempts": new_attempts, "last_attempt": datetime.now(timezone.utc).isoformat()}
    
    if new_attempts >= MAX_PASSWORD_ATTEMPTS:
        locked_until = datetime.now(timezone.utc) + timedelta(hours=LOCKOUT_DURATION_HOURS)
        update_data["locked_until"] = locked_until.isoformat()
    
    await db.password_attempts.update_one(
        {"client_id": client_id},
        {"$set": update_data},
        upsert=True
    )

async def reset_password_attempts(client_id: str):
    """Reset password attempts on successful login"""
    await db.password_attempts.update_one(
        {"client_id": client_id},
        {"$set": {"attempts": 0, "locked_until": None}},
        upsert=True
    )

# Routes
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks

# Password attempt status
@api_router.get("/whitelist/password-status/{client_id}")
async def get_password_status(client_id: str):
    """Get password attempt status for a client"""
    doc = await get_password_attempts(client_id)
    attempts = doc.get('attempts', 0)
    locked_until = doc.get('locked_until')
    reset_attempts = doc.get('reset_attempts', 0)
    
    is_locked = False
    if locked_until:
        if isinstance(locked_until, str):
            locked_until_dt = datetime.fromisoformat(locked_until.replace('Z', '+00:00'))
        else:
            locked_until_dt = locked_until
        if locked_until_dt.tzinfo is None:
            locked_until_dt = locked_until_dt.replace(tzinfo=timezone.utc)
        is_locked = datetime.now(timezone.utc) < locked_until_dt
    
    return PasswordAttemptStatus(
        is_locked=is_locked,
        attempts_remaining=max(0, MAX_PASSWORD_ATTEMPTS - attempts),
        locked_until=locked_until if is_locked else None,
        reset_attempts_remaining=max(0, MAX_RESET_ATTEMPTS - reset_attempts)
    )

# Whitelist Management Routes
@api_router.post("/whitelist/verify-password")
async def verify_admin_password(data: PasswordVerifyWithIP):
    """Verify admin password server-side with attempt limiting"""
    client_id = data.client_id
    
    # Check if locked out
    attempt_doc = await get_password_attempts(client_id)
    locked_until = attempt_doc.get('locked_until')
    
    if locked_until:
        if isinstance(locked_until, str):
            locked_until_dt = datetime.fromisoformat(locked_until.replace('Z', '+00:00'))
        else:
            locked_until_dt = locked_until
        if locked_until_dt.tzinfo is None:
            locked_until_dt = locked_until_dt.replace(tzinfo=timezone.utc)
        
        if datetime.now(timezone.utc) < locked_until_dt:
            reset_attempts = attempt_doc.get('reset_attempts', 0)
            raise HTTPException(
                status_code=429, 
                detail={
                    "message": "Terlalu banyak percobaan gagal. Akun terkunci.",
                    "locked_until": locked_until_dt.isoformat(),
                    "can_reset": reset_attempts < MAX_RESET_ATTEMPTS
                }
            )
    
    # Verify password
    input_hash = hashlib.sha256(data.password.encode()).hexdigest()
    if input_hash == ADMIN_PASSWORD_HASH:
        await reset_password_attempts(client_id)
        return {"valid": True}
    
    # Record failed attempt
    await record_failed_attempt(client_id)
    
    # Get updated attempts
    updated_doc = await get_password_attempts(client_id)
    attempts_remaining = MAX_PASSWORD_ATTEMPTS - updated_doc.get('attempts', 0)
    
    if attempts_remaining <= 0:
        raise HTTPException(
            status_code=429,
            detail={
                "message": "Terlalu banyak percobaan gagal. Akun terkunci selama 24 jam.",
                "locked_until": updated_doc.get('locked_until'),
                "can_reset": updated_doc.get('reset_attempts', 0) < MAX_RESET_ATTEMPTS
            }
        )
    
    raise HTTPException(
        status_code=401, 
        detail={
            "message": f"Password tidak valid. Sisa percobaan: {attempts_remaining}",
            "attempts_remaining": attempts_remaining
        }
    )

@api_router.post("/whitelist/reset-timer")
async def reset_lockout_timer(data: ResetTimerRequest):
    """Reset the lockout timer with password verification"""
    client_id = data.client_id
    
    # Get current attempt info
    attempt_doc = await get_password_attempts(client_id)
    reset_attempts = attempt_doc.get('reset_attempts', 0)
    
    if reset_attempts >= MAX_RESET_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail={
                "message": "Batas reset tercapai. Tunggu 24 jam untuk reset otomatis.",
                "reset_attempts_used": reset_attempts
            }
        )
    
    # Verify password
    input_hash = hashlib.sha256(data.password.encode()).hexdigest()
    if input_hash != ADMIN_PASSWORD_HASH:
        raise HTTPException(status_code=401, detail={"message": "Password tidak valid untuk reset"})
    
    # Reset attempts but increment reset counter
    await db.password_attempts.update_one(
        {"client_id": client_id},
        {"$set": {
            "attempts": 0, 
            "locked_until": None,
            "reset_attempts": reset_attempts + 1,
            "last_reset": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {
        "message": "Timer berhasil direset",
        "reset_attempts_remaining": MAX_RESET_ATTEMPTS - (reset_attempts + 1)
    }

@api_router.get("/whitelist/emails")
async def get_whitelist_emails():
    """Get all whitelisted emails"""
    emails = await db.whitelist.find({}, {"_id": 0}).to_list(1000)
    result = []
    now = datetime.now(timezone.utc)
    
    for email_doc in emails:
        expiry = email_doc.get('expiry_datetime')
        is_active = True
        
        if expiry:
            if isinstance(expiry, str):
                expiry = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
            is_active = not check_expiry(expiry)
        
        created_at = email_doc.get('created_at', now.isoformat())
        if isinstance(created_at, datetime):
            created_at = created_at.isoformat()
        
        result.append(WhitelistEmailResponse(
            email=email_doc['email'],
            expiry_datetime=expiry.isoformat() if expiry and isinstance(expiry, datetime) else expiry,
            created_at=created_at,
            is_active=is_active
        ))
    
    return result

@api_router.post("/whitelist/emails")
async def add_whitelist_email(data: WhitelistEmailCreate):
    """Add email to whitelist"""
    existing = await db.whitelist.find_one({"email": data.email.lower()})
    if existing:
        update_data = {
            "expiry_datetime": data.expiry_datetime,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.whitelist.update_one(
            {"email": data.email.lower()},
            {"$set": update_data}
        )
        return {"message": "Email updated", "email": data.email.lower()}
    
    doc = {
        "email": data.email.lower(),
        "expiry_datetime": data.expiry_datetime,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.whitelist.insert_one(doc)
    return {"message": "Email added", "email": data.email.lower()}

@api_router.delete("/whitelist/emails/{email}")
async def delete_whitelist_email(email: str):
    """Remove email from whitelist"""
    result = await db.whitelist.delete_one({"email": email.lower()})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Email tidak ditemukan")
    return {"message": "Email removed", "email": email.lower()}

@api_router.get("/whitelist/bypass")
async def get_bypass_settings():
    """Get bypass settings"""
    return await get_bypass_status()

@api_router.post("/whitelist/bypass")
async def set_bypass_settings(data: BypassSettingsCreate):
    """Set bypass settings"""
    doc = {
        "is_active": data.is_active,
        "expiry_datetime": data.expiry_datetime,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bypass_settings.update_one(
        {},
        {"$set": doc},
        upsert=True
    )
    
    return {"message": "Bypass settings updated", "is_active": data.is_active}

@api_router.get("/whitelist/check/{email}")
async def check_whitelist(email: str):
    """Check if email is whitelisted or bypass is active"""
    bypass = await get_bypass_status()
    
    if bypass.is_active:
        return WhitelistCheckResponse(
            is_whitelisted=True,
            bypass_active=True,
            reason="Bypass mode aktif"
        )
    
    email_doc = await db.whitelist.find_one({"email": email.lower()}, {"_id": 0})
    
    if not email_doc:
        return WhitelistCheckResponse(
            is_whitelisted=False,
            bypass_active=False,
            reason="Email tidak terdaftar di whitelist"
        )
    
    expiry = email_doc.get('expiry_datetime')
    if expiry:
        if isinstance(expiry, str):
            expiry = datetime.fromisoformat(expiry.replace('Z', '+00:00'))
        if check_expiry(expiry):
            return WhitelistCheckResponse(
                is_whitelisted=False,
                bypass_active=False,
                reason="Akses whitelist sudah expired"
            )
    
    return WhitelistCheckResponse(
        is_whitelisted=True,
        bypass_active=False,
        reason="Email terdaftar di whitelist"
    )

# System Prompts Routes
@api_router.get("/prompts")
async def get_all_prompts():
    """Get all system prompts"""
    prompts = await db.system_prompts.find({}, {"_id": 0}).to_list(100)
    
    # Return defaults if not found
    result = {}
    for agent_id in ["anam", "oppa", "diag", "palui"]:
        found = next((p for p in prompts if p.get('agent_id') == agent_id), None)
        if found:
            result[agent_id] = found.get('prompt', DEFAULT_PROMPTS.get(agent_id, ''))
        else:
            result[agent_id] = DEFAULT_PROMPTS.get(agent_id, '')
    
    return result

@api_router.get("/prompts/{agent_id}")
async def get_prompt(agent_id: str):
    """Get system prompt for specific agent"""
    if agent_id not in ["anam", "oppa", "diag", "palui"]:
        raise HTTPException(status_code=400, detail="Invalid agent_id")
    
    prompt_doc = await db.system_prompts.find_one({"agent_id": agent_id}, {"_id": 0})
    
    if not prompt_doc:
        return {"agent_id": agent_id, "prompt": DEFAULT_PROMPTS.get(agent_id, '')}
    
    return prompt_doc

@api_router.post("/prompts")
async def update_prompt(data: SystemPromptUpdate):
    """Update system prompt for an agent"""
    if data.agent_id not in ["anam", "oppa", "diag", "palui"]:
        raise HTTPException(status_code=400, detail="Invalid agent_id")
    
    doc = {
        "agent_id": data.agent_id,
        "prompt": data.prompt,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.system_prompts.update_one(
        {"agent_id": data.agent_id},
        {"$set": doc},
        upsert=True
    )
    
    return {"message": "Prompt updated", "agent_id": data.agent_id}

@api_router.post("/prompts/reset/{agent_id}")
async def reset_prompt(agent_id: str):
    """Reset prompt to default"""
    if agent_id not in ["anam", "oppa", "diag", "palui"]:
        raise HTTPException(status_code=400, detail="Invalid agent_id")
    
    await db.system_prompts.delete_one({"agent_id": agent_id})
    
    return {"message": "Prompt reset to default", "agent_id": agent_id, "prompt": DEFAULT_PROMPTS.get(agent_id, '')}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
