export type Role = "volunteer" | "schipper" | "admin";
export type EntryStatus = "submitted" | "approved" | "rejected";
export type PayoutMode = "individual" | "crew_pot";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  station_id: number | null;
  is_active: boolean;
}

export interface Station {
  id: number;
  name: string;
  payout_mode: PayoutMode;
}

export interface DetailActivity {
  id: number;
  name: string;
  main_activity_id: number;
  is_active: boolean;
}

export interface MainActivity {
  id: number;
  name: string;
  is_active: boolean;
  details: DetailActivity[];
}

export interface TimeEntry {
  id: number;
  user_id: number;
  registered_by_id: number;
  entry_date: string;
  main_activity_id: number;
  detail_activity_id: number | null;
  minutes: number;
  notes: string | null;
  status: EntryStatus;
  approved_by_id: number | null;
  approved_at: string | null;
  reject_reason: string | null;
  user_name: string | null;
  main_activity_name: string | null;
  detail_activity_name: string | null;
  detail_activity_ids: number[];
  detail_activity_names: string[];
}

export interface MonthlySummaryRow {
  user_id: number;
  user_name: string;
  station_name: string | null;
  payout_mode: PayoutMode | null;
  total_minutes: number;
  approved_minutes: number;
  approved_hours: number;
  compensation_eur: number;
  distinct_detail_activities: number;
}

export interface ProficiencyCell {
  detail_activity_id: number;
  count: number;
  last_date: string;
}

export interface ProficiencyVolunteer {
  user_id: number;
  user_name: string;
  cells: ProficiencyCell[];
}

export interface ProficiencyMatrix {
  details: { id: number; name: string }[];
  volunteers: ProficiencyVolunteer[];
}

export interface ActivityLogRow {
  entry_id: number;
  entry_date: string;
  user_id: number;
  user_name: string;
  main_activity_id: number;
  main_activity_name: string;
  detail_activity_names: string[];
  minutes: number;
  status: EntryStatus;
  notes: string | null;
}

export interface VolunteerYearReport {
  user_id: number;
  user_name: string;
  year: number;
  total_minutes: number;
  approved_minutes: number;
  compensation_eur: number;
  per_main_activity: { main_activity_name: string; minutes: number }[];
  exercises: { detail_name: string; count: number; last_date: string }[];
}
