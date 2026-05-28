"""
Lazy Supabase client singleton.
Falls back gracefully if SUPABASE_URL / SUPABASE_ANON_KEY are not set.
"""
import os
from typing import Optional

_client = None


def get_client():
    """Return the Supabase client, or None if not configured."""
    global _client
    if _client is not None:
        return _client

    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_ANON_KEY", "")
    if not url or not key:
        return None

    from supabase import create_client
    _client = create_client(url, key)
    return _client


def is_configured() -> bool:
    return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_ANON_KEY"))
