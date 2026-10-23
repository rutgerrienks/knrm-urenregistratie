"""Idempotent seed & catalogue sync.

- `run_seed`: creates an admin user and a pilot station if the database is empty.
- `sync_catalogue`: ensures the official KNRM activity list (aangeleverd door
  Sander Kuipers) exists, and deactivates the superseded pilot catalogue.
Both run at every startup and are safe to re-run.
"""

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import DetailActivity, MainActivity, Role, Station, User
from app.security import hash_password

settings = get_settings()

# Officiële KNRM-lijst: 2 niveaus (hoofdactiviteit -> detailactiviteiten).
KNRM_ACTIVITIES: dict[str, list[str]] = {
    "Oefening": [
        "EHBO",
        "MOB",
        "Slepen",
        "Brandbestrijding",
        "Manoeuvreren",
        "Navigatie / radar",
        "Zoekpatronen",
        "SAREX",
        "Stormvaren",
        "Multidisciplinair",
        "Tabletop",
        "Veiligheidsprocedures",
    ],
    # "Werkzaamheden" is allesomvattend voor onderhoud, klusjes, schoonmaak, etc.
    "Werkzaamheden": [
        "Onderhoud reddingboot",
        "Onderhoud KHV",
        "Onderhoud bootwagen",
        "Schoonmaak",
        "Diverse klussen",
    ],
    "PR": [
        "Presentatie / rondleiding",
        "Reddingbootdag",
        "Trouwe donateurs",
        "Lezing (extern)",
        "PR Landelijk",
    ],
}

# Oude pilot-catalogus die door de officiële lijst wordt vervangen.
LEGACY_MAINS = ["Onderhoud"]
LEGACY_DETAILS: dict[str, list[str]] = {
    "Oefening": [
        "Man-over-boord",
        "Eerste hulp / reanimatie",
        "Zoekacties (SAR)",
        "Nachtvaren",
        "Navigatie / radar",  # heraangemaakt onder dezelfde naam; blijft actief
    ],
    "PR": [
        "Open dag",
        "Voorlichting / presentatie",
        "Demonstratie",
        "Collecte / fondsenwerving",
    ],
}


def run_seed(db: Session) -> None:
    if db.query(User).count() > 0:
        return

    station = Station(name="Scheveningen (pilot)")
    db.add(station)
    db.flush()

    db.add(
        User(
            email=settings.seed_admin_email.lower(),
            full_name="KNRM Beheer",
            role=Role.admin,
            station_id=station.id,
            hashed_password=hash_password(settings.seed_admin_password),
        )
    )
    db.commit()


def sync_catalogue(db: Session) -> None:
    """Ensure the official KNRM catalogue exists (add missing, reactivate),
    and deactivate the superseded pilot entries."""
    for main_name, detail_names in KNRM_ACTIVITIES.items():
        main = db.query(MainActivity).filter(MainActivity.name == main_name).first()
        if not main:
            main = MainActivity(name=main_name)
            db.add(main)
            db.flush()
        main.is_active = True
        for detail_name in detail_names:
            detail = (
                db.query(DetailActivity)
                .filter(
                    DetailActivity.main_activity_id == main.id,
                    DetailActivity.name == detail_name,
                )
                .first()
            )
            if not detail:
                db.add(DetailActivity(name=detail_name, main_activity_id=main.id))
            else:
                detail.is_active = True

    # Deactiveer vervangen pilot-items (registraties erop blijven bestaan).
    for main_name in LEGACY_MAINS:
        main = db.query(MainActivity).filter(MainActivity.name == main_name).first()
        if main:
            main.is_active = False
            for detail in main.details:
                detail.is_active = False
    for main_name, detail_names in LEGACY_DETAILS.items():
        main = db.query(MainActivity).filter(MainActivity.name == main_name).first()
        if not main:
            continue
        keep = set(KNRM_ACTIVITIES.get(main_name, []))
        for detail in main.details:
            if detail.name in detail_names and detail.name not in keep:
                detail.is_active = False

    db.commit()
