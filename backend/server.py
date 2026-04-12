from datetime import datetime, timedelta, timezone
import hashlib
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware
from supabase import Client, create_client

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

app = FastAPI()

ADMIN_PASSWORD_HASH = hashlib.sha256(
    os.environ.get("ADMIN_PASSWORD", "buriead").encode()
).hexdigest()

MAX_PASSWORD_ATTEMPTS = 3
MAX_RESET_ATTEMPTS = 3
LOCKOUT_DURATION_HOURS = 24
PROMPT_AGENT_IDS = ["anam", "oppa", "diag", "palui"]

DEFAULT_PROMPTS = {
    "anam": "Susun anamnesis ringkas, terstruktur, siap ditempel ke SOAP, lalu beri saran penggalian lanjutan tanpa markdown.",
    "oppa": "Modifikasi template pemeriksaan fisik normal berdasarkan temuan abnormal tanpa markdown.",
    "diag": "Berikan interpretasi singkat lalu diagnosis satu baris dengan pemisah ===DIAGNOSIS=== tanpa markdown.",
    "palui": "Rapikan rencana terapi menjadi IVFD, Inj., PO, lalu non farmakologi tanpa markdown.",
}


class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


class PasswordVerifyWithIP(BaseModel):
    password: str
    client_id: str = "default"


class ResetTimerRequest(BaseModel):
    password: str
    client_id: str = "default"


class WhitelistEmailCreate(BaseModel):
    email: EmailStr
    expiry_datetime: Optional[str] = None


class WhitelistEmailResponse(BaseModel):
    email: str
    expiry_datetime: Optional[str] = None
    created_at: str
    is_active: bool


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


class SystemPromptUpdate(BaseModel):
    agent_id: str
    prompt: str


class PasswordAttemptStatus(BaseModel):
    is_locked: bool
    attempts_remaining: int
    locked_until: Optional[str] = None
    reset_attempts_remaining: int


def parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def iso_or_none(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def check_expiry(expiry_datetime: Optional[datetime]) -> bool:
    if expiry_datetime is None:
        return False
    return datetime.now(timezone.utc) > expiry_datetime


def table_first(table_name: str, filters: Dict[str, str]) -> Optional[dict]:
    query = supabase.table(table_name).select("*")
    for key, value in filters.items():
        query = query.eq(key, value)
    response = query.limit(1).execute()
    return response.data[0] if response.data else None


def table_upsert(table_name: str, payload: dict) -> None:
    supabase.table(table_name).upsert(payload).execute()


async def get_bypass_status() -> BypassStatusResponse:
    bypass_doc = table_first("bypass_settings", {"key": "global"})
    if not bypass_doc:
        return BypassStatusResponse(is_active=False, expiry_datetime=None, is_expired=False)

    expiry = parse_datetime(bypass_doc.get("expiry_datetime"))
    is_expired = check_expiry(expiry)
    if is_expired and bypass_doc.get("is_active"):
        table_upsert(
            "bypass_settings",
            {
                "key": "global",
                "is_active": False,
                "expiry_datetime": bypass_doc.get("expiry_datetime"),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        return BypassStatusResponse(
            is_active=False,
            expiry_datetime=iso_or_none(expiry),
            is_expired=True,
        )

    return BypassStatusResponse(
        is_active=bypass_doc.get("is_active", False),
        expiry_datetime=iso_or_none(expiry),
        is_expired=is_expired,
    )


async def get_password_attempts(client_id: str) -> dict:
    doc = table_first("password_attempts", {"client_id": client_id})
    if not doc:
        return {"client_id": client_id, "attempts": 0, "locked_until": None, "reset_attempts": 0}

    locked_until = parse_datetime(doc.get("locked_until"))
    if locked_until and datetime.now(timezone.utc) > locked_until:
        reset_doc = {
            "client_id": client_id,
            "attempts": 0,
            "locked_until": None,
            "reset_attempts": 0,
            "last_attempt": datetime.now(timezone.utc).isoformat(),
        }
        table_upsert("password_attempts", reset_doc)
        return reset_doc
    return doc


async def record_failed_attempt(client_id: str) -> None:
    doc = await get_password_attempts(client_id)
    attempts = doc.get("attempts", 0) + 1
    payload = {
        "client_id": client_id,
        "attempts": attempts,
        "reset_attempts": doc.get("reset_attempts", 0),
        "last_attempt": datetime.now(timezone.utc).isoformat(),
        "locked_until": doc.get("locked_until"),
    }
    if attempts >= MAX_PASSWORD_ATTEMPTS:
        payload["locked_until"] = (
            datetime.now(timezone.utc) + timedelta(hours=LOCKOUT_DURATION_HOURS)
        ).isoformat()
    table_upsert("password_attempts", payload)


async def reset_password_attempts(client_id: str) -> None:
    doc = await get_password_attempts(client_id)
    table_upsert(
        "password_attempts",
        {
            "client_id": client_id,
            "attempts": 0,
            "locked_until": None,
            "reset_attempts": doc.get("reset_attempts", 0),
            "last_attempt": datetime.now(timezone.utc).isoformat(),
        },
    )


@app.get("/")
async def root():
    return {"message": "AI Medical Squad API"}


@app.get("/health")
async def healthcheck():
    return {"status": "ok"}


@app.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_obj = StatusCheck(**input.model_dump())
    table_upsert(
        "status_checks",
        {
            "id": status_obj.id,
            "client_name": status_obj.client_name,
            "timestamp": status_obj.timestamp.isoformat(),
        },
    )
    return status_obj


@app.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    response = (
        supabase.table("status_checks")
        .select("*")
        .order("timestamp", desc=True)
        .limit(1000)
        .execute()
    )
    return [
        StatusCheck(
            id=item["id"],
            client_name=item["client_name"],
            timestamp=parse_datetime(item.get("timestamp")) or datetime.now(timezone.utc),
        )
        for item in (response.data or [])
    ]


@app.get("/whitelist/password-status/{client_id}")
async def get_password_status(client_id: str):
    doc = await get_password_attempts(client_id)
    attempts = doc.get("attempts", 0)
    locked_until = parse_datetime(doc.get("locked_until"))
    reset_attempts = doc.get("reset_attempts", 0)
    is_locked = bool(locked_until and datetime.now(timezone.utc) < locked_until)

    return PasswordAttemptStatus(
        is_locked=is_locked,
        attempts_remaining=max(0, MAX_PASSWORD_ATTEMPTS - attempts),
        locked_until=iso_or_none(locked_until) if is_locked else None,
        reset_attempts_remaining=max(0, MAX_RESET_ATTEMPTS - reset_attempts),
    )


@app.post("/whitelist/verify-password")
async def verify_admin_password(data: PasswordVerifyWithIP):
    client_id = data.client_id
    attempt_doc = await get_password_attempts(client_id)
    locked_until = parse_datetime(attempt_doc.get("locked_until"))

    if locked_until and datetime.now(timezone.utc) < locked_until:
        raise HTTPException(
            status_code=429,
            detail={
                "message": "Terlalu banyak percobaan gagal. Akun terkunci.",
                "locked_until": locked_until.isoformat(),
                "can_reset": attempt_doc.get("reset_attempts", 0) < MAX_RESET_ATTEMPTS,
            },
        )

    input_hash = hashlib.sha256(data.password.encode()).hexdigest()
    if input_hash == ADMIN_PASSWORD_HASH:
        await reset_password_attempts(client_id)
        return {"valid": True}

    await record_failed_attempt(client_id)
    updated_doc = await get_password_attempts(client_id)
    attempts_remaining = MAX_PASSWORD_ATTEMPTS - updated_doc.get("attempts", 0)
    if attempts_remaining <= 0:
        raise HTTPException(
            status_code=429,
            detail={
                "message": "Terlalu banyak percobaan gagal. Akun terkunci selama 24 jam.",
                "locked_until": updated_doc.get("locked_until"),
                "can_reset": updated_doc.get("reset_attempts", 0) < MAX_RESET_ATTEMPTS,
            },
        )

    raise HTTPException(
        status_code=401,
        detail={
            "message": f"Password tidak valid. Sisa percobaan: {attempts_remaining}",
            "attempts_remaining": attempts_remaining,
        },
    )


@app.post("/whitelist/reset-timer")
async def reset_lockout_timer(data: ResetTimerRequest):
    client_id = data.client_id
    attempt_doc = await get_password_attempts(client_id)
    reset_attempts = attempt_doc.get("reset_attempts", 0)
    if reset_attempts >= MAX_RESET_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail={
                "message": "Batas reset tercapai. Tunggu 24 jam untuk reset otomatis.",
                "reset_attempts_used": reset_attempts,
            },
        )

    input_hash = hashlib.sha256(data.password.encode()).hexdigest()
    if input_hash != ADMIN_PASSWORD_HASH:
        raise HTTPException(status_code=401, detail={"message": "Password tidak valid untuk reset"})

    table_upsert(
        "password_attempts",
        {
            "client_id": client_id,
            "attempts": 0,
            "locked_until": None,
            "reset_attempts": reset_attempts + 1,
            "last_attempt": datetime.now(timezone.utc).isoformat(),
            "last_reset": datetime.now(timezone.utc).isoformat(),
        },
    )
    return {
        "message": "Timer berhasil direset",
        "reset_attempts_remaining": MAX_RESET_ATTEMPTS - (reset_attempts + 1),
    }


@app.get("/whitelist/emails")
async def get_whitelist_emails():
    response = supabase.table("whitelist_emails").select("*").order("created_at", desc=True).execute()
    return [
        WhitelistEmailResponse(
            email=item["email"],
            expiry_datetime=iso_or_none(parse_datetime(item.get("expiry_datetime"))),
            created_at=item.get("created_at") or datetime.now(timezone.utc).isoformat(),
            is_active=not check_expiry(parse_datetime(item.get("expiry_datetime"))),
        )
        for item in (response.data or [])
    ]


@app.post("/whitelist/emails")
async def add_whitelist_email(data: WhitelistEmailCreate):
    email = data.email.lower()
    now = datetime.now(timezone.utc).isoformat()
    existing = table_first("whitelist_emails", {"email": email})
    table_upsert(
        "whitelist_emails",
        {
            "email": email,
            "expiry_datetime": data.expiry_datetime,
            "created_at": existing.get("created_at", now) if existing else now,
            "updated_at": now,
        },
    )
    return {"message": "Email updated" if existing else "Email added", "email": email}


@app.delete("/whitelist/emails/{email}")
async def delete_whitelist_email(email: str):
    normalized = email.lower()
    existing = table_first("whitelist_emails", {"email": normalized})
    if not existing:
        raise HTTPException(status_code=404, detail="Email tidak ditemukan")
    supabase.table("whitelist_emails").delete().eq("email", normalized).execute()
    return {"message": "Email removed", "email": normalized}


@app.get("/whitelist/bypass")
async def get_bypass_settings():
    return await get_bypass_status()


@app.post("/whitelist/bypass")
async def set_bypass_settings(data: BypassSettingsCreate):
    table_upsert(
        "bypass_settings",
        {
            "key": "global",
            "is_active": data.is_active,
            "expiry_datetime": data.expiry_datetime,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return {"message": "Bypass settings updated", "is_active": data.is_active}


@app.get("/whitelist/check/{email}")
async def check_whitelist(email: str):
    bypass = await get_bypass_status()
    if bypass.is_active:
        return WhitelistCheckResponse(
            is_whitelisted=True,
            bypass_active=True,
            reason="Bypass mode aktif",
        )

    email_doc = table_first("whitelist_emails", {"email": email.lower()})
    if not email_doc:
        return WhitelistCheckResponse(
            is_whitelisted=False,
            bypass_active=False,
            reason="Email tidak terdaftar di whitelist",
        )

    expiry = parse_datetime(email_doc.get("expiry_datetime"))
    if check_expiry(expiry):
        return WhitelistCheckResponse(
            is_whitelisted=False,
            bypass_active=False,
            reason="Akses whitelist sudah expired",
        )

    return WhitelistCheckResponse(
        is_whitelisted=True,
        bypass_active=False,
        reason="Email terdaftar di whitelist",
    )


@app.get("/prompts")
async def get_all_prompts():
    response = supabase.table("system_prompts").select("*").execute()
    prompt_map = {item["agent_id"]: item.get("prompt", "") for item in (response.data or [])}
    return {agent_id: prompt_map.get(agent_id, DEFAULT_PROMPTS[agent_id]) for agent_id in PROMPT_AGENT_IDS}


@app.get("/prompts/{agent_id}")
async def get_prompt(agent_id: str):
    if agent_id not in PROMPT_AGENT_IDS:
        raise HTTPException(status_code=400, detail="Invalid agent_id")
    prompt_doc = table_first("system_prompts", {"agent_id": agent_id})
    if not prompt_doc:
        return {"agent_id": agent_id, "prompt": DEFAULT_PROMPTS[agent_id]}
    return prompt_doc


@app.post("/prompts")
async def update_prompt(data: SystemPromptUpdate):
    if data.agent_id not in PROMPT_AGENT_IDS:
        raise HTTPException(status_code=400, detail="Invalid agent_id")
    table_upsert(
        "system_prompts",
        {
            "agent_id": data.agent_id,
            "prompt": data.prompt,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    return {"message": "Prompt updated", "agent_id": data.agent_id}


@app.post("/prompts/reset/{agent_id}")
async def reset_prompt(agent_id: str):
    if agent_id not in PROMPT_AGENT_IDS:
        raise HTTPException(status_code=400, detail="Invalid agent_id")
    supabase.table("system_prompts").delete().eq("agent_id", agent_id).execute()
    return {
        "message": "Prompt reset to default",
        "agent_id": agent_id,
        "prompt": DEFAULT_PROMPTS[agent_id],
    }


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)
