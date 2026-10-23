from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import LoginRequest, SsoConfig, SsoLoginRequest, Token, UserOut
from app.security import create_access_token, validate_entra_id_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _authenticate(db: Session, email: str, password: str) -> User:
    user = db.query(User).filter(User.email == email.lower()).first()
    if not user or not verify_password(password, user.hashed_password) or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Onjuiste e-mail of wachtwoord.",
        )
    return user


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> Token:
    user = _authenticate(db, payload.email, payload.password)
    return Token(access_token=create_access_token(user.email))


@router.post("/token", response_model=Token)
def token(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Token:
    """OAuth2 password flow endpoint (used by Swagger UI)."""
    user = _authenticate(db, form.username, form.password)
    return Token(access_token=create_access_token(user.email))


@router.get("/sso/config", response_model=SsoConfig)
def sso_config() -> SsoConfig:
    """Publieke SSO-configuratie voor de frontend (MSAL); geen secrets."""
    settings = get_settings()
    enabled = bool(settings.entra_tenant_id and settings.entra_client_id)
    return SsoConfig(
        enabled=enabled,
        tenant_id=settings.entra_tenant_id if enabled else "",
        client_id=settings.entra_client_id if enabled else "",
    )


@router.post("/sso", response_model=Token)
def sso_login(payload: SsoLoginRequest, db: Session = Depends(get_db)) -> Token:
    """SSO-login met een Microsoft Entra ID id_token; vereist een bestaand lokaal account."""
    settings = get_settings()
    if not settings.entra_tenant_id or not settings.entra_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SSO is niet geconfigureerd.",
        )
    claims = validate_entra_id_token(payload.id_token)
    if claims is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ongeldig SSO-token.",
        )
    email = (claims.get("preferred_username") or claims.get("email") or "").lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geen actief account bekend voor dit e-mailadres.",
        )
    return Token(access_token=create_access_token(user.email))


@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)) -> User:
    return current
