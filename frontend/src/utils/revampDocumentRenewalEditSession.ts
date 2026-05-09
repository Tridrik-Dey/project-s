import type { RevampRegistryType } from "../api/revampApplicationApi";

export type RevampDocumentRenewalEditSession = {
  renewalRequestId: string;
  renewalRequestIds?: string[];
  applicationId: string;
  registryType: RevampRegistryType;
  targetStep: number;
  returnPath: string;
  batchId?: string;
  documentType: string;
  documentLabel: string;
  integrationItemCode?: string;
  certificationKey?: string | null;
  documents?: Array<{
    renewalRequestId: string;
    documentType: string;
    documentLabel: string;
    integrationItemCode?: string;
    certificationKey?: string | null;
  }>;
};

const STORAGE_KEY = "revamp_document_renewal_edit_session";
const REOPEN_DRAWER_KEY = "revamp_document_renewal_reopen_drawer";

export function saveRevampDocumentRenewalEditSession(session: RevampDocumentRenewalEditSession): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function loadRevampDocumentRenewalEditSession(): RevampDocumentRenewalEditSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RevampDocumentRenewalEditSession;
    if (!parsed.renewalRequestId || !parsed.applicationId || !parsed.registryType || !parsed.returnPath) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearRevampDocumentRenewalEditSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function isRevampDocumentRenewalEditFor(
  registryType: RevampRegistryType,
  step: number
): RevampDocumentRenewalEditSession | null {
  const session = loadRevampDocumentRenewalEditSession();
  if (!session || session.registryType !== registryType || session.targetStep !== step) return null;
  return session;
}

export function requestRevampDocumentRenewalDrawerReopen(applicationId: string, batchId?: string): void {
  if (typeof window === "undefined" || !applicationId) return;
  window.sessionStorage.setItem(REOPEN_DRAWER_KEY, JSON.stringify({ applicationId, batchId: batchId ?? null }));
}

export function consumeRevampDocumentRenewalDrawerReopen(applicationId: string): string | null {
  if (typeof window === "undefined" || !applicationId) return null;
  const raw = window.sessionStorage.getItem(REOPEN_DRAWER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { applicationId?: string; batchId?: string | null };
    if (parsed.applicationId !== applicationId) return null;
    window.sessionStorage.removeItem(REOPEN_DRAWER_KEY);
    return parsed.batchId ?? null;
  } catch {
    window.sessionStorage.removeItem(REOPEN_DRAWER_KEY);
    return null;
  }
}
