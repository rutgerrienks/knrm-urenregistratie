from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_schipper
from app.models import (
    DetailActivity,
    EntryStatus,
    MainActivity,
    Role,
    TimeEntry,
    User,
)
from app.schemas import (
    RejectRequest,
    TimeEntryCreate,
    TimeEntryOut,
    TimeEntryUpdate,
)

router = APIRouter(prefix="/api/time-entries", tags=["time-entries"])


def _enrich(entry: TimeEntry) -> TimeEntryOut:
    out = TimeEntryOut.model_validate(entry)
    out.user_name = entry.user.full_name if entry.user else None
    out.main_activity_name = entry.main_activity.name if entry.main_activity else None
    out.detail_activity_ids = [d.id for d in entry.details]
    out.detail_activity_names = [d.name for d in entry.details]
    # Legacy enkelvoudig veld: eerste detail (voor oudere clients/weergave).
    out.detail_activity_name = out.detail_activity_names[0] if out.detail_activity_names else None
    return out


def _resolve_details(db: Session, main_activity_id: int, detail_ids: list[int]) -> list[DetailActivity]:
    details: list[DetailActivity] = []
    for detail_id in detail_ids:
        detail = db.get(DetailActivity, detail_id)
        if not detail or detail.main_activity_id != main_activity_id:
            raise HTTPException(
                status_code=400, detail="Detailactiviteit hoort niet bij deze hoofdactiviteit."
            )
        details.append(detail)
    return details


def _may_manage_target(actor: User, target_user_id: int, db: Session) -> None:
    """A volunteer may only register for themselves. A schipper may register for
    anyone in their own station. An admin may register for anyone."""
    if actor.id == target_user_id:
        return
    if actor.role == Role.admin:
        return
    if actor.role == Role.schipper:
        target = db.get(User, target_user_id)
        if target and target.station_id == actor.station_id:
            return
    raise HTTPException(status_code=403, detail="Je mag geen uren voor deze persoon registreren.")


@router.get("", response_model=list[TimeEntryOut])
def list_entries(
    user_id: int | None = None,
    month: str | None = Query(None, description="YYYY-MM"),
    status_filter: EntryStatus | None = Query(None, alias="status"),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TimeEntryOut]:
    query = db.query(TimeEntry)

    if current.role == Role.volunteer:
        query = query.filter(TimeEntry.user_id == current.id)
    elif current.role == Role.schipper:
        # Own entries + everyone in the station.
        station_user_ids = [
            u.id for u in db.query(User.id).filter(User.station_id == current.station_id).all()
        ]
        query = query.filter(TimeEntry.user_id.in_(station_user_ids or [current.id]))

    if user_id is not None:
        query = query.filter(TimeEntry.user_id == user_id)
    if status_filter is not None:
        query = query.filter(TimeEntry.status == status_filter)
    if month:
        try:
            year, mon = (int(x) for x in month.split("-"))
            start = date(year, mon, 1)
            end = date(year + (mon == 12), (mon % 12) + 1, 1)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Ongeldige maand (verwacht YYYY-MM).") from exc
        query = query.filter(and_(TimeEntry.entry_date >= start, TimeEntry.entry_date < end))

    entries = query.order_by(TimeEntry.entry_date.desc(), TimeEntry.id.desc()).all()
    return [_enrich(e) for e in entries]


@router.post("", response_model=TimeEntryOut, status_code=201)
def create_entry(
    payload: TimeEntryCreate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TimeEntryOut:
    _may_manage_target(current, payload.user_id, db)

    if not db.get(MainActivity, payload.main_activity_id):
        raise HTTPException(status_code=404, detail="Hoofdactiviteit niet gevonden.")
    detail_ids = payload.all_detail_ids()
    details = _resolve_details(db, payload.main_activity_id, detail_ids)

    # Double-registration guard: same person, day and (overlapping) activity.
    candidates = (
        db.query(TimeEntry)
        .filter(
            TimeEntry.user_id == payload.user_id,
            TimeEntry.entry_date == payload.entry_date,
            TimeEntry.main_activity_id == payload.main_activity_id,
        )
        .all()
    )
    new_set = set(detail_ids)
    for existing in candidates:
        existing_set = {d.id for d in existing.details}
        if (not existing_set and not new_set) or (existing_set & new_set):
            raise HTTPException(
                status_code=409,
                detail="Voor deze persoon, datum en activiteit zijn al uren geregistreerd (dubbele registratie).",
            )

    entry = TimeEntry(
        user_id=payload.user_id,
        registered_by_id=current.id,
        entry_date=payload.entry_date,
        main_activity_id=payload.main_activity_id,
        detail_activity_id=detail_ids[0] if detail_ids else None,
        minutes=payload.minutes,
        notes=payload.notes,
        status=EntryStatus.submitted,
    )
    entry.details = details
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _enrich(entry)


@router.put("/{entry_id}", response_model=TimeEntryOut)
def update_entry(
    entry_id: int,
    payload: TimeEntryUpdate,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TimeEntryOut:
    entry = db.get(TimeEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Registratie niet gevonden.")
    _may_manage_target(current, entry.user_id, db)
    if entry.status == EntryStatus.approved and current.role == Role.volunteer:
        raise HTTPException(status_code=409, detail="Geaccordeerde uren kunnen niet meer worden gewijzigd.")

    data = payload.model_dump(exclude_unset=True)
    detail_ids = data.pop("detail_activity_ids", None)
    for key, value in data.items():
        setattr(entry, key, value)
    if detail_ids is not None:
        details = _resolve_details(db, entry.main_activity_id, list(dict.fromkeys(detail_ids)))
        entry.details = details
        entry.detail_activity_id = details[0].id if details else None
    # A change re-opens the entry for approval.
    entry.status = EntryStatus.submitted
    entry.approved_by_id = None
    entry.approved_at = None
    entry.reject_reason = None
    db.commit()
    db.refresh(entry)
    return _enrich(entry)


@router.delete("/{entry_id}", status_code=204)
def delete_entry(
    entry_id: int,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    entry = db.get(TimeEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Registratie niet gevonden.")
    _may_manage_target(current, entry.user_id, db)
    if entry.status == EntryStatus.approved and current.role == Role.volunteer:
        raise HTTPException(status_code=409, detail="Geaccordeerde uren kunnen niet worden verwijderd.")
    db.delete(entry)
    db.commit()


@router.post("/{entry_id}/approve", response_model=TimeEntryOut)
def approve_entry(
    entry_id: int,
    current: User = Depends(require_schipper),
    db: Session = Depends(get_db),
) -> TimeEntryOut:
    entry = db.get(TimeEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Registratie niet gevonden.")
    if current.role == Role.schipper and entry.user.station_id != current.station_id:
        raise HTTPException(status_code=403, detail="Buiten je eigen station.")
    entry.status = EntryStatus.approved
    entry.approved_by_id = current.id
    entry.approved_at = datetime.now(timezone.utc)
    entry.reject_reason = None
    db.commit()
    db.refresh(entry)
    return _enrich(entry)


@router.post("/{entry_id}/reject", response_model=TimeEntryOut)
def reject_entry(
    entry_id: int,
    payload: RejectRequest,
    current: User = Depends(require_schipper),
    db: Session = Depends(get_db),
) -> TimeEntryOut:
    entry = db.get(TimeEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Registratie niet gevonden.")
    if current.role == Role.schipper and entry.user.station_id != current.station_id:
        raise HTTPException(status_code=403, detail="Buiten je eigen station.")
    entry.status = EntryStatus.rejected
    entry.approved_by_id = current.id
    entry.approved_at = datetime.now(timezone.utc)
    entry.reject_reason = payload.reason
    db.commit()
    db.refresh(entry)
    return _enrich(entry)
