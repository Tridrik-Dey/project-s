import { apiRequest } from "./http";
import type { DocumentRenewalRequest } from "./documentRenewalRequestApi";

export interface AdminReviewCaseSummary {
  id: string;
  applicationId: string;
  protocolCode?: string | null;
  status: string;
  decision?: string | null;
  assignedToUserId?: string | null;
  assignedToDisplayName?: string | null;
  assignedAt?: string | null;
  slaDueAt?: string | null;
  verifiedByUserId?: string | null;
  verifiedByDisplayName?: string | null;
  verifiedAt?: string | null;
  verificationNote?: string | null;
  verificationOutcome?: "COMPLIANT" | "COMPLIANT_WITH_RESERVATIONS" | "INCOMPLETE" | "NON_COMPLIANT" | null;
  decidedByUserId?: string | null;
  decidedByDisplayName?: string | null;
  decidedAt?: string | null;
  latestIntegrationRequestStatus?: string | null;
  latestIntegrationSupplierRespondedAt?: string | null;
  updatedAt: string;
  registryType?: string | null;
  applicantDisplayName?: string | null;
  reviewType?: "APPLICATION" | "FIELD_CHANGE" | "DOCUMENT_RENEWAL" | string | null;
  fieldChangeRequestId?: string | null;
  fieldChangeSectionKey?: string | null;
  fieldChangeStatus?: string | null;
  fieldChangeBeforeValueJson?: string | null;
  fieldChangeAfterValueJson?: string | null;
  documentRenewalRequestId?: string | null;
  documentRenewalStatus?: string | null;
  documentRenewalSectionKey?: string | null;
  documentRenewalDocumentType?: string | null;
  documentRenewalDocumentLabel?: string | null;
  documentRenewalOldAttachmentJson?: string | null;
  documentRenewalNewAttachmentJson?: string | null;
  documentRenewalSubmittedCount?: number | null;
  documentRenewalPendingSupplierCount?: number | null;
  activeDocumentRenewalRequests?: DocumentRenewalRequest[] | null;
}

export interface AdminIntegrationRequestSummary {
  id: string;
  reviewCaseId: string;
  status: string;
  dueAt: string;
  requestMessage: string;
  requestedItemsJson: unknown;
  updatedAt: string;
}

const BASE = "/api/v2/reviews";

export function getAdminReviewQueue(token: string): Promise<AdminReviewCaseSummary[]> {
  return apiRequest<AdminReviewCaseSummary[]>(`${BASE}/queue`, {}, token);
}

export function getAdminDecidedQueue(token: string): Promise<AdminReviewCaseSummary[]> {
  return apiRequest<AdminReviewCaseSummary[]>(`${BASE}/decided`, {}, token);
}

export function getAdminReviewHistory(
  applicationId: string,
  token: string
): Promise<AdminReviewCaseSummary[]> {
  return apiRequest<AdminReviewCaseSummary[]>(
    `${BASE}/${encodeURIComponent(applicationId)}/history`,
    {},
    token
  );
}

export function assignAdminReviewCase(
  applicationId: string,
  token: string,
  payload?: { assignedToUserId?: string; slaDueAt?: string }
): Promise<AdminReviewCaseSummary> {
  return apiRequest<AdminReviewCaseSummary>(
    `${BASE}/${encodeURIComponent(applicationId)}/assign`,
    {
      method: "POST",
      body: payload ? JSON.stringify(payload) : undefined
    },
    token
  );
}

export function requestAdminIntegration(
  reviewCaseId: string,
  token: string,
  payload: { dueAt: string; message: string; requestedItemsJson?: string }
): Promise<AdminReviewCaseSummary> {
  return apiRequest<AdminReviewCaseSummary>(
    `${BASE}/${encodeURIComponent(reviewCaseId)}/integration-request`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function saveAdminReviewDecision(
  reviewCaseId: string,
  token: string,
  payload: { decision: "APPROVED" | "REJECTED" | "INTEGRATION_REQUIRED"; reason?: string }
): Promise<AdminReviewCaseSummary> {
  return apiRequest<AdminReviewCaseSummary>(
    `${BASE}/${encodeURIComponent(reviewCaseId)}/decision`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function verifyAdminReviewCase(
  reviewCaseId: string,
  token: string,
  payload?: {
    verificationNote?: string;
    verificationOutcome?: "COMPLIANT" | "COMPLIANT_WITH_RESERVATIONS" | "INCOMPLETE" | "NON_COMPLIANT";
  }
): Promise<AdminReviewCaseSummary> {
  return apiRequest<AdminReviewCaseSummary>(
    `${BASE}/${encodeURIComponent(reviewCaseId)}/verify`,
    {
      method: "POST",
      body: payload ? JSON.stringify(payload) : undefined
    },
    token
  );
}

export function getLatestAdminIntegrationRequest(
  reviewCaseId: string,
  token: string
): Promise<AdminIntegrationRequestSummary | null> {
  return apiRequest<AdminIntegrationRequestSummary | null>(
    `${BASE}/${encodeURIComponent(reviewCaseId)}/integration-latest`,
    {},
    token
  );
}
