from datetime import datetime, timedelta, timezone

import json
import time
import urllib.request

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload.get("sub")
    except JWTError:
        return None


# ---------- SSO: Microsoft Entra ID ----------

_JWKS_TTL_SECONDS = 60 * 60
_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}


def _fetch_entra_jwks(tenant_id: str, force: bool = False) -> dict:
    now = time.monotonic()
    if not force and _jwks_cache["keys"] and now - _jwks_cache["fetched_at"] < _JWKS_TTL_SECONDS:
        return _jwks_cache["keys"]
    url = f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
    with urllib.request.urlopen(url, timeout=10) as resp:
        jwks = json.loads(resp.read())
    _jwks_cache["keys"] = jwks
    _jwks_cache["fetched_at"] = now
    return jwks


def validate_entra_id_token(id_token: str) -> dict | None:
    """Valideer een Entra ID id_token; geeft de claims terug of None bij een ongeldig token."""
    tenant = settings.entra_tenant_id
    issuer = f"https://login.microsoftonline.com/{tenant}/v2.0"
    for force in (False, True):  # bij falen één keer opnieuw met verse JWKS (sleutelrotatie)
        jwks = _fetch_entra_jwks(tenant, force=force)
        try:
            return jwt.decode(
                id_token,
                jwks,
                algorithms=["RS256"],
                audience=settings.entra_client_id,
                issuer=issuer,
            )
        except JWTError:
            continue
    return None
