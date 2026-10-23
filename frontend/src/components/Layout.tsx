import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard", roles: ["volunteer", "schipper", "admin"] },
  { to: "/registreren", label: "Uren registreren", roles: ["volunteer", "schipper", "admin"] },
  { to: "/accorderen", label: "Accorderen", roles: ["schipper", "admin"] },
  { to: "/geoefendheid", label: "Geoefendheid", roles: ["schipper", "admin"] },
  { to: "/rapportage", label: "Rapportage", roles: ["schipper", "admin"] },
  { to: "/beheer", label: "Beheer", roles: ["admin"] },
];

const roleLabels: Record<string, string> = {
  volunteer: "Vrijwilliger",
  schipper: "Schipper",
  admin: "Beheerder",
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const items = navItems.filter((i) => user && i.roles.includes(user.role));

  return (
    <div className="min-h-full">
      <header className="border-b border-knrm-navy/10 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/knrm-logo.svg" alt="KNRM" className="h-10 w-auto" />
            <div className="hidden sm:block">
              <p className="text-sm font-bold uppercase tracking-wide text-knrm-navy">
                Urenregistratie
              </p>
              <p className="text-xs text-knrm-navy/50">Vrijwilligersuren &amp; geoefendheid</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-knrm-navy">{user?.full_name}</p>
              <p className="text-xs text-knrm-navy/50">{user ? roleLabels[user.role] : ""}</p>
            </div>
            <button onClick={handleLogout} className="btn-ghost">
              Uitloggen
            </button>
          </div>
        </div>
        <nav className="border-t border-knrm-navy/5 bg-knrm-sand">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? "border-knrm-orange text-knrm-orange"
                      : "border-transparent text-knrm-navy/60 hover:text-knrm-navy"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-knrm-navy/40">
        KNRM Urenregistratie · pilot v1.2.0 · vrijwilligersvergoeding €1,25 per uur
      </footer>
    </div>
  );
}
