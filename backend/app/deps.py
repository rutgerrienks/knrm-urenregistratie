from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Role, User
from app.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    subject = decode_token(token)
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ongeldige of verlopen sessie.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.email == subject).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Gebruiker niet gevonden.")
    return user


def require_schipper(user: User = Depends(get_current_user)) -> User:
    if user.role not in (Role.schipper, Role.admin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Alleen voor schipper of beheerder.")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Alleen voor beheerder.")
    return user
