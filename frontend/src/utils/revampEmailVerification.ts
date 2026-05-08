const STORAGE_KEY = "revamp_email_verified";

export function markRevampEmailVerified(value: boolean): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, value ? "1" : "0");
}

export function isRevampEmailVerified(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(STORAGE_KEY) === "1";
}

export function clearRevampEmailVerified(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

