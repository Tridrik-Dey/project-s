import { apiRequest } from "./http";

export type DocumentRenewalRequestStatus =
  | "REMINDER_SENT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED_NO_RESPONSE";

export interface DocumentRenewalRequest {
  id: string;
  applicationId: string;
  reviewCaseId: string | null;
  sectionKey: string;
  batchId: string;
  documentType: string;
  documentLabel: string;
  integrationItemCode: string;
  certificationKey: string | null;
  expiryDate: string | null;
  status: DocumentRenewalRequestStatus;
  oldAttachmentJson: string | null;
  newAttachmentJson: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  expiredWithoutResponse: boolean;
}

const BASE = "/api/v2/document-renewal-requests";

export function listDocumentRenewalRequests(
  applicationId: string,
  token: string
): Promise<DocumentRenewalRequest[]> {
  return apiRequest<DocumentRenewalRequest[]>(`${BASE}/applications/${applicationId}`, {}, token);
}

export function submitDocumentRenewalRequest(
  renewalId: string,
  token: string
): Promise<DocumentRenewalRequest> {
  return apiRequest<DocumentRenewalRequest>(
    `${BASE}/${renewalId}/submit`,
    { method: "POST" },
    token
  );
}

export function submitDocumentRenewalBatch(
  applicationId: string,
  batchId: string,
  token: string
): Promise<DocumentRenewalRequest[]> {
  return apiRequest<DocumentRenewalRequest[]>(
    `${BASE}/applications/${applicationId}/batches/${encodeURIComponent(batchId)}/submit`,
    { method: "POST" },
    token
  );
}
