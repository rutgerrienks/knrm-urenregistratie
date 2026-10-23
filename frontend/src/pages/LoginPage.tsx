import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { acquireEntraIdToken, fetchSsoConfig, type SsoConfig } from "../auth/msal";

export function LoginPage() {
  const { login, loginSso } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sso, setSso] = useState<SsoConfig | null>(null);

  useEffect(() => {
    fetchSsoConfig()
      .then(setSso)
      .catch(() => setSso(null));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Inloggen mislukt.");
    } finally {
      setBusy(false);
    }
  };

  const handleSso = async () => {
    if (!sso?.enabled) return;
    setError(null);
    setBusy(true);
    try {
      const idToken = await acquireEntraIdToken(sso);
      await loginSso(idToken);
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else if (err instanceof Error && err.name === "BrowserAuthError") setError(null); // popup gesloten
      else setError("Inloggen met Microsoft mislukt.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-knrm-navy to-knrm-navy-light px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 rounded-2xl bg-white px-6 py-4 shadow-card">
            <img src="/knrm-logo.svg" alt="KNRM" className="h-14 w-auto" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Urenregistratie</h1>
          <p className="mt-1 text-sm text-white/70">
            Log in om je vrijwilligersuren te registreren.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label" htmlFor="email">
              E-mailadres
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Wachtwoord
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Bezig..." : "Inloggen"}
          </button>
          {sso?.enabled && (
            <>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <div className="h-px flex-1 bg-slate-200" />
                of
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <button
                type="button"
                className="btn-secondary w-full"
                disabled={busy}
                onClick={handleSso}
              >
                Inloggen met Microsoft
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
