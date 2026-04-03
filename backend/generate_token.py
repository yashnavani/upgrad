# backend/generate_token.py
import time

import jwt

from app.core.config import settings

# Dev helper: mint a JWT like native auth (sub must be a real User.id UUID in DB).
payload = {
    "aud": "authenticated",
    "exp": int(time.time()) + 3600,
    "sub": "00000000-0000-4000-8000-000000000001",
    "email": "test@masterfoundation.com",
}

raw = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
token = raw if isinstance(raw, str) else raw.decode("utf-8")
print(f"\nYour Mock Bearer Token:\n{token}\n")
