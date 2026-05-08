import { apiRequest } from "./http";
import type { AdminUserInviteResponse } from "../types/api";

export type AdminRole = "SUPER_ADMIN" | "RESPONSABILE_ALBO" | "REVISORE" | "VIEWER";
export type UserRole = "ADMIN" | "SUPPLIER";
export type AdminAccountStatus = "ACTIVE" | "INVITE_PENDING" | "INVITE_EXPIRED" | "DEACTIVATED" | "ARCHIVED";

export interface AdminUserRoleRow {
  userId: string;
  email: string;
  userRole: UserRole;
  active: boolean;
  archived: boolean;
  accountStatus: AdminAccountStatus;
  adminRoles: AdminRole[];
}

interface AdminRoleMutationPayload {
  targetUserId: string;
  adminRole: AdminRole;
}

export interface CreateAdminUserInvitePayload {
  email: string;
  adminRole: AdminRole;
  expiresInDays?: number;
}

const BASE = "/api/v2/admin/users-roles";
const USERS_BASE = "/api/v2/admin/users";

export function getAdminUsersRoles(token: string, query?: string, archivedOnly = false): Promise<AdminUserRoleRow[]> {
  const q = query?.trim();
  const search = new URLSearchParams();
  if (q) search.set("query", q);
  if (archivedOnly) search.set("archivedOnly", "true");
  const qs = search.toString();
  const path = qs ? `${BASE}?${qs}` : BASE;
  return apiRequest<AdminUserRoleRow[]>(path, {}, token);
}

export function getMyAdminUsersRolesProfile(token: string): Promise<AdminUserRoleRow> {
  return apiRequest<AdminUserRoleRow>(`${BASE}/me`, {}, token);
}

export function assignAdminUserRole(
  token: string,
  payload: AdminRoleMutationPayload
): Promise<AdminUserRoleRow> {
  return apiRequest<AdminUserRoleRow>(`${BASE}/assign`, {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function revokeAdminUserRole(
  token: string,
  payload: AdminRoleMutationPayload
): Promise<AdminUserRoleRow> {
  return apiRequest<AdminUserRoleRow>(`${BASE}/revoke`, {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function deactivateAdminUser(
  token: string,
  targetUserId: string
): Promise<AdminUserRoleRow> {
  return apiRequest<AdminUserRoleRow>(`${BASE}/${encodeURIComponent(targetUserId)}/deactivate`, {
    method: "POST"
  }, token);
}

export function reactivateAdminUser(
  token: string,
  targetUserId: string
): Promise<AdminUserRoleRow> {
  return apiRequest<AdminUserRoleRow>(`${BASE}/${encodeURIComponent(targetUserId)}/reactivate`, {
    method: "POST"
  }, token);
}

export function archiveAdminUser(
  token: string,
  targetUserId: string
): Promise<void> {
  return apiRequest<void>(`${BASE}/${encodeURIComponent(targetUserId)}/archive`, {
    method: "POST"
  }, token);
}

export function createAdminUserInvite(
  token: string,
  payload: CreateAdminUserInvitePayload
): Promise<AdminUserInviteResponse> {
  return apiRequest<AdminUserInviteResponse>(`${USERS_BASE}/invite`, {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function resendAdminUserInvite(
  token: string,
  targetUserId: string
): Promise<AdminUserInviteResponse> {
  return apiRequest<AdminUserInviteResponse>(`${USERS_BASE}/${encodeURIComponent(targetUserId)}/invite/resend`, {
    method: "POST"
  }, token);
}
