import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getMyLatestRevampApplication } from "../../api/revampApplicationApi";
import { useAuth } from "../../auth/AuthContext";

function registryPath(registryType?: string | null): string | null {
  if (registryType === "ALBO_A") return "/apply/albo-a/my-profile";
  if (registryType === "ALBO_B") return "/apply/albo-b/my-profile";
  return null;
}

function isSentApplication(status?: string | null): boolean {
  return Boolean(status && status !== "DRAFT");
}

export function RevampSupplierHomeRedirect() {
  const { auth } = useAuth();
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!auth?.token) {
      setLoaded(true);
      return;
    }
    const token = auth.token;
    let cancelled = false;
    async function loadLatest() {
      try {
        const latest = await getMyLatestRevampApplication(token);
        if (cancelled) return;
        setRedirectTo(isSentApplication(latest?.status) ? (registryPath(latest?.registryType) ?? "/apply") : "/apply");
      } catch {
        if (!cancelled) setRedirectTo("/apply");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void loadLatest();
    return () => {
      cancelled = true;
    };
  }, [auth?.token]);

  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <section className="stack">
      <div className="panel">
        <h2>{loaded ? "Apertura area fornitore..." : "Caricamento area fornitore..."}</h2>
      </div>
    </section>
  );
}
