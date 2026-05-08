import type { RevampRegistryType } from "../api/revampApplicationApi";

export type RevampIntegrationEditSession = {
  applicationId: string;
  registryType: RevampRegistryType;
  targetStep: number;
  returnPath: string;
};

const STORAGE_KEY = "revamp_integration_edit_session";

export function saveRevampIntegrationEditSession(session: RevampIntegrationEditSession): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadRevampIntegrationEditSession(): RevampIntegrationEditSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RevampIntegrationEditSession;
    if (!parsed.applicationId || !parsed.registryType || !parsed.returnPath) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearRevampIntegrationEditSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function isRevampIntegrationEditFor(
  registryType: RevampRegistryType,
  step: number
): RevampIntegrationEditSession | null {
  const session = loadRevampIntegrationEditSession();
  if (!session || session.registryType !== registryType || session.targetStep !== step) return null;
  return session;
}
