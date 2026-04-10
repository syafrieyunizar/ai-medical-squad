from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone
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

class WhitelistEmail(BaseModel):
    email: EmailStr
    expiry_datetime: Optional[datetime] = None  # None = lifetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WhitelistEmailCreate(BaseModel):
    email: EmailStr
    expiry_datetime: Optional[str] = None  # ISO string or None for lifetime

class WhitelistEmailResponse(BaseModel):
    email: str
    expiry_datetime: Optional[str] = None
    created_at: str
    is_active: bool

class BypassSettings(BaseModel):
    is_active: bool = False
    expiry_datetime: Optional[datetime] = None  # None = lifetime when active
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BypassSettingsCreate(BaseModel):
    is_active: bool
    expiry_datetime: Optional[str] = None  # ISO string or None for lifetime

class BypassStatusResponse(BaseModel):
    is_active: bool
    expiry_datetime: Optional[str] = None
    is_expired: bool = False

class WhitelistCheckResponse(BaseModel):
    is_whitelisted: bool
    bypass_active: bool
    reason: str

# Helper functions
def check_expiry(expiry_datetime: Optional[datetime]) -> bool:
    """Check if expiry datetime has passed. Returns True if expired."""
    if expiry_datetime is None:
        return False  # Lifetime = never expires
    
    # Ensure both datetimes are timezone-aware for comparison
    if expiry_datetime.tzinfo is None:
        expiry_datetime = expiry_datetime.replace(tzinfo=timezone.utc)
    
    return datetime.now(timezone.utc) > expiry_datetime

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
        
        # If expired, auto-disable bypass
        if is_expired and bypass_doc.get('is_active'):
            await db.bypass_settings.update_one({}, {"$set": {"is_active": False}})
            return BypassStatusResponse(is_active=False, expiry_datetime=expiry.isoformat() if expiry else None, is_expired=True)
    
    return BypassStatusResponse(
        is_active=bypass_doc.get('is_active', False),
        expiry_datetime=expiry.isoformat() if expiry else None,
        is_expired=is_expired
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
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    return status_checks

# Whitelist Management Routes
@api_router.post("/whitelist/verify-password")
async def verify_admin_password(data: PasswordVerify):
    """Verify admin password server-side"""
    input_hash = hashlib.sha256(data.password.encode()).hexdigest()
    if input_hash == ADMIN_PASSWORD_HASH:
        return {"valid": True}
    raise HTTPException(status_code=401, detail="Password tidak valid")

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
        
        result.append(WhitelistEmailResponse(
            email=email_doc['email'],
            expiry_datetime=expiry.isoformat() if expiry else None,
            created_at=email_doc.get('created_at', now.isoformat()),
            is_active=is_active
        ))
    
    return result

@api_router.post("/whitelist/emails")
async def add_whitelist_email(data: WhitelistEmailCreate):
    """Add email to whitelist"""
    # Check if email already exists
    existing = await db.whitelist.find_one({"email": data.email.lower()})
    if existing:
        # Update expiry
        update_data = {
            "expiry_datetime": data.expiry_datetime,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.whitelist.update_one(
            {"email": data.email.lower()},
            {"$set": update_data}
        )
        return {"message": "Email updated", "email": data.email.lower()}
    
    # Add new email
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
    
    # Upsert bypass settings
    await db.bypass_settings.update_one(
        {},
        {"$set": doc},
        upsert=True
    )
    
    return {"message": "Bypass settings updated", "is_active": data.is_active}

@api_router.get("/whitelist/check/{email}")
async def check_whitelist(email: str):
    """Check if email is whitelisted or bypass is active"""
    # First check bypass status
    bypass = await get_bypass_status()
    
    if bypass.is_active:
        return WhitelistCheckResponse(
            is_whitelisted=True,
            bypass_active=True,
            reason="Bypass mode aktif"
        )
    
    # Check whitelist
    email_doc = await db.whitelist.find_one({"email": email.lower()}, {"_id": 0})
    
    if not email_doc:
        return WhitelistCheckResponse(
            is_whitelisted=False,
            bypass_active=False,
            reason="Email tidak terdaftar di whitelist"
        )
    
    # Check expiry
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
