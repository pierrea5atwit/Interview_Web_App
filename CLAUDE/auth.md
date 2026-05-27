# Auth — Authentication Design

## MVP1.5 Status: Not Implemented
Auth is deliberately excluded from MVP1.5. The app is self-hosted and single-user by default. The `auth/` directory exists as a placeholder.

## Why Excluded
- No persistent user data in MVP1.5 (best responses are per-device JSON)
- Adding auth adds JWT/bcrypt/session complexity without user-facing value yet

## Future Auth Design (when needed)
**Approach:** FastAPI session middleware + JWT tokens stored in HttpOnly cookies

**Packages to add:**
```
python-jose[cryptography]   # JWT encoding/decoding
passlib[bcrypt]             # password hashing
python-multipart            # already in requirements (form login)
```

**Pattern:**
```python
# backend/app/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401)
        return username
    except JWTError:
        raise HTTPException(status_code=401)
```

**React side:** store JWT in memory (not localStorage), attach as `Authorization: Bearer <token>` header on each API call, redirect to `/login` on 401.

## Per-User Best Responses
When auth is added, `data/best_responses.json` should become `data/{username}_responses.json` or migrate to SQLite with a `user_id` column.
