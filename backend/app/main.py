from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import get_settings
from app.database import Base, SessionLocal, engine
from app.routers import activities, auth, reports, time_entries, users
from app.seed import run_seed, sync_catalogue

settings = get_settings()


def _run_startup_migrations() -> None:
    """Lichtgewicht migraties voor bestaande databases (geen Alembic in de pilot)."""
    inspector = inspect(engine)
    with engine.begin() as conn:
        # v1.1: uitbetalingsvorm per station (individueel / bemanningspot).
        station_cols = {c["name"] for c in inspector.get_columns("stations")}
        if "payout_mode" not in station_cols:
            conn.execute(
                text(
                    "ALTER TABLE stations ADD COLUMN payout_mode VARCHAR(20) "
                    "NOT NULL DEFAULT 'individual'"
                )
            )
        # v1.1: legacy enkel detail -> many-to-many koppeltabel.
        conn.execute(
            text(
                "INSERT INTO time_entry_details (time_entry_id, detail_activity_id) "
                "SELECT te.id, te.detail_activity_id FROM time_entries te "
                "WHERE te.detail_activity_id IS NOT NULL AND NOT EXISTS ("
                "  SELECT 1 FROM time_entry_details ted WHERE ted.time_entry_id = te.id"
                ")"
            )
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_startup_migrations()
    db = SessionLocal()
    try:
        run_seed(db)
        sync_catalogue(db)
    finally:
        db.close()
    yield


app = FastAPI(title=settings.app_name, version="1.2.0", lifespan=lifespan)

origins = ["*"] if settings.cors_origins == "*" else [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(activities.router)
app.include_router(time_entries.router)
app.include_router(reports.router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
