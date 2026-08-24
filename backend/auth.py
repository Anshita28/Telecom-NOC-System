"""
Lightweight JWT authentication for the Telecom NOC demo.
This is NOT production multi-user auth — it gates the dashboard behind a single
demo credential pair read from environment variables, nothing more.

For a real deployment:
- Use httpOnly secure cookies instead of localStorage on the frontend
- Hash stored passwords with a KDF (bcrypt/argon2)
- Add refresh tokens + proper revocation
- Add rate limiting on /api/auth/login
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Load root .env (dotenv already loaded in main.py but guard here too)
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv
    BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
    ROOT_DIR = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
    load_dotenv(os.path.join(ROOT_DIR, ".env"))
except Exception:
    pass


# ---------------------------------------------------------------------------
# JWT configuration — all secrets read from the environment
# ---------------------------------------------------------------------------
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "8"))

# Demo credentials — single user, no DB, no hashing (this is a time-constrained
# hackathon gate only, not a real authentication system)
DEMO_USERNAME = os.getenv("DEMO_USERNAME", "")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "")


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: Optional[str] = None


# Bearer token extractor — matches the Authorization header pattern
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Sign a JWT with the configured secret and algorithm."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    )
    to_encode.update({"exp": expire})
    if not JWT_SECRET_KEY:
        raise RuntimeError(
            "JWT_SECRET_KEY is not set in the environment. "
            "Set it in your .env file before starting the backend."
        )
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def authenticate_user(username: str, password: str) -> bool:
    """
    Validate credentials against the DEMO_USERNAME / DEMO_PASSWORD env vars.
    Returns True on success, False otherwise.
    NOTE: No password hashing for this timeline — this is a demo gate only.
    """
    if not DEMO_USERNAME or not DEMO_PASSWORD:
        # If env vars aren't configured yet, refuse every login rather than
        # accidentally leaving the door open.
        return False
    return username == DEMO_USERNAME and password == DEMO_PASSWORD


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> str:
    """
    FastAPI dependency — validates the Bearer JWT from the Authorization header.
    Raises 401 on any failure (missing token, invalid signature, expired, bad claim).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception

    # Extra safety: token claim must still match the configured demo username
    if not DEMO_USERNAME or token_data.username != DEMO_USERNAME:
        raise credentials_exception

    assert token_data.username is not None
    return token_data.username
