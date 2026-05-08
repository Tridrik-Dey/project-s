import type { PageResponse } from "../types/api";
import { apiRequest } from "./http";

export type RegistryType = "ALBO_A" | "ALBO_B";
export type RegistryProfileStatus = "APPROVED" | "SUSPENDED" | "RENEWAL_DUE" | "ARCHIVED";

export interface AdminRegistryProfileRow {
  id: string;
  applicationId: string | null;
  supplierUserId: string | null;
  supplierEmail: string | null;
  registryType: RegistryType;
  status: RegistryProfileStatus;
  displayName: string | null;
  publicSummary: string | null;
  aggregateScore: number | null;
  visible: boolean;
  approvedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  publicCardView?: Record<string, unknown> | null;
  adminCardView?: Record<string, unknown> | null;
}

interface ListAdminProfilesParams {
  registryType?: RegistryType;
  status?: RegistryProfileStatus;
  q?: string;
  ateco?: string;
  region?: string;
  serviceCategory?: string;
  certification?: string;
  page?: number;
  size?: number;
}

const BASE = "/api/v2/profiles";

export function listAdminProfiles(
  token: string,
  params: ListAdminProfilesParams
): Promise<PageResponse<AdminRegistryProfileRow>> {
  const search = new URLSearchParams();
  if (params.registryType) search.set("registryType", params.registryType);
  if (params.status) search.set("status", params.status);
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.ateco?.trim()) search.set("ateco", params.ateco.trim());
  if (params.region?.trim()) search.set("region", params.region.trim());
  if (params.serviceCategory?.trim()) search.set("serviceCategory", params.serviceCategory.trim());
  if (params.certification?.trim()) search.set("certification", params.certification.trim());
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.size !== undefined) search.set("size", String(params.size));
  const query = search.toString();
  const path = query ? `${BASE}?${query}` : BASE;
  return apiRequest<PageResponse<AdminRegistryProfileRow>>(path, {}, token);
}
