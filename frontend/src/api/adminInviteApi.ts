import type { AdminInviteMonitorResponse, AdminInviteResponse } from "../types/api";
import { apiRequest } from "./http";

export interface CreateAdminInvitePayload {
  registryType: "ALBO_A" | "ALBO_B";
  invitedEmail: string;
  invitedName?: string;
  expiresInDays?: number;
  note?: string;
}

export interface RenewAdminInvitePayload {
  expiresInDays?: number;
}

export interface UpdateAdminInvitePayload extends CreateAdminInvitePayload {}

const BASE = "/api/v2/invites";

export function createAdminInvite(
  payload: CreateAdminInvitePayload,
  token: string
): Promise<AdminInviteResponse> {
  return apiRequest<AdminInviteResponse>(
    BASE,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function getAdminInviteMonitor(token: string): Promise<AdminInviteMonitorResponse> {
  return apiRequest<AdminInviteMonitorResponse>(BASE, {}, token);
}

export function renewAdminInvite(
  inviteId: string,
  token: string,
  payload: RenewAdminInvitePayload = {}
): Promise<AdminInviteResponse> {
  return apiRequest<AdminInviteResponse>(
    `${BASE}/${inviteId}/renew`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function resendAdminInvite(
  inviteId: string,
  token: string
): Promise<AdminInviteResponse> {
  return apiRequest<AdminInviteResponse>(
    `${BASE}/${inviteId}/resend`,
    {
      method: "POST"
    },
    token
  );
}

export function updateAdminInvite(
  inviteId: string,
  token: string,
  payload: UpdateAdminInvitePayload
): Promise<AdminInviteResponse> {
  return apiRequest<AdminInviteResponse>(
    `${BASE}/${inviteId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    },
    token
  );
}
