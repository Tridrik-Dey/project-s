import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AuthResponse } from "../types/api";
import { clearAuthState, loadAuthState, saveAuthState, type AuthState } from "../utils/storage";
import { clearRevampEmailVerified } from "../utils/revampEmailVerification";
import { clearRevampWizardSession } from "../utils/revampApplicationSession";

interface AuthContextValue {
  auth: AuthState | null;
  isAuthenticated: boolean;
  loginFromResponse: (response: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuthState());

  const logout = useCallback(() => {
    setAuth(null);
    clearAuthState();
    clearRevampEmailVerified();
    clearRevampWizardSession();
    sessionStorage.removeItem("supplier_identity_preview");
    window.dispatchEvent(new CustomEvent("supplier:identity-preview", { detail: null }));
  }, []);

  useEffect(() => {
    window.addEventListener("auth:expired", logout);
    return () => window.removeEventListener("auth:expired", logout);
  }, [logout]);

  const value = useMemo<AuthContextValue>(() => ({
    auth,
    isAuthenticated: Boolean(auth?.token),
    loginFromResponse: (response) => {
      const next: AuthState = {
        token: response.token,
        userId: response.userId,
        email: response.email,
        role: response.role,
        adminGovernanceRole: response.adminGovernanceRole,
        emailVerified: response.emailVerified,
      };
      clearRevampWizardSession();
      sessionStorage.removeItem("supplier_identity_preview");
      window.dispatchEvent(new CustomEvent("supplier:identity-preview", { detail: null }));
      setAuth(next);
      saveAuthState(next);
    },
    logout
  }), [auth, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
