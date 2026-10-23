import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { api, setToken } from "../api/client";
import type { User } from "../api/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginSso: (idToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const me = await api.get<User>("/api/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { access_token } = await api.post<{ access_token: string }>("/api/auth/login", {
        email,
        password,
      });
      setToken(access_token);
      await loadMe();
    },
    [loadMe],
  );

  const loginSso = useCallback(
    async (idToken: string) => {
      const { access_token } = await api.post<{ access_token: string }>("/api/auth/sso", {
        id_token: idToken,
      });
      setToken(access_token);
      await loadMe();
    },
    [loadMe],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, loginSso, logout }),
    [user, loading, login, loginSso, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth moet binnen AuthProvider gebruikt worden.");
  return ctx;
}
