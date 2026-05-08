import { useEffect, useState } from "react";
import { getMyAdminUsersRolesProfile, type AdminRole } from "../api/adminUsersRolesApi";
import { useAuth } from "../auth/AuthContext";

export function useAdminGovernanceRole() {
  const { auth } = useAuth();
  const token = auth?.token ?? "";
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!token || auth?.role !== "ADMIN") {
      setAdminRole(null);
      setLoading(false);
      setResolved(true);
      return;
    }
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const me = await getMyAdminUsersRolesProfile(token);
        if (alive) {
          setAdminRole(me.adminRoles[0] ?? null);
        }
      } catch {
        if (alive) {
          setAdminRole(null);
        }
      } finally {
        if (alive) {
          setLoading(false);
          setResolved(true);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [auth?.role, token]);

  return { adminRole, loading, resolved };
}
