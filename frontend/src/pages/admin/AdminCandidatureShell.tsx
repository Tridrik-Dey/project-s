import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Building2, ChevronDown, ClipboardList, Eye, LayoutDashboard, LogOut, MailPlus, Settings, ShieldCheck, Star, Users } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { useAdminGovernanceRole } from "../../hooks/useAdminGovernanceRole";
import { useAdminRealtimeRefresh } from "../../hooks/useAdminRealtimeRefresh";
import { SmtpSettingsModal } from "../../components/admin/SmtpSettingsModal";
import { listPendingAdminFieldChangeRequests } from "../../api/fieldChangeRequestApi";
import { getAdminReviewQueue } from "../../api/adminReviewApi";
import {
  ADMIN_CANDIDATURE_ATTENTION_SEEN_EVENT,
  getUnseenAdminAttentionIds
} from "../../utils/adminCandidatureAttention";

type AdminNavKey = "dashboard" | "alboA" | "alboB" | "candidature" | "inviti" | "valutazioni" | "report" | "impostazioni";

interface AdminCandidatureShellProps {
  active: AdminNavKey;
  children: ReactNode;
}

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  RESPONSABILE_ALBO: "Responsabile Albo",
  REVISORE: "Revisore",
  VIEWER: "Viewer",
};
const SIDEBAR_WIDTH_STORAGE_KEY = "admin.sidebar.width";
const SIDEBAR_EXPANDED_SESSION_KEY = "admin.sidebar.expanded";
const SIDEBAR_WIDTH_MIN = 84;
const SIDEBAR_WIDTH_MAX = 320;
const SIDEBAR_WIDTH_DEFAULT = 220;
const SIDEBAR_COMPACT_THRESHOLD = 132;
const SIDEBAR_COLLAPSE_DELAY_MS = 520;

function isFieldChangeQueueItem(item: { reviewType?: string | null; fieldChangeRequestId?: string | null }): boolean {
  return item.reviewType === "FIELD_CHANGE" || Boolean(item.fieldChangeRequestId);
}

function fieldChangeAttentionId(item: { id: string; fieldChangeRequestId?: string | null }): string {
  return item.fieldChangeRequestId?.trim() || item.id;
}

function clampSidebarWidth(value: number): number {
  return Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, value));
}

function roleTone(role: string | null | undefined): string {
  if (role === "SUPER_ADMIN") return "tone-super-admin";
  if (role === "RESPONSABILE_ALBO") return "tone-responsabile";
  if (role === "REVISORE") return "tone-revisore";
  if (role === "VIEWER") return "tone-viewer";
  return "tone-viewer";
}

function roleGlyph(role: string | null | undefined) {
  if (role === "SUPER_ADMIN") return <ShieldCheck size={14} />;
  if (role === "RESPONSABILE_ALBO") return <Building2 size={14} />;
  if (role === "REVISORE") return <Users size={14} />;
  return <Eye size={14} />;
}

function navClass(active: boolean): string {
  return active ? "active" : "";
}

function initials(name: string | null | undefined): string {
  const safe = (name ?? "").trim();
  if (!safe) return "AD";
  const parts = safe.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AdminCandidatureShell({ active, children }: AdminCandidatureShellProps) {
  const { auth, logout } = useAuth();
  const { adminRole, resolved } = useAdminGovernanceRole();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [smtpModalOpen, setSmtpModalOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const stored = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (!stored) return SIDEBAR_WIDTH_DEFAULT;
    const parsed = Number(stored);
    if (!Number.isFinite(parsed)) return SIDEBAR_WIDTH_DEFAULT;
    return clampSidebarWidth(parsed);
  });
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    return sessionStorage.getItem(SIDEBAR_EXPANDED_SESSION_KEY) === "true";
  });
  const [unseenFieldChangeCount, setUnseenFieldChangeCount] = useState(0);
  const [unseenNewCandidatureCount, setUnseenNewCandidatureCount] = useState(0);
  const userRef = useRef<HTMLDivElement>(null);
  const sidebarCollapseTimerRef = useRef<number | null>(null);
  const resizeRafRef = useRef<number | null>(null);
  const pendingWidthRef = useRef<number | null>(null);
  const resolvedRole = adminRole ? (roleLabel[adminRole] ?? adminRole) : "Admin";
  const resolvedRoleTone = roleTone(adminRole);
  const sidebarCompact = !sidebarExpanded || sidebarWidth <= SIDEBAR_COMPACT_THRESHOLD;
  const renderedSidebarWidth = sidebarExpanded ? sidebarWidth : SIDEBAR_WIDTH_MIN;
  const canManageFieldChanges = adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO";
  const canSeeCandidatureAttention = resolved && adminRole !== "VIEWER";
  const candidatureBadgeCount = unseenFieldChangeCount + unseenNewCandidatureCount;
  const candidatureHref = unseenFieldChangeCount > 0
    ? "/admin/candidature?tab=modifiche-dati"
    : unseenNewCandidatureCount > 0
      ? "/admin/candidature?tab=nuove-candidature"
      : "/admin/candidature";

  const loadCandidatureAttention = useCallback(async () => {
    if (!auth?.token || !canSeeCandidatureAttention) {
      setUnseenFieldChangeCount(0);
      setUnseenNewCandidatureCount(0);
      return;
    }
    try {
      const [fieldChanges, queue] = await Promise.all([
        canManageFieldChanges ? listPendingAdminFieldChangeRequests(auth.token) : Promise.resolve([]),
        getAdminReviewQueue(auth.token)
      ]);
      const pendingFieldChangeIds = fieldChanges.map((item) => item.id);
      const fieldChangeIds = canManageFieldChanges
        ? [
            ...pendingFieldChangeIds,
            ...queue
              .filter((item) => isFieldChangeQueueItem(item) && item.status !== "DECIDED")
              .filter((item) => !item.fieldChangeRequestId || !pendingFieldChangeIds.includes(item.fieldChangeRequestId))
              .map(fieldChangeAttentionId)
          ]
        : [];
      const newCandidatureIds = queue
        .filter((item) => item.status === "PENDING_ASSIGNMENT" && item.reviewType !== "FIELD_CHANGE")
        .map((item) => item.id);
      setUnseenFieldChangeCount(getUnseenAdminAttentionIds("fieldChanges", fieldChangeIds, auth.userId, auth.email).length);
      setUnseenNewCandidatureCount(getUnseenAdminAttentionIds("newCandidatures", newCandidatureIds, auth.userId, auth.email).length);
    } catch {
      setUnseenFieldChangeCount(0);
      setUnseenNewCandidatureCount(0);
    }
  }, [auth?.email, auth?.token, auth?.userId, canManageFieldChanges, canSeeCandidatureAttention]);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    sessionStorage.setItem(SIDEBAR_EXPANDED_SESSION_KEY, sidebarExpanded ? "true" : "false");
  }, [sidebarExpanded]);

  useEffect(() => {
    if (!popoverOpen) return;
    function handleOutside(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [popoverOpen]);

  useEffect(() => {
    void loadCandidatureAttention();
  }, [loadCandidatureAttention]);

  useEffect(() => {
    function handleAttentionSeen() {
      void loadCandidatureAttention();
    }
    window.addEventListener(ADMIN_CANDIDATURE_ATTENTION_SEEN_EVENT, handleAttentionSeen);
    return () => window.removeEventListener(ADMIN_CANDIDATURE_ATTENTION_SEEN_EVENT, handleAttentionSeen);
  }, [loadCandidatureAttention]);

  useAdminRealtimeRefresh({
    token: auth?.token ?? "",
    enabled: canSeeCandidatureAttention,
    shouldRefresh: (event) => {
      const key = event.eventKey ?? "";
      return key.startsWith("fcr.")
        || key.startsWith("document_renewal.")
        || key.startsWith("revamp.application.")
        || event.entityType === "FIELD_CHANGE_REQUEST"
        || event.entityType === "DOCUMENT_RENEWAL_REQUEST"
        || event.entityType === "REVAMP_APPLICATION";
    },
    onRefresh: () => loadCandidatureAttention()
  });

  useEffect(() => {
    return () => {
      if (sidebarCollapseTimerRef.current !== null) {
        window.clearTimeout(sidebarCollapseTimerRef.current);
        sidebarCollapseTimerRef.current = null;
      }
      if (resizeRafRef.current !== null) {
        window.cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
    };
  }, []);

  function expandSidebar() {
    if (sidebarCollapseTimerRef.current !== null) {
      window.clearTimeout(sidebarCollapseTimerRef.current);
      sidebarCollapseTimerRef.current = null;
    }
    setSidebarExpanded(true);
  }

  function scheduleSidebarCollapse() {
    if (sidebarResizing) return;
    if (sidebarCollapseTimerRef.current !== null) {
      window.clearTimeout(sidebarCollapseTimerRef.current);
    }
    sidebarCollapseTimerRef.current = window.setTimeout(() => {
      sidebarCollapseTimerRef.current = null;
      setSidebarExpanded(false);
    }, SIDEBAR_COLLAPSE_DELAY_MS);
  }

  function commitPendingResize() {
    const next = pendingWidthRef.current;
    pendingWidthRef.current = null;
    resizeRafRef.current = null;
    if (next === null) return;
    setSidebarWidth(clampSidebarWidth(next));
  }

  function onResizeStart(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const pointerId = event.pointerId;
    expandSidebar();
    setSidebarResizing(true);
    event.currentTarget.setPointerCapture(pointerId);

    function onPointerMove(moveEvent: PointerEvent) {
      pendingWidthRef.current = moveEvent.clientX;
      if (resizeRafRef.current !== null) return;
      resizeRafRef.current = window.requestAnimationFrame(commitPendingResize);
    }

    function onPointerUp() {
      setSidebarResizing(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  return (
    <section
      className={`superadmin-shell${sidebarResizing ? " is-resizing-sidebar" : ""}`}
      style={{ "--sidebar-width": `${renderedSidebarWidth}px` } as CSSProperties}
    >
      <aside
        className={`superadmin-sidebar${sidebarCompact ? " is-compact" : " is-expanded"}`}
        onMouseEnter={expandSidebar}
        onMouseLeave={scheduleSidebarCollapse}
        onFocusCapture={expandSidebar}
        onBlurCapture={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          scheduleSidebarCollapse();
        }}
      >
        <div className="superadmin-brand">
          <strong>Solco</strong>
          <span>Albo Fornitori</span>
        </div>
        <nav className="superadmin-nav">
          <Link to="/admin/dashboard" className={navClass(active === "dashboard")}><LayoutDashboard className="superadmin-nav-icon h-4 w-4" /> <span className="superadmin-nav-label">Dashboard</span></Link>
          <Link to="/admin/albo-a" className={navClass(active === "alboA")}><Users className="superadmin-nav-icon h-4 w-4" /> <span className="superadmin-nav-label">Fornitori (Albo A)</span></Link>
          <Link to="/admin/albo-b" className={navClass(active === "alboB")}><Building2 className="superadmin-nav-icon h-4 w-4" /> <span className="superadmin-nav-label">Aziende (Albo B)</span></Link>
          {resolved && adminRole !== "VIEWER" && (
            <Link to={candidatureHref} className={navClass(active === "candidature")}>
              <ClipboardList className="superadmin-nav-icon h-4 w-4" />
              <span className="superadmin-nav-label">Candidature</span>
              {candidatureBadgeCount > 0 ? <span className="superadmin-nav-count">{candidatureBadgeCount}</span> : null}
            </Link>
          )}
          {resolved && (adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO") && (
            <Link to="/admin/invites" className={navClass(active === "inviti")}><MailPlus className="superadmin-nav-icon h-4 w-4" /> <span className="superadmin-nav-label">Inviti</span></Link>
          )}
          {resolved && (
            <Link to="/admin/evaluations" className={navClass(active === "valutazioni")}><Star className="superadmin-nav-icon h-4 w-4" /> <span className="superadmin-nav-label">Valutazioni</span></Link>
          )}
          {resolved && (adminRole === "SUPER_ADMIN" || adminRole === "RESPONSABILE_ALBO") && (
            <Link to="/admin/reports" className={navClass(active === "report")}><BarChart3 className="superadmin-nav-icon h-4 w-4" /> <span className="superadmin-nav-label">Report</span></Link>
          )}
          {resolved && adminRole === "SUPER_ADMIN" && (
            <Link to="/admin/users-roles" className={navClass(active === "impostazioni")}><Settings className="superadmin-nav-icon h-4 w-4" /> <span className="superadmin-nav-label">Impostazioni</span></Link>
          )}
        </nav>
        {auth && (
          <div
            ref={userRef}
            className={`superadmin-user${popoverOpen ? " is-open" : ""}`}
            onClick={() => setPopoverOpen(o => !o)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === "Enter" && setPopoverOpen(o => !o)}
          >
            <div className="superadmin-user-main">
              <div className="superadmin-user-avatar">
                {initials(auth.email)}
              </div>
              <div style={{ minWidth: 0 }}>
                <span className="superadmin-user-name">{auth.email}</span>
                <span className="superadmin-user-email">{auth.email}</span>
                <span className={`superadmin-role-badge ${resolvedRoleTone}`}>{resolvedRole}</span>
              </div>
              <span className={`superadmin-user-role-icon ${resolvedRoleTone}`} aria-label={resolvedRole} title={resolvedRole}>
                {roleGlyph(adminRole)}
              </span>
              <ChevronDown size={14} className={`superadmin-user-chevron${popoverOpen ? " is-open" : ""}`} />
            </div>
            {popoverOpen && (
              <div className="superadmin-user-inline-menu">
                {adminRole === "SUPER_ADMIN" && (
                  <button
                    className="superadmin-user-popover-logout"
                    title="Impostazioni SMTP"
                    onClick={e => { e.stopPropagation(); setPopoverOpen(false); setSmtpModalOpen(true); }}
                  >
                    <Settings size={14} />
                  </button>
                )}
                <button
                  className="superadmin-user-popover-logout"
                  onClick={e => { e.stopPropagation(); logout(); }}
                >
                  <LogOut size={14} />
                  Esci
                </button>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          className="superadmin-sidebar-resizer"
          onPointerDown={onResizeStart}
          aria-label="Ridimensiona barra laterale"
          title="Trascina per ridimensionare"
        />
      </aside>
      <div className="superadmin-content">{children}</div>
      {smtpModalOpen && auth?.token && (
        <SmtpSettingsModal token={auth.token} onClose={() => setSmtpModalOpen(false)} />
      )}
    </section>
  );
}
