export type RevampOnboardingContext = {
  registryType?: "ALBO_A" | "ALBO_B";
  sourceChannel?: "PUBLIC" | "INVITE";
  inviteToken?: string;
  inviteId?: string;
  invitedName?: string;
  invitedEmail?: string;
};

const STORAGE_KEY = "revamp_onboarding_context";

export function saveRevampOnboardingContext(context: RevampOnboardingContext): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
}

export function loadRevampOnboardingContext(): RevampOnboardingContext | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RevampOnboardingContext;
  } catch {
    return null;
  }
}

export function clearRevampOnboardingContext(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
