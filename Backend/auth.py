from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

SECRET_KEY = os.getenv("JWT_SECRET", "realestateai-dev-secret-change-in-prod-32chars")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7  # 7 jours


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": str(user_id), "email": email, "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
