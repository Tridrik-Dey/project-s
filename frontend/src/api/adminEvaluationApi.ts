import { apiRequest } from "./http";

export interface AdminEvaluationSummary {
  id: string;
  supplierRegistryProfileId: string;
  evaluatorUserId: string;
  evaluatorEmail: string | null;
  overallScore: number;
  createdAt: string;
}

export interface AdminEvaluationAggregate {
  supplierRegistryProfileId: string;
  totalEvaluations: number;
  activeEvaluations: number;
  averageOverallScore: number;
  scoreDistribution?: Record<string, number>;
}

export interface AdminEvaluationOverviewRow {
  evaluationId: string | null;
  supplierRegistryProfileId: string;
  supplierName: string | null;
  supplierType: string | null;
  protocolCode: string | null;
  createdAt: string;
  collaborationType: string | null;
  collaborationPeriod: string | null;
  referenceCode: string | null;
  comment: string | null;
  evaluatorDisplay: string | null;
  averageScore: number;
  evaluationCount?: number;
  dimensionScores: Record<string, number>;
}

export interface AdminEvaluationOverview {
  totalEvaluations: number;
  averageOverallScore: number;
  currentMonthEvaluations: number;
  evaluatedSuppliers: number;
  rows: AdminEvaluationOverviewRow[];
}

export interface AdminEvaluationHistoryItem {
  evaluationId: string;
  createdAt: string;
  collaborationType: string | null;
  collaborationPeriod: string | null;
  referenceCode: string | null;
  comment: string | null;
  averageScore: number;
  dimensionScores: Record<string, number>;
  evaluatorAlias: string;
}

export interface AdminEvaluationAnalytics {
  supplierRegistryProfileId: string;
  supplierName: string | null;
  supplierType: string | null;
  totalEvaluations: number;
  averageOverallScore: number;
  dimensionAverages: Record<string, number>;
  scoreDistribution: Record<string, number>;
  history: AdminEvaluationHistoryItem[];
}

export interface AdminEvaluationAssignmentRow {
  assignmentId: string | null;
  supplierRegistryProfileId: string;
  supplierName: string | null;
  supplierType: string | null;
  assignedEvaluatorUserId: string | null;
  assignedEvaluatorEmail: string | null;
  assignedAt: string | null;
  evaluationId: string | null;
  evaluationScore: number | null;
  evaluatedAt: string | null;
}

export interface AdminEvaluationAssignment {
  assignmentId: string;
  supplierRegistryProfileId: string;
  assignedEvaluatorUserId: string;
  assignedEvaluatorEmail: string | null;
  assignedAt: string;
}

export interface AdminEvaluationOverviewFilters {
  q?: string;
  type?: string;
  period?: string;
  minScore?: number;
  evaluator?: string;
  limit?: number;
}

export interface SubmitEvaluationPayload {
  collaborationType: string;
  collaborationPeriod: string;
  referenceCode?: string;
  overallScore: number;
  comment?: string;
  dimensions?: Record<string, number>;
}

const BASE = "/api/v2/evaluations";

export function selfAssignSupplier(supplierId: string, token: string): Promise<AdminEvaluationAssignment> {
  return apiRequest<AdminEvaluationAssignment>(`${BASE}/assignments/${encodeURIComponent(supplierId)}`, {
    method: "POST"
  }, token);
}

export function getAdminEvaluationAssignments(token: string): Promise<AdminEvaluationAssignmentRow[]> {
  return apiRequest<AdminEvaluationAssignmentRow[]>(`${BASE}/assignments`, {}, token);
}

export function submitEvaluation(
  supplierId: string,
  payload: SubmitEvaluationPayload,
  token: string
): Promise<AdminEvaluationSummary> {
  return apiRequest<AdminEvaluationSummary>(`${BASE}/${encodeURIComponent(supplierId)}/submit`, {
    method: "POST",
    body: JSON.stringify(payload)
  }, token);
}

export function deleteAdminEvaluation(evaluationId: string, token: string): Promise<void> {
  return apiRequest<void>(`${BASE}/${encodeURIComponent(evaluationId)}`, { method: "DELETE" }, token);
}

export function getAdminEvaluationOverview(
  token: string,
  filters: AdminEvaluationOverviewFilters = {}
): Promise<AdminEvaluationOverview> {
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.type) query.set("type", filters.type);
  if (filters.period) query.set("period", filters.period);
  if (typeof filters.minScore === "number" && Number.isFinite(filters.minScore)) query.set("minScore", String(filters.minScore));
  if (filters.evaluator) query.set("evaluator", filters.evaluator);
  query.set("limit", String(filters.limit ?? 200));
  return apiRequest<AdminEvaluationOverview>(`${BASE}/overview?${query.toString()}`, {}, token);
}

export function getAdminEvaluationAnalytics(supplierId: string, token: string): Promise<AdminEvaluationAnalytics> {
  return apiRequest<AdminEvaluationAnalytics>(`${BASE}/${encodeURIComponent(supplierId)}/analytics`, {}, token);
}

export function getAdminEvaluationList(supplierId: string, token: string): Promise<AdminEvaluationSummary[]> {
  return apiRequest<AdminEvaluationSummary[]>(`${BASE}?supplierId=${encodeURIComponent(supplierId)}`, {}, token);
}

export function getAdminEvaluationSummary(supplierId: string, token: string): Promise<AdminEvaluationAggregate> {
  return apiRequest<AdminEvaluationAggregate>(`${BASE}/summary?supplierId=${encodeURIComponent(supplierId)}`, {}, token);
}
