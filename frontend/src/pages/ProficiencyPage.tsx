import { useEffect, useMemo, useState } from "react";

import { api } from "../api/client";
import type { ProficiencyMatrix, User, VolunteerYearReport } from "../api/types";
import { euro, formatDate, minutesToHours } from "../lib/format";

const RECENCY_OPTIONS = [3, 6, 12];

function monthsAgo(iso: string): number {
  const d = new Date(iso);
  const now = new Date();
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
}

function cellColor(iso: string | null): string {
  if (!iso) return "bg-knrm-navy/5 text-knrm-navy/40";
  const m = monthsAgo(iso);
  if (m <= 3) return "bg-emerald-100 text-emerald-800";
  if (m <= 6) return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-800";
}

export function ProficiencyPage() {
  const [matrix, setMatrix] = useState<ProficiencyMatrix | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<number | "">("");
  const [recencyMonths, setRecencyMonths] = useState(6);

  // Jaaroverzicht
  const [yearUserId, setYearUserId] = useState<number | "">("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [yearReport, setYearReport] = useState<VolunteerYearReport | null>(null);

  useEffect(() => {
    void api.get<ProficiencyMatrix>("/api/reports/proficiency").then(setMatrix).catch(() => null);
    void api.get<User[]>("/api/users").then(setUsers).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    if (yearUserId === "") {
      setYearReport(null);
      return;
    }
    void api
      .get<VolunteerYearReport>(`/api/reports/volunteer/${yearUserId}/year?year=${year}`)
      .then(setYearReport)
      .catch(() => setYearReport(null));
  }, [yearUserId, year]);

  const cellMap = useMemo(() => {
    const map = new Map<string, { count: number; last_date: string }>();
    matrix?.volunteers.forEach((v) =>
      v.cells.forEach((c) =>
        map.set(`${v.user_id}:${c.detail_activity_id}`, { count: c.count, last_date: c.last_date }),
      ),
    );
    return map;
  }, [matrix]);

  const exerciseSplit = useMemo(() => {
    if (!matrix || selectedDetail === "") return null;
    const recent: { name: string; last: string }[] = [];
    const notRecent: { name: string; last: string | null }[] = [];
    matrix.volunteers.forEach((v) => {
      const cell = cellMap.get(`${v.user_id}:${selectedDetail}`);
      if (cell && monthsAgo(cell.last_date) <= recencyMonths) {
        recent.push({ name: v.user_name, last: cell.last_date });
      } else {
        notRecent.push({ name: v.user_name, last: cell?.last_date ?? null });
      }
    });
    return { recent, notRecent };
  }, [matrix, selectedDetail, recencyMonths, cellMap]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-knrm-navy">Geoefendheid</h1>
        <p className="text-knrm-navy/60">
          Wie heeft welke oefening gedaan, en wanneer voor het laatst? Gebruik dit om vrijwilligers
          gericht uit te nodigen voor de eerstvolgende oefening.
        </p>
      </div>

      {/* Matrix per vrijwilliger */}
      <section className="card overflow-x-auto">
        <h2 className="mb-1 text-lg font-bold text-knrm-navy">Overzicht per vrijwilliger</h2>
        <p className="mb-4 text-sm text-knrm-navy/60">
          Per cel: aantal keer deelgenomen en laatste datum.{" "}
          <span className="badge bg-emerald-100 text-emerald-800">≤ 3 mnd</span>{" "}
          <span className="badge bg-amber-100 text-amber-800">≤ 6 mnd</span>{" "}
          <span className="badge bg-rose-100 text-rose-800">&gt; 6 mnd</span>{" "}
          <span className="badge bg-knrm-navy/5 text-knrm-navy/40">nooit</span>
        </p>
        {!matrix || matrix.details.length === 0 ? (
          <p className="text-sm text-knrm-navy/60">Nog geen oefeningen beschikbaar.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-knrm-navy/60">
                <th className="sticky left-0 bg-white px-2 py-2">Vrijwilliger</th>
                {matrix.details.map((d) => (
                  <th key={d.id} className="px-2 py-2 font-semibold">
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-knrm-navy/5">
              {matrix.volunteers.map((v) => (
                <tr key={v.user_id}>
                  <td className="sticky left-0 whitespace-nowrap bg-white px-2 py-2 font-medium text-knrm-navy">
                    {v.user_name}
                  </td>
                  {matrix.details.map((d) => {
                    const cell = cellMap.get(`${v.user_id}:${d.id}`);
                    return (
                      <td key={d.id} className="px-1 py-1">
                        <div
                          className={`rounded px-2 py-1 text-center ${cellColor(cell?.last_date ?? null)}`}
                        >
                          {cell ? (
                            <>
                              {cell.count}× <br /> {formatDate(cell.last_date)}
                            </>
                          ) : (
                            "—"
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Per oefening: wie recent / niet recent */}
      <section className="card">
        <h2 className="mb-4 text-lg font-bold text-knrm-navy">Per oefening: wie uitnodigen?</h2>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Oefening</label>
            <select
              className="input"
              value={selectedDetail}
              onChange={(e) =>
                setSelectedDetail(e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              <option value="">Kies een oefening...</option>
              {matrix?.details.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Recent = binnen</label>
            <select
              className="input"
              value={recencyMonths}
              onChange={(e) => setRecencyMonths(Number(e.target.value))}
            >
              {RECENCY_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} maanden
                </option>
              ))}
            </select>
          </div>
        </div>
        {exerciseSplit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="mb-2 font-bold text-emerald-800">
                Recent deelgenomen ({exerciseSplit.recent.length})
              </h3>
              <ul className="space-y-1 text-sm text-emerald-900">
                {exerciseSplit.recent.map((r) => (
                  <li key={r.name}>
                    {r.name} <span className="text-emerald-700/70">— {formatDate(r.last)}</span>
                  </li>
                ))}
                {exerciseSplit.recent.length === 0 && <li>Niemand.</li>}
              </ul>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <h3 className="mb-2 font-bold text-rose-800">
                Niet recent — uitnodigen ({exerciseSplit.notRecent.length})
              </h3>
              <ul className="space-y-1 text-sm text-rose-900">
                {exerciseSplit.notRecent.map((r) => (
                  <li key={r.name}>
                    {r.name}{" "}
                    <span className="text-rose-700/70">
                      — {r.last ? `laatst ${formatDate(r.last)}` : "nog nooit"}
                    </span>
                  </li>
                ))}
                {exerciseSplit.notRecent.length === 0 && <li>Niemand.</li>}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* Jaaroverzicht per vrijwilliger */}
      <section className="card">
        <h2 className="mb-1 text-lg font-bold text-knrm-navy">Jaaroverzicht per vrijwilliger</h2>
        <p className="mb-4 text-sm text-knrm-navy/60">
          Voor het jaarlijkse gesprek: uren per hoofdactiviteit en gedane oefeningen.
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Vrijwilliger</label>
            <select
              className="input"
              value={yearUserId}
              onChange={(e) => setYearUserId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Kies...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Jaar</label>
            <input
              type="number"
              className="input w-28"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
        </div>
        {yearReport && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-knrm-navy/10 p-4">
              <h3 className="mb-2 font-bold text-knrm-navy">Totalen {yearReport.year}</h3>
              <p className="text-sm">
                Totaal geregistreerd: <b>{minutesToHours(yearReport.total_minutes)} u</b>
              </p>
              <p className="text-sm">
                Geaccordeerd: <b>{minutesToHours(yearReport.approved_minutes)} u</b>
              </p>
              <p className="text-sm">
                Vergoeding: <b>{euro(yearReport.compensation_eur)}</b>
              </p>
            </div>
            <div className="rounded-xl border border-knrm-navy/10 p-4">
              <h3 className="mb-2 font-bold text-knrm-navy">Uren per hoofdactiviteit</h3>
              <ul className="space-y-1 text-sm">
                {yearReport.per_main_activity.map((m) => (
                  <li key={m.main_activity_name}>
                    {m.main_activity_name}: <b>{minutesToHours(m.minutes)} u</b>
                  </li>
                ))}
                {yearReport.per_main_activity.length === 0 && <li>Geen registraties.</li>}
              </ul>
            </div>
            <div className="rounded-xl border border-knrm-navy/10 p-4">
              <h3 className="mb-2 font-bold text-knrm-navy">Gedane oefeningen</h3>
              <ul className="space-y-1 text-sm">
                {yearReport.exercises.map((ex) => (
                  <li key={ex.detail_name}>
                    {ex.detail_name}: <b>{ex.count}×</b>{" "}
                    <span className="text-knrm-navy/50">(laatst {formatDate(ex.last_date)})</span>
                  </li>
                ))}
                {yearReport.exercises.length === 0 && <li>Geen oefeningen dit jaar.</li>}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
