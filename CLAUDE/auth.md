# Auth — Authentication Design

## MVP1.5 Status: Not Implemented
Auth is deliberately excluded from MVP1.5. The app is self-hosted and single-user by default. The `auth/` directory exists as a placeholder.

## Why Excluded
- Self-hosted Streamlit means controlled access via network (only local or VPN)
- No persistent user data in MVP1.5 (best responses are per-device JSON)
- Adding auth adds SQLAlchemy/JWT/bcrypt complexity without user-facing value yet

## Future Auth Design (when needed)
**Approach:** Streamlit-native session cookies + SQLite (no PostgreSQL needed for single-team use)

**Packages:**
```
streamlit-authenticator>=0.3.0   # YAML-based user config
```

**Pattern:**
```python
import streamlit_authenticator as stauth
import yaml

with open("auth/users.yaml") as f:
    config = yaml.safe_load(f)

authenticator = stauth.Authenticate(
    config["credentials"],
    config["cookie"]["name"],
    config["cookie"]["key"],
    config["cookie"]["expiry_days"],
)

name, auth_status, username = authenticator.login("Login", "main")
if auth_status is False:
    st.error("Username/password incorrect")
    st.stop()
elif auth_status is None:
    st.warning("Please enter credentials")
    st.stop()
```

**User config (`auth/users.yaml`):**
```yaml
credentials:
  usernames:
    jsmith:
      email: jsmith@example.com
      name: John Smith
      password: $2b$12$hashed...   # bcrypt
cookie:
  expiry_days: 30
  key: some-random-key
  name: interviewai_auth
```

## Per-User Best Responses
When auth is added, `data/best_responses.json` should become `data/{username}_responses.json` or migrate to SQLite with a `user_id` column.

## Old FastAPI Auth (reference)
The previous implementation used JWT + bcrypt + PostgreSQL. That code was deleted in the MVP1.5 refactor. See git history if needed.
