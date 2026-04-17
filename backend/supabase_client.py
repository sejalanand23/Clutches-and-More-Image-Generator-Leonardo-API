"""
backend/supabase_client.py
Singleton Supabase client used across the backend.
Loads credentials from the project root .env file.
"""
from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv
import httpx
from supabase import create_client, Client
from supabase.lib.client_options import SyncClientOptions

# Load .env from project root (two levels up: backend/ → project root)
_ROOT = Path(__file__).parent.parent
load_dotenv(_ROOT / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise EnvironmentError(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
    )

# Cursor/IDE environments may set HTTP(S)_PROXY which can break Supabase calls.
# Use an httpx client that ignores proxy env vars.
_httpx_client = httpx.Client(trust_env=False, timeout=60)

# Use service role key for full access (backend only — never expose to client)
supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    SyncClientOptions(httpx_client=_httpx_client),
)

INPUT_BUCKET = "input-images"
OUTPUT_BUCKET = "output-images"
