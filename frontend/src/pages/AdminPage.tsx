import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "../api/client";
import type { MainActivity, PayoutMode, Role, Station, User } from "../api/types";

const roleLabels: Record<Role, string> = {
  volunteer: "Vrijwilliger",
  schipper: "Schipper",
  admin: "Beheerder",
};

const payoutLabels: Record<PayoutMode, string> = {
  individual: "Individueel",
  crew_pot: "Bemanningspot",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="mb-4 text-lg font-bold text-knrm-navy">{title}</h2>
      {children}
    </section>
  );
}

export function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [activities, setActivities] = useState<MainActivity[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void api.get<User[]>("/api/users").then(setUsers).catch(() => undefined);
    void api.get<Station[]>("/api/stations").then(setStations).catch(() => undefined);
    void api
      .get<MainActivity[]>("/api/activities?include_inactive=true")
      .then(setActivities)
      .catch(() => undefined);
  }, []);

  useEffect(refresh, [refresh]);

  // New user form
  const [nu, setNu] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "volunteer" as Role,
    station_id: "" as number | "",
  });

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/api/users", {
        full_name: nu.full_name,
        email: nu.email,
        password: nu.password,
        role: nu.role,
        station_id: nu.station_id === "" ? null : nu.station_id,
      });
      setNu({ full_name: "", email: "", password: "", role: "volunteer", station_id: "" });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Aanmaken mislukt.");
    }
  };

  const [newStation, setNewStation] = useState("");
  const createStation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/stations", { name: newStation });
      setNewStation("");
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Aanmaken mislukt.");
    }
  };

  const [newMain, setNewMain] = useState("");
  const addMain = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/api/activities/main", { name: newMain }).catch(() => undefined);
    setNewMain("");
    refresh();
  };

  const addDetail = async (mainId: number, name: string) => {
    if (!name.trim()) return;
    await api
      .post("/api/activities/detail", { name, main_activity_id: mainId })
      .catch(() => undefined);
    refresh();
  };

  const renameMain = async (main: MainActivity) => {
    const name = window.prompt("Nieuwe naam voor hoofdactiviteit:", main.name);
    if (!name || name === main.name) return;
    await api.put(`/api/activities/main/${main.id}`, { name }).catch(() => undefined);
    refresh();
  };

  const toggleMain = async (main: MainActivity) => {
    await api
      .put(`/api/activities/main/${main.id}`, { is_active: !main.is_active })
      .catch(() => undefined);
    refresh();
  };

  const renameDetail = async (id: number, currentName: string) => {
    const name = window.prompt("Nieuwe naam voor detailactiviteit:", currentName);
    if (!name || name === currentName) return;
    await api.put(`/api/activities/detail/${id}`, { name }).catch(() => undefined);
    refresh();
  };

  const toggleDetail = async (id: number, isActive: boolean) => {
    await api.put(`/api/activities/detail/${id}`, { is_active: !isActive }).catch(() => undefined);
    refresh();
  };

  const setPayoutMode = async (station: Station, mode: PayoutMode) => {
    await api.put(`/api/stations/${station.id}`, { payout_mode: mode }).catch(() => undefined);
    refresh();
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-extrabold text-knrm-navy">Beheer</h1>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <Section title="Gebruikers">
        <div className="mb-6 overflow-hidden rounded-xl border border-knrm-navy/10">
          <table className="w-full text-sm">
            <thead className="bg-knrm-sky text-left text-xs uppercase text-knrm-navy/60">
              <tr>
                <th className="px-4 py-2">Naam</th>
                <th className="px-4 py-2">E-mail</th>
                <th className="px-4 py-2">Rol</th>
                <th className="px-4 py-2">Station</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-knrm-navy/5">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-2 font-medium">{u.full_name}</td>
                  <td className="px-4 py-2 text-knrm-navy/70">{u.email}</td>
                  <td className="px-4 py-2">{roleLabels[u.role]}</td>
                  <td className="px-4 py-2">
                    {stations.find((s) => s.id === u.station_id)?.name ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={createUser} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            className="input"
            placeholder="Volledige naam"
            value={nu.full_name}
            onChange={(e) => setNu({ ...nu, full_name: e.target.value })}
            required
          />
          <input
            className="input"
            type="email"
            placeholder="E-mail"
            value={nu.email}
            onChange={(e) => setNu({ ...nu, email: e.target.value })}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Wachtwoord"
            value={nu.password}
            onChange={(e) => setNu({ ...nu, password: e.target.value })}
            required
          />
          <select
            className="input"
            value={nu.role}
            onChange={(e) => setNu({ ...nu, role: e.target.value as Role })}
          >
            <option value="volunteer">Vrijwilliger</option>
            <option value="schipper">Schipper</option>
            <option value="admin">Beheerder</option>
          </select>
          <select
            className="input"
            value={nu.station_id}
            onChange={(e) =>
              setNu({ ...nu, station_id: e.target.value === "" ? "" : Number(e.target.value) })
            }
          >
            <option value="">Geen station</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary sm:col-span-2 lg:col-span-5">
            Gebruiker toevoegen
          </button>
        </form>
      </Section>

      <Section title="Stations">
        <div className="mb-4 overflow-hidden rounded-xl border border-knrm-navy/10">
          <table className="w-full text-sm">
            <thead className="bg-knrm-sky text-left text-xs uppercase text-knrm-navy/60">
              <tr>
                <th className="px-4 py-2">Station</th>
                <th className="px-4 py-2">Uitbetaling vergoeding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-knrm-navy/5">
              {stations.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2">
                    <select
                      className="input max-w-xs"
                      value={s.payout_mode}
                      onChange={(e) => void setPayoutMode(s, e.target.value as PayoutMode)}
                    >
                      {(Object.keys(payoutLabels) as PayoutMode[]).map((mode) => (
                        <option key={mode} value={mode}>
                          {payoutLabels[mode]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form onSubmit={createStation} className="flex gap-3">
          <input
            className="input"
            placeholder="Nieuw station"
            value={newStation}
            onChange={(e) => setNewStation(e.target.value)}
            required
          />
          <button type="submit" className="btn-secondary whitespace-nowrap">
            Toevoegen
          </button>
        </form>
      </Section>

      <Section title="Activiteiten (hoofd- & detailactiviteiten)">
        <div className="space-y-4">
          {activities.map((main) => (
            <div key={main.id} className="rounded-xl border border-knrm-navy/10 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-bold text-knrm-navy">
                  {main.name}
                  {!main.is_active && (
                    <span className="ml-2 text-xs text-knrm-navy/40">(inactief)</span>
                  )}
                </h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => void renameMain(main)}
                    className="text-xs font-semibold text-knrm-navy/60 hover:underline"
                  >
                    Bewerken
                  </button>
                  <button
                    onClick={() => void toggleMain(main)}
                    className="text-xs font-semibold text-knrm-navy/60 hover:underline"
                  >
                    {main.is_active ? "Deactiveren" : "Activeren"}
                  </button>
                </div>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {main.details.map((d) => (
                  <span
                    key={d.id}
                    className={`badge inline-flex items-center gap-1 ${
                      d.is_active
                        ? "bg-knrm-sand text-knrm-navy/70"
                        : "bg-knrm-navy/5 text-knrm-navy/35 line-through"
                    }`}
                  >
                    <button
                      onClick={() => void renameDetail(d.id, d.name)}
                      title="Naam bewerken"
                      className="hover:underline"
                    >
                      {d.name}
                    </button>
                    <button
                      onClick={() => void toggleDetail(d.id, d.is_active)}
                      title={d.is_active ? "Deactiveren" : "Activeren"}
                      className="font-bold no-underline"
                    >
                      {d.is_active ? "×" : "+"}
                    </button>
                  </span>
                ))}
              </div>
              <DetailAdder onAdd={(name) => addDetail(main.id, name)} />
            </div>
          ))}
        </div>
        <form onSubmit={addMain} className="mt-4 flex gap-3">
          <input
            className="input"
            placeholder="Nieuwe hoofdactiviteit"
            value={newMain}
            onChange={(e) => setNewMain(e.target.value)}
            required
          />
          <button type="submit" className="btn-secondary whitespace-nowrap">
            Toevoegen
          </button>
        </form>
      </Section>
    </div>
  );
}

function DetailAdder({ onAdd }: { onAdd: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(value);
        setValue("");
      }}
      className="flex gap-2"
    >
      <input
        className="input"
        placeholder="Detailactiviteit toevoegen"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="btn-ghost whitespace-nowrap text-sm">
        + Toevoegen
      </button>
    </form>
  );
}
