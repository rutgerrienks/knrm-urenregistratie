from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models import DetailActivity, MainActivity, User
from app.schemas import (
    ActivityUpdate,
    DetailActivityCreate,
    DetailActivityOut,
    MainActivityCreate,
    MainActivityOut,
)

router = APIRouter(prefix="/api/activities", tags=["activities"])


@router.get("", response_model=list[MainActivityOut])
def list_activities(
    include_inactive: bool = False,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MainActivity]:
    query = db.query(MainActivity).options(selectinload(MainActivity.details))
    if not include_inactive:
        query = query.filter(MainActivity.is_active.is_(True))
    return query.order_by(MainActivity.name).all()


@router.post("/main", response_model=MainActivityOut, status_code=201)
def create_main(
    payload: MainActivityCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> MainActivity:
    if db.query(MainActivity).filter(MainActivity.name == payload.name).first():
        raise HTTPException(status_code=409, detail="Hoofdactiviteit bestaat al.")
    activity = MainActivity(name=payload.name)
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.post("/detail", response_model=DetailActivityOut, status_code=201)
def create_detail(
    payload: DetailActivityCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DetailActivity:
    if not db.get(MainActivity, payload.main_activity_id):
        raise HTTPException(status_code=404, detail="Hoofdactiviteit niet gevonden.")
    detail = DetailActivity(name=payload.name, main_activity_id=payload.main_activity_id)
    db.add(detail)
    db.commit()
    db.refresh(detail)
    return detail


@router.put("/main/{activity_id}", response_model=MainActivityOut)
def update_main(
    activity_id: int,
    payload: ActivityUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> MainActivity:
    activity = db.get(MainActivity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Niet gevonden.")
    if payload.name is not None:
        clash = (
            db.query(MainActivity)
            .filter(MainActivity.name == payload.name, MainActivity.id != activity_id)
            .first()
        )
        if clash:
            raise HTTPException(status_code=409, detail="Hoofdactiviteit bestaat al.")
        activity.name = payload.name
    if payload.is_active is not None:
        activity.is_active = payload.is_active
    db.commit()
    db.refresh(activity)
    return activity


@router.put("/detail/{detail_id}", response_model=DetailActivityOut)
def update_detail(
    detail_id: int,
    payload: ActivityUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> DetailActivity:
    detail = db.get(DetailActivity, detail_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Niet gevonden.")
    if payload.name is not None:
        detail.name = payload.name
    if payload.is_active is not None:
        detail.is_active = payload.is_active
    db.commit()
    db.refresh(detail)
    return detail


@router.delete("/main/{activity_id}", status_code=204)
def deactivate_main(
    activity_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    activity = db.get(MainActivity, activity_id)
    if not activity:
        raise HTTPException(status_code=404, detail="Niet gevonden.")
    activity.is_active = False
    db.commit()


@router.delete("/detail/{detail_id}", status_code=204)
def deactivate_detail(
    detail_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    detail = db.get(DetailActivity, detail_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Niet gevonden.")
    detail.is_active = False
    db.commit()
