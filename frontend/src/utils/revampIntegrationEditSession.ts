import type { RevampRegistryType } from "../api/revampApplicationApi";

export type RevampIntegrationEditSession = {
  applicationId: string;
  registryType: RevampRegistryType;
  targetStep: number;
  returnPath: string;
  requestedItems?: Array<{
    code: string;
    label?: string;
    documentType?: string;
    certificationKey?: string;
    targetStep?: number;
  }>;
};

const STORAGE_KEY = "revamp_integration_edit_session";
const REOPEN_DRAWER_KEY = "revamp_integration_reopen_drawer";

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

export function integrationEditCodes(session: RevampIntegrationEditSession | null): Set<string> {
  return new Set(
    (session?.requestedItems ?? [])
      .map((item) => item.code.trim().toUpperCase())
      .filter(Boolean)
  );
}

export function integrationEditHasAnyCode(session: RevampIntegrationEditSession | null, codes: string[]): boolean {
  const requested = integrationEditCodes(session);
  return codes.some((code) => requested.has(code.trim().toUpperCase()));
}

export function integrationEditCodeList(session: RevampIntegrationEditSession | null): string[] {
  return Array.from(integrationEditCodes(session));
}

export function requestRevampIntegrationDrawerReopen(applicationId: string): void {
  if (typeof window === "undefined" || !applicationId) return;
  window.sessionStorage.setItem(REOPEN_DRAWER_KEY, applicationId);
}

export function consumeRevampIntegrationDrawerReopen(applicationId: string): boolean {
  if (typeof window === "undefined" || !applicationId) return false;
  const stored = window.sessionStorage.getItem(REOPEN_DRAWER_KEY);
  if (stored !== applicationId) return false;
  window.sessionStorage.removeItem(REOPEN_DRAWER_KEY);
  return true;
}
