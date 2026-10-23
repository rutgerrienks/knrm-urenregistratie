import { useEffect, useMemo, useState } from "react";

import { api, ApiError } from "../api/client";
import type { MainActivity, TimeEntry, User } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate, minutesToHours } from "../lib/format";

const HALF_HOUR_OPTIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 30);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RegisterPage() {
  const { user } = useAuth();
  const isLeader = user?.role === "schipper" || user?.role === "admin";

  const [activities, setActivities] = useState<MainActivity[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);

  const [targetUserId, setTargetUserId] = useState<number | undefined>(user?.id);
  const [entryDate, setEntryDate] = useState(today());
  const [mainId, setMainId] = useState<number | "">("");
  const [detailIds, setDetailIds] = useState<number[]>([]);
  const [minutes, setMinutes] = useState(60);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    api.get<TimeEntry[]>("/api/time-entries").then(setEntries).catch(() => setEntries([]));

  useEffect(() => {
    void api.get<MainActivity[]>("/api/activities").then(setActivities);
    void refresh();
    if (isLeader) {
      void api.get<User[]>("/api/users").then(setTeamMembers).catch(() => setTeamMembers([]));
    }
  }, [isLeader]);

  const details = useMemo(
    () => activities.find((a) => a.id === mainId)?.details ?? [],
    [activities, mainId],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    if (mainId === "") {
      setError("Kies een hoofdactiviteit.");
      return;
    }
    setBusy(true);
    try {
      await api.post<TimeEntry>("/api/time-entries", {
        user_id: targetUserId ?? user?.id,
        entry_date: entryDate,
        main_activity_id: mainId,
        detail_activity_ids: detailIds,
        minutes,
        notes: notes || null,
      });
      setOk("Uren geregistreerd.");
      setDetailIds([]);
      setNotes("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registreren mislukt.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Deze registratie verwijderen?")) return;
    try {
      await api.del(`/api/time-entries/${id}`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verwijderen mislukt.");
    }
  };

  const myEntries = entries.filter((e) =>
    isLeader ? true : e.user_id === user?.id,
  );

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      <section className="lg:col-span-2">
        <div className="card">
          <h1 className="mb-1 text-xl font-extrabold text-knrm-navy">Uren registreren</h1>
          <p className="mb-4 text-sm text-knrm-navy/60">
            Minimaal een half uur. Kies de activiteit en, waar mogelijk, de specifieke oefening.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isLeader && (
              <div>
                <label className="label">Voor wie</label>
                <select
                  className="input"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(Number(e.target.value))}
                >
                  <option value={user?.id}>Mezelf ({user?.full_name})</option>
                  {teamMembers
                    .filter((m) => m.id !== user?.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">Datum</label>
              <input
                type="date"
                className="input"
                value={entryDate}
                max={today()}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Hoofdactiviteit</label>
              <select
                className="input"
                value={mainId}
                onChange={(e) => {
                  setMainId(e.target.value === "" ? "" : Number(e.target.value));
                  setDetailIds([]);
                }}
                required
              >
                <option value="">Kies...</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            {details.length > 0 && (
              <div>
                <label className="label">Detailactiviteiten (meerdere mogelijk)</label>
                <p className="mb-2 text-xs text-knrm-navy/50">
                  Bij een scenario-oefening kun je alle geoefende onderdelen aanvinken (bijv.
                  navigatie, brandbestrijding, EHBO en slepen).
                </p>
                <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-knrm-navy/10 p-3 sm:grid-cols-2">
                  {details
                    .filter((d) => d.is_active)
                    .map((d) => (
                      <label key={d.id} className="flex items-center gap-2 text-sm text-knrm-navy">
                        <input
                          type="checkbox"
                          checked={detailIds.includes(d.id)}
                          onChange={(e) =>
                            setDetailIds((prev) =>
                              e.target.checked ? [...prev, d.id] : prev.filter((x) => x !== d.id),
                            )
                          }
                        />
                        {d.name}
                      </label>
                    ))}
                </div>
              </div>
            )}
            <div>
              <label className="label">Tijdsduur</label>
              <select
                className="input"
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              >
                {HALF_HOUR_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {minutesToHours(m)} uur
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Toelichting (optioneel)</label>
              <textarea
                className="input"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            {ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Bezig..." : "Uren opslaan"}
            </button>
          </form>
        </div>
      </section>

      <section className="lg:col-span-3">
        <h2 className="mb-3 text-lg font-bold text-knrm-navy">
          {isLeader ? "Registraties (station)" : "Mijn registraties"}
        </h2>
        {myEntries.length === 0 ? (
          <div className="card text-sm text-knrm-navy/60">Nog geen registraties.</div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-knrm-sky text-left text-xs uppercase tracking-wide text-knrm-navy/60">
                <tr>
                  <th className="px-4 py-3">Datum</th>
                  {isLeader && <th className="px-4 py-3">Wie</th>}
                  <th className="px-4 py-3">Activiteit</th>
                  <th className="px-4 py-3">Uren</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-knrm-navy/5">
                {myEntries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3">{formatDate(e.entry_date)}</td>
                    {isLeader && <td className="px-4 py-3">{e.user_name}</td>}
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
                    <td className="px-4 py-3 text-right">
                      {(e.status !== "approved" || isLeader) && (
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="text-xs font-semibold text-rose-600 hover:underline"
                        >
                          Verwijderen
                        </button>
                      )}
                    </td>
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
