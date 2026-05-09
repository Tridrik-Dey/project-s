const STORAGE_KEY = "revamp_fcr_edit_session";

export type RevampFcrEditSession = {
  fcrId: string;
  applicationId: string;
  sectionKey: string;
  returnPath: string;
};

export function saveRevampFcrEditSession(session: RevampFcrEditSession): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadRevampFcrEditSession(): RevampFcrEditSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RevampFcrEditSession;
    if (!parsed.fcrId || !parsed.applicationId || !parsed.sectionKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearRevampFcrEditSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
