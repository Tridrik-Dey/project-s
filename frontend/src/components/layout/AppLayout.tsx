import { ChevronDown, House, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useI18n } from "../../i18n/I18nContext";

const BARE_PATHS = ["/", "/login", "/register", "/verify-otp", "/activate-account", "/accept-admin-invite", "/privacy"];

function loadSupplierIdentityPreview(): { name: string; initials: string } | null {
  try {
    const raw = sessionStorage.getItem("supplier_identity_preview");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { name?: unknown; initials?: unknown };
    if (typeof parsed.name === "string" && typeof parsed.initials === "string" && parsed.name && parsed.initials) {
      return { name: parsed.name, initials: parsed.initials };
    }
  } catch {
    return null;
  }
  return null;
}

function formatAdminGovernanceRole(role: string | null): string | null {
  if (!role) return null;
  if (role === "SUPER_ADMIN") return "SUPER ADMIN";
  if (role === "RESPONSABILE_ALBO") return "RESPONSABILE ALBO";
  if (role === "REVISORE") return "REVISORE";
  if (role === "VIEWER") return "VIEWER";
  return role;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { auth, logout } = useAuth();
  const { adminRole } = useAdminGovernanceRole();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [topbarRipple, setTopbarRipple] = useState<{ id: number; x: number; y: number } | null>(null);
  const [supplierIdentityPreview, setSupplierIdentityPreview] = useState<{ name: string; initials: string } | null>(() => loadSupplierIdentityPreview());
  const [formUserMenuOpen, setFormUserMenuOpen] = useState(false);
  const appVersion = import.meta.env.VITE_APP_VERSION ?? "v1.0.0";
  const currentYear = new Date().getFullYear();
  const roleLabel = auth?.role === "ADMIN"
    ? (formatAdminGovernanceRole(adminRole) ?? t("nav.admin"))
    : auth?.role === "SUPPLIER"
      ? t("nav.supplier")
      : auth?.role ?? "";
  const roleClass = auth?.role === "ADMIN" ? "is-admin" : auth?.role === "SUPPLIER" ? "is-supplier" : "";
  const initials = supplierIdentityPreview?.initials || (auth?.email
    ? auth.email.split("@")[0].slice(0, 2).toUpperCase()
    : "");
  const userDisplayName = supplierIdentityPreview?.name || auth?.email || "";
  const isSupplierFormPage = auth?.role === "SUPPLIER" && (
    location.pathname === "/apply" ||
    (location.pathname.startsWith("/apply/") && !location.pathname.endsWith("/my-profile")) ||
    (location.pathname.startsWith("/application/") && !location.pathname.endsWith("/submitted"))
  );
  const navItems = [
    { to: "/", end: true, label: t("nav.home"), icon: House },
    { to: "/supplier/dashboard", end: false, label: t("nav.supplier"), icon: UserRound },
    { to: "/admin/dashboard", end: false, label: t("nav.admin"), icon: ShieldCheck }
  ] as const;

  useEffect(() => {
    const onScroll = () => setIsHeaderScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onIdentityPreview = (event: Event) => {
      const detail = (event as CustomEvent<{ name: string; initials: string } | null>).detail;
      setSupplierIdentityPreview(detail?.name && detail?.initials ? detail : null);
    };
    window.addEventListener("supplier:identity-preview", onIdentityPreview);
    return () => window.removeEventListener("supplier:identity-preview", onIdentityPreview);
  }, []);

  const handleTopbarMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setTopbarRipple((prev) => ({ id: (prev?.id ?? 0) + 1, x, y }));
  };

  const openSupportModal = () => {
    window.dispatchEvent(new Event("open-support-modal"));
  };

  const handleFooterSupportClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (location.pathname === "/") {
      openSupportModal();
      return;
    }
    navigate("/?support=1");
  };

  if (
    location.pathname.startsWith("/admin") ||
    location.pathname.endsWith("/my-profile") ||
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/forgot-password" ||
    location.pathname === "/forgot-password/verify"
  ) {
    return <>{children}</>;
  }

  if (isSupplierFormPage) {
    return (
      <div className="app-shell supplier-form-shell">
        <header className="supplier-dashboard-header">
          <Link to="/" className="supplier-dashboard-brand">
            <div className="supplier-dashboard-logo-mark"><div /></div>
            <div className="supplier-dashboard-brand-text">
              <span className="supplier-dashboard-brand-name">Solco<sup>+</sup></span>
              <span className="supplier-dashboard-brand-subtitle">Albo Fornitori Digitale</span>
            </div>
          </Link>

          <div className="supplier-dashboard-user">
            <button
              type="button"
              className={`supplier-dashboard-user-button${formUserMenuOpen ? " is-open" : ""}`}
              onClick={() => setFormUserMenuOpen((open) => !open)}
            >
              <span className="supplier-dashboard-user-avatar">{initials}</span>
              <span className="supplier-dashboard-user-name">{userDisplayName}</span>
              <ChevronDown size={14} className={formUserMenuOpen ? "is-open" : ""} />
            </button>
            {formUserMenuOpen ? (
              <>
                <div className="supplier-dashboard-user-backdrop" onClick={() => setFormUserMenuOpen(false)} />
                <div className="supplier-dashboard-user-menu">
                  <div className="supplier-dashboard-user-menu-head">
                    <strong>{userDisplayName}</strong>
                    {auth?.email ? <span>{auth.email}</span> : null}
                  </div>
                  <button type="button" onClick={logout}>
                    <LogOut className="h-4 w-4" />
                    <span>{t("auth.logout")}</span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </header>
        <main className="content supplier-form-content">{children}</main>
      </div>
    );
  }
  const isBarePage = BARE_PATHS.includes(location.pathname) || location.pathname.startsWith("/invite/");

  if (isBarePage) {
    return (
      <div className="app-shell">
        <header className={`topbar ${isHeaderScrolled ? "is-scrolled" : ""}`} style={{ padding: "0 1.5rem", minHeight: 64 }}>
          {/* Brand */}
          <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, background: "#f5c800", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span style={{ fontWeight: 900, fontSize: "1.35rem", color: "#fff", letterSpacing: "-0.02em", fontFamily: "'Outfit', sans-serif" }}>
                Solco<sup style={{ fontSize: "0.45em", color: "#f5c800", verticalAlign: "super" }}>+</sup>
              </span>
              <span style={{ fontWeight: 500, fontSize: "0.66rem", color: "rgba(255,255,255,0.7)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                Albo Fornitori Digitale
              </span>
            </div>
          </Link>

        </header>
        <main className="content" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</main>
        <footer className="app-footer">
          <div className="app-footer-left">{t("footer.copyright", { year: currentYear })}</div>
          <div className="app-footer-right">
            <Link to="/privacy">{t("footer.privacy")}</Link>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className={`topbar ${isHeaderScrolled ? "is-scrolled" : ""}`} onMouseEnter={handleTopbarMouseEnter}>
        {topbarRipple ? (
          <span
            key={topbarRipple.id}
            className="topbar-ripple"
            style={{ left: `${topbarRipple.x}px`, top: `${topbarRipple.y}px` }}
            aria-hidden="true"
          />
        ) : null}
        <Link to="/" style={{ textDecoration: "none", display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
          <span style={{ fontWeight: 800, fontSize: "clamp(1.25rem, 1.3vw, 1.45rem)", color: "#fff", letterSpacing: "-0.01em", fontFamily: "'Outfit', sans-serif" }}>Solco</span>
          <span style={{ fontWeight: 500, fontSize: "0.72rem", color: "rgba(255,255,255,0.78)", letterSpacing: "0.04em", textTransform: "uppercase" as const }}>Albo Fornitori</span>
        </Link>
        <div className="topbar-right">
          {auth ? (
            <>
              <span className={`user-chip ${roleClass}`}>
                <span className="user-avatar" aria-hidden="true">{initials}</span>
                <span className="user-name">{userDisplayName}</span>
                <span className={`role-pill ${roleClass}`}>{roleLabel}</span>
              </span>
              <button type="button" className="logout-btn" onClick={logout}>
                <LogOut className="logout-icon h-4 w-4" />
                <span>{t("auth.logout")}</span>
              </button>
            </>
          ) : null}
        </div>
      </header>
      <nav className={`tabs ${isHeaderScrolled ? "is-scrolled" : ""}`}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => isActive ? "tab-link active" : "tab-link"}
          >
            <item.icon className="tab-link-icon h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="content">{children}</main>
      <footer className="app-footer">
        <div className="app-footer-left">{t("footer.copyright", { year: currentYear })}</div>
        <div className="app-footer-right">
          <span>{t("footer.version")}: {appVersion}</span>
          <Link to="/privacy">{t("footer.privacy")}</Link>
          <a href="#" onClick={(e) => e.preventDefault()}>{t("footer.cookies")}</a>
          <a href="#" onClick={handleFooterSupportClick}>{t("footer.support")}</a>
          <span className="app-footer-powered">
            <span>{t("footer.poweredBy")}</span>
            <img src="/logo_solco.png" alt="SOLCO" />
          </span>
        </div>
      </footer>
    </div>
  );
}

