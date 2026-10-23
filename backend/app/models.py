from __future__ import annotations

import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Role(str, enum.Enum):
    volunteer = "volunteer"
    schipper = "schipper"
    admin = "admin"


class EntryStatus(str, enum.Enum):
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"


class PayoutMode(str, enum.Enum):
    """Hoe het station de vrijwilligersvergoeding uitbetaalt."""

    individual = "individual"  # uitbetaling aan de individuele vrijwilliger
    crew_pot = "crew_pot"  # uitbetaling aan de bemanningspot


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    payout_mode: Mapped[PayoutMode] = mapped_column(
        Enum(PayoutMode, native_enum=False, length=20),
        default=PayoutMode.individual,
        server_default="individual",
    )

    users: Mapped[list[User]] = relationship(back_populates="station")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.volunteer)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    station_id: Mapped[int | None] = mapped_column(ForeignKey("stations.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    station: Mapped[Station | None] = relationship(back_populates="users")


class MainActivity(Base):
    __tablename__ = "main_activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    details: Mapped[list[DetailActivity]] = relationship(
        back_populates="main_activity", cascade="all, delete-orphan"
    )


class DetailActivity(Base):
    __tablename__ = "detail_activities"
    __table_args__ = (UniqueConstraint("main_activity_id", "name", name="uq_detail_per_main"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    main_activity_id: Mapped[int] = mapped_column(ForeignKey("main_activities.id"))
    name: Mapped[str] = mapped_column(String(160))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    main_activity: Mapped[MainActivity] = relationship(back_populates="details")


# Meerdere detailactiviteiten per registratie (bijv. een oefenscenario met
# navigatie + brandbestrijding + EHBO + slepen).
time_entry_details = Table(
    "time_entry_details",
    Base.metadata,
    Column("time_entry_id", ForeignKey("time_entries.id", ondelete="CASCADE"), primary_key=True),
    Column("detail_activity_id", ForeignKey("detail_activities.id"), primary_key=True),
)


class TimeEntry(Base):
    __tablename__ = "time_entries"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "entry_date",
            "main_activity_id",
            "detail_activity_id",
            name="uq_no_double_registration",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Whose hours these are (the volunteer performing the activity).
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # Who entered them (self, or a schipper on behalf of the team).
    registered_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    entry_date: Mapped[date] = mapped_column(Date, index=True)
    main_activity_id: Mapped[int] = mapped_column(ForeignKey("main_activities.id"))
    # Legacy kolom (één detail); nieuwe registraties gebruiken `details` (m2m).
    detail_activity_id: Mapped[int | None] = mapped_column(ForeignKey("detail_activities.id"))
    minutes: Mapped[int] = mapped_column(Integer)  # multiple of 30
    notes: Mapped[str | None] = mapped_column(Text)

    status: Mapped[EntryStatus] = mapped_column(Enum(EntryStatus), default=EntryStatus.submitted)
    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reject_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    registered_by: Mapped[User] = relationship(foreign_keys=[registered_by_id])
    main_activity: Mapped[MainActivity] = relationship()
    detail_activity: Mapped[DetailActivity | None] = relationship()
    details: Mapped[list[DetailActivity]] = relationship(secondary=time_entry_details)
