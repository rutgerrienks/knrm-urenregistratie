import { useEffect, useState } from "react";

import { api } from "../api/client";
import type { MonthlySummaryRow, TimeEntry } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { StatusBadge } from "../components/StatusBadge";
import { currentMonth, euro, formatDate, minutesToHours, monthLabel } from "../lib/format";

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-sm font-medium text-knrm-navy/60">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-knrm-navy">{value}</p>
      {hint && <p className="mt-1 text-xs text-knrm-navy/50">{hint}</p>}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const month = currentMonth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<MonthlySummaryRow[]>([]);
  const isLeader = user?.role === "schipper" || user?.role === "admin";

  useEffect(() => {
    void api
      .get<TimeEntry[]>(`/api/time-entries?month=${month}`)
      .then(setEntries)
      .catch(() => setEntries([]));
    if (isLeader) {
      void api
        .get<MonthlySummaryRow[]>(`/api/reports/monthly?month=${month}`)
        .then(setSummary)
        .catch(() => setSummary([]));
    }
  }, [month, isLeader]);

  const mine = entries.filter((e) => e.user_id === user?.id);
  const myMinutes = mine.reduce((s, e) => s + e.minutes, 0);
  const myApprovedMinutes = mine
    .filter((e) => e.status === "approved")
    .reduce((s, e) => s + e.minutes, 0);
  const distinctExercises = new Set(mine.flatMap((e) => e.detail_activity_ids)).size;
  const pending = entries.filter((e) => e.status === "submitted").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-knrm-navy">
          Welkom, {user?.full_name.split(" ")[0]}
        </h1>
        <p className="text-knrm-navy/60">Overzicht van {monthLabel(month)}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Mijn uren deze maand" value={`${minutesToHours(myMinutes)} u`} />
        <StatCard
          label="Waarvan geaccordeerd"
          value={`${minutesToHours(myApprovedMinutes)} u`}
          hint={`Vergoeding ${euro((myApprovedMinutes / 60) * 1.25)}`}
        />
        <StatCard
          label="Verschillende oefeningen"
          value={String(distinctExercises)}
          hint="Breedte van je geoefendheid"
        />
        {isLeader ? (
          <StatCard label="Te accorderen (station)" value={String(pending)} hint="Wacht op jou" />
        ) : (
          <StatCard label="Openstaand" value={String(mine.filter((e) => e.status === "submitted").length)} hint="Nog te accorderen" />
        )}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-knrm-navy">Mijn recente registraties</h2>
        {mine.length === 0 ? (
          <div className="card text-sm text-knrm-navy/60">
            Nog geen uren geregistreerd deze maand.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-knrm-sky text-left text-xs uppercase tracking-wide text-knrm-navy/60">
                <tr>
                  <th className="px-4 py-3">Datum</th>
                  <th className="px-4 py-3">Activiteit</th>
                  <th className="px-4 py-3">Uren</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-knrm-navy/5">
                {mine.slice(0, 8).map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3">{formatDate(e.entry_date)}</td>
                    <td className="px-4 py-3">
                      {e.main_activity_name}
                      {e.detail_activity_names.length > 0 && (
                        <span className="text-knrm-navy/50">
                          {" "}
                          · {e.detail_activity_names.join(", ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{minutesToHours(e.minutes)} u</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isLeader && summary.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-knrm-navy">Team deze maand</h2>
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-knrm-sky text-left text-xs uppercase tracking-wide text-knrm-navy/60">
                <tr>
                  <th className="px-4 py-3">Vrijwilliger</th>
                  <th className="px-4 py-3">Totaal</th>
                  <th className="px-4 py-3">Geaccordeerd</th>
                  <th className="px-4 py-3">Oefeningen</th>
                  <th className="px-4 py-3">Vergoeding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-knrm-navy/5">
                {summary.map((row) => (
                  <tr key={row.user_id}>
                    <td className="px-4 py-3 font-medium">{row.user_name}</td>
                    <td className="px-4 py-3">{minutesToHours(row.total_minutes)} u</td>
                    <td className="px-4 py-3">{minutesToHours(row.approved_minutes)} u</td>
                    <td className="px-4 py-3">{row.distinct_detail_activities}</td>
                    <td className="px-4 py-3">{euro(row.compensation_eur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
