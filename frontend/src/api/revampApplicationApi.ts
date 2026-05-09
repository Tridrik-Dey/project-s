import { apiRequest } from "./http";

export type RevampRegistryType = "ALBO_A" | "ALBO_B";
export type RevampSourceChannel = "PUBLIC" | "INVITE";

export interface CreateRevampApplicationDraftRequest {
  registryType: RevampRegistryType;
  sourceChannel: RevampSourceChannel;
  inviteId?: string;
}

export interface RevampApplicationSummary {
  id: string;
  applicantUserId: string;
  registryType: RevampRegistryType;
  sourceChannel: RevampSourceChannel;
  status: string;
  protocolCode: string | null;
  currentRevision: number;
  submittedAt: string | null;
  updatedAt: string;
}

export interface RevampSectionSnapshot {
  id: string;
  applicationId: string;
  sectionKey: string;
  sectionVersion: number;
  completed: boolean;
  payloadJson: string;
  updatedAt: string;
}

export interface RevampApplicationCommunication {
  eventKey: string;
  message: string;
  occurredAt: string;
}

export interface RevampIntegrationRequestSummary {
  id: string;
  reviewCaseId: string;
  status: string;
  dueAt: string;
  requestMessage: string;
  requestedItemsJson: unknown;
  supplierResponseJson?: unknown;
  updatedAt: string;
}

export interface RevampIdentityAvailability {
  available: boolean;
  field: "taxCode" | "vatNumber" | string;
  messageKey: string | null;
}

export interface OtpChallengeDispatchResponse {
  challengeId: string;
  expiresAt: string;
  status: string;
  deliveryMode: "SENT" | "SIMULATED";
  targetEmailMasked: string;
  debugCode?: string | null;
}

export interface OtpChallengeVerifyResponse {
  challengeId: string;
  verified: boolean;
  status: string;
  attempts: number;
  maxAttempts: number;
  verifiedAt: string | null;
}

const BASE = "/api/v2/applications";

export interface MyEvaluationAggregate {
  supplierRegistryProfileId: string | null;
  totalEvaluations: number;
  activeEvaluations: number;
  averageOverallScore: number;
  dimensionAverages: Record<string, number>;
  scoreDistribution: Record<string, number>;
}

export function getMyEvaluationAggregate(token: string): Promise<MyEvaluationAggregate> {
  return apiRequest<MyEvaluationAggregate>(`${BASE}/me/evaluation-aggregate`, {}, token);
}

export function createRevampApplicationDraft(
  payload: CreateRevampApplicationDraftRequest,
  token: string
): Promise<RevampApplicationSummary> {
  return apiRequest<RevampApplicationSummary>(
    BASE,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function getRevampApplicationSummary(
  applicationId: string,
  token: string
): Promise<RevampApplicationSummary> {
  return apiRequest<RevampApplicationSummary>(`${BASE}/${applicationId}`, {}, token);
}

export function getMyLatestRevampApplication(
  token: string
): Promise<RevampApplicationSummary | null> {
  return apiRequest<RevampApplicationSummary | null>(`${BASE}/me/latest`, {}, token);
}

export function getRevampApplicationSections(
  applicationId: string,
  token: string
): Promise<RevampSectionSnapshot[]> {
  return apiRequest<RevampSectionSnapshot[]>(`${BASE}/${applicationId}/sections`, {}, token);
}

export function deleteRevampApplicationDraft(
  applicationId: string,
  token: string
): Promise<void> {
  return apiRequest<void>(
    `${BASE}/${applicationId}/draft`,
    { method: "DELETE" },
    token
  );
}

export function checkRevampIdentityAvailability(
  applicationId: string,
  field: "taxCode" | "vatNumber" | "piva",
  value: string,
  token: string
): Promise<RevampIdentityAvailability> {
  const params = new URLSearchParams({ field, value });
  return apiRequest<RevampIdentityAvailability>(
    `${BASE}/${applicationId}/identity/check?${params.toString()}`,
    {},
    token
  );
}

export function getRevampApplicationCommunications(
  applicationId: string,
  token: string
): Promise<RevampApplicationCommunication[]> {
  return apiRequest<RevampApplicationCommunication[]>(`${BASE}/${applicationId}/communications`, {}, token);
}

export function getOpenRevampIntegrationRequest(
  applicationId: string,
  token: string
): Promise<RevampIntegrationRequestSummary | null> {
  return apiRequest<RevampIntegrationRequestSummary | null>(
    `${BASE}/${applicationId}/integration-request/open`,
    {},
    token
  );
}

export function saveRevampApplicationSection(
  applicationId: string,
  sectionKey: string,
  payloadJson: string,
  completed: boolean,
  token: string
): Promise<RevampSectionSnapshot> {
  return apiRequest<RevampSectionSnapshot>(
    `${BASE}/${applicationId}/sections/${encodeURIComponent(sectionKey)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        payloadJson,
        completed
      })
    },
    token
  );
}

export interface AttachmentUploadResult {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export function uploadRevampAttachment(
  applicationId: string,
  file: File,
  token: string
): Promise<AttachmentUploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<AttachmentUploadResult>(
    `${BASE}/${applicationId}/attachments/upload`,
    { method: "POST", body: formData },
    token
  );
}

export function submitRevampApplication(
  applicationId: string,
  token: string
): Promise<RevampApplicationSummary> {
  return apiRequest<RevampApplicationSummary>(
    `${BASE}/${applicationId}/submit`,
    { method: "POST" },
    token
  );
}

export function answerRevampIntegrationRequest(
  applicationId: string,
  token: string
): Promise<RevampApplicationSummary> {
  return apiRequest<RevampApplicationSummary>(
    `${BASE}/${applicationId}/integration-response`,
    { method: "POST" },
    token
  );
}

export function completeRevampIntegrationItem(
  applicationId: string,
  itemCode: string,
  token: string
): Promise<RevampApplicationSummary> {
  return apiRequest<RevampApplicationSummary>(
    `${BASE}/${applicationId}/integration-response/items/${encodeURIComponent(itemCode)}/complete`,
    { method: "POST" },
    token
  );
}

export function sendDeclarationOtpChallenge(
  applicationId: string,
  token: string
): Promise<OtpChallengeDispatchResponse> {
  return apiRequest<OtpChallengeDispatchResponse>(
    "/api/v2/otp-challenges/declaration/send",
    {
      method: "POST",
      body: JSON.stringify({ applicationId })
    },
    token
  );
}

export function verifyDeclarationOtpChallenge(
  challengeId: string,
  otpCode: string,
  token: string
): Promise<OtpChallengeVerifyResponse> {
  return apiRequest<OtpChallengeVerifyResponse>(
    "/api/v2/otp-challenges/declaration/verify",
    {
      method: "POST",
      body: JSON.stringify({ challengeId, otpCode })
    },
    token
  );
}
