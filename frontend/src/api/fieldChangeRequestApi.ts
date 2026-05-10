import { apiRequest } from "./http";

export type FieldChangeRequestStatus =
  | "PENDING_ADMIN_REVIEW"
  | "UNLOCKED"
  | "CANCELLED_BY_SUPPLIER"
  | "REJECTED_BY_ADMIN"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED";

export interface FieldChangeRequest {
  id: string;
  applicationId: string;
  sectionKey: string;
  supplierMessage: string;
  status: FieldChangeRequestStatus;
  adminNote: string | null;
  unlockedByUserEmail: string | null;
  unlockedAt: string | null;
  submittedAt: string | null;
  beforeValueJson: string | null;
  afterValueJson: string | null;
  reviewCaseId: string | null;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFieldChangeRequestPayload {
  sectionKey: string;
  supplierMessage: string;
}

export interface AdminFieldChangeActionPayload {
  adminNote?: string;
}

export interface AdminPendingFieldChangeRequest {
  id: string;
  applicationId: string;
  profileId: string | null;
  protocolCode: string | null;
  registryType: "ALBO_A" | "ALBO_B" | null;
  supplierDisplayName: string | null;
  supplierEmail: string | null;
  sectionKey: string;
  supplierMessage: string | null;
  status: FieldChangeRequestStatus;
  createdAt: string;
  updatedAt: string;
}

const BASE = "/api/v2/field-change-requests";

export function createFieldChangeRequest(
  applicationId: string,
  payload: CreateFieldChangeRequestPayload,
  token: string
): Promise<FieldChangeRequest> {
  return apiRequest<FieldChangeRequest>(
    `${BASE}/applications/${applicationId}`,
    { method: "POST", body: JSON.stringify(payload) },
    token
  );
}

export function listFieldChangeRequests(
  applicationId: string,
  token: string
): Promise<FieldChangeRequest[]> {
  return apiRequest<FieldChangeRequest[]>(
    `${BASE}/applications/${applicationId}`,
    {},
    token
  );
}

export function getFieldChangeRequest(
  fcrId: string,
  token: string
): Promise<FieldChangeRequest> {
  return apiRequest<FieldChangeRequest>(`${BASE}/${fcrId}`, {}, token);
}

export function listPendingAdminFieldChangeRequests(
  token: string
): Promise<AdminPendingFieldChangeRequest[]> {
  return apiRequest<AdminPendingFieldChangeRequest[]>(`${BASE}/admin/pending`, {}, token);
}

export function adminUnlockSection(
  fcrId: string,
  payload: AdminFieldChangeActionPayload,
  token: string
): Promise<FieldChangeRequest> {
  return apiRequest<FieldChangeRequest>(
    `${BASE}/${fcrId}/unlock`,
    { method: "POST", body: JSON.stringify(payload) },
    token
  );
}

export function adminRejectChangeRequest(
  fcrId: string,
  payload: AdminFieldChangeActionPayload,
  token: string
): Promise<FieldChangeRequest> {
  return apiRequest<FieldChangeRequest>(
    `${BASE}/${fcrId}/reject`,
    { method: "POST", body: JSON.stringify(payload) },
    token
  );
}

export function supplierSubmitChange(
  fcrId: string,
  token: string
): Promise<FieldChangeRequest> {
  return apiRequest<FieldChangeRequest>(
    `${BASE}/${fcrId}/submit`,
    { method: "POST" },
    token
  );
}

export function supplierCancelChangeRequest(
  fcrId: string,
  token: string
): Promise<FieldChangeRequest> {
  return apiRequest<FieldChangeRequest>(
    `${BASE}/${fcrId}/cancel`,
    { method: "POST" },
    token
  );
}
