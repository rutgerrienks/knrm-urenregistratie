from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.models import EntryStatus, PayoutMode, Role


# ---------- Auth ----------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SsoLoginRequest(BaseModel):
    id_token: str


class SsoConfig(BaseModel):
    enabled: bool
    tenant_id: str = ""
    client_id: str = ""


# ---------- Users ----------
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: Role = Role.volunteer
    station_id: int | None = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: Role | None = None
    station_id: int | None = None
    is_active: bool | None = None
    password: str | None = None


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_active: bool


# ---------- Stations ----------
class StationCreate(BaseModel):
    name: str
    payout_mode: PayoutMode = PayoutMode.individual


class StationUpdate(BaseModel):
    name: str | None = None
    payout_mode: PayoutMode | None = None


class StationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    payout_mode: PayoutMode


# ---------- Activities ----------
class DetailActivityCreate(BaseModel):
    name: str
    main_activity_id: int


class ActivityUpdate(BaseModel):
    name: str | None = None
    is_active: bool | None = None


class DetailActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    main_activity_id: int
    is_active: bool


class MainActivityCreate(BaseModel):
    name: str


class MainActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    is_active: bool
    details: list[DetailActivityOut] = []


# ---------- Time entries ----------
class TimeEntryBase(BaseModel):
    user_id: int
    entry_date: date
    main_activity_id: int
    # Meerdere detailactiviteiten mogelijk (bijv. oefenscenario met navigatie,
    # brandbestrijding, EHBO en slepen). `detail_activity_id` blijft werken.
    detail_activity_ids: list[int] = []
    detail_activity_id: int | None = None
    minutes: int
    notes: str | None = None

    @field_validator("minutes")
    @classmethod
    def minutes_half_hour(cls, v: int) -> int:
        if v < 30 or v % 30 != 0:
            raise ValueError("Uren worden in stappen van een half uur (30 min) geregistreerd.")
        return v

    def all_detail_ids(self) -> list[int]:
        ids = list(dict.fromkeys(self.detail_activity_ids))
        if self.detail_activity_id is not None and self.detail_activity_id not in ids:
            ids.append(self.detail_activity_id)
        return ids


class TimeEntryCreate(TimeEntryBase):
    pass


class TimeEntryUpdate(BaseModel):
    entry_date: date | None = None
    main_activity_id: int | None = None
    detail_activity_ids: list[int] | None = None
    minutes: int | None = None
    notes: str | None = None

    @field_validator("minutes")
    @classmethod
    def minutes_half_hour(cls, v: int | None) -> int | None:
        if v is not None and (v < 30 or v % 30 != 0):
            raise ValueError("Uren worden in stappen van een half uur (30 min) geregistreerd.")
        return v


class TimeEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    registered_by_id: int
    entry_date: date
    main_activity_id: int
    detail_activity_id: int | None
    minutes: int
    notes: str | None
    status: EntryStatus
    approved_by_id: int | None
    approved_at: datetime | None
    reject_reason: str | None
    # enriched
    user_name: str | None = None
    main_activity_name: str | None = None
    detail_activity_name: str | None = None
    detail_activity_ids: list[int] = []
    detail_activity_names: list[str] = []


class RejectRequest(BaseModel):
    reason: str | None = None


# ---------- Reports ----------
class MonthlySummaryRow(BaseModel):
    user_id: int
    user_name: str
    station_name: str | None = None
    payout_mode: PayoutMode | None = None
    total_minutes: int
    approved_minutes: int
    approved_hours: float
    compensation_eur: float
    distinct_detail_activities: int


class ProficiencyCell(BaseModel):
    detail_activity_id: int
    count: int
    last_date: date


class ProficiencyVolunteer(BaseModel):
    user_id: int
    user_name: str
    cells: list[ProficiencyCell]


class ProficiencyDetail(BaseModel):
    id: int
    name: str


class ProficiencyMatrix(BaseModel):
    details: list[ProficiencyDetail]
    volunteers: list[ProficiencyVolunteer]


class ActivityLogRow(BaseModel):
    entry_id: int
    entry_date: date
    user_id: int
    user_name: str
    main_activity_id: int
    main_activity_name: str
    detail_activity_names: list[str]
    minutes: int
    status: EntryStatus
    notes: str | None = None


class YearMainActivityRow(BaseModel):
    main_activity_name: str
    minutes: int


class YearExerciseRow(BaseModel):
    detail_name: str
    count: int
    last_date: date


class VolunteerYearReport(BaseModel):
    user_id: int
    user_name: str
    year: int
    total_minutes: int
    approved_minutes: int
    compensation_eur: float
    per_main_activity: list[YearMainActivityRow]
    exercises: list[YearExerciseRow]
