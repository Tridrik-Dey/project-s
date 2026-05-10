import { apiRequest } from "./http";

const BASE = "/api/v2/admin/smtp-config";

export interface SmtpConfigResponse {
  email: string;
  passwordConfigured?: boolean;
  debugOtpEnabled?: boolean;
}

export interface SmtpConfigPayload {
  email: string;
  password: string;
  debugOtpEnabled: boolean;
}

export function getSmtpConfig(token: string): Promise<SmtpConfigResponse> {
  return apiRequest<SmtpConfigResponse>(BASE, {}, token);
}

export function saveSmtpConfig(token: string, payload: SmtpConfigPayload): Promise<void> {
  return apiRequest<void>(BASE, { method: "POST", body: JSON.stringify(payload) }, token);
}
