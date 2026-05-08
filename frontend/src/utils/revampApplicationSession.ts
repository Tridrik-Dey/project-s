export type RevampApplicationSession = {
  applicationId: string;
  registryType?: "ALBO_A" | "ALBO_B";
  status?: string;
  protocolCode?: string | null;
  updatedAt?: string;
  resumePath?: string;
};

const STORAGE_KEY = "revamp_application_session";
const LEGACY_APPLICATION_ID_KEY = "revamp_applicationId";

export function saveRevampApplicationSession(session: RevampApplicationSession): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  if (session.registryType) {
    window.sessionStorage.setItem(applicationIdKeyForRegistry(session.registryType), session.applicationId);
  }
}

export function loadRevampApplicationSession(): RevampApplicationSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RevampApplicationSession;
  } catch {
    return null;
  }
}

export function clearRevampApplicationSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function applicationIdKeyForRegistry(registryType: "ALBO_A" | "ALBO_B"): string {
  return `revamp_applicationId_${registryType}`;
}

export function saveRevampApplicationIdForRegistry(registryType: "ALBO_A" | "ALBO_B", applicationId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(applicationIdKeyForRegistry(registryType), applicationId);
  window.sessionStorage.removeItem(LEGACY_APPLICATION_ID_KEY);
}

export function loadRevampApplicationIdForRegistry(registryType: "ALBO_A" | "ALBO_B"): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(applicationIdKeyForRegistry(registryType));
}

export function clearRevampApplicationIdForRegistry(registryType: "ALBO_A" | "ALBO_B"): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(applicationIdKeyForRegistry(registryType));
}

export function clearLegacyRevampApplicationId(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(LEGACY_APPLICATION_ID_KEY);
}

export function clearRevampWizardSession(): void {
  if (typeof window === "undefined") return;
  const toRemove: string[] = [];
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const key = window.sessionStorage.key(i);
    if (key && key.startsWith("revamp_")) toRemove.push(key);
  }
  toRemove.forEach(k => window.sessionStorage.removeItem(k));
}
