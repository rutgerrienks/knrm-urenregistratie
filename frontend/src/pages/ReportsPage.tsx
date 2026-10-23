import { useCallback, useEffect, useState } from "react";

import { api } from "../api/client";
import type { ActivityLogRow, MainActivity, MonthlySummaryRow, User } from "../api/types";
import { currentMonth, euro, formatDate, minutesToHours } from "../lib/format";

type PeriodType = "month" | "quarter" | "year";

const payoutLabels: Record<string, string> = {
  individual: "Individueel",
  crew_pot: "Bemanningspot",
};

const statusLabels: Record<string, string> = {
  submitted: "Ingediend",
  approved: "Geaccordeerd",
  rejected: "Afgekeurd",
};

function download(path: string, filename: string) {
  void api.raw(path).then(async (res) => {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  });
}

export function ReportsPage() {
  const now = new Date();
  const [periodType, setPeriodType] = useState<PeriodType>("month");
  const [month, setMonth] = useState(currentMonth());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<MonthlySummaryRow[]>([]);

  const period =
    periodType === "month" ? month : periodType === "quarter" ? `${year}-Q${quarter}` : `${year}`;

  const refresh = useCallback(() => {
    void api
      .get<MonthlySummaryRow[]>(`/api/reports/summary?period=${period}`)
      .then(setRows)
      .catch(() => setRows([]));
  }, [period]);

  useEffect(refresh, [refresh]);

  const totalHours = rows.reduce((s, r) => s + r.approved_hours, 0);
  const totalComp = rows.reduce((s, r) => s + r.compensation_eur, 0);

  // Activiteitenoverzicht
  const [activities, setActivities] = useState<MainActivity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [actRows, setActRows] = useState<ActivityLogRow[]>([]);
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fMain, setFMain] = useState<number | "">("");
  const [fDetail, setFDetail] = useState<number | "">("");
  const [fUser, setFUser] = useState<number | "">("");

  useEffect(() => {
    void api.get<MainActivity[]>("/api/activities").then(setActivities).catch(() => undefined);
    void api.get<User[]>("/api/users").then(setUsers).catch(() => setUsers([]));
  }, []);

  const actQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (fFrom) params.set("date_from", fFrom);
    if (fTo) params.set("date_to", fTo);
    if (fMain !== "") params.set("main_activity_id", String(fMain));
    if (fDetail !== "") params.set("detail_activity_id", String(fDetail));
    if (fUser !== "") params.set("user_id", String(fUser));
    return params.toString();
  }, [fFrom, fTo, fMain, fDetail, fUser]);

  useEffect(() => {
    void api
      .get<ActivityLogRow[]>(`/api/reports/activities?${actQuery()}`)
      .then(setActRows)
      .catch(() => setActRows([]));
  }, [actQuery]);

  const detailOptions = activities.find((a) => a.id === fMain)?.details ?? [];

  return (
    <div className="space-y-10">
      {/* ---- Urenoverzicht & vergoeding ---- */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-knrm-navy">Urenoverzicht &amp; vergoeding</h1>
            <p className="text-knrm-navy/60">
              Geaccordeerde uren per periode — voor AFAS (pilot: Excel/CSV), incl.
              uitbetalingsvorm per station.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Periode</label>
              <select
                className="input"
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value as PeriodType)}
              >
                <option value="month">Maand</option>
                <option value="quarter">Kwartaal</option>
                <option value="year">Jaar</option>
              </select>
            </div>
            {periodType === "month" && (
              <div>
                <label className="label">Maand</label>
                <input
                  type="month"
                  className="input"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
            )}
            {periodType === "quarter" && (
              <div>
                <label className="label">Kwartaal</label>
                <select
                  className="input"
                  value={quarter}
                  onChange={(e) => setQuarter(Number(e.target.value))}
                >
                  {[1, 2, 3, 4].map((q) => (
                    <option key={q} value={q}>
                      Q{q}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {periodType !== "month" && (
              <div>
                <label className="label">Jaar</label>
                <input
                  type="number"
                  className="input w-28"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                />
              </div>
            )}
            <button
              onClick={() => download(`/api/reports/summary.csv?period=${period}`, `knrm-uren-${period}.csv`)}
              className="btn-primary"
              disabled={rows.length === 0}
            >
              Exporteer CSV
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="card">
            <p className="text-sm font-medium text-knrm-navy/60">Vrijwilligers met uren</p>
            <p className="mt-1 text-3xl font-extrabold text-knrm-navy">{rows.length}</p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-knrm-navy/60">Totaal geaccordeerde uren</p>
            <p className="mt-1 text-3xl font-extrabold text-knrm-navy">
              {totalHours.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} u
            </p>
          </div>
          <div className="card">
            <p className="text-sm font-medium text-knrm-navy/60">Totale vergoeding</p>
            <p className="mt-1 text-3xl font-extrabold text-knrm-orange">{euro(totalComp)}</p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="card text-sm text-knrm-navy/60">Geen gegevens voor deze periode.</div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-knrm-sky text-left text-xs uppercase tracking-wide text-knrm-navy/60">
                <tr>
                  <th className="px-4 py-3">Vrijwilliger</th>
                  <th className="px-4 py-3">Station / uitbetaling</th>
                  <th className="px-4 py-3">Totaal geregistreerd</th>
                  <th className="px-4 py-3">Geaccordeerd</th>
                  <th className="px-4 py-3">Verschillende oefeningen</th>
                  <th className="px-4 py-3">Vergoeding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-knrm-navy/5">
                {rows.map((r) => (
                  <tr key={r.user_id}>
                    <td className="px-4 py-3 font-medium">{r.user_name}</td>
                    <td className="px-4 py-3 text-knrm-navy/70">
                      {r.station_name ?? "—"}
                      {r.payout_mode && (
                        <span className="text-knrm-navy/50"> · {payoutLabels[r.payout_mode]}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{minutesToHours(r.total_minutes)} u</td>
                    <td className="px-4 py-3">{minutesToHours(r.approved_minutes)} u</td>
                    <td className="px-4 py-3">{r.distinct_detail_activities}</td>
                    <td className="px-4 py-3 font-semibold">{euro(r.compensation_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- Activiteitenoverzicht ---- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-knrm-navy">Activiteitenoverzicht</h2>
            <p className="text-knrm-navy/60">
              Wie heeft wanneer geoefend — of onderhouds-, schoonmaak- en PR-activiteiten gedaan?
            </p>
          </div>
          <button
            onClick={() => download(`/api/reports/activities.csv?${actQuery()}`, "knrm-activiteiten.csv")}
            className="btn-secondary"
            disabled={actRows.length === 0}
          >
            Exporteer CSV
          </button>
        </div>

        <div className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="label">Van</label>
            <input type="date" className="input" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Tot en met</label>
            <input type="date" className="input" value={fTo} onChange={(e) => setFTo(e.target.value)} />
          </div>
          <div>
            <label className="label">Hoofdactiviteit</label>
            <select
              className="input"
              value={fMain}
              onChange={(e) => {
                setFMain(e.target.value === "" ? "" : Number(e.target.value));
                setFDetail("");
              }}
            >
              <option value="">Alle</option>
              {activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Detailactiviteit</label>
            <select
              className="input"
              value={fDetail}
              onChange={(e) => setFDetail(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={fMain === ""}
            >
              <option value="">Alle</option>
              {detailOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Persoon</label>
            <select
              className="input"
              value={fUser}
              onChange={(e) => setFUser(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Iedereen</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {actRows.length === 0 ? (
          <div className="card text-sm text-knrm-navy/60">Geen activiteiten gevonden.</div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-knrm-sky text-left text-xs uppercase tracking-wide text-knrm-navy/60">
                <tr>
                  <th className="px-4 py-3">Datum</th>
                  <th className="px-4 py-3">Wie</th>
                  <th className="px-4 py-3">Activiteit</th>
                  <th className="px-4 py-3">Uren</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-knrm-navy/5">
                {actRows.map((r) => (
                  <tr key={r.entry_id}>
                    <td className="px-4 py-3">{formatDate(r.entry_date)}</td>
                    <td className="px-4 py-3 font-medium">{r.user_name}</td>
                    <td className="px-4 py-3">
                      {r.main_activity_name}
                      {r.detail_activity_names.length > 0 && (
                        <span className="text-knrm-navy/50">
                          {" "}
                          · {r.detail_activity_names.join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{minutesToHours(r.minutes)} u</td>
                    <td className="px-4 py-3">{statusLabels[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
