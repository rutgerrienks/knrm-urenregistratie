import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import distinct, func
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user, require_schipper
from app.models import (
    DetailActivity,
    EntryStatus,
    MainActivity,
    Role,
    TimeEntry,
    User,
    time_entry_details,
)
from app.schemas import (
    ActivityLogRow,
    MonthlySummaryRow,
    ProficiencyCell,
    ProficiencyDetail,
    ProficiencyMatrix,
    ProficiencyVolunteer,
    VolunteerYearReport,
    YearExerciseRow,
    YearMainActivityRow,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])
settings = get_settings()

PAYOUT_LABELS = {"individual": "Individueel", "crew_pot": "Bemanningspot"}


def _period_bounds(period: str) -> tuple[date, date]:
    """Ondersteunt 'YYYY' (jaar), 'YYYY-Qn' (kwartaal) en 'YYYY-MM' (maand)."""
    try:
        parts = period.split("-")
        if len(parts) == 1:
            year = int(parts[0])
            return date(year, 1, 1), date(year + 1, 1, 1)
        if parts[1].upper().startswith("Q"):
            year, quarter = int(parts[0]), int(parts[1][1:])
            if not 1 <= quarter <= 4:
                raise ValueError
            start_month = (quarter - 1) * 3 + 1
            start = date(year, start_month, 1)
            end = date(year + (quarter == 4), (start_month + 3 - 1) % 12 + 1, 1)
            return start, end
        year, mon = int(parts[0]), int(parts[1])
        return date(year, mon, 1), date(year + (mon == 12), (mon % 12) + 1, 1)
    except (ValueError, IndexError) as exc:
        raise HTTPException(
            status_code=400, detail="Ongeldige periode (verwacht YYYY, YYYY-Qn of YYYY-MM)."
        ) from exc


def _scoped_users(db: Session, current: User) -> list[User]:
    user_query = db.query(User).options(selectinload(User.station))
    if current.role == Role.schipper and current.station_id is not None:
        user_query = user_query.filter(User.station_id == current.station_id)
    return user_query.all()


def _summary_rows(db: Session, current: User, period: str) -> list[MonthlySummaryRow]:
    start, end = _period_bounds(period)
    users = _scoped_users(db, current)

    rows: list[MonthlySummaryRow] = []
    for user in users:
        base = db.query(TimeEntry).filter(
            TimeEntry.user_id == user.id,
            TimeEntry.entry_date >= start,
            TimeEntry.entry_date < end,
        )
        total = base.with_entities(func.coalesce(func.sum(TimeEntry.minutes), 0)).scalar() or 0
        approved = (
            base.filter(TimeEntry.status == EntryStatus.approved)
            .with_entities(func.coalesce(func.sum(TimeEntry.minutes), 0))
            .scalar()
            or 0
        )
        distinct_details = (
            db.query(func.count(distinct(time_entry_details.c.detail_activity_id)))
            .select_from(TimeEntry)
            .join(time_entry_details, time_entry_details.c.time_entry_id == TimeEntry.id)
            .filter(
                TimeEntry.user_id == user.id,
                TimeEntry.entry_date >= start,
                TimeEntry.entry_date < end,
            )
            .scalar()
            or 0
        )
        if total == 0:
            continue
        approved_hours = round(approved / 60, 2)
        rows.append(
            MonthlySummaryRow(
                user_id=user.id,
                user_name=user.full_name,
                station_name=user.station.name if user.station else None,
                payout_mode=user.station.payout_mode if user.station else None,
                total_minutes=int(total),
                approved_minutes=int(approved),
                approved_hours=approved_hours,
                compensation_eur=round(approved_hours * settings.hourly_rate_eur, 2),
                distinct_detail_activities=int(distinct_details),
            )
        )
    rows.sort(key=lambda r: (r.station_name or "", r.user_name))
    return rows


@router.get("/summary", response_model=list[MonthlySummaryRow])
def period_summary(
    period: str = Query(..., description="YYYY, YYYY-Qn of YYYY-MM"),
    current: User = Depends(require_schipper),
    db: Session = Depends(get_db),
) -> list[MonthlySummaryRow]:
    return _summary_rows(db, current, period)


@router.get("/summary.csv")
def period_summary_csv(
    period: str = Query(..., description="YYYY, YYYY-Qn of YYYY-MM"),
    current: User = Depends(require_schipper),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """AFAS-ready export van goedgekeurde uren over de gekozen periode.

    Per station wordt de uitbetalingsvorm vermeld; bij uitbetaling aan de
    bemanningspot volgt een totaalregel per station."""
    rows = _summary_rows(db, current, period)
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(
        [
            "Naam",
            "Station",
            "Uitbetaling",
            "Periode",
            "Goedgekeurde uren",
            "Vergoeding (EUR)",
            "Verschillende oefeningen",
        ]
    )

    def _num(value: float) -> str:
        return f"{value:.2f}".replace(".", ",")

    for r in rows:
        writer.writerow(
            [
                r.user_name,
                r.station_name or "",
                PAYOUT_LABELS.get(r.payout_mode.value if r.payout_mode else "", ""),
                period,
                _num(r.approved_hours),
                _num(r.compensation_eur),
                r.distinct_detail_activities,
            ]
        )

    # Totaalregels voor stations met bemanningspot-uitbetaling.
    pot_totals: dict[str, tuple[float, float]] = {}
    for r in rows:
        if r.payout_mode is not None and r.payout_mode.value == "crew_pot" and r.station_name:
            hours, comp = pot_totals.get(r.station_name, (0.0, 0.0))
            pot_totals[r.station_name] = (hours + r.approved_hours, comp + r.compensation_eur)
    for station_name, (hours, comp) in sorted(pot_totals.items()):
        writer.writerow(
            [
                f"TOTAAL bemanningspot {station_name}",
                station_name,
                PAYOUT_LABELS["crew_pot"],
                period,
                _num(hours),
                _num(comp),
                "",
            ]
        )

    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="knrm-uren-{period}.csv"'},
    )


# Backward-compatibel alias (oude clients gebruikten /monthly).
@router.get("/monthly", response_model=list[MonthlySummaryRow])
def monthly_summary(
    month: str = Query(..., description="YYYY-MM"),
    current: User = Depends(require_schipper),
    db: Session = Depends(get_db),
) -> list[MonthlySummaryRow]:
    return _summary_rows(db, current, month)


# ---------- Geoefendheid ----------
@router.get("/proficiency", response_model=ProficiencyMatrix)
def proficiency_matrix(
    current: User = Depends(require_schipper),
    db: Session = Depends(get_db),
) -> ProficiencyMatrix:
    """Matrix vrijwilliger x oefening: hoe vaak en wanneer voor het laatst
    deelgenomen. Vrijwilligers zonder deelname staan er ook in, zodat zichtbaar
    is wie uitgenodigd moet worden voor de eerstvolgende oefening."""
    oefening = db.query(MainActivity).filter(MainActivity.name == "Oefening").first()
    if not oefening:
        return ProficiencyMatrix(details=[], volunteers=[])

    details = (
        db.query(DetailActivity)
        .filter(
            DetailActivity.main_activity_id == oefening.id,
            DetailActivity.is_active.is_(True),
        )
        .order_by(DetailActivity.name)
        .all()
    )
    users = [u for u in _scoped_users(db, current) if u.is_active]
    user_ids = [u.id for u in users]

    stats = (
        db.query(
            TimeEntry.user_id,
            time_entry_details.c.detail_activity_id,
            func.count(TimeEntry.id),
            func.max(TimeEntry.entry_date),
        )
        .join(time_entry_details, time_entry_details.c.time_entry_id == TimeEntry.id)
        .filter(
            TimeEntry.main_activity_id == oefening.id,
            TimeEntry.user_id.in_(user_ids or [0]),
        )
        .group_by(TimeEntry.user_id, time_entry_details.c.detail_activity_id)
        .all()
    )
    by_user: dict[int, list[ProficiencyCell]] = {}
    for user_id, detail_id, count, last_date in stats:
        by_user.setdefault(user_id, []).append(
            ProficiencyCell(detail_activity_id=detail_id, count=count, last_date=last_date)
        )

    return ProficiencyMatrix(
        details=[ProficiencyDetail(id=d.id, name=d.name) for d in details],
        volunteers=[
            ProficiencyVolunteer(user_id=u.id, user_name=u.full_name, cells=by_user.get(u.id, []))
            for u in sorted(users, key=lambda u: u.full_name)
        ],
    )


# ---------- Activiteitenoverzicht ----------
def _activity_rows(
    db: Session,
    current: User,
    date_from: date | None,
    date_to: date | None,
    main_activity_id: int | None,
    detail_activity_id: int | None,
    user_id: int | None,
) -> list[ActivityLogRow]:
    query = db.query(TimeEntry).options(
        selectinload(TimeEntry.details),
        selectinload(TimeEntry.user),
        selectinload(TimeEntry.main_activity),
    )
    if current.role == Role.schipper and current.station_id is not None:
        station_user_ids = [
            u.id for u in db.query(User.id).filter(User.station_id == current.station_id).all()
        ]
        query = query.filter(TimeEntry.user_id.in_(station_user_ids or [current.id]))
    if date_from:
        query = query.filter(TimeEntry.entry_date >= date_from)
    if date_to:
        query = query.filter(TimeEntry.entry_date <= date_to)
    if main_activity_id:
        query = query.filter(TimeEntry.main_activity_id == main_activity_id)
    if detail_activity_id:
        query = query.join(
            time_entry_details, time_entry_details.c.time_entry_id == TimeEntry.id
        ).filter(time_entry_details.c.detail_activity_id == detail_activity_id)
    if user_id:
        query = query.filter(TimeEntry.user_id == user_id)

    entries = query.order_by(TimeEntry.entry_date.desc(), TimeEntry.id.desc()).all()
    return [
        ActivityLogRow(
            entry_id=e.id,
            entry_date=e.entry_date,
            user_id=e.user_id,
            user_name=e.user.full_name if e.user else "",
            main_activity_id=e.main_activity_id,
            main_activity_name=e.main_activity.name if e.main_activity else "",
            detail_activity_names=[d.name for d in e.details],
            minutes=e.minutes,
            status=e.status,
            notes=e.notes,
        )
        for e in entries
    ]


@router.get("/activities", response_model=list[ActivityLogRow])
def activity_overview(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    main_activity_id: int | None = Query(None),
    detail_activity_id: int | None = Query(None),
    user_id: int | None = Query(None),
    current: User = Depends(require_schipper),
    db: Session = Depends(get_db),
) -> list[ActivityLogRow]:
    return _activity_rows(
        db, current, date_from, date_to, main_activity_id, detail_activity_id, user_id
    )


@router.get("/activities.csv")
def activity_overview_csv(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    main_activity_id: int | None = Query(None),
    detail_activity_id: int | None = Query(None),
    user_id: int | None = Query(None),
    current: User = Depends(require_schipper),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    rows = _activity_rows(
        db, current, date_from, date_to, main_activity_id, detail_activity_id, user_id
    )
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(["Datum", "Naam", "Hoofdactiviteit", "Detailactiviteiten", "Uren", "Status"])
    status_labels = {"submitted": "Ingediend", "approved": "Geaccordeerd", "rejected": "Afgekeurd"}
    for r in rows:
        writer.writerow(
            [
                r.entry_date.isoformat(),
                r.user_name,
                r.main_activity_name,
                ", ".join(r.detail_activity_names),
                f"{r.minutes / 60:.2f}".replace(".", ","),
                status_labels.get(r.status.value, r.status.value),
            ]
        )
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="knrm-activiteiten.csv"'},
    )


# ---------- Jaaroverzicht per vrijwilliger ----------
@router.get("/volunteer/{user_id}/year", response_model=VolunteerYearReport)
def volunteer_year_report(
    user_id: int,
    year: int = Query(...),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VolunteerYearReport:
    """Jaaroverzicht voor het jaarlijkse gesprek met de vrijwilliger."""
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Gebruiker niet gevonden.")
    if current.id != user_id and current.role == Role.volunteer:
        raise HTTPException(status_code=403, detail="Alleen je eigen jaaroverzicht.")
    if (
        current.id != user_id
        and current.role == Role.schipper
        and target.station_id != current.station_id
    ):
        raise HTTPException(status_code=403, detail="Buiten je eigen station.")

    start, end = date(year, 1, 1), date(year + 1, 1, 1)
    base = db.query(TimeEntry).filter(
        TimeEntry.user_id == user_id,
        TimeEntry.entry_date >= start,
        TimeEntry.entry_date < end,
    )
    total = base.with_entities(func.coalesce(func.sum(TimeEntry.minutes), 0)).scalar() or 0
    approved = (
        base.filter(TimeEntry.status == EntryStatus.approved)
        .with_entities(func.coalesce(func.sum(TimeEntry.minutes), 0))
        .scalar()
        or 0
    )

    per_main = (
        db.query(MainActivity.name, func.sum(TimeEntry.minutes))
        .join(TimeEntry, TimeEntry.main_activity_id == MainActivity.id)
        .filter(
            TimeEntry.user_id == user_id,
            TimeEntry.entry_date >= start,
            TimeEntry.entry_date < end,
        )
        .group_by(MainActivity.name)
        .order_by(MainActivity.name)
        .all()
    )

    oefening = db.query(MainActivity).filter(MainActivity.name == "Oefening").first()
    exercises: list[YearExerciseRow] = []
    if oefening:
        stats = (
            db.query(
                DetailActivity.name,
                func.count(TimeEntry.id),
                func.max(TimeEntry.entry_date),
            )
            .join(time_entry_details, time_entry_details.c.detail_activity_id == DetailActivity.id)
            .join(TimeEntry, time_entry_details.c.time_entry_id == TimeEntry.id)
            .filter(
                TimeEntry.user_id == user_id,
                TimeEntry.main_activity_id == oefening.id,
                TimeEntry.entry_date >= start,
                TimeEntry.entry_date < end,
            )
            .group_by(DetailActivity.name)
            .order_by(DetailActivity.name)
            .all()
        )
        exercises = [
            YearExerciseRow(detail_name=name, count=count, last_date=last)
            for name, count, last in stats
        ]

    approved_hours = round(approved / 60, 2)
    return VolunteerYearReport(
        user_id=user_id,
        user_name=target.full_name,
        year=year,
        total_minutes=int(total),
        approved_minutes=int(approved),
        compensation_eur=round(approved_hours * settings.hourly_rate_eur, 2),
        per_main_activity=[
            YearMainActivityRow(main_activity_name=name, minutes=int(minutes))
            for name, minutes in per_main
        ],
        exercises=exercises,
    )
