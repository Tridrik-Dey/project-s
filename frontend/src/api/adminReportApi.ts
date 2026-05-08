import { apiBinaryRequest, apiRequest } from "./http";

export interface AdminReportKpis {
  totalSuppliers: number;
  activeSuppliers: number;
  pendingSuppliers: number;
  submittedApplications: number;
  pendingInvites: number;
}

export interface AdminReportMonthlyPoint {
  monthLabel: string;
  alboA: number;
  alboB: number;
}

export interface AdminReportTopicRankingRow {
  label: string;
  value: number;
  percentage: number;
}

export interface AdminReportDistributionRow {
  label: string;
  value: number;
}

export interface AdminReportTopSupplierRow {
  name: string;
  subtitle: string;
  averageScore: number;
  evaluationsCount: number;
}

export interface AdminReportAnalytics {
  kpis: AdminReportKpis;
  alboAActive: number;
  alboBActive: number;
  newRegistrationsYtd: number;
  evaluationsYtd: number;
  approvalRatePct: number;
  monthlyPoints: AdminReportMonthlyPoint[];
  thematicRanking: AdminReportTopicRankingRow[];
  distribution: AdminReportDistributionRow[];
  topSuppliers: AdminReportTopSupplierRow[];
}

export interface AdminReportFilters {
  year?: number;
  periodFrom?: string;
  periodTo?: string;
  registryType?: "ALBO_A" | "ALBO_B";
  groupCompany?: string;
  category?: string;
  profileStatus?: string;
  ratingBand?: string;
  exportFormat?: "xlsx" | "pdf";
}

const BASE = "/api/v2/reports";

function buildReportQuery(filters: AdminReportFilters = {}): string {
  const params = new URLSearchParams();
  if (typeof filters.year === "number") params.set("year", String(filters.year));
  if (filters.periodFrom) params.set("periodFrom", filters.periodFrom);
  if (filters.periodTo) params.set("periodTo", filters.periodTo);
  if (filters.registryType) params.set("registryType", filters.registryType);
  if (filters.groupCompany) params.set("groupCompany", filters.groupCompany);
  if (filters.category) params.set("category", filters.category);
  if (filters.profileStatus) params.set("profileStatus", filters.profileStatus);
  if (filters.ratingBand) params.set("ratingBand", filters.ratingBand);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function getAdminReportKpis(token: string): Promise<AdminReportKpis> {
  return apiRequest<AdminReportKpis>(`${BASE}/kpis`, {}, token);
}

export function getAdminReportAnalytics(token: string, filters: AdminReportFilters = {}): Promise<AdminReportAnalytics> {
  return apiRequest<AdminReportAnalytics>(`${BASE}/analytics${buildReportQuery(filters)}`, {}, token);
}

export function exportAdminKpisReport(token: string): Promise<{ blob: Blob; filename: string }> {
  return apiBinaryRequest(`${BASE}/export?type=kpis`, { method: "GET" }, token);
}

export function exportAdminReportExcel(
  token: string,
  filters: AdminReportFilters = {}
): Promise<{ blob: Blob; filename: string }> {
  const query = new URLSearchParams();
  query.set("type", "report");
  if (typeof filters.year === "number") query.set("year", String(filters.year));
  if (filters.periodFrom) query.set("periodFrom", filters.periodFrom);
  if (filters.periodTo) query.set("periodTo", filters.periodTo);
  if (filters.registryType) query.set("registryType", filters.registryType);
  if (filters.groupCompany) query.set("groupCompany", filters.groupCompany);
  if (filters.category) query.set("category", filters.category);
  if (filters.profileStatus) query.set("profileStatus", filters.profileStatus);
  if (filters.ratingBand) query.set("ratingBand", filters.ratingBand);
  return apiBinaryRequest(`${BASE}/export?${query.toString()}`, { method: "GET" }, token);
}

export interface AdminSearchExportParams {
  q?: string;
  fields?: string[];
}

export function exportAdminSearchReport(
  token: string,
  params: AdminSearchExportParams = {}
): Promise<{ blob: Blob; filename: string }> {
  const query = new URLSearchParams();
  query.set("type", "search");
  if (params.q) {
    query.set("q", params.q);
  }
  if (params.fields?.length) {
    params.fields.forEach((field) => query.append("fields", field));
  }
  return apiBinaryRequest(`${BASE}/export?${query.toString()}`, { method: "GET" }, token);
}

export type QuickExportType = "albo" | "queue" | "eval" | "annual";

export function exportAdminQuickReport(
  token: string,
  type: QuickExportType,
  year?: number
): Promise<{ blob: Blob; filename: string }> {
  const query = new URLSearchParams();
  query.set("type", type);
  if (typeof year === "number") query.set("year", String(year));
  return apiBinaryRequest(`${BASE}/export?${query.toString()}`, { method: "GET" }, token);
}
