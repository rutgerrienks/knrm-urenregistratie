from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_admin, require_schipper
from app.models import Role, Station, User
from app.schemas import (
    StationCreate,
    StationOut,
    StationUpdate,
    UserCreate,
    UserOut,
    UserUpdate,
)
from app.security import hash_password

router = APIRouter(prefix="/api", tags=["users"])


@router.get("/users", response_model=list[UserOut])
def list_users(
    current: User = Depends(require_schipper),
    db: Session = Depends(get_db),
) -> list[User]:
    query = db.query(User)
    # A schipper only sees their own station; an admin sees everyone.
    if current.role == Role.schipper and current.station_id is not None:
        query = query.filter(User.station_id == current.station_id)
    return query.order_by(User.full_name).all()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> User:
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise HTTPException(status_code=409, detail="E-mailadres is al in gebruik.")
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        role=payload.role,
        station_id=payload.station_id,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Gebruiker niet gevonden.")
    data = payload.model_dump(exclude_unset=True)
    if "password" in data and data["password"]:
        user.hashed_password = hash_password(data.pop("password"))
    else:
        data.pop("password", None)
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


@router.get("/stations", response_model=list[StationOut])
def list_stations(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Station]:
    return db.query(Station).order_by(Station.name).all()


@router.post("/stations", response_model=StationOut, status_code=201)
def create_station(
    payload: StationCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Station:
    if db.query(Station).filter(Station.name == payload.name).first():
        raise HTTPException(status_code=409, detail="Station bestaat al.")
    station = Station(name=payload.name, payout_mode=payload.payout_mode)
    db.add(station)
    db.commit()
    db.refresh(station)
    return station


@router.put("/stations/{station_id}", response_model=StationOut)
def update_station(
    station_id: int,
    payload: StationUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Station:
    station = db.get(Station, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station niet gevonden.")
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(station, key, value)
    db.commit()
    db.refresh(station)
    return station
