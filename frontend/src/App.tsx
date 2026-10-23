import { Navigate, Route, Routes } from "react-router-dom";

import type { Role } from "./api/types";
import { useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { AdminPage } from "./pages/AdminPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ProficiencyPage } from "./pages/ProficiencyPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ReportsPage } from "./pages/ReportsPage";

function Protected({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center text-knrm-navy/50">Laden...</div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={!loading && user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={
          <Protected>
            <DashboardPage />
          </Protected>
        }
      />
      <Route
        path="/registreren"
        element={
          <Protected>
            <RegisterPage />
          </Protected>
        }
      />
      <Route
        path="/accorderen"
        element={
          <Protected roles={["schipper", "admin"]}>
            <ApprovalsPage />
          </Protected>
        }
      />
      <Route
        path="/geoefendheid"
        element={
          <Protected roles={["schipper", "admin"]}>
            <ProficiencyPage />
          </Protected>
        }
      />
      <Route
        path="/rapportage"
        element={
          <Protected roles={["schipper", "admin"]}>
            <ReportsPage />
          </Protected>
        }
      />
      <Route
        path="/beheer"
        element={
          <Protected roles={["admin"]}>
            <AdminPage />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
