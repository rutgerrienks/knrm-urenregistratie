import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "../api/client";
import type { TimeEntry } from "../api/types";
import { StatusBadge } from "../components/StatusBadge";
import { currentMonth, formatDate, minutesToHours, monthLabel } from "../lib/format";

export function ApprovalsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const refresh = useCallback(() => {
    void api
      .get<TimeEntry[]>(`/api/time-entries?month=${month}`)
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [month]);

  useEffect(refresh, [refresh]);

  const act = async (id: number, action: "approve" | "reject") => {
    setError(null);
    try {
      if (action === "reject") {
        const reason = prompt("Reden voor afkeuren (optioneel):") ?? undefined;
        await api.post(`/api/time-entries/${id}/reject`, { reason });
      } else {
        await api.post(`/api/time-entries/${id}/approve`);
      }
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Actie mislukt.");
    }
  };

  const approveAll = async () => {
    const pending = entries.filter((e) => e.status === "submitted");
    if (pending.length === 0) return;
    if (!confirm(`${pending.length} registratie(s) accorderen?`)) return;
    for (const e of pending) {
      // eslint-disable-next-line no-await-in-loop
      await api.post(`/api/time-entries/${e.id}/approve`).catch(() => undefined);
    }
    refresh();
  };

  const visible = showAll ? entries : entries.filter((e) => e.status === "submitted");
  const pendingCount = entries.filter((e) => e.status === "submitted").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-knrm-navy">Uren accorderen</h1>
          <p className="text-knrm-navy/60">
            Maandelijkse goedkeuring · {monthLabel(month)} · {pendingCount} openstaand
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="label">Maand</label>
            <input
              type="month"
              className="input"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <button onClick={approveAll} className="btn-primary" disabled={pendingCount === 0}>
            Alles accorderen
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-knrm-navy/70">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        Toon ook al verwerkte registraties
      </label>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {visible.length === 0 ? (
        <div className="card text-sm text-knrm-navy/60">Niets te accorderen voor deze maand.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-knrm-sky text-left text-xs uppercase tracking-wide text-knrm-navy/60">
              <tr>
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Vrijwilliger</th>
                <th className="px-4 py-3">Activiteit</th>
                <th className="px-4 py-3">Uren</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-knrm-navy/5">
              {visible.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3">{formatDate(e.entry_date)}</td>
                  <td className="px-4 py-3 font-medium">{e.user_name}</td>
                  <td className="px-4 py-3">
                    {e.main_activity_name}
                    {e.detail_activity_names.length > 0 && (
                      <span className="text-knrm-navy/50">
                        {" "}
                        · {e.detail_activity_names.join(", ")}
                      </span>
                    )}
                    {e.notes && <p className="text-xs text-knrm-navy/40">{e.notes}</p>}
                  </td>
                  <td className="px-4 py-3">{minutesToHours(e.minutes)} u</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {e.status !== "approved" && (
                        <button
                          onClick={() => act(e.id, "approve")}
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          Accorderen
                        </button>
                      )}
                      {e.status !== "rejected" && (
                        <button
                          onClick={() => act(e.id, "reject")}
                          className="text-xs font-semibold text-rose-600 hover:underline"
                        >
                          Afkeuren
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
